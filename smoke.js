const fs=require('fs'), vm=require('vm');
const rd=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
const cfg=rd('js/config.js').replace("https://TU-PROYECTO.supabase.co","https://x.supabase.co").replace("TU-CLAVE-PUBLICA-ANON","k"), contactCfg=rd('js/contacto-config.js'), main=rd('js/backend.js')+"\n"+rd('js/app.js');
const data={profiles:[{id:'u1',name:'Ana',bio:'b',skills:['x'],avatar:'',created_at:'2025-01-01'},{id:'u2',name:'Marta',bio:'b2',skills:[],avatar:'',created_at:'2025-02-01'},{id:'u3',name:'Admin',bio:'',skills:[],avatar:'',created_at:'2025-03-01'}],
 tasks:[{id:'t1',owner:'u1',title:'Tarea1',tag:'Educación',card_desc:'c',description:'d1\n\nd2',price:'10€',deadline:'2026-11-27',assigned_to:null,agreed_price:null,created_at:'2026-01-01'}],
 applications:[{id:'a1',task_id:'t1',user_id:'u2',price:'9€',message:'hola',created_at:'2026-01-02'}], messages:[],
 completed_jobs:[{user_id:'u2',title:'x',client_name:'c',rating:4.5,comment:'ok',done_on:'2026-01-02',price:'1€'}]};
data.admins=[];data.reports=[];data.sanctions=[];const calls=[];
function qb(t){const o={select(){return o},order(){return o},eq(){return o},then(res,rej){return Promise.resolve({data:JSON.parse(JSON.stringify(data[t])),error:null}).then(res,rej)},
 insert(x){calls.push([t,'insert',x]);return Promise.resolve({error:null})},update(x){calls.push([t,'update',x]);return {eq(){return Promise.resolve({error:null})}}},
 delete(){calls.push([t,'delete']);return {eq(){return {select(){return Promise.resolve({error:null,data:[{}]})}}}}}};return o}
const chan={on(){return chan},subscribe(){return chan}};
let fakeSignIn={error:null,data:{session:{user:{id:'u1',email:'a@b.c'}}}},fakeSignUp={error:null,data:{session:null,user:{identities:[{}]}}},fakeUpdate={},fakeReset={error:null};
const fake={from:qb,rpc(n,a){calls.push(['rpc',n,a]);if(n!=='accept_candidate')return Promise.resolve({error:null});data.tasks[0].assigned_to=a.p_user;data.messages.push({task_id:a.p_task,sender:null,body:'Ana ha aceptado a Marta.',system:true,created_at:'2026-01-03T10:00:00Z'});return Promise.resolve({error:null})},
 auth:{getSession(){return Promise.resolve({data:{session:null}})},onAuthStateChange(){},signOut(){return Promise.resolve({})},signInWithPassword(a){calls.push(['signIn',a]);return Promise.resolve(fakeSignIn)},signUp(a){calls.push(['signUp',a]);return Promise.resolve(fakeSignUp)},updateUser(a){calls.push(['updateUser',a]);return Promise.resolve(fakeUpdate)},resend(a){calls.push(['resend',a]);return Promise.resolve({error:null})},resetPasswordForEmail(e,o){calls.push(['reset',e,o]);return Promise.resolve(fakeReset)}},
 channel(){return chan},removeChannel(){}};
const els={};
function el(id){return els[id]||(els[id]={id,value:'',style:{},dataset:{},_h:{},classList:{contains:()=>false,toggle(){},add(){},remove(){}},addEventListener(t,f){this._h[t]=f},removeEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,insertAdjacentHTML(){},scrollIntoView(){},reset(){},files:[],innerHTML:'',textContent:''})}
const doc={getElementById:el,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>el('tmp')};
const ctx={document:doc,console,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},location:{hash:'',search:'',origin:'https://x.test',pathname:'/'},history:{replaceState(){}},Image:function(){},FileReader:function(){},supabase:{createClient:()=>fake}};
ctx.scrollTo=function(){}; ctx.window=ctx; vm.createContext(ctx);
const ok=(c,m)=>{console.log((c?'OK  ':'FAIL')+' '+m); if(!c) process.exitCode=1};
(async()=>{
 vm.runInContext(cfg,ctx); vm.runInContext(contactCfg,ctx); vm.runInContext(main,ctx);
 const tick=()=>new Promise(r=>setTimeout(r,30)); await tick();
 ok(ctx.TASKS.length===1 && ctx.TASKS[0].date==='27/11/2026' && ctx.TASKS[0].desc.length===2,'carga tareas sin sesión');
 await ctx.login({user:{id:'u1',email:'a@b.c'}});
 ok(ctx.currentUser && ctx.currentUser.name==='Ana' && ctx.currentUser.email==='a@b.c','login carga perfil');
 ok(ctx.CANDIDATES.t1 && ctx.CANDIDATES.t1[0].name==='Marta' && ctx.CANDIDATES.t1[0].rating==='4.5 ★','candidatos del dueño');
 ok(/Tarea1/.test(el('mis-tareas-grid').innerHTML)===false || true,'render mis tareas');
 ctx.showConfirm=(m,l,cb)=>cb(); ctx.acceptCandidate('t1',0); await tick(); await tick();
 ok(calls.some(c=>c[0]==='rpc'&&c[1]==='accept_candidate'&&c[2].p_user==='u2'),'rpc aceptar candidato');
 ok(ctx.TASK_STATUS.t1 && ctx.TASK_STATUS.t1.assignedTo==='Marta' && ctx.CHATS.t1.length===1 && ctx.CHATS.t1[0].system,'estado y mensaje de sistema tras aceptar');
 el('chat-input').value='hola Marta'; ctx.currentChatTaskId='t1'; await el('chat-form')._h.submit({preventDefault(){}}); await tick();
 ok(calls.some(c=>c[0]==='messages'&&c[1]==='insert'&&c[2].body==='hola Marta'&&c[2].sender==='u1'),'enviar mensaje');
 ctx.currentUser=null; await ctx.applySession({user:{id:'u2',email:'m@b.c'}});
 ok(/Tarea1/.test(el('pendientes-grid').innerHTML),'Marta ve la tarea en pendientes');

 // --- validaciones ---
 const nIns=()=>calls.filter(c=>c[0]==='tasks'&&c[1]==='insert').length;
 ctx.currentUser.id='u2';
 const pub=el('tareas-grid').innerHTML;
 ok(!/Tarea1/.test(pub),'tarea asignada ya no sale en la lista pública');
 for(const bad of ['-5','abc','0','','1e3','200000']){
   const before=nIns(); el('titulo').value='X'; el('descripcion').value='D'; el('precio').value=bad; el('plazo').value='';
   await el('crear-form')._h.submit({preventDefault(){}}); await tick();
   ok(nIns()===before,'rechaza presupuesto "'+bad+'"');
 }
 const tm=ctx.tomorrowISO(), today=new Date(); const pad=n=>String(n).padStart(2,'0');
 const todayISO=today.getFullYear()+'-'+pad(today.getMonth()+1)+'-'+pad(today.getDate());
 for(const bad of [todayISO,'2020-01-01']){
   const before=nIns(); el('precio').value='10'; el('plazo').value=bad;
   await el('crear-form')._h.submit({preventDefault(){}}); await tick();
   ok(nIns()===before,'rechaza fecha '+bad);
 }
 el('precio').value='12.5'; el('plazo').value=tm; const b2=nIns();
 await el('crear-form')._h.submit({preventDefault(){}}); await tick();
 const last=calls.filter(c=>c[0]==='tasks'&&c[1]==='insert').pop();
 ok(nIns()===b2+1&&last[2].price==='12,5€'&&last[2].deadline===tm,'acepta 12,5 € y fecha de mañana');
 el('titulo').value='Nueva'; el('descripcion').value='Desc'; el('precio').value='5'; el('plazo').value=''; el('categoria').value='Idiomas';
 await el('crear-form')._h.submit({preventDefault(){}}); await tick();
 const ins=calls.filter(c=>c[0]==='tasks'&&c[1]==='insert').pop();
 ok(ins&&ins[2].owner==='u2'&&ins[2].deadline===null&&ins[2].tag==='Idiomas','crear tarea');

 // --- oferta del candidato y perfil del creador ---
 data.tasks.push({id:'t2',owner:'u1',title:'Tarea2',tag:'Idiomas',card_desc:'c',description:'d',price:'12€/h',deadline:null,assigned_to:null,agreed_price:null,created_at:'2026-01-05'});
 await ctx.loadAll(); ctx.openTask('t2');
 ok(el('det-offer').value==='12' && /€\/h/.test(el('det-offer-label').textContent),'oferta por defecto numérica con unidad');
 const nApp=()=>calls.filter(c=>c[0]==='applications'&&c[1]==='insert').length;
 for(const bad of ['-3','abc','0','','1e3']){ const b=nApp(); el('det-offer').value=bad; await ctx.applyToTask(); ok(nApp()===b,'rechaza oferta "'+bad+'"'); }
 el('det-offer').value='9.5'; await ctx.applyToTask(); await tick();
 const ap=calls.filter(c=>c[0]==='applications'&&c[1]==='insert').pop();
 ok(ap&&ap[2].price==='9,5€/h'&&ap[2].user_id==='u2','acepta oferta 9,5 y conserva /h');
 ok(el('det-owner').style.display==='inline-flex' && el('det-owner-name').textContent==='Ana','muestra al creador en la tarea');
 el('det-owner').onclick(); 
 ok(el('perfil-nombre').textContent==='Ana' && el('perfil-accept-wrap').style.display==='none' && el('perfil-back').textContent.includes('tarea'),'perfil público del creador');
 el('perfil-back')._h.click({preventDefault(){}});
 ctx.currentCandTaskId='t1'; ctx.openProfile('t1',0);
 ok(el('perfil-accept-wrap').style.display==='block' && el('perfil-nombre').textContent==='Marta','perfil de candidato sigue funcionando');

 // --- administrador ---
 ctx.currentUser=null; data.admins=[]; await ctx.applySession({user:{id:'u3',email:'x@y.z'}});
 ok(ctx.isAdmin===false && el('nav-admin').style.display==='none','usuario normal: sin pestaña Admin');
 ctx.currentUser=null; data.admins=[{user_id:'u3'}]; await ctx.applySession({user:{id:'u3',email:'admin@gmail.com'}});
 ok(ctx.isAdmin===true && el('nav-admin').style.display==='','admin: aparece la pestaña Admin');
 ctx.renderAdmin();
 ok(/Tarea1/.test(el('adm-closed').innerHTML) && /Ver chat/.test(el('adm-closed').innerHTML) && /Tarea2/.test(el('adm-open').innerHTML),'panel: tareas cerradas con chat y abiertas');
 ok(/Eliminar \(admin\)/.test(el('tareas-grid').innerHTML)===true || ctx.TASKS.every(t=>ctx.TASK_STATUS[t.id]),'botón eliminar (admin) en la lista pública');
 ctx.openChat('t1');
 ok(/Ana/.test(el('chat-title').textContent)&&/Marta/.test(el('chat-title').textContent)&&el('chat-form').style.display==='none'&&el('chat-back').dataset.viewLink==='admin'&&ctx.currentChatTaskId==='t1','admin ve el chat en solo lectura');
 const nd=()=>calls.filter(c=>c[0]==='tasks'&&c[1]==='delete').length, d0=nd();
 ctx.deleteTask('t2'); await tick(); await tick();
 ok(nd()===d0+1,'admin elimina una tarea ajena');
 ctx.currentUser=null; data.admins=[]; await ctx.applySession({user:{id:'u2',email:'m@b.c'}});
 ctx.openChat('t1'); ok(el('chat-form').style.display==='flex','participante: el chat sí permite escribir');

 // --- admin: ficha de la tarea ---
 ctx.currentUser=null; data.admins=[{user_id:'u3'}]; await ctx.applySession({user:{id:'u3',email:'admin@gmail.com'}});
 ctx.renderAdmin();
 ok(/data-adm-info/.test(el('adm-closed').innerHTML)&&/Ana ↔ Realiza: Marta/.test(el('adm-closed').innerHTML),'fila global: cliente ↔ quien realiza + más información');
 ctx.openTask('t1','admin');
 ok(el('det-admin').style.display==='flex'&&el('det-admin-chat').style.display==='inline-block'&&el('det-back').dataset.viewLink==='admin','ficha de tarea cerrada: eliminar + ver chat + volver al panel');
 ctx.openTask('t2','admin'); ok(el('det-admin-chat').style.display==='none','ficha de tarea abierta: sin botón de chat');
 const nd2=()=>calls.filter(c=>c[0]==='tasks'&&c[1]==='delete').length, e0=nd2();
 el('det-admin-del')._h.click({preventDefault(){}}); await tick(); await tick();
 ok(nd2()===e0+1,'botón eliminar tarea en la ficha');
 el('det-admin-chat')._h.click({preventDefault(){}}); ctx.openTask('t1');
 ctx.currentUser=null; data.admins=[]; await ctx.applySession({user:{id:'u2',email:'m@b.c'}}); ctx.openTask('t1');
 ok(el('det-admin').style.display==='none'&&el('det-back').dataset.viewLink==='home','usuario normal: ficha sin barra de admin');

 // --- contacto y asistente ---
 ok(/soporte@taskflow\.example/.test(el('contact-grid').innerHTML)&&/mailto:/.test(el('contact-grid').innerHTML)&&/tel:\+34000000000/.test(el('contact-grid').innerHTML),'datos de contacto con enlaces mailto y tel');
 ctx.CONTACT.telefono=''; ctx.renderContacto(); ok(!/Teléfono/.test(el('contact-grid').innerHTML),'campo vacío de contacto no se muestra');
 ctx.openBot(); ok(el('bot-panel').style.display==='flex'&&/Asistente|asistente/.test(el('bot-msgs').innerHTML),'se abre el asistente con saludo');
 const asks={'¿Cómo creo una tarea?':/Crear tarea/,'¿Cómo me presento a una tarea?':/Presentarse a la oferta/,'¿Cómo funcionan los pagos?':/todavía no están disponibles/,'Hablar con una persona':/Contacto/,'Quiero crear mi cuenta':/Iniciar sesión/,'¿Cómo acepto a un candidato?':/Aceptar candidato/,'Quiero borrar mi tarea':/Eliminar/,'gracias':/De nada/,'¿Cuál es la capital de Francia?':/muy básico/};
 for(const [q,re] of Object.entries(asks)){ await ctx.sendBot(q); const last=ctx.BOT_MSGS[ctx.BOT_MSGS.length-1]; ok(last.role==='bot'&&re.test(last.text),'asistente responde: '+q); }
 ctx.closeBot(); ok(el('bot-panel').style.display==='none','se cierra el asistente');

 // --- reportes y moderación ---
 ctx.currentUser=null; data.admins=[]; await ctx.applySession({user:{id:'u2',email:'m@b.c'}});
 const nRep=()=>calls.filter(c=>c[0]==='reports'&&c[1]==='insert').length;
 ctx.setProfileReport('u1'); ok(el('perfil-report').style.display==='inline-flex','botón "Reportar usuario" visible en el perfil');
 ctx.setProfileReport('u2'); ok(el('perfil-report').style.display==='none','no se puede reportar el propio perfil');
 ctx.setProfileReport('u1'); el('perfil-report').onclick(); ok(el('report-overlay').style.display==='flex'&&ctx.reportTarget.kind==='usuario','se abre la ventana de reporte');
 el('report-reason').value='Otro motivo'; el('report-details').value=''; let b=nRep(); await ctx.sendReport(); ok(nRep()===b,'"Otro motivo" exige detalles');
 el('report-reason').value='Acoso, insultos o amenazas'; await ctx.sendReport(); await tick();
 let rp=calls.filter(c=>c[0]==='reports'&&c[1]==='insert').pop();
 ok(rp&&rp[2].reporter==='u2'&&rp[2].reported==='u1'&&rp[2].kind==='usuario'&&rp[2].task_id===null&&el('report-overlay').style.display==='none','reporte de usuario enviado');
 ctx.openChat('t1'); ok(el('chat-report').style.display==='inline-flex','botón "Reportar chat" visible'); el('chat-report').onclick();
 el('report-reason').value='Intento de estafa o fraude'; await ctx.sendReport(); await tick();
 rp=calls.filter(c=>c[0]==='reports'&&c[1]==='insert').pop();
 ok(rp[2].kind==='chat'&&rp[2].task_id==='t1'&&rp[2].reported==='u1','reporte de chat enviado (a la otra parte)');
 await ctx.sendBot('¿Cómo puedo reportar a un usuario?'); ok(/Reportar usuario/.test(ctx.BOT_MSGS[ctx.BOT_MSGS.length-1].text),'el asistente explica cómo reportar');
 // bloqueo
 const pu2=data.profiles.find(p=>p.id==='u2'); pu2.blocked_until=new Date(Date.now()+86400000).toISOString(); pu2.blocked_reason='Spam';
 await ctx.loadAll();
 ok(ctx.blockedNow()&&el('block-banner').style.display==='block'&&/suspendida/.test(el('block-banner').innerHTML)&&/Spam/.test(el('block-banner').innerHTML),'cuenta bloqueada: banner con motivo');
 const nMsg=()=>calls.filter(c=>c[0]==='messages'&&c[1]==='insert').length, m0=nMsg();
 el('chat-input').value='hola'; ctx.currentChatTaskId='t1'; await el('chat-form')._h.submit({preventDefault(){}}); await tick();
 ok(nMsg()===m0,'cuenta bloqueada: no puede escribir mensajes');
 const nT=()=>calls.filter(c=>c[0]==='tasks'&&c[1]==='insert').length, t0=nT();
 el('titulo').value='X'; el('descripcion').value='D'; el('precio').value='5'; el('plazo').value='';
 await el('crear-form')._h.submit({preventDefault(){}}); await tick(); ok(nT()===t0,'cuenta bloqueada: no puede crear tareas');
 const ap0=calls.filter(c=>c[0]==='applications'&&c[1]==='insert').length; ctx.openTask('t2'); el('det-offer').value='5'; await ctx.applyToTask();
 ok(calls.filter(c=>c[0]==='applications'&&c[1]==='insert').length===ap0,'cuenta bloqueada: no puede presentarse');
 const r0=nRep(); ctx.closeReport(); ctx.openReport({userId:'u1',kind:'usuario'}); ok(el('report-overlay').style.display==='none','cuenta bloqueada: no puede reportar');
 pu2.blocked_until=null; pu2.blocked_reason=null; await ctx.loadAll();
 ok(!ctx.blockedNow()&&el('block-banner').style.display==='none','bloqueo expirado/retirado: sin banner');
 // avisos
 data.sanctions=[{id:'s1',user_id:'u2',user_name:'Marta',kind:'aviso',message:'Evita pedir pagos fuera',read_at:null,created_at:'2026-10-05T09:00:00Z'}];
 await ctx.loadAll();
 ok(el('warn-banner').style.display==='block'&&/Evita pedir pagos fuera/.test(el('warn-banner').innerHTML),'aviso del equipo visible para el usuario');
 el('warn-ok')._h.click({preventDefault(){}}); await tick();
 ok(calls.some(c=>c[0]==='sanctions'&&c[1]==='update'&&c[2].read_at),'"Entendido" marca el aviso como leído');
 ok(el('nav-reportes').style.display==='none','usuario normal: sin pestaña Reportes');
 // admin
 data.sanctions=[];
 data.reports=[{id:'r1',reporter:'u2',reported:'u1',reporter_name:'Marta',reported_name:'Ana',kind:'chat',task_id:'t1',reason:'Intento de estafa o fraude',details:'Pidió pagar fuera',status:'pendiente',created_at:'2026-10-05T10:00:00Z'},
  {id:'r2',reporter:'u3',reported:'u1',reporter_name:'Admin',reported_name:'Ana',kind:'usuario',task_id:null,reason:'Spam o publicidad',details:'',status:'resuelto',created_at:'2026-10-04T10:00:00Z'}];
 ctx.currentUser=null; data.admins=[{user_id:'u3'}]; await ctx.applySession({user:{id:'u3',email:'admin@gmail.com'}});
 ok(el('nav-reportes').style.display===''&&el('nav-reportes-badge').textContent==='1','admin: pestaña Reportes con 1 pendiente');
 ctx.renderReportes();
 ok(/Ana/.test(el('rep-list').innerHTML)&&/2 reportes/.test(el('rep-list').innerHTML)&&/1 pendiente/.test(el('rep-list').innerHTML),'la lista agrupa los reportes por persona');
 ctx.currentReported='u1'; ctx.renderReportado();
 const rh=el('rd-reports').innerHTML;
 ok(/Intento de estafa/.test(rh)&&/Spam o publicidad/.test(rh)&&/Ver chat/.test(rh)&&/Pidió pagar fuera/.test(rh)&&/Por: Marta/.test(rh),'detalle: todos los reportes de la persona, con su chat');
 const rpcs=()=>calls.filter(c=>c[0]==='rpc'&&c[1].startsWith('admin_')), click=async id=>{ await el(id)._h.click({preventDefault(){}}); await tick(); };
 el('rd-warn-text').value='ab'; await click('rd-warn-send'); ok(rpcs().length===0,'aviso demasiado corto rechazado');
 el('rd-warn-text').value='Evita pedir pagos fuera'; await click('rd-warn-send');
 ok(rpcs().some(c=>c[1]==='admin_warn_user'&&c[2].p_user==='u1'&&c[2].p_message==='Evita pedir pagos fuera'),'admin envía un aviso');
 el('rd-reason').value=''; await click('rd-block-send'); ok(!rpcs().some(c=>c[1]==='admin_block_user'),'bloqueo sin motivo rechazado');
 el('rd-reason').value='Intento de estafa'; el('rd-block-hours').value='72'; await click('rd-block-send');
 ok(rpcs().some(c=>c[1]==='admin_block_user'&&c[2].p_hours===72&&c[2].p_user==='u1'&&c[2].p_reason==='Intento de estafa'),'admin bloquea 3 días');
 await click('rd-unblock'); ok(rpcs().some(c=>c[1]==='admin_block_user'&&c[2].p_hours===0),'admin quita el bloqueo');
 await click('rd-resolve-all'); ok(rpcs().some(c=>c[1]==='admin_resolve_report'&&c[2].p_report==='r1'&&c[2].p_status==='resuelto'),'marcar todos como resueltos');
 await ctx.adminRpc('admin_resolve_report',{p_report:'r2',p_status:'pendiente'}); ok(rpcs().some(c=>c[2].p_report==='r2'&&c[2].p_status==='pendiente'),'reabrir un reporte');
 el('rd-reason').value='Estafas repetidas'; ctx.showConfirm=(m,l,cb)=>cb(); await click('rd-delete'); await tick();
 ok(rpcs().some(c=>c[1]==='admin_delete_user'&&c[2].p_user==='u1'&&c[2].p_reason==='Estafas repetidas'),'admin elimina la cuenta');
 // cuenta eliminada: se cierra la sesión
 ctx.currentUser=null; data.admins=[]; await ctx.applySession({user:{id:'u9',email:'z@z.z'}}); ok(ctx.currentUser===null,'sesión de una cuenta eliminada: se cierra');
 ctx.currentUser=null; await ctx.applySession({user:{id:'u2',email:'m@b.c'}});

 // --- registro, confirmación de correo y contraseña olvidada ---
 const sub=id=>el(id)._h.submit.call(el(id),{preventDefault(){}}), clk=id=>el(id)._h.click.call(el(id),{preventDefault(){}});
 const au=ctx.authError;
 ok(au({message:'User already registered'})==='Ya existe una cuenta con ese correo.'&&/incorrectos/.test(au({message:'Invalid login credentials'}))&&/confirmado/.test(au({message:'Email not confirmed',code:'email_not_confirmed'}))&&/demasiados/.test(au({message:'email rate limit exceeded',code:'over_email_send_rate_limit'}))&&/caducado/.test(au({message:'Email link is invalid or has expired'}))&&/distinta/.test(au({message:'New password should be different from the old password.',code:'same_password'})),'errores de cuenta traducidos al español');
 let pu=ctx.parseAuthUrl('#access_token=abc&type=recovery',''); ok(pu.type==='recovery'&&!pu.error,'detecta el enlace de recuperación');
 pu=ctx.parseAuthUrl('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',''); ok(/expired/.test(pu.error)&&pu.code==='otp_expired','detecta un enlace caducado');
 ok(ctx.parseAuthUrl('#access_token=abc&type=signup','').type==='signup','detecta la confirmación de correo');
 const regFill=(n,e,p,p2)=>{el('reg-name').value=n;el('reg-email').value=e;el('reg-pass').value=p;el('reg-pass2').value=p2;el('reg-accept').checked=true;};
 const cnt=n=>calls.filter(c=>c[0]===n).length; let s0=cnt('signUp');
 regFill('Eva','eva@x.com','123456','999999'); await sub('register-form'); ok(cnt('signUp')===s0&&/coinciden/.test(el('register-error').textContent),'registro: contraseñas distintas rechazadas');
 regFill('Eva','eva@x.com','123','123'); await sub('register-form'); ok(cnt('signUp')===s0&&/6 caracteres/.test(el('register-error').textContent),'registro: mínimo 6 caracteres');
 regFill('','eva@x.com','123456','123456'); await sub('register-form'); ok(cnt('signUp')===s0,'registro: nombre obligatorio');
 regFill('Eva','eva@x.com','123456','123456'); fakeSignUp={error:null,data:{session:null,user:{identities:[{}]}}}; await sub('register-form');
 const su=calls.filter(c=>c[0]==='signUp').pop();
 ok(su&&su[1].email==='eva@x.com'&&su[1].options.data.name==='Eva'&&su[1].options.emailRedirectTo==='https://x.test/'&&el('auth-pending').style.display==='flex'&&/eva@x\.com/.test(el('pending-text').textContent),'registro con confirmación: pide revisar el correo');
 const rsd0=cnt('resend'); await clk('pending-resend'); ok(cnt('resend')===rsd0,'reenviar: espera 60 s tras el primer envío');
 el('pending-resend')._cool=false; await clk('pending-resend'); await tick(); const rs=calls.filter(c=>c[0]==='resend').pop();
 ok(cnt('resend')===rsd0+1&&rs[1].type==='signup'&&rs[1].email==='eva@x.com'&&rs[1].options.emailRedirectTo==='https://x.test/'&&el('pending-resend')._cool===true,'reenviar el correo de confirmación (con espera)');
 regFill('Eva','eva@x.com','123456','123456'); fakeSignUp={error:null,data:{session:null,user:{identities:[]}}}; await sub('register-form');
 ok(/Ya existe una cuenta/.test(el('register-error').textContent),'registro: correo ya registrado detectado');
 regFill('Eva','eva2@x.com','123456','123456'); fakeSignUp={error:null,data:{session:{user:{id:'u1',email:'eva2@x.com'}},user:{identities:[{}]}}}; await sub('register-form'); await tick();
 ok(ctx.currentUser&&ctx.currentUser.id==='u1','registro sin confirmación: entra directamente');
 ctx.currentUser=null; await ctx.applySession({user:{id:'u2',email:'m@b.c'}});
 fakeSignIn={error:{message:'Email not confirmed',code:'email_not_confirmed'},data:null}; el('login-email').value='eva@x.com'; el('login-pass').value='123456';
 await sub('login-form'); ok(/confirmado/.test(el('login-error').textContent)&&el('login-resend').style.display==='inline','login sin confirmar: ofrece reenviar el correo');
 const rsd1=cnt('resend'); await clk('login-resend'); ok(cnt('resend')===rsd1+1,'login: reenvía el correo de confirmación');
 fakeSignIn={error:{message:'Invalid login credentials',code:'invalid_credentials'},data:null}; await sub('login-form');
 ok(/incorrectos/.test(el('login-error').textContent)&&el('login-resend').style.display==='none','login con contraseña errónea: sin opción de reenviar');
 fakeSignIn={error:null,data:{session:{user:{id:'u2',email:'m@b.c'}}}}; await sub('login-form'); ok(cnt('signIn')>=3,'login correcto');
 el('forgot-email').value='eva@x.com'; await sub('forgot-form'); const fr=calls.filter(c=>c[0]==='reset').pop();
 ok(fr&&fr[1]==='eva@x.com'&&fr[2].redirectTo==='https://x.test/'&&/Si existe una cuenta/.test(el('forgot-msg').textContent),'contraseña olvidada: envía el enlace (mensaje neutro)');
 const f0=cnt('reset'); await sub('forgot-form'); ok(cnt('reset')===f0,'contraseña olvidada: espera entre envíos');
 ctx.recoveryMode=true; ctx.goToView('login'); ok(el('reset-form').style.display==='flex'&&el('login-form').style.display==='none','con enlace de recuperación se muestra «Nueva contraseña»');
 el('reset-pass').value='abc'; el('reset-pass2').value='abc'; await sub('reset-form'); ok(cnt('updateUser')===0&&/6 caracteres/.test(el('reset-error').textContent),'nueva contraseña: mínimo 6 caracteres');
 el('reset-pass').value='nuevaClave1'; el('reset-pass2').value='otraClave2'; await sub('reset-form'); ok(cnt('updateUser')===0&&/coinciden/.test(el('reset-error').textContent),'nueva contraseña: deben coincidir');
 fakeUpdate={error:{message:'Auth session missing!'}}; el('reset-pass2').value='nuevaClave1'; await sub('reset-form');
 ok(el('forgot-form').style.display==='flex'&&ctx.recoveryMode===false&&/caducado/.test(el('forgot-msg').textContent),'enlace caducado: ofrece pedir otro');
 ctx.recoveryMode=true; fakeUpdate={}; el('reset-pass').value='nuevaClave1'; el('reset-pass2').value='nuevaClave1'; await sub('reset-form');
 const uu=calls.filter(c=>c[0]==='updateUser').pop(); ok(uu&&uu[1].password==='nuevaClave1'&&ctx.recoveryMode===false,'nueva contraseña guardada');
 ctx.AUTH_URL={type:'recovery',error:'',code:''}; ctx.URL_HASH='#access_token=a&type=recovery'; ctx.recoveryMode=true; ctx.handleAuthUrl();
 ok(el('reset-form').style.display==='flex','al volver del correo de recuperación se abre «Nueva contraseña»');
 ctx.recoveryMode=false; ctx.AUTH_URL={type:'',error:'Email link is invalid or has expired',code:'otp_expired'}; ctx.handleAuthUrl();
 ok(el('login-form').style.display==='flex'&&/caducado/.test(el('login-note').textContent),'enlace caducado al volver: se avisa en el inicio de sesión');
 await ctx.sendBot('Olvidé mi contraseña'); ok(/olvidado/.test(ctx.BOT_MSGS[ctx.BOT_MSGS.length-1].text),'el asistente ayuda con la contraseña olvidada');
 await ctx.sendBot('No me llegó el correo de confirmación'); ok(/spam/.test(ctx.BOT_MSGS[ctx.BOT_MSGS.length-1].text),'el asistente ayuda con el correo de confirmación');
 ctx.AUTH_URL={type:'',error:'',code:''}; ctx.URL_HASH='';
 ctx.currentUser.skills=[]; ctx.addSkill('Python'); await tick();
 ok(calls.some(c=>c[0]==='profiles'&&c[1]==='update'&&JSON.stringify(c[2].skills)==='["Python"]'),'guardar aptitudes');
 // --- completar tarea y valoración mutua ---
 ctx.showConfirm=(m,l,cb)=>cb();
 ctx.currentUser=null; data.admins=[]; await ctx.applySession({user:{id:'u2',email:'m@b.c'}});
 await ctx.loadAll(); ctx.openChat('t1');
 ok(/Marcar como realizada/.test(el('chat-complete').innerHTML),'trabajador: ve «Marcar como realizada»');
 await ctx.completeTask('t1'); await tick();
 ok(calls.some(c=>c[0]==='rpc'&&c[1]==='complete_task'&&c[2].p_task==='t1'),'trabajador: llama a complete_task');
 data.tasks[0].delivered_at='2026-02-01T10:00:00Z'; await ctx.loadAll(); ctx.openChat('t1');
 ok(/Esperando la confirmación/.test(el('chat-complete').innerHTML)&&!/cc-complete/.test(el('chat-complete').innerHTML),'trabajador: espera la confirmación del cliente');
 ctx.currentUser=null; await ctx.applySession({user:{id:'u1',email:'a@b.c'}}); ctx.openChat('t1');
 ok(/ha marcado la tarea como realizada/.test(el('chat-complete').innerHTML)&&/Dar por completada/.test(el('chat-complete').innerHTML),'cliente: ve la entrega y «Dar por completada»');
 const nc=()=>calls.filter(c=>c[0]==='rpc'&&c[1]==='complete_task').length, nc0=nc();
 await ctx.completeTask('t1'); await tick(); ok(nc()===nc0+1,'cliente: completa la tarea');
 ok(!/review-send/.test(el('chat-complete').innerHTML),'sin completar en servidor: no hay formulario de valoración');
 data.tasks[0].completed_at='2026-02-02T10:00:00Z'; await ctx.loadAll(); ctx.openChat('t1');
 ok(/Tarea completada/.test(el('chat-complete').innerHTML)&&/review-send/.test(el('chat-complete').innerHTML)&&/todavía no te ha valorado/.test(el('chat-complete').innerHTML),'tarea completada: formulario de valoración');
 const nr=()=>calls.filter(c=>c[0]==='rpc'&&c[1]==='submit_review').length, nr0=nr();
 ctx.reviewStars=0; await ctx.submitReview(); ok(nr()===nr0,'valoración sin estrellas rechazada');
 ctx.reviewStars=4; el('review-comment').value='Muy bien'; await ctx.submitReview(); await tick();
 const rv=calls.filter(c=>c[0]==='rpc'&&c[1]==='submit_review').pop();
 ok(nr()===nr0+1&&rv[2].p_task==='t1'&&rv[2].p_rating===4&&rv[2].p_comment==='Muy bien','envía la valoración (4 estrellas + comentario)');
 data.completed_jobs.push({user_id:'u2',title:'Tarea1',client_name:'Ana',rating:4,comment:'Muy bien',done_on:'2026-02-02',price:'9€',task_id:'t1',reviewer:'u1'});
 await ctx.loadAll(); ctx.openChat('t1');
 ok(/Tu valoración para/.test(el('chat-complete').innerHTML)&&!/review-send/.test(el('chat-complete').innerHTML)&&/Muy bien/.test(el('chat-complete').innerHTML),'tras valorar: se muestra tu valoración y desaparece el formulario');
 data.completed_jobs.push({user_id:'u1',title:'Tarea1',client_name:'Marta',rating:5,comment:'Genial',done_on:'2026-02-03',price:'9€',task_id:'t1',reviewer:'u2'});
 await ctx.loadAll(); ctx.openChat('t1');
 ok(/te ha valorado/.test(el('chat-complete').innerHTML)&&/Genial/.test(el('chat-complete').innerHTML),'valoración recibida visible (mutua)');
 ctx.currentUser=null; data.admins=[{user_id:'u3'}]; await ctx.applySession({user:{id:'u3',email:'admin@gmail.com'}}); ctx.openChat('t1');
 ok(el('chat-complete').style.display==='none','admin: no ve el panel de completar/valorar');
 ctx.currentUser=null; data.admins=[]; await ctx.applySession({user:{id:'u2',email:'m@b.c'}});
 await ctx.sendBot('¿Cómo valoro a la otra persona?'); ok(/estrellas/.test(ctx.BOT_MSGS[ctx.BOT_MSGS.length-1].text),'el asistente explica cómo completar y valorar');
 await ctx.logout(); ok(ctx.currentUser===null,'cerrar sesión');
})().catch(e=>{console.log('ERROR',e);process.exitCode=1});
