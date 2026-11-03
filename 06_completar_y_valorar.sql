-- =====================================================================
-- TaskFlow · Actualización 6: completar tareas y valoración mutua
-- Pégalo en Supabase > SQL Editor > New query > Run.
-- Ejecútalo ANTES de subir la web nueva. Requiere haber ejecutado 01–05.
-- Se puede volver a ejecutar sin problema.
-- =====================================================================

-- 1) Estado de la tarea: entregada (por quien la realiza) y completada (por el cliente)
alter table public.tasks
  add column if not exists delivered_at timestamptz,
  add column if not exists completed_at timestamptz;

-- 2) Las valoraciones se guardan en completed_jobs (así ya salen en el perfil y en la media)
alter table public.completed_jobs
  add column if not exists task_id uuid references public.tasks(id) on delete set null,
  add column if not exists reviewer uuid references public.profiles(id) on delete set null;

-- Una sola valoración por persona y tarea
create unique index if not exists completed_jobs_una_por_tarea
  on public.completed_jobs (task_id, reviewer)
  where task_id is not null and reviewer is not null;

-- 3) Completar tarea
--    · Quien la realiza → la marca como realizada (el cliente debe confirmar)
--    · El cliente → la da por completada (se abre la valoración mutua)
create or replace function public.complete_task(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_task public.tasks; v_name text;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if public.is_blocked() then raise exception 'Tu cuenta está suspendida'; end if;
  select * into v_task from public.tasks where id = p_task for update;
  if not found or v_task.assigned_to is null then raise exception 'La tarea no está en curso'; end if;
  if v_task.completed_at is not null then raise exception 'La tarea ya está completada'; end if;
  select name into v_name from public.profiles where id = auth.uid();

  if auth.uid() = v_task.owner then
    update public.tasks set completed_at = now() where id = p_task;
    insert into public.messages (task_id, sender, body, system)
    values (p_task, null, v_name || ' ha dado la tarea por completada. Ahora podéis puntuaros mutuamente.', true);
  elsif auth.uid() = v_task.assigned_to then
    if v_task.delivered_at is not null then raise exception 'Ya has marcado la tarea como realizada'; end if;
    update public.tasks set delivered_at = now() where id = p_task;
    insert into public.messages (task_id, sender, body, system)
    values (p_task, null, v_name || ' ha marcado la tarea como realizada. Falta que el cliente la confirme.', true);
  else
    raise exception 'No autorizado';
  end if;
end $$;

-- 4) Valorar a la otra parte (solo con la tarea completada, una vez por persona)
create or replace function public.submit_review(p_task uuid, p_rating numeric, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare v_task public.tasks; v_other uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if public.is_blocked() then raise exception 'Tu cuenta está suspendida'; end if;
  select * into v_task from public.tasks where id = p_task;
  if not found then raise exception 'Tarea no encontrada'; end if;
  if v_task.completed_at is null then raise exception 'La tarea todavía no está completada'; end if;
  if auth.uid() = v_task.owner then v_other := v_task.assigned_to;
  elsif auth.uid() = v_task.assigned_to then v_other := v_task.owner;
  else raise exception 'No autorizado'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 or p_rating * 2 <> round(p_rating * 2) then
    raise exception 'La puntuación debe estar entre 1 y 5';
  end if;
  if char_length(coalesce(p_comment, '')) > 300 then raise exception 'El comentario no puede superar los 300 caracteres'; end if;
  if exists (select 1 from public.completed_jobs where task_id = p_task and reviewer = auth.uid()) then
    raise exception 'Ya has valorado esta tarea';
  end if;
  select name into v_name from public.profiles where id = auth.uid();
  insert into public.completed_jobs (user_id, title, client_name, rating, comment, done_on, price, task_id, reviewer)
  values (v_other, v_task.title, coalesce(v_name, 'Usuario'), p_rating, coalesce(p_comment, ''),
          current_date, coalesce(v_task.agreed_price, v_task.price), p_task, auth.uid());
end $$;

revoke all on function public.complete_task(uuid) from public, anon;
revoke all on function public.submit_review(uuid, numeric, text) from public, anon;
grant execute on function public.complete_task(uuid) to authenticated;
grant execute on function public.submit_review(uuid, numeric, text) to authenticated;

-- 5) Tiempo real para las valoraciones
do $$ begin
  alter publication supabase_realtime add table public.completed_jobs;
exception when duplicate_object then null; end $$;
