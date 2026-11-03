var TASKS = [];

var PAGE_SIZE = 15;
var currentPage = 1;
var taskCounter = 1;
var editingId = null;
var editingUnit = '';
var skipResetOnce = false;

var CATEGORIES = [
  'Producción musical', 'Educación', 'Desarrollo web', 'Diseño gráfico',
  'Traducción', 'Fotografía', 'Tareas del hogar', 'Cuidado de mascotas',
  'Edición de vídeo', 'Redes sociales', 'Idiomas', 'Tecnología'
];

function populateCategorySelects(){
  var filterSel = document.getElementById('filter-categoria');
  CATEGORIES.forEach(function(c){
    filterSel.insertAdjacentHTML('beforeend', '<option value="' + c + '">' + c + '</option>');
  });
  document.getElementById('categoria').innerHTML = CATEGORIES.map(function(c){ return '<option>' + c + '</option>'; }).join('');
}

var PROFILES = {};
var currentUser = null, pendingView = null, currentChatTaskId = null, currentDetailTaskId = null;
var CHATS = {};
var PROTECTED = ['crear','mistareas','miperfil','candidatos','chat','admin','reportes','reportado'];
function getAccount(id){ return PROFILES[id]; }
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var CANDIDATES = {};
var TASK_STATUS = {};
var currentCandTaskId = null;
var profileBack = null;
var isAdmin = false;
var REPORTS = [], SANCTIONS = [];
var detUnit = '';
var REVIEWS = {}, reviewStars = 0;

function cardHTML(t){
  return '' +
    '<div class="card">' +
      '<span class="tag">' + t.tag + '</span>' +
      '<h3>' + t.title + '</h3>' +
      '<p>' + t.cardDesc + '</p>' +
      '<a class="more" data-task="' + t.id + '">Más información…</a>' +
      '<div class="card-foot">' +
        '<span class="price">' + t.price + '</span>' +
        '<span class="deadline">Se cierra el<b>' + t.date + '</b></span>' +
      '</div>' +
      (isAdmin ? '<a class="admin-del" data-admin-del="' + t.id + '">Eliminar (admin)</a>' : '') +
    '</div>';
}

function misCardHTML(t){
  var n = (CANDIDATES[t.id] || []).length;
  var st = TASK_STATUS[t.id];
  var statusTag = (st && st.completedAt)
    ? '<span class="tag" style="background:rgba(47,208,232,0.2);color:var(--navy);">✓ Completada</span>' + reviewPendingTag(t.id)
    : (st && st.status === 'asignada')
    ? '<span class="tag" style="background:rgba(47,208,232,0.2);color:var(--navy);">Asignada a ' + st.assignedTo + '</span>'
    : '<span class="tag" style="background:rgba(27,86,168,0.08);">Abierta</span>';
  return '' +
    '<div class="card">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<span class="tag">' + t.tag + '</span>' + statusTag +
      '</div>' +
      '<h3>' + t.title + '</h3>' +
      '<p>' + t.cardDesc + '</p>' +
      '<div class="card-foot">' +
        '<span class="price">' + t.price + '</span>' +
        '<span class="deadline">Se cierra el<b>' + t.date + '</b></span>' +
      '</div>' +
      '<div class="mis-actions">' +
        '<a data-cand="' + t.id + '">Ver candidatos' + (n ? ' (' + n + ')' : '') + '</a>' +
        (st && st.status === 'asignada' ? '<a data-chat="' + t.id + '">Abrir chat</a>' : '') +
        (st && st.completedAt ? '' : '<a data-edit="' + t.id + '">Editar</a>') +
        '<a data-del="' + t.id + '" class="danger">Eliminar</a>' +
      '</div>' +
    '</div>';
}

function starsText(n){ n = Math.max(0, Math.min(5, Math.round(Number(n) || 0))); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
function reviewOf(taskId, reviewerId){ return (REVIEWS[taskId] || []).find(function(r){ return r.reviewer === reviewerId; }); }
function reviewPendingTag(taskId){
  var st = TASK_STATUS[taskId];
  if(!currentUser || !st || !st.completedAt || reviewOf(taskId, currentUser.id)) return '';
  return '<span class="tag" style="background:#ffe3d6;color:#a2431a;">Falta tu valoración</span>';
}

function parsePrice(str){
  var m = /(\d+(?:[.,]\d+)?)/.exec(str || '');
  if(!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

function renderTasks(){
  var q = (document.getElementById('search-input').value || '').trim().toLowerCase();
  var cat = document.getElementById('filter-categoria').value;
  var order = document.getElementById('filter-orden').value;

  var matches = TASKS.filter(function(t){
    if(TASK_STATUS[t.id]) return false;
    var matchesQ = !q || (t.title + ' ' + t.tag + ' ' + t.cardDesc).toLowerCase().indexOf(q) !== -1;
    var matchesCat = !cat || t.tag === cat;
    return matchesQ && matchesCat;
  });

  if(order === 'precio-asc' || order === 'precio-desc'){
    matches = matches.slice().sort(function(a, b){
      var pa = parsePrice(a.price), pb = parsePrice(b.price);
      if(pa === null && pb === null) return 0;
      if(pa === null) return 1;
      if(pb === null) return -1;
      return order === 'precio-asc' ? pa - pb : pb - pa;
    });
  }

  var totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  var start = (currentPage - 1) * PAGE_SIZE;
  var toShow = matches.slice(start, start + PAGE_SIZE);

  var grid = document.getElementById('tareas-grid');
  grid.innerHTML = toShow.map(cardHTML).join('');
  grid.querySelectorAll('[data-admin-del]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); deleteTask(el.dataset.adminDel); });
  });
  grid.querySelectorAll('[data-task]').forEach(function(el){
    el.addEventListener('click', function(e){
      e.preventDefault();
      openTask(el.dataset.task);
    });
  });

  document.getElementById('no-results').style.display = (matches.length === 0) ? 'block' : 'none';
  document.getElementById('results-count').textContent = matches.length + (matches.length === 1 ? ' resultado' : ' resultados');

  document.getElementById('pag-info').textContent = 'Página ' + currentPage + ' de ' + totalPages;
  document.getElementById('pag-prev').classList.toggle('disabled', currentPage <= 1);
  document.getElementById('pag-next').classList.toggle('disabled', currentPage >= totalPages);
  document.getElementById('pagination').style.display = totalPages <= 1 ? 'none' : 'flex';
}

document.getElementById('pag-prev').addEventListener('click', function(e){
  e.preventDefault();
  if(currentPage > 1){ currentPage--; renderTasks(); document.getElementById('tareas').scrollIntoView({block:'start'}); }
});
document.getElementById('pag-next').addEventListener('click', function(e){
  e.preventDefault();
  currentPage++; renderTasks(); document.getElementById('tareas').scrollIntoView({block:'start'});
});
document.getElementById('filter-categoria').addEventListener('change', function(){
  currentPage = 1; renderTasks();
});
document.getElementById('filter-orden').addEventListener('change', function(){
  currentPage = 1; renderTasks();
});
document.getElementById('search-input').addEventListener('input', function(){
  goToView('home');
  currentPage = 1;
  renderTasks();
});

function openTask(id, from){
  var t = TASKS.find(function(x){ return x.id === id; });
  if(!t) return;
  document.getElementById('det-title').textContent = t.title;
  document.getElementById('det-tag').textContent = t.tag;
  document.getElementById('det-desc').innerHTML = t.desc.map(function(p){return '<p>'+p+'</p>';}).join('');
  var ownerAcc = getAccount(t.owner);
  currentDetailTaskId = id;
  document.getElementById('det-due').textContent = 'El plazo se cierra el ' + t.date;
  var oc = document.getElementById('det-owner');
  if(ownerAcc){
    setAvatar(document.getElementById('det-owner-avatar'), ownerAcc);
    document.getElementById('det-owner-name').textContent = ownerAcc.name;
    document.getElementById('det-owner-meta').textContent = ratingOf(ownerAcc) + ' · Ver perfil';
    oc.style.display = 'inline-flex';
    oc.onclick = function(e){ if(e) e.preventDefault(); openUserProfile(t.owner); };
  } else { oc.style.display = 'none'; }
  document.getElementById('det-price').textContent = t.price;
  var pn2 = parsePrice(t.price);
  var um2 = /€(\/.*)$/.exec(t.price);
  detUnit = um2 ? um2[1] : '';
  document.getElementById('det-offer').value = pn2 === null ? '' : String(pn2);
  document.getElementById('det-offer-label').textContent = 'Haz una oferta (€' + detUnit + ')';
  document.getElementById('det-msg').value = '';
  document.getElementById('det-apply-note').style.display = 'none';
  document.getElementById('det-admin').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('det-admin-chat').style.display = (isAdmin && TASK_STATUS[id]) ? 'inline-block' : 'none';
  var back = document.getElementById('det-back');
  back.dataset.viewLink = from === 'admin' ? 'admin' : 'home';
  back.textContent = from === 'admin' ? '← Volver a tareas globales' : '← Volver a tareas';
  goToView('detalle');
}

async function applyToTask(){
  var note = document.getElementById('det-apply-note');
  function say(m, err){ note.textContent = m; note.style.color = err ? '#c23b3b' : 'var(--blue)'; note.style.display = 'block'; }
  var t = TASKS.find(function(x){ return x.id === currentDetailTaskId; });
  if(!t) return;
  if(!currentUser){ pendingView = 'detalle'; goToView('login'); return; }
  if(needSb() || guardBlocked()) return;
  if(t.owner === currentUser.id) return say('Esta tarea es tuya, no puedes presentarte a ella.');
  if(TASK_STATUS[t.id]) return say('Esta tarea ya tiene un candidato aceptado.');
  if((CANDIDATES[t.id] || []).some(function(c){ return c.userId === currentUser.id; })) return say('Ya te has presentado a esta oferta.');
  var rawOffer = document.getElementById('det-offer').value.trim();
  var on = Number(rawOffer);
  if(!/^\d+(\.\d{1,2})?$/.test(rawOffer) || !(on > 0) || on > 100000) return say('La oferta debe ser un número positivo (por ejemplo 50 o 12,50), sin letras ni signos.', true);
  var price = String(Math.round(on * 100) / 100).replace('.', ',') + '€' + detUnit;
  var msg = document.getElementById('det-msg').value.trim() || 'Me interesa esta tarea, puedo empezar cuanto antes.';
  var r = await sb.from('applications').insert({ task_id: t.id, user_id: currentUser.id, price: price, message: msg });
  if(r.error) return fail(r.error);
  say('Candidatura enviada. El cliente la verá en "Ver candidatos".');
  loadAll();
}

function goToView(name){
  if(PROTECTED.indexOf(name) !== -1 && !currentUser){ pendingView = name; name = 'login'; }
  else if(name !== 'login'){ pendingView = null; }
  if((name === 'admin' || name === 'reportes' || name === 'reportado') && !isAdmin){ name = 'home'; }
  if(name === 'login'){ showLoginNote(); }
  if(name === 'miperfil'){ renderMiPerfil(); }
  if(name === 'crear'){ refreshDateMin(); }
  if(name === 'admin'){ renderAdmin(); }
  if(name === 'reportes'){ renderReportes(); }
  if(name === 'reportado'){ renderReportado(); }
  document.querySelectorAll('.view').forEach(function(v){
    v.classList.toggle('active', v.id === 'view-' + name);
  });
  document.querySelectorAll('.navlinks a[data-view]').forEach(function(a){
    a.classList.toggle('active', a.dataset.view === name);
  });
  if(name === 'crear' && !skipResetOnce){
    resetCrearForm();
  }
  skipResetOnce = false;
  window.scrollTo({top:0, behavior:'instant'});
}
document.querySelectorAll('[data-view]').forEach(function(el){
  el.addEventListener('click', function(e){
    e.preventDefault();
    goToView(el.dataset.view);
  });
});
document.querySelectorAll('[data-view-link]').forEach(function(el){
  el.addEventListener('click', function(e){
    e.preventDefault();
    goToView(el.dataset.viewLink);
  });
});

function renderMisTareas(){
  var grid = document.getElementById('mis-tareas-grid');
  grid.querySelectorAll('.card').forEach(function(c){ c.remove(); });
  var own = currentUser ? TASKS.filter(function(t){ return t.owner === currentUser.id; }) : [];
  own.forEach(function(t){ grid.insertAdjacentHTML('beforeend', misCardHTML(t)); });
  grid.querySelectorAll('[data-cand]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); openCandidates(el.dataset.cand); });
  });
  grid.querySelectorAll('[data-edit]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); editTask(el.dataset.edit); });
  });
  grid.querySelectorAll('[data-del]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); deleteTask(el.dataset.del); });
  });
  grid.querySelectorAll('[data-chat]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); openChat(el.dataset.chat); });
  });
}

function showConfirm(message, okLabel, onConfirm){
  var overlay = document.getElementById('confirm-overlay');
  var okBtn = document.getElementById('confirm-ok');
  var cancelBtn = document.getElementById('confirm-cancel');
  document.getElementById('confirm-message').textContent = message;
  okBtn.textContent = okLabel || 'Confirmar';
  overlay.style.display = 'flex';

  function cleanup(){
    overlay.style.display = 'none';
    okBtn.removeEventListener('click', onOk);
    cancelBtn.removeEventListener('click', onCancel);
  }
  function onOk(e){ e.preventDefault(); cleanup(); onConfirm(); }
  function onCancel(e){ e.preventDefault(); cleanup(); }
  okBtn.addEventListener('click', onOk);
  cancelBtn.addEventListener('click', onCancel);
}

function deleteTask(id){
  var t = TASKS.find(function(x){ return x.id === id; });
  if(!t || needSb()) return;
  showConfirm('¿Seguro que quieres eliminar "' + t.title + '"? Esta acción no se puede deshacer.', 'Eliminar', async function(){
    var r = await sb.from('tasks').delete().eq('id', id).select();
    if(r.error) return fail(r.error);
    if(!r.data || !r.data.length) return fail({ message: 'No tienes permiso para eliminar esta tarea.' });
    await loadAll();
    if(currentDetailTaskId === id){
      currentDetailTaskId = null;
      if(document.getElementById('view-detalle').classList.contains('active')) goToView(document.getElementById('det-back').dataset.viewLink || 'home');
    }
  });
}

function pad2(n){ n = '' + n; return n.length < 2 ? '0' + n : n; }

function resetCrearForm(){
  editingId = null;
  editingUnit = '';
  document.getElementById('crear-form').reset();
  document.getElementById('crear-msg').style.display = 'none';
  document.getElementById('crear-heading').textContent = 'Crear una tarea';
  document.getElementById('crear-sub').textContent = 'Describe lo que necesitas. Cuanto más claro seas, mejores propuestas recibirás.';
  document.getElementById('crear-submit-btn').textContent = 'Publicar tarea';
}

function editTask(id){
  var t = TASKS.find(function(x){ return x.id === id; });
  if(!t) return;
  editingId = id;
  document.getElementById('titulo').value = t.title;
  document.getElementById('categoria').value = t.tag;
  document.getElementById('descripcion').value = t.desc.join('\n\n');
  var pn = parsePrice(t.price);
  document.getElementById('precio').value = pn === null ? '' : String(pn);
  var um = /€(\/.*)$/.exec(t.price);
  editingUnit = um ? um[1] : '';
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t.date);
  document.getElementById('plazo').value = m ? (m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1])) : '';
  document.getElementById('crear-heading').textContent = 'Editar tarea';
  document.getElementById('crear-sub').textContent = 'Modifica los datos y guarda los cambios.';
  document.getElementById('crear-submit-btn').textContent = 'Guardar cambios';
  document.getElementById('crear-msg').style.display = 'none';
  skipResetOnce = true;
  goToView('crear');
}

function initials(name){
  return name.split(' ').map(function(w){ return w[0] || ''; }).slice(0, 2).join('').toUpperCase();
}

function candCardHTML(c, idx, status){
  var isAssignedToThis = status && status.status === 'asignada' && status.assignedTo === c.name;
  var isAssignedToOther = status && status.status === 'asignada' && status.assignedTo !== c.name;
  var footHtml;
  if(isAssignedToThis){
    footHtml = '<span class="assigned-note">✓ Candidato aceptado</span><a class="btn btn-primary btn-small" data-chat="1">Abrir chat</a>';
  } else if(isAssignedToOther){
    footHtml = '<span class="muted-note">No seleccionado para esta tarea</span>';
  } else {
    footHtml = '<a class="btn btn-primary btn-small" data-accept="' + idx + '">Aceptar candidato</a>';
  }
  return '' +
    '<div class="cand-card">' +
      '<div class="cand-head">' +
        '<span class="cand-name">' + c.name + '</span>' +
        '<span class="cand-meta">' + (c.userId && getAccount(c.userId) ? ratingOf(getAccount(c.userId)) : c.rating) + '</span>' +
        '<span class="cand-price">' + c.price + '</span>' +
      '</div>' +
      '<p>' + c.message + '</p>' +
      '<div class="cand-foot">' +
        '<a class="btn btn-outline btn-small" data-profile="' + idx + '">Ver perfil</a>' +
        footHtml +
      '</div>' +
    '</div>';
}

function openCandidates(id){
  var t = TASKS.find(function(x){ return x.id === id; });
  if(!t) return;
  currentCandTaskId = id;
  document.getElementById('cand-title').textContent = 'Candidatos — ' + t.title;
  var list = CANDIDATES[id] || [];
  var status = TASK_STATUS[id];
  var listEl = document.getElementById('cand-list');
  listEl.innerHTML = list.map(function(c, idx){ return candCardHTML(c, idx, status); }).join('');
  listEl.querySelectorAll('[data-accept]').forEach(function(el){
    el.addEventListener('click', function(e){
      e.preventDefault();
      acceptCandidate(id, Number(el.dataset.accept));
    });
  });
  listEl.querySelectorAll('[data-profile]').forEach(function(el){
    el.addEventListener('click', function(e){
      e.preventDefault();
      openProfile(id, Number(el.dataset.profile));
    });
  });
  listEl.querySelectorAll('[data-chat]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); openChat(id); });
  });
  document.getElementById('cand-empty').style.display = list.length ? 'none' : 'block';
  goToView('candidatos');
}

function acceptCandidate(taskId, idx, afterFn){
  var c = (CANDIDATES[taskId] || [])[idx];
  if(!c || needSb() || guardBlocked()) return;
  showConfirm('¿Aceptar a ' + c.name + ' para esta tarea? Se avisará al resto de candidatos de que no han sido seleccionados.', 'Aceptar', async function(){
    var r = await sb.rpc('accept_candidate', { p_task: taskId, p_user: c.userId });
    if(r.error) return fail(r.error);
    await loadAll();
    openCandidates(taskId);
    if(afterFn) afterFn();
  });
}

function openProfile(taskId, idx){
  var c = (CANDIDATES[taskId] || [])[idx];
  if(!c) return;
  document.getElementById('perfil-accept-wrap').style.display = 'block';
  document.getElementById('perfil-back').textContent = '← Volver a candidatos';
  profileBack = function(){ openCandidates(taskId); };
  var acc = c.userId ? getAccount(c.userId) : null;
  var src = acc || c;
  var av = document.getElementById('perfil-avatar');
  if(acc){ setAvatar(av, acc); } else { av.style.backgroundImage = ''; av.textContent = initials(c.name); }
  document.getElementById('perfil-nombre').textContent = src.name;
  document.getElementById('perfil-meta').textContent = (acc ? ratingOf(acc) : c.rating) + ' · ' + c.price + ' · ' + src.memberSince;
  document.getElementById('perfil-bio').textContent = src.bio;
  document.getElementById('perfil-skills').innerHTML = (src.skills || []).map(function(sk){ return '<span class="skill-pill">' + esc(sk) + '</span>'; }).join('');
  var revs = acc ? reviewsOf(acc) : (c.reviews || []);
  document.getElementById('perfil-reviews').innerHTML = revs.length ? revs.map(function(r){
    return '<div class="review"><div class="review-head"><span>' + esc(r.author) + '</span><span>' + r.rating + '</span></div><p>' + esc(r.comment) + '</p></div>';
  }).join('') : '<p style="color:var(--text-dim);font-size:.9rem;">Todavía no tiene valoraciones.</p>';

  var status = TASK_STATUS[taskId];
  var acceptBtn = document.getElementById('perfil-accept');
  if(status && status.status === 'asignada'){
    if(status.assignedTo === c.name){
      acceptBtn.textContent = '✓ Candidato aceptado';
      acceptBtn.style.pointerEvents = 'none';
      acceptBtn.style.opacity = '0.7';
    } else {
      acceptBtn.textContent = 'No seleccionado para esta tarea';
      acceptBtn.style.pointerEvents = 'none';
      acceptBtn.style.opacity = '0.6';
    }
  } else {
    acceptBtn.textContent = 'Aceptar candidato';
    acceptBtn.style.pointerEvents = 'auto';
    acceptBtn.style.opacity = '1';
    acceptBtn.onclick = function(e){
      e.preventDefault();
      acceptCandidate(taskId, idx, function(){ openProfile(taskId, idx); });
    };
  }

  skipResetOnce = true;
  setProfileReport(c.userId);
  goToView('perfil');
}

document.getElementById('perfil-back').addEventListener('click', function(e){
  e.preventDefault();
  if(profileBack){ profileBack(); }
  else if(currentCandTaskId){ openCandidates(currentCandTaskId); }
  else { goToView('mistareas'); }
});
function openUserProfile(userId){
  var acc = getAccount(userId);
  if(!acc) return;
  var n = (acc.completed || []).length;
  setAvatar(document.getElementById('perfil-avatar'), acc);
  document.getElementById('perfil-nombre').textContent = acc.name;
  document.getElementById('perfil-meta').textContent = ratingOf(acc) + ' · ' + acc.memberSince + (n ? ' · ' + n + (n === 1 ? ' trabajo completado' : ' trabajos completados') : '');
  document.getElementById('perfil-bio').textContent = acc.bio || '';
  document.getElementById('perfil-skills').innerHTML = (acc.skills || []).map(function(sk){ return '<span class="skill-pill">' + esc(sk) + '</span>'; }).join('');
  var revs = reviewsOf(acc);
  document.getElementById('perfil-reviews').innerHTML = revs.length ? revs.map(function(r){
    return '<div class="review"><div class="review-head"><span>' + esc(r.author) + '</span><span>' + r.rating + '</span></div><p>' + esc(r.comment) + '</p></div>';
  }).join('') : '<p style="color:var(--text-dim);font-size:.9rem;">Todavía no tiene valoraciones.</p>';
  document.getElementById('perfil-accept-wrap').style.display = 'none';
  document.getElementById('perfil-back').textContent = '← Volver a la tarea';
  profileBack = function(){ goToView('detalle'); };
  setProfileReport(userId);
  goToView('perfil');
}
document.getElementById('det-offer').addEventListener('keydown', function(e){
  if(['-', '+', 'e', 'E'].indexOf(e.key) !== -1) e.preventDefault();
});

function tomorrowISO(){
  var d = new Date(); d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function refreshDateMin(){ document.getElementById('plazo').min = tomorrowISO(); }
document.getElementById('precio').addEventListener('keydown', function(e){
  if(['-', '+', 'e', 'E'].indexOf(e.key) !== -1) e.preventDefault();
});
document.getElementById('crear-form').addEventListener('submit', async function(e){
  e.preventDefault();
  if(!currentUser || needSb() || guardBlocked()) return;
  var msg = document.getElementById('crear-msg');
  var titulo = document.getElementById('titulo').value.trim();
  var descripcion = document.getElementById('descripcion').value.trim();
  var rawPrice = document.getElementById('precio').value.trim();
  var plazoRaw = document.getElementById('plazo').value;
  var n = Number(rawPrice);
  if(!/^\d+(\.\d{1,2})?$/.test(rawPrice) || !(n > 0) || n > 100000){
    return flash(msg, 'El presupuesto debe ser un número positivo (por ejemplo 50 o 12,50), sin letras ni signos.', true);
  }
  if(plazoRaw && plazoRaw < tomorrowISO()){
    return flash(msg, 'La fecha límite debe ser a partir de mañana.', true);
  }
  var row = {
    title: titulo, tag: document.getElementById('categoria').value,
    card_desc: descripcion.length > 90 ? descripcion.slice(0, 90).trim() + '…' : descripcion,
    description: descripcion,
    price: String(Math.round(n * 100) / 100).replace('.', ',') + '€' + editingUnit,
    deadline: plazoRaw || null
  };
  var r;
  if(editingId){ r = await sb.from('tasks').update(row).eq('id', editingId); }
  else { row.owner = currentUser.id; r = await sb.from('tasks').insert(row); }
  if(r.error) return flash(msg, r.error.message, true);
  currentPage = 1;
  resetCrearForm();
  await loadAll();
  goToView('mistareas');
});

function pendCardHTML(t){
  var ow = getAccount(t.owner);
  var st = TASK_STATUS[t.id] || {};
  return '<div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap;"><span class="tag">' + t.tag + '</span><span class="tag" style="background:rgba(47,208,232,0.2);color:var(--navy);">' + (st.completedAt ? '✓ Completada' : 'En curso') + '</span>' + reviewPendingTag(t.id) + '</div>' +
    '<h3>' + t.title + '</h3><p>' + t.cardDesc + '</p>' +
    '<p style="font-size:.82rem;">Cliente: <b>' + esc(ow ? ow.name : '—') + '</b></p>' +
    '<div class="card-foot"><span class="price">' + (st.agreedPrice || t.price) + '</span><span class="deadline">Se cierra el<b>' + t.date + '</b></span></div>' +
    '<div class="mis-actions"><a data-chat="' + t.id + '">' + (st.completedAt ? 'Abrir chat y valorar' : 'Abrir chat con el cliente') + '</a></div></div>';
}
function renderPendientes(){
  var grid = document.getElementById('pendientes-grid');
  var list = currentUser ? TASKS.filter(function(t){ var s = TASK_STATUS[t.id]; return s && s.assignedUserId === currentUser.id; }) : [];
  grid.innerHTML = list.map(pendCardHTML).join('');
  grid.querySelectorAll('[data-chat]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); openChat(el.dataset.chat); });
  });
  document.getElementById('pendientes-empty').style.display = list.length ? 'none' : 'block';
}

function openChat(taskId, from){
  var t = TASKS.find(function(x){ return x.id === taskId; });
  var st = TASK_STATUS[taskId];
  if(!t || !st || !currentUser) return;
  var isOwner = currentUser.id === t.owner;
  var asAdmin = isAdmin && !isOwner && st.assignedUserId !== currentUser.id;
  if(!isOwner && st.assignedUserId !== currentUser.id && !asAdmin) return;
  var ow = getAccount(t.owner), wk = getAccount(st.assignedUserId);
  var other = getAccount(isOwner ? st.assignedUserId : t.owner);
  currentChatTaskId = taskId;
  document.getElementById('chat-title').textContent = asAdmin
    ? 'Chat: ' + (ow ? ow.name : '—') + ' ↔ ' + (wk ? wk.name : '—')
    : 'Chat con ' + (other ? other.name : '—');
  document.getElementById('chat-sub').textContent = t.title + ' · ' +
    (asAdmin ? 'Vista de administrador (solo lectura)' : (isOwner ? 'Eres el cliente' : 'Eres quien realiza la tarea'));
  document.getElementById('chat-form').style.display = asAdmin ? 'none' : 'flex';
  var rb = document.getElementById('chat-report');
  rb.style.display = asAdmin ? 'none' : 'inline-flex';
  var otherId = isOwner ? st.assignedUserId : t.owner;
  rb.onclick = function(e){ if(e) e.preventDefault(); openReport({ userId: otherId, kind: 'chat', taskId: taskId }); };
  var back = document.getElementById('chat-back');
  back.dataset.viewLink = asAdmin ? (from === 'reportado' ? 'reportado' : 'admin') : 'mistareas';
  back.textContent = asAdmin ? (from === 'reportado' ? '← Volver a la persona reportada' : '← Volver al panel') : '← Volver a mis tareas';
  goToView('chat');
  renderChat();
}
function renderChat(){
  var box = document.getElementById('chat-msgs');
  var msgs = CHATS[currentChatTaskId] || [];
  box.innerHTML = msgs.map(function(m){
    if(m.system) return '<div class="bubble sys">' + esc(m.text) + '</div>';
    var mine = currentUser && m.from === currentUser.id;
    var who = mine ? 'Tú' : esc((getAccount(m.from) || {}).name || '');
    return '<div class="bubble ' + (mine ? 'me' : 'them') + '">' + esc(m.text) + '<small>' + who + ' · ' + m.time + '</small></div>';
  }).join('');
  box.scrollTop = box.scrollHeight;
  renderChatComplete();
}
document.getElementById('chat-form').addEventListener('submit', async function(e){
  e.preventDefault();
  var inp = document.getElementById('chat-input');
  var text = inp.value.trim();
  if(!text || !currentUser || !currentChatTaskId || needSb() || guardBlocked()) return;
  var tid = currentChatTaskId;
  inp.value = '';
  (CHATS[tid] = CHATS[tid] || []).push({ from: currentUser.id, text: text, time: new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}) });
  renderChat();
  var r = await sb.from('messages').insert({ task_id: tid, sender: currentUser.id, body: text });
  if(r.error){ fail(r.error); loadAll(); }
});
document.getElementById('det-apply').addEventListener('click', function(e){ e.preventDefault(); applyToTask(); });
document.getElementById('det-admin-del').addEventListener('click', function(e){ e.preventDefault(); deleteTask(currentDetailTaskId); });
document.getElementById('det-admin-chat').addEventListener('click', function(e){ e.preventDefault(); openChat(currentDetailTaskId); });

function admRowHTML(t, closed){
  var ow = getAccount(t.owner), st = TASK_STATUS[t.id];
  var n = (CHATS[t.id] || []).length;
  var meta = esc(t.tag) + ' · ' + (closed
    ? 'Cliente: ' + esc(ow ? ow.name : '—') + ' ↔ Realiza: ' + esc(st.assignedTo) + ' · Acordado: ' + esc(st.agreedPrice) + ' · ' + n + (n === 1 ? ' mensaje' : ' mensajes')
    : 'Cliente: ' + esc(ow ? ow.name : '—') + ' · ' + esc(t.price) + ' · Cierra el ' + esc(t.date));
  return '<div class="done-item"><div class="done-main"><b>' + esc(t.title) + '</b><span class="cand-meta">' + meta + '</span></div>' +
    '<div class="mis-actions" style="border:none;margin:0;padding:0;">' +
    (closed ? '<a data-adm-chat="' + t.id + '">Ver chat</a>' : '') +
    '<a data-adm-info="' + t.id + '">Más información</a>' +
    '<a class="danger" data-adm-del="' + t.id + '">Eliminar</a></div></div>';
}
function renderAdmin(){
  if(!isAdmin) return;
  var closed = TASKS.filter(function(t){ return TASK_STATUS[t.id]; });
  var open = TASKS.filter(function(t){ return !TASK_STATUS[t.id]; });
  var empty = '<p style="color:var(--text-dim);">No hay tareas en esta lista.</p>';
  var c = document.getElementById('adm-closed'), o = document.getElementById('adm-open');
  c.innerHTML = closed.length ? closed.map(function(t){ return admRowHTML(t, true); }).join('') : empty;
  o.innerHTML = open.length ? open.map(function(t){ return admRowHTML(t, false); }).join('') : empty;
  document.getElementById('adm-closed-count').textContent = closed.length;
  document.getElementById('adm-open-count').textContent = open.length;
  [c, o].forEach(function(box){
    box.querySelectorAll('[data-adm-chat]').forEach(function(el){
      el.addEventListener('click', function(e){ e.preventDefault(); openChat(el.dataset.admChat); });
    });
    box.querySelectorAll('[data-adm-info]').forEach(function(el){
      el.addEventListener('click', function(e){ e.preventDefault(); openTask(el.dataset.admInfo, 'admin'); });
    });
    box.querySelectorAll('[data-adm-del]').forEach(function(el){
      el.addEventListener('click', function(e){ e.preventDefault(); deleteTask(el.dataset.admDel); });
    });
  });
}
function renderNavAccount(){
  document.getElementById('nav-admin').style.display = isAdmin ? '' : 'none';
  var el = document.getElementById('nav-account');
  if(currentUser){
    el.innerHTML = '<a id="nav-profile" style="display:flex;align-items:center;gap:8px;color:#fff;"><span class="avatar" id="nav-avatar" style="width:28px;height:28px;font-size:.7rem;"></span>' + esc(currentUser.name) + '</a><a id="nav-logout">Cerrar sesión</a>';
    setAvatar(document.getElementById('nav-avatar'), currentUser);
    document.getElementById('nav-profile').addEventListener('click', function(e){ e.preventDefault(); goToView('miperfil'); });
    document.getElementById('nav-logout').addEventListener('click', function(e){ e.preventDefault(); logout(); });
  } else {
    el.innerHTML = '<a id="nav-login" class="btn btn-primary btn-small">Iniciar sesión</a>';
    document.getElementById('nav-login').addEventListener('click', function(e){ e.preventDefault(); goToView('login'); });
  }
}
function refreshAccountViews(){ renderNavAccount(); renderMisTareas(); renderPendientes(); }
async function login(session){
  await applySession(session);
  var v = pendingView || 'home';
  pendingView = null;
  goToView(v);
}
async function logout(){
  if(sb) await sb.auth.signOut();
  await applySession(null);
  goToView('home');
}
function showAuthForm(which){
  var forms = { login: 'login-form', register: 'register-form', forgot: 'forgot-form', reset: 'reset-form', pending: 'auth-pending' };
  Object.keys(forms).forEach(function(k){ document.getElementById(forms[k]).style.display = k === which ? 'flex' : 'none'; });
  var titles = { login: 'Iniciar sesión', register: 'Crear cuenta', forgot: 'Recuperar contraseña', reset: 'Nueva contraseña', pending: 'Confirma tu correo' };
  document.getElementById('auth-heading').textContent = titles[which];
}
function showLoginNote(){
  document.getElementById('login-note').textContent = pendingView ? 'Inicia sesión para continuar.' : '';
  ['login-error', 'login-resend', 'register-error', 'forgot-msg', 'reset-error', 'pending-msg'].forEach(function(id){ document.getElementById(id).style.display = 'none'; });
  showAuthForm(recoveryMode ? 'reset' : 'login');
}
document.getElementById('show-register').addEventListener('click', function(e){ e.preventDefault(); showAuthForm('register'); });
document.getElementById('show-login').addEventListener('click', function(e){ e.preventDefault(); showAuthForm('login'); });
document.getElementById('login-form').addEventListener('submit', async function(e){
  e.preventDefault();
  if(needSb()) return;
  var form = this, err = document.getElementById('login-error'), resend = document.getElementById('login-resend');
  var email = document.getElementById('login-email').value.trim().toLowerCase();
  resend.style.display = 'none';
  var r = await sb.auth.signInWithPassword({ email: email, password: document.getElementById('login-pass').value });
  if(r.error){
    flash(err, authError(r.error), true);
    if(/not confirmed|email_not_confirmed/i.test((r.error.message || '') + ' ' + (r.error.code || ''))){ pendingEmail = email; resend.style.display = 'inline'; }
    return;
  }
  form.reset();
  login(r.data.session);
});
document.getElementById('register-form').addEventListener('submit', async function(e){
  e.preventDefault();
  if(needSb()) return;
  var form = this, err = document.getElementById('register-error');
  function bad(m){ flash(err, m, true); }
  var name = document.getElementById('reg-name').value.trim();
  var email = document.getElementById('reg-email').value.trim().toLowerCase();
  var pass = document.getElementById('reg-pass').value, pass2 = document.getElementById('reg-pass2').value;
  if(!name) return bad('Escribe tu nombre.');
  if(pass.length < 6) return bad('La contraseña debe tener al menos 6 caracteres.');
  if(pass !== pass2) return bad('Las contraseñas no coinciden.');
  if(!document.getElementById('reg-accept').checked) return bad('Debes aceptar la política de privacidad para crear la cuenta.');
  err.style.display = 'none';
  var r = await sb.auth.signUp({ email: email, password: pass, options: { data: { name: name, privacy_accepted_at: new Date().toISOString() }, emailRedirectTo: authRedirectUrl() } });
  if(r.error) return bad(authError(r.error));
  var u = r.data && r.data.user;
  if(!r.data.session && u && u.identities && u.identities.length === 0) return bad('Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
  form.reset();
  if(!r.data.session){ pendingEmail = email; showPending(email); return; }
  login(r.data.session);
});

var SKILL_CATALOG = {
  'Informática y tecnología': ['JavaScript','TypeScript','Python','Java','C#','PHP','HTML y CSS','React','Node.js','SQL','WordPress','Desarrollo web','Desarrollo de apps móviles','Bases de datos','Git','Testing y QA','Ciberseguridad','Administración de sistemas','Soporte técnico','Análisis de datos','Inteligencia artificial','Automatización de procesos','Excel avanzado'],
  'Diseño y creatividad': ['Diseño gráfico','Diseño de logotipos','Branding','Ilustración digital','Photoshop','Illustrator','Figma','Diseño UX/UI','Diseño editorial','Diseño de packaging','Motion graphics','Animación 2D','Modelado 3D','Retoque fotográfico'],
  'Audio, vídeo y fotografía': ['Edición de vídeo','Premiere Pro','After Effects','DaVinci Resolve','Producción musical','Mezcla y masterización','Grabación de audio','Locución','Podcasting','Subtitulado','Guion audiovisual','Fotografía de eventos','Fotografía de retrato','Fotografía de producto'],
  'Marketing y redes sociales': ['Community management','Gestión de redes sociales','SEO','SEM y Google Ads','Meta Ads','Email marketing','Marketing de contenidos','Copywriting','Analítica web','Estrategia de marca','E-commerce','Shopify','Investigación de mercado','Relaciones públicas','Marketing de influencers'],
  'Redacción y traducción': ['Redacción de contenidos','Corrección de textos','Edición de textos','Redacción técnica','Guionismo','Ghostwriting','Transcripción','Traducción inglés-español','Traducción alemán-español','Traducción francés-español','Traducción italiano-español','Traducción jurada'],
  'Idiomas': ['Inglés','Alemán','Francés','Italiano','Portugués','Chino mandarín','Árabe','Catalán','Euskera','Gallego','Español para extranjeros','Preparación de exámenes de idiomas'],
  'Educación y formación': ['Clases de refuerzo','Apoyo escolar','Matemáticas','Física y química','Lengua y literatura','Historia','Biología','Clases de música','Piano','Guitarra','Canto','Clases de programación','Técnicas de estudio','Preparación de oposiciones','Tutorías universitarias','Educación infantil','Monitor de tiempo libre'],
  'Administración y finanzas': ['Contabilidad','Gestión administrativa','Facturación','Declaración de la renta','Nóminas y recursos humanos','Gestión de proyectos','Gestión de agenda','Secretariado','Introducción de datos','Presupuestos','Asesoría fiscal básica','Atención telefónica'],
  'Atención al cliente y ventas': ['Atención al cliente','Ventas','Telemarketing','Gestión de reclamaciones','Negociación','Captación de clientes','CRM','Soporte al cliente por chat'],
  'Hogar y mantenimiento': ['Limpieza del hogar','Planchado','Montaje de muebles','Bricolaje','Fontanería básica','Electricidad básica','Pintura de interiores','Carpintería','Jardinería','Reparaciones del hogar','Mudanzas','Pequeñas reformas'],
  'Cuidado de personas y mascotas': ['Cuidado de niños','Canguro','Cuidado de personas mayores','Acompañamiento a mayores','Primeros auxilios','Paseo de perros','Cuidado de mascotas','Adiestramiento canino','Peluquería canina'],
  'Hostelería y eventos': ['Camarero/a','Barista','Coctelería','Cocina','Repostería','Catering','Organización de eventos','Decoración de eventos','Animación infantil','DJ'],
  'Salud y bienestar': ['Entrenamiento personal','Monitor deportivo','Yoga','Pilates','Mindfulness','Coaching','Asesoramiento nutricional básico','Masaje relajante'],
  'Transporte y logística': ['Carné de conducir B','Reparto a domicilio','Mensajería','Conducción de furgoneta','Gestión de almacén','Embalaje'],
  'Habilidades personales': ['Trabajo en equipo','Comunicación','Organización','Puntualidad','Responsabilidad','Creatividad','Resolución de problemas','Adaptabilidad','Liderazgo','Gestión del tiempo','Proactividad','Empatía','Paciencia','Atención al detalle','Autonomía']
};
function norm(t){ return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function populateSkillCats(){
  var sel = document.getElementById('mp-skill-cat');
  Object.keys(SKILL_CATALOG).forEach(function(c){ sel.insertAdjacentHTML('beforeend', '<option value="' + esc(c) + '">' + esc(c) + '</option>'); });
}

function ratingOf(acc){
  var d = acc.completed || [];
  if(!d.length) return 'Nuevo';
  var sum = d.reduce(function(t, j){ return t + j.rating; }, 0);
  return (sum / d.length).toFixed(1) + ' ★';
}
function reviewsOf(acc){
  return (acc.completed || []).map(function(j){ return { author: j.client, rating: j.rating.toFixed(1) + ' ★', comment: j.comment }; });
}
function setAvatar(el, acc){
  if(acc.avatar){
    el.style.backgroundImage = 'url("' + acc.avatar + '")';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = initials(acc.name);
  }
}
function flash(el, text, isErr){
  el.textContent = text;
  el.style.color = isErr ? '#c23b3b' : 'var(--blue)';
  el.style.display = 'block';
}

function doneHTML(j){
  return '<div class="done-item"><div class="done-main"><b>' + esc(j.title) + '</b>' +
    '<span class="cand-meta">Valorado por: ' + esc(j.client) + ' · ' + esc(j.date) + ' · ' + esc(j.price) + '</span>' +
    '<p>“' + esc(j.comment) + '”</p></div>' +
    '<span class="rating-badge">' + j.rating.toFixed(1) + ' ★</span></div>';
}
function renderSkills(){
  var box = document.getElementById('mp-skills');
  var sk = currentUser ? currentUser.skills : [];
  box.innerHTML = sk.length ? sk.map(function(t, i){
    return '<span class="skill-pill removable">' + esc(t) + '<button type="button" data-rm="' + i + '" aria-label="Quitar ' + esc(t) + '">×</button></span>';
  }).join('') : '<span class="muted-note">Aún no has añadido aptitudes.</span>';
  box.querySelectorAll('[data-rm]').forEach(function(b){
    b.addEventListener('click', function(){ currentUser.skills.splice(Number(b.dataset.rm), 1); saveProfile({ skills: currentUser.skills }); renderSkills(); });
  });
  renderSkillOptions();
}
function renderSkillOptions(){
  var box = document.getElementById('mp-skill-options');
  if(!currentUser){ box.innerHTML = ''; return; }
  var q = norm(document.getElementById('mp-skill-input').value.trim());
  var cat = document.getElementById('mp-skill-cat').value;
  var have = currentUser.skills.map(norm);
  var html = '';
  Object.keys(SKILL_CATALOG).forEach(function(c){
    if(cat && c !== cat) return;
    var items = SKILL_CATALOG[c].filter(function(n){ var nn = norm(n); return have.indexOf(nn) === -1 && (!q || nn.indexOf(q) !== -1); });
    if(!items.length) return;
    html += '<div class="skill-group"><h4>' + esc(c) + '</h4><div class="skill-opt-wrap">' +
      items.map(function(n){ return '<button type="button" class="skill-opt" data-add="' + esc(n) + '">+ ' + esc(n) + '</button>'; }).join('') +
      '</div></div>';
  });
  box.innerHTML = html || '<span class="muted-note">No hay aptitudes que coincidan con tu búsqueda.</span>';
  box.querySelectorAll('[data-add]').forEach(function(b){
    b.addEventListener('click', function(){ addSkill(b.dataset.add); });
  });
}
function addSkill(name){
  if(!currentUser || !name) return;
  var msg = document.getElementById('mp-skill-msg');
  var sk = currentUser.skills;
  if(sk.length >= 15) return flash(msg, 'Puedes tener hasta 15 aptitudes.', true);
  if(sk.some(function(t){ return norm(t) === norm(name); })) return flash(msg, 'Esa aptitud ya está en tu lista.', true);
  sk.push(name);
  saveProfile({ skills: sk });
  msg.style.display = 'none';
  renderSkills();
}
function renderMiPerfil(){
  if(!currentUser) return;
  var a = currentUser;
  setAvatar(document.getElementById('mp-avatar'), a);
  document.getElementById('mp-name').value = a.name;
  document.getElementById('mp-email').value = a.email;
  document.getElementById('mp-pass').value = '';
  document.getElementById('mp-bio').value = a.bio || '';
  document.getElementById('mp-bio-count').textContent = (a.bio || '').length + '/400';
  ['mp-msg','mp-photo-msg','mp-skill-msg'].forEach(function(id){ document.getElementById(id).style.display = 'none'; });
  document.getElementById('mp-skill-input').value = '';
  document.getElementById('mp-skill-cat').value = '';
  renderSkills();
  var done = a.completed || [];
  document.getElementById('mp-summary').textContent = done.length ? ratingOf(a) + ' de media · ' + done.length + (done.length === 1 ? ' trabajo' : ' trabajos') : '';
  document.getElementById('mp-done').innerHTML = done.length ? done.map(doneHTML).join('') :
    '<p style="color:var(--text-dim);">Aún no has completado ningún trabajo. Cuando un cliente valore tu trabajo, aparecerá aquí.</p>';
}

document.getElementById('mp-bio').addEventListener('input', function(){
  document.getElementById('mp-bio-count').textContent = this.value.length + '/400';
});
populateSkillCats();
document.getElementById('mp-skill-input').addEventListener('input', renderSkillOptions);
document.getElementById('mp-skill-cat').addEventListener('change', renderSkillOptions);
document.getElementById('mp-skill-input').addEventListener('keydown', function(e){
  if(e.key === 'Enter'){
    e.preventDefault();
    var first = document.querySelector('#mp-skill-options [data-add]');
    if(first) addSkill(first.dataset.add);
  }
});
document.getElementById('mp-logout').addEventListener('click', function(e){ e.preventDefault(); logout(); });
document.getElementById('mp-form').addEventListener('submit', async function(e){
  e.preventDefault();
  var a = currentUser, msg = document.getElementById('mp-msg');
  if(!a || needSb() || guardBlocked()) return;
  var name = document.getElementById('mp-name').value.trim();
  var pass = document.getElementById('mp-pass').value;
  var bio = document.getElementById('mp-bio').value.trim();
  if(!name) return flash(msg, 'El nombre no puede estar vacío.', true);
  if(pass && pass.length < 6) return flash(msg, 'La nueva contraseña debe tener al menos 6 caracteres.', true);
  var r = await sb.from('profiles').update({ name: name, bio: bio }).eq('id', a.id);
  if(r.error) return flash(msg, r.error.message, true);
  if(pass){
    var u = await sb.auth.updateUser({ password: pass });
    if(u.error) return flash(msg, u.error.message, true);
  }
  a.name = name; a.bio = bio;
  document.getElementById('mp-pass').value = '';
  renderAll();
  flash(msg, 'Cambios guardados.', false);
});
document.getElementById('mp-file').addEventListener('change', function(){
  var input = this, f = input.files && input.files[0];
  var msg = document.getElementById('mp-photo-msg');
  if(!f) return;
  if(!/^image\//.test(f.type)){ flash(msg, 'El archivo debe ser una imagen.', true); input.value = ''; return; }
  if(f.size > 5 * 1024 * 1024){ flash(msg, 'La imagen no puede pesar más de 5 MB.', true); input.value = ''; return; }
  var reader = new FileReader();
  reader.onerror = function(){ flash(msg, 'No se pudo leer la imagen.', true); };
  reader.onload = function(){
    var img = new Image();
    img.onerror = function(){ flash(msg, 'No se pudo procesar la imagen.', true); };
    img.onload = function(){
      var side = Math.min(img.width, img.height);
      var cv = document.createElement('canvas');
      cv.width = 256; cv.height = 256;
      cv.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      saveProfile({ avatar: cv.toDataURL('image/jpeg', 0.85) });
      input.value = '';
      setAvatar(document.getElementById('mp-avatar'), currentUser);
      renderNavAccount();
      flash(msg, 'Foto actualizada.', false);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
});
document.getElementById('mp-remove-photo').addEventListener('click', function(e){
  e.preventDefault();
  if(!currentUser) return;
  saveProfile({ avatar: '' });
  setAvatar(document.getElementById('mp-avatar'), currentUser);
  renderNavAccount();
  flash(document.getElementById('mp-photo-msg'), 'Foto eliminada.', false);
});

// ================= COMPLETAR TAREA Y VALORACIÓN MUTUA =================
function completeTask(taskId){
  var t = TASKS.find(function(x){ return x.id === taskId; }), st = TASK_STATUS[taskId];
  if(!t || !st || !currentUser || needSb() || guardBlocked()) return;
  var isOwner = currentUser.id === t.owner;
  showConfirm(isOwner ? '¿Dar la tarea por completada? Después ambos podréis puntuaros.' : '¿Marcar la tarea como realizada? El cliente tendrá que confirmarla.',
    isOwner ? 'Completar' : 'Marcar como realizada', async function(){
      var r = await sb.rpc('complete_task', { p_task: taskId });
      if(r.error) return fail(r.error);
      toast(isOwner ? 'Tarea completada. Ya podéis valoraros.' : 'Avisado. El cliente debe confirmarla.', false);
      await loadAll();
    });
}
function setReviewStars(n){
  reviewStars = n;
  document.querySelectorAll('#chat-complete .star-btn').forEach(function(b){ b.classList.toggle('on', Number(b.dataset.star) <= n); });
}
async function submitReview(){
  var tid = currentChatTaskId, msg = document.getElementById('review-msg');
  if(!tid || !currentUser || needSb() || guardBlocked()) return;
  if(!(reviewStars >= 1 && reviewStars <= 5)) return flash(msg, 'Elige una puntuación de 1 a 5 estrellas.', true);
  var comment = document.getElementById('review-comment').value.trim();
  var r = await sb.rpc('submit_review', { p_task: tid, p_rating: reviewStars, p_comment: comment });
  if(r.error) return flash(msg, r.error.message, true);
  reviewStars = 0;
  toast('Valoración enviada. ¡Gracias!', false);
  await loadAll();
}
function renderChatComplete(){
  var box = document.getElementById('chat-complete');
  var t = TASKS.find(function(x){ return x.id === currentChatTaskId; }), st = TASK_STATUS[currentChatTaskId];
  var isOwner = !!(t && currentUser && currentUser.id === t.owner);
  var isWorker = !!(st && currentUser && st.assignedUserId === currentUser.id);
  if(!t || !st || !currentUser || (!isOwner && !isWorker)){ box.style.display = 'none'; box._sig = ''; return; }
  var otherId = isOwner ? st.assignedUserId : t.owner, other = getAccount(otherId), on = other ? other.name : 'La otra persona';
  var mine = reviewOf(t.id, currentUser.id), theirs = reviewOf(t.id, otherId);
  var sig = [t.id, st.completedAt || '', st.deliveredAt || '', mine ? mine.rating : '', theirs ? theirs.rating : '', isOwner ? 'o' : 'w'].join('|');
  if(box._sig === sig) return;
  box._sig = sig;
  var h = '';
  if(!st.completedAt){
    if(isOwner){
      h = '<p>' + (st.deliveredAt ? '<b>' + esc(on) + '</b> ha marcado la tarea como realizada. Revísala y confírmala.' : 'Cuando el trabajo esté hecho, confírmalo para que ambos podáis valoraros.') + '</p>' +
          '<a class="btn btn-primary btn-small" id="cc-complete" style="align-self:flex-start;cursor:pointer;">Dar por completada</a>';
    } else if(st.deliveredAt){
      h = '<p>Has marcado la tarea como realizada. Esperando la confirmación del cliente.</p>';
    } else {
      h = '<p>Cuando termines el trabajo, avisa al cliente para que la dé por completada.</p>' +
          '<a class="btn btn-primary btn-small" id="cc-complete" style="align-self:flex-start;cursor:pointer;">Marcar como realizada</a>';
    }
  } else {
    h = '<span class="done-title">✓ Tarea completada</span>';
    if(mine){
      h += '<p>Tu valoración para <b>' + esc(on) + '</b>: <span class="stars-static">' + starsText(mine.rating) + '</span>' + (mine.comment ? ' “' + esc(mine.comment) + '”' : '') + '</p>';
    } else {
      reviewStars = 0;
      h += '<p>Valora a <b>' + esc(on) + '</b> (' + (isOwner ? 'quien ha realizado la tarea' : 'el cliente') + '):</p>' +
        '<div class="stars" role="group" aria-label="Puntuación">' + [1, 2, 3, 4, 5].map(function(n){ return '<button type="button" class="star-btn" data-star="' + n + '" aria-label="' + n + (n === 1 ? ' estrella' : ' estrellas') + '">★</button>'; }).join('') + '</div>' +
        '<textarea id="review-comment" class="mini-input" maxlength="300" placeholder="Comentario (opcional)"></textarea>' +
        '<p id="review-msg" style="display:none;font-weight:600;"></p>' +
        '<a class="btn btn-primary btn-small" id="review-send" style="align-self:flex-start;cursor:pointer;">Enviar valoración</a>';
    }
    h += '<p>' + (theirs ? '<b>' + esc(on) + '</b> te ha valorado: <span class="stars-static">' + starsText(theirs.rating) + '</span>' + (theirs.comment ? ' “' + esc(theirs.comment) + '”' : '') : esc(on) + ' todavía no te ha valorado.') + '</p>';
  }
  box.innerHTML = h;
  box.style.display = 'flex';
  var cc = document.getElementById('cc-complete');
  if(cc) cc.addEventListener('click', function(e){ e.preventDefault(); completeTask(t.id); });
  box.querySelectorAll('.star-btn').forEach(function(b){ b.addEventListener('click', function(){ setReviewStars(Number(b.dataset.star)); }); });
  var rs = document.getElementById('review-send');
  if(rs) rs.addEventListener('click', function(e){ e.preventDefault(); submitReview(); });
}

// ================= CONTACTO =================
var CONTACT_ICONS = {
  email: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
  telefono: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  horario: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  direccion: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'
};
function renderContacto(){
  var items = [
    { k: 'email', label: 'Correo electrónico', value: CONTACT.email, href: CONTACT.email ? 'mailto:' + CONTACT.email : '' },
    { k: 'telefono', label: 'Teléfono', value: CONTACT.telefono, href: CONTACT.telefono ? 'tel:' + CONTACT.telefono.replace(/[^+\d]/g, '') : '' },
    { k: 'horario', label: 'Horario de atención', value: CONTACT.horario, href: '' },
    { k: 'direccion', label: 'Ubicación', value: CONTACT.direccion, href: '' }
  ].filter(function(i){ return i.value; });
  document.getElementById('contact-grid').innerHTML = items.map(function(i){
    return '<div class="contact-card"><span class="contact-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#06122c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + CONTACT_ICONS[i.k] + '</svg></span>' +
      '<div><small>' + esc(i.label) + '</small>' + (i.href ? '<a href="' + esc(i.href) + '">' + esc(i.value) + '</a>' : '<b>' + esc(i.value) + '</b>') + '</div></div>';
  }).join('');
}

// ================= ASISTENTE VIRTUAL (versión inicial) =================
// Para conectar tu chatbot real, cambia SOLO el cuerpo de botReply(text, history):
// debe devolver (con await) el texto de la respuesta. 'history' es la lista de mensajes
// [{ role: 'me' | 'bot', text }]. Idea para el futuro: llamar a una función de servidor
// (por ejemplo una Edge Function de Supabase) que consulte una API de IA. La clave de esa
// API NUNCA debe ir en este archivo, porque es público.
var BOT_FAQ = [
  { keys: ['gracias'], answer: '¡De nada! Si tienes otra duda, aquí estoy.' },
  { keys: ['complet', 'terminar', 'terminad', 'finaliz', 'valor', 'puntu', 'estrellas'], answer: 'Dentro del chat de la tarea: quien la realiza pulsa «Marcar como realizada» y el cliente «Dar por completada». Después, ambos podéis puntuaros de 1 a 5 estrellas y dejar un comentario; la valoración aparece en el perfil.' },
  { keys: ['olvid', 'recuper', 'restablec', 'no puedo entrar', 'no me deja entrar'], answer: 'En «Iniciar sesión» pulsa «¿Has olvidado tu contraseña?», escribe tu correo y te enviaremos un enlace para crear una nueva. Revisa también la carpeta de spam.' },
  { keys: ['confirm', 'verific', 'activar mi cuenta'], answer: 'Al registrarte te enviamos un correo con un enlace: púlsalo para activar tu cuenta. Si no te llega, mira en spam o intenta iniciar sesión y pulsa «Reenviar correo de confirmación».' },
  { keys: ['cuenta', 'registr', 'contraseña', 'perfil', 'foto'], answer: 'Para crear una cuenta pulsa «Iniciar sesión» y luego «¿No tienes cuenta? Crear una». En «Mi perfil» puedes cambiar tu nombre, descripción, foto, aptitudes y contraseña.' },
  { keys: ['reportar', 'reporte', 'denunci', 'acoso', 'estafa'], answer: 'Para reportar a una persona abre su perfil y pulsa «Reportar usuario». Para reportar una conversación, abre el chat y pulsa «Reportar chat». Nuestro equipo revisará el reporte y podrá avisar, bloquear temporalmente o eliminar la cuenta.' },
  { keys: ['persona', 'humano', 'soporte', 'contacto', 'telefono', 'email', 'correo', 'ayuda'], answer: 'Puedes hablar con nuestro equipo desde la página «Contacto» del menú: allí tienes el correo, el teléfono y el horario de atención.' },
  { keys: ['eliminar', 'borrar'], answer: 'Solo quien creó la tarea puede eliminarla, desde «Mis tareas» → «Eliminar». Si necesitas que la eliminemos nosotros, escríbenos desde «Contacto».' },
  { keys: ['pago', 'pagar', 'cobrar', 'dinero', 'comision', 'factura'], answer: 'Los pagos todavía no están disponibles en esta versión: el precio de cada tarea se acuerda entre el cliente y quien la realiza. Cuando se active el pago protegido te lo contaremos aquí. Para dudas, escríbenos desde «Contacto».' },
  { keys: ['aceptar', 'acepto', 'ver candidatos', 'mis candidatos'], answer: 'En «Mis tareas» pulsa «Ver candidatos» y después «Aceptar candidato». Al aceptar se abre un chat con esa persona y la tarea deja de ser pública.' },
  { keys: ['presento', 'presentar', 'candidat', 'aplicar', 'postular', 'oferta'], answer: 'Abre la tarea con «Más información», escribe tu oferta (un número positivo) y pulsa «Presentarse a la oferta». El cliente verá tu candidatura y, si te acepta, la tarea aparecerá en «Mis tareas» → «Tareas pendientes».' },
  { keys: ['creo una tarea', 'crear una tarea', 'crear tarea', 'publicar', 'publico', 'nueva tarea'], answer: 'Inicia sesión y pulsa «Crear tarea». Rellena el título, la categoría, la descripción y el presupuesto (un número positivo). La fecha límite es opcional y debe ser a partir de mañana.' },
  { keys: ['chat', 'mensaje', 'conversar'], answer: 'El chat se abre cuando un cliente acepta a un candidato. Tú lo encuentras en «Mis tareas» → «Tareas pendientes» (si realizas la tarea) o con el botón «Abrir chat» (si eres el cliente).' },
  { keys: ['buscar', 'filtrar', 'categoria', 'ordenar'], answer: 'En «Busca tareas» puedes usar el buscador de arriba, filtrar por categoría y ordenar por precio o por fecha.' }
];
var BOT_CHIPS = ['¿Cómo creo una tarea?', '¿Cómo me presento a una tarea?', '¿Cómo funcionan los pagos?', 'Hablar con una persona'];
var BOT_GREETING = '¡Hola! Soy el asistente de TaskFlow (versión inicial). Puedo orientarte sobre cómo crear tareas, presentarte como candidato, el chat y tu perfil. ¿En qué te ayudo?';
var BOT_FALLBACK = 'Todavía soy un asistente muy básico y no tengo la respuesta a eso. Escríbenos desde la página «Contacto» y te ayudaremos.';
var BOT_MSGS = [], BOT_BUSY = false, BOT_OPENED = false;

async function botReply(text, history){
  var q = norm(text);
  for(var i = 0; i < BOT_FAQ.length; i++){
    if(BOT_FAQ[i].keys.some(function(k){ return q.indexOf(norm(k)) !== -1; })) return BOT_FAQ[i].answer;
  }
  return BOT_FALLBACK;
}
function renderBot(){
  var box = document.getElementById('bot-msgs');
  box.innerHTML = BOT_MSGS.map(function(m){
    var body = m.typing ? '<span class="bot-typing"><i></i><i></i><i></i></span>' : esc(m.text).replace(/\n/g, '<br>');
    return '<div class="bubble ' + (m.role === 'me' ? 'me' : 'them') + '">' + body + '</div>';
  }).join('');
  box.scrollTop = box.scrollHeight;
  document.getElementById('bot-chips').style.display = BOT_MSGS.length <= 1 ? 'flex' : 'none';
}
function openBot(){
  document.getElementById('bot-panel').style.display = 'flex';
  if(!BOT_OPENED){ BOT_OPENED = true; BOT_MSGS.push({ role: 'bot', text: BOT_GREETING }); }
  renderBot();
  var inp = document.getElementById('bot-input');
  if(inp && inp.focus) inp.focus();
}
function closeBot(){ document.getElementById('bot-panel').style.display = 'none'; }
async function sendBot(text){
  text = (text || '').trim();
  if(!text || BOT_BUSY) return;
  BOT_BUSY = true;
  BOT_MSGS.push({ role: 'me', text: text });
  BOT_MSGS.push({ role: 'bot', typing: true });
  renderBot();
  var ans;
  try {
    var hist = BOT_MSGS.filter(function(m){ return !m.typing; });
    var res = await Promise.all([botReply(text, hist), new Promise(function(r){ setTimeout(r, 400); })]);
    ans = res[0];
  } catch(e){
    console.error(e);
    ans = 'Ahora mismo no puedo responder. Inténtalo de nuevo en un momento o escríbenos desde «Contacto».';
  }
  BOT_MSGS = BOT_MSGS.filter(function(m){ return !m.typing; });
  BOT_MSGS.push({ role: 'bot', text: ans });
  BOT_BUSY = false;
  renderBot();
}
function initBot(){
  var chips = document.getElementById('bot-chips');
  chips.innerHTML = BOT_CHIPS.map(function(c){ return '<button type="button" class="skill-opt" data-chip="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
  chips.querySelectorAll('[data-chip]').forEach(function(b){
    b.addEventListener('click', function(){ sendBot(b.dataset.chip); });
  });
  document.getElementById('bot-fab').addEventListener('click', function(){
    if(document.getElementById('bot-panel').style.display === 'flex') closeBot(); else openBot();
  });
  document.getElementById('bot-close').addEventListener('click', closeBot);
  document.getElementById('bot-form').addEventListener('submit', function(e){
    e.preventDefault();
    var inp = document.getElementById('bot-input');
    var v = inp.value;
    inp.value = '';
    sendBot(v);
  });
  document.getElementById('bot-input').addEventListener('keydown', function(e){ if(e.key === 'Escape') closeBot(); });
  document.getElementById('contact-open-bot').addEventListener('click', function(e){ e.preventDefault(); openBot(); });
}

// ================= MODERACIÓN =================
var REPORT_REASONS = ['Intento de estafa o fraude', 'Acoso, insultos o amenazas', 'Contenido inapropiado', 'Suplantación de identidad', 'Spam o publicidad', 'Otro motivo'];
var reportTarget = null, currentReported = null;
function fmtDateTime(iso){
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function blockedNow(){ return !!(currentUser && currentUser.blockedUntil && new Date(currentUser.blockedUntil) > new Date()); }
function guardBlocked(){
  if(!blockedNow()) return false;
  toast('Tu cuenta está suspendida hasta el ' + fmtDateTime(currentUser.blockedUntil) + '.', true);
  return true;
}

function setProfileReport(userId){
  var b = document.getElementById('perfil-report');
  var show = !!userId && !isAdmin && !(currentUser && currentUser.id === userId);
  b.style.display = show ? 'inline-flex' : 'none';
  b.onclick = function(e){ if(e) e.preventDefault(); openReport({ userId: userId, kind: 'usuario' }); };
}
function openReport(target){
  if(!currentUser){ toast('Inicia sesión para reportar.', true); goToView('login'); return; }
  if(guardBlocked()) return;
  var acc = getAccount(target.userId);
  reportTarget = target;
  document.getElementById('report-title').textContent = target.kind === 'chat' ? 'Reportar este chat' : 'Reportar usuario';
  document.getElementById('report-sub').textContent = (target.kind === 'chat' ? 'Avisarás al equipo sobre la conversación con ' : 'Avisarás al equipo sobre ') + (acc ? acc.name : 'esta persona') + '. El reporte es confidencial.';
  document.getElementById('report-reason').innerHTML = REPORT_REASONS.map(function(r){ return '<option>' + esc(r) + '</option>'; }).join('');
  document.getElementById('report-details').value = '';
  document.getElementById('report-msg').style.display = 'none';
  document.getElementById('report-overlay').style.display = 'flex';
}
function closeReport(){ document.getElementById('report-overlay').style.display = 'none'; reportTarget = null; }
async function sendReport(){
  if(!reportTarget || !currentUser || needSb() || guardBlocked()) return;
  var msg = document.getElementById('report-msg');
  var reason = document.getElementById('report-reason').value;
  var details = document.getElementById('report-details').value.trim();
  if(reason === 'Otro motivo' && !details) return flash(msg, 'Cuéntanos qué ha pasado.', true);
  var r = await sb.from('reports').insert({
    reporter: currentUser.id, reported: reportTarget.userId, kind: reportTarget.kind,
    task_id: reportTarget.taskId || null, reason: reason, details: details
  });
  if(r.error){
    return flash(msg, r.error.code === '23505' ? 'Ya has enviado un reporte pendiente sobre esto.' : r.error.message, true);
  }
  closeReport();
  toast('Reporte enviado. Nuestro equipo lo revisará.', false);
  loadAll();
}
async function ackWarning(id){
  if(needSb()) return;
  var r = await sb.from('sanctions').update({ read_at: new Date().toISOString() }).eq('id', id);
  if(r.error) return fail(r.error);
  loadAll();
}
function isActive(id){ var v = document.getElementById(id); return !!(v && v.classList.contains('active')); }
function renderModeration(){
  var bb = document.getElementById('block-banner'), wb = document.getElementById('warn-banner');
  if(blockedNow()){
    bb.innerHTML = '<b>Tu cuenta está suspendida</b> hasta el ' + esc(fmtDateTime(currentUser.blockedUntil)) +
      (currentUser.blockedReason ? '. Motivo: ' + esc(currentUser.blockedReason) : '') +
      '. Mientras tanto no puedes crear tareas, presentarte, escribir mensajes ni editar tu perfil.';
    bb.style.display = 'block';
  } else { bb.style.display = 'none'; }
  var unread = currentUser ? SANCTIONS.filter(function(x){ return x.kind === 'aviso' && x.user_id === currentUser.id && !x.read_at; }) : [];
  if(unread.length){
    wb.innerHTML = '<b>Aviso del equipo' + (unread.length > 1 ? ' (' + unread.length + ' pendientes)' : '') + ':</b> ' + esc(unread[0].message) +
      ' <a id="warn-ok" style="margin-left:10px;font-weight:700;text-decoration:underline;cursor:pointer;">Entendido</a>';
    wb.style.display = 'block';
    document.getElementById('warn-ok').addEventListener('click', function(e){ e.preventDefault(); ackWarning(unread[0].id); });
  } else { wb.style.display = 'none'; }
  var pend = REPORTS.filter(function(r){ return r.status === 'pendiente'; }).length;
  document.getElementById('nav-reportes').style.display = isAdmin ? '' : 'none';
  document.getElementById('nav-reportes-badge').textContent = (isAdmin && pend) ? String(pend) : '';
  if(isAdmin && isActive('view-reportes')) renderReportes();
  if(isAdmin && isActive('view-reportado')) renderReportado();
}

// ---- panel de reportes (admin) ----
function reportGroups(){
  var map = {}, order = [];
  REPORTS.forEach(function(r){
    var key = r.reported || ('del:' + (r.reported_name || '?'));
    if(!map[key]){ map[key] = { key: key, userId: r.reported || null, name: r.reported_name || '—', reports: [] }; order.push(key); }
    map[key].reports.push(r);
  });
  return order.map(function(k){
    var g = map[k];
    g.acc = g.userId ? getAccount(g.userId) : null;
    if(g.acc) g.name = g.acc.name;
    g.pending = g.reports.filter(function(r){ return r.status === 'pendiente'; }).length;
    g.last = g.reports[0].created_at;
    return g;
  });
}
function currentGroup(){ return reportGroups().find(function(g){ return g.key === currentReported; }); }
function userBlockedUntil(acc){ return (acc && acc.blockedUntil && new Date(acc.blockedUntil) > new Date()) ? acc.blockedUntil : null; }
function renderReportes(){
  if(!isAdmin) return;
  var f = document.getElementById('rep-filter').value;
  var groups = reportGroups().filter(function(g){ return f === 'todos' || g.pending > 0; });
  groups.sort(function(a, b){ return (b.pending - a.pending) || (new Date(b.last) - new Date(a.last)); });
  var box = document.getElementById('rep-list');
  box.innerHTML = groups.length ? groups.map(function(g){
    var warns = SANCTIONS.filter(function(x){ return x.kind === 'aviso' && g.userId && x.user_id === g.userId; }).length;
    var bu = userBlockedUntil(g.acc);
    var meta = g.reports.length + (g.reports.length === 1 ? ' reporte' : ' reportes') + ' · último: ' + fmtDateTime(g.last) +
      ' · ' + warns + (warns === 1 ? ' aviso' : ' avisos') + (bu ? ' · bloqueada hasta ' + fmtDateTime(bu) : '') + (g.acc ? '' : ' · cuenta eliminada');
    return '<div class="done-item"><div class="done-main"><b>' + esc(g.name) + '</b><span class="cand-meta">' + esc(meta) + '</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">' +
      (g.pending ? '<span class="rep-pill">' + g.pending + (g.pending === 1 ? ' pendiente' : ' pendientes') + '</span>' : '<span class="rep-pill ok">Sin pendientes</span>') +
      '<div class="mis-actions" style="border:none;margin:0;padding:0;"><a data-rep-open="' + esc(g.key) + '">Ver reportes y medidas</a></div></div></div>';
  }).join('') : '<p style="color:var(--text-dim);">No hay personas con reportes en esta lista.</p>';
  box.querySelectorAll('[data-rep-open]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); currentReported = el.dataset.repOpen; goToView('reportado'); });
  });
}
function reportRowHTML(r){
  var rp = r.reporter ? getAccount(r.reporter) : null;
  var who = rp ? rp.name : ((r.reporter_name || 'cuenta eliminada'));
  var pill = r.status === 'pendiente' ? '<span class="rep-pill">Pendiente</span>' : (r.status === 'resuelto' ? '<span class="rep-pill ok">Resuelto</span>' : '<span class="rep-pill off">Descartado</span>');
  var actions = '';
  if(r.kind === 'chat'){
    actions += (r.task_id && TASK_STATUS[r.task_id]) ? '<a data-rd-chat="' + r.task_id + '">Ver chat</a>' : '<span class="muted-note">Chat no disponible</span>';
  }
  if(r.status === 'pendiente'){
    actions += '<a data-rd-id="' + r.id + '" data-rd-status="resuelto">Resuelto</a><a data-rd-id="' + r.id + '" data-rd-status="descartado">Descartar</a>';
  } else {
    actions += '<a data-rd-id="' + r.id + '" data-rd-status="pendiente">Reabrir</a>';
  }
  return '<div class="done-item"><div class="done-main"><b>' + esc(r.reason) + '</b>' +
    '<span class="cand-meta">' + (r.kind === 'chat' ? 'Reporte de chat' : 'Reporte de usuario') + ' · Por: ' + esc(who) + ' · ' + esc(fmtDateTime(r.created_at)) + '</span>' +
    (r.details ? '<p>“' + esc(r.details) + '”</p>' : '') + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">' + pill +
    '<div class="mis-actions" style="border:none;margin:0;padding:0;flex-wrap:wrap;justify-content:flex-end;">' + actions + '</div></div></div>';
}
function sanctionRowHTML(x){
  var label = { aviso: 'Aviso', bloqueo: 'Bloqueo temporal', desbloqueo: 'Bloqueo retirado', eliminacion: 'Cuenta eliminada' }[x.kind] || x.kind;
  return '<div class="done-item"><div class="done-main"><b>' + esc(label) + '</b>' +
    '<span class="cand-meta">' + esc(fmtDateTime(x.created_at)) + (x.blocked_until ? ' · hasta el ' + esc(fmtDateTime(x.blocked_until)) : '') + (x.kind === 'aviso' ? (x.read_at ? ' · leído' : ' · sin leer') : '') + '</span>' +
    (x.message ? '<p>' + esc(x.message) + '</p>' : '') + '</div></div>';
}
function renderReportado(){
  if(!isAdmin || !currentReported) return;
  var g = currentGroup();
  if(!g) return;
  var acc = g.acc, bu = userBlockedUntil(acc);
  var av = document.getElementById('rd-avatar');
  if(acc){ setAvatar(av, acc); } else { av.style.backgroundImage = ''; av.textContent = '✕'; }
  document.getElementById('rd-name').textContent = g.name;
  document.getElementById('rd-meta').textContent = acc ? (ratingOf(acc) + ' · ' + acc.memberSince) : 'Cuenta eliminada';
  var st = document.getElementById('rd-status');
  st.textContent = !acc ? 'Esta cuenta ya no existe.' : (bu ? 'Cuenta bloqueada hasta el ' + fmtDateTime(bu) + (acc.blockedReason ? ' · Motivo: ' + acc.blockedReason : '') : 'Cuenta activa.');
  st.style.color = (!acc || bu) ? '#a2431a' : 'var(--navy)';
  document.getElementById('rd-actions').style.display = acc ? 'flex' : 'none';
  document.getElementById('rd-unblock').style.display = bu ? 'inline' : 'none';
  var rbox = document.getElementById('rd-reports');
  rbox.innerHTML = g.reports.map(reportRowHTML).join('');
  rbox.querySelectorAll('[data-rd-chat]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); openChat(el.dataset.rdChat, 'reportado'); });
  });
  rbox.querySelectorAll('[data-rd-status]').forEach(function(el){
    el.addEventListener('click', function(e){ e.preventDefault(); adminRpc('admin_resolve_report', { p_report: el.dataset.rdId, p_status: el.dataset.rdStatus }); });
  });
  var hist = SANCTIONS.filter(function(x){ return (g.userId && x.user_id === g.userId) || (!x.user_id && x.user_name === g.name); });
  document.getElementById('rd-sanctions').innerHTML = hist.length ? hist.map(sanctionRowHTML).join('') : '<p style="color:var(--text-dim);">Todavía no se ha aplicado ninguna medida.</p>';
}
function reasonValue(){ return document.getElementById('rd-reason').value.trim(); }
document.getElementById('rep-filter').addEventListener('change', renderReportes);
document.getElementById('report-cancel').addEventListener('click', function(e){ e.preventDefault(); closeReport(); });
document.getElementById('report-send').addEventListener('click', function(e){ e.preventDefault(); sendReport(); });
document.getElementById('rd-warn-send').addEventListener('click', async function(e){
  e.preventDefault();
  var g = currentGroup(), msg = document.getElementById('rd-msg');
  if(!g || !g.userId) return;
  var t = document.getElementById('rd-warn-text').value.trim();
  if(t.length < 5) return flash(msg, 'Escribe el aviso (mínimo 5 caracteres).', true);
  if(await adminRpc('admin_warn_user', { p_user: g.userId, p_message: t }, 'Aviso enviado.')){
    document.getElementById('rd-warn-text').value = '';
    msg.style.display = 'none';
  }
});
document.getElementById('rd-block-send').addEventListener('click', async function(e){
  e.preventDefault();
  var g = currentGroup(), msg = document.getElementById('rd-msg');
  if(!g || !g.userId) return;
  if(reasonValue().length < 5) return flash(msg, 'Escribe el motivo del bloqueo (mínimo 5 caracteres).', true);
  if(await adminRpc('admin_block_user', { p_user: g.userId, p_hours: Number(document.getElementById('rd-block-hours').value), p_reason: reasonValue() }, 'Cuenta bloqueada.')){
    document.getElementById('rd-reason').value = '';
    msg.style.display = 'none';
  }
});
document.getElementById('rd-unblock').addEventListener('click', function(e){
  e.preventDefault();
  var g = currentGroup();
  if(g && g.userId) adminRpc('admin_block_user', { p_user: g.userId, p_hours: 0, p_reason: '' }, 'Bloqueo retirado.');
});
document.getElementById('rd-delete').addEventListener('click', function(e){
  e.preventDefault();
  var g = currentGroup(), msg = document.getElementById('rd-msg');
  if(!g || !g.userId) return;
  if(reasonValue().length < 5) return flash(msg, 'Escribe el motivo de la eliminación (mínimo 5 caracteres).', true);
  showConfirm('¿Eliminar definitivamente la cuenta de ' + g.name + '? Se borrarán también sus tareas, candidaturas y mensajes. Esta acción no se puede deshacer.', 'Eliminar cuenta', async function(){
    if(await adminRpc('admin_delete_user', { p_user: g.userId, p_reason: reasonValue() }, 'Cuenta eliminada.')){
      document.getElementById('rd-reason').value = '';
      goToView('reportes');
    }
  });
});
document.getElementById('rd-resolve-all').addEventListener('click', async function(e){
  e.preventDefault();
  var g = currentGroup();
  if(!g || needSb()) return;
  var pend = g.reports.filter(function(r){ return r.status === 'pendiente'; });
  for(var i = 0; i < pend.length; i++){
    var r = await sb.rpc('admin_resolve_report', { p_report: pend[i].id, p_status: 'resuelto' });
    if(r.error) return fail(r.error);
  }
  await loadAll();
});

// ================= CUENTAS: confirmación de correo y contraseña olvidada =================
var URL_HASH = (window.location && window.location.hash) || '';
var URL_SEARCH = (window.location && window.location.search) || '';
function parseAuthUrl(hash, search){
  var q = String(hash || '').replace(/^#/, '') + '&' + String(search || '').replace(/^\?/, '');
  var params = {};
  q.split('&').forEach(function(kv){
    if(!kv) return;
    var i = kv.indexOf('=');
    var k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1);
    try { params[k] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch(e){ params[k] = v; }
  });
  return { type: params.type || '', error: params.error_description || params.error || '', code: params.error_code || '' };
}
var AUTH_URL = parseAuthUrl(URL_HASH, URL_SEARCH);
var recoveryMode = AUTH_URL.type === 'recovery' && !AUTH_URL.error;
var pendingEmail = '';
function authRedirectUrl(){ return window.location.origin + window.location.pathname; }
function authError(e){
  var m = ((e && e.message) || '') + ' ' + ((e && e.code) || '');
  if(/already registered|user_already_exists/i.test(m)) return 'Ya existe una cuenta con ese correo.';
  if(/weak_password|should be at least|at least \d+ char/i.test(m)) return 'La contraseña es demasiado débil (mínimo 6 caracteres).';
  if(/invalid login credentials|invalid_credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if(/not confirmed|email_not_confirmed/i.test(m)) return 'Aún no has confirmado tu correo.';
  if(/rate limit|over_email_send_rate_limit|over_request_rate_limit|too many/i.test(m)) return 'Has hecho demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.';
  if(/same_password|different from the old/i.test(m)) return 'La nueva contraseña debe ser distinta de la actual.';
  if(/session missing|session_not_found|jwt expired|otp_expired|expired/i.test(m)) return 'El enlace ha caducado o ya se ha usado. Solicita uno nuevo.';
  if(/email_address_invalid|invalid.*email|email.*invalid/i.test(m)) return 'El correo no es válido.';
  if(/error sending|smtp|email_provider/i.test(m)) return 'No se pudo enviar el correo ahora mismo. Inténtalo más tarde.';
  return (e && e.message) || 'Algo ha fallado. Inténtalo de nuevo.';
}
function cooldown(btn, seconds, label){
  if(btn._cool) return;
  var left = seconds;
  btn._cool = true;
  btn.style.pointerEvents = 'none'; btn.style.opacity = '.6';
  btn.textContent = label + ' (' + left + ' s)';
  var id = setInterval(function(){
    left--;
    if(left <= 0){
      clearInterval(id);
      btn._cool = false; btn.style.pointerEvents = ''; btn.style.opacity = ''; btn.textContent = label;
    } else { btn.textContent = label + ' (' + left + ' s)'; }
  }, 1000);
}
function showPending(email){
  document.getElementById('pending-text').textContent = 'Hemos enviado un correo a ' + email + '. Pulsa el enlace que contiene para activar tu cuenta; después podrás usar la web.';
  document.getElementById('pending-msg').style.display = 'none';
  showAuthForm('pending');
  cooldown(document.getElementById('pending-resend'), 60, 'Reenviar correo');
}
async function resendConfirmation(btn, msgEl){
  if(needSb() || !pendingEmail || btn._cool) return;
  var label = btn.textContent;
  var r = await sb.auth.resend({ type: 'signup', email: pendingEmail, options: { emailRedirectTo: authRedirectUrl() } });
  if(r.error) return flash(msgEl, authError(r.error), true);
  flash(msgEl, 'Te hemos reenviado el correo de confirmación.', false);
  cooldown(btn, 60, label);
}
function handleAuthUrl(){
  var hadParams = !!(URL_HASH || URL_SEARCH);
  if(AUTH_URL.error){
    recoveryMode = false;
    goToView('login');
    document.getElementById('login-note').textContent = 'El enlace ha caducado o ya se ha usado. Si no puedes entrar, usa «¿Has olvidado tu contraseña?» o inicia sesión para reenviar el correo de confirmación.';
    toast('El enlace ha caducado o no es válido.', true);
  } else if(recoveryMode){
    if(currentUser){ goToView('login'); }
    else { recoveryMode = false; toast('El enlace no es válido o ha caducado. Solicita uno nuevo.', true); }
  } else if(AUTH_URL.type === 'signup' || AUTH_URL.type === 'email_change'){
    if(currentUser) toast('¡Correo confirmado! Tu cuenta ya está activa.', false);
  }
  if(hadParams && window.history && window.history.replaceState){ window.history.replaceState(null, '', window.location.pathname); }
}
document.getElementById('pending-resend').addEventListener('click', function(e){ e.preventDefault(); resendConfirmation(this, document.getElementById('pending-msg')); });
document.getElementById('pending-back').addEventListener('click', function(e){ e.preventDefault(); showAuthForm('login'); });
document.getElementById('login-resend').addEventListener('click', function(e){ e.preventDefault(); resendConfirmation(this, document.getElementById('login-error')); });
document.getElementById('show-forgot').addEventListener('click', function(e){
  e.preventDefault();
  document.getElementById('forgot-email').value = document.getElementById('login-email').value;
  document.getElementById('forgot-msg').style.display = 'none';
  showAuthForm('forgot');
});
document.getElementById('forgot-back').addEventListener('click', function(e){ e.preventDefault(); showAuthForm('login'); });
document.getElementById('forgot-form').addEventListener('submit', async function(e){
  e.preventDefault();
  var btn = document.getElementById('forgot-btn'), msg = document.getElementById('forgot-msg');
  if(needSb() || btn._cool) return;
  var r = await sb.auth.resetPasswordForEmail(document.getElementById('forgot-email').value.trim().toLowerCase(), { redirectTo: authRedirectUrl() });
  if(r.error) return flash(msg, authError(r.error), true);
  flash(msg, 'Si existe una cuenta con ese correo, te hemos enviado un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.', false);
  cooldown(btn, 60, 'Enviar enlace');
});
document.getElementById('reset-form').addEventListener('submit', async function(e){
  e.preventDefault();
  if(needSb()) return;
  var form = this, err = document.getElementById('reset-error');
  function bad(m){ flash(err, m, true); }
  var p1 = document.getElementById('reset-pass').value, p2 = document.getElementById('reset-pass2').value;
  if(p1.length < 6) return bad('La contraseña debe tener al menos 6 caracteres.');
  if(p1 !== p2) return bad('Las contraseñas no coinciden.');
  var r = await sb.auth.updateUser({ password: p1 });
  if(r.error){
    var m = authError(r.error);
    if(/caducado/.test(m)){
      recoveryMode = false; showAuthForm('forgot');
      return flash(document.getElementById('forgot-msg'), m, true);
    }
    return bad(m);
  }
  recoveryMode = false;
  form.reset();
  err.style.display = 'none';
  toast('Contraseña actualizada. Ya has iniciado sesión.', false);
  goToView('home');
});


function initPrivacy(){
  var html = document.getElementById('privacy-tpl').innerHTML;
  document.getElementById('reg-privacy-body').innerHTML = html;
  document.getElementById('privacy-modal-body').innerHTML = html;
  var ov = document.getElementById('privacy-overlay');
  document.getElementById('footer-privacy').addEventListener('click', function(e){ e.preventDefault(); ov.style.display = 'flex'; });
  document.getElementById('privacy-close').addEventListener('click', function(e){ e.preventDefault(); ov.style.display = 'none'; });
  ov.addEventListener('click', function(e){ if(e.target === ov) ov.style.display = 'none'; });
}

populateCategorySelects();
renderTasks();
renderMisTareas();
renderPendientes();
renderNavAccount();
renderContacto();
initPrivacy();
initBot();
initAuth();
setInterval(function(){ if(sb && !document.hidden) loadAll(); }, 60000);
