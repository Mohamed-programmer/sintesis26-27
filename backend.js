// ===== BACKEND (Supabase): cliente, carga de datos, tiempo real y sesión =====
var sb = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL.indexOf('TU-PROYECTO') === -1 && SUPABASE_KEY.indexOf('TU-CLAVE') === -1 && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
var reloadTimer = null, channel = null;

function toast(msg, isErr){
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = isErr ? '#c23b3b' : '#0a1b3d';
  t.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ t.style.display = 'none'; }, 4500);
}
function fail(e){ console.error(e); toast((e && e.message) ? e.message : 'Algo ha fallado. Inténtalo de nuevo.', true); }
function needSb(){ if(sb) return false; toast('Falta conectar Supabase: edita SUPABASE_URL y SUPABASE_KEY en el archivo.', true); return true; }
function fmtDate(iso){ var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function fmtTime(iso){ return new Date(iso).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}); }

function saveProfile(patch){
  if(!currentUser || !sb) return;
  if(blockedNow()){ guardBlocked(); loadAll(); return; }
  Object.assign(currentUser, patch);
  sb.from('profiles').update(patch).eq('id', currentUser.id).then(function(r){ if(r.error) fail(r.error); });
}

function renderAll(){
  renderTasks(); renderMisTareas(); renderPendientes(); renderNavAccount(); renderAdmin(); renderModeration();
  if(currentChatTaskId && document.getElementById('view-chat').classList.contains('active')) renderChat();
}

async function loadAll(){
  if(!sb) return;
  var res = await Promise.all([
    sb.from('profiles').select('*'),
    sb.from('tasks').select('*').order('created_at', { ascending: false }),
    sb.from('applications').select('*'),
    sb.from('messages').select('*').order('created_at', { ascending: true }),
    sb.from('completed_jobs').select('*'),
    currentUser ? sb.from('admins').select('user_id').eq('user_id', currentUser.id) : Promise.resolve({ data: [], error: null }),
    sb.from('reports').select('*').order('created_at', { ascending: false }),
    sb.from('sanctions').select('*').order('created_at', { ascending: false })
  ]);
  for(var i = 0; i < 5; i++){ if(res[i].error){ fail(res[i].error); return false; } }
  var profs = res[0].data, tasks = res[1].data, apps = res[2].data, msgs = res[3].data, jobs = res[4].data;
  isAdmin = !!(res[5] && res[5].data && res[5].data.length);
  REPORTS = (res[6] && res[6].data) || [];
  SANCTIONS = (res[7] && res[7].data) || [];

  PROFILES = {};
  profs.forEach(function(p){
    PROFILES[p.id] = { id: p.id, name: p.name, bio: p.bio, skills: p.skills || [], avatar: p.avatar || '', blockedUntil: p.blocked_until || null, blockedReason: p.blocked_reason || '',
      memberSince: 'En TaskFlow desde ' + new Date(p.created_at).getFullYear(), completed: [] };
  });
  REVIEWS = {};
  jobs.forEach(function(j){
    if(j.task_id) (REVIEWS[j.task_id] = REVIEWS[j.task_id] || []).push({ reviewer: j.reviewer, user: j.user_id, rating: Number(j.rating), comment: j.comment });
    if(PROFILES[j.user_id]) PROFILES[j.user_id].completed.push({ title: j.title, client: j.client_name, rating: Number(j.rating), comment: j.comment, date: fmtDate(j.done_on), price: j.price });
  });
  if(currentUser && PROFILES[currentUser.id]){
    PROFILES[currentUser.id].email = currentUser.email;
    currentUser = PROFILES[currentUser.id];
  }

  TASKS = tasks.map(function(t){
    return { id: t.id, tag: t.tag, title: t.title, cardDesc: t.card_desc, desc: String(t.description).split(/\n\n+/),
      price: t.price, date: t.deadline ? fmtDate(t.deadline) : 'Sin fecha límite', owner: t.owner };
  });
  CANDIDATES = {}; TASK_STATUS = {}; CHATS = {};
  apps.forEach(function(a){
    var p = PROFILES[a.user_id];
    if(!p) return;
    (CANDIDATES[a.task_id] = CANDIDATES[a.task_id] || []).push({ userId: a.user_id, name: p.name, rating: ratingOf(p), price: a.price, message: a.message });
  });
  tasks.forEach(function(t){
    var w = t.assigned_to && PROFILES[t.assigned_to];
    if(w) TASK_STATUS[t.id] = { status: 'asignada', assignedTo: w.name, assignedUserId: t.assigned_to, agreedPrice: t.agreed_price || t.price, deliveredAt: t.delivered_at || null, completedAt: t.completed_at || null };
  });
  msgs.forEach(function(m){
    (CHATS[m.task_id] = CHATS[m.task_id] || []).push({ system: m.system, from: m.sender, text: m.body, time: fmtTime(m.created_at) });
  });
  renderAll();
  return true;
}

function scheduleReload(){ clearTimeout(reloadTimer); reloadTimer = setTimeout(loadAll, 250); }
var modChannel = null;
function unsubscribeRealtime(){
  if(sb){ if(channel) sb.removeChannel(channel); if(modChannel) sb.removeChannel(modChannel); }
  channel = null; modChannel = null;
}
function subscribeRealtime(){
  unsubscribeRealtime();
  if(!sb) return;
  channel = sb.channel('taskflow-live');
  ['messages', 'applications', 'tasks', 'completed_jobs'].forEach(function(table){
    channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, scheduleReload);
  });
  channel.subscribe();
  modChannel = sb.channel('taskflow-moderation');
  ['reports', 'sanctions'].forEach(function(table){
    modChannel.on('postgres_changes', { event: '*', schema: 'public', table: table }, scheduleReload);
  });
  modChannel.subscribe();
}

async function applySession(session){
  if(session && session.user){
    if(currentUser && currentUser.id === session.user.id) return;
    currentUser = { id: session.user.id, email: session.user.email, name: '', bio: '', skills: [], avatar: '', completed: [] };
    var okLoad = await loadAll();
    if(okLoad && !PROFILES[session.user.id]){
      await sb.auth.signOut();
      currentUser = null; isAdmin = false;
      toast('Tu cuenta ya no existe o ha sido eliminada.', true);
      await loadAll();
      return;
    }
    subscribeRealtime();
  } else {
    currentUser = null; currentChatTaskId = null; currentCandTaskId = null; isAdmin = false;
    unsubscribeRealtime();
    await loadAll();
  }
  renderAll();
}
async function initAuth(){
  if(!sb){ document.getElementById('setup-banner').style.display = 'block'; return; }
  var r = await sb.auth.getSession();
  await applySession(r.data.session);
  sb.auth.onAuthStateChange(function(event, session){
    if(event === 'PASSWORD_RECOVERY'){ recoveryMode = true; }
    if(event === 'SIGNED_IN' || event === 'SIGNED_OUT'){ setTimeout(function(){ applySession(session); }, 0); }
  });
  handleAuthUrl();
}

async function adminRpc(name, args, okMsg){
  if(needSb()) return false;
  var r = await sb.rpc(name, args);
  if(r.error){ fail(r.error); return false; }
  if(okMsg) toast(okMsg, false);
  await loadAll();
  return true;
}
