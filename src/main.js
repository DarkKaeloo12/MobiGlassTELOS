/* ════════════════════════════════════════════════════════════
   PERSISTENT STORAGE — window.storage avec fallback localStorage
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   AUTH — SYSTÈME CORPO TELOS
════════════════════════════════════════════════════════════ */
var ADMIN_ID = 'p_admin'; // DarkKaeloo admin
var SESSION = null; // { pid, name, isAdmin }

// ══ DISPATCHER GLOBAL — évite les problèmes de quotes dans les onclick ══════
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id     = btn.dataset.id   || '';
  const id2    = btn.dataset.id2  || '';
  e.stopPropagation();
  switch(action) {
    case 'cmd-status':  setCmdStatus(id, id2); break;
    case 'cmd-edit':    editCommande(id); break;
    case 'cmd-check':   checkCmdStock(id); break;
    case 'cmd-delete':  deleteCommande(id); break;
    case 'cmd-cancel':  cancelCommande(id); break;
    case 'obj-edit':    editObjectif(id); break;
    case 'obj-toggle':  toggleObjDone(id); break;
    case 'obj-delete':       deleteObjectif(id); break;
    case 'obj-check-stock':  refreshObjStockInfo(id).then(() => renderObjectifs()); break;
    case 'bp-remove-ing':    removeBpIngredient(id); break;
    case 'miss-accept':   acceptMission(id); break;
    case 'miss-complete': completeMission(id); break;
    case 'miss-validate': validateMission(id); break;
    case 'miss-reject':   rejectMission(id); break;
    case 'miss-delete':   deleteMission(id); break;
    case 'arm-select':    selectArmPlayer(id); break;
    case 'arm-edit':      openAddArmItem(id); break;
    case 'arm-cat-edit':  openArmCatEdit(id); break;
    case 'arm-del':       deleteArmItem(id, event?.target?.closest('[data-name]')?.dataset?.name||id); break;
    case 'bank-delete':  deleteBankTransaction(id); break;
  }
});

var PANELS_PUBLIC = ['hub', 'inscription'];
// Code d'accès Gestionnaire — modifiable par l'Admin
// SHA-256 de "TELOS-CORP-2956" (changeable via les paramètres admin)
var GESTIONNAIRE_CODE_KEY = 'telos-gestionnaire-code-hash';
var CORPO_ACCESS_CODE_KEY  = 'telos-corpo-access-code-hash';

async function getCorpoAccessHash() {
  const saved = await DB.get(CORPO_ACCESS_CODE_KEY);
  return saved || null; // null = pas de code défini → inscription libre
}

async function setCorpoAccessCode(plainCode) {
  const h = await sha256(plainCode);
  await DB.set(CORPO_ACCESS_CODE_KEY, h);
  return h;
}

async function verifyCorpoAccessCode(input) {
  const stored = await getCorpoAccessHash();
  if (!stored) return false; // Aucun code défini en DB → inscription bloquée
  if (!input || !input.trim()) return false;
  const inputHash = await sha256(input.trim());
  return inputHash === stored;
}
var _gestionnaireCodeHash = null;

async function getGestionnaireHash() {
  if (_gestionnaireCodeHash) return _gestionnaireCodeHash;
  // Charger depuis DB ou utiliser le hash par défaut
  const stored = await DB.get(GESTIONNAIRE_CODE_KEY);
  if (stored) { _gestionnaireCodeHash = stored; return stored; }
  // Hash par défaut : SHA-256("TELOS-CORP-2956")
  const defaultHash = await sha256('TELOS-CORP-2956');
  _gestionnaireCodeHash = defaultHash;
  return defaultHash;
}

async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function isLoggedIn()   { return SESSION !== null; }
function isAdmin()      { return SESSION && SESSION.isAdmin; }
function canEdit(pid)   { return SESSION && (SESSION.isAdmin || SESSION.pid === pid); }
function requireAuth(pid, callback) {
  if (canEdit(pid)) return true;
  openLoginModal(pid, callback);
  return false;
}
function canManageRoles() {
  if (!SESSION) return false;
  const p = players.find(x => x.id === SESSION.pid);
  return SESSION.isAdmin || p?.role === 'Gestionnaire';
}

// Peut éditer une commande EN COURS : Admin, Gestionnaire ou Lead
// Peut éditer une commande selon son statut et le rôle
function canEditCommande(c) {
  if (!SESSION || !c) return false;
  if (canManageRoles()) return true;
  const isOwner = (c.createdBy && c.createdBy === SESSION.pid) || (c.client && c.client === SESSION.pid);
  if (c.status === 'attente') return isOwner;
  return false;
}

function updateNavRessources() { updateAllNav(); }
function updateNavBanque() { updateAllNav(); }

function updateAllNav() {
  // Mapping nav-id → droit requis (null = toujours visible si connecté)
  const NAV_DROITS = {
    'nav-partners':   'partners',
    'nav-joueurs':    'ressource_par',
    'nav-armurerie':  'ressource_par',
    'nav-blueprints': 'blueprints',
    'nav-commandes':  'commandes',
    'nav-objectifs':  'objectifs',
    'nav-missions':   'missions',
    'nav-commerce':   'commerce',
    'nav-stocks':     'stocks',
    'nav-ressources': 'ressources',
    'nav-armurie':    'armurie',
    'nav-banque':     'banque',
    'nav-logs':       'logs',
  };

  // Onglets visibles même sans connexion
  const PUBLIC_NAV = [];

  Object.entries(NAV_DROITS).forEach(([navId, droit]) => {
    const el = document.getElementById(navId);
    if (!el) return;
    if (!SESSION) {
      el.style.display = PUBLIC_NAV.includes(navId) ? '' : 'none';
    } else {
      el.style.display = hasDroit(droit) ? '' : 'none';
    }
  });

  // Inscription visible uniquement si non connecté
  const elInsc = document.getElementById('nav-inscription');
  if (elInsc) elInsc.style.display = SESSION ? 'none' : '';
}

function setSession(player) {
  SESSION = { pid: player.id, name: player.name, isAdmin: player.isAdmin||false };
  renderAuthBar();
  // Afficher l'onglet RESSOURCES si Admin/Gestionnaire
  pushLog('system', 'SYSTEM', `Connexion établie : ${player.name} — Accès TELOS ${player.isAdmin?'ADMIN':'standard'}.`);
  if(document.getElementById('panel-stocks').classList.contains('active')) renderStocksFromPlayers();
  renderMissions();
  updateNavRessources();
  updateNavBanque && updateNavBanque();
  const plSbOut = document.getElementById('pl-sidebar');
  if (plSbOut) plSbOut.style.display = 'none';
  renderObjectifs();
  // Masquer la sidebar joueurs — l'onglet Stock est personnel
  const plSb = document.getElementById('pl-sidebar');
  if (plSb) plSb.style.display = 'none';
  toast('Connexion établie', `Bienvenue, ${player.name} — Accès TELOS sécurisé.`, 'success');
  refreshStockPanel();
  // Recharger les blueprints cochés depuis la DB à chaque connexion
  loadPlayerOwnedBlueprints().then(() => renderBlueprints());
  // Recharger le panel actif si c'était un login wall
  setTimeout(()=>{ const _ap=document.querySelector('.panel.active'); if(_ap){ const _id=_ap.id.replace('panel-',''); if(!PANELS_PUBLIC.includes(_id)) goPanel(_id); }}, 50);
}

function logout() {
  SESSION = null;
  renderAuthBar();
  // Afficher login wall sur le panel actif si protégé
  const _apl = document.querySelector('.panel.active');
  if (_apl) { const _idl=_apl.id.replace('panel-',''); if(!PANELS_PUBLIC.includes(_idl)) showLoginWall(_apl, _idl); }
  pushLog('system', 'SYSTEM', 'Session TELOS fermée — déconnexion utilisateur.');
  renderMissions();
  updateNavRessources && updateNavRessources();
  updateNavBanque && updateNavBanque();
  const _sb = document.querySelector('.pl-sidebar');
  if (_sb) _sb.style.display = '';
  toast('Déconnexion', 'Session TELOS fermée.', 'info');
}

async function renderAuthBar() {
  const elName    = document.getElementById('sb-name');
  const elId      = document.getElementById('sb-id');
  const elRang    = document.getElementById('sb-rang');
  const elRes     = document.getElementById('sb-res');
  const elVal     = document.getElementById('sb-stock-val');
  const elAvatar  = document.getElementById('sb-avatar');
  const elRepFill = document.getElementById('sb-rep-fill');
  const elBtn     = document.getElementById('sb-auth-btn');

  if (SESSION) {
    const player = players.find(p => p.id === SESSION.pid);
    const stocks = player ? (await DB.get('uex-stocks-' + player.id)) || [] : [];
    const totalVal = stocks.reduce((a,s) => a + (s.price||0)*s.qty, 0);
    const totalRes = stocks.filter(s => (parseFloat(s.qty)||0) > 0).length;
    const rang     = SESSION.isAdmin ? 'ADMIN' : (player?.role || 'PARTENAIRE');
    const barPct   = Math.min(100, Math.round(totalRes / 20 * 100));

    if (elName)    elName.textContent    = SESSION.name.toUpperCase();
    if (elId)      elId.textContent      = 'ID : ' + (player?.id?.replace('p_','TELOS-') || '—');
    if (elRang) {
      elRang.textContent = rang.toUpperCase();
      elRang.style.color = SESSION.isAdmin ? '#ffffff' : 'var(--text)';
      elRang.style.fontWeight = SESSION.isAdmin ? '700' : '600';
    }
    if (elRes)     elRes.textContent     = totalRes + ' ressource' + (totalRes > 1 ? 's' : '');
    if (elVal)     elVal.textContent     = Math.round(totalVal).toLocaleString('fr-FR') + ' aUEC';
    if (elAvatar) {
      elAvatar.style.overflow = 'hidden';
      elAvatar.innerHTML = avHtml(player || SESSION.name, 44);
    }
    if (elRepFill) elRepFill.style.width = barPct + '%';
    if (elBtn) {
      elBtn.textContent = 'DÉCO';
      elBtn.style.borderColor = 'rgba(255,68,68,0.4)';
      elBtn.style.color = 'var(--red)';
    }
  } else {
    if (elName)    elName.textContent    = '—';
    if (elId)      elId.textContent      = 'ID : —';
    if (elRang)    elRang.textContent    = '—';
    if (elRes)     elRes.textContent     = '—';
    if (elVal)     elVal.textContent     = '—';
    if (elAvatar)  elAvatar.textContent  = '⬡';
    if (elRepFill) elRepFill.style.width = '0%';
    if (elBtn) {
      elBtn.textContent = 'CONNEXION';
      elBtn.style.borderColor = 'var(--orange)';
      elBtn.style.color = 'var(--orange)';
    }
  }
  updateNavRessources && updateNavRessources();
  updateNavBanque && updateNavBanque();
}


/* ════════════════════════════════════════════════════════════
   KPI STRIP — Source unique : valeurs exactes de renderStocksFromPlayers
════════════════════════════════════════════════════════════ */
function _pushKPI(valAchat, profit, nbRes, nbPartners) {
  const prevVal     = _kpiPrev.val;
  const prevProfit  = _kpiPrev.profit;
  const prevRes     = _kpiPrev.res;
  const prevPart    = _kpiPrev.partners;

  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const setD = (id, delta, unit) => {
    const el=document.getElementById(id); if(!el) return;
    if(delta===0){ el.textContent='—'; el.className='kpi-d'; return; }
    const sign = delta>0 ? '▲ +' : '▼ ';
    el.textContent = sign + Math.abs(Math.round(delta)).toLocaleString('fr-FR') + unit + ' (session)';
    el.className = 'kpi-d ' + (delta>0 ? 'up' : 'down');
  };

  set('kpi-stock',    Math.round(valAchat).toLocaleString('fr-FR') + ' aUEC');
  set('kpi-profit',   (profit>=0?'+':'') + Math.round(profit).toLocaleString('fr-FR') + ' aUEC');
  set('kpi-res',      nbRes.toLocaleString('fr-FR'));
  set('kpi-partners', String(nbPartners));

  const hasPrev = prevVal>0 || prevRes>0;
  if (hasPrev) {
    setD('kpi-res-d',      nbRes      - prevRes,   ' res.');
    setD('kpi-partners-d', nbPartners - prevPart,  ' partenaire'+(Math.abs(nbPartners-prevPart)>1?'s':''));
  }
  _kpiPrev = { val:valAchat, profit, res:nbRes, partners:nbPartners };
}

async function updateKPIs() {
  // Déclenche renderStocksFromPlayers qui calcule fA/fP et appelle _pushKPI
  await renderStocksFromPlayers();
}

// Valeurs de référence pour les deltas
var _kpiPrev = { val: 0, profit: 0, res: 0, partners: 0 };

/* ════════════════════════════════════════════════════════════
   HELPER — Rendu avatar universel
════════════════════════════════════════════════════════════ */
function avHtml(playerOrName, size=34) {
  const isObj  = typeof playerOrName === 'object' && playerOrName !== null;
  const name   = isObj ? playerOrName.name : playerOrName;
  const avatar = isObj ? playerOrName.avatar : null;
  const letter = name ? name.charAt(0).toUpperCase() : '⬡';
  if (avatar && avatar.startsWith('data:')) {
    return `<img src="${avatar}" style="width:${size}px;height:${size}px;max-width:${size}px;max-height:${size}px;object-fit:cover;display:block;position:relative;z-index:0;">`;
  }
  if (avatar && !avatar.startsWith('http')) {
    return `<span style="font-size:${Math.round(size*0.55)}px;line-height:1;">${avatar}</span>`;
  }
  return `<span style="font-size:${Math.round(size*0.5)}px;">${letter}</span>`;
}

/* ── Login Modal ── */
function openLoginModal(targetPid=null, afterAction=null) {
  _loginTarget = { pid: targetPid, action: afterAction };
  const overlay = document.getElementById('login-overlay');
  document.getElementById('login-name-sel').innerHTML =
    '<option value="">— Sélectionnez votre compte —</option>' +
    players.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  document.getElementById('login-code').value = '';
  document.getElementById('login-err').textContent = '';
  overlay.classList.add('open');
  setTimeout(()=>document.getElementById('login-code').focus(), 100);
}

function closeLoginModal() {
  document.getElementById('login-overlay').classList.remove('open');
  _loginTarget = null;
}


async function doLogin() {
  const pid  = document.getElementById('login-name-sel').value;
  const code = document.getElementById('login-code').value.trim();
  const err  = document.getElementById('login-err');
  err.textContent = '';

  if (!pid)  { err.textContent = 'Sélectionnez votre compte.'; return; }
  if (!code) { err.textContent = 'Entrez votre code corpo.'; return; }

  const player = players.find(p=>p.id===pid);
  if (!player) { err.textContent = 'Compte introuvable.'; return; }

  const hash = await sha256(code);
  if (hash !== player.codeHash) {
    err.textContent = '⚠ Code corpo incorrect. Accès refusé.';
    return;
  }

  setSession(player);
  closeLoginModal();
  // Si une action était en attente
  if (_loginTarget?.action) _loginTarget.action();
}

/* ════════════════════════════════════════════════════════════
   PERSISTANCE — Triple couche : localStorage + window.storage + export JSON
   Clé préfixée 'telos_' pour isoler les données TELOS
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   PERSISTANCE TOTALE — Données embarquées dans le fichier HTML
   Les données sont injectées dans le HTML au moment de la sauvegarde
   Téléchargez le fichier pour une sauvegarde complète et portable
════════════════════════════════════════════════════════════ */

// Données embarquées (injectées lors de la dernière sauvegarde)
/* ── Chargement depuis données embarquées + localStorage ── */
/* ── Export HTML avec données intégrées ── */
/* ── Auto-sauvegarde toutes les 5 minutes ── */
var _autoSaveTimer = null;

/* ════ DATABASE — Supabase ════ */
// SUPABASE_URL et SUPABASE_KEY définis dans config/config.js
let _sb=null;

// ── Supprime le faux warning DataCloneError généré par Supabase JS (postMessage + Headers) ──
(function() {
  const _origWarn = console.warn.bind(console);
  console.warn = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('DataCloneError') || msg.includes("Failed to execute 'postMessage'") || msg.includes('Headers object could not be cloned')) return;
    _origWarn(...args);
  };
  const _origError = console.error.bind(console);
  console.error = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('DataCloneError') || msg.includes("Failed to execute 'postMessage'") || msg.includes('Headers object could not be cloned')) return;
    _origError(...args);
  };
  // Intercepte aussi les erreurs non catchées liées à postMessage/Headers
  window.addEventListener('error', function(e) {
    if (e.message && (e.message.includes('DataCloneError') || e.message.includes('postMessage') || e.message.includes('Headers object could not be cloned'))) {
      e.preventDefault(); e.stopImmediatePropagation(); return false;
    }
  }, true);
})();

function getSB(){if(_sb)return _sb;try{const{createClient}=window.supabase;_sb=createClient(SUPABASE_URL,SUPABASE_KEY);}catch(e){}return _sb;}
// ══ SYSTÈME DE STOCKAGE — Supabase prioritaire, localStorage fallback ══════
// Sérialise proprement pour éviter DataCloneError
function _dbSerialize(v) {
  try { return JSON.parse(JSON.stringify(v)); }
  catch(e) { console.warn('[DB] Sérialisation échouée:', e?.message); return null; }
}

// Clé de marquage des entrées localStorage à synchroniser
var _DB_OFFLINE_KEY = 'telos_offline_pending';

function _dbMarkPending(k) {
  try {
    const pending = JSON.parse(localStorage.getItem(_DB_OFFLINE_KEY)||'[]');
    if (!pending.includes(k)) { pending.push(k); localStorage.setItem(_DB_OFFLINE_KEY, JSON.stringify(pending)); }
  } catch(e) {}
}
function _dbUnmarkPending(k) {
  try {
    const pending = JSON.parse(localStorage.getItem(_DB_OFFLINE_KEY)||'[]');
    const filtered = pending.filter(x=>x!==k);
    localStorage.setItem(_DB_OFFLINE_KEY, JSON.stringify(filtered));
  } catch(e) {}
}

// Sync automatique : vide le localStorage → Supabase quand la connexion est rétablie
async function syncLocalStorageToSupabase() {
  const sb = getSB();
  if (!sb) return;
  let pending = [];
  try { pending = JSON.parse(localStorage.getItem(_DB_OFFLINE_KEY)||'[]'); } catch(e) {}
  if (!pending.length) return;
  console.log('[DB] Sync offline → Supabase:', pending.length, 'entrées');
  const synced = [];
  for (const k of pending) {
    try {
      const raw = localStorage.getItem('telos_'+k);
      if (!raw) { synced.push(k); continue; }
      const v = JSON.parse(raw);
      const _v = _dbSerialize(v);
      if (_v === null) { synced.push(k); continue; }
      const { error } = await sb.from('telos_store').upsert(
        { key: k, value: _v, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (!error) {
        synced.push(k);
        // Effacer le localStorage une fois synchronisé
        try { localStorage.removeItem('telos_'+k); } catch(e) {}
      }
    } catch(e) { /* on réessaiera au prochain cycle */ }
  }
  // Retirer les clés synchronisées de la liste pending
  try {
    const stillPending = pending.filter(k => !synced.includes(k));
    localStorage.setItem(_DB_OFFLINE_KEY, JSON.stringify(stillPending));
    if (synced.length) console.log('[DB] Sync terminée:', synced.length, 'entrées uploadées, ', stillPending.length, 'restantes');
  } catch(e) {}
}

var DB = {
  // ── GET : Supabase d'abord, localStorage en fallback ──
  async get(k) {
    const sb = getSB();
    if (sb) {
      try {
        const { data, error } = await sb.from('telos_store').select('value').eq('key', k).maybeSingle();
        if (!error && data !== null && data !== undefined) {
          return data.value;
        }
      } catch(e) { /* fallback localStorage */ }
    }
    // Fallback localStorage
    try {
      const raw = localStorage.getItem('telos_'+k);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
  },

  // ── SET : Supabase d'abord, localStorage en fallback offline ──
  async set(k, v) {
    // Sérialiser proprement — évite DataCloneError
    const _v = _dbSerialize(v);
    if (_v === null) { console.warn('[DB.set] Données non sérialisables pour:', k); return; }
    const sb = getSB();
    if (sb) {
      try {
        const { error } = await sb.from('telos_store').upsert(
          { key: k, value: _v, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
        if (!error) {
          // Succès Supabase — pas besoin de localStorage
          _dbUnmarkPending(k);
          return;
        }
        console.warn('[DB.set] Erreur Supabase:', error.message);
      } catch(e) { /* fallback */ }
    }
    // Offline — écrire en localStorage et marquer pour sync future
    try {
      localStorage.setItem('telos_'+k, JSON.stringify(_v));
      _dbMarkPending(k);
    } catch(e) { console.warn('[DB.set] localStorage aussi indisponible:', e?.message); }
  },

  // ── DEL : Supabase + localStorage ──
  async del(k) {
    const sb = getSB();
    if (sb) { try { await sb.from('telos_store').delete().eq('key', k); } catch(e) {} }
    try { localStorage.removeItem('telos_'+k); _dbUnmarkPending(k); } catch(e) {}
  },

  // ── KEYS : Supabase d'abord ──
  async keys() {
    const sb = getSB();
    if (sb) {
      try {
        const { data } = await sb.from('telos_store').select('key');
        if (data) return data.map(r => r.key);
      } catch(e) {}
    }
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('telos_') && k !== _DB_OFFLINE_KEY) keys.push(k.slice(6));
    }
    return keys;
  }
};

// Lancer la sync localStorage → Supabase dès que possible
setTimeout(async () => {
  try { await syncLocalStorageToSupabase(); } catch(e) {}
}, 3000);
// Re-essayer toutes les 2 minutes si des entrées sont en attente
setInterval(async () => {
  try {
    const pending = JSON.parse(localStorage.getItem(_DB_OFFLINE_KEY)||'[]');
    if (pending.length) await syncLocalStorageToSupabase();
  } catch(e) {}
}, 120000);

/* Migration automatique localStorage → IndexedDB au premier lancement */

/* ════ STATIC DATA (dashboard demo) ════ */
var RESOURCES = [
  { name:'Quantanium', cat:'rare',    qty:120, buy:24.80, sell:42.10, delta:3.2,  loc:'Aaron Halo' },
  { name:'Titanium',   cat:'metal',   qty:340, buy:5.20,  sell:8.10,  delta:-0.4, loc:'Area18' },
  { name:'Bexalite',   cat:'rare',    qty:12,  buy:54.00, sell:71.20, delta:5.1,  loc:'New Babbage' },
  { name:'Taranite',   cat:'mineral', qty:95,  buy:12.50, sell:18.30, delta:1.8,  loc:'Lorville' },
  { name:'Agricium',   cat:'mineral', qty:60,  buy:20.00, sell:28.50, delta:-1.2, loc:'Orison' },
  { name:'Copper',     cat:'metal',   qty:180, buy:3.20,  sell:5.50,  delta:0.5,  loc:'Area18' },
  { name:'Corundum',   cat:'gas',     qty:220, buy:6.00,  sell:9.20,  delta:0.8,  loc:'Crusader' },
  { name:'Hephaestanite',cat:'gas',   qty:75,  buy:18.40, sell:25.10, delta:2.1,  loc:'Hurston' },
  { name:'Beryl',      cat:'mineral', qty:140, buy:9.80,  sell:14.60, delta:0.6,  loc:'microTech' },
];

var STATIC_PARTNERS = [
  { name:'DarkKaeloo',      id:'TELOS-0001', rank:'Fondateur',  credits:7842512, vol:1380000, trades:142, rep:95 },
  { name:'Yann4023',        id:'TELOS-0042', rank:'Partenaire', credits:2100450, vol:890000,  trades:87,  rep:78 },
  { name:'Kuro_Shinigami',  id:'TELOS-0107', rank:'Associé',    credits:890200,  vol:420000,  trades:34,  rep:62 },
  { name:'Volkov_Trade',    id:'TELOS-0198', rank:'Partenaire', credits:3450000, vol:1120000, trades:203, rep:88 },
  { name:'StarRunner99',    id:'TELOS-0215', rank:'Associé',    credits:650000,  vol:210000,  trades:19,  rep:55 },
  { name:'NightOwl_SCT',    id:'TELOS-0302', rank:'Partenaire', credits:1890000, vol:760000,  trades:91,  rep:81 },
];

// Missions stockées en DB — chargées au démarrage
var MISSIONS = [];

async function loadMissions() {
  const stored = await DB.get('telos-missions');
  if (stored && stored.length) {
    MISSIONS = stored;
  } else {
    // Missions par défaut au premier lancement
    MISSIONS = [
      { id:'m1', icon:'📦', title:'Livraison Titanium — Lorville', desc:'Transporter 340 unités de Titanium de Area18 vers Lorville avant le 25/05.', reward:'+272 000 aUEC', status:'open', dl:'25/05/2956', assignedTo:null, assignedName:null, createdAt:new Date().toISOString() },
      { id:'m2', icon:'💎', title:'Acquisition Bexalite Premium',  desc:'Obtenir 50 unités de Bexalite grade A sur New Babbage pour TradeFleet_Corp.', reward:'+518 000 aUEC', status:'open', dl:'28/05/2956', assignedTo:null, assignedName:null, createdAt:new Date().toISOString() },
      { id:'m3', icon:'🤝', title:'Contrat partenariat Volkov',    desc:'Négocier un contrat de distribution exclusif Quantanium avec Volkov_Trade.', reward:'+150 000 aUEC', status:'done', dl:'21/05/2956', assignedTo:null, assignedName:null, createdAt:new Date().toISOString() },
      { id:'m4', icon:'⚠️', title:'Stock critique — Laranite',     desc:'Réapprovisionner le stock de Laranite (actuellement <10 unités).', reward:'Éviter -320 000 aUEC', status:'open', dl:'24/05/2956', assignedTo:null, assignedName:null, createdAt:new Date().toISOString() },
    ];
    await DB.set('telos-missions', MISSIONS);
  }
  renderMissions();
}

async function saveMissions() {
  await DB.set('telos-missions', MISSIONS);
}

async function acceptMission(id) {
  if (!SESSION) { openLoginModal(null, ()=>acceptMission(id)); return; }
  const m = MISSIONS.find(x=>x.id===id);
  if (!m) return;
  if (m.status !== 'open') { toast('Mission indisponible','Cette mission n\'est plus disponible.','error'); return; }
  m.status = 'accepted';
  m.assignedTo = SESSION.pid;
  m.assignedName = SESSION.name;
  m.acceptedAt = new Date().toISOString();
  await saveMissions();
  renderMissions();
  pushActivity('📋', `${SESSION.name} a accepté la mission : ${m.title}`, m.reward, true);
  toast('Mission acceptée', m.title, 'success');
}

async function completeMission(id) {
  if (!SESSION) return;
  const m = MISSIONS.find(x=>x.id===id);
  if (!m || m.assignedTo !== SESSION.pid) return;
  m.status = 'pending_validation';
  m.completedAt = new Date().toISOString();
  await saveMissions();
  renderMissions();
  pushActivity('⏳', `${SESSION.name} a terminé la mission : ${m.title} — En attente de validation`, '', true);
  toast('Mission terminée', 'En attente de validation par un Admin ou Gestionnaire.', 'success');
}

async function validateMission(id) {
  if (!canManageRoles()) { toast('Accès refusé','Seuls les Admins et Gestionnaires peuvent valider.','error'); return; }
  const m = MISSIONS.find(x=>x.id===id);
  if (!m) return;
  m.status = 'done';
  m.validatedBy = SESSION.name;
  m.validatedAt = new Date().toISOString();
  await saveMissions();
  renderMissions();
  pushActivity('✅', `Mission validée : ${m.title} — ${m.assignedName||''}`, m.reward, true);
  pushLog('trade','TRADE',`Mission complétée et validée par ${SESSION.name} : "${m.title}" — Reward: ${m.reward}`);
  toast('Mission validée !', `${m.assignedName} a reçu : ${m.reward}`, 'success');
}

async function rejectMission(id) {
  if (!canManageRoles()) return;
  const m = MISSIONS.find(x=>x.id===id);
  if (!m) return;
  m.status = 'open';
  m.assignedTo = null; m.assignedName = null;
  delete m.completedAt; delete m.acceptedAt;
  await saveMissions();
  renderMissions();
  toast('Mission rejetée', 'La mission est de nouveau disponible.', 'info');
}

async function deleteMission(id) {
  const m = MISSIONS.find(x => x.id === id);
  if (!m || !confirm('Supprimer la mission "' + m.title + '" ?')) return;
  MISSIONS = MISSIONS.filter(x => x.id !== id);
  await saveMissions();
  renderMissions();
  toast('Mission supprimée', m.title, 'info');
  pushLog('system', 'ADMIN', 'Mission supprimée : ' + m.title);
}


/* ── Login Modal ── */

var LIVE_ACTIVITY = [];
var MAX_ACTIVITY = 20;

function pushActivity(icon, desc, amt, pos, logType) {
  LIVE_ACTIVITY.unshift({ icon, desc, amt, pos, ts: Date.now() });
  if (LIVE_ACTIVITY.length > MAX_ACTIVITY) LIVE_ACTIVITY.pop();
  renderActivity();
  // Pousser aussi dans les LOGS
  const type = logType || (icon === '⬡' ? 'partner' : icon === '⚠️' ? 'alert' : 'trade');
  const tl   = type.toUpperCase();
  const fullMsg = amt ? desc + (amt ? ' : ' + amt : '') : desc;
  pushLog(type, tl, fullMsg);
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return 'à l\'instant';
  if (diff < 3600) return 'il y a ' + Math.floor(diff/60) + ' min';
  if (diff < 86400) return 'il y a ' + Math.floor(diff/3600) + ' h';
  return 'il y a ' + Math.floor(diff/86400) + ' j';
}

// SYS_LOGS_DATA remplacé — le mini-log hub lit directement FULL_LOGS_DATA

var FULL_LOGS_DATA = []; // Alimenté en temps réel par les actions
var HISTORIQUE_DATA = []; // Persistant — commandes livrées/annulées + objectifs validés
var _histFilter = 'all';
var _currentLogTab = 'logs';

var BUYS  = [
  { res:'Gold',     qty:120, price:7.45,  total:894,  loc:'Lorville',    time:'il y a 25min' },
  { res:'Laranite', qty:50,  price:15.90, total:795,  loc:'Lorville',    time:'il y a 8h' },
  { res:'Beryl',    qty:140, price:9.80,  total:1372, loc:'microTech',   time:'il y a 1j' },
];
var SELLS = [
  { res:'Quantanium', qty:45,  price:31.70, total:1382, loc:'Area18',      time:'il y a 10min' },
  { res:'Titanium',   qty:200, price:8.10,  total:1620, loc:'Lorville',    time:'il y a 1h' },
];
var ROUTES = [
  { from:'Lorville',    to:'Area18',      res:'Quantanium', margin:'+27.8%', profit:'+6.90/u' },
  { from:'New Babbage', to:'Lorville',    res:'Diamond',    margin:'+44.8%', profit:'+14.80/u' },
  { from:'Orison',      to:'New Babbage', res:'Gold',       margin:'+69.1%', profit:'+5.15/u' },
  { from:'New Babbage', to:'Orison',      res:'Hephaestanite', margin:'+36.4%', profit:'+6.70/u' },
];
var OPPS = [
  { res:'Bexalite', desc:'Prix en hausse +5.1% — acheter maintenant', action:'ACHETER',    color:'var(--green)' },
  { res:'Titanium', desc:'Stock bas à New Babbage — opportunité vente', action:'VENDRE',   color:'var(--blue)' },
  { res:'Laranite', desc:'Réapprovisionnement urgent (<10 restantes)', action:'URGENT',    color:'var(--orange)' },
];

/* ════════════════════════════════════════════════════════════
   PLAYERS STATE
════════════════════════════════════════════════════════════ */
var players     = [];
var selectedPid = null;
var confirmCb   = null;
var stockCat    = 'all';
var stockSort   = { k:'profit', d:-1 };

/* ════════════════════════════════════════════════════════════
   CLOCK
════════════════════════════════════════════════════════════ */
function pad(v){ return String(v).padStart(2,'0'); }
function tick(){
  const n = new Date();
  document.getElementById('clock').textContent    = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  document.getElementById('dateline').textContent = `${pad(n.getDate())} / ${pad(n.getMonth()+1)} / 2956`;
}


/* ════════════════════════════════════════════
   STANTON MAP — v6 : positions exactes calées sur carte SC 3.9.1
   Tout fixe. Vue Commerce = interactive.
════════════════════════════════════════════ */
var mapView = 'global';
var mapCanvas, mapCtx, mapW, mapH;
var mapAnim = 0;
var hoveredPlanet = null;

/*
  MÉTHODOLOGIE :
  Image SC 3.9.1 = 1453×780px. Centre Stanton mesuré = (548,391).
  Chaque position mesurée en pixels → convertie en fx=(off_x)/(IW/2), fy=(off_y)/(IH/2).
  Scale global 0.52 appliqué dans pFixed() pour que microTech reste dans le canvas.
  
  Satellites (lunes/stations) : ao (angle en rad depuis la droite, sens trigo standard)
  et dr (distance en fraction de W du canvas, calculée depuis les pixels image).
  H/W ratio image = 780/1453 = 0.537 utilisé pour corriger l'aspect ratio.

  ORBITES SYSTÈME : ellipses 3D inclinées à -12° (ORBIT_TILT).
  Ratio ry/rx = 0.615 (perspective ~51° de hauteur).
  Radii mesurés sur l'image (fraction de IW) :
    Hurston  ≈ 0.116, Crusader ≈ 0.213, ArcCorp ≈ 0.317, microTech ≈ 0.427
*/

var ORBIT_TILT  = Math.PI * (-0.068);  // -12.24°
var ORBIT_RATIO = 0.615;

var SYSTEM_ORBITS = [
  { ratio:0.190, col:'rgba(90,135,195,0.50)', lw:1.1 }, // Hurston
  { ratio:0.286, col:'rgba(90,135,195,0.48)', lw:1.0 }, // Crusader
  { ratio:0.538, col:'rgba(90,135,195,0.42)', lw:0.95}, // ArcCorp
  { ratio:0.894, col:'rgba(90,135,195,0.36)', lw:0.9 }, // microTech
];

// Planètes — fx/fy mesurés sur image (fraction de IW/2 et IH/2)
var PLANETS = [
  {
    name:'HURSTON', sub:'Lorville',
    fx:+0.1374, fy:+0.2328,
    r:22,
    col1:'#e8834a', col2:'#b5471c', col3:'#7a2d0e', col4:'#2a0e04',
    atmo:'rgba(220,100,50,0.16)', glow:'rgba(200,90,40,0.32)',
    moonOrbit:{ rx:0.060, col:'rgba(200,220,240,0.45)', lw:0.7 },
    stocks:15, partners:8
  },
  {
    name:'CRUSADER', sub:'Orison',
    fx:-0.1648, fy:-0.4167,
    r:26,
    col1:'#f0cc70', col2:'#c8952a', col3:'#8a5e0a', col4:'#3a2502',
    atmo:'rgba(240,200,80,0.18)', glow:'rgba(220,170,60,0.38)',
    moonOrbit:{ rx:0.065, col:'rgba(200,220,240,0.45)', lw:0.7 },
    stocks:9, partners:4
  },
  {
    name:'ARCORP', sub:'Area 18',
    fx:-0.4052, fy:+0.6324,
    r:22,
    col1:'#7aa8e8', col2:'#3a68c0', col3:'#1a3880', col4:'#05091e',
    atmo:'rgba(80,130,240,0.18)', glow:'rgba(60,110,220,0.32)',
    moonOrbit:{ rx:0.055, col:'rgba(200,220,240,0.45)', lw:0.7 },
    stocks:14, partners:7
  },
  {
    name:'MICROTECH', sub:'New Babbage',
    fx:+0.8379, fy:-0.5564,
    r:22,
    col1:'#d0e8f8', col2:'#88b8d8', col3:'#3870a0', col4:'#0c2030',
    atmo:'rgba(150,200,255,0.20)', glow:'rgba(120,180,240,0.32)',
    moonOrbit:{ rx:0.055, col:'rgba(200,220,240,0.45)', lw:0.7 },
    stocks:12, partners:6
  },
];

/*
  ao = angle en radians (atan2 depuis centre planète, déjà corrigé ratio H/W)
  dr = distance en fraction de W du canvas
  Valeurs calculées depuis pixels image SC 3.9.1
*/
var MOONS = [
  // Hurston
  { name:'Aberdeen', pi:0, ao:-1.7735, dr:0.0620, moonR:7, col1:'#b8c0c8', col2:'#383e44' },
  { name:'Arial',    pi:0, ao:+1.9456, dr:0.0560, moonR:7, col1:'#c0b8a8', col2:'#3c3428' },
  { name:'Ita',      pi:0, ao:+2.8064, dr:0.0900, moonR:7, col1:'#a8b0b8', col2:'#2c3038' },
  { name:'Magda',    pi:0, ao:+2.3889, dr:0.0680, moonR:7, col1:'#b0a898', col2:'#302820' },
  // Crusader
  { name:'Cellin',   pi:1, ao:-3.0433, dr:0.0820, moonR:7, col1:'#c8d0b0', col2:'#344020' },
  { name:'Daymar',   pi:1, ao:-2.7806, dr:0.0650, moonR:7, col1:'#d0c8b8', col2:'#403830' },
  { name:'Yela',     pi:1, ao:+2.9139, dr:0.0780, moonR:7, col1:'#b8c0c8', col2:'#2a3038' },
  // ArcCorp
  { name:'Wala',     pi:2, ao:-0.4636, dr:0.0480, moonR:7, col1:'#c0b0a0', col2:'#302018' },
  { name:'Lyria',    pi:2, ao:+2.5076, dr:0.0560, moonR:7, col1:'#a8b8c8', col2:'#182030' },
  // MicroTech
  { name:'Calliope', pi:3, ao:-0.9328, dr:0.0520, moonR:7, col1:'#d8e0f0', col2:'#2a3040' },
  { name:'Clio',     pi:3, ao:-0.2625, dr:0.0500, moonR:7, col1:'#c8d8e8', col2:'#182030' },
  { name:'Euterpe',  pi:3, ao:+2.2719, dr:0.0620, moonR:7, col1:'#d0c8d8', col2:'#282030' },
];

var STATIONS = [
  // Hurston — L-points + Everus Harbor
  { name:'HUR-L1',        pi:0, ao:-2.948, dr:0.115 },
  { name:'HUR-L2',        pi:0, ao:-0.283, dr:0.125 },
  { name:'HUR-L3',        pi:0, ao:-1.826, dr:0.160 },
  { name:'HUR-L4 R&R',    pi:0, ao:-0.895, dr:0.138 },
  { name:'HUR-L5',        pi:0, ao:+3.092, dr:0.195 },
  { name:'Everus Harbor', pi:0, ao:+2.950, dr:0.058 },
  // Crusader — stations + Port Olisar + GrimHEX
  { name:'Sec. Post Kareah', pi:1, ao:-3.008, dr:0.098 },
  { name:'Port Olisar',   pi:1, ao:-3.142, dr:0.148 },
  { name:'GrimHEX',       pi:1, ao:+2.917, dr:0.105 },
  { name:'CRU-L1',        pi:1, ao:+2.262, dr:0.038 },
  { name:'CRU-L3',        pi:1, ao:+1.444, dr:0.195 },
  { name:'CRU-L4',        pi:1, ao:+2.544, dr:0.175 },
  { name:'CRU-L5',        pi:1, ao:+0.057, dr:0.195 },
  { name:'Covalex Hub',   pi:1, ao:-2.704, dr:0.055 },
  // ArcCorp
  { name:'Baijini Point', pi:2, ao:+3.110, dr:0.032 },
  { name:'ARC-L1',        pi:2, ao:-2.661, dr:0.115 },
  { name:'ARC-L2',        pi:2, ao:+1.102, dr:0.070 },
  { name:'ARC-L3',        pi:2, ao:-0.881, dr:0.285 },
  { name:'ARC-L4',        pi:2, ao:-1.990, dr:0.290 },
  { name:'ARC-L5',        pi:2, ao:-1.958, dr:0.295 },
  // MicroTech
  { name:'Port Tressler', pi:3, ao:+0.134, dr:0.068 },
  { name:'MIC-L1',        pi:3, ao:-2.719, dr:0.092 },
];

var tradeRoutes = [];

// ── Géométrie ──────────────────────────────────────────────────────

// Position fixe d'une planète dans le canvas
// Scale 0.52 pour que microTech (fx≈0.89) reste visible
function pFixed(pi, W, H) {
  const p = PLANETS[pi];
  return { x: W/2 + p.fx*(W/2)*0.755, y: H/2 + p.fy*(H/2)*0.755 };
}

// Position fixe d'un satellite autour de sa planète
// ao  = angle précalculé (rad), dr = fraction de W
function satPosFixed(pi, ao, dr, W, H) {
  const pp = pFixed(pi, W, H);
  return { x: pp.x + Math.cos(ao)*dr*W, y: pp.y + Math.sin(ao)*dr*W };
}

// Ellipse 3D inclinée (orbite système ou orbite lune)
function drawEllipse3D(ctx, cx, cy, rxPx, col, lw) {
  const ry = rxPx * ORBIT_RATIO;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(ORBIT_TILT);
  // Aura
  ctx.strokeStyle = col.replace(/[\d.]+\)$/, s => Math.min(1,parseFloat(s)*0.30).toFixed(2)+')');
  ctx.lineWidth = lw * 4; ctx.setLineDash([]);
  ctx.beginPath(); ctx.ellipse(0,0,rxPx,ry,0,0,Math.PI*2); ctx.stroke();
  // Trait principal
  ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.ellipse(0,0,rxPx,ry,0,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

// Planète 3D (illumination haut-gauche)
function drawPlanet3D(ctx, x, y, r, c1, c2, c3, c4) {
  const lx=x-r*0.38, ly=y-r*0.38;
  const g=ctx.createRadialGradient(lx,ly,r*0.04,x,y,r);
  g.addColorStop(0,c1); g.addColorStop(0.35,c2); g.addColorStop(0.70,c3); g.addColorStop(1,c4);
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  const sp=ctx.createRadialGradient(lx+r*0.04,ly+r*0.04,0,lx,ly,r*0.52);
  sp.addColorStop(0,'rgba(255,255,255,0.42)'); sp.addColorStop(0.3,'rgba(255,255,255,0.10)'); sp.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sp; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  const sh=ctx.createRadialGradient(x+r*0.28,y+r*0.28,r*0.08,x,y,r);
  sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(0.52,'rgba(0,0,0,0.18)'); sh.addColorStop(1,'rgba(0,0,0,0.68)');
  ctx.fillStyle=sh; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=0.8; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
}

// Lune 3D miniature
function drawMoon3D(ctx, x, y, r, c1, c2) {
  const lx=x-r*0.35,ly=y-r*0.35;
  const g=ctx.createRadialGradient(lx,ly,0,x,y,r);
  g.addColorStop(0,c1); g.addColorStop(0.65,c2); g.addColorStop(1,'#0d1018');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  const sh=ctx.createRadialGradient(x+r*0.22,y+r*0.22,0,x,y,r);
  sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(0.58,'rgba(0,0,0,0.22)'); sh.addColorStop(1,'rgba(0,0,0,0.60)');
  ctx.fillStyle=sh; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
}

// ── Init ──────────────────────────────────────────────────────────

function initMap(canvas) {
  if (!canvas) return;
  canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
  mapCanvas=canvas; mapCtx=canvas.getContext('2d');
  mapW=canvas.width; mapH=canvas.height;
  tradeRoutes=[[0,1],[1,2],[2,3],[3,0],[0,2],[3,1]];
  canvas.addEventListener('mousemove', e=>{
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    hoveredPlanet=null;
    PLANETS.forEach((_,i)=>{
      const pp=pFixed(i,mapW,mapH);
      if(Math.hypot(mx-pp.x,my-pp.y)<PLANETS[i].r+14) hoveredPlanet=i;
    });
    canvas.style.cursor=hoveredPlanet!==null?'pointer':'default';
  });
}

function orbitPos(pi,ao,dr,t,W,H){ return satPosFixed(pi,ao,dr,W,H); }

// ── Draw ──────────────────────────────────────────────────────────

function drawMap(canvas, ctx, t) {
  if(!ctx) return;
  const W=canvas.width, H=canvas.height;
  const S=Math.min(W,H); // Référence carrée pour éviter la déformation
  ctx.clearRect(0,0,W,H);

  // ══ FOND NOIR BLEUTÉ ════════════════════════════════════════════
  const bgG=ctx.createRadialGradient(W*0.42,H*0.40,0,W*0.42,H*0.40,Math.max(W,H)*0.80);
  bgG.addColorStop(0,'#0c1220'); bgG.addColorStop(0.35,'#080c18');
  bgG.addColorStop(0.65,'#04070e'); bgG.addColorStop(1,'#010308');
  ctx.fillStyle=bgG; ctx.fillRect(0,0,W,H);
  // Nuées
  const nb1=ctx.createLinearGradient(0,H*0.25,W,H*0.75);
  nb1.addColorStop(0,'rgba(15,25,60,0)'); nb1.addColorStop(0.45,'rgba(28,44,88,0.16)');
  nb1.addColorStop(0.55,'rgba(32,50,95,0.22)'); nb1.addColorStop(1,'rgba(15,25,60,0)');
  ctx.fillStyle=nb1; ctx.fillRect(0,0,W,H);
  const nb2=ctx.createRadialGradient(W*0.70,H*0.25,0,W*0.70,H*0.25,W*0.40);
  nb2.addColorStop(0,'rgba(18,32,75,0.13)'); nb2.addColorStop(0.5,'rgba(12,22,55,0.06)'); nb2.addColorStop(1,'rgba(8,15,40,0)');
  ctx.fillStyle=nb2; ctx.fillRect(0,0,W,H);

  // ── Zoom / pan ──
  const _sc = canvas._mapScale || 1;
  const _ox = canvas._mapOffX  || 0;
  const _oy = canvas._mapOffY  || 0;
  ctx.save();
  ctx.translate(W/2 + _ox, H/2 + _oy);
  ctx.scale(_sc, _sc);
  ctx.translate(-W/2, -H/2);

  // ══ ÉTOILES (4 couches) ══════════════════════════════════════════
  for(let i=0;i<500;i++){
    const sx=((Math.sin(i*31.41+7)*0.5+0.5)*W)|0, sy=((Math.sin(i*17.23+7)*0.5+0.5)*H)|0;
    const a=0.05+0.18*(Math.sin(i*7.3+t*0.0004)*0.5+0.5);
    ctx.fillStyle=`rgba(180,200,255,${a})`; ctx.fillRect(sx,sy,0.6,0.6);
  }
  for(let i=0;i<300;i++){
    const sx=((Math.sin(i*27.41+13)*0.5+0.5)*W)|0, sy=((Math.sin(i*13.73+13)*0.5+0.5)*H)|0;
    const a=0.10+0.35*(Math.sin(i*5.17+t*0.0005)*0.5+0.5);
    ctx.fillStyle=`rgba(200,215,255,${a})`;
    ctx.beginPath(); ctx.arc(sx,sy,0.8,0,Math.PI*2); ctx.fill();
  }
  for(let i=0;i<90;i++){
    const sx=((Math.sin(i*43.17+21)*0.5+0.5)*W)|0, sy=((Math.sin(i*19.31+21)*0.5+0.5)*H)|0;
    const a=0.20+0.52*(Math.sin(i*3.81+t*0.0006)*0.5+0.5);
    ctx.fillStyle=`rgba(215,228,255,${a})`;
    ctx.beginPath(); ctx.arc(sx,sy,1.1,0,Math.PI*2); ctx.fill();
  }
  for(let i=0;i<28;i++){
    const sx=((Math.sin(i*71.3+31)*0.5+0.5)*W)|0, sy=((Math.sin(i*37.9+31)*0.5+0.5)*H)|0;
    const a=0.55+0.42*(Math.sin(i*2.3+t*0.0008)*0.5+0.5);
    ctx.fillStyle=`rgba(240,245,255,${a})`;
    ctx.beginPath(); ctx.arc(sx,sy,1.35,0,Math.PI*2); ctx.fill();
    if(i%4===0){
      ctx.strokeStyle=`rgba(200,220,255,${a*0.30})`; ctx.lineWidth=0.55; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(sx-5,sy); ctx.lineTo(sx+5,sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx,sy-5); ctx.lineTo(sx,sy+5); ctx.stroke();
    }
  }

  const cx=W/2, cy=H/2;

  // ══ ORBITES SYSTÈME BLEUES (ellipses 3D) ═════════════════════════
  SYSTEM_ORBITS.forEach(o=>{
    drawEllipse3D(ctx, cx, cy, o.ratio*S, o.col, o.lw);
  });

  // ══ ROUTES COMMERCIALES (vue Commerce uniquement) ═════════════════
  const ppos=PLANETS.map((_,i)=>pFixed(i,W,H));
  if(mapView==='commerce'){
    const RC=['rgba(247,140,30,0.45)','rgba(0,255,163,0.35)','rgba(89,208,255,0.32)','rgba(220,100,255,0.30)','rgba(255,200,0,0.40)','rgba(180,100,255,0.50)'];
    const RN=[['HURSTON','CRUSADER'],['CRUSADER','ARCORP'],['ARCORP','MICROTECH'],['MICROTECH','HURSTON'],['HURSTON','ARCORP'],['MICROTECH','CRUSADER']];
    tradeRoutes.forEach(([a,b],ri)=>{
      const ax=ppos[a].x,ay=ppos[a].y,bx=ppos[b].x,by=ppos[b].y;
      ctx.save();
      ctx.strokeStyle=RC[ri]; ctx.lineWidth=1.4; ctx.setLineDash([8,12]);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      ctx.setLineDash([]);
      const p1=(t*0.00024+ri*0.2)%1;
      ctx.fillStyle=RC[ri].replace(/[\d.]+\)$/,'0.95)');
      ctx.beginPath(); ctx.arc(ax+(bx-ax)*p1,ay+(by-ay)*p1,3,0,Math.PI*2); ctx.fill();
      const p2=(t*0.00024+ri*0.2+0.5)%1;
      ctx.beginPath(); ctx.arc(ax+(bx-ax)*p2,ay+(by-ay)*p2,1.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(247,140,30,0.68)'; ctx.font=`6.5px 'Share Tech Mono',monospace`; ctx.textAlign='center';
      ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=3;
      if(RN[ri]) ctx.fillText(RN[ri].join(' → '),(ax+bx)/2,(ay+by)/2-7);
      ctx.restore();
    });
  }

  // ══ SOLEIL STANTON ════════════════════════════════════════════════
  const sR=15  ;
  const gSO=ctx.createRadialGradient(cx,cy,sR*0.4,cx,cy,sR*7.5);
  gSO.addColorStop(0,'rgba(255,190,50,0.28)'); gSO.addColorStop(0.35,'rgba(255,140,10,0.10)');
  gSO.addColorStop(0.65,'rgba(255,100,0,0.04)'); gSO.addColorStop(1,'transparent');
  ctx.fillStyle=gSO; ctx.beginPath(); ctx.arc(cx,cy,sR*7.5,0,Math.PI*2); ctx.fill();
  const gS=ctx.createRadialGradient(cx-sR*0.32,cy-sR*0.32,0,cx,cy,sR);
  gS.addColorStop(0,'#fffef0'); gS.addColorStop(0.2,'#fff8a0');
  gS.addColorStop(0.55,'#ffcc30'); gS.addColorStop(0.82,'#ff9010'); gS.addColorStop(1,'#c04800');
  ctx.fillStyle=gS; ctx.beginPath(); ctx.arc(cx,cy,sR,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,205,60,0.22)'; ctx.lineWidth=4.5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(cx,cy,sR+4+Math.sin(t*0.0018)*2.5,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(255,165,30,0.09)'; ctx.lineWidth=9;
  ctx.beginPath(); ctx.arc(cx,cy,sR+9+Math.sin(t*0.0013)*3.5,0,Math.PI*2); ctx.stroke();
  ctx.save(); ctx.textAlign='center'; ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=5;
  ctx.fillStyle='rgba(255,245,150,0.72)'; ctx.font=`bold 11px 'Share Tech Mono',monospace`;
  ctx.fillText('Stanton',cx,cy+sR+17); ctx.restore();

  // ══ PLANÈTES avec orbites-lunes, lunes, stations ══════════════════
  PLANETS.forEach((p,i)=>{
    const pp=pFixed(i,W,H);
    const px=pp.x, py=pp.y;
    const hov=hoveredPlanet===i;

    // ── Orbite des lunes (ellipse 3D blanche-bleutée) ──
    if(p.moonOrbit){
      drawEllipse3D(ctx, px, py, p.moonOrbit.rx*W, p.moonOrbit.col, p.moonOrbit.lw);
    }

    // ── Lunes (FIXES) ──
    MOONS.filter(m=>m.pi===i).forEach(m=>{
      const mp=satPosFixed(i,m.ao,m.dr,W,H);
      drawMoon3D(ctx,mp.x,mp.y,m.moonR,m.col1,m.col2);
      ctx.save(); ctx.textAlign='center';
      ctx.fillStyle='rgba(155,175,200,0.85)'; ctx.font=`6.5px 'Share Tech Mono',monospace`;
      ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=3;
      ctx.fillText(m.name,mp.x,mp.y-m.moonR-4);
      ctx.restore();
    });

    // ── Stations (FIXES, croix × cyan) ──
    STATIONS.filter(s=>s.pi===i).forEach(s=>{
      const sp=satPosFixed(i,s.ao,s.dr,W,H);
      const r=4.5;
      ctx.save();
      ctx.strokeStyle='rgba(89,208,255,0.18)'; ctx.lineWidth=7; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(sp.x-r,sp.y); ctx.lineTo(sp.x+r,sp.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sp.x,sp.y-r); ctx.lineTo(sp.x,sp.y+r); ctx.stroke();
      ctx.strokeStyle='rgba(89,208,255,0.92)'; ctx.lineWidth=1.3;
      ctx.beginPath(); ctx.moveTo(sp.x-r,sp.y); ctx.lineTo(sp.x+r,sp.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sp.x,sp.y-r); ctx.lineTo(sp.x,sp.y+r); ctx.stroke();
      ctx.fillStyle='rgba(89,208,255,0.80)'; ctx.font=`6.5px 'Share Tech Mono',monospace`;
      ctx.textAlign='center'; ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=3;
      ctx.fillText(s.name,sp.x,sp.y-r-4);
      ctx.restore();
    });

    // ── Glow planète ──
    const gr=ctx.createRadialGradient(px,py,p.r*0.4,px,py,p.r*(hov?3.6:2.6));
    gr.addColorStop(0,p.glow); gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(px,py,p.r*(hov?3.6:2.6),0,Math.PI*2); ctx.fill();

    // ── Corps planète 3D ──
    drawPlanet3D(ctx,px,py,p.r,p.col1,p.col2,p.col3,p.col4);

    // ── Atmosphère ──
    if(p.atmo){
      const atm=ctx.createRadialGradient(px,py,p.r*0.82,px,py,p.r*1.28);
      atm.addColorStop(0,p.atmo); atm.addColorStop(1,'transparent');
      ctx.fillStyle=atm; ctx.beginPath(); ctx.arc(px,py,p.r*1.28,0,Math.PI*2); ctx.fill();
    }

    // ── Hover ring ──
    if(hov){
      ctx.save(); ctx.strokeStyle='rgba(247,140,30,0.85)'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(px,py,p.r+6+Math.sin(t*0.005)*2,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // ── Labels ──
    ctx.save(); ctx.textAlign='center';
    ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=5;
    ctx.fillStyle=hov?'#f78c1e':'#d8eaf8';
    ctx.font=`bold ${hov?13:11}px 'Rajdhani',sans-serif`;
    ctx.fillText(p.name,px,py-p.r-6);
    ctx.fillStyle='rgba(130,165,200,0.82)'; ctx.font=`7.5px 'Share Tech Mono',monospace`;
    ctx.fillText(p.sub,px,py-p.r-15);
    ctx.shadowBlur=0;
    if(hov||mapView==='commerce'){
      ctx.fillStyle='rgba(0,255,163,0.90)'; ctx.font=`7.5px 'Share Tech Mono',monospace`;
      ctx.fillText(`S:${p.stocks}  P:${p.partners}`,px,py+p.r+16);
    }
    ctx.restore();
  });

  // ══ DELAMAR (asteroïde) ══════════════════════════════════════════
  {
    const DX = W/2 + 0.522*(W/2)*0.755;
    const DY = H/2 + (-0.042)*(H/2)*0.755;
    // Halo
    const dg = ctx.createRadialGradient(DX,DY,0,DX,DY,16);
    dg.addColorStop(0,'rgba(160,140,120,0.35)'); dg.addColorStop(1,'transparent');
    ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(DX,DY,16,0,Math.PI*2); ctx.fill();
    // Corps asteroïde (irrégulier)
    ctx.save();
    ctx.fillStyle='#8a7a68';
    ctx.beginPath();
    ctx.ellipse(DX,DY,9,6,0.4,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle='rgba(180,160,140,0.4)'; ctx.lineWidth=0.7;
    ctx.stroke();
    ctx.restore();
    // Label
    ctx.save(); ctx.textAlign='center';
    ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=4;
    ctx.fillStyle='#c8b89a'; ctx.font=`bold 10px 'Rajdhani',sans-serif`;
    ctx.fillText('DELAMAR',DX,DY-13);
    ctx.fillStyle='rgba(150,135,115,0.80)'; ctx.font=`7px 'Share Tech Mono',monospace`;
    ctx.fillText('Levski',DX,DY-5);
    ctx.restore();
    // Station Levski (croix cyan)
    const LX=DX+18, LY=DY-4, r=3.5;
    ctx.save();
    ctx.strokeStyle='rgba(89,208,255,0.85)'; ctx.lineWidth=1.2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(LX-r,LY); ctx.lineTo(LX+r,LY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(LX,LY-r); ctx.lineTo(LX,LY+r); ctx.stroke();
    ctx.fillStyle='rgba(89,208,255,0.75)'; ctx.font=`6px 'Share Tech Mono',monospace`;
    ctx.textAlign='center'; ctx.fillText('Levski',LX,LY-r-3);
    ctx.restore();
  }

  ctx.restore(); // ── fin zoom/pan ──

  // ══ LÉGENDE (hors zoom) ════════════════════════════════════════════
  const leg=[
    {sym:'×',  col:'rgba(89,208,255,0.92)', label:'Station'},
    {sym:'○',  col:'rgba(200,220,240,0.80)',label:'Lune'},
    {sym:'●',  col:'#6a9ccc',              label:'Planète'},
    {sym:'◯',  col:'rgba(200,220,240,0.55)',label:'Orbite lune'},
    {sym:'──', col:'rgba(90,135,195,0.55)', label:'Orbite'},
    {sym:'--', col:'rgba(247,140,30,0.78)', label:'Route comm.'},
  ];
  ctx.save();
  ctx.fillStyle='rgba(4,7,16,0.70)';
  ctx.fillRect(0,H-24,leg.length*106+12,24);
  leg.forEach((item,i)=>{
    ctx.fillStyle=item.col; ctx.font=`bold 8.5px 'Share Tech Mono',monospace`; ctx.textAlign='left';
    ctx.fillText(`${item.sym} ${item.label}`,8+i*106,H-9);
  });
  ctx.restore();
}

function lighten(hex, pct) {
  let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  r=Math.min(255,r+pct); g=Math.min(255,g+pct); b=Math.min(255,b+pct);
  return `rgb(${r},${g},${b})`;
}
function darken(hex, pct) {
  let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  r=Math.max(0,r-pct); g=Math.max(0,g-pct); b=Math.max(0,b-pct);
  return `rgb(${r},${g},${b})`;
}

function setMapView(v) {
  mapView = v;
  document.getElementById('btn-global').classList.toggle('active', v==='global');
  document.getElementById('btn-commerce').classList.toggle('active', v==='commerce');
}
var mapScale=1, mapOffX=0, mapOffY=0;
function centerMap() { mapScale=1; mapOffX=0; mapOffY=0; }




/* ════════════════════════════════════════════════════════════
   PROFIT CHART
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   PROFIT HISTORY — Suivi dynamique valeur stock TELOS
════════════════════════════════════════════════════════════ */
var PROFIT_HISTORY = []; // [{ts: timestamp, value: aUEC}]
var chartDays = 7;

async function loadProfitHistory() {
  const saved = await DB.get('telos-profit-history');
  if (saved && Array.isArray(saved)) PROFIT_HISTORY = saved;
}

async function saveProfitHistory() {
  // Garder max 90 jours de points
  const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
  PROFIT_HISTORY = PROFIT_HISTORY.filter(p => p.ts >= cutoff);
  await DB.set('telos-profit-history', PROFIT_HISTORY);
}

function calcTotalStockValue() {
  // Valeur totale = somme (qty * sellprice) de tous les stocks de tous les joueurs
  let total = 0;
  players.forEach(p => {
    (p.stock || []).forEach(s => {
      const qty  = Number(s.qty)       || 0;
      const sell = Number(s.sellprice) || Number(s.price) || 0;
      total += qty * sell;
    });
  });
  return Math.round(total);
}

var _bankStatDays = 7;

function setBankStat(days, btn) {
  _bankStatDays = days;
  document.querySelectorAll('#bank-stat-7,#bank-stat-30,#bank-stat-all').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderHubBankStats();
}

function renderHubBankStats() {
  if (!BANK_DATA) return;

  const now = Date.now();
  const cutoff = _bankStatDays > 0 ? now - _bankStatDays * 86400000 : 0;
  const filtered = BANK_DATA.filter(t => !cutoff || new Date(t.date||t.addedAt||0).getTime() >= cutoff);

  const credits = filtered.filter(t=>t.type==='credit').reduce((s,t)=>s+(t.amount||0),0);
  const debits  = filtered.filter(t=>t.type==='debit') .reduce((s,t)=>s+(t.amount||0),0);
  const solde   = BANK_DATA.reduce((s,t)=>s+(t.type==='credit'?1:-1)*(t.amount||0),0);
  const fmt = v => Math.round(v).toLocaleString('fr-FR');

  const el_s = document.getElementById('hbs-solde');
  const el_c = document.getElementById('hbs-credits');
  const el_d = document.getElementById('hbs-debits');
  const el_n = document.getElementById('hbs-count');
  if (el_s) { el_s.textContent = fmt(solde)+' aUEC'; el_s.style.color = solde>=0?'var(--orange)':'var(--red)'; }
  if (el_c) el_c.textContent = '+'+fmt(credits)+' aUEC';
  if (el_d) el_d.textContent = '-'+fmt(debits)+' aUEC';
  if (el_n) el_n.textContent = filtered.length+' tx';

  // Grouper par jour
  const days = {};
  filtered.forEach(t => {
    const d = (t.date||t.addedAt||'').slice(0,10);
    if (!d) return;
    if (!days[d]) days[d] = { credit:0, debit:0 };
    if (t.type==='credit') days[d].credit += t.amount||0;
    else days[d].debit += t.amount||0;
  });

  const sorted = Object.keys(days).sort();
  draw3DBarChart(sorted, days);
}

function draw3DBarChart(labels, data) {
  const canvas = document.getElementById('bank-3d-chart');
  const empty  = document.getElementById('bank-chart-empty');
  const tip    = document.getElementById('bank-chart-tooltip');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth  || 600;
  const H = canvas.offsetHeight || 160;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (!labels.length) {
    if (empty) empty.style.display = 'flex';
    canvas.onmousemove = null; canvas.onmouseleave = null;
    return;
  }
  if (empty) empty.style.display = 'none';

  const n   = labels.length;
  const pad = { l:52, r:20, t:24, b:36 };
  const cW  = W - pad.l - pad.r;
  const cH  = H - pad.t - pad.b;

  // Construire les points de solde cumulatif
  let runBalance = 0;
  const pts = labels.map(l => {
    const c = data[l].credit || 0;
    const d = data[l].debit  || 0;
    runBalance += c - d;
    return { label:l, credit:c, debit:d, balance:runBalance };
  });

  // Plage des valeurs : crédits au-dessus du zéro, débits en négatif, solde
  const maxPos = Math.max(...pts.map(p => Math.max(p.credit, p.balance, 0)), 1);
  const maxNeg = Math.max(...pts.map(p => p.debit), 0);
  const rawMax =  maxPos;
  const rawMin = -maxNeg;
  const span   = (rawMax - rawMin) || 1;
  const yMax   = rawMax + span * 0.12;
  const yMin   = rawMin - span * 0.08;
  const ySpan  = yMax - yMin;

  function toY(v) { return pad.t + cH * (1 - (v - yMin) / ySpan); }
  function toX(i) { return pad.l + (n === 1 ? cW / 2 : i * cW / (n - 1)); }
  const barW = Math.max(4, Math.min(28, cW / n * 0.55));

  const zeroY = toY(0);

  // ── Grille horizontale ──
  const gridSteps = 5;
  ctx.lineWidth = 1;
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  for (let s = 0; s <= gridSteps; s++) {
    const v = yMin + ySpan * (s / gridSteps);
    const y = toY(v);
    ctx.strokeStyle = v === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)';
    ctx.setLineDash(v === 0 ? [] : [3, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
    ctx.setLineDash([]);
    const lbl = (v >= 0 ? '' : '-') + (Math.abs(v) >= 1e6 ? (Math.abs(v)/1e6).toFixed(1)+'M' : Math.abs(v) >= 1e3 ? (Math.abs(v)/1e3).toFixed(0)+'k' : Math.round(Math.abs(v))+'');
    ctx.fillStyle = v >= 0 ? 'rgba(0,255,163,0.4)' : 'rgba(255,80,80,0.4)';
    ctx.fillText(lbl, pad.l - 5, y + 3);
  }

  // ── Barres crédits (vers le haut, vertes) ──
  pts.forEach((p, i) => {
    if (p.credit <= 0) return;
    const x  = toX(i) - barW / 2;
    const y  = toY(p.credit);
    const bH = zeroY - y;
    if (bH <= 0) return;
    const g = ctx.createLinearGradient(0, y, 0, zeroY);
    g.addColorStop(0, 'rgba(0,255,163,0.75)');
    g.addColorStop(1, 'rgba(0,255,163,0.20)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, barW, bH);
    // Bord haut
    ctx.fillStyle = 'rgba(0,255,163,0.9)';
    ctx.fillRect(x, y, barW, 2);
  });

  // ── Barres débits (vers le bas, rouges) ──
  pts.forEach((p, i) => {
    if (p.debit <= 0) return;
    const x  = toX(i) - barW / 2;
    const y  = zeroY;
    const bH = toY(-p.debit) - zeroY;
    if (bH <= 0) return;
    const g = ctx.createLinearGradient(0, y, 0, y + bH);
    g.addColorStop(0, 'rgba(255,68,68,0.65)');
    g.addColorStop(1, 'rgba(255,68,68,0.15)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, barW, bH);
    // Bord bas
    ctx.fillStyle = 'rgba(255,68,68,0.85)';
    ctx.fillRect(x, y + bH - 2, barW, 2);
  });

  // ── Zone de remplissage courbe solde ──
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(toX(0), zeroY);
  pts.forEach((p, i) => ctx.lineTo(toX(i), toY(p.balance)));
  ctx.lineTo(toX(n - 1), zeroY);
  ctx.closePath();
  const gradFill = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
  const lastBal = pts[pts.length - 1].balance;
  if (lastBal >= 0) {
    gradFill.addColorStop(0, 'rgba(247,140,30,0.18)');
    gradFill.addColorStop(1, 'rgba(247,140,30,0.02)');
  } else {
    gradFill.addColorStop(0, 'rgba(247,140,30,0.02)');
    gradFill.addColorStop(1, 'rgba(247,140,30,0.18)');
  }
  ctx.fillStyle = gradFill;
  ctx.fill();
  ctx.restore();

  // ── Courbe solde (orange épaisse) ──
  ctx.strokeStyle = 'rgba(247,140,30,0.95)';
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p.balance)) : ctx.lineTo(toX(i), toY(p.balance)));
  ctx.stroke();

  // ── Points solde ──
  pts.forEach((p, i) => {
    const x = toX(i), y = toY(p.balance);
    ctx.beginPath();
    ctx.arc(x, y, i === pts.length - 1 ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = p.balance >= 0 ? 'rgba(247,140,30,1)' : 'rgba(255,68,68,1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });

  // ── Labels axe X ──
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  const maxLbl = Math.floor(cW / 38);
  const step = Math.max(1, Math.ceil(n / maxLbl));
  labels.forEach((l, i) => {
    if (i % step === 0 || i === n - 1) {
      ctx.fillText(l.slice(5), toX(i), pad.t + cH + 22);
    }
  });

  // ── Légende ──
  const legItems = [
    [pad.l + 4,    'rgba(247,140,30,0.95)', 'Solde',    false],
    [pad.l + 68,   'rgba(0,255,163,0.8)',   'Crédits',  true ],
    [pad.l + 140,  'rgba(255,68,68,0.8)',   'Débits',   true ],
  ];
  legItems.forEach(([x, col, lbl, isBar]) => {
    if (isBar) {
      ctx.fillStyle = col;
      ctx.fillRect(x, 3, 14, 9);
    } else {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + 14, 8); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText(lbl, x + 18, 12);
  });

  // ── Tooltip ──
  canvas.onmousemove = (e) => {
    if (!tip) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let closest = 0, minDist = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(toX(i) - mx); if (d < minDist) { minDist = d; closest = i; } });
    if (minDist < cW / n * 0.75) {
      const p = pts[closest];
      const fmt = v => Math.round(v).toLocaleString('fr-FR');
      tip.style.display = 'block';
      tip.style.left = Math.min(mx + 12, W - 160) + 'px';
      tip.style.top  = Math.max(4, e.clientY - rect.top - 48) + 'px';
      tip.innerHTML =
        '<span style="color:rgba(255,255,255,0.5);display:block;margin-bottom:3px;">' + p.label + '</span>' +
        '<span style="color:var(--green)">+' + fmt(p.credit) + ' aUEC</span>  ' +
        '<span style="color:var(--red)">-' + fmt(p.debit) + ' aUEC</span><br>' +
        '<span style="color:' + (p.balance>=0?'var(--orange)':'var(--red)') + '">Solde cumulé : ' + (p.balance>=0?'+':'') + fmt(p.balance) + ' aUEC</span>';
    } else {
      tip.style.display = 'none';
    }
  };
  canvas.onmouseleave = () => { if (tip) tip.style.display = 'none'; };
}

async function snapshotProfit() {
  const val = calcTotalStockValue();
  if (val <= 0) return; // Ne pas enregistrer si vide
  const now = Date.now();
  // Éviter doublons rapprochés (< 2 min)
  const last = PROFIT_HISTORY[PROFIT_HISTORY.length - 1];
  if (last && now - last.ts < 120000) {
    last.value = val; // Mettre à jour le dernier point
  } else {
    PROFIT_HISTORY.push({ ts: now, value: val });
  }
  await saveProfitHistory();
  drawChart(chartDays);
}

function drawChart(days) {
  chartDays = days;
  const canvas = document.getElementById('profit-chart');
  if (!canvas) return;

  // Dimensions réelles
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(rect.width  || canvas.offsetWidth  || 400, 100);
  const H = Math.max(rect.height || canvas.offsetHeight || 100, 60);
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Filtrer les données selon la période
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  let data = PROFIT_HISTORY.filter(p => p.ts >= cutoff);

  // Si pas assez de points, afficher un message
  if (data.length < 2) {
    ctx.fillStyle = 'rgba(247,140,30,0.15)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#6a7585';
    ctx.font = '12px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Données insuffisantes — effectuez des opérations de stock', W/2, H/2 - 8);
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText('Le graphique se remplit automatiquement', W/2, H/2 + 10);
    // Stocker pour tooltip
    canvas._chartData = [];
    return;
  }

  const pad = { l:48, r:14, t:16, b:24 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;

  const vals = data.map(p => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  // Coordonnées des points
  const pts = data.map((p, i) => ({
    x: pad.l + (i / (data.length - 1)) * cW,
    y: pad.t + cH - ((p.value - minV) / range) * cH,
    ts: p.ts,
    value: p.value
  }));

  // ── Grille horizontale ──
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const y = pad.t + f * cH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    // Label axe Y
    const v = maxV - f * range;
    ctx.fillStyle = '#4a5568';
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : Math.round(v).toString(), pad.l - 4, y + 3);
  });

  // ── Gradient de remplissage ──
  const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, 'rgba(247,140,30,0.28)');
  grad.addColorStop(1, 'rgba(247,140,30,0)');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, H - pad.b);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, H - pad.b);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Courbe ──
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  // Courbe lisse (bezier)
  for (let i = 1; i < pts.length; i++) {
    const cp1x = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cp1x, pts[i-1].y, cp1x, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = '#f78c1e';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // ── Points ──
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === pts.length - 1 ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = i === pts.length - 1 ? '#f78c1e' : 'rgba(247,140,30,0.7)';
    ctx.fill();
    if (i === pts.length - 1) {
      ctx.strokeStyle = 'rgba(247,140,30,0.3)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  });

  // ── Labels axe X (dates) ──
  ctx.fillStyle = '#4a5568';
  ctx.font = '9px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(data.length / 5));
  data.forEach((p, i) => {
    if (i % step === 0 || i === data.length - 1) {
      const x = pad.l + (i / (data.length - 1)) * cW;
      const d = new Date(p.ts);
      ctx.fillText(d.getDate() + '/' + (d.getMonth()+1), x, H - 4);
    }
  });

  // ── Valeur courante en haut à droite ──
  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const diff = prev ? last.value - prev.value : 0;
  const diffPct = prev && prev.value ? (diff / prev.value * 100) : 0;
  ctx.textAlign = 'right';
  ctx.font = 'bold 11px "Share Tech Mono", monospace';
  ctx.fillStyle = diff >= 0 ? '#00ffa3' : '#ff4444';
  ctx.fillText(
    (diff >= 0 ? '+' : '') + (last.value/1e6).toFixed(2) + 'M  (' + (diff >= 0 ? '+' : '') + diffPct.toFixed(1) + '%)',
    W - pad.r, pad.t - 4
  );

  // Stocker pour tooltip
  canvas._chartData = pts;
}

function setChart(d, btn) {
  chartDays = d;
  document.querySelectorAll('.chart-ctrl').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  drawChart(d);
}

// ── Tooltip interactif ──
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('profit-chart');
    const tip    = document.getElementById('profit-tooltip');
    if (!canvas || !tip) return;

    canvas.addEventListener('mousemove', e => {
      const data = canvas._chartData;
      if (!data || !data.length) { tip.style.display='none'; return; }
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      // Trouver le point le plus proche
      let closest = null, minDist = Infinity;
      data.forEach(p => {
        const d = Math.abs(p.x - mx);
        if (d < minDist) { minDist = d; closest = p; }
      });
      if (!closest || minDist > 40) { tip.style.display='none'; return; }
      const date = new Date(closest.ts);
      const fmt = date.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      tip.innerHTML = `<span style="color:var(--text-dim)">${fmt}</span><br><span style="color:var(--orange);font-size:13px;">${closest.value.toLocaleString('fr-FR')} aUEC</span>`;
      tip.style.display = 'block';
      let lx = e.clientX - rect.left + 12;
      let ty = e.clientY - rect.top - 38;
      if (lx + 180 > rect.width) lx = e.clientX - rect.left - 190;
      tip.style.left = lx + 'px';
      tip.style.top  = ty + 'px';
    });
    canvas.addEventListener('mouseleave', () => { tip.style.display='none'; });
  });
})();

/* ════════════════════════════════════════════════════════════
   RENDER: HUB components
════════════════════════════════════════════════════════════ */
function renderTopRes(){
  const top=[...RESOURCES].sort((a,b)=>(b.sell-b.buy)*b.qty-(a.sell-a.buy)*a.qty).slice(0,5);
  document.getElementById('top-res-body').innerHTML=top.map((r,i)=>`
    <tr><td>${i+1}</td><td>◈ ${r.name}</td><td>${r.qty}</td><td>${r.sell.toFixed(2)}</td>
    <td class="profit">+${((r.sell-r.buy)*r.qty).toLocaleString('fr-FR')}</td></tr>`).join('');
}
function renderPrices(){
  document.getElementById('price-body').innerHTML=RESOURCES.slice(0,7).map(r=>`
    <tr><td>◈ ${r.name}</td><td>${r.buy.toFixed(2)}</td><td>${r.sell.toFixed(2)}</td>
    <td class="evo ${r.delta>=0?'up':'down'}">${r.delta>=0?'▲':'▼'} ${Math.abs(r.delta).toFixed(1)}%</td></tr>`).join('');
}
function renderActivity(){
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  if (!LIVE_ACTIVITY.length) {
    feed.innerHTML = `<div style="padding:16px 14px;color:var(--text-dim);font-size:12px;letter-spacing:1px;text-align:center;opacity:0.6;">Aucune activité enregistrée.<br>Les dépôts et retraits apparaîtront ici.</div>`;
    return;
  }
  feed.innerHTML = LIVE_ACTIVITY.slice(0,8).map(a => `
    <div class="act-item" style="animation:tIn .3s ease;">
      <div class="act-icon">${a.icon}</div>
      <div style="flex:1">
        <div class="act-desc">${a.desc}</div>
        <div class="act-meta">
          ${a.amt ? `<span class="act-amt ${a.pos?'pos':'neg'}">${a.amt}</span>` : '<span></span>'}
          <span class="act-time">${timeAgo(a.ts)}</span>
        </div>
      </div>
    </div>`).join('');
}
function renderSysLogs(){
  const el = document.getElementById('sys-logs-mini');
  if (!el) return;
  // Prendre les 6 dernières entrées du vrai flux
  const recent = FULL_LOGS_DATA.slice(0, 6);
  const countEl = document.getElementById('mini-log-count');
  if (countEl) countEl.textContent = FULL_LOGS_DATA.length + ' entrée' + (FULL_LOGS_DATA.length > 1 ? 's' : '');
  if (!recent.length) {
    el.innerHTML = `<div style="color:var(--text-dim);font-size:11px;padding:4px 0;letter-spacing:1px;opacity:0.6;">En attente d'activité...</div>`;
    return;
  }
  const typeCol = { trade:'var(--green)', system:'var(--blue)', partner:'var(--purple)', alert:'var(--orange)', error:'var(--red)' };
  el.innerHTML = recent.map((l,i) => `
    <div class="log-ln" style="animation-delay:${i*0.07}s;cursor:pointer;" onclick="goPanel('logs',document.querySelector('[onclick*=logs]'));setTimeout(()=>setLogFilter('${l.type}',document.querySelector('#panel-logs .filter-btn[onclick*=${l.type}]')),80)">
      <span class="log-ts" style="flex-shrink:0;">[${l.ts}]</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${typeCol[l.type]||'var(--text-dim)'};">${esc(l.msg)}</span>
      <span class="log-ok">OK</span>
    </div>`).join('');
}
var logFilter = 'all';

/* ════════════════════════════════════════════════════════════
   LOGS — Sous-onglets (Logs / Historique)
════════════════════════════════════════════════════════════ */
function switchLogTab(tab, btn) {
  _currentLogTab = tab;
  document.getElementById('logtab-content-logs').style.display       = tab === 'logs'       ? 'flex' : 'none';
  document.getElementById('logtab-content-historique').style.display = tab === 'historique' ? 'flex' : 'none';
  ['logs','historique'].forEach(t => {
    const b = document.getElementById('logtab-'+t);
    if (b) {
      b.style.borderBottom = t === tab ? '2px solid var(--orange)' : '2px solid transparent';
      b.style.color        = t === tab ? 'var(--text-bright)' : 'var(--text-dim)';
    }
  });
  if (tab === 'historique') renderHistorique();
  else renderFullLogs();
}

/* ════════════════════════════════════════════════════════════
   HISTORIQUE — Persistant (commandes livrées/annulées + objectifs validés)
════════════════════════════════════════════════════════════ */
async function loadHistorique() {
  HISTORIQUE_DATA = (await DB.get('telos-historique')) || [];
}

async function pushHistorique(entry) {
  if (!HISTORIQUE_DATA) HISTORIQUE_DATA = [];
  HISTORIQUE_DATA.unshift(entry);
  await DB.set('telos-historique', HISTORIQUE_DATA);
  if (_currentLogTab === 'historique') renderHistorique();
}

function setHistFilter(f, btn) {
  _histFilter = f;
  document.querySelectorAll('#panel-logs #logtab-content-historique .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderHistorique();
}

function renderHistorique() {
  const el = document.getElementById('hist-full');
  if (!el) return;
  const search = (document.getElementById('hist-search')?.value || '').toLowerCase();

  let data = [...(HISTORIQUE_DATA || [])];
  if (_histFilter === 'commande') data = data.filter(h => h.kind === 'commande' && h.status === 'livree');
  else if (_histFilter === 'objectif') data = data.filter(h => h.kind === 'objectif');
  else if (_histFilter === 'annulee') data = data.filter(h => h.kind === 'commande' && h.status === 'annulee');
  if (search) data = data.filter(h => (h.title||'').toLowerCase().includes(search) || (h.by||'').toLowerCase().includes(search) || (h.commanditaire||'').toLowerCase().includes(search));

  const countEl = document.getElementById('hist-count');
  if (countEl) countEl.textContent = data.length + ' entrée' + (data.length > 1 ? 's' : '');

  if (!data.length) {
    el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-dim);font-size:12px;letter-spacing:1px;">Aucune entrée dans l\'historique.</div>';
    return;
  }

  el.innerHTML = data.map(h => {
    const d = new Date(h.at);
    const dateStr = !isNaN(d) ? d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) : '—';
    const isCmd = h.kind === 'commande';
    const isLivree = h.status === 'livree';
    const isAnnulee = h.status === 'annulee';

    const icon  = isCmd ? (isLivree ? '📋' : '✕') : '✅';
    const color = isCmd ? (isLivree ? 'var(--green)' : 'var(--red)') : 'var(--green)';
    const badge = isCmd
      ? (isLivree ? '<span style="color:var(--green);font-size:9px;letter-spacing:1px;font-family:var(--ui);">LIVRÉE</span>' : '<span style="color:var(--red);font-size:9px;letter-spacing:1px;font-family:var(--ui);">ANNULÉE</span>')
      : '<span style="color:var(--green);font-size:9px;letter-spacing:1px;font-family:var(--ui);">VALIDÉ</span>';
    const sub = isCmd
      ? (h.commanditaire ? ' · ' + esc(h.commanditaire) : '') + (h.craftType ? ' · ' + esc(h.craftType) : '')
      : (h.reward ? ' · ' + esc(h.reward) : '');

    return '<div class="log-entry" style="padding:7px 0;border-bottom:1px solid rgba(247,140,30,0.06);display:flex;gap:10px;align-items:center;">'
      + '<span style="flex-shrink:0;font-size:15px;">' + icon + '</span>'
      + '<div style="flex:1;min-width:0;">'
      +   '<div style="display:flex;align-items:center;gap:8px;">'
      +     '<span style="font-weight:700;color:var(--text-bright);font-size:12px;">' + esc(h.title) + '</span>'
      +     badge
      +   '</div>'
      +   '<div style="font-size:10px;color:var(--text-dim);margin-top:2px;">'
      +     '<span style="color:' + color + ';">' + (isCmd ? (h.type === 'interne' ? 'INTERNE' : 'EXTERNE') : 'OBJECTIF') + '</span>'
      +     esc(sub)
      +     (h.by ? ' · par <span style="color:var(--orange);">' + esc(h.by) + '</span>' : '')
      +   '</div>'
      + '</div>'
      + '<span style="flex-shrink:0;font-size:10px;color:var(--text-dim);font-family:var(--mono);white-space:nowrap;">' + dateStr + '</span>'
      + '</div>';
  }).join('');
}

function setLogFilter(f, btn) {
  logFilter = f;
  document.querySelectorAll('#panel-logs .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderFullLogs();
}

function renderFullLogs(){
  const el = document.getElementById('logs-full');
  if (!el) return;
  const search = (document.getElementById('log-search')?.value || '').toLowerCase();

  let data = [...FULL_LOGS_DATA];
  if (logFilter !== 'all') data = data.filter(l => l.type === logFilter);
  if (search) data = data.filter(l => l.msg.toLowerCase().includes(search) || l.tl.toLowerCase().includes(search));

  const countEl = document.getElementById('log-count');
  if (countEl) countEl.textContent = data.length + ' entrée' + (data.length > 1 ? 's' : '');

  if (!data.length) {
    el.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-dim);font-size:12px;letter-spacing:1px;">Aucun log correspondant.</div>`;
    return;
  }

  const typeIcon = { trade:'◈', system:'▸', partner:'⬡', alert:'⚠', error:'✕' };

  el.innerHTML = data.map(l => `
    <div class="log-entry" style="padding:5px 0;border-bottom:1px solid rgba(247,140,30,0.04);display:flex;gap:11px;align-items:baseline;">
      <span class="le-ts" style="flex-shrink:0;">${l.ts}</span>
      <span class="le-type type-${l.type}" style="flex-shrink:0;min-width:72px;">${typeIcon[l.type]||'▸'} [${l.tl}]</span>
      <span class="le-msg" style="flex:1;">${esc(l.msg)}</span>
    </div>`).join('');
}

/* ════════════════════════════════════════════════════════════
   RENDER: STOCKS panel — alimenté par les stocks joueurs + données marché
════════════════════════════════════════════════════════════ */

function catLbl(c){ return {mineral:'Minéraux',salvage:'Salvage',resources:'Ressources',equipment:'Équipements',weapons:'Armement',accessories:'Accessoires',other:'Autre'}[c]||c; }
function catCls(c){ return 'cat-'+c; }
function spark(r){
  const pts=Array.from({length:7},(_,i)=>(r.sell||1)*(0.95+Math.sin(i*2.3+(r.buy||0))*0.08));
  const mn=Math.min(...pts),mx=Math.max(...pts),rng=mx-mn||1;
  const d=pts.map((v,i)=>`${i===0?'M':'L'}${i*8},${12-(v-mn)/rng*10}`).join(' ');
  const c=(r.delta||0)>=0?'#00ffa3':'#ff4444';
  return `<svg width="50" height="14" class="spark"><path d="${d}" fill="none" stroke="${c}" stroke-width="1.2"/></svg>`;
}

// Cache des prix marché par ressource (pour enrichir les stocks joueurs)
var MARKET_PRICES = {};
RESOURCES.forEach(r=>{ MARKET_PRICES[r.name.toLowerCase()] = r; });

// Construit une ligne de données unifiée depuis un stock joueur
function buildStockRow(playerName, s) {
  const market = MARKET_PRICES[s.res.toLowerCase()];
  const buyPrice  = s.price || (market ? market.buy : 0);
  const sellPrice = market ? market.sell : 0;
  const delta     = market ? market.delta : 0;
  return {
    name:      s.res,
    cat:       s.cat,
    qty:       Number(s.qty),
    buy:       buyPrice,
    sell:      sellPrice,
    delta:     delta,
    loc:       s.loc,
    player:    playerName,
    fromDB:    true,
  };
}

// Agrège les stocks de tous les joueurs depuis la DB persistante
async function renderStocksFromPlayers() {
  // ── Masquer le contenu si non connecté ──
  const telosBody = document.getElementById('stocks-body');
  const telosFooter = document.getElementById('telos-footer');
  const telosKpi = document.getElementById('telos-kpi');
  if (!SESSION) {
    if (telosBody) telosBody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--text-dim);">
      <div style="font-size:28px;margin-bottom:12px;opacity:0.3;">🔒</div>
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Accès restreint</div>
      <div style="font-size:12px;opacity:0.7;margin-bottom:16px;">Connectez-vous pour consulter les stocks du réseau TELOS.</div>
      <button onclick="openLoginModal()" style="padding:7px 18px;border:1px solid var(--orange);background:var(--orange-faint);color:var(--orange);font-family:var(--ui);font-size:12px;letter-spacing:2px;cursor:pointer;text-transform:uppercase;">⬡ CONNEXION CORPO</button>
    </td></tr>`;
    if (telosFooter) telosFooter.innerHTML = '';
    if (telosKpi) telosKpi.innerHTML = '';
    return;
  }
  const search       = (document.getElementById('stock-search')||{}).value?.toLowerCase()||'';
  const cat          = stockCat;
  const filterPlayer = (document.getElementById('telos-filter-player')||{}).value||'';

  // ── Collecter tous les stocks bruts (ressources + armurerie) ──
  let rawRows = [];
  for (const p of players) {
    const stocks = (await DB.get('uex-stocks-'+p.id)) || [];
    stocks.forEach(s => rawRows.push({
      pid:     p.id,
      player:  p.name,
      name:    s.res,
      cat:     s.cat,
      qty:     Number(s.qty),
      buy:     Number(s.price)     || 0,
      sell:    Number(s.sellprice) || 0,
      loc:     s.loc || '—',
      note:    s.note || '',
      quality: s.quality || '',
      addedAt: s.addedAt,
    }));
    // Armurerie → fusionner comme des ressources
    const armory = (await DB.get('uex-armory-'+p.id)) || [];
    armory.forEach(s => rawRows.push({
      pid:     p.id,
      player:  p.name,
      name:    s.name,
      cat:     s.cat || 'armurerie',
      qty:     Number(s.qty) || 1,
      buy:     Number(s.price)     || 0,
      sell:    Number(s.sellprice) || 0,
      loc:     s.loc || '—',
      note:    s.note || '',
      quality: s.quality || '',
      addedAt: s.addedAt,
    }));
  }

  // ── KPIs (sur toutes les données brutes, avant filtres) ──
  const kpiEl = document.getElementById('telos-kpi');
  if (kpiEl) {
    const tSCU   = rawRows.reduce((a,r)=>a+r.qty,0);
    const tAchat = rawRows.reduce((a,r)=>a+r.buy*r.qty,0);
    const tVente = rawRows.reduce((a,r)=>a+r.sell*r.qty,0);
    const tp = tVente - tAchat;
    const uniq = [...new Set(rawRows.map(r=>r.name.toLowerCase()))].length;
    kpiEl.innerHTML = `
      <div class="gkpi"><div class="gkpi-lbl">Partenaires</div><div class="gkpi-val orange">${players.length}</div></div>
      <div class="gkpi"><div class="gkpi-lbl">Ressources uniques</div><div class="gkpi-val">${uniq}</div></div>
      <div class="gkpi"><div class="gkpi-lbl">SCU total</div><div class="gkpi-val">${tSCU.toLocaleString('fr-FR')}</div></div>
      <div class="gkpi"><div class="gkpi-lbl">Val. achat</div><div class="gkpi-val">${Math.round(tAchat).toLocaleString('fr-FR')} aUEC</div></div>
      <div class="gkpi"><div class="gkpi-lbl">Val. vente</div><div class="gkpi-val green">${Math.round(tVente).toLocaleString('fr-FR')} aUEC</div></div>
      <div class="gkpi"><div class="gkpi-lbl">Profit total</div><div class="gkpi-val" style="color:${tp>=0?'var(--green)':'var(--red)'};">${tp>=0?'+':''}${Math.round(tp).toLocaleString('fr-FR')} aUEC</div></div>
    `;
  }

  // ── Filtre partenaire dropdown ──
  const fpEl = document.getElementById('telos-filter-player');
  if (fpEl) {
    const cur = fpEl.value;
    fpEl.innerHTML = '<option value="">👥 Tous les partenaires</option>' +
      players.map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(p.name)}</option>`).join('');
  }

  // ── Appliquer filtres sur lignes brutes ──
  let filtered = rawRows;
  if (filterPlayer) filtered = filtered.filter(r=>r.pid===filterPlayer);
  if (cat!=='all')  filtered = filtered.filter(r=>r.cat===cat);
  if (search)       filtered = filtered.filter(r=>
    r.name.toLowerCase().includes(search) ||
    r.player.toLowerCase().includes(search) ||
    (r.loc||'').toLowerCase().includes(search)
  );

  // ── CONSOLIDATION par (name + cat) ──
  const groups = {};
  filtered.forEach(r => {
    const key = r.name.toLowerCase()+'|'+r.cat;
    if (!groups[key]) {
      groups[key] = {
        name: r.name, cat: r.cat,
        totalQty: 0, totalBuyVal: 0, totalSellVal: 0,
        qtyAucune: 0, qtyVente: 0, qtyVaisseau: 0, qtyFps: 0,
        partners: [],
      };
    }
    const g = groups[key];
    g.totalQty     += r.qty;
    g.totalBuyVal  += r.buy  * r.qty;
    g.totalSellVal += r.sell * r.qty;
    const _rb = qualityBucket(r);
    if (_rb==='aucune')        g.qtyAucune   += r.qty;
    else if (_rb==='vente')    g.qtyVente    += r.qty;
    else if (_rb==='vaisseau') g.qtyVaisseau += r.qty;
    else                       g.qtyFps      += r.qty;
    const ex = g.partners.find(p=>p.pid===r.pid);
    if (ex) {
      ex.qty     += r.qty;
      ex.buyVal  += r.buy  * r.qty;
      ex.sellVal += r.sell * r.qty;
      ex.lines.push(r);
    } else {
      g.partners.push({ pid:r.pid, player:r.player, qty:r.qty,
        buyVal:r.buy*r.qty, sellVal:r.sell*r.qty, lines:[r] });
    }
  });

  let consolidated = Object.values(groups);

  // ── Tri ──
  consolidated.sort((a,b)=>{
    const val = r=>{
      switch(stockSort.k){
        case 'profit':      return r.totalSellVal-r.totalBuyVal;
        case 'margin':      return r.totalBuyVal>0?(r.totalSellVal-r.totalBuyVal)/r.totalBuyVal:0;
        case 'buyval':      return r.totalBuyVal;
        case 'sellval':     return r.totalSellVal;
        case 'qty':         return r.totalQty;
        case 'qty_craft500': return (r.qtyVaisseau||0)+(r.qtyFps||0);
        default:            return r[stockSort.k]||r.name;
      }
    };
    const va=val(a),vb=val(b);
    return stockSort.d*(typeof va==='string'?va.localeCompare(vb):va-vb);
  });

  // ── Render table ──
  const body = document.getElementById('stocks-body');
  if (!consolidated.length) {
    body.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-dim);letter-spacing:1px;">
      ${players.length===0
        ? `Aucun partenaire — <span style="color:var(--orange);cursor:pointer" onclick="goPanel('inscription')">Inscrire le premier →</span>`
        : `Aucune ressource — <span style="color:var(--orange);cursor:pointer" onclick="goPanel('joueurs')">Ajouter des stocks →</span>`}
    </td></tr>`;
    const fEl=document.getElementById('telos-footer'); if(fEl) fEl.innerHTML='';
    _pushKPI(0, 0, 0, players.length);
    return;
  }

  window._telosGroups = groups; // pour le popup

  body.innerHTML = consolidated.map(g=>{
    const profit  = g.totalSellVal - g.totalBuyVal;
    const margin  = g.totalBuyVal>0&&g.totalSellVal>0 ? (profit/g.totalBuyVal*100) : null;
    const avgBuy  = g.totalQty>0 ? g.totalBuyVal/g.totalQty  : 0;
    const avgSell = g.totalQty>0 ? g.totalSellVal/g.totalQty : 0;
    const pCls    = profit>=0?'td-green':'td-red';
    const mCls    = margin!==null?(margin>=0?'td-green':'td-red'):'';
    const key     = g.name.toLowerCase()+'|'+g.cat;
    const nb      = g.partners.length;
    // Avatars des partenaires
    const avatars = g.partners.slice(0,5).map(p=>
      `<div title="${esc(p.player)}" style="width:22px;height:22px;background:var(--bg3);border:1px solid var(--orange);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--orange);font-weight:700;">${avHtml(players.find(x=>x.id===p.pid)||p.player,22)}</div>`
    ).join('');
    const locs = [...new Set(g.partners.flatMap(p=>p.lines.map(l=>l.loc)))].filter(Boolean).join(', ');

    return `<tr class="telos-row" onclick="openTelosPopup('${key.replace(/'/g,"\\'")}')">
      <td class="td-name">◈ ${esc(g.name)}</td>
      <td><span class="cat-badge ${catCls(g.cat)}">${catLbl(g.cat)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:3px;flex-wrap:wrap;">
          ${avatars}
          ${nb>5?`<span style="font-size:9px;color:var(--text-dim);">+${nb-5}</span>`:''}
          ${nb>1?`<span style="font-size:9px;color:var(--text-dim);margin-left:2px;">(${nb})</span>`:''}
        </div>
      </td>
      ${qtyCell(g.qtyAucune,  'aucune')}
      ${qtyCell(g.qtyVente,   'vente')}
      ${qtyCell((g.qtyVaisseau||0)+(g.qtyFps||0), 'craft500')}
      <td class="td-dim">${avgBuy?avgBuy.toFixed(2)+' aUEC':'—'}</td>
      <td style="color:var(--blue);">${avgSell?avgSell.toFixed(2)+' aUEC':'—'}</td>
      <td class="${mCls}">${margin!==null?(margin>=0?'+':'')+margin.toFixed(1)+'%':'—'}</td>
      <td class="td-dim">${g.totalBuyVal?Math.round(g.totalBuyVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td style="color:var(--green);">${g.totalSellVal?Math.round(g.totalSellVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="${pCls}">${profit!==0?(profit>=0?'+':'')+Math.round(profit).toLocaleString('fr-FR')+' aUEC':'—'}</td>
    </tr>`;
  }).join('');

  // ── Footer ──
  const fSCU=consolidated.reduce((a,g)=>a+g.totalQty,0);
  const fA  =consolidated.reduce((a,g)=>a+g.totalBuyVal,0);
  const fV  =consolidated.reduce((a,g)=>a+g.totalSellVal,0);
  const fP  =fV-fA;
  // Push to KPI strip
  _pushKPI(fA, fP, consolidated.length, players.length);


  const fEl =document.getElementById('telos-footer');
  if (fEl) fEl.innerHTML='';
}

function renderStocks(){ renderStocksFromPlayers(); }
function filterStocks(){ renderStocksFromPlayers(); }
function filterCat(c,btn){ stockCat=c; document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderStocksFromPlayers(); }
function sortStocks(k){ stockSort.k===k?stockSort.d*=-1:(stockSort={k,d:-1}); renderStocksFromPlayers(); }

/* ════════════════════════════════════════════════════════════
   POPUP DÉTAIL RESSOURCE — partenaires contributeurs
════════════════════════════════════════════════════════════ */
function openTelosPopup(key) {
  const g = window._telosGroups?.[key];
  if (!g) return;
  const profit = g.totalSellVal - g.totalBuyVal;
  const margin = g.totalBuyVal>0&&g.totalSellVal>0 ? (profit/g.totalBuyVal*100) : null;
  const pCls   = profit>=0?'var(--green)':'var(--red)';

  document.getElementById('telos-popup-title').textContent = '◈ '+g.name+' — Détail partenaires';
  document.getElementById('telos-popup-body').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--border);">
      <div class="gkpi"><div class="gkpi-lbl">SCU total</div><div class="gkpi-val orange">${g.totalQty.toLocaleString('fr-FR')}</div></div>
      <div class="gkpi"><div class="gkpi-lbl">Val. achat</div><div class="gkpi-val">${Math.round(g.totalBuyVal).toLocaleString('fr-FR')} aUEC</div></div>
      <div class="gkpi"><div class="gkpi-lbl">Val. vente</div><div class="gkpi-val green">${Math.round(g.totalSellVal).toLocaleString('fr-FR')} aUEC</div></div>
      <div class="gkpi"><div class="gkpi-lbl">Profit</div><div class="gkpi-val" style="color:${pCls};">${profit>=0?'+':''}${Math.round(profit).toLocaleString('fr-FR')} aUEC${margin!==null?' ('+(margin>=0?'+':'')+margin.toFixed(1)+'%)':''}</div></div>
    </div>
    <div style="overflow-y:auto;max-height:55vh;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:var(--bg2);position:sticky;top:0;z-index:2;">
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:left;border-bottom:1px solid var(--border);">Partenaire</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">SCU</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Px achat</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Px vente</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Val. achat</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Val. vente</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Profit</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:left;border-bottom:1px solid var(--border);">Localisation</th>
        </tr></thead>
        <tbody>
        ${g.partners.map(p=>{
          const pp = p.sellVal - p.buyVal;
          const pm = p.buyVal>0&&p.sellVal>0?(pp/p.buyVal*100):null;
          const pc = pp>=0?'var(--green)':'var(--red)';
          const ab = p.qty>0?p.buyVal/p.qty:0;
          const as_ = p.qty>0?p.sellVal/p.qty:0;
          const locs = [...new Set(p.lines.map(l=>l.loc))].join(', ');
          return `<tr style="border-bottom:1px solid rgba(247,140,30,0.05);cursor:pointer;transition:background 0.1s;"
            onmouseover="this.style.background='var(--orange-faint)'" onmouseout="this.style.background=''"
            onclick="closeTelosPopup();goPanel('joueurs');setTimeout(()=>selectPlayer('${p.pid}'),80)">
            <td style="padding:9px 14px;">
              <div style="display:flex;align-items:center;gap:9px;">
                <div style="width:28px;height:28px;background:var(--bg);border:1.5px solid var(--orange);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--orange);font-weight:700;clip-path:polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%);overflow:hidden;">${avHtml(players.find(x=>x.id===p.pid)||p.player,34)}</div>
                <div>
                  <div style="font-weight:700;color:var(--text-bright);font-size:13px;">${esc(p.player)}</div>
                  ${p.lines.length>1?`<div style="font-size:9px;color:var(--text-dim);">${p.lines.length} entrées · cliquer pour voir le stock</div>`:`<div style="font-size:9px;color:var(--text-dim);">cliquer pour voir le stock</div>`}
                </div>
              </div>
            </td>
            <td style="padding:9px 14px;text-align:right;font-family:var(--mono);color:var(--orange);font-weight:600;">${p.qty.toLocaleString('fr-FR')}</td>
            <td style="padding:9px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--text-dim);">${ab?ab.toFixed(2)+' aUEC':'—'}</td>
            <td style="padding:9px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--blue);">${as_?as_.toFixed(2)+' aUEC':'—'}</td>
            <td style="padding:9px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--text-dim);">${p.buyVal?Math.round(p.buyVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
            <td style="padding:9px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--green);">${p.sellVal?Math.round(p.sellVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
            <td style="padding:9px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:${pc};">${pp!==0?(pp>=0?'+':'')+Math.round(pp).toLocaleString('fr-FR')+' aUEC':'—'}${pm!==null?' ('+(pm>=0?'+':'')+pm.toFixed(1)+'%)':''}</td>
            <td style="padding:9px 14px;">
              ${(()=>{ const _q = p.lines.find(l=>l.quality)?.quality || ''; return _q && QUALITY_META[_q] ? '<span style="font-size:10px;color:'+QUALITY_META[_q].color+';font-weight:600;">'+QUALITY_META[_q].label+'</span>' : '<span style="font-size:10px;color:var(--text-dim);">—</span>'; })()}
            </td>


            <td style="padding:9px 14px;">
              ${(()=>{ const _t=getUexTier(g.name); return _t ? '<span style="font-size:10px;color:'+_t.color+';font-weight:600;">'+_t.label+'</span>' : '<span style="font-size:10px;color:var(--text-dim);">—</span>'; })()}
            </td>
            <td style="padding:9px 14px;font-size:10px;color:var(--text-dim);">${esc(locs)}</td>
          </tr>`;
        }).join('')}
        </tbody>
        <tfoot><tr style="background:var(--bg2);border-top:2px solid var(--border);">
          <td style="padding:8px 14px;font-size:10px;font-weight:700;color:var(--text-dim);letter-spacing:1px;">TOTAL</td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--orange);font-weight:700;">${g.totalQty.toLocaleString('fr-FR')}</td>
          <td colspan="4"></td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--text-dim);font-weight:700;">${Math.round(g.totalBuyVal).toLocaleString('fr-FR')} aUEC</td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--green);font-weight:700;">${Math.round(g.totalSellVal).toLocaleString('fr-FR')} aUEC</td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:${pCls};font-weight:700;">${profit>=0?'+':''}${Math.round(profit).toLocaleString('fr-FR')} aUEC</td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>
    <div style="padding:12px 18px;border-top:1px solid var(--border);background:var(--bg2);text-align:right;">
      <button class="btn" onclick="closeTelosPopup()">Fermer</button>
    </div>
  `;
  document.getElementById('telos-popup').classList.add('open');
}
function closeTelosPopup(){ document.getElementById('telos-popup').classList.remove('open'); }



/* ════════════════════════════════════════════════════════════
   RENDER: COMMERCE
════════════════════════════════════════════════════════════ */
function renderCommerce(){
  const actHtml=(icon,r,cls,neg)=>`<div class="act-item"><div class="act-icon" style="color:${icon.c};background:rgba(0,0,0,0.2);">${icon.i}</div><div style="flex:1"><div class="act-desc">${r.qty}× ${r.res} @ ${r.price} aUEC</div><div class="act-meta"><span class="act-amt ${neg?'neg':'pos'}">${neg?'-':'+'}${r.total} kaUEC</span><span class="act-time">${r.loc} · ${r.time}</span></div></div></div>`;
  document.getElementById('buys-list').innerHTML  = BUYS.map(r=>actHtml({i:'🛒',c:'var(--blue)'},r,null,true)).join('');
  document.getElementById('sells-list').innerHTML = SELLS.map(r=>actHtml({i:'📤',c:'var(--green)'},r,null,false)).join('');
  document.getElementById('routes-list').innerHTML= ROUTES.map(r=>`<div class="act-item"><div class="act-icon">→</div><div style="flex:1"><div class="act-desc">${r.from} → ${r.to}: ${r.res}</div><div class="act-meta"><span class="act-amt pos">${r.profit}</span><span class="act-time">Marge: ${r.margin}</span></div></div></div>`).join('');
  document.getElementById('opps-list').innerHTML  = OPPS.map(o=>`<div class="act-item"><div class="act-icon" style="color:${o.color};">◈</div><div style="flex:1"><div class="act-desc">${o.res}: ${o.desc}</div><div class="act-meta"><span style="font-size:9px;color:${o.color};font-weight:700;letter-spacing:1px;">${o.action}</span></div></div></div>`).join('');
}

/* ════════════════════════════════════════════════════════════
   RENDER: PARTNERS — vrais joueurs depuis la DB
════════════════════════════════════════════════════════════ */
async function renderPartners(){
  const search = (document.getElementById('partner-search')||{}).value||'';

  // Charger tous les joueurs + leurs stocks
  const data = await Promise.all(players.map(async p => {
    const stocks = (await DB.get('uex-stocks-'+p.id))||[];
    const totalUnits = stocks.reduce((a,s)=>a+Number(s.qty),0);
    const totalVal   = stocks.reduce((a,s)=>a+(s.price||0)*s.qty,0);
    // Valeur marché : enrichir avec prix vente TELOS si dispo
    const marketVal  = stocks.reduce((a,s)=>{
      const m = MARKET_PRICES[s.res.toLowerCase()];
      return a + (m ? m.sell * s.qty : (s.price||0)*s.qty);
    }, 0);
    return { p, stocks, totalUnits, totalVal, marketVal };
  }));

  // KPI réseau total
  const totalPlayers = players.length;
  const totalRes     = data.reduce((a,d)=>a+d.stocks.length,0);
  const totalSCU     = data.reduce((a,d)=>a+d.totalUnits,0);
  const totalMktVal  = data.reduce((a,d)=>a+d.marketVal,0);

  const kpi = document.getElementById('partners-kpi');
  if (kpi) kpi.innerHTML = `
    <div class="gkpi"><div class="gkpi-lbl">Joueurs réseau</div><div class="gkpi-val orange">${totalPlayers}</div></div>
    <div class="gkpi"><div class="gkpi-lbl">Ressources déclarées</div><div class="gkpi-val">${totalRes}</div></div>
    <div class="gkpi"><div class="gkpi-lbl">SCU total réseau</div><div class="gkpi-val">${totalSCU.toLocaleString('fr-FR')}</div></div>
    <div class="gkpi"><div class="gkpi-lbl">Valeur marché totale</div><div class="gkpi-val green">${Math.round(totalMktVal).toLocaleString('fr-FR')} aUEC</div></div>
  `;

  const grid  = document.getElementById('partners-grid');
  const empty = document.getElementById('partners-empty');

  // Filtre recherche
  const filtered = search
    ? data.filter(d=>d.p.name.toLowerCase().includes(search.toLowerCase()) || d.p.role.toLowerCase().includes(search.toLowerCase()))
    : data;

  if (!filtered.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const roleCol = { Trader:'var(--blue)', Mineur:'var(--orange)', Transporteur:'var(--green)', Explorateur:'var(--purple)', Gestionnaire:'var(--red)' };

  grid.innerHTML = filtered.map(({ p, stocks, totalUnits, totalVal, marketVal }) => {
    // Top 3 ressources par valeur
    const top3 = [...stocks]
      .sort((a,b)=>(b.price||0)*b.qty-(a.price||0)*a.qty)
      .slice(0,3);

    const profit = marketVal - totalVal;
    const profitSign = profit >= 0 ? '+' : '';
    const profitCls  = profit >= 0 ? 'var(--green)' : 'var(--red)';

    // Barre de répartition par catégorie
    const catGroups = {};
    stocks.forEach(s=>{ catGroups[s.cat]=(catGroups[s.cat]||0)+Number(s.qty); });
    const totalQ = Object.values(catGroups).reduce((a,v)=>a+v,0)||1;
    const catColors = { mineral:'var(--orange)', metal:'var(--blue)', gas:'var(--green)', rare:'var(--purple)', other:'#aaa' };

    const barParts = Object.entries(catGroups).map(([cat,qty])=>
      `<div style="flex:${qty/totalQ};height:3px;background:${catColors[cat]||'#aaa'};" title="${catLbl(cat)}: ${qty} SCU"></div>`
    ).join('');

    return `
    <div class="partner-card" style="cursor:pointer;" onclick="openPartnerDetail('${p.id}')">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        <div style="
          width:42px;height:42px;flex-shrink:0;
          background:var(--bg);border:1.5px solid var(--orange);
          display:flex;align-items:center;justify-content:center;
          font-size:18px;color:var(--orange);font-weight:700;
          clip-path:polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%);
        ">${avHtml(p,42)}</div>
        <div style="flex:1;min-width:0;">
          <div class="pc-name" style="font-size:15px;">${esc(p.name)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
            ${p.isAdmin
              ? `<span class="pc-rank" style="color:#ffffff;border-color:#ffffff;font-size:8px;padding:1px 6px;">ADMIN</span>`
              : `<span class="pc-rank" style="color:${ROLE_COLORS[p.role]||'var(--text)'};border-color:${ROLE_COLORS[p.role]||'var(--border)'};font-size:8px;padding:1px 6px;">${p.role}</span>
                 ${canManageRoles()?`<span onclick="event.stopPropagation();openEditRole('${p.id}')" title="Modifier le rôle" style="cursor:pointer;font-size:10px;color:var(--text-dim);padding:1px 5px;border:1px solid var(--border);margin-left:3px;" onmouseover="this.style.color='var(--orange)'" onmouseout="this.style.color='var(--text-dim)'">✏</span>`:''}`
            }
            <span style="font-size:9px;color:var(--text-dim);font-family:var(--mono);">depuis ${fmtDate(p.joinedAt)}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
          <div style="text-align:right;">
            <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">STOCK</div>
            <div style="font-family:var(--mono);font-size:14px;color:var(--orange);">${stocks.length} res.</div>
          </div>
          ${((window._playerBpCache&&window._playerBpCache[p.id])||[]).length>0?`
          <div style="text-align:right;">
            <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">BLUEPRINTS</div>
            <div style="font-family:var(--mono);font-size:14px;color:#60a5fa;">${((window._playerBpCache&&window._playerBpCache[p.id])||[]).length} 📐</div>
          </div>`:''}
        </div>
      </div>

      <!-- Liens RSI/TELOS -->
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        <a href="${esc(p.rsi)}" target="_blank" rel="noopener" class="prof-link" onclick="event.stopPropagation()" style="font-size:9px;padding:2px 7px;">
          <span class="ll">RSI</span>${shortUrl(p.rsi)}
        </a>
        ${p.uex ? `<a href="${esc(p.uex)}" target="_blank" rel="noopener" class="prof-link" onclick="event.stopPropagation()" style="font-size:9px;padding:2px 7px;"><span class="ll">UEX</span>${shortUrl(p.uex)}</a>` : ''}
      </div>

      <!-- Stats principales -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
        <div>
          <div style="font-family:var(--mono);font-size:14px;color:var(--text-bright);">${totalUnits.toLocaleString('fr-FR')}</div>
          <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">SCU total</div>
        </div>
        <div>
          <div style="font-family:var(--mono);font-size:14px;color:var(--orange);">${Math.round(totalVal).toLocaleString('fr-FR')}</div>
          <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">Valeur achat</div>
        </div>
        <div>
          <div style="font-family:var(--mono);font-size:14px;color:${profitCls};">${profitSign}${Math.round(profit).toLocaleString('fr-FR')}</div>
          <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">P/L marché</div>
        </div>
      </div>

      <!-- Valeur marché totale -->
      <div style="background:var(--bg);border:1px solid var(--border);padding:6px 10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">Valeur marché</span>
        <span style="font-family:var(--mono);font-size:13px;color:var(--green);">${Math.round(marketVal).toLocaleString('fr-FR')} aUEC</span>
      </div>

      <!-- Top 3 ressources -->
      ${top3.length ? `
      <div style="margin-bottom:8px;">
        <div style="font-size:8px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;">Top ressources</div>
        ${top3.map(s=>{
          const m = MARKET_PRICES[s.res.toLowerCase()];
          const sellVal = m ? m.sell * s.qty : (s.price||0)*s.qty;
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(247,140,30,0.05);">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="cat-badge cat-${s.cat}" style="font-size:7px;padding:1px 5px;">${catLbl(s.cat)}</span>
              <span style="font-size:11px;color:var(--text-bright);font-weight:600;">◈ ${esc(s.res)}</span>${s.quality&&QUALITY_META[s.quality]?.label?`<div style='font-size:9px;margin-top:1px;color:${QUALITY_META[s.quality].color};'>${QUALITY_META[s.quality].label}</div>`:''}
              ${(()=>{const _t=getUexTier(s.res);return _t?`<div style='font-size:9px;margin-top:1px;color:${_t.color};letter-spacing:0.5px;'>${_t.label}</div>`:'';})()} 
            </div>
            <div style="text-align:right;">
              <span style="font-family:var(--mono);font-size:10px;color:var(--orange);">${Number(s.qty).toLocaleString('fr-FR')} SCU</span>
              <span style="font-family:var(--mono);font-size:10px;color:var(--green);margin-left:8px;">${Math.round(sellVal).toLocaleString('fr-FR')} aUEC</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div style="font-size:10px;color:var(--text-dim);text-align:center;padding:10px 0;">Aucun stock déclaré</div>`}

      <!-- Barre catégories -->
      ${stocks.length ? `
      <div style="margin-top:18px;">
        <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;margin-bottom:3px;">RÉPARTITION</div>
        <div style="display:flex;height:3px;gap:1px;border-radius:2px;overflow:hidden;">${barParts}</div>
        <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
          ${Object.entries(catGroups).map(([cat,qty])=>`
            <span style="font-size:8px;color:${catColors[cat]||'#aaa'};">● ${catLbl(cat)} (${qty})</span>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- Bouton voir profil + supprimer -->
      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:9px;color:var(--orange);letter-spacing:1px;text-transform:uppercase;">Voir stock complet →</span>
        ${canManageRoles() ? `<button onclick="event.stopPropagation();confirmDeletePlayer('${p.id}','${esc(p.name)}')"
          style="padding:2px 9px;border:1px solid rgba(255,68,68,0.4);background:transparent;color:var(--red);font-family:var(--ui);font-size:9px;letter-spacing:1px;cursor:pointer;text-transform:uppercase;"
          onmouseover="this.style.background='rgba(255,68,68,0.1)'" onmouseout="this.style.background='transparent'">✕ Supprimer</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* Ouvrir la modale de détail stock d'un joueur depuis Partenaires */
async function openPartnerDetail(pid) {
  const p = players.find(x=>x.id===pid);
  if (!p) return;
  const stocks = (await DB.get('uex-stocks-'+pid))||[];

  document.getElementById('pd-title').textContent = `⬡ ${p.name.toUpperCase()} — STOCK COMPLET`;

  const totalVal  = stocks.reduce((a,s)=>a+(s.price||0)*s.qty,0);
  const totalUnits= stocks.reduce((a,s)=>a+Number(s.qty),0);
  const marketVal = stocks.reduce((a,s)=>{ const m=MARKET_PRICES[s.res.toLowerCase()]; return a+(m?m.sell*s.qty:(s.price||0)*s.qty); },0);
  const profit    = marketVal - totalVal;

  document.getElementById('pd-body').innerHTML = `
    <!-- Hero -->
    <div style="padding:16px 18px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;gap:14px;align-items:center;">
      <div style="width:50px;height:50px;background:var(--bg);border:2px solid var(--orange);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--orange);clip-path:polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%);overflow:hidden;">${avHtml(p,50)}</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:700;color:var(--text-bright);">${esc(p.name)}</div>
        <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
          <a href="${esc(p.rsi)}" target="_blank" class="prof-link" style="font-size:9px;padding:2px 8px;"><span class="ll">RSI</span>${shortUrl(p.rsi)}</a>
          ${p.uex?`<a href="${esc(p.uex)}" target="_blank" class="prof-link" style="font-size:9px;padding:2px 8px;"><span class="ll">UEX</span>${shortUrl(p.uex)}</a>`:''}
        </div>
      </div>
      <div style="display:flex;gap:16px;">
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:16px;color:var(--orange);">${stocks.length}</div>
          <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;">RES.</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:16px;color:var(--text-bright);">${totalUnits.toLocaleString('fr-FR')}</div>
          <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;">SCU</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:16px;color:var(--green);">${Math.round(marketVal).toLocaleString('fr-FR')}</div>
          <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;">aUEC MKT</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:16px;color:${profit>=0?'var(--green)':'var(--red)'};">${profit>=0?'+':''}${Math.round(profit).toLocaleString('fr-FR')}</div>
          <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;">P/L</div>
        </div>
      </div>
    </div>

    <!-- Table stocks -->
    ${stocks.length ? `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:var(--bg2);">
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:left;border-bottom:1px solid var(--border);">Ressource</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:left;border-bottom:1px solid var(--border);">Catégorie</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">SCU</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Prix achat</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Prix marché</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Valeur achat</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Valeur marché</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:left;border-bottom:1px solid var(--border);">Localisation</th>
        </tr>
      </thead>
      <tbody>
        ${stocks.map(s=>{
          const m = MARKET_PRICES[s.res.toLowerCase()];
          const sellPrice = m ? m.sell : 0;
          const buyVal    = (s.price||0)*s.qty;
          const sellVal   = sellPrice * s.qty;
          const diff      = sellVal - buyVal;
          return `<tr style="border-bottom:1px solid rgba(247,140,30,0.05);">
            <td style="padding:8px 14px;font-weight:600;color:var(--text-bright);font-size:12px;">◈ ${esc(s.res)}</td>
            <td style="padding:8px 14px;"><span class="cat-badge cat-${s.cat}" style="font-size:8px;">${catLbl(s.cat)}</span></td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:12px;color:var(--orange);">${Number(s.qty).toLocaleString('fr-FR')}</td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--text-dim);">${s.price?s.price.toFixed(2)+' aUEC':'—'}</td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:11px;">${sellPrice?sellPrice.toFixed(2)+' aUEC':'—'}</td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--text-dim);">${buyVal?Math.round(buyVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--green);">${sellVal?Math.round(sellVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
            <td style="padding:8px 14px;font-size:10px;color:var(--text-dim);">${esc(s.loc)}</td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:var(--bg2);border-top:1px solid var(--border);">
          <td colspan="2" style="padding:8px 14px;font-size:10px;font-weight:700;color:var(--text-dim);letter-spacing:1px;">TOTAL</td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--orange);font-weight:700;">${totalUnits.toLocaleString('fr-FR')}</td>
          <td colspan="2"></td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--text-dim);font-weight:700;">${Math.round(totalVal).toLocaleString('fr-FR')} aUEC</td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--green);font-weight:700;">${Math.round(marketVal).toLocaleString('fr-FR')} aUEC</td>
          <td></td>
        </tr>
      </tfoot>
    </table>` : `<div style="padding:30px;text-align:center;color:var(--text-dim);font-size:11px;letter-spacing:1px;">Aucun stock déclaré par ce joueur.</div>`}

    <!-- Boutons action -->
    <div style="padding:12px 18px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;background:var(--bg2);">
      <button class="btn primary" onclick="closePartnerDetail();goPanel('joueurs');setTimeout(()=>selectPlayer('${pid}'),80);">Voir le stock →</button>
      <button class="btn" onclick="closePartnerDetail()">Fermer</button>
    </div>
  `;

  document.getElementById('partner-detail-overlay').classList.add('open');
}

function closePartnerDetail(){
  document.getElementById('partner-detail-overlay').classList.remove('open');
}

/* ════════════════════════════════════════════════════════════
   RENDER: MISSIONS
════════════════════════════════════════════════════════════ */
function renderMissions(){
  const el = document.getElementById('missions-list');
  if (!el) return;

  const statusLabel = { open:'OUVERT', accepted:'EN COURS', pending_validation:'EN VALIDATION', done:'TERMINÉ' };
  const statusClass = { open:'ms-open', accepted:'ms-progress', pending_validation:'ms-pending', done:'ms-done' };
  const statusColor = { open:'var(--blue)', accepted:'var(--orange)', pending_validation:'var(--purple)', done:'var(--green)' };

  el.innerHTML = MISSIONS.map(m => {
    const isMine   = SESSION && m.assignedTo === SESSION.pid;
    const isManager = canManageRoles();
    const isPending = m.status === 'pending_validation';
    const isOpen    = m.status === 'open';
    const isAccepted= m.status === 'accepted';
    const isDone    = m.status === 'done';

    // Boutons d'action selon rôle et état — data-action pour éviter les pb de quotes
    const S = 'font-family:var(--ui);font-size:10px;letter-spacing:1px;cursor:pointer;';
    let actions = '';
    if (isOpen && SESSION && !isDone)
      actions += `<button data-action="miss-accept" data-id="${m.id}" style="${S}padding:3px 12px;border:1px solid var(--orange);background:var(--orange-faint);color:var(--orange);text-transform:uppercase;">► ACCEPTER</button>`;
    if (isAccepted && isMine)
      actions += `<button data-action="miss-complete" data-id="${m.id}" style="${S}padding:3px 12px;border:1px solid var(--green);background:rgba(0,255,163,0.08);color:var(--green);text-transform:uppercase;">✓ MARQUER TERMINÉ</button>`;
    if (isPending && isManager) {
      actions += `<button data-action="miss-validate" data-id="${m.id}" style="${S}padding:3px 12px;border:1px solid var(--green);background:rgba(0,255,163,0.08);color:var(--green);">✓ VALIDER</button>`;
      actions += `<button data-action="miss-reject"   data-id="${m.id}" style="${S}padding:3px 10px;border:1px solid rgba(255,68,68,0.4);background:transparent;color:var(--red);">✕ REJETER</button>`;
    }
    // Bouton supprimer — admin/gestionnaire uniquement
    if (isManager)
      actions += `<button data-action="miss-delete" data-id="${m.id}" title="Supprimer la mission" style="${S}padding:3px 9px;border:1px solid rgba(255,68,68,0.35);background:transparent;color:var(--red);margin-left:auto;">🗑</button>`;

    const assignInfo = m.assignedName ? `<span style="font-size:10px;color:var(--text-dim);margin-left:8px;">→ ${esc(m.assignedName)}</span>` : '';

    return `<div class="mission-card" style="border-left:3px solid ${statusColor[m.status]||'var(--border)'};">
      <div class="m-icon">${m.icon}</div>
      <div style="flex:1;">
        <div class="m-title">${esc(m.title)}</div>
        <div class="m-desc">${esc(m.desc)}</div>
        <div class="m-footer" style="flex-wrap:wrap;gap:6px;">
          <span class="m-reward">${esc(m.reward)}</span>
          <span class="m-status ${statusClass[m.status]||''}">${statusLabel[m.status]||m.status}</span>
          <span class="m-dl">⏱ ${m.dl}</span>
          ${isPending ? `<span style="font-size:10px;color:var(--purple);letter-spacing:1px;">⏳ Validation requise</span>` : ''}
          ${isDone && m.validatedBy ? `<span style="font-size:10px;color:var(--green);">✓ Validé par ${esc(m.validatedBy)}</span>` : ''}
        </div>
        ${actions ? `<div style="margin-top:8px;display:flex;gap:6px;align-items:center;">${actions}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   LIVE PRICE FLUCTUATION
════════════════════════════════════════════════════════════ */
async function fluctuate(){
  // Fluctuation des prix marché uniquement — ne touche plus aux KPI stock/profit
  RESOURCES.forEach(r=>{ r.sell=Math.max(r.buy*1.05, r.sell*(1+(Math.random()-0.48)*0.07)); r.delta=+(r.delta+(Math.random()-0.5)*0.3).toFixed(1); });
  renderPrices(); renderTopRes();
}

/* ════════════════════════════════════════════════════════════
   MODAL (generic)
════════════════════════════════════════════════════════════ */
var MODALS = {

  'new-contract':{
    title:'+ NOUVEAU CONTRAT',
    body: () => {
      const icons = ['📦','💎','🤝','⚠️','🚀','⛏','🛡','💼','🔧','📋'];
      const iconBtns = icons.map(ic => {
        return '<span onclick="document.getElementById(\'nc-icon-sel\').value=\''+ic+'\';document.querySelectorAll(\'#nc-icon-picker span\').forEach(function(s){s.style.background=\'\';s.style.borderColor=\'var(--border)\';});this.style.background=\'var(--orange-faint)\';this.style.borderColor=\'var(--orange)\';" style="font-size:20px;cursor:pointer;padding:4px 8px;border:1px solid var(--border);border-radius:3px;transition:all 0.15s;">'+ic+'</span>';
      }).join('');

      // Ressources depuis le catalogue UEX (onglet Ressources)
      const allRes = [];
      const _catalogue = (typeof RESSOURCE_CATALOGUE !== 'undefined' && RESSOURCE_CATALOGUE.length)
        ? RESSOURCE_CATALOGUE
        : (typeof UEX_COMMODITIES !== 'undefined' ? UEX_COMMODITIES.map(function(n){ return {name:n}; }) : []);
      _catalogue.forEach(function(r) {
        const n = r.name || r;
        if (n && !allRes.includes(n)) allRes.push(n);
      });
      // Fallback : ressources du stock TELOS si catalogue vide
      if (!allRes.length && window._telosGroups) {
        Object.values(window._telosGroups).forEach(function(g) { allRes.push(g.name); });
      }
      allRes.sort(function(a,b){ return a.localeCompare(b,'fr'); });

      const resOptions = '<option value="">— Aucune ressource spécifique —</option>'
        + allRes.map(function(r){ return '<option value="'+r+'">'+r+'</option>'; }).join('');

      // Section récompense
      const rewardSection = ''
        + '<div class="form-field" style="margin-bottom:4px;">'
        + '<label class="form-lbl">Type de récompense</label>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;" id="nc-reward-type-group">'
        + '<button type="button" onclick="ncSetRewardType(\'auec\')" id="nc-rt-auec" class="btn primary" style="padding:4px 12px;font-size:11px;letter-spacing:1px;">◈ aUEC</button>'
        + '<button type="button" onclick="ncSetRewardType(\'empreinte\')" id="nc-rt-empreinte" class="btn" style="padding:4px 12px;font-size:11px;letter-spacing:1px;"><span style=\"filter:hue-rotate(200deg) saturate(2);font-size:13px;\">🫆</span> Empreinte</button>'
        + '<button type="button" onclick="ncSetRewardType(\'honneur\')" id="nc-rt-honneur" class="btn" style="padding:4px 12px;font-size:11px;letter-spacing:1px;"><span style=\"font-size:13px;\">🔱</span> Honneur</button>'
        + '</div></div>'
        + '<div id="nc-reward-auec" style="display:flex;gap:8px;align-items:center;">'
        + '<input class="form-input" type="number" id="nc-reward-amount" min="0" step="1000" placeholder="ex: 150000" style="flex:1;">'
        + '<span style="color:var(--orange);font-family:var(--mono);font-size:12px;white-space:nowrap;">aUEC</span>'
        + '</div>'
        + '<div id="nc-reward-empreinte" style="display:none;gap:8px;align-items:center;">'
        + '<input class="form-input" type="number" id="nc-reward-ep" min="1" step="1" placeholder="ex: 5" style="max-width:100px;">'
        + '<span style="color:#c084fc;font-family:var(--mono);font-size:12px;white-space:nowrap;"><span style=\"filter:hue-rotate(200deg) saturate(2);\">🫆</span> Points d&#39;Empreinte TELOS</span>'
        + '</div>'
        + '<div id="nc-reward-honneur" style="display:none;gap:8px;align-items:center;">'
        + '<input class="form-input" type="number" id="nc-reward-hn" min="1" step="1" placeholder="ex: 3" style="max-width:100px;">'
        + '<span style="color:#fbbf24;font-family:var(--mono);font-size:12px;white-space:nowrap;">🔱 Points d&#39;Honneur TELOS</span>'
        + '</div>';

      return '<div class="form-field"><label class="form-lbl">Titre de la mission <span class="req">*</span></label><input class="form-input" type="text" id="nc-title" placeholder="ex: Livraison Quantanium" maxlength="100"></div>'
        + '<div class="form-field"><label class="form-lbl">Ressource concernée</label>'
        + '<select class="form-input" id="nc-resource" style="height:auto;padding:9px 11px;">' + resOptions + '</select></div>'
        + '<div class="form-field"><label class="form-lbl">Description</label><textarea class="form-input" id="nc-desc" rows="2" placeholder="Détails de la mission..." style="resize:vertical;min-height:60px;"></textarea></div>'
        + '<div class="form-field">' + rewardSection + '</div>'
        + '<div class="form-field"><label class="form-lbl">Date limite</label><input class="form-input" type="date" id="nc-dl"></div>'
        + '<div class="form-field"><label class="form-lbl">Ic&ocirc;ne</label><div style="display:flex;gap:8px;flex-wrap:wrap;" id="nc-icon-picker">' + iconBtns + '</div>'
        + '<input type="hidden" id="nc-icon-sel" value="📋"></div>';
    },
    ok: async () => {
      if (!canManageRoles()) { toast('Accès refusé','Seuls les Admins et Gestionnaires peuvent créer des missions.','error'); return; }
      const title    = document.getElementById('nc-title')?.value.trim();
      const resource = document.getElementById('nc-resource')?.value.trim() || '';
      const desc     = document.getElementById('nc-desc')?.value.trim();
      const dlVal    = document.getElementById('nc-dl')?.value;
      const icon     = document.getElementById('nc-icon-sel')?.value || '📋';
      if (!title) { toast('Titre requis','','error'); return; }

      // Construire la récompense
      const rt = document.getElementById('nc-rt-auec')?.classList.contains('primary') ? 'auec'
               : document.getElementById('nc-rt-empreinte')?.classList.contains('primary') ? 'empreinte'
               : 'honneur';
      let reward = '';
      if (rt === 'auec') {
        const amt = parseInt(document.getElementById('nc-reward-amount')?.value) || 0;
        reward = amt ? '+' + amt.toLocaleString('fr-FR') + ' aUEC' : '—';
      } else if (rt === 'empreinte') {
        const ep = parseInt(document.getElementById('nc-reward-ep')?.value) || 0;
        reward = ep ? '+' + ep + ' 🫆 Empreinte' : '—';
      } else {
        const hn = parseInt(document.getElementById('nc-reward-hn')?.value) || 0;
        reward = hn ? '+' + hn + ' 🔱 Honneur' : '—';
      }

      const dl = dlVal ? new Date(dlVal).toLocaleDateString('fr-FR') : '—';
      const titleFull = resource ? title + ' — ' + resource : title;
      const newM = { id:'m'+Date.now(), icon, title:titleFull, desc:desc||'', reward, rewardType:rt, resource, status:'open', dl, assignedTo:null, assignedName:null, createdAt:new Date().toISOString() };
      MISSIONS.unshift(newM);
      await saveMissions();
      renderMissions();
      pushActivity('📋', 'Nouvelle mission : ' + titleFull, reward, true);
      toast('Mission créée', titleFull, 'success');
    },
  },

  'alerts':{
    title:'⚠ ALERTES ACTIVES',
    body:`<div class="act-item" style="padding:9px 0;border-bottom:1px solid var(--border)"><div class="act-icon" style="color:var(--orange)">⚠️</div><div class="act-text"><div class="act-desc">Stock critique : Laranite (<10 unités)</div><div class="act-time">il y a 3h</div></div></div><div class="act-item" style="padding:9px 0;border-bottom:1px solid var(--border)"><div class="act-icon" style="color:var(--orange)">⚠️</div><div class="act-text"><div class="act-desc">Bexalite +5.1% — opportunité non exploitée</div><div class="act-time">il y a 8h</div></div></div><div class="act-item" style="padding:9px 0;"><div class="act-icon" style="color:var(--orange)">⚠️</div><div class="act-text"><div class="act-desc">Contrat Orison expire dans 4h</div><div class="act-time">il y a 1h</div></div></div>`,
    ok:()=>toast('Alertes acquittées','Les 3 alertes ont été lues.','success'),
  },
  'settings':{
    title:'⚙ PARAMÈTRES',
    body: ()=>{
      const adminSection = isAdmin() ? '<div style="border-top:1px solid rgba(247,140,30,0.22);padding-top:14px;margin-top:18px;"><div style="font-size:11px;letter-spacing:2px;color:var(--orange);text-transform:uppercase;margin-bottom:10px;">⬡ ADMIN — Code Gestionnaire</div><div class="form-field" style="margin-bottom:8px;"><label class="form-lbl">Nouveau code d\'acc&egrave;s</label><input class="form-input" type="password" id="new-gest-code" placeholder="Nouveau code (min. 4 car.)..." maxlength="64"></div><div class="form-field"><label class="form-lbl">Confirmer le code</label><input class="form-input" type="password" id="new-gest-code2" placeholder="Confirmer..." maxlength="64"></div><div style="font-size:11px;color:var(--text-dim);margin-top:18px;">Code par d&eacute;faut : TELOS-CORP-2956</div></div>' : '';
      const backupSection = canManageRoles() ? '<div style="border-top:1px solid rgba(247,140,30,0.22);padding-top:14px;margin-top:18px;"><div style="font-size:11px;letter-spacing:2px;color:var(--orange);text-transform:uppercase;margin-bottom:10px;">◈ Sauvegarde des données</div><div style="display:flex;gap:8px;"><button class="btn primary" onclick="exportData()" style="flex:1;padding:8px;font-size:12px;letter-spacing:1px;">↓ EXPORTER JSON</button><label class="btn" style="flex:1;padding:8px;font-size:12px;letter-spacing:1px;text-align:center;cursor:pointer;">↑ IMPORTER JSON<input type="file" accept=".json" style="display:none;" onchange="importData(this.files[0])"></label></div><div style="font-size:11px;color:var(--text-dim);margin-top:18px;">Exportez r&eacute;guli&egrave;rement vos donn&eacute;es comme sauvegarde de secours.</div></div>' : '';
      return '<div class="form-field"><label class="form-lbl">Langue</label><select class="form-input"><option>Fran&ccedil;ais</option><option>English</option></select></div><div class="form-field"><label class="form-lbl">Mise &agrave; jour auto</label><select class="form-input"><option>Toutes les 30s</option><option>Toutes les 60s</option><option>Manuelle</option></select></div>' + backupSection + adminSection;
    },
    ok: async ()=>{
      if(isAdmin()){
        const c1=(document.getElementById('new-gest-code')||{}).value?.trim()||'';
        const c2=(document.getElementById('new-gest-code2')||{}).value?.trim()||'';
        if(c1.length>=4){
          if(c1!==c2){toast('Erreur','Les deux codes ne correspondent pas.','error');return;}
          const h=await sha256(c1);
          await DB.set(GESTIONNAIRE_CODE_KEY,h);
          _gestionnaireCodeHash=h;
          toast('Code Gestionnaire mis à jour','Le nouveau code est actif immédiatement.','success');
          return;
        }
      }
      toast('Paramètres sauvegardés','Configuration mise à jour.','success');
    },
  },

};
var currentModal=null;
function openModal(id){ const m=MODALS[id]; if(!m) return; currentModal=m; document.getElementById('modal-title').textContent=m.title; document.getElementById('modal-body').innerHTML=typeof m.body==='function'?m.body():m.body; document.getElementById('modal-overlay').classList.add('open'); }
function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); currentModal=null; }
async function confirmModal(){ if(currentModal?.ok) await currentModal.ok(); closeModal(); }

/* ════════════════════════════════════════════════════════════
   CONFIRM DIALOG
════════════════════════════════════════════════════════════ */
function showConfirm(title,msg,cb){ document.getElementById('cb-title').textContent=title; document.getElementById('cb-msg').innerHTML=msg; confirmCb=cb; document.getElementById('confirm-overlay').classList.add('open'); }
function closeConfirm(){ document.getElementById('confirm-overlay').classList.remove('open'); confirmCb=null; }
function execConfirm(){ if(confirmCb) confirmCb(); closeConfirm(); }

/* ════════════════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   STOCK PANEL — Accès conditionnel selon la session
════════════════════════════════════════════════════════════ */
function goToStock(el) {
  goPanel('joueurs', el);
  if (SESSION && !SESSION.isAdmin) {
    // Joueur connecté (non admin) → accès direct à son stock, sidebar masquée
    const sidebar = document.querySelector('.pl-sidebar');
    if (sidebar) sidebar.style.display = 'none';
    setTimeout(() => selectPlayer(SESSION.pid), 80);
  } else if (SESSION && SESSION.isAdmin) {
    // Admin → sidebar visible, peut voir tous les joueurs
    const sidebar = document.querySelector('.pl-sidebar');
    if (sidebar) sidebar.style.display = '';
  } else {
    // Pas de session → sidebar visible, liste complète
    const sidebar = document.querySelector('.pl-sidebar');
    if (sidebar) sidebar.style.display = '';
    // Ouvrir le modal de connexion si tentative d'action
  }
}

function refreshStockPanel() {
  // Appelé après login/logout pour mettre à jour l'affichage du panel stock
  if (document.getElementById('panel-joueurs').classList.contains('active')) {
    goToStock(document.getElementById('nav-joueurs'));
  }
}

/* ════════════════════════════════════════════════════════════
   CATALOGUE RESSOURCES — Admin/Gestionnaire uniquement
════════════════════════════════════════════════════════════ */
var RESSOURCE_CATALOGUE = [];
var _resCatFilter = 'all';

var CAT_LABELS = {
  mineral:'⛏ Minéraux', salvage:'🔧 Salvage', ressources:'📦 Ressources',
  equipements:'🛡 Équipements', armement:'⚔ Armement', accessoires:'🎒 Accessoires', autre:'○ Autre'
};

async function loadRessourceCatalogue() {
  const stored = await DB.get('telos-ressource-catalogue');
  if (stored && stored.length) {
    RESSOURCE_CATALOGUE = stored;
  } else {
    // Pas de catalogue stocké — on utilise syncFromUEXLocal comme fallback
    syncFromUEXLocal();
  }
}


function setResFilter(f, btn) {
  _resCatFilter = f;
  document.querySelectorAll('#panel-ressources .filter-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderRessources();
}

async function renderRessources() {
  const tbody = document.getElementById('res-tbody');
  if (!tbody) return;
  if (!canManageRoles()) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">Acces reserve aux Admins et Gestionnaires.</td></tr>';
    return;
  }
  const search = (document.getElementById('res-search')?.value||'').toLowerCase();
  let data = [...RESSOURCE_CATALOGUE];
  if (_resCatFilter !== 'all') data = data.filter(r=>r.cat===_resCatFilter);
  if (search) data = data.filter(r=>r.name.toLowerCase().includes(search)||(r.desc||'').toLowerCase().includes(search));
  data.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  const countEl = document.getElementById('res-count');
  if (countEl) countEl.textContent = data.length + ' ressource'+(data.length>1?'s':'');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">Aucune ressource — cliquez sur + AJOUTER</td></tr>';
    return;
  }
  const stockStats = {};
  for (const p of players) {
    const stocks = (await DB.get('uex-stocks-'+p.id))||[];
    for (const s of stocks) {
      if (!s.res) continue;
      const key = s.res.toLowerCase().trim();
      if (!stockStats[key]) stockStats[key]={qty:0,partners:new Set()};
      stockStats[key].qty += Number(s.qty)||0;
      stockStats[key].partners.add(p.id);
    }
  }
  const qBadge = (q) => q&&QUALITY_META[q]?.label
    ? '<span style="color:'+QUALITY_META[q].color+';font-size:10px;">'+QUALITY_META[q].label+'</span>'
    : '<span style="color:var(--text-dim);font-size:10px;">—</span>';
  tbody.innerHTML = data.map(r => {
    const key = r.name.toLowerCase().trim();
    const st = stockStats[key]||{qty:0,partners:new Set()};
    // margin calculée dans le rendu td ci-dessous
    return '<tr>'
      +'<td style="font-weight:700;color:var(--text-bright);">◈ '+esc(r.name)+(r.fromUEX?'<span style="font-size:8px;margin-left:5px;padding:1px 5px;border:1px solid rgba(89,208,255,0.4);color:var(--blue);letter-spacing:1px;">UEX</span>':'')+(r.desc?'<div style="font-size:10px;color:var(--text-dim);">'+esc(r.desc)+'</div>':'')+'</td>'
      +'<td><span style="font-size:11px;padding:2px 7px;border:1px solid var(--border);color:var(--text-dim);">'+(CAT_LABELS[r.cat]||r.cat)+'</span></td>'
      +'<td>'+qBadge(r.quality)+'</td>'
      +(()=>{
        const bMin = r.buyMin || r.buyRef || 0;
        const sMax = r.sellMax || r.sellRef || 0;
        const margin2 = bMin>0&&sMax>0 ? ((sMax-bMin)/bMin*100).toFixed(1) : null;
        return '<td class="td-dim">'
          + (bMin ? '<span style="font-size:11px;">'+bMin.toLocaleString('fr-FR')+' aUEC</span>'
            + '<div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;">ACHAT MIN</div>' : '—')
          + '</td>'
          + '<td style="color:var(--green);">'
          + (sMax ? '<span style="font-size:11px;">'+sMax.toLocaleString('fr-FR')+' aUEC</span>'
            + '<div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;">VENTE MAX</div>' : '—')
          + (margin2 ? '<div style="font-size:9px;color:var(--orange);">+'+margin2+'%</div>' : '')
          + '</td>';
      })()
      
      +'</tr>';
  }).join('');
}

function goToRessources(el) {
  if (!canManageRoles()) { toast('Acces refuse','Reserve aux Admins et Gestionnaires.','error'); return; }
  goPanel('ressources', el);
}

var SC_DB = {};
var _armTab = 'fps';

async function loadArmurieCatalogue() {
  const stored = await DB.get('telos-armurie-custom');
  if (stored && Array.isArray(stored)) ARMURIE_CATALOGUE = stored;
}

async function clearArmurieCatalogue() {
  if (!canManageRoles()) { toast('Accès refusé', 'Action réservée aux admins/gestionnaires.', 'error'); return; }
  if (!confirm('Vider tout le catalogue armurie ? Cette action est irréversible.')) return;
  ARMURIE_CATALOGUE = [];
  await DB.set('telos-armurie-custom', []);
  renderArmurie();
  toast('Catalogue vidé', 'Toutes les entrées armurie ont été supprimées.', 'info');
}

async function importBlueprintsToArmurieData() {
  const BP_ARMURE   = ['Helmet','Chest','Arms','Legs','Undersuit','Backpack','Core','Suit','Glove','Boot'];
  const BP_ARME_VAI = ['Cannon','Gun','Laser','Missile','Torpedo','Turret','Repeater','Distortion','Neutron','Ballistic','Beam','Scattergun'];

  function classifyBP(bp) {
    const n = (bp.name || '').toLowerCase();
    const cat = (bp.cat || '').toLowerCase();
    if (cat === 'fps') {
      if (BP_ARMURE.some(k => n.includes(k.toLowerCase()))) return 'armor';
      return 'fps';
    }
    if (cat === 'vaisseau' || cat === 'ship') {
      if (BP_ARME_VAI.some(k => n.includes(k.toLowerCase()))) return 'shipwep';
      return 'shipcomp';
    }
    if (cat === 'composant') return 'shipcomp';
    return 'fps';
  }

  const blueprints = (await DB.get('telos-blueprints')) || [];
  if (!blueprints.length) { toast('Aucun blueprint trouvé','','error'); return; }

  const existing = (await DB.get('telos-armurie-custom')) || [];
  const existingNames = new Set(existing.map(x => (x.name||'').toLowerCase()));

  var added = 0;
  const now = new Date().toISOString();

  blueprints.forEach(bp => {
    if (!bp.name) return;
    if (existingNames.has(bp.name.toLowerCase())) return;
    existing.push({
      id:       'arm_bp_' + (bp.id || Date.now() + '_' + Math.random().toString(36).slice(2,5)),
      name:     bp.name,
      tab:      classifyBP(bp),
      type:     '',
      prix:     0,
      loc:      '',
      note:     'Blueprint' + (bp.craftTime ? ' · ' + bp.craftTime : ''),
      fromBP:   true,
      bpId:     bp.id,
      addedAt:  now,
    });
    existingNames.add(bp.name.toLowerCase());
    added++;
  });

  await DB.set('telos-armurie-custom', existing);
  ARMURIE_CATALOGUE = existing;
  toast(added + ' items importés depuis les blueprints', '', 'success');
  renderArmurieCatalogue();
}

function setArmTab(tab, btn) {
  _armTab = tab;
  document.querySelectorAll('#panel-armurie [id^="arm-tab-"]').forEach(b => {
    b.style.borderBottom = '2px solid transparent';
    b.style.color = 'var(--text-dim)';
  });
  if (btn) { btn.style.borderBottom = '2px solid var(--orange)'; btn.style.color = 'var(--text-bright)'; }
  // Mettre à jour le filtre type
  _updateArmTypeFilter();
  renderArmurie();
}

function _updateArmTypeFilter() {
  const sel = document.getElementById('arm-type-filter');
  if (!sel) return;
  const data = SC_DB[_armTab] || [];
  const typeKey = _armTab === 'fps' ? 'type' : _armTab === 'armor' ? 'type' : _armTab === 'shipwep' ? 'type' : 'cat';
  const types = [...new Set(data.map(i => i[typeKey]).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Tous les types</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
}

// Ancienne fonction conservée pour compatibilité
function setArmFilter(cat, btn) { setArmTab(cat === 'all' ? 'fps' : cat, null); }

function renderArmurie() {
  const tbody  = document.getElementById('arm-tbody');
  const thead  = document.getElementById('arm-thead');
  if (!tbody) return;

  const q       = (document.getElementById('arm-search')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('arm-type-filter')?.value || '';
  const typeKey = _armTab === 'fps' ? 'type' : _armTab === 'armor' ? 'type' : _armTab === 'shipwep' ? 'type' : 'cat';

  // Fusionner DB intégrée + entrées custom
  let base = [...(SC_DB[_armTab] || [])];
  const custom = ARMURIE_CATALOGUE.filter(i => i.tab === _armTab);
  base = [...base, ...custom];

  if (typeFilter) base = base.filter(i => (i[typeKey]||'') === typeFilter);
  if (q) base = base.filter(i => i.name.toLowerCase().includes(q) || (i.type||'').toLowerCase().includes(q) || (i.cat||'').toLowerCase().includes(q));

  const countEl = document.getElementById('arm-count');
  if (countEl) countEl.textContent = base.length + ' entrée' + (base.length !== 1 ? 's' : '');

  // Headers selon catégorie
  const HEADERS = {
    fps:      ['Nom','Type','Calibre','DPS','Magasin','Cadence','Lieu','Prix aUEC'],
    armor:    ['Nom','Type','Tier','Résistance','Bonus','Lieu','Prix aUEC'],
    shipwep:  ['Nom','Taille','Type','DPS','Énergie','Portée (m)','Lieu','Prix aUEC'],
    shipcomp: ['Nom','Catégorie','Taille','Qualité','Stats 1','Stats 2','Lieu','Prix aUEC'],
  };
  if (thead) thead.innerHTML = '<tr><th style="width:30px;"></th>' + (HEADERS[_armTab]||[]).map(h => `<th>${h}</th>`).join('') + '</tr>';

  if (!base.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-dim);">Aucun résultat</td></tr>';
    return;
  }

  const fmt = n => n ? Number(n).toLocaleString('fr-FR') : '—';

  const _canEdit = canManageRoles();
  tbody.innerHTML = base.map(item => {
    let cells = '';
    if (_armTab === 'fps') {
      cells = `
        <td style="font-weight:700;color:var(--text-bright);">⚔ ${esc(item.name)}</td>
        <td><span style="font-size:10px;padding:1px 6px;border:1px solid var(--border);color:var(--text-dim);">${esc(item.type||'—')}</span></td>
        <td style="font-family:var(--mono);color:var(--orange);">${esc(item.cal||'—')}</td>
        <td style="font-family:var(--mono);color:var(--red);">${item.dps ? item.dps+'/s' : '—'}</td>
        <td style="font-family:var(--mono);">${item.magazin||'—'}</td>
        <td style="font-size:11px;color:var(--text-dim);">${esc(item.fire||'—')}</td>
        <td style="font-size:11px;color:var(--text-dim);">${esc(item.loc||'—')}</td>
        <td style="font-family:var(--mono);color:var(--green);">${item.prix ? fmt(item.prix)+' aUEC' : '—'}</td>`;
    } else if (_armTab === 'armor') {
      cells = `
        <td style="font-weight:700;color:var(--text-bright);">🛡 ${esc(item.name)}</td>
        <td><span style="font-size:10px;padding:1px 6px;border:1px solid var(--border);color:var(--text-dim);">${esc(item.type||'—')}</span></td>
        <td style="color:${item.tiers==='Heavy'?'var(--red)':item.tiers==='Medium'?'var(--orange)':'var(--green)'};">${esc(item.tiers||'—')}</td>
        <td style="font-family:var(--mono);color:var(--orange);">${esc(item.résistance||'—')}</td>
        <td style="font-size:11px;color:var(--blue);">${esc(item.bonus||'—')}</td>
        <td style="font-size:11px;color:var(--text-dim);">${esc(item.loc||'—')}</td>
        <td colspan="2" style="font-family:var(--mono);color:var(--green);">${item.prix ? fmt(item.prix)+' aUEC' : '—'}</td>`;
    } else if (_armTab === 'shipwep') {
      cells = `
        <td style="font-weight:700;color:var(--text-bright);">🚀 ${esc(item.name)}</td>
        <td style="font-family:var(--mono);color:var(--orange);">${esc(item.taille||'—')}</td>
        <td><span style="font-size:10px;padding:1px 6px;border:1px solid var(--border);color:var(--text-dim);">${esc(item.type||'—')}</span></td>
        <td style="font-family:var(--mono);color:var(--red);">${item.dps ? fmt(item.dps)+'/s' : '—'}</td>
        <td style="font-family:var(--mono);color:var(--text-dim);">${item.energie !== undefined ? item.energie+'u' : '—'}</td>
        <td style="font-family:var(--mono);">${item.portée ? fmt(item.portée)+'m' : '—'}</td>
        <td style="font-size:11px;color:var(--text-dim);">${esc(item.loc||'—')}</td>
        <td style="font-family:var(--mono);color:var(--green);">${item.prix ? fmt(item.prix)+' aUEC' : '—'}</td>`;
    } else {
      const s1 = item.hp ? 'HP '+item.hp : item.tp ? 'Thrust '+item.tp+'kN' : item.vitesse ? item.vitesse+'Mm/s' : item.pw ? 'PW '+item.pw : item.ir || item.portée ? (item.portée ? item.portée+'m' : item.ir) : item.capa || '—';
      const s2 = item.regen && item.regen !== '—' ? 'Regen '+item.regen : item.eff ? 'Eff '+item.eff : item.refresh || '—';
      cells = `
        <td style="font-weight:700;color:var(--text-bright);">⚙ ${esc(item.name)}</td>
        <td><span style="font-size:10px;padding:1px 6px;border:1px solid var(--border);color:var(--text-dim);">${esc(item.cat||'—')}</span></td>
        <td style="font-family:var(--mono);color:var(--orange);">${esc(item.taille||'—')}</td>
        <td style="color:${item.qualité==='A'?'var(--green)':item.qualité==='B'?'var(--orange)':'var(--text-dim)'};">${esc(item.qualité||'—')}</td>
        <td style="font-family:var(--mono);font-size:11px;">${esc(s1)}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text-dim);">${esc(s2)}</td>
        <td style="font-size:11px;color:var(--text-dim);">${esc(item.loc||'—')}</td>
        <td style="font-family:var(--mono);color:var(--green);">${item.prix ? fmt(item.prix)+' aUEC' : '—'}</td>`;
    }
    const editBtn = _canEdit
      ? `<td style="width:30px;text-align:center;"><button data-action="arm-cat-edit" data-id="${esc(item.id||('scdb_'+item.name))}" style="background:transparent;border:none;color:var(--text-dim);cursor:pointer;font-size:13px;padding:2px 5px;" title="Modifier">✎</button></td>`
      : '<td></td>';
    return `<tr onmouseover="this.style.background='rgba(247,140,30,0.04)'" onmouseout="this.style.background=''">${editBtn}${cells}</tr>`;
  }).join('');
}

function addArmurieItem() {
  if (!canManageRoles()) { toast('Accès refusé', 'Réservé aux Admins et Gestionnaires.', 'error'); return; }
  const name = prompt('Nom de l\'équipement :');
  if (!name || !name.trim()) return;
  const type = prompt('Type (ex: Fusil d\'assaut, Bouclier...) :', '') || '';
  const prix = parseInt(prompt('Prix en aUEC (0 si inconnu) :', '0')) || 0;
  ARMURIE_CATALOGUE.push({ tab: _armTab, name: name.trim(), type, prix, custom: true });
  DB.set('telos-armurie-custom', ARMURIE_CATALOGUE);
  renderArmurie();
  toast('Entrée ajoutée', name.trim() + ' ajouté à la base armurie.', 'success');
}


var _armCatEditId   = null;  // id item en cours d'édition
var _armCatEditScdb = false; // true = item SC_DB (pas de custom existant)

// ── Ouvre le modal d'édition catalogue armurie ──────────────────────────────
function openArmCatEdit(rawId) {
  if (!canManageRoles()) { toast('Accès refusé', 'Réservé aux Admins et Gestionnaires.', 'error'); return; }

  // Chercher d'abord dans les items custom
  var custom = ARMURIE_CATALOGUE.find(i => i.id === rawId);

  // Si pas trouvé → item SC_DB, on crée un override à la volée
  var item   = custom || null;
  var isScdb = !custom;

  // Trouver dans SC_DB si besoin (pour pré-remplir les champs)
  var scdbItem = null;
  if (isScdb) {
    ['fps','armor','shipwep','shipcomp'].forEach(function(tab) {
      var found = (SC_DB[tab]||[]).find(function(x){ return ('scdb_'+x.name)===rawId || x.id===rawId; });
      if (found) scdbItem = Object.assign({}, found, {tab: tab});
    });
  }

  var src = item || scdbItem || {};

  _armCatEditId   = rawId;
  _armCatEditScdb = isScdb;

  var tab = src.tab || _armTab || 'fps';

  // Peupler les champs
  var s = function(id,v){ var el=document.getElementById(id); if(el) el.value=(v===undefined||v===null)?'':v; };
  s('acet-tab',   tab);
  s('acet-name',  src.name||'');
  s('acet-type',  src.type||'');
  // Champs selon tab
  s('acet-cal',   src.cal||src.taille||src.tier||src.qualité||'');
  s('acet-dps',   src.dps||'');
  s('acet-mag',   src.magazin||src.energie||src.hp||'');
  s('acet-fire',  src.fire||src.portée||src.résistance||'');
  s('acet-bonus', src.bonus||src.note||'');
  s('acet-loc',   src.loc||'');
  s('acet-prix',  src.prix||'');
  s('acet-note',  isScdb ? '' : (src.note||''));

  // Notice SC_DB
  var notice = document.getElementById('acet-scdb-notice');
  if (notice) notice.style.display = isScdb ? '' : 'none';

  // Titre
  var title = document.getElementById('arm-cat-edit-title');
  if (title) title.textContent = '✏ MODIFIER — ' + (src.name||'...');

  // Boutons catégorie
  selectArmCatEdit(tab);

  // Champ nom: désactivé pour SC_DB
  var nameEl = document.getElementById('acet-name');
  if (nameEl) nameEl.disabled = isScdb;

  document.getElementById('arm-cat-edit-overlay').classList.add('open');
}

function selectArmCatEdit(tab) {
  var el = document.getElementById('acet-tab');
  if (el) el.value = tab;

  document.querySelectorAll('#arm-cat-edit-overlay .cat-sel-btn').forEach(function(b) {
    var on = b.dataset.acet === tab;
    b.style.borderColor = on ? 'var(--orange)' : 'var(--border)';
    b.style.color       = on ? 'var(--orange)' : 'var(--text-dim)';
    b.style.background  = on ? 'rgba(247,140,30,0.1)' : 'transparent';
  });

  // Adapter les labels selon le tab
  var lblCal   = document.getElementById('acet-lbl-cal');
  var lblMag   = document.getElementById('acet-lbl-mag');
  var lblFire  = document.getElementById('acet-lbl-fire');
  var lblBonus = document.getElementById('acet-lbl-bonus');
  var lblType  = document.getElementById('acet-lbl-type');

  if (tab === 'fps') {
    if (lblCal)   lblCal.textContent   = 'Calibre';
    if (lblMag)   lblMag.textContent   = 'Magasin';
    if (lblFire)  lblFire.textContent  = 'Cadence';
    if (lblBonus) lblBonus.textContent = 'Note';
    if (lblType)  lblType.textContent  = 'Type';
  } else if (tab === 'armor') {
    if (lblCal)   lblCal.textContent   = 'Tier (Light/Medium/Heavy)';
    if (lblMag)   lblMag.textContent   = 'Résistance';
    if (lblFire)  lblFire.textContent  = 'Portée / Stats';
    if (lblBonus) lblBonus.textContent = 'Bonus';
    if (lblType)  lblType.textContent  = 'Type';
  } else if (tab === 'shipwep') {
    if (lblCal)   lblCal.textContent   = 'Taille (S1–S10)';
    if (lblMag)   lblMag.textContent   = 'Énergie (u)';
    if (lblFire)  lblFire.textContent  = 'Portée (m)';
    if (lblBonus) lblBonus.textContent = 'Note';
    if (lblType)  lblType.textContent  = 'Type';
  } else {
    if (lblCal)   lblCal.textContent   = 'Taille';
    if (lblMag)   lblMag.textContent   = 'Stats 1';
    if (lblFire)  lblFire.textContent  = 'Stats 2';
    if (lblBonus) lblBonus.textContent = 'Qualité (A/B/C)';
    if (lblType)  lblType.textContent  = 'Catégorie';
  }
}

async function saveArmCatEdit() {
  if (!canManageRoles()) { toast('Accès refusé', '', 'error'); return; }

  var tab   = document.getElementById('acet-tab')?.value   || _armTab;
  var name  = document.getElementById('acet-name')?.value.trim();
  if (!name) { toast('Nom requis', '', 'error'); return; }

  var g = function(id){ var e=document.getElementById(id); return e?e.value.trim():''; };

  // Construire l'objet selon le tab
  var base = {
    id:      _armCatEditId,
    tab:     tab,
    name:    name,
    type:    g('acet-type'),
    loc:     g('acet-loc'),
    prix:    parseFloat(g('acet-prix'))||0,
    note:    g('acet-note'),
    custom:  true,
  };

  if (tab === 'fps') {
    base.cal     = g('acet-cal');
    base.dps     = parseFloat(g('acet-dps'))||null;
    base.magazin = g('acet-mag');
    base.fire    = g('acet-fire');
  } else if (tab === 'armor') {
    base.tiers      = g('acet-cal');
    base.résistance = g('acet-mag');
    base.bonus      = g('acet-bonus');
  } else if (tab === 'shipwep') {
    base.taille  = g('acet-cal');
    base.dps     = parseFloat(g('acet-dps'))||null;
    base.energie = parseFloat(g('acet-mag'))||null;
    base.portée  = parseFloat(g('acet-fire'))||null;
  } else {
    base.taille  = g('acet-cal');
    base.qualité = g('acet-bonus');
  }

  if (_armCatEditScdb) {
    // Item SC_DB : créer un override dans ARMURIE_CATALOGUE
    // L'id reste 'scdb_<name>' pour pouvoir matcher si besoin
    base.fromScdb = true;
    base.id = 'scdb_override_' + name.replace(/\s+/g,'_').toLowerCase();
    ARMURIE_CATALOGUE.push(base);
  } else {
    // Item custom existant : mettre à jour
    var idx = ARMURIE_CATALOGUE.findIndex(function(i){ return i.id === _armCatEditId; });
    if (idx >= 0) ARMURIE_CATALOGUE[idx] = base;
    else ARMURIE_CATALOGUE.push(base);
  }

  await DB.set('telos-armurie-custom', ARMURIE_CATALOGUE);
  closeArmCatEdit();
  renderArmurie();
  toast('Entrée mise à jour', name, 'success');
}

function closeArmCatEdit() {
  var o = document.getElementById('arm-cat-edit-overlay');
  if (o) o.classList.remove('open');
  _armCatEditId = null;
  _armCatEditScdb = false;
}


var _objTab = 'tous';
var _editObjId = null;

var OBJ_CAT_LABELS = { ressource:'📦 Ressource', craft:'🔧 Craft', autre:'○ Autre' };
var OBJ_PRIO_COLORS = { normale:'var(--text-dim)', haute:'var(--orange)', critique:'var(--red)' };
var OBJ_PRIO_LABELS = { normale:'⚪ Normale', haute:'🟠 Haute', critique:'🔴 Critique' };

async function loadObjectifs() {
  OBJECTIFS = (await DB.get('telos-objectifs')) || [];
  renderObjectifs();
}

async function saveObjectifs() {
  await DB.set('telos-objectifs', OBJECTIFS);
}

function setObjTab(tab, btn) {
  _objTab = tab;
  document.querySelectorAll('.obj-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderObjectifs();
}

function renderObjectifs() {
  const el = document.getElementById('obj-list');
  if (!el) return;

  let data = [...OBJECTIFS];
  if (_objTab !== 'tous') data = data.filter(o => o.cat === _objTab);

  // Trier : en cours en haut, terminés en bas, puis par priorité
  const prioOrder = { critique: 0, haute: 1, normale: 2 };
  data.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (prioOrder[a.priority] || 2) - (prioOrder[b.priority] || 2);
  });

  // Barre de progression globale
  const total = OBJECTIFS.length;
  const done  = OBJECTIFS.filter(o => o.done).length;
  const pct   = total ? Math.round(done / total * 100) : 0;
  const fill  = document.getElementById('obj-progress-fill');
  const lbl   = document.getElementById('obj-progress-label');
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent  = done + ' / ' + total + ' (' + pct + '%)';

  // Badge nav
  const inProgress = OBJECTIFS.filter(o => !o.done).length;
  const badge = document.getElementById('badge-objectifs');
  if (badge) {
    badge.textContent = inProgress;
    badge.style.display = inProgress > 0 ? '' : 'none';
  }

  if (!data.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:12px;letter-spacing:1px;">' +
      '🎯<br><br>Aucun objectif' + (_objTab !== 'tous' ? ' dans cette catégorie' : '') + '.<br>' +
      '<span style="color:var(--orange);cursor:pointer;" onclick="openAddObjectif()">+ Créer le premier objectif</span></div>';
    return;
  }

  el.innerHTML = data.map(o => {
    const pct2 = o.target > 0 ? Math.min(100, Math.round((o.current || 0) / o.target * 100)) : (o.done ? 100 : 0);
    const col  = OBJ_PRIO_COLORS[o.priority] || 'var(--text-dim)';
    const dl   = o.dl ? '<span style="font-size:10px;color:var(--text-dim);">⏱ ' + o.dl + '</span>' : '';
    const rew  = o.reward ? '<span style="font-size:10px;color:var(--green);">◈ ' + esc(o.reward) + '</span>' : '';
    const progBar = o.target > 0 ? `
      <div class="obj-prog-wrap">
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-dim);">
          <span>${(o.current||0).toLocaleString('fr-FR')} ${esc(o.unit||'')} / ${Number(o.target).toLocaleString('fr-FR')} ${esc(o.unit||'')}</span>
          <span style="color:${pct2>=100?'var(--green)':'var(--orange)'};">${pct2}%</span>
        </div>
        <div class="obj-prog-bg"><div class="obj-prog-fill" style="width:${pct2}%;"></div></div>
      </div>` : '';
    return `<div class="obj-card ${o.done?'done':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div style="flex:1;">
          <div class="obj-title">${o.done?'✓ ':''} ${esc(o.title)}</div>
          ${o.desc ? '<div class="obj-desc">' + esc(o.desc) + '</div>' : ''}
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;">
          ${SESSION ? '<button data-action="obj-edit" data-id="'+o.id+'" style="padding:3px 10px;border:1px solid var(--orange);color:var(--orange);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);letter-spacing:1px;">✏ ÉDITER</button>' : ''}
          ${!o.done && SESSION ? '<button data-action="obj-toggle" data-id="'+o.id+'" style="padding:3px 10px;border:1px solid var(--green);color:var(--green);background:rgba(0,255,163,0.07);cursor:pointer;font-size:10px;font-family:var(--ui);letter-spacing:1px;font-weight:700;">✓ VALIDER</button>' : ''}
          ${o.done && SESSION ? '<button data-action="obj-toggle" data-id="'+o.id+'" style="padding:3px 10px;border:1px solid var(--text-dim);color:var(--text-dim);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);letter-spacing:1px;">↺ RÉACTIVER</button>' : ''}
          ${canManageRoles() ? '<button data-action="obj-delete" data-id="'+o.id+'" style="padding:3px 8px;border:1px solid rgba(255,68,68,0.4);color:var(--red);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);">✕</button>' : ''}
        </div>
      </div>
      <div class="obj-meta">
        <span class="obj-badge" style="color:${col};border-color:${col};">${OBJ_PRIO_LABELS[o.priority]||o.priority}</span>
        <span class="obj-badge" style="color:var(--blue);border-color:var(--blue);">${OBJ_CAT_LABELS[o.cat]||o.cat}</span>
        ${o.autoCreated ? '<span class="obj-badge" style="color:var(--orange);border-color:var(--orange);background:rgba(247,140,30,0.08);">⚙ AUTO</span>' : ''}
        ${o.cmdId ? `<span class="obj-badge" style="color:var(--text-dim);border-color:var(--border);cursor:pointer;" onclick="goPanel('commandes')" title="Voir la commande source">📋 Commande liée</span>` : ''}
        ${dl} ${rew}
      </div>
      ${progBar}
      ${o.target > 0 && !o.done && SESSION ? `
      <div style="margin-top:8px;display:flex;gap:6px;align-items:center;">
        <input type="number" min="0" max="${o.target}" step="1" value="${o.current||0}"
          style="width:90px;padding:4px 8px;background:var(--bg3);border:1px solid var(--border);color:var(--text-bright);font-family:var(--mono);font-size:11px;"
          onchange="updateObjProgress('${o.id}', this.value)">
        <span style="font-size:10px;color:var(--text-dim);">${esc(o.unit||'unités')}</span>
        <button onclick="updateObjProgress('${o.id}', document.querySelector('[data-obj-id=\'${o.id}\']')?.value || this.previousElementSibling.previousElementSibling.value)"
          data-obj-id="${o.id}"
          style="padding:3px 10px;border:1px solid var(--orange);color:var(--orange);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);">Mettre à jour</button>
      </div>` : ''}
      ${o.ingredients && o.ingredients.length ? `
      <div style="margin-top:10px;border-top:1px solid rgba(247,140,30,0.1);padding-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:9px;letter-spacing:1.5px;color:#60a5fa;text-transform:uppercase;">${o.autoCreated ? '⚠ Ressources à approvisionner' : '📐 Ingrédients Blueprint'}</div>
          ${!o.done ? '<button data-action="obj-check-stock" data-id="'+o.id+'" style="padding:1px 8px;border:1px solid rgba(89,208,255,0.4);background:transparent;color:#59d0ff;font-family:var(--ui);font-size:9px;cursor:pointer;letter-spacing:1px;">⟳ STOCK</button>' : ''}
        </div>
        ${o._stockInfo ? `<div style="margin-bottom:6px;padding:5px 8px;background:var(--bg);border:1px solid ${o._stockInfo.allOk ? 'rgba(0,255,163,0.25)' : 'rgba(255,68,68,0.25)'};border-left:3px solid ${o._stockInfo.allOk ? 'var(--green)' : 'var(--red)'};font-size:9px;font-family:var(--mono);">
          ${o._stockInfo.allOk ? '✅ Stock net suffisant — toutes les ressources disponibles' : '⚠ Stock insuffisant (hors commandes actives)'}
          <div style="margin-top:4px;display:flex;flex-direction:column;gap:2px;">
          ${o._stockInfo.lines.map(l => '<span style="color:' + (l.ok ? 'var(--green)' : 'var(--red)') + ';">'
            + (l.ok ? '✓' : '✗') + ' ' + esc(l.name)
            + ' : net ' + l.netVal + ' SCU'
            + (l.resVal > 0 ? ' (brut ' + l.brutVal + ' − réservé ' + l.resVal + ')' : ' (brut ' + l.brutVal + ')')
            + ' / requis ' + l.needed + ' SCU</span>').join('')}
          </div>
        </div>` : ''}
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${o.ingredients.map((ing,idx) => {
            const pct = ing.qty>0 ? Math.min(100,Math.round((ing.collected||0)/ing.qty*100)) : 0;
            const done2 = pct >= 100;
            return '<div style="background:var(--bg3);padding:6px 10px;border:1px solid '+(done2?'var(--green)':'var(--border)')+';border-left:3px solid '+(done2?'var(--green)':'var(--border)')+';">'
              +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">'
              +'<span style="font-size:11px;color:'+(done2?'var(--green)':'var(--text-bright)')+';font-weight:600;">'+(done2?'✓ ':'')+esc(ing.name)+'</span>'
              +'<div style="display:flex;align-items:center;gap:5px;">'
              +(SESSION && !o.done ? '<input type="number" min="0" max="'+ing.qty+'" step="1" value="'+(ing.collected||0)+'"'
                +' style="width:65px;padding:2px 6px;background:var(--bg);border:1px solid var(--border);color:var(--orange);font-family:var(--mono);font-size:10px;text-align:center;"'
                +' onchange="updateIngredient('+JSON.stringify(o.id)+','+idx+',this.value)">'
                +'<span style="font-size:10px;color:var(--text-dim);">/ '+ing.qty+' SCU</span>' : '<span style="font-size:10px;color:var(--text-dim);">'+(ing.collected||0)+' / '+ing.qty+' SCU</span>')
              +'</div></div>'
              +'<div style="height:3px;background:var(--bg);border-radius:2px;overflow:hidden;"><div style="height:100%;background:'+(done2?'var(--green)':'var(--orange)')+';width:'+pct+'%;transition:width 0.3s;"></div></div>'
              +'</div>';
          }).join('')}
        </div>
      </div>` : ''}
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   OBJECTIFS × BLUEPRINTS — Sélection et suivi des ingrédients
════════════════════════════════════════════════════════════ */
var _objIngredients = []; // [{name, qty, collected}]

// ── Actions selon le select Action ──
var OBJ_ACTION_LABELS = { collecter:'Collecter', craft:'Crafter', livraison:'Livrer', mission:'Mission', commerce:'Vendre', autre:'Objectif' };
var OBJ_ACTION_UNIT   = { collecter:'SCU', craft:'unité(s)', livraison:'SCU', mission:'', commerce:'aUEC', autre:'' };
var OBJ_ACTION_CAT    = { collecter:'ressource', craft:'craft', livraison:'ressource', mission:'autre', commerce:'commerce', autre:'autre' };

function onObjActionChange(val) {
  const resField = document.getElementById('obj-res-field');
  const bpField  = document.getElementById('obj-bp-field');
  const ingField = document.getElementById('obj-ingredients-field');
  const showRes  = ['collecter','livraison','commerce'].includes(val);
  const showBp   = val === 'craft';
  if (resField) resField.style.display = showRes ? '' : 'none';
  if (bpField)  { bpField.style.display = showBp ? '' : 'none'; if (showBp) populateObjBpSelect(); }
  if (ingField) ingField.style.display = showBp && _objIngredients.length ? 'flex' : 'none';
  const catEl = document.getElementById('obj-cat');
  if (catEl) catEl.value = OBJ_ACTION_CAT[val] || 'autre';
  const unitEl = document.getElementById('obj-unit');
  if (unitEl && !unitEl._userEdited) unitEl.value = OBJ_ACTION_UNIT[val] || '';
  if (!showBp) { _objIngredients = []; refreshObjIngredients(); }
  autoGenObjTitle();
}

function onObjResSelect(val) {
  const customEl = document.getElementById('obj-res-custom');
  if (val && customEl) customEl.value = '';
  autoGenObjTitle();
}

function onObjQualityChange(val) {
  const badge = document.getElementById('obj-quality-badge');
  if (!badge) return;
  if (!val) { badge.style.display = 'none'; return; }
  const meta = QUALITY_META[val];
  if (!meta || !meta.label) { badge.style.display = 'none'; return; }
  const bucketMap = { mediocre:'🔴 Vente uniquement', basique:'🟢 500<', acceptable:'🟢 500<',
    honnete:'🟢 500<', moyenne:'🟢 500<', haute:'🟢 500<' };
  badge.style.display = 'block';
  badge.style.borderLeftColor = meta.color;
  badge.style.color = meta.color;
  badge.textContent = meta.label + '  ·  SCU ' + meta.score + '  →  ' + (bucketMap[val] || '');
}

function onObjResCustom(val) {
  const selEl = document.getElementById('obj-res-select');
  if (val && selEl) selEl.value = '';
  autoGenObjTitle();
}

function getObjResName() {
  return document.getElementById('obj-res-select')?.value
      || document.getElementById('obj-res-custom')?.value.trim()
      || '';
}

function autoGenObjTitle() {
  const titleEl = document.getElementById('obj-title');
  if (!titleEl || titleEl._userEdited) return;
  const action = document.getElementById('obj-action')?.value || 'autre';
  const label  = OBJ_ACTION_LABELS[action] || 'Objectif';
  const qty    = document.getElementById('obj-target')?.value || '';
  const unit   = document.getElementById('obj-unit')?.value || '';
  const res    = getObjResName();
  const bp     = document.getElementById('obj-bp-select');
  const bpName = bp?.selectedIndex > 0 ? bp.options[bp.selectedIndex].text : '';
  let title = label;
  if (action === 'craft' && bpName) title = 'Crafter : ' + bpName;
  else if (res) title = label + (qty?' '+qty:'') + (unit?' '+unit:'') + ' — ' + res;
  else if (qty) title = label + ' ' + qty + (unit?' '+unit:'');
  titleEl.value = title;
}

function populateObjResSelect() {
  const sel = document.getElementById('obj-res-select');
  if (!sel) return;
  const resources = RESSOURCE_CATALOGUE.length ? RESSOURCE_CATALOGUE : (UEX_COMMODITIES || []);
  const opts = resources.map(r => r.name || r.commodity_name || r).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  sel.innerHTML = '<option value="">— Sélectionner —</option>'
    + opts.map(name => '<option value="'+name+'">'+name+'</option>').join('');
}

function onObjCatChange(cat) {
  // compat — no-op, géré par onObjActionChange
}

function populateObjBpSelect(selectedId) {
  const sel = document.getElementById('obj-bp-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Sélectionner un blueprint —</option>';
  const cats = { vaisseau:'🚀 Vaisseau', fps:'🛡 FPS', composant:'🔧 Composant', autre:'○ Autre' };
  const groups = {};
  BLUEPRINTS.forEach(b => {
    const c = b.cat || 'autre';
    if (!groups[c]) groups[c] = [];
    groups[c].push(b);
  });
  Object.entries(cats).forEach(([cat, label]) => {
    if (!groups[cat]?.length) return;
    const og = document.createElement('optgroup');
    og.label = label;
    groups[cat].sort((a,b)=>a.name.localeCompare(b.name,'fr')).forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      if (b.id === selectedId) opt.selected = true;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
  if (!BLUEPRINTS.length) {
    const opt = document.createElement('option');
    opt.value = ''; opt.disabled = true;
    opt.textContent = 'Aucun blueprint — ajoutez-en dans l&#39;onglet Blueprints';
    sel.appendChild(opt);
  }
}

function onObjBpSelect(bpId) {
  const prev = document.getElementById('obj-bp-preview');
  const ingField = document.getElementById('obj-ingredients-field');
  if (!bpId) {
    if (prev) prev.style.display = 'none';
    if (ingField) ingField.style.display = 'none';
    _objIngredients = [];
    refreshObjIngredients();
    return;
  }
  const bp = BLUEPRINTS.find(x => x.id === bpId);
  if (!bp) return;

  // Aperçu du blueprint
  if (prev) {
    prev.style.display = 'block';
    prev.innerHTML = '<span style="color:#60a5fa;font-weight:700;">📐 ' + esc(bp.name) + '</span>'
      + (bp.outputQty > 1 ? ' <span style="color:var(--text-dim);">× ' + bp.outputQty + '</span>' : '')
      + (bp.ingredients?.length
        ? '<div style="margin-top:5px;color:var(--text-dim);">Ingrédients : '
          + bp.ingredients.map(i => '<span style="color:var(--text-bright);">' + esc(i.name) + '</span> ×' + i.qty).join(', ')
          + '</div>'
        : '<div style="color:var(--text-dim);margin-top:3px;">Aucun ingrédient défini</div>');
  }

  // Auto-remplir le titre si vide
  const titleEl = document.getElementById('obj-title');
  if (titleEl && !titleEl.value.trim()) titleEl.value = 'Craft : ' + bp.name;

  // Générer les ingrédients
  _objIngredients = (bp.ingredients || []).map(i => ({
    name: i.name, qty: i.qty, collected: 0
  }));
  refreshObjIngredients();
  if (ingField) ingField.style.display = _objIngredients.length ? 'flex' : 'none';
}

function refreshObjIngredients() {
  const el = document.getElementById('obj-ingredients-list');
  if (!el) return;
  if (!_objIngredients.length) { el.innerHTML = ''; return; }
  el.innerHTML = _objIngredients.map((ing, idx) => {
    const pct = ing.qty > 0 ? Math.min(100, Math.round(ing.collected / ing.qty * 100)) : 0;
    return '<div style="background:var(--bg3);padding:7px 10px;border:1px solid var(--border);border-left:3px solid '
      + (pct >= 100 ? 'var(--green)' : 'var(--border)') + ';">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
      + '<span style="font-size:12px;color:' + (pct>=100?'var(--green)':'var(--text-bright)') + ';font-weight:600;">'
      + (pct>=100?'✓ ':'') + esc(ing.name) + '</span>'
      + '<span style="font-size:10px;font-family:var(--mono);color:var(--orange);">' + ing.collected + ' / ' + ing.qty + ' SCU</span>'
      + '</div>'
      + '<div style="height:3px;background:var(--bg);border-radius:2px;overflow:hidden;">'
      + '<div style="height:100%;background:' + (pct>=100?'var(--green)':'var(--orange)') + ';width:' + pct + '%;transition:width 0.3s;"></div>'
      + '</div>'
      + '</div>';
  }).join('');
}

function openAddObjectif(editId) {
  editId = editId || null;
  _editObjId = editId;
  const o = editId ? OBJECTIFS.find(x => x.id === editId) : null;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

  // Peupler le select ressources depuis le catalogue
  populateObjResSelect();

  // Détecter l'action depuis la catégorie existante
  const catToAction = { ressource:'collecter', craft:'craft', commerce:'commerce', autre:'autre' };
  const action = o?.action || catToAction[o?.cat] || 'collecter';
  set('obj-action',   action);
  onObjActionChange(action);  // met à jour visibilité des champs

  // Remplir les champs
  set('obj-title',    o?.title    || '');
  set('obj-cat',      o?.cat      || OBJ_ACTION_CAT[action] || 'ressource');
  set('obj-priority', o?.priority || 'normale');
  set('obj-desc',     o?.desc     || '');
  set('obj-target',   o?.target   || '');
  set('obj-unit',     o?.unit     || OBJ_ACTION_UNIT[action] || 'SCU');
  set('obj-current',  o?.current  || 0);
  set('obj-dl',       o?.dl       || '');
  set('obj-reward',   o?.reward   || '');
  // Qualité requise
  const qSel = document.getElementById('obj-quality');
  if (qSel) { qSel.value = o?.quality || ''; onObjQualityChange(o?.quality || ''); }

  // Ressource
  if (o?.resource) {
    const resSel = document.getElementById('obj-res-select');
    if (resSel) {
      const opt = Array.from(resSel.options).find(op => op.value === o.resource);
      if (opt) resSel.value = o.resource;
      else { set('obj-res-custom', o.resource); }
    }
  }

  // Blueprint
  if (action === 'craft' && o?.bpId) {
    const selBp = document.getElementById('obj-bp-select');
    if (selBp) { selBp.value = o.bpId; onObjBpSelect(o.bpId); }
  }

  // Ingrédients
  _objIngredients = o?.ingredients ? o.ingredients.map(i => ({...i})) : [];
  refreshObjIngredients();
  const ingField = document.getElementById('obj-ingredients-field');
  if (ingField) ingField.style.display = _objIngredients.length ? 'flex' : 'none';

  // Titre modal
  const titleEl = document.getElementById('obj-modal-title');
  if (titleEl) titleEl.textContent = editId ? "✏ MODIFIER L'OBJECTIF" : "🎯 CRÉER UN OBJECTIF";

  // Flag userEdited sur le titre pour éviter l'auto-gen si édition
  const titleInput = document.getElementById('obj-title');
  if (titleInput) {
    titleInput._userEdited = !!editId;
    titleInput.addEventListener('input', () => { titleInput._userEdited = true; }, { once: true });
  }
  const unitInput = document.getElementById('obj-unit');
  if (unitInput) {
    unitInput._userEdited = !!editId;
    unitInput.addEventListener('input', () => { unitInput._userEdited = true; }, { once: true });
  }

  document.getElementById('obj-overlay').classList.add('open');
}

function closeAddObjectif() {
  document.getElementById('obj-overlay').classList.remove('open');
  _editObjId = null;
}

async function saveObjectif() {
  const title = document.getElementById('obj-title')?.value.trim();
  if (!title) { toast('Titre requis', '', 'error'); return; }
  const bpId    = document.getElementById('obj-bp-select')?.value || '';
  const action  = document.getElementById('obj-action')?.value   || 'collecter';
  const resource = getObjResName();
  const quality  = document.getElementById('obj-quality')?.value  || '';
  const entry = {
    id:          _editObjId || ('obj_' + Date.now()),
    title,
    action,
    resource,
    cat:         document.getElementById('obj-cat')?.value      || OBJ_ACTION_CAT[action] || 'ressource',
    quality,
    priority:    document.getElementById('obj-priority')?.value || 'normale',
    desc:        document.getElementById('obj-desc')?.value.trim()   || '',
    target:      parseFloat(document.getElementById('obj-target')?.value) || 0,
    unit:        document.getElementById('obj-unit')?.value.trim()   || '',
    current:     parseFloat(document.getElementById('obj-current')?.value) || 0,
    dl:          document.getElementById('obj-dl')?.value || '',
    reward:      document.getElementById('obj-reward')?.value.trim() || '',
    bpId:        bpId || '',
    ingredients: _objIngredients.map(i => ({...i})),
    done:        _editObjId ? (OBJECTIFS.find(x => x.id === _editObjId)?.done || false) : false,
    createdAt:   _editObjId ? (OBJECTIFS.find(x => x.id === _editObjId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
  };
  if (_editObjId) {
    OBJECTIFS = OBJECTIFS.map(x => x.id === _editObjId ? entry : x);
  } else {
    OBJECTIFS.push(entry);
  }
  await saveObjectifs();
  closeAddObjectif();
  renderObjectifs();
  pushActivity('🎯', (_editObjId ? 'Objectif modifié : ' : 'Nouvel objectif : ') + title, '', true);
  toast(_editObjId ? 'Objectif modifié' : 'Objectif créé', title, 'success');
  // Contrôle stock immédiat après création
  refreshAllObjStockInfo();
}

async function updateIngredient(objId, ingIdx, val) {
  const o = OBJECTIFS.find(x => x.id === objId);
  if (!o || !o.ingredients) return;
  const ing = o.ingredients[ingIdx];
  if (!ing) return;
  ing.collected = Math.max(0, Math.min(parseInt(val) || 0, ing.qty));

  // Vérifier si tous les ingrédients sont collectés
  const allDone = o.ingredients.every(i => (i.collected || 0) >= i.qty);
  if (allDone && !o.done) {
    o.done = true;
    o.doneAt = new Date().toISOString();
    toast('Blueprint complété !', o.title + ' — Tous les ingrédients collectés !', 'success');
    pushActivity('✅', 'Blueprint complété : ' + o.title, o.reward || '', true);
  }

  await saveObjectifs();
  renderObjectifs();
}

function editObjectif(id) { openAddObjectif(id); }

async function deleteObjectif(id) {
  const o = OBJECTIFS.find(x => x.id === id);
  if (!o || !confirm('Supprimer "' + o.title + '" ?')) return;
  OBJECTIFS = OBJECTIFS.filter(x => x.id !== id);
  await saveObjectifs();
  renderObjectifs();
  toast('Objectif supprimé', o.title, 'success');
}

async function toggleObjDone(id) {
  const o = OBJECTIFS.find(x => x.id === id);
  if (!o) return;
  o.done = !o.done;
  if (o.done) { o.current = o.target || o.current; o.doneAt = new Date().toISOString(); }
  await saveObjectifs();
  renderObjectifs();
  pushActivity(o.done ? '✅' : '↺', (o.done ? 'Objectif terminé : ' : 'Objectif réactivé : ') + o.title, o.reward || '', o.done);
  toast(o.done ? 'Objectif terminé !' : 'Objectif réactivé', o.title, o.done ? 'success' : 'info');
  if (o.done) {
    pushHistorique({
      kind: 'objectif',
      status: 'valide',
      title: o.title,
      cat: o.cat || '',
      reward: o.reward || '',
      at: new Date().toISOString(),
      by: SESSION?.name || ''
    });
  }
}

async function updateObjProgress(id, val) {
  const o = OBJECTIFS.find(x => x.id === id);
  if (!o) return;
  o.current = Math.max(0, Math.min(parseFloat(val) || 0, o.target || Infinity));
  if (o.target > 0 && o.current >= o.target) {
    o.done = true; o.doneAt = new Date().toISOString();
    toast('Objectif atteint !', o.title, 'success');
    pushActivity('✅', 'Objectif atteint : ' + o.title, o.reward || '', true);
  }
  await saveObjectifs();
  renderObjectifs();
}

/* ════════════════════════════════════════════════════════════
   COMMANDES — Système interne & externe
════════════════════════════════════════════════════════════ */
var COMMANDES = [];
var _cmdTab = 'toutes';
var _cmdType = 'interne';
var _editCmdId = null;

var CMD_STATUS_LABELS = {
  attente:'En attente', en_cours:'En cours', livree:'Livrée', annulee:'Annulée'
};
var CMD_PRIO_COLORS = { normale:'var(--text-dim)', haute:'var(--orange)', urgente:'var(--red)' };
var CMD_PRIO_ICONS  = { normale:'⚪', haute:'🟠', urgente:'🔴' };

async function loadCommandes() {
  COMMANDES = (await DB.get('telos-commandes')) || [];
  renderCommandes();
}

async function saveCommandes() {
  await DB.set('telos-commandes', COMMANDES);
}

function setCmdTab(tab, btn) {
  _cmdTab = tab;
  document.querySelectorAll('#panel-commandes .obj-tab').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCommandes();
}

function setCmdType(type) {
  _cmdType = type;
  const hints = {
    interne: 'Commande entre membres de la corpo TELOS',
    externe: 'Commande passée par un client extérieur à la corpo'
  };
  const colors = { interne:'#818cf8', externe:'var(--orange)' };
  ['interne','externe'].forEach(t => {
    const btn = document.getElementById('cmd-type-'+t);
    if (btn) btn.className = 'btn' + (t===type?' primary':'');
  });
  const hint = document.getElementById('cmd-type-hint');
  if (hint) { hint.textContent = hints[type]; hint.style.borderColor = colors[type]; }
}

function renderCommandes() {
  const el = document.getElementById('cmd-list');
  if (!el) return;

  // Stats
  const stats = { total:0, attente:0, en_cours:0, livree:0, annulee:0 };
  COMMANDES.forEach(c => {
    stats.total++;
    if (stats[c.status] !== undefined) stats[c.status]++;
  });
  const set = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  set('cmd-stat-total',   stats.total);
  set('cmd-stat-attente', stats.attente);
  set('cmd-stat-cours',   stats.en_cours);
  set('cmd-stat-livrees', stats.livree);

  // Badge nav
  const pending = COMMANDES.filter(c=>c.status==='attente'||c.status==='en_cours').length;
  const badge = document.getElementById('badge-commandes');
  if (badge) { badge.textContent=pending; badge.style.display=pending>0?'':'none'; }

  // Filter
  let data = [...COMMANDES];
  if (_cmdTab !== 'toutes') data = data.filter(c=>c.type===_cmdTab);

  // Sort: en cours > attente > livrée > annulée, puis priorité
  const sOrd = {en_cours:0, attente:1, livree:2, annulee:3};
  const pOrd = {urgente:0, haute:1, normale:2};
  data.sort((a,b)=> (sOrd[a.status]||0)-(sOrd[b.status]||0) || (pOrd[a.priority]||2)-(pOrd[b.priority]||2));

  if (!data.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:12px;letter-spacing:1px;">'
      +'📋<br><br>Aucune commande' + (_cmdTab!=='toutes'?' '+_cmdTab:'')+'.<br>'
      +'<span style="color:var(--orange);cursor:pointer;" onclick="openAddCommande()">+ Créer la première commande</span></div>';
    return;
  }

  const fmtPrice = p => p>0 ? Number(p).toLocaleString('fr-FR')+' aUEC' : '—';
  const typeColor = { interne:'#818cf8', externe:'var(--orange)' };
  const typeLabel = { interne:'🏛 Interne', externe:'🌐 Externe' };

  el.innerHTML = data.map(c => {
    const tc = typeColor[c.type]||'var(--border)';
    const assignedName = c.assigned ? (players.find(p=>p.id===c.assigned)?.name || c.assigned) : '—';
    const total = c.qty>0&&c.price>0 ? Number(c.qty)*Number(c.price) : 0;
    return `<div class="cmd-card cmd-type-${c.type} ${c.status==='livree'?'livree':c.status==='annulee'?'annulee':''}">
      <div class="cmd-header">
        <div style="flex:1;">
          <div class="cmd-title">${esc(c.title)}</div>
          <div class="cmd-ref">REF-${c.id.slice(-6).toUpperCase()} · ${typeLabel[c.type]||c.type} · ${c.dl?'⏱ '+c.dl:''}</div>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:flex-start;">
          <span class="cmd-status cmd-status-${c.status}">${CMD_STATUS_LABELS[c.status]||c.status}</span>
          ${c.branche ? '<span style="font-size:9px;letter-spacing:1px;padding:2px 7px;border:1px solid var(--orange);color:var(--orange);background:rgba(247,140,30,0.08);">🔗 BRANCHÉE</span>' : ''}
          ${(()=>{ const labels={haute:'🟠 HAUTE',urgente:'🔴 URGENTE'}; return labels[c.priority]?`<span style="font-size:9px;letter-spacing:1px;padding:2px 7px;border:1px solid ${c.priority==='urgente'?'var(--red)':'#f97316'};color:${c.priority==='urgente'?'var(--red)':'#f97316'};background:${c.priority==='urgente'?'rgba(255,68,68,0.08)':'rgba(249,115,22,0.08)'};">${labels[c.priority]}</span>`:''; })()}
        </div>
      </div>

      <div class="cmd-body">
        <div class="cmd-field"><div class="cmd-lbl">Commanditaire</div><div class="cmd-val">${esc(players.find(p=>p.id===c.client)?.name || c.client || '—')}</div></div>
        ${(()=>{
          const craftLabels = { craft_vaisseau:'🟢 500<', craft_fps:'🟢 500<', vente:'🔴 Vente', autre:'○ Autre' };
          const ct = c.craftType || c.assigned || '';
          return ct ? '<div class="cmd-field"><div class="cmd-lbl">Type craft</div><div class="cmd-val" style="color:var(--blue);">'+(craftLabels[ct]||ct)+'</div></div>' : '';
        })()}
        ${(()=>{
          const res = c.resources?.length ? c.resources : (c.resource ? [{name:c.resource,qty:c.qty}] : []);
          if (!res.length) return '';
          const bpName = c.bpId ? (BLUEPRINTS||[]).find(x=>x.id===c.bpId)?.name : null;
          return (bpName?`<div class="cmd-field" style="grid-column:span 2;"><div class="cmd-lbl">📐 Blueprint</div><div class="cmd-val" style="color:#60a5fa;">${esc(bpName)}${(()=>{
              const bp = (BLUEPRINTS||[]).find(x=>x.id===c.bpId);
              // Reconstruire les owners depuis bp.owners ET _playerBpCache
              let ownerIds = [...(bp?.owners||[])];
              // Enrichir avec le cache joueurs (au cas où bp.owners serait désynchronisé)
              if (window._playerBpCache) {
                players.forEach(p => {
                  const hasBp = (window._playerBpCache[p.id]||[]).includes(c.bpId);
                  if (hasBp && !ownerIds.includes(p.id)) ownerIds.push(p.id);
                });
              }
              const names = ownerIds.map(id=>players.find(p=>p.id===id)?.name).filter(Boolean);
              if (!names.length) return '<br><span style="font-size:10px;color:var(--text-dim);">⬡ Aucun propriétaire enregistré</span>';
              return '<br><span style="font-size:10px;color:var(--text-dim);">⬡ Possédé par : </span>'
                + names.map(n=>`<span style="font-size:10px;font-family:var(--mono);color:var(--green);background:rgba(0,255,163,0.08);padding:1px 7px;margin-left:3px;border:1px solid rgba(0,255,163,0.2);">◈ ${n}</span>`).join('');
            })()}</div></div>`:'')
            + res.map(r=>`<div class="cmd-field"><div class="cmd-lbl">Ressource</div><div class="cmd-val" style="color:var(--orange);">◈ ${esc(r.name)}${r.qty?' · '+Number(r.qty).toLocaleString('fr-FR')+' SCU':''}</div></div>`).join('');
        })()}
        ${c.price>0 ? '<div class="cmd-field"><div class="cmd-lbl">Prix / SCU</div><div class="cmd-val">'+fmtPrice(c.price)+'</div></div>' : ''}
        ${total>0 ? '<div class="cmd-field"><div class="cmd-lbl">Total</div><div class="cmd-val" style="color:var(--green);">'+Number(total).toLocaleString('fr-FR')+' aUEC</div></div>' : ''}
      </div>
      ${c.notes ? '<div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;padding:6px 10px;background:var(--bg3);border-left:2px solid var(--border);">'+esc(c.notes)+'</div>' : ''}

      <div class="cmd-footer">
        <!-- Changer statut -->
        ${(()=>{
          const S='padding:3px 9px;cursor:pointer;font-family:var(--ui);font-size:10px;border:';
          let _s='';
          if(c.status==='attente')                   _s+='<button data-action="cmd-status" data-id="'+c.id+'" data-id2="en_cours" style="'+S+'1px solid var(--orange);color:var(--orange);background:transparent;letter-spacing:1px;">▶ EN COURS</button>';
          if(c.status==='en_cours')                  _s+='<button data-action="cmd-status" data-id="'+c.id+'" data-id2="livree"   style="'+S+'1px solid var(--green);color:var(--green);background:rgba(0,255,163,0.07);font-weight:700;">✓ LIVRÉE</button>';
          if(c.status==='livree'||c.status==='annulee') _s+='<button data-action="cmd-status" data-id="'+c.id+'" data-id2="attente" style="'+S+'1px solid var(--text-dim);color:var(--text-dim);background:transparent;">↺ ROUVRIR</button>';
          if(canEditCommande(c))
          _s+='<button data-action="cmd-edit"   data-id="'+c.id+'" style="'+S+'1px solid var(--orange);color:var(--orange);background:transparent;">✏</button>';
          _s+='<button data-action="cmd-check"  data-id="'+c.id+'" title="Vérifier le stock TELOS" style="'+S+'1px solid rgba(89,208,255,0.5);color:#59d0ff;background:transparent;">📦</button>';
          _s+='<button data-action="cmd-delete" data-id="'+c.id+'" title="Supprimer" style="'+S+'1px solid rgba(255,68,68,0.5);color:var(--red);background:transparent;">🗑</button>';
          return _s;
        })()}
        <span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono);">${new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>`;
  }).join('');
}

// Ingrédients de base du blueprint (avant multiplication)
var _cmdBpBaseIngredients = [];

function openAddCommande(editId) {
  editId = editId||null;
  _editCmdId = editId;
  const c = editId ? COMMANDES.find(x=>x.id===editId) : null;

  // Commanditaire — forcé sur l'utilisateur connecté
  const clientInput   = document.getElementById('cmd-client');
  const clientDisplay = document.getElementById('cmd-client-display');
  const forcedId   = SESSION?.pid || '';
  const forcedName = SESSION?.name || '—';
  const clientId   = (editId && canManageRoles() && c?.client) ? c.client : forcedId;
  const clientName = (editId && canManageRoles() && c?.client)
    ? (players.find(p => p.id === c.client)?.name || c.client)
    : forcedName;
  if (clientInput)   clientInput.value        = clientId;
  if (clientDisplay) clientDisplay.textContent = clientName;

  // Restaurer le type de craft si édition
  const sel = document.getElementById('cmd-assigned');
  if (sel && c?.craftType) sel.value = c.craftType;
  else if (sel && c?.assigned) sel.value = c.assigned;

  // Populate blueprint select filtré par type de craft
  filterCmdBlueprints(c?.bpId||'');

  // Reset exemplaires
  const qtyMult = document.getElementById('cmd-qty-mult');
  if (qtyMult) qtyMult.value = c?.qtyMult || 1;
  _cmdBpBaseIngredients = [];
  updateCmdQtyHint();

  // Ressources : restaurer si édition, sinon ligne vide
  const resources = c?.resources || (c?.resource ? [{name:c.resource, qty:c.qty||0}] : []);
  // Si édition avec blueprint, stocker les ingrédients de base (qty / qtyMult)
  if (c?.bpId && c?.qtyMult && c.qtyMult > 1) {
    const bpBase = (BLUEPRINTS||[]).find(x=>x.id===c.bpId);
    _cmdBpBaseIngredients = bpBase?.ingredients?.map(i=>({name:i.name,qty:i.qty})) || [];
  }
  setCmdResources(resources);

  setCmdType(c?.type||'interne');
  const set = (id,v)=>{ const e=document.getElementById(id); if(e)e.value=v; };
  set('cmd-price',    c?.price    ||'');
  set('cmd-priority', c?.priority ||'normale');
  set('cmd-dl',       c?.dl       ||'');
  set('cmd-notes',    c?.notes    ||'');

  // Commande de Branche
  const branche = c?.branche || 0;
  const brInput = document.getElementById('cmd-branche');
  if (brInput) brInput.value = branche;
  _updateBrancheToggle(branche);

  // Afficher/masquer les champs selon les droits
  const pfEl = document.getElementById('cmd-priority-field');
  const bfEl = document.getElementById('cmd-branche-field');
  if (pfEl) pfEl.style.display = hasDroit('use_priority') ? '' : 'none';
  if (bfEl) bfEl.style.display = hasDroit('use_branche')  ? '' : 'none';

  const title = document.getElementById('cmd-modal-title');
  if (title) title.textContent = editId ? '✏ MODIFIER LA COMMANDE' : '📋 CRÉER UNE COMMANDE';
  document.getElementById('cmd-overlay').classList.add('open');
}

function _updateBrancheToggle(val) {
  const track = document.getElementById('cmd-branche-track');
  const thumb = document.getElementById('cmd-branche-thumb');
  if (!track || !thumb) return;
  const on = !!parseInt(val);
  track.style.background = on ? 'var(--orange)' : 'var(--border)';
  thumb.style.background = on ? '#fff' : 'var(--text-dim)';
  thumb.style.left = on ? '20px' : '2px';
}

function toggleCmdBranche() {
  const inp = document.getElementById('cmd-branche');
  if (!inp) return;
  const newVal = inp.value === '1' ? 0 : 1;
  inp.value = newVal;
  _updateBrancheToggle(newVal);
  const prioSel = document.getElementById('cmd-priority');
  if (prioSel) {
    if (newVal === 1 && prioSel.value === 'normale') prioSel.value = 'haute';
    if (newVal === 0) prioSel.value = 'normale';
  }
}

// ── Panneau détail ressource ──────────────────────────────
var _sdpTelosStocks = []; // stocks TELOS bruts du partenaire actif
var _sdpPersoStocks = []; // stocks personnels bruts du partenaire actif
var _sdpAllStocks = []; // alias — pointe vers le bon contexte selon la clé

function openStockDetail(key) {
  const grp = (window._sdpGroups || {})[key];
  if (!grp) return;
  const ids = grp.ids;
  const isPerso = !!grp.isPerso;
  // Choisir le bon tableau de stocks selon le contexte
  const stocksArray = isPerso ? _sdpPersoStocks : _sdpTelosStocks;
  const entries = ids.map(id => stocksArray.find(s => s.id === id)).filter(Boolean);
  if (!entries.length) return;

  const res  = entries[0].res;
  const QUALITY_LABELS = { mediocre:'💀 Médiocre', basique:'🔴 Basique', acceptable:'🟠 Acceptable', honnete:'🟡 Honnête', moyenne:'🟢 Moyenne', haute:'💎 Haute' };
  const QUALITY_COLORS = { mediocre:'#6b7280', basique:'var(--red)', acceptable:'var(--orange)', honnete:'#eab308', moyenne:'var(--green)', haute:'#a855f7' };
  const BUCKET_LABELS  = { aucune:'⚪ Sans qualité', vente:'🔴 Vente (<500)', vaisseau:'🟢 500<', fps:'🟢 500<' };

  document.getElementById('sdp-res-name').textContent = res;

  // Résumé
  const totalQty   = entries.reduce((a,s) => a + Number(s.qty), 0);
  const totalBuy   = entries.reduce((a,s) => a + (s.price||0)*s.qty, 0);
  const totalSell  = entries.reduce((a,s) => a + (s.sellprice||0)*s.qty, 0);
  const profit     = totalSell - totalBuy;
  document.getElementById('sdp-summary').innerHTML = `
    <div style="flex:1;padding:10px 12px;border-right:1px solid var(--border);text-align:center;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;">Entrées</div>
      <div style="font-size:20px;font-weight:700;color:var(--text-bright);font-family:var(--mono);">${entries.length}</div>
    </div>
    <div style="flex:1;padding:10px 12px;border-right:1px solid var(--border);text-align:center;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;">Quantité totale</div>
      <div style="font-size:20px;font-weight:700;color:var(--orange);font-family:var(--mono);">${totalQty.toLocaleString('fr-FR')}</div>
    </div>
    <div style="flex:1;padding:10px 12px;text-align:center;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;">Profit total</div>
      <div style="font-size:20px;font-weight:700;font-family:var(--mono);color:${profit>=0?'var(--green)':'var(--red)'};">${profit>=0?'+':''}${Math.round(profit).toLocaleString('fr-FR')} <span style="font-size:11px;">aUEC</span></div>
    </div>`;

  // Entrées individuelles
  document.getElementById('sdp-entries').innerHTML = entries.map((s, i) => {
    const ql    = QUALITY_LABELS[s.quality] || '— Non spécifié';
    const qcol  = QUALITY_COLORS[s.quality] || 'var(--text-dim)';
    const bkt   = BUCKET_LABELS[qualityBucket(s)] || '—';
    const unit  = s.unit === 'unite' ? 'Unité' : 'SCU';
    const pft   = s.sellprice>0 ? (s.sellprice - (s.price||0)) * s.qty : null;
    const margin= s.price>0&&s.sellprice>0 ? ((s.sellprice-s.price)/s.price*100).toFixed(1) : null;
    return `
    <div style="background:var(--bg3);border:1px solid var(--border);border-left:3px solid ${qcol};padding:12px 14px;display:flex;flex-direction:column;gap:6px;">
      <!-- En-tête entrée -->
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;letter-spacing:1.5px;color:var(--text-dim);">ENTRÉE #${i+1}</span>
        <div style="display:flex;gap:5px;">
          <button onclick="closeStockDetail();${isPerso?`openEditPerso('${s.id}')`:`openEditStock('${s.id}')`}" style="font-size:10px;padding:2px 8px;border:1px solid var(--orange);color:var(--orange);background:transparent;cursor:pointer;font-family:var(--ui);">✏ Modifier</button>
          <button onclick="closeStockDetail();${isPerso?`confirmDelPerso('${s.id}','${esc(s.res)}')`:`confirmDelStock('${s.id}','${esc(s.res)}')`}" style="font-size:10px;padding:2px 8px;border:1px solid rgba(255,68,68,0.5);color:var(--red);background:transparent;cursor:pointer;font-family:var(--ui);">✕</button>
        </div>
      </div>

      <!-- Qualité -->
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:700;color:${qcol};">${ql}</span>
        ${s.qualityExact ? `<span style="font-family:var(--mono);font-size:13px;color:${qcol};border:1px solid ${qcol};padding:1px 8px;">${s.qualityExact} <span style="font-size:9px;opacity:.7;">/ 1000</span></span>` : ''}
        <span style="font-size:10px;color:var(--text-dim);">${bkt}</span>
      </div>

      <!-- Grille détails -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;font-size:11px;">
        <div><span style="color:var(--text-dim);">Quantité</span><br><span style="color:var(--text-bright);font-family:var(--mono);font-weight:700;">${Number(s.qty).toLocaleString('fr-FR')} <span style="font-size:9px;color:var(--text-dim);">${unit}</span></span></div>
        <div><span style="color:var(--text-dim);">Localisation</span><br><span style="color:var(--text-bright);">📍 ${esc(s.loc||'—')}</span></div>
        <div><span style="color:var(--text-dim);">Prix achat /u</span><br><span style="color:var(--text-bright);font-family:var(--mono);">${s.price ? s.price.toFixed(2)+' aUEC' : '—'}</span></div>
        <div><span style="color:var(--text-dim);">Prix vente /u</span><br><span style="color:var(--blue);font-family:var(--mono);">${s.sellprice ? s.sellprice.toFixed(2)+' aUEC' : '—'}</span></div>
        <div><span style="color:var(--text-dim);">Val. achat total</span><br><span style="color:var(--text-bright);font-family:var(--mono);">${s.price&&s.qty ? Math.round(s.price*s.qty).toLocaleString('fr-FR')+' aUEC' : '—'}</span></div>
        <div><span style="color:var(--text-dim);">Marge</span><br><span style="color:${margin!==null?(parseFloat(margin)>=0?'var(--green)':'var(--red)'):'var(--text-dim)'};font-family:var(--mono);">${margin!==null?(parseFloat(margin)>=0?'+':'')+margin+'%':'—'}</span></div>
        <div><span style="color:var(--text-dim);">Profit total</span><br><span style="color:${pft!==null?(pft>=0?'var(--green)':'var(--red)'):'var(--text-dim)'};font-family:var(--mono);">${pft!==null?(pft>=0?'+':'')+Math.round(pft).toLocaleString('fr-FR')+' aUEC':'—'}</span></div>
        <div><span style="color:var(--text-dim);">Date ajout</span><br><span style="color:var(--text-dim);font-size:10px;">${fmtDate(s.addedAt)}</span></div>
      </div>

      ${s.note ? `<div style="border-top:1px solid var(--border);padding-top:6px;font-size:10px;color:var(--text-dim);font-family:var(--mono);">📝 ${esc(s.note)}</div>` : ''}
    </div>`;
  }).join('');

  // Ouvrir
  const ov = document.getElementById('stock-detail-overlay');
  const pn = document.getElementById('stock-detail-panel');
  ov.style.display = 'flex';
  ov.style.alignItems = 'stretch';
  setTimeout(() => pn.style.transform = 'translateX(0)', 10);
}

function closeStockDetail() {
  const ov = document.getElementById('stock-detail-overlay');
  const pn = document.getElementById('stock-detail-panel');
  pn.style.transform = 'translateX(100%)';
  setTimeout(() => { ov.style.display = 'none'; }, 220);
}

// Vider et repeupler les lignes de ressources
function setCmdResources(resources) {
  const list = document.getElementById('cmd-resources-list');
  if (!list) return;
  if (!resources || !resources.length) {
    list.innerHTML = `<div class="cmd-res-row" style="display:grid;grid-template-columns:1fr 80px 24px;gap:6px;">
      <input class="form-input" type="text" placeholder="Ressource" list="ps-datalist" style="font-size:13px;padding:7px 9px;">
      <input class="form-input" type="number" placeholder="SCU" min="1" style="font-size:13px;padding:7px 9px;">
      <button type="button" onclick="removeCmdResRow(this)" style="padding:0;border:none;background:transparent;color:var(--red);font-size:16px;cursor:pointer;align-self:center;">✕</button>
    </div>`;
    return;
  }
  list.innerHTML = resources.map(r=>`
    <div class="cmd-res-row" style="display:grid;grid-template-columns:1fr 80px 24px;gap:6px;">
      <input class="form-input" type="text" placeholder="Ressource" list="ps-datalist" value="${esc(r.name||'')}" style="font-size:13px;padding:7px 9px;">
      <input class="form-input" type="number" placeholder="SCU" min="1" value="${r.qty||''}" style="font-size:13px;padding:7px 9px;">
      <button type="button" onclick="removeCmdResRow(this)" style="padding:0;border:none;background:transparent;color:var(--red);font-size:16px;cursor:pointer;align-self:center;">✕</button>
    </div>`).join('');
}

function addCmdResRow() {
  const list = document.getElementById('cmd-resources-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'cmd-res-row';
  row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 24px;gap:6px;';
  row.innerHTML = `<input class="form-input" type="text" placeholder="Ressource" list="ps-datalist" style="font-size:13px;padding:7px 9px;">
    <input class="form-input" type="number" placeholder="SCU" min="1" style="font-size:13px;padding:7px 9px;">
    <button type="button" onclick="removeCmdResRow(this)" style="padding:0;border:none;background:transparent;color:var(--red);font-size:16px;cursor:pointer;align-self:center;">✕</button>`;
  list.appendChild(row);
}

function removeCmdResRow(btn) {
  const list = document.getElementById('cmd-resources-list');
  if (!list) return;
  const rows = list.querySelectorAll('.cmd-res-row');
  if (rows.length <= 1) { btn.closest('.cmd-res-row').querySelectorAll('input').forEach(i=>i.value=''); return; }
  btn.closest('.cmd-res-row').remove();
}

// Mapping type de craft → cat blueprint
const CRAFT_TYPE_TO_BP_CAT = {
  craft_fps:      ['fps', 'craft_fps', 'FPS', ''],
  craft_vaisseau: ['vaisseau', 'craft_vaisseau', 'Vaisseau', ''],
  vente:          null, // pas de blueprint pour vente
  autre:          null,
  '':             null, // tout afficher
};

function filterCmdBlueprints(selectedBpId) {
  const craftType = document.getElementById('cmd-assigned')?.value || '';
  const bpSel = document.getElementById('cmd-blueprint');
  if (!bpSel) return;

  let bps = BLUEPRINTS || [];

  // Filtrer selon le type de craft
  if (craftType === 'craft_fps') {
    bps = bps.filter(b => {
      const cat = (b.cat||b.type||b.category||'').toLowerCase();
      return cat === 'fps' || cat.includes('fps') || cat.includes('arme') || cat.includes('armor') || cat.includes('armure');
    });
  } else if (craftType === 'craft_vaisseau') {
    bps = bps.filter(b => {
      const cat = (b.cat||b.type||b.category||'').toLowerCase();
      return cat === 'vaisseau' || cat.includes('vaisseau') || cat.includes('ship') || cat.includes('composant');
    });
  }
  // vente/autre/vide → tout afficher

  const current = selectedBpId || bpSel.value;
  bpSel.innerHTML = '<option value="">— Aucun blueprint —</option>'
    + bps.map(b => `<option value="${b.id}"${b.id===current?' selected':''}>${esc(b.name)}</option>`).join('');
  if (current && bps.find(b=>b.id===current)) bpSel.value = current;
}

function onCmdBlueprintChange() {
  const bpSel = document.getElementById('cmd-blueprint');
  if (!bpSel) return;
  const bpId = bpSel.value;
  if (!bpId) { _cmdBpBaseIngredients = []; return; }
  const bp = (BLUEPRINTS||[]).find(x=>x.id===bpId);
  if (!bp) return;
  if (bp.ingredients?.length) {
    _cmdBpBaseIngredients = bp.ingredients.map(i=>({name:i.name, qty:i.qty}));
    applyCmdQtyMult();
  }
}

function changeCmdQty(delta) {
  const el = document.getElementById('cmd-qty-mult');
  if (!el) return;
  const v = Math.max(1, (parseInt(el.value)||1) + delta);
  el.value = v;
  onCmdQtyMultChange();
}

function onCmdQtyMultChange() {
  applyCmdQtyMult();
  updateCmdQtyHint();
}

function updateCmdQtyHint() {
  const el = document.getElementById('cmd-qty-mult');
  const hint = document.getElementById('cmd-qty-hint');
  if (!hint) return;
  const v = parseInt(el?.value)||1;
  hint.textContent = v > 1 ? `× ${v} exemplaires` : '';
}

function applyCmdQtyMult() {
  if (!_cmdBpBaseIngredients.length) return;
  const mult = Math.max(1, parseInt(document.getElementById('cmd-qty-mult')?.value)||1);
  setCmdResources(_cmdBpBaseIngredients.map(i=>({
    name: i.name,
    qty: Math.round(i.qty * mult * 1000) / 1000  // arrondi 3 décimales
  })));
}

function closeAddCommande() {
  document.getElementById('cmd-overlay').classList.remove('open');
  _editCmdId = null;
}

function editCommande(id) {
  const c = COMMANDES.find(x => x.id === id);
  if (c && !canEditCommande(c)) {
    toast('Accès refusé', 'Modification non autorisée pour cette commande.', 'error');
    return;
  }
  openAddCommande(id);
}

async function saveCommande() {
  const clientEl  = document.getElementById('cmd-client');
  const clientVal = clientEl?.value||'';
  if (!clientVal) { toast('Commanditaire requis','','error'); return; }

  // Lire toutes les lignes ressources
  const rows = document.querySelectorAll('#cmd-resources-list .cmd-res-row');
  const resources = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const name = inputs[0]?.value.trim();
    const qty  = parseFloat(inputs[1]?.value)||0;
    if (name) resources.push({name, qty});
  });

  // Titre auto-généré depuis blueprint ou première ressource
  const bpId  = document.getElementById('cmd-blueprint')?.value||'';
  const bp    = bpId ? (BLUEPRINTS||[]).find(x=>x.id===bpId) : null;
  const qtyMult = Math.max(1, parseInt(document.getElementById('cmd-qty-mult')?.value)||1);
  const clientName = players.find(p=>p.id===clientVal)?.name || clientVal;
  const qtyStr = qtyMult > 1 ? ` ×${qtyMult}` : '';
  const autoTitle  = bp ? `Craft : ${bp.name}${qtyStr} → ${clientName}`
    : resources.length ? `${resources[0].name}${qtyStr} → ${clientName}` : `Commande → ${clientName}`;

  const entry = {
    id:        _editCmdId||('cmd_'+Date.now()),
    type:      _cmdType,
    title:     autoTitle,
    client:    clientVal,
    craftType: document.getElementById('cmd-assigned')?.value||'',
    bpId,
    qtyMult,
    resources,
    // compat ancienne structure
    resource:  resources[0]?.name||'',
    qty:       resources[0]?.qty||0,
    price:     parseFloat(document.getElementById('cmd-price')?.value)||0,
    priority:  hasDroit('use_priority') ? (document.getElementById('cmd-priority')?.value||'normale') : 'normale',
    branche:   hasDroit('use_branche')  ? (parseInt(document.getElementById('cmd-branche')?.value)||0) : 0,
    dl:        document.getElementById('cmd-dl')?.value||'',
    notes:     document.getElementById('cmd-notes')?.value.trim()||'',
    status:    _editCmdId?(COMMANDES.find(x=>x.id===_editCmdId)?.status||'attente'):'attente',
    createdAt: _editCmdId?(COMMANDES.find(x=>x.id===_editCmdId)?.createdAt||new Date().toISOString()):new Date().toISOString(),
    createdBy: _editCmdId?(COMMANDES.find(x=>x.id===_editCmdId)?.createdBy||SESSION?.pid||''):(SESSION?.pid||''),
  };

  if (_editCmdId) {
    COMMANDES = COMMANDES.map(x=>x.id===_editCmdId?entry:x);
  } else {
    COMMANDES.push(entry);
  }
  await saveCommandes();
  closeAddCommande();
  renderCommandes();
  const icon = entry.type==='interne'?'🏛':'🌐';
  pushActivity(icon, (_editCmdId?'Commande modifiée : ':'Nouvelle commande : ')+entry.title, entry.price>0?Number(entry.price).toLocaleString('fr-FR')+' aUEC':'', true);
  pushLog('trade','TRADE',(_editCmdId?'Commande modifiée':'Nouvelle commande')+' ['+entry.type+']: '+entry.title);
  toast(_editCmdId?'Commande modifiée':'Commande créée', entry.title, 'success');
  // Contrôle automatique du stock en arrière-plan (uniquement à la création)
  if (!_editCmdId) {
    checkStockForCommande(entry);
    notifyDiscord(entry, 'created');
  }
  // Une commande réserve du stock → recalculer les objectifs
  refreshAllObjStockInfo();
}

// ══ CONTRÔLE STOCK/COMMANDES POUR LES OBJECTIFS ═════════════════════════════
// Calcule pour chaque ingrédient : stock dispo - stock réservé par commandes actives
// Retourne le bucket de stock utilisable selon le type d'objectif
// craft fps      → uniquement stock 'fps' (800–1000)
// craft vaisseau → uniquement stock 'vaisseau' (500–800)
// collecte/autre → uniquement stock 'aucune' (sans qualité)
// Les ressources 'vente' (<500) ne comptent JAMAIS
function objStockBucket(obj) {
  // Tous les objectifs comptabilisent TOUT le stock ≥500 (vaisseau + fps),
  // sans exception, quel que soit le craftType ou blueprint associé.
  // Seul le stock 'vente' (<500) et 'aucune' (non classé) sont exclus.
  return ['vaisseau', 'fps'];
}

async function getStockNetForObjectif(obj) {
  // Stock brut TELOS — agrégé par bucket de qualité
  const brut = {};      // key → { aucune, vente, vaisseau, fps }
  for (const p of players) {
    const stocks = (await DB.get('uex-stocks-' + p.id)) || [];
    for (const s of stocks) {
      const key = (s.res || s.name || '').toLowerCase().trim();
      if (!key) continue;
      if (!brut[key]) brut[key] = { aucune:0, vente:0, vaisseau:0, fps:0, total:0 };
      const b = qualityBucket(s);
      brut[key][b] = (brut[key][b] || 0) + (parseFloat(s.qty) || 0);
      brut[key].total += parseFloat(s.qty) || 0;
    }
  }

  // Stock réservé par les commandes actives
  const reserved = {};
  for (const cmd of COMMANDES) {
    if (!['attente','en_cours'].includes(cmd.status)) continue;
    const resources = cmd.resources?.length
      ? cmd.resources
      : (cmd.resource ? [{ name: cmd.resource, qty: cmd.qty || 0 }] : []);
    for (const r of resources) {
      const key = (r.name || '').toLowerCase().trim();
      if (key) reserved[key] = (reserved[key] || 0) + (parseFloat(r.qty) || 0);
    }
  }

  // Buckets utilisables selon l'objectif
  const buckets = obj ? objStockBucket(obj) : ['aucune','vaisseau','fps'];

  // Stock net utilisable = somme des buckets autorisés - réservé (jamais vente)
  const net = {};
  const allKeys = new Set([...Object.keys(brut), ...Object.keys(reserved)]);
  for (const key of allKeys) {
    const b = brut[key] || {};
    const usable = buckets.reduce((sum, bk) => sum + (b[bk] || 0), 0);
    net[key] = Math.max(0, usable - (reserved[key] || 0));
  }

  // brut utilisable (pour l'affichage)
  const brutUsable = {};
  for (const key of Object.keys(brut)) {
    const b = brut[key];
    brutUsable[key] = buckets.reduce((sum, bk) => sum + (b[bk] || 0), 0);
  }

  return { brut: brutUsable, reserved, net };
}

// Calcule la disponibilité pour un objectif donné
async function refreshObjStockInfo(objId) {
  const obj = OBJECTIFS.find(o => o.id === objId);
  if (!obj || obj.done || !obj.ingredients?.length) return;

  const { brut, reserved, net } = await getStockNetForObjectif(obj);
  const lines = [];
  let allOk = true;

  for (const ing of obj.ingredients) {
    const key = (ing.name || '').toLowerCase().trim();
    const brutVal = Math.round((brut[key] || 0) * 100) / 100;
    const resVal  = Math.round((reserved[key] || 0) * 100) / 100;
    const netVal  = Math.round((net[key] || 0) * 100) / 100;
    const needed  = parseFloat(ing.qty) || 0;
    const ok = netVal >= needed;
    if (!ok) allOk = false;
    lines.push({ name: ing.name, needed, brutVal, resVal, netVal, ok });
  }

  const buckets = objStockBucket(obj);
  obj._stockInfo = { lines, allOk, updatedAt: Date.now(), buckets };
  return obj._stockInfo;
}

// Rafraîchit tous les objectifs actifs avec ingrédients
async function refreshAllObjStockInfo() {
  const active = OBJECTIFS.filter(o => !o.done && o.ingredients?.length);
  for (const o of active) await refreshObjStockInfo(o.id);
  renderObjectifs();
}

// ══ CONTRÔLE STOCK AUTOMATIQUE À LA CRÉATION D'UNE COMMANDE ════════════════
async function checkStockForCommande(cmd) {
  if (!cmd.resources || !cmd.resources.length) return;

  // ── 1. Agréger stock TELOS utilisable (sans les ressources 'vente' <500) ──
  const telosStock = {};
  for (const p of players) {
    const stocks = (await DB.get('uex-stocks-' + p.id)) || [];
    for (const s of stocks) {
      const key = (s.res || s.name || s.resource || '').toLowerCase().trim();
      if (!key) continue;
      const b = qualityBucket(s);
      if (b === 'vente') continue; // ressources <500 exclues des commandes
      telosStock[key] = (telosStock[key] || 0) + (parseFloat(s.qty) || 0);
    }
  }

  // ── 2. Comparer chaque ressource de la commande avec le stock ──
  const manques = [];
  for (const res of cmd.resources) {
    const key = res.name.toLowerCase().trim();
    const dispo = telosStock[key] || 0;
    const requis = parseFloat(res.qty) || 0;
    if (requis <= 0) continue;
    const manque = requis - dispo;
    if (manque > 0) {
      manques.push({ name: res.name, requis, dispo, manque: Math.round(manque * 1000) / 1000 });
    }
  }

  if (!manques.length) {
    // Stock suffisant — notification positive
    toast('✅ Stock suffisant', 'Toutes les ressources sont disponibles pour : ' + cmd.title, 'success');
    pushLog('system', 'STOCK', 'Contrôle stock OK pour commande : ' + cmd.title);
    return;
  }

  // ── 3. Créer un objectif automatique pour les ressources manquantes ──
  const clientName = players.find(p => p.id === cmd.client)?.name || cmd.client || '?';
  const objTitle = '⚠ Approvisionnement : ' + cmd.title;

  // Éviter les doublons — ne pas recréer si un objectif identique existe déjà
  const alreadyExists = OBJECTIFS.some(o =>
    o.cmdId === cmd.id && !o.done
  );
  if (alreadyExists) return;

  // Mapper craftType → cat + action de l'objectif
  const craftCatMap = { craft_vaisseau:'craft', craft_fps:'craft', vente:'ressource', autre:'ressource' };
  const craftActionMap = { craft_vaisseau:'craft', craft_fps:'craft' };
  const objCat    = craftCatMap[cmd.craftType]    || 'ressource';
  const objAction = craftActionMap[cmd.craftType] || 'collecter';

  const objEntry = {
    id:          'obj_auto_' + cmd.id + '_' + Date.now(),
    title:       objTitle,
    cat:         objCat,
    action:      objAction,
    craftType:   cmd.craftType || '',
    desc:        `Approvisionnement automatique pour la commande "${cmd.title}" (commanditaire : ${clientName}).

Ressources manquantes :
` +
                 manques.map(m => '• ' + m.name + ' : ' + m.manque + ' SCU manquant (dispo ' + m.dispo + ' / requis ' + m.requis + ')').join('\n'),
    target:      manques.reduce((s, m) => s + m.manque, 0),
    unit:        'SCU',
    current:     0,
    dl:          cmd.dl || '',
    reward:      '',
    bpId:        cmd.bpId || '',
    cmdId:       cmd.id,   // lien vers la commande source
    autoCreated: true,
    ingredients: manques.map(m => ({
      name:      m.name,
      qty:       m.manque,
      unit:      'SCU',
      collected: 0,
    })),
    done:        false,
    createdAt:   new Date().toISOString(),
  };

  OBJECTIFS.push(objEntry);
  await saveObjectifs();
  renderObjectifs();

  // ── 4. Notifications ──
  const resumé = manques.map(m => `${m.name} : −${m.manque} SCU`).join(' · ');
  pushActivity('⚠', 'Objectif créé automatiquement : ' + objTitle, resumé, false);
  pushLog('system', 'AUTO', 'Objectif appro. créé pour commande : ' + cmd.title + ' | Manques : ' + resumé);

  // Toast avec détail
  setTimeout(() => {
    toast(
      `⚠ ${manques.length} ressource${manques.length > 1 ? 's' : ''} manquante${manques.length > 1 ? 's' : ''}`,
      `Objectif d'approvisionnement créé automatiquement.
${resumé}`,
      'warning'
    );
  }, 800);
}

// ── Discord Webhook — Notifications Commandes ────────────
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1515240542605414511/QLxdHc1kfi5_3PZaIOyijrQCnmtbSYH2CH__BWNuYoAL_jPXdsF0FfHKkjwowUhl_z-Y';

async function notifyDiscord(commande, event) {
  try {
    const prio = { normale:'⚪', haute:'🟠', urgente:'🔴' };
    const type = commande.type === 'interne' ? '🏛 Interne' : '🌐 Externe';
    const clientName = players.find(p=>p.id===commande.client)?.name || commande.client || '—';
    const prioIcon = prio[commande.priority] || '⚪';
    const branche = commande.branche ? '🔗 Branchée' : '';

    let color, title, desc;
    if (event === 'created') {
      color = 0xF78C1E;
      title = '📋 Nouvelle commande créée';
      desc  = `**${commande.title}**`;
    } else if (event === 'en_cours') {
      color = 0x9B59B6; // violet
      title = '▶ Commande en cours';
      desc  = `**${commande.title}**`;
    } else if (event === 'livree') {
      color = 0x00FFA3;
      title = '✅ Commande livrée !';
      desc  = `**${commande.title}**`;
    } else if (event === 'deleted') {
      color = 0xFF4444;
      title = '🗑 Commande supprimée';
      desc  = `~~${commande.title}~~`;
    } else return;

    const brancheStr = commande.branche ? '🔗 Oui' : '○ Non';
    const ressources = (commande.resources||[]).map(r => `• ${r.name} ×${r.qty}`).join('\n') || '—';
    const fields = [
      { name: 'Type', value: type, inline: true },
      { name: 'Commanditaire', value: clientName, inline: true },
      { name: 'Priorité', value: `${prioIcon} ${commande.priority||'normale'}`, inline: true },
      { name: 'Branchée', value: brancheStr, inline: true },
    ];
    if (commande.price > 0) fields.push({ name: 'Prix convenu', value: `${Number(commande.price).toLocaleString('fr-FR')} aUEC`, inline: true });
    if (ressources !== '—') fields.push({ name: 'Ressources demandées', value: ressources, inline: false });
    if (commande.notes) fields.push({ name: 'Notes', value: commande.notes, inline: false });

    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'MobiGlass Telos',
        avatar_url: 'https://media.alienwarearena.com/media/00825a3ff4d68867c811e8e36c2e828b.png?quality=75&width=184',
        embeds: [{
          title,
          description: desc,
          color,
          fields,
          footer: { text: `MobiGlass Telos • ${new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}` },
          thumbnail: { url: 'https://media.alienwarearena.com/media/00825a3ff4d68867c811e8e36c2e828b.png?quality=75&width=184' }
        }]
      })
    });
  } catch(e) {
    console.warn('Discord webhook error:', e);
  }
}

async function setCmdStatus(id, status) {
  const c = COMMANDES.find(x=>x.id===id);
  if (!c) return;
  const oldStatus = c.status;
  c.status = status;
  if (status==='livree') c.deliveredAt = new Date().toISOString();
  await saveCommandes();
  renderCommandes();
  const statusLabels = {livree:'Livrée ✓', en_cours:'En cours ▶', attente:'Rouverte ↺'};
  pushActivity('📋', 'Commande '+statusLabels[status]+' : '+c.title, '', status==='livree');
  toast('Statut mis à jour', statusLabels[status]||status, status==='livree'?'success':'info');
  // Enregistrer dans l'historique persistant
  if (status === 'livree' || status === 'annulee') {
    pushHistorique({
      kind: 'commande',
      status: status,
      title: c.title,
      type: c.type,
      commanditaire: c.commanditaire || '',
      craftType: c.craftType || '',
      at: new Date().toISOString(),
      by: SESSION?.name || ''
    });
  }
  // Notification Discord
  if (status === 'en_cours' || status === 'livree') notifyDiscord(c, status);
}

async function cancelCommande(id) {
  const comm = COMMANDES.find(x=>x.id===id);
  if (!comm) return;
  if (!confirm('Annuler la commande "'+comm.title+'" ?')) return;
  comm.status = 'annulee';
  await saveCommandes();
  renderCommandes();
  toast('Commande annulée', comm.title, 'info');
}

async function deleteCommande(id) {
  const comm = COMMANDES.find(x=>x.id===id);
  if (!comm) return;
  if (!confirm('Supprimer définitivement "'+comm.title+'" ?')) return;
  COMMANDES = COMMANDES.filter(x=>x.id!==id);
  await saveCommandes();
  renderCommandes();
  notifyDiscord(comm, 'deleted');
  toast('Commande supprimée', comm.title, 'info');
}

// ══ SYNC AUTO DES OBJECTIFS AVEC LE STOCK TELOS ════════════════════════════
// Appelée après chaque modification de stock — met à jour les objectifs actifs
async function syncObjectifsWithStock() {
  // Traiter tous les objectifs actifs trackables :
  // - avec ingrédients (auto ou blueprint)
  // - OU avec resource + target (objectifs manuels simples)
  const activeObjs = OBJECTIFS.filter(o => {
    if (o.done) return false;
    if (o.ingredients && o.ingredients.length > 0) return true;
    if ((o.resource || o.cat === 'ressource') && o.target > 0) return true;
    return false;
  });
  if (!activeObjs.length) return;

  // Agréger tout le stock TELOS par bucket de qualité
  const telosStockByBucket = {}; // key → { aucune, vente, vaisseau, fps }
  for (const p of players) {
    const stocks = (await DB.get('uex-stocks-' + p.id)) || [];
    for (const s of stocks) {
      const key = (s.res || s.name || '').toLowerCase().trim();
      if (!key) continue;
      if (!telosStockByBucket[key]) telosStockByBucket[key] = { aucune:0, vente:0, vaisseau:0, fps:0 };
      const b = qualityBucket(s);
      telosStockByBucket[key][b] = (telosStockByBucket[key][b] || 0) + (parseFloat(s.qty) || 0);
    }
  }

  // Helper : stock utilisable pour un objectif (exclut toujours 'vente')
  function getUsable(key, obj) {
    const buckets = objStockBucket(obj);
    const b = telosStockByBucket[key] || {};
    return buckets.reduce((sum, bk) => sum + (b[bk] || 0), 0);
  }

  let changed = false;
  const newlyCompleted = [];

  for (const obj of activeObjs) {
    let objChanged = false;

    // ── Cas 1 : objectif avec ingrédients (blueprint / auto-créé) ──
    if (obj.ingredients && obj.ingredients.length > 0) {
      for (const ing of obj.ingredients) {
        const key = (ing.name || '').toLowerCase().trim();
        const dispo = getUsable(key, obj);
        const newCollected = Math.min(parseFloat(ing.qty) || 0, Math.round(dispo * 1000) / 1000);
        if (newCollected !== (ing.collected || 0)) {
          ing.collected = newCollected;
          objChanged = true;
        }
      }
      if (objChanged) {
        const totalCollected = obj.ingredients.reduce((s, i) => s + (i.collected || 0), 0);
        const totalRequired  = obj.ingredients.reduce((s, i) => s + (i.qty || 0), 0);
        if (totalRequired > 0 && obj.target > 0) {
          obj.current = Math.round((totalCollected / totalRequired) * obj.target * 100) / 100;
        }
        const allDone = obj.ingredients.every(i => (i.collected || 0) >= (i.qty || 0));
        if (allDone) { obj.done = true; obj.doneAt = new Date().toISOString(); newlyCompleted.push(obj); }
      }

    // ── Cas 2 : objectif manuel simple (resource + target) ──
    } else if ((obj.resource || obj.cat === 'ressource') && obj.target > 0) {
      const key = (obj.resource || '').toLowerCase().trim();
      const dispo = key ? getUsable(key, obj) : 0;
      const target = parseFloat(obj.target) || 0;
      const newCurrent = Math.min(target, Math.round(dispo * 1000) / 1000);
      if (newCurrent !== (obj.current || 0)) {
        obj.current = newCurrent;
        objChanged = true;
        if (newCurrent >= target) {
          obj.done = true; obj.doneAt = new Date().toISOString(); newlyCompleted.push(obj);
        }
      }
    }

    if (objChanged) changed = true;
  }

  if (changed) {
    await saveObjectifs();
    renderObjectifs();
    for (const obj of newlyCompleted) {
      toast('✅ Objectif complété !', obj.title + ' — Ressources disponibles en stock !', 'success');
      pushActivity('✅', 'Objectif complété automatiquement : ' + obj.title, '', true);
      pushLog('system', 'AUTO', 'Objectif auto-complété par ajout stock : ' + obj.title);
    }
  }
}


async function checkCmdStock(id) {
  const comm = COMMANDES.find(x=>x.id===id);
  if (!comm) return;
  const resources = comm.resources?.length
    ? comm.resources
    : (comm.resource ? [{name:comm.resource, qty:comm.qty||0}] : []);
  if (!resources.length) { toast('Aucune ressource', 'Aucune ressource sur cette commande.', 'warn'); return; }

  const stockMap = {};
  for (const p of players) {
    const pStocks = (await DB.get('uex-stocks-'+p.id)) || [];
    pStocks.forEach(s => {
      const key = (s.res||'').toLowerCase().trim();
      if (!key) return;
      stockMap[key] = (stockMap[key] || 0) + (s.qty || 0);
    });
  }

  let created = 0, allOk = true;
  const lines = [];
  for (const r of resources) {
    const key = (r.name||'').toLowerCase().trim();
    const needed = r.qty || 0;
    const inStock = stockMap[key] || 0;
    const missing = Math.max(0, needed - inStock);
    if (missing <= 0) {
      lines.push('OK  ' + r.name + ' : ' + inStock + ' SCU (requis: ' + needed + ')');
    } else {
      allOk = false;
      lines.push('!   ' + r.name + ' : manque ' + missing.toFixed(2) + ' SCU (stock: ' + inStock + ', requis: ' + needed + ')');
      const exists = OBJECTIFS.some(o => !o.done && o.cat==='ressource' && o.title.toLowerCase().includes(r.name.toLowerCase()));
      if (!exists) {
        OBJECTIFS.push({
          id: 'obj_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
          title: r.name + ' — ' + comm.title,
          cat: 'ressource',
          priority: 'haute',
          desc: 'Ressource manquante pour : ' + comm.title,
          target: +missing.toFixed(2),
          unit: 'SCU',
          current: inStock,
          dl: comm.dl || '',
          reward: '',
          bpId: '',
          ingredients: [],
          done: false,
          createdAt: new Date().toISOString(),
        });
        created++;
      }
    }
  }

  if (created > 0) { await saveObjectifs(); renderObjectifs(); }

  const summary = allOk
    ? 'Stock suffisant !'
    : (created > 0 ? created + ' objectif(s) cree(s) pour les ressources manquantes.' : 'Objectifs deja existants.');
  alert('Stock TELOS — ' + comm.title + '\n\n' + lines.join('\n') + '\n\n' + summary);
  toast(allOk ? 'Stock OK' : 'Ressources manquantes', summary, allOk ? 'success' : 'warn');
}


/* ════════════════════════════════════════════════════════════
   UEX API SYNC — Synchronisation temps réel du catalogue
   API : https://api.uexcorp.uk/2.0/commodities
════════════════════════════════════════════════════════════ */
var UEX_API_BASE = 'https://api.uexcorp.uk/2.0';
var _uexSyncRunning = false;

async function syncFromUEX() {
  if (_uexSyncRunning) return;
  if (!canManageRoles()) { toast('Accès refusé','','error'); return; }

  _uexSyncRunning = true;
  const btn    = document.getElementById('btn-uex-sync');
  const status = document.getElementById('uex-sync-status');
  if (btn)    btn.textContent = '⏳ Sync...';
  if (status) status.textContent = 'Connexion à UEXCorp API...';

  const BEARER   = '0b7797b0ee37052d9c8dfe493305b7a2d1ab8f43';
  const API_BASE = 'https://api.uexcorp.uk/2.0';

  async function apiFetch(endpoint) {
    const url = API_BASE + '/' + endpoint;
    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + BEARER };
    // Stratégies dans l'ordre : direct d'abord (fonctionne si CORS OK), puis proxies
    const strategies = [
      () => fetch(url, { headers }),
      () => fetch('https://corsproxy.io/?' + encodeURIComponent(url), { headers }),
      () => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url)),
      () => fetch('https://corsproxy.io/?' + encodeURIComponent(url)),
    ];
    let lastErr;
    for (const attempt of strategies) {
      try {
        const r = await attempt();
        if (!r.ok) { if (r.status === 429) throw new Error('429'); throw new Error('HTTP ' + r.status); }
        const j = await r.json();
        if (j && j.status === 'ok' && j.data !== undefined) return j.data;
        if (Array.isArray(j)) return j;
        if (j && typeof j === 'object' && !j.status) return j; // réponse brute
        throw new Error(j?.message || 'Réponse invalide');
      } catch(e) {
        lastErr = e;
        // Ne pas réessayer sur 429 (rate limit) — attendre
        if (e.message === '429') { await new Promise(r => setTimeout(r, 2000)); }
      }
    }
    throw lastErr || new Error('Échec toutes stratégies');
  }

  try {
    // ── ÉTAPE 1 : Liste des commodités ──
    if (status) status.textContent = 'Récupération des commodités...';
    const commodities = await apiFetch('commodities');
    if (!commodities || !commodities.length) throw new Error('Aucune commodité reçue');

    // ── ÉTAPE 2 : Prix min achat / max vente ──
    // On utilise les champs de prix directement dans l'objet commodities
    // puis on tente commodities_prices_all (1 seule requête globale) pour les min/max précis
    if (status) status.textContent = 'Récupération des prix...';
    const priceMap = {};

    // D'abord : extraire les prix déjà dans commodities (fallback garanti)
    commodities.forEach(com => {
      const cid = com.id || com.id_commodity;
      if (!cid) return;
      priceMap[cid] = {
        buy:  Number(com.price_buy_min  || com.price_buy  || com.trade_price_buy  || com.buy  || 0),
        sell: Number(com.price_sell_max || com.price_sell || com.trade_price_sell || com.sell || 0),
      };
    });

    // Ensuite : commodities_prices par batch de 10 terminaux
    try {
      if (status) status.textContent = 'Chargement liste terminaux...';
      const terminals1 = await apiFetch('terminals?id_star_system=68');
      const terminals2 = await apiFetch('terminals?id_star_system=64');
      const termArr = [...(Array.isArray(terminals1) ? terminals1 : []), ...(Array.isArray(terminals2) ? terminals2 : [])];
      const ids = termArr.map(t => t.id).filter(Boolean);
      const batches = [];
      for (var _i = 0; _i < ids.length; _i += 10) batches.push(ids.slice(_i, _i + 10));

      var allPrices = [];
      for (var _b = 0; _b < batches.length; _b++) {
        if (status) status.textContent = 'Prix terminaux ' + (_b * 10 + 1) + '/' + ids.length + '...';
        try {
          var _chunk = await apiFetch('commodities_prices?id_terminal=' + batches[_b].join(','));
          if (Array.isArray(_chunk)) allPrices = allPrices.concat(_chunk);
        } catch(e) {}
        await new Promise(r => setTimeout(r, 150));
      }

      if (allPrices.length > 0) {
        const agg = {};
        allPrices.forEach(p => {
          const cid = p.id_commodity;
          if (!cid) return;
          const buy  = Number(p.price_buy_min  || p.price_buy  || 0);
          const sell = Number(p.price_sell_max || p.price_sell || 0);
          if (!agg[cid]) agg[cid] = { buys:[], sells:[] };
          if (buy  > 0) agg[cid].buys.push(buy);
          if (sell > 0) agg[cid].sells.push(sell);
        });
        Object.entries(agg).forEach(([cid, {buys, sells}]) => {
          priceMap[cid] = {
            buy:  buys.length  ? Math.min(...buys)  : (priceMap[cid]?.buy  || 0),
            sell: sells.length ? Math.max(...sells) : (priceMap[cid]?.sell || 0),
          };
        });
        if (status) status.textContent = allPrices.length + ' prix chargés (' + ids.length + ' terminaux)';
      }
    } catch(e) {
      if (status) status.textContent = 'Fallback prix inline';
    }

    // ── ÉTAPE 3 : Mapping catégories UEX → TELOS ──
    const catMap = {
      'Mineral':'mineral','Gas':'mineral','Metal':'mineral','Ore':'mineral',
      'Salvage':'salvage','Scrap':'salvage',
      'Agricultural':'ressources','Food':'ressources','Medical':'ressources',
      'Drug':'ressources','Liquid':'ressources',
      'Weapon':'armement','Ammunition':'armement',
      'Armor':'equipements','Component':'equipements','Electronics':'equipements',
      'Consumable':'accessoires','Personal':'accessoires',
      'Other':'autre','Data':'autre',
    };

    const now = new Date().toISOString();
    let added = 0, updated = 0;

    commodities.forEach(c => {
      const name  = (c.name || c.commodity_name || '').trim();
      if (!name) return;
      const cid   = c.id || c.id_commodity;
      const cat   = catMap[c.kind || c.category] || 'autre';
      const pData = priceMap[cid] || {};
      const buyRef  = pData.buy  || Number(c.price_buy  || 0);
      const sellRef = pData.sell || Number(c.price_sell || 0);

      const pEntry = priceMap[cid] || {};
      const buyMin  = pEntry.buy  || buyRef;   // min achat  (ou fallback)
      const sellMax = pEntry.sell || sellRef;  // max vente  (ou fallback)
      const terminals = pEntry.terminals || 0;

      const existing = RESSOURCE_CATALOGUE.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (buyMin  > 0) { existing.buyRef  = buyMin;  existing.buyMin  = buyMin; }
        if (sellMax > 0) { existing.sellRef = sellMax; existing.sellMax = sellMax; }
        if (terminals)     existing.terminals = terminals;
        existing.cat       = existing.cat || cat;
        existing.fromUEX   = true;
        existing.uexId     = cid;
        existing.updatedAt = now;
        updated++;
      } else {
        RESSOURCE_CATALOGUE.push({
          id:      'r_uex_' + (cid || Date.now() + '_' + Math.random().toString(36).slice(2,5)),
          name, cat, quality: '', buyRef: buyMin, sellRef: sellMax,
          buyMin, sellMax, terminals,
          desc: c.description || '',
          fromUEX: true, uexId: cid, addedAt: now, updatedAt: now
        });
        added++;
      }
    });

    // ── ÉTAPE 4 : Sauvegarde & mise à jour UI ──
    await DB.set('telos-ressource-catalogue', RESSOURCE_CATALOGUE);
    await DB.set('telos-last-uex-sync', String(Date.now()));
    await refreshDatalist();
    populateResSelect();
    const _rPanelM = document.getElementById('panel-ressources');
    const _rNavM   = document.getElementById('nav-ressources');
    if (_rPanelM && !_rPanelM.classList.contains('active')) {
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
      _rPanelM.classList.add('active');
      if (_rNavM) _rNavM.classList.add('active');
    }
    await renderRessources();

    const priced = Object.keys(priceMap).length;
    const msg = added + ' ajoutées, ' + updated + ' mises à jour (' + priced + ' prix récupérés)';
    if (status) status.textContent = '✓ ' + msg + ' · ' + new Date().toLocaleTimeString('fr-FR');
    if (btn)    btn.textContent = '↻ SYNC UEX';
    pushLog('system','SYSTEM','Sync UEX API : ' + msg);
    toast('Catalogue UEX synchronisé', msg, 'success');

  } catch(err) {
    if (status) status.textContent = '⚠ API inaccessible — fallback local';
    if (btn)    btn.textContent = '↻ SYNC UEX';
    pushLog('system','SYSTEM','Sync UEX échoué : ' + err.message + ' — fallback local');
    toast('API inaccessible', err.message, 'info');
    syncFromUEXLocal();
  } finally {
    _uexSyncRunning = false;
  }
}

// Fallback avec données embarquées (si CORS bloque)
async function syncFromUEXLocal() {
  const now = new Date().toISOString();
  const LOCAL_DATA = [
    // buyRef = achat min (moins cher tous terminaux), sellRef = vente max (plus cher)
    {name:'Agricium',          cat:'mineral',    buyRef:8200,   sellRef:12800},
    {name:'Agricultural Supplies',cat:'ressources',buyRef:1100, sellRef:1800},
    {name:'Aluminum',          cat:'mineral',    buyRef:3100,   sellRef:4300},
    {name:'Amioshi Plague',    cat:'ressources', buyRef:20000,  sellRef:28000},
    {name:'Ammonia',           cat:'mineral',    buyRef:800,    sellRef:1300},
    {name:'Aphorite',          cat:'mineral',    buyRef:89000,  sellRef:118000},
    {name:'Argon',             cat:'mineral',    buyRef:380,    sellRef:520},
    {name:'Aslarite',          cat:'mineral',    buyRef:4400,   sellRef:6200},
    {name:'Astatine',          cat:'mineral',    buyRef:2900,   sellRef:4200},
    {name:'Atlasium',          cat:'mineral',    buyRef:79000,  sellRef:108000},
    {name:'Audio Visual Equipment',cat:'equipements',buyRef:29000,sellRef:43000},
    {name:'Altruciatoxin',     cat:'ressources', buyRef:5400,   sellRef:7800},
    {name:'Beradom',           cat:'mineral',    buyRef:122000, sellRef:172000},
    {name:'Beryl',             cat:'mineral',    buyRef:16800,  sellRef:24000},
    {name:'Bexalite',          cat:'mineral',    buyRef:24000,  sellRef:34500},
    {name:'Bioplastic',        cat:'ressources', buyRef:6400,   sellRef:9200},
    {name:'Borase',            cat:'mineral',    buyRef:23000,  sellRef:33000},
    {name:'Carbon',            cat:'mineral',    buyRef:290,    sellRef:430},
    {name:'Carbon Silk',       cat:'ressources', buyRef:17500,  sellRef:25000},
    {name:'Cave Kopion Horn',  cat:'ressources', buyRef:29000,  sellRef:43000},
    {name:'CK13 Gid Seed Blend',cat:'ressources',buyRef:440,   sellRef:640},
    {name:'Chlorine',          cat:'mineral',    buyRef:1200,   sellRef:1800},
    {name:'Cobalt',            cat:'mineral',    buyRef:17500,  sellRef:25000},
    {name:'Compboard',         cat:'equipements',buyRef:24500,  sellRef:36000},
    {name:'Construction Materials',cat:'equipements',buyRef:10500,sellRef:15500},
    {name:'Copper',            cat:'mineral',    buyRef:3100,   sellRef:4500},
    {name:'Corundum',          cat:'mineral',    buyRef:3100,   sellRef:4500},
    {name:'DCSR2',             cat:'ressources', buyRef:1000,   sellRef:1500},
    {name:'Degnous Root',      cat:'ressources', buyRef:50000,  sellRef:73000},
    {name:'Diamond Laminate',  cat:'mineral',    buyRef:73000,  sellRef:105000},
    {name:'Diamond',           cat:'mineral',    buyRef:6300,   sellRef:9200},
    {name:'Distilled Spirits', cat:'ressources', buyRef:1600,   sellRef:2400},
    {name:'Dolivine',          cat:'mineral',    buyRef:122000, sellRef:178000},
    {name:'Dymantium',         cat:'mineral',    buyRef:19000,  sellRef:28000},
    {name:'Dynaflex',          cat:'equipements',buyRef:1600,   sellRef:2400},
    {name:'Etam',              cat:'mineral',    buyRef:19500,  sellRef:28500},
    {name:'Feynmaline',        cat:'mineral',    buyRef:285000, sellRef:415000},
    {name:'Fresh Food',        cat:'ressources', buyRef:21000,  sellRef:30500},
    {name:'Fluorine',          cat:'mineral',    buyRef:1100,   sellRef:1600},
    {name:'Foam',              cat:'equipements',buyRef:5300,   sellRef:7700},
    {name:'Gasping Weevil Eggs',cat:'ressources',buyRef:53000,  sellRef:77000},
    {name:'Glacosite',         cat:'mineral',    buyRef:82000,  sellRef:120000},
    {name:'Gold',              cat:'mineral',    buyRef:25000,  sellRef:37000},
    {name:'Golden Medmon',     cat:'ressources', buyRef:49500,  sellRef:72000},
    {name:'Hadanite',          cat:'mineral',    buyRef:455000, sellRef:660000},
    {name:'Heart Of The Woods',cat:'ressources', buyRef:30000,  sellRef:44000},
    {name:'Helium',            cat:'mineral',    buyRef:850,    sellRef:1250},
    {name:'Hephaestanite',     cat:'mineral',    buyRef:3900,   sellRef:5700},
    {name:'Human Food Bars',   cat:'ressources', buyRef:410,    sellRef:600},
    {name:'Hydrogen Fuel',     cat:'mineral',    buyRef:150,    sellRef:220},
    {name:'Hydrogen',          cat:'mineral',    buyRef:850,    sellRef:1250},
    {name:'Irradiated Kopion Horn',cat:'ressources',buyRef:29000,sellRef:43000},
    {name:'Iodine',            cat:'mineral',    buyRef:9600,   sellRef:14000},
    {name:'Iron',              cat:'mineral',    buyRef:2800,   sellRef:4100},
    {name:'Janalite',          cat:'mineral',    buyRef:2400000,sellRef:3500000},
    {name:'Kopion Horn',       cat:'ressources', buyRef:29000,  sellRef:43000},
    {name:'Laranite',          cat:'mineral',    buyRef:7200,   sellRef:10500},
    {name:'Lindinium',         cat:'mineral',    buyRef:39000,  sellRef:57000},
    {name:'Luminalia Gift',    cat:'autre',      buyRef:4250000,sellRef:6200000},
    {name:'Marok Gem',         cat:'ressources', buyRef:42000,  sellRef:61000},
    {name:'Maze',              cat:'ressources', buyRef:2400,   sellRef:3500},
    {name:'Medical Supplies',  cat:'equipements',buyRef:12500,  sellRef:18500},
    {name:'Mercury',           cat:'mineral',    buyRef:9200,   sellRef:13500},
    {name:'Methane',           cat:'mineral',    buyRef:1600,   sellRef:2400},
    {name:'Neograph',          cat:'mineral',    buyRef:7600,   sellRef:11000},
    {name:'Neon',              cat:'mineral',    buyRef:5000,   sellRef:7300},
    {name:'Nitrogen',          cat:'mineral',    buyRef:2600,   sellRef:3800},
    {name:'Omnapoxy',          cat:'equipements',buyRef:7000,   sellRef:10200},
    {name:'Organics',          cat:'ressources', buyRef:1100,   sellRef:1700},
    {name:'Osoian Hides',      cat:'ressources', buyRef:42000,  sellRef:61000},
    {name:'Ouratite',          cat:'mineral',    buyRef:36000,  sellRef:52000},
    {name:'Partillium',        cat:'mineral',    buyRef:11500,  sellRef:16800},
    {name:'Pitambu',           cat:'ressources', buyRef:5000,   sellRef:7300},
    {name:'Potassium',         cat:'mineral',    buyRef:2900,   sellRef:4200},
    {name:'Pressurized Ice',   cat:'mineral',    buyRef:8500,   sellRef:12500},
    {name:'Processed Food',    cat:'ressources', buyRef:2300,   sellRef:3400},
    {name:'Prota',             cat:'ressources', buyRef:13500,  sellRef:19700},
    {name:'Quantanium',        cat:'mineral',    buyRef:128000, sellRef:186000},
    {name:'Quantum Fuel',      cat:'mineral',    buyRef:1200,   sellRef:1800},
    {name:'Quartz',            cat:'mineral',    buyRef:2900,   sellRef:4200},
    {name:'Ranta Dung',        cat:'ressources', buyRef:4200,   sellRef:6100},
    {name:'Recycled Material Composite',cat:'salvage',buyRef:1200,sellRef:1800},
    {name:'Revenant Pod',      cat:'ressources', buyRef:47000,  sellRef:68000},
    {name:'Revenant Tree Pollen',cat:'ressources',buyRef:47000, sellRef:68000},
    {name:'Riccite',           cat:'mineral',    buyRef:49000,  sellRef:71000},
    {name:'Sadaryx',           cat:'mineral',    buyRef:9600,   sellRef:14000},
    {name:'Savrilium',         cat:'mineral',    buyRef:18500,  sellRef:27000},
    {name:'Scrap',             cat:'salvage',    buyRef:820,    sellRef:1300},
    {name:'Silicon',           cat:'mineral',    buyRef:4100,   sellRef:6000},
    {name:'Slam',              cat:'ressources', buyRef:8000,   sellRef:11700},
    {name:'Souvenirs',         cat:'autre',      buyRef:1000,   sellRef:1500},
    {name:'Steel',             cat:'mineral',    buyRef:5400,   sellRef:7900},
    {name:'Stileron',          cat:'mineral',    buyRef:49000,  sellRef:71000},
    {name:'Stims',             cat:'ressources', buyRef:2900,   sellRef:4300},
    {name:'Sunset Berries',    cat:'ressources', buyRef:5300,   sellRef:7700},
    {name:'Taranite',          cat:'mineral',    buyRef:27000,  sellRef:39000},
    {name:'Tin',               cat:'mineral',    buyRef:2800,   sellRef:4100},
    {name:'Titanium',          cat:'mineral',    buyRef:5200,   sellRef:7600},
    {name:'Torite',            cat:'mineral',    buyRef:3300,   sellRef:4800},
    {name:'Tritium',           cat:'mineral',    buyRef:11500,  sellRef:16800},
    {name:'Tungsten',          cat:'mineral',    buyRef:5400,   sellRef:7900},
    {name:'Waste',             cat:'salvage',    buyRef:690,    sellRef:1100},
    {name:'Widow',             cat:'ressources', buyRef:8000,   sellRef:11700},
    {name:'Wuotan Seed',       cat:'ressources', buyRef:5300,   sellRef:7700},
    {name:'Xapyen',            cat:'mineral',    buyRef:23000,  sellRef:33500},
    {name:'Year Of The Pig Envelope',cat:'autre',buyRef:5000000,sellRef:7300000},
  ];


  let added=0, updated=0;
  LOCAL_DATA.forEach(c => {
    const existing = RESSOURCE_CATALOGUE.find(x => x.name.toLowerCase()===c.name.toLowerCase());
    if (existing) {
      if (c.buyRef  > 0) { existing.buyRef  = c.buyRef;  existing.buyMin  = c.buyRef; }
      if (c.sellRef > 0) { existing.sellRef = c.sellRef; existing.sellMax = c.sellRef; }
      existing.fromUEX=true; existing.updatedAt=now; updated++;
    } else {
      RESSOURCE_CATALOGUE.push({
        id:'r_uex_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
        name:c.name, cat:c.cat, quality:'',
        buyRef:c.buyRef, sellRef:c.sellRef, buyMin:c.buyRef, sellMax:c.sellRef, desc:'',
        fromUEX:true, addedAt:now, updatedAt:now
      });
      added++;
    }
  });
  await DB.set('telos-ressource-catalogue', RESSOURCE_CATALOGUE);
  await DB.set('telos-last-uex-sync', String(Date.now()));
  await refreshDatalist();
  populateResSelect();
  // Forcer l'affichage du panel ressources et re-render
  const _rPanel = document.getElementById('panel-ressources');
  const _rNav   = document.getElementById('nav-ressources');
  if (_rPanel && !_rPanel.classList.contains('active')) {
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    _rPanel.classList.add('active');
    if (_rNav) _rNav.classList.add('active');
  }
  await renderRessources();
  const msg = added+' ajoutées, '+updated+' mises à jour (données locales v4.8.0)';
  const status = document.getElementById('uex-sync-status');
  if (status) status.textContent = '✓ '+msg;
  toast('Catalogue mis à jour', msg, 'success');
}

/* Lance une sync auto au chargement du panel ressources */
async function autoSyncUEX() {
  const lastSync = await DB.get('telos-last-uex-sync');
  const now = Date.now();
  // Sync auto si la dernière sync date de plus de 30 minutes
  if (!lastSync || now - parseInt(lastSync) > 30 * 60 * 1000) {
    await DB.set('telos-last-uex-sync', String(now));
    syncFromUEX();
  }
}

/* ════════════════════════════════════════════════════════════
   BLUEPRINTS — Catalogue Corp
════════════════════════════════════════════════════════════ */
var BLUEPRINTS = [];
var _bpFilter = 'all';
var _editBpId = null;
var _bpIngredients = [];

var BP_CAT_LABELS = {
  vaisseau:'🚀 Vaisseau', fps:'🛡 FPS', composant:'🔧 Composant', autre:'○ Autre'
};

async function loadBlueprints() {
  BLUEPRINTS = (await DB.get('telos-blueprints')) || [];
  HISTORIQUE_DATA = (await DB.get('telos-historique')) || [];
  // Charger le cache de tous les joueurs pour que les owners soient disponibles partout
  if (!window._playerBpCache) window._playerBpCache = {};
  await Promise.all(players.map(async p => {
    try {
      const bps = await DB.get('player-blueprints-' + p.id);
      if (bps) window._playerBpCache[p.id] = bps;
    } catch(e) {}
  }));
  renderBlueprints();
  const badgeBp = document.getElementById('badge-blueprints');
  if (badgeBp) { const myBps=SESSION?((window._playerBpCache&&window._playerBpCache[SESSION.pid])||[]):[];badgeBp.textContent=myBps.length;badgeBp.style.display=myBps.length>0?'':'none'; }
}

async function saveBlueprints() {
  await DB.set('telos-blueprints', BLUEPRINTS);
}

function setBpFilter(f, btn) {
  _bpFilter = f;
  document.querySelectorAll('#panel-blueprints .filter-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderBlueprints();
}

function goToBlueprints(el) {
  if (!SESSION) { openLoginModal(null, () => goToBlueprints(el)); return; }
  goPanel('blueprints', el);
}

async function renderBlueprints() {
  const tbody = document.getElementById('bp-tbody');
  if (!tbody) return;
  if (!SESSION) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">🔒 Connectez-vous pour accéder aux blueprints.</td></tr>';
    return;
  }

  const search = (document.getElementById('bp-search')?.value||'').toLowerCase();
  let data = [...BLUEPRINTS];
  if (_bpFilter !== 'all') data = data.filter(b=>b.cat===_bpFilter);
  if (search) data = data.filter(b=>b.name.toLowerCase().includes(search)||(b.notes||'').toLowerCase().includes(search));
  data.sort((a,b)=>a.name.localeCompare(b.name,'fr'));

  const countEl = document.getElementById('bp-count');
  if (countEl) countEl.textContent = data.length + ' blueprint'+(data.length>1?'s':'');

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">Aucun blueprint — cliquez sur + AJOUTER</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(b => {
    const ingredients = (b.ingredients||[]).map(i=>
      '<span style="font-size:10px;padding:1px 6px;border:1px solid var(--border);margin:1px;display:inline-block;">'
      +esc(i.name)+' x'+i.qty+'</span>'
    ).join('');

    const owners = (b.owners||[]).map(oid => {
      const p = players.find(x=>x.id===oid);
      return p ? '<span style="font-size:10px;color:var(--blue);">'+esc(p.name)+'</span>' : '';
    }).filter(Boolean).join(', ');

    return '<tr>'
      +'<td style="font-weight:700;color:var(--text-bright);">📐 '+esc(b.name)+(b.fromWiki?'<span style="font-size:8px;margin-left:5px;padding:1px 5px;border:1px solid rgba(89,208,255,0.4);color:var(--blue);letter-spacing:1px;">WIKI</span>':'')+'</td>'
      +'<td><span style="font-size:11px;padding:2px 7px;border:1px solid var(--border);color:var(--text-dim);">'+(BP_CAT_LABELS[b.cat]||b.cat)+'</span></td>'
      +'<td style="max-width:220px;">'+(ingredients||'<span style="color:var(--text-dim);">—</span>')+'</td>'

      +(()=>{
        const clsLabel = {civil:'🏙 Civil',industriel:'⚙ Industriel',militaire:'⚔ Militaire',furtif:'👁 Furtif',competition:'🏆 Compétition'};
        const cls = b.bpClass ? '<span style="font-size:10px;color:var(--text-dim);">'+clsLabel[b.bpClass]+'</span>' : '—';
        const sz  = b.level ? 'Taille '+b.level : '—';
        return '<td style="font-size:11px;"><div>'+cls+'</div><div style="color:var(--text-dim);font-size:10px;">'+sz+'</div></td>';
      })()
      +'<td>'+(owners||'<span style="color:var(--text-dim);">—</span>')+'</td>'
      +(()=>{
        const myBps=(window._playerBpCache&&window._playerBpCache[SESSION?.pid])||[];
        const isOwner=myBps.includes(b.id);
        let td='<td style="min-width:150px;">';
        if(SESSION) td+='<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:'+(isOwner?'var(--green)':'var(--text-dim)')+';margin-bottom:5px;"><input type="checkbox" '+(isOwner?'checked':'')+' data-bpid="'+b.id.replace(/"/g,'')+'" style="width:14px;height:14px;accent-color:var(--orange);cursor:pointer;" class="bp-own-cb"><span>'+(isOwner?'✓ Je possède':'○ Je possède')+'</span></label>';
        if(canManageRoles()) td+='<button data-delbp="'+b.id.replace(/"/g,'')+'" style="padding:3px 10px;border:1px solid rgba(255,68,68,0.4);color:var(--red);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);letter-spacing:1px;">✕ Supprimer</button>';
        td+='</td>';
        return td;
      })()
      +'</tr>';
  }).join('');
}
function removeBpIngredient(id) {
  _bpIngredients = _bpIngredients.filter(i=>i.id!==id);
  refreshBpIngredients();
}

function refreshBpIngredients() {
  const el = document.getElementById('bp-ingredients-list');
  if (!el) return;
  el.innerHTML = _bpIngredients.map(i =>
    '<div style="display:flex;gap:6px;align-items:center;">'
    +'<input type="text" value="'+esc(i.name)+'" placeholder="Ressource..." list="ps-datalist"'
    +' style="flex:1;padding:6px 9px;background:var(--bg3);border:1px solid var(--border);color:var(--text-bright);font-family:var(--mono);font-size:11px;"'
    +' onchange="_bpIngredients.find(x=>x.id==='+i.id+').name=this.value">'
    +'<input type="number" value="'+i.qty+'" min="1" placeholder="Qté"'
    +' style="width:70px;padding:6px 9px;background:var(--bg3);border:1px solid var(--border);color:var(--orange);font-family:var(--mono);font-size:11px;text-align:center;"'
    +' onchange="_bpIngredients.find(x=>x.id==='+i.id+').qty=Math.max(1,parseFloat(this.value)||1)">'
    +'<select style="padding:5px 6px;background:var(--bg3);border:1px solid var(--border);color:var(--text-dim);font-family:var(--ui);font-size:10px;cursor:pointer;" onchange="_bpIngredients.find(x=>x.id==='+i.id+').unit=this.value">'
    +'<option value="SCU"'+(i.unit==='SCU'||!i.unit?' selected':'')+'>SCU</option>'
    +'<option value="unité"'+(i.unit==='unité'?' selected':'')+'>Unité</option>'
    +'</select>'
    +'<button data-action="bp-remove-ing" data-id="'+i.id+'" style="padding:4px 8px;border:1px solid rgba(255,68,68,0.4);color:var(--red);background:transparent;cursor:pointer;font-size:11px;">✕</button>'
    +'</div>'
  ).join('');
}

function refreshBpOwners(currentOwners) {
  const el = document.getElementById('bp-owners-list');
  if (!el) return;
  el.innerHTML = players.map(p =>
    '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;color:var(--text-dim);">'
    +'<input type="checkbox" value="'+p.id+'"'+(currentOwners?.includes(p.id)?' checked':'')
    +' style="accent-color:var(--orange);">'+esc(p.name)+'</label>'
  ).join('');
}

function openAddBlueprint(editId) {
  editId = editId||null;
  _editBpId = editId;
  const b = editId ? BLUEPRINTS.find(x=>x.id===editId) : null;
  _bpIngredients = (b?.ingredients||[]).map(i=>({...i, id:Date.now()+Math.random()}));

  const set = (id,v)=>{ const e=document.getElementById(id); if(e)e.value=v; };
  set('bp-name',       b?.name||'');
  set('bp-cat',        b?.cat||'vaisseau');
  set('bp-class',      b?.bpClass||'');
  set('bp-level',      b?.level||'');
  set('bp-notes',      b?.notes||'');

  refreshBpIngredients();
  refreshBpOwners(b?.owners||[]);

  const title = document.getElementById('bp-modal-title');
  if (title) title.textContent = editId ? '✏ MODIFIER LE BLUEPRINT' : '📐 AJOUTER UN BLUEPRINT';
  document.getElementById('bp-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('bp-name')?.focus(),80);
}

function closeAddBlueprint() {
  document.getElementById('bp-overlay').classList.remove('open');
  _editBpId = null;
}

function editBlueprint(id) { openAddBlueprint(id); }

async function deleteBlueprint(id) {
  const b = BLUEPRINTS.find(x=>x.id===id);
  if (!b || !confirm('Supprimer "'+b.name+'" ?')) return;
  BLUEPRINTS = BLUEPRINTS.filter(x=>x.id!==id);
  await saveBlueprints();
  renderBlueprints();
  toast('Blueprint supprimé', b.name, 'success');
}

async function saveBlueprint() {
  const name = document.getElementById('bp-name')?.value.trim();
  if (!name) { toast('Nom requis','','error'); return; }

  const owners = [...document.querySelectorAll('#bp-owners-list input:checked')].map(c=>c.value);
  const entry = {
    id:        _editBpId||('bp_'+Date.now()),
    name,
    cat:       document.getElementById('bp-cat')?.value||'vaisseau',
    bpClass:   document.getElementById('bp-class')?.value||'',
    level:     document.getElementById('bp-level')?.value||'',
    notes:     document.getElementById('bp-notes')?.value.trim()||'',
    ingredients: _bpIngredients.filter(i=>i.name.trim()).map(i=>({name:i.name.trim(),qty:i.qty})),
    owners,
    addedAt:   _editBpId?(BLUEPRINTS.find(x=>x.id===_editBpId)?.addedAt||new Date().toISOString()):new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (_editBpId) {
    BLUEPRINTS = BLUEPRINTS.map(x=>x.id===_editBpId?entry:x);
  } else {
    BLUEPRINTS.push(entry);
  }
  await saveBlueprints();
  closeAddBlueprint();
  renderBlueprints();
  pushActivity('📐', (_editBpId?'Blueprint modifié : ':'Nouveau blueprint : ')+name, '', true);
  toast(_editBpId?'Blueprint modifié':'Blueprint ajouté', name, 'success');
}

/* ════════════════════════════════════════════════════════════
   BLUEPRINTS SYNC — API star-citizen.wiki (v4.8.0 · 1559 blueprints)
   Endpoint : https://api.star-citizen.wiki/api/blueprints?limit=100&page=N
   Données  : output.name, output.type_label, ingredients, craft_time_seconds
════════════════════════════════════════════════════════════ */
var _bpSyncRunning = false;

async function syncBlueprintsFromWiki() {
  if (_bpSyncRunning) return;
  _bpSyncRunning = true;
  const btn    = document.getElementById('btn-bp-sync');
  const status = document.getElementById('bp-sync-status');
  if (btn)    { btn.textContent = '⏳ Sync...'; btn.disabled = true; }
  if (status) status.textContent = 'Connexion à star-citizen.wiki...';

  const API    = 'https://api.star-citizen.wiki/api/blueprints';
  const LIMIT  = 100;
  const PROXIES = [
    u => 'https://corsproxy.io/?' + encodeURIComponent(u),
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => u,
  ];

  async function wikiFetch(url) {
    let lastErr;
    for (const makeUrl of PROXIES) {
      try {
        const r = await fetch(makeUrl(url), { headers: { 'Accept': 'application/json' } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } catch(e) { lastErr = e; }
    }
    throw lastErr;
  }

  try {
    // Récupérer la première page pour connaître le total
    const first = await wikiFetch(API + '?limit=' + LIMIT + '&page=1');
    const totalBp = first.meta?.total || first.data?.length || 0;
    const pages   = Math.ceil(totalBp / LIMIT);

    if (status) status.textContent = totalBp + ' blueprints — récupération (' + pages + ' pages)...';

    // Récupérer toutes les pages
    let allBp = [...(first.data || [])];
    for (let p = 2; p <= pages; p++) {
      try {
        const page = await wikiFetch(API + '?limit=' + LIMIT + '&page=' + p);
        allBp = allBp.concat(page.data || []);
        if (status) status.textContent = allBp.length + ' / ' + totalBp + ' blueprints...';
      } catch(e) { break; }
      await new Promise(r => setTimeout(r, 200));
    }

    // Mapping type_label → catégorie TELOS
    const catMap = {
      'Weapon Gun':        'fps',
      'Weapon Melee':      'fps',
      'Armor':             'fps',
      'Clothes':           'fps',
      'Personal Weapon':   'fps',
      'WeaponPersonal':    'fps',
      'Magazine':          'fps',
      'Weapon Attachment': 'fps',
      'PowerPlant':        'vaisseau',
      'Shield':            'vaisseau',
      'Cooler':            'vaisseau',
      'QuantumDrive':      'vaisseau',
      'FlightController':  'vaisseau',
      'Radar':             'vaisseau',
      'Turret':            'vaisseau',
      'MissileLauncher':   'vaisseau',
      'Missile':           'vaisseau',
      'WeaponGun':         'fps',
      'Bomb':              'vaisseau',
    };

    const now = new Date().toISOString();
    let added = 0, updated = 0;

    allBp.forEach(bp => {
      if (!bp.output?.name) return;
      const name       = bp.output.name.trim();
      const typeLabel  = bp.output.type_label || bp.output.type || '';
      const cat        = catMap[typeLabel] || catMap[bp.output.type] || 'composant';

      // Extraire la taille depuis la classe (ex: amrs_lasercannon_s3 → 3)
      const sizeMatch  = (bp.output.class || '').match(/_s(\d)$/i);
      const size       = sizeMatch ? sizeMatch[1] : '';

      // Ingrédients
      const ingredients = (bp.ingredients || []).map(i => ({
        name: i.name,
        qty:  i.quantity_scu || i.quantity || 1,
        unit: i.quantity_scu ? 'SCU' : 'unité',
      }));

      // Temps de craft
      const craftTime = bp.craft_time_label || '';

      const existing = BLUEPRINTS.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.ingredients = ingredients;
        existing.level       = size || existing.level;
        existing.cat         = existing.cat || cat;
        existing.craftTime   = craftTime;
        existing.wikiUuid    = bp.uuid;
        existing.updatedAt   = now;
        updated++;
      } else {
        BLUEPRINTS.push({
          id:          'bp_wiki_' + bp.uuid,
          name,
          cat,
          bpClass:     '',
          level:       size,
          notes:       bp.craft_time_label ? 'Temps de craft : ' + bp.craft_time_label : '',
          ingredients,
          owners:      [],
          craftTime,
          wikiUuid:    bp.uuid,
          fromWiki:    true,
          addedAt:     now,
          updatedAt:   now,
        });
        added++;
      }
    });

    await saveBlueprints();
    renderBlueprints();

    const msg = added + ' ajoutés, ' + updated + ' mis à jour (' + allBp.length + ' blueprints v4.8.0)';
    if (status) status.textContent = '✓ ' + msg + ' · ' + new Date().toLocaleTimeString('fr-FR');
    if (btn)    btn.textContent = '↻ SYNC WIKI';
    pushLog('system', 'SYSTEM', 'Sync blueprints wiki : ' + msg);
    toast('Blueprints synchronisés', msg, 'success');

  } catch(err) {
    if (status) status.textContent = '✕ Erreur : ' + err.message;
    if (btn)    btn.textContent = '↻ SYNC WIKI';
    toast('Erreur sync blueprints', err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    _bpSyncRunning = false;
  }
}


function showLoginWall(panelEl, id) {
  if (!panelEl) return;
  // Supprimer un éventuel ancien wall
  const existing = panelEl.querySelector('.telos-login-wall');
  if (existing) existing.remove();
  // S'assurer que le panel est en position relative pour l'overlay
  if (getComputedStyle(panelEl).position === 'static') panelEl.style.position = 'relative';
  const ICONS = {
    map:'🗺', partners:'👥', joueurs:'📦', stocks:'📦',
    blueprints:'📐', commandes:'📋', objectifs:'🎯',
    missions:'🛡', commerce:'💹', logs:'📡', ressources:'🔬'
  };
  const icon = ICONS[id] || '🔒';
  const wall = document.createElement('div');
  wall.className = 'telos-login-wall';
  wall.style.cssText = 'position:absolute;inset:0;z-index:50;background:rgba(2,5,12,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:40px;backdrop-filter:blur(2px);';
  wall.innerHTML = `
    <div style="font-size:52px;opacity:0.15;">${icon}</div>
    <div style="font-size:11px;letter-spacing:3px;color:var(--text-dim);text-transform:uppercase;">Accès restreint</div>
    <div style="font-size:13px;color:var(--text-dim);text-align:center;max-width:300px;line-height:1.6;">
      Connectez-vous pour accéder à cet espace du réseau TELOS.
    </div>
    <button onclick="openLoginModal(null,()=>goPanel('${id}'))"
      style="padding:10px 28px;border:1px solid var(--orange);background:rgba(247,140,30,0.08);color:var(--orange);font-family:var(--ui);font-size:11px;letter-spacing:2px;cursor:pointer;">
      🔑 SE CONNECTER
    </button>`;
  panelEl.appendChild(wall);
  panelEl._loginWall = true;
}

function clearLoginWall(panelEl) {
  if (!panelEl) return;
  const wall = panelEl.querySelector('.telos-login-wall');
  if (wall) wall.remove();
  panelEl._loginWall = false;
}

function goPanel(id, el) {
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  if (!el) {
    document.querySelectorAll('.nav-item').forEach(n=>{
      if ((n.getAttribute('onclick')||'').includes("'"+id+"'")) el=n;
    });
  }
  if (el) el.classList.add('active');
  const p = document.getElementById('panel-'+id);
  if (p) p.classList.add('active');

  // ── Login wall : panel vide si non connecté ──
  if (!SESSION && !PANELS_PUBLIC.includes(id)) {
    showLoginWall(p, id);
    return;
  }

  // Retirer le login wall overlay si présent
  clearLoginWall(p);

  if (id==='map')      { setTimeout(()=>{ const c=document.getElementById('map-canvas-full'); if(c){const w=c.offsetWidth,h=c.offsetHeight;if(w>10&&h>10&&(c.width!==w||c.height!==h)){c.width=w;c.height=h;c._inited=false;}} }, 60); }
  if (id==='joueurs')  { (async()=>renderGlobal())(); updateGlobalFilter(); }
  if (id==='inscription') { populateRegRoles(); }
  if (id==='stocks')   {
    renderStocksFromPlayers();
    if (SESSION) {
      const me = players.find(p => p.id === SESSION.pid);
      if (me) { selectedPid = me.id; renderStockTable((async()=>{ return (await DB.get('uex-stocks-'+me.id))||[]; })()); selectPlayer(me.id); }
    }
  }
  if (id==='partners') { renderPartners(); }
  if (id==='missions') { renderMissions(); }
  if (id==='ressources') { renderRessources().catch(e=>console.warn(e)); if(canManageRoles()) autoSyncUEX(); }
  if (id==='armurie') {
    _updateArmTypeFilter();
    renderArmurie();
    // S'assurer que l'onglet actif est visuellement correct
    const activeBtn = document.getElementById('arm-tab-' + _armTab);
    if (activeBtn) { activeBtn.style.borderBottom = '2px solid var(--orange)'; activeBtn.style.color = 'var(--text-bright)'; }
  }
  if (id==='objectifs') { renderObjectifs(); }
  if (id==='commandes') { renderCommandes(); }
  if (id==='blueprints') {
    if (SESSION) {
      loadPlayerOwnedBlueprints().then(() => renderBlueprints());
    } else {
      renderBlueprints();
    }
  }
  if (id==='banque') { loadBankData().then(() => renderBanque()); }
  if (id==='logs') { if (!HISTORIQUE_DATA.length) loadHistorique(); }
  if (id==='hub') { setTimeout(() => { renderHubBankStats && renderHubBankStats(); }, 80); }
  setTimeout(()=>{
    drawChart(chartDays);
    const c = document.getElementById('stanton-canvas');
    if (c) {
      const w = c.offsetWidth, h = c.offsetHeight;
      if (w > 10 && h > 10 && (c.width !== w || c.height !== h)) {
        c.width = w; c.height = h; c._inited = false;
      }
    }
  }, 60);
  if (id==='armurerie') {
    renderArmPartnerList();
    // Auto-sélectionner le joueur connecté
    if (SESSION) {
      const me = players.find(p=>p.id===SESSION.pid);
      if (me) setTimeout(()=>selectArmPlayer(me.id), 50);
    }
  }
}

/* ════════════════════════════════════════════════════════════
   PLAYERS SYSTEM
════════════════════════════════════════════════════════════ */
function switchJTab(tab){
  // Sous-onglet unique — on s'assure juste que la liste est visible
  const sp = document.getElementById('jsp-list');
  if (sp) sp.style.display = 'flex';
}

/* Register a new player */
// Rôles exclus de la fiche d'inscription (non sélectionnables à l'inscription)
// Désormais géré dynamiquement via ROLES_INSCRIPTION_CONFIG
const ROLES_EXCLUS_INSCRIPTION = ['Gestionnaire', 'Lead'];

// Config dynamique : true = visible à l'inscription, false = exclu
// Initialisé dans loadRolesConfig / par défaut selon ROLES_EXCLUS_INSCRIPTION
var ROLES_INSCRIPTION_CONFIG = {};

function populateRegRoles() {
  const sel = document.getElementById('reg-role');
  if (!sel) return;
  const current = sel.value;
  // Utilise ROLES_INSCRIPTION_CONFIG si dispo, sinon ROLES_EXCLUS_INSCRIPTION par défaut
  const visibles = ROLES.filter(r => {
    if (r in ROLES_INSCRIPTION_CONFIG) return ROLES_INSCRIPTION_CONFIG[r];
    return !ROLES_EXCLUS_INSCRIPTION.includes(r);
  });
  sel.innerHTML = visibles.length
    ? visibles.map(r => `<option value="${r}">${r}</option>`).join('')
    : '<option value="" disabled>Aucun rôle disponible</option>';
  if (visibles.includes(current)) sel.value = current;
  toggleGestionnaireCode(sel.value);
}

function toggleGestionnaireCode(role) {
  const field = document.getElementById('gestionnaire-code-field');
  const input = document.getElementById('reg-gestionnaire-code');
  if (!field) return;
  if (role === 'Gestionnaire') {
    field.style.display = 'flex';
    field.style.flexDirection = 'column';
    field.style.gap = '4px';
  } else {
    field.style.display = 'none';
    if (input) input.value = '';
  }
}

async function registerPlayer(){
  const name = document.getElementById('reg-name').value.trim();
  const rsi  = document.getElementById('reg-rsi').value.trim();
  const uex  = document.getElementById('reg-uex').value.trim();
  const role = document.getElementById('reg-role').value;
  let ok=true;
  ['err-name','err-rsi','err-corpo-access','err-code','err-gestionnaire-code'].forEach(id=>{ const e=document.getElementById(id); if(e){e.textContent='';e.classList.remove('show');} });
  if (!name||name.length<2){ showErr('err-name','Le pseudo doit faire au moins 2 caractères.'); ok=false; }
  else if (players.find(p=>p.name.toLowerCase()===name.toLowerCase())){ showErr('err-name','Ce pseudo est déjà enregistré.'); ok=false; }
  if (!rsi||!rsi.startsWith('http')){ showErr('err-rsi','URL RSI invalide (doit commencer par https://).'); ok=false; }
  // Validation code d'accès corpo — TOUJOURS obligatoire
  const corpoAccess = document.getElementById('reg-corpo-access').value.trim();
  if (!corpoAccess) {
    showErr('err-corpo-access', '⚠ Le code d\'accès corpo est obligatoire.');
    ok = false;
  } else if (!(await verifyCorpoAccessCode(corpoAccess))) {
    const stored = await getCorpoAccessHash();
    if (!stored) {
      showErr('err-corpo-access', '⚠ Aucun code corpo configuré — contactez l\'Admin.');
    } else {
      showErr('err-corpo-access', '⚠ Code d\'accès corpo incorrect.');
    }
    ok = false;
  }
  const regCode = document.getElementById('reg-code').value.trim();
  if (!regCode || regCode.length < 4) { showErr('err-code', 'Le code personnel doit faire au moins 4 caractères.'); ok=false; }
  // Validation code gestionnaire
  if (role === 'Gestionnaire') {
    const gCode = document.getElementById('reg-gestionnaire-code').value.trim();
    if (!gCode) { showErr('err-gestionnaire-code', 'Le code d\'accès Gestionnaire est requis.'); ok=false; }
    else {
      const gHash = await getGestionnaireHash();
      const gInputHash = await sha256(gCode);
      if (gInputHash !== gHash) { showErr('err-gestionnaire-code', '⚠ Code incorrect — accès Gestionnaire refusé.'); ok=false; }
    }
  }
  if (!ok) return;
  const codeHash = await sha256(regCode);
  const isFounder = players.length === 0;
  const pid = 'p_'+Date.now();
  const p={ id:pid, name, rsi, uex:uex||null, role, codeHash, isAdmin:isFounder, joinedAt:new Date().toISOString() };
  players.push(p);
  await DB.set('uex-players', players);
  await DB.set('telos-player-code-'+pid, { code: regCode, name, savedAt: new Date().toISOString() });
  ['reg-name','reg-rsi','reg-uex','reg-corpo-access','reg-code'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  populateRegRoles();
  renderPlayerList();
  updateBadges();
  updateGlobalFilter();
  renderPartners();
  pushActivity('⬡', `${name} a rejoint le réseau TELOS`, '', true);
  updateKPIs();
  toast('Joueur enregistré !', `${name} a rejoint le réseau TELOS.`, 'success');
  setSession(p);
  goPanel('joueurs');
  setTimeout(()=>selectPlayer(p.id), 80);
}
function showErr(id,msg){ document.getElementById(id).textContent=msg; document.getElementById(id).classList.add('show'); }

/* Render sidebar player list */
async function renderPlayerList(filter=''){
  const list=document.getElementById('pl-list');
  const filtered=filter ? players.filter(p=>p.name.toLowerCase().includes(filter.toLowerCase())) : players;
  if (!filtered.length){
    list.innerHTML=`<div class="pl-empty-msg">${filter?'Aucun résultat.':'Aucun joueur enregistré.<br>Utilisez l\'onglet + Inscription.'}</div>`;
    return;
  }
  const items=await Promise.all(filtered.map(async p=>{
    const stocks=(await DB.get('uex-stocks-'+p.id))||[];
    const stockCount = stocks.filter(s => (parseFloat(s.qty)||0) > 0).length;
    return `<div class="pl-item ${selectedPid===p.id?'sel':''}" onclick="selectPlayer('${p.id}')">
      <div class="pl-avatar" style="overflow:hidden;">${avHtml(p,32)}</div>
      <div class="pl-info">
        <div class="pl-name">${esc(p.name)}</div>
        <div class="pl-meta">${p.role} · ${fmtDate(p.joinedAt)}</div>
      </div>
      <span class="pl-badge ${stockCount?'pb-stock':'pb-empty'}">${stockCount?stockCount+' res.':'vide'}</span>
    </div>`;
  }));
  list.innerHTML=items.join('');
}

function filterPlayers(v){ renderPlayerList(v); }

/* Select and display a player */
// Onglet actif dans la vue partenaire : 'telos' ou 'perso'
var _currentPlTab = 'telos';

function switchPlTab(tab, btn) {
  _currentPlTab = tab;
  // Onglets boutons
  ['telos','perso'].forEach(t => {
    const b = document.getElementById('pltab-' + t);
    const c = document.getElementById('pltab-content-' + t);
    if (!b || !c) return;
    if (t === tab) {
      b.style.borderBottomColor = 'var(--orange)';
      b.style.color = 'var(--text-bright)';
      c.style.display = 'flex';
    } else {
      b.style.borderBottomColor = 'transparent';
      b.style.color = 'var(--text-dim)';
      c.style.display = 'none';
    }
  });
  // Recharger le stock de l'onglet si un partenaire est sélectionné
  if (selectedPid) {
    if (tab === 'telos') {
      DB.get('uex-stocks-' + selectedPid).then(s => renderStockTable(s || []));
    } else {
      DB.get('uex-perso-' + selectedPid).then(s => renderPersoTable(s || []));
    }
  }
}

function backToPartnerList() {
  document.getElementById('jsp-list-view').style.display = 'flex';
  const pv = document.getElementById('jsp-partner-view');
  if (pv) pv.style.display = 'none';
  document.getElementById('jsp-header-list').style.display = 'flex';
  document.getElementById('jsp-header-view').style.display = 'none';
  // Désélectionner dans la liste
  document.querySelectorAll('#pl-list .pl-item').forEach(el => el.classList.remove('sel'));
  selectedPid = null;
}

async function selectPlayer(id){
  selectedPid=id;
  const p=players.find(x=>x.id===id);
  if (!p) return;

  // Basculer vers la vue partenaire (masquer la liste)
  document.getElementById('jsp-list-view').style.display = 'none';
  const pv = document.getElementById('jsp-partner-view');
  if (pv) { pv.style.display = 'flex'; pv.style.flexDirection = 'column'; }
  document.getElementById('jsp-header-list').style.display = 'none';
  document.getElementById('jsp-header-view').style.display = 'flex';

  // Mettre à jour le titre
  const jtabName = document.getElementById('jtab-partner-name');
  if (jtabName) jtabName.textContent = p.name;
  renderPlayerList(document.getElementById('pl-search')?.value || '');
  // Badge blueprints
  if (!window._playerBpCache) window._playerBpCache = {};
  // Toujours recharger depuis DB pour être à jour
  window._playerBpCache[id] = (await DB.get('player-blueprints-' + id)) || [];
  const bpBadge = document.getElementById('badge-blueprints');
  if (bpBadge) { const _n=window._playerBpCache[id].length; bpBadge.textContent=_n; bpBadge.style.display=_n>0?'':'none'; }
  const stocks=(await DB.get('uex-stocks-'+id))||[];
  document.getElementById('pl-placeholder').style.display='none';
  const content=document.getElementById('pl-content');
  content.style.display='flex';
  content.style.flexDirection='column';
  // Hero
  const tv=stocks.reduce((a,s)=>a+(s.price||0)*s.qty,0);
  const tu=stocks.reduce((a,s)=>a+Number(s.qty),0);
  const marketVal=stocks.reduce((a,s)=>{const m=s.res?MARKET_PRICES[(s.res||'').toLowerCase()]:null;return a+(m?m.sell*s.qty:(s.sellprice||s.price||0)*s.qty);},0);
  const plMarket=marketVal-tv;
  const plSign=plMarket>=0?'+':'';
  const plCol=plMarket>=0?'var(--green)':'var(--red)';
  const bpCount=((window._playerBpCache&&window._playerBpCache[id])||[]).length;

  document.getElementById('prof-hero').innerHTML=`
    <div style="display:flex;flex-direction:column;width:100%;">

      <!-- Carte principale -->
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px 12px;border:1px solid var(--border);margin:12px;background:var(--bg2);position:relative;">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--orange),transparent);"></div>

        <!-- Avatar -->
        <div style="width:48px;height:48px;flex-shrink:0;background:var(--bg3);border:2px solid var(--orange);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--orange);font-weight:700;clip-path:polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%);overflow:hidden;">${avHtml(p,48)}</div>

        <!-- Nom + badge + date -->
        <div style="flex:1;min-width:0;">
          <div style="font-size:18px;font-weight:700;color:var(--text-bright);letter-spacing:1px;line-height:1.1;">${esc(p.name)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
            ${p.isAdmin
              ? `<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:2px 7px;border:1px solid #fff;color:#fff;font-family:var(--ui);">ADMIN</span>`
              : `<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:2px 7px;border:1px solid ${ROLE_COLORS[p.role]||'var(--orange)'};color:${ROLE_COLORS[p.role]||'var(--orange)'};font-family:var(--ui);">${p.role||'—'}</span>
                 ${canManageRoles()?`<button onclick="openEditRole('${p.id}')" style="padding:2px 6px;border:1px solid var(--border);background:transparent;color:var(--text-dim);font-family:var(--ui);font-size:10px;cursor:pointer;" onmouseover="this.style.color='var(--orange)';this.style.borderColor='var(--orange)'" onmouseout="this.style.color='var(--text-dim)';this.style.borderColor='var(--border)'">✏</button>`:''}`
            }
            <span style="font-size:10px;color:var(--text-dim);font-family:var(--mono);">depuis ${fmtDate(p.joinedAt)}</span>
          </div>
          <!-- Liens RSI/UEX inline sous le nom -->
          <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">
            <a class="prof-link" href="${esc(p.rsi)}" target="_blank" rel="noopener" style="font-size:9px;padding:2px 6px;"><span class="ll">RSI</span>${shortUrl(p.rsi)}</a>
            ${p.uex?`<a class="prof-link" href="${esc(p.uex)}" target="_blank" rel="noopener" style="font-size:9px;padding:2px 6px;"><span class="ll">UEX</span>${shortUrl(p.uex)}</a>`:''}
          </div>
        </div>

        <!-- STOCK + BLUEPRINTS -->
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
          <div style="text-align:right;">
            <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;">STOCK</div>
            <div style="font-family:var(--mono);font-size:17px;color:${stocks.length?'var(--orange)':'var(--text-dim)'};">${stocks.length} res.</div>
          </div>
          ${bpCount>0?`<div style="text-align:right;">
            <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;">BLUEPRINTS</div>
            <div style="font-family:var(--mono);font-size:17px;color:#60a5fa;">${bpCount} 📐</div>
          </div>`:''}
        </div>
      </div>

    </div>`;
  // Réinitialiser sur l'onglet TELOS à chaque changement de partenaire
  _currentPlTab = 'telos';
  ['telos','perso'].forEach(t => {
    const b = document.getElementById('pltab-' + t);
    const c = document.getElementById('pltab-content-' + t);
    if (b) { b.style.borderBottomColor = t==='telos'?'var(--orange)':'transparent'; b.style.color = t==='telos'?'var(--text-bright)':'var(--text-dim)'; }
    if (c) c.style.display = t==='telos' ? 'flex' : 'none';
  });
  renderStockTable(stocks);
  // Charger le stock perso en arrière-plan
  DB.get('uex-perso-'+id).then(ps => renderPersoTable(ps || []));
}

/* Render stock table for selected player */
/* ════════════════════════════════════════════════════════════
   HELPER — Résumé par tier UEX (Vente / Craft Ship / Craft FPS)
════════════════════════════════════════════════════════════ */
function computeTierSummary(stocks) {
  // stocks = [{res, qty, price, sellprice, ...}]
  const summary = {
    total:      { qty: 0, valAchat: 0, valVente: 0 },
    vente:      { qty: 0, valAchat: 0, valVente: 0 },   // < 500 aUEC
    craft_ship: { qty: 0, valAchat: 0, valVente: 0 },   // 500–600
    craft_fps:  { qty: 0, valAchat: 0, valVente: 0 },   // > 600
    unknown:    { qty: 0, valAchat: 0, valVente: 0 },   // non référencé UEX
  };
  stocks.forEach(s => {
    const qty     = Number(s.qty)       || 0;
    const buy     = Number(s.price)     || 0;
    const sell    = Number(s.sellprice) || 0;
    const tier    = getUexTier(s.res);
    const bucket  = tier ? tier.key : 'unknown';

    summary.total.qty      += qty;
    summary.total.valAchat += buy  * qty;
    summary.total.valVente += sell * qty;

    if (bucket === 'vente')         { summary.vente.qty      += qty; summary.vente.valAchat      += buy*qty; summary.vente.valVente      += sell*qty; }
    else if (bucket === 'craft_vaisseau') { summary.craft_ship.qty += qty; summary.craft_ship.valAchat += buy*qty; summary.craft_ship.valVente += sell*qty; }
    else if (bucket === 'craft_fps')      { summary.craft_fps.qty  += qty; summary.craft_fps.valAchat  += buy*qty; summary.craft_fps.valVente  += sell*qty; }
    else                            { summary.unknown.qty    += qty; summary.unknown.valAchat    += buy*qty; summary.unknown.valVente    += sell*qty; }
  });
  return summary;
}

function renderTierBar(summary, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const fmt  = n => n > 0 ? Math.round(n).toLocaleString('fr-FR') : '0';
  const fmtK = n => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? Math.round(n/1000)+'k' : Math.round(n).toString();
  const total = summary.total;

  el.innerHTML = `
    <div style="display:flex;gap:0;border-top:2px solid var(--border);background:var(--bg2);flex-shrink:0;overflow-x:auto;">

      <!-- Total général -->
      <div style="padding:7px 14px;border-right:1px solid var(--border);min-width:110px;text-align:center;flex-shrink:0;">
        <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;margin-bottom:2px;">Total</div>
        <div style="font-family:var(--mono);font-size:14px;color:var(--text-bright);font-weight:700;">${fmt(total.qty)} <span style="font-size:9px;color:var(--text-dim);">SCU</span></div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:1px;">${fmtK(total.valVente)} aUEC</div>
      </div>

      <!-- Vente directe -->
      <div style="padding:7px 14px;border-right:1px solid var(--border);min-width:130px;flex-shrink:0;" title="< 500 aUEC/SCU — Vente directe recommandée">
        <div style="font-size:9px;letter-spacing:1.5px;color:#ef4444;text-transform:uppercase;margin-bottom:2px;">🔴 Vente directe</div>
        <div style="font-family:var(--mono);font-size:14px;color:#ef4444;font-weight:700;">${fmt(summary.vente.qty)} <span style="font-size:9px;color:var(--text-dim);">SCU</span></div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:1px;">${fmtK(summary.vente.valVente)} aUEC · &lt;500</div>
      </div>

      <!-- 500< (Craft Vaisseau + FPS) -->
      <div style="padding:7px 14px;border-right:1px solid var(--border);min-width:150px;flex-shrink:0;" title="≥500 aUEC/SCU — Craft Vaisseau &amp; FPS">
        <div style="font-size:9px;letter-spacing:1.5px;color:var(--green);text-transform:uppercase;margin-bottom:2px;">🟢 500&lt;</div>
        <div style="font-family:var(--mono);font-size:14px;color:var(--green);font-weight:700;">${fmt((summary.craft_ship.qty||0)+(summary.craft_fps.qty||0))} <span style="font-size:9px;color:var(--text-dim);">SCU</span></div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:1px;">${fmtK((summary.craft_ship.valVente||0)+(summary.craft_fps.valVente||0))} aUEC · ≥500</div>
      </div>

      ${summary.unknown.qty > 0 ? `
      <!-- Non classé -->
      <div style="padding:7px 14px;min-width:120px;flex-shrink:0;" title="Ressources non référencées dans UEX">
        <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;margin-bottom:2px;">○ Non classé</div>
        <div style="font-family:var(--mono);font-size:14px;color:var(--text-dim);font-weight:700;">${fmt(summary.unknown.qty)} <span style="font-size:9px;">SCU</span></div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:1px;">${fmtK(summary.unknown.valVente)} aUEC</div>
      </div>` : ''}

    </div>`;
}

// ══ HELPERS QUALITÉ ══════════════════════════════════════════════════════════
// Retourne la 'bucket' de qualité pour un item de stock
function qualityBucket(s) {
  const q = s.quality || '';
  if (!q || q === '') return 'aucune';  // pas de qualité = colonne dédiée
  const scores = { mediocre:250, basique:550, acceptable:650, honnete:750, moyenne:850, haute:950 };
  const score = scores[q] || 0;
  if (score < 500)  return 'vente';    // < 500 : vente uniquement
  if (score < 800)  return 'vaisseau'; // 500–800 : craft vaisseau
  return 'fps';                        // 800–1000 : craft FPS
}

// Colore une quantité selon la bucket
function qtyCell(qty, bucket) {
  if (!qty) return '<td class="td-dim" style="text-align:center;">—</td>';
  const colors = { aucune:'var(--text-bright)', vente:'var(--orange)', vaisseau:'#60a5fa', fps:'var(--green)', craft500:'var(--green)' };
  const col = colors[bucket] || 'var(--text)';
  return '<td style="text-align:center;color:'+col+';font-weight:600;">'+Number(qty).toLocaleString('fr-FR')+'</td>';
}


function renderStockTable(stocks){
  const body  = document.getElementById('pl-stock-body');
  const noMsg = document.getElementById('pl-no-stock');

  // Filtrer les entrées invalides (sans res/name ou qty <= 0)
  stocks = stocks.map(s => ({ ...s, res: s.res || s.name || s.resource || '' }));
  stocks = stocks.filter(s => s.res && (parseFloat(s.qty)||0) > 0);
  if (!stocks.length) { body.innerHTML=''; noMsg.style.display='block'; return; }
  noMsg.style.display = 'none';

  // Stocker pour le panneau détail (TELOS)
  _sdpTelosStocks = stocks;
  _sdpAllStocks = stocks;
  const groups = {};
  stocks.forEach(s => {
    const key = (s.res||'').toLowerCase().trim() + '|' + (s.cat||'');
    if (!groups[key]) {
      groups[key] = {
        res: s.res, cat: s.cat,
        qa: 0, qv: 0, qc: 0, qf: 0,
        buyVal: 0, sellVal: 0, qty: 0,
        price: s.price||0, sellprice: s.sellprice||0,
        loc: s.loc||'', note: s.note||'',
        unit: s.unit||'scu',
        qualityExact: s.qualityExact||null,
        ids: [],
        addedAt: s.addedAt,
      };
    }
    const g = groups[key];
    const b = qualityBucket(s);
    if (b==='aucune')   g.qa += s.qty;
    else if (b==='vente')    g.qv += s.qty;
    else if (b==='vaisseau') g.qc += s.qty;
    else                     g.qf += s.qty;
    g.qty      += s.qty;
    g.buyVal   += (s.price||0) * s.qty;
    g.sellVal  += (s.sellprice||0) * s.qty;
    g.price     = g.qty > 0 ? g.buyVal  / g.qty : 0;
    g.sellprice = g.qty > 0 ? g.sellVal / g.qty : 0;
    if (s.loc && !g.loc.includes(s.loc)) g.loc = g.loc ? g.loc+', '+s.loc : s.loc;
    g.ids.push(s.id);
    if (!g.addedAt || s.addedAt > g.addedAt) g.addedAt = s.addedAt;
  });

  // Index global pour le panneau détail : clé → IDs bruts
  window._sdpGroups = {};

  const rows = Object.values(groups).sort((a,b) => a.res.localeCompare(b.res,'fr'));

  body.innerHTML = rows.map(g => {
    const margin  = g.price>0 && g.sellprice>0 ? ((g.sellprice-g.price)/g.price*100).toFixed(1) : null;
    const profit  = g.sellprice>0 ? g.sellVal - g.buyVal : null;
    const marginCls = margin!==null ? (parseFloat(margin)>=0?'td-green':'td-red') : '';
    const firstId = g.ids[0];
    const gkey = (g.res+'|'+g.cat).replace(/[^a-z0-9|]/gi,'_');
    window._sdpGroups[gkey] = { ids: g.ids, isPerso: false };
    return `<tr style="cursor:pointer;" onclick="openStockDetail('${gkey}')"
      onmouseover="this.style.background='rgba(247,140,30,0.05)'" onmouseout="this.style.background=''">
      <td class="td-name" style="max-width:140px;">
        <div>◈ ${esc(g.res)}</div>
        ${g.ids.length>1 ? `<div style="font-size:9px;color:var(--text-dim);">${g.ids.length} entrées</div>` : ''}
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
          ${g.unit && g.unit!=='scu' ? `<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(96,165,250,0.4);color:#60a5fa;letter-spacing:1px;">UNITÉ</span>` : `<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(247,140,30,0.3);color:var(--text-dim);letter-spacing:1px;">SCU</span>`}
          ${g.qualityExact ? `<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(0,255,163,0.3);color:var(--green);font-family:var(--mono);letter-spacing:1px;">${g.qualityExact}</span>` : ''}
        </div>
        ${g.note ? `<div style="font-size:9px;color:var(--text-dim);font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;" title="${esc(g.note)}">${esc(g.note)}</div>` : ''}
      </td>
      <td><span class="cat-badge ${catCls(g.cat)}">${catLbl(g.cat)}</span></td>
      ${qtyCell(g.qa,'aucune')}
      ${qtyCell(g.qv,'vente')}
      ${qtyCell((g.qc||0)+(g.qf||0),'craft500')}
      <td class="td-dim">${g.price ? g.price.toFixed(2)+' aUEC' : '—'}</td>
      <td style="color:var(--blue);">${g.sellprice ? g.sellprice.toFixed(2)+' aUEC' : '—'}</td>
      <td class="${marginCls}">${margin !== null ? (parseFloat(margin)>=0?'+':'')+margin+'%' : '—'}</td>
      <td class="td-dim">${g.buyVal ? Math.round(g.buyVal).toLocaleString('fr-FR')+' aUEC' : '—'}</td>
      <td class="td-green">${g.sellVal ? Math.round(g.sellVal).toLocaleString('fr-FR')+' aUEC' : '—'}</td>
      <td class="${profit!==null?(profit>=0?'td-green':'td-red'):''}">${profit!==null?(profit>=0?'+':'')+Math.round(profit).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="td-dim" style="font-size:10px;">
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="font-size:11px;">📍</span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px;" title="${esc(g.loc)}">${esc(g.loc||'—')}</span>
        </div>
      </td>
      <td class="td-dim" style="font-size:10px;">${fmtDate(g.addedAt)}</td>
      <td style="display:flex;gap:4px;" onclick="event.stopPropagation()">
        <button class="btn sm" onclick="openEditStock('${firstId}')" style="border-color:var(--orange);color:var(--orange);" title="Modifier la première entrée">✏</button>
        <button class="btn danger sm" onclick="confirmDelStock('${firstId}','${esc(g.res)}')" title="${g.ids.length>1?'Supprimer la première entrée':'Supprimer'}">✕</button>
      </td>
    </tr>`;
  }).join('');

  // Footer totaux
  const tu = stocks.reduce((a,s)=>a+Number(s.qty),0);
  const tv = stocks.reduce((a,s)=>a+(s.price||0)*s.qty,0);
  document.getElementById('sf-distinct').textContent = rows.length;
  document.getElementById('sf-units').textContent    = tu.toLocaleString('fr-FR');
  document.getElementById('sf-total').textContent    = Math.round(tv).toLocaleString('fr-FR')+' aUEC';
}

function renderPersoTable(stocks) {
  const body  = document.getElementById('pl-perso-body');
  const noMsg = document.getElementById('pl-perso-no-stock');
  if (!body) return;

  if (!stocks.length) { body.innerHTML=''; noMsg.style.display='block'; return; }
  noMsg.style.display = 'none';

  // Stocker pour le panneau détail (perso)
  _sdpPersoStocks = stocks;
  _sdpAllStocks = stocks;
  window._sdpGroups = window._sdpGroups || {};

  const groups = {};
  stocks.forEach(s => {
    const key = (s.res||'').toLowerCase().trim() + '|' + (s.cat||'');
    if (!groups[key]) {
      groups[key] = { res:s.res, cat:s.cat, qa:0, qv:0, qc:0, qf:0, buyVal:0, sellVal:0, qty:0,
        price:s.price||0, sellprice:s.sellprice||0, loc:s.loc||'', note:s.note||'',
        unit:s.unit||'scu', qualityExact:s.qualityExact||null, ids:[], addedAt:s.addedAt };
    }
    const g = groups[key];
    const b = qualityBucket(s);
    if (b==='aucune') g.qa+=s.qty; else if (b==='vente') g.qv+=s.qty; else if (b==='vaisseau') g.qc+=s.qty; else g.qf+=s.qty;
    g.qty+=s.qty; g.buyVal+=(s.price||0)*s.qty; g.sellVal+=(s.sellprice||0)*s.qty;
    g.price=g.qty>0?g.buyVal/g.qty:0; g.sellprice=g.qty>0?g.sellVal/g.qty:0;
    if (s.loc && !g.loc.includes(s.loc)) g.loc=g.loc?g.loc+', '+s.loc:s.loc;
    g.ids.push(s.id);
    if (!g.addedAt||s.addedAt>g.addedAt) g.addedAt=s.addedAt;
  });

  const rows = Object.values(groups).sort((a,b)=>a.res.localeCompare(b.res,'fr'));

  body.innerHTML = rows.map(g => {
    const margin   = g.price>0&&g.sellprice>0?((g.sellprice-g.price)/g.price*100).toFixed(1):null;
    const profit   = g.sellprice>0?g.sellVal-g.buyVal:null;
    const marginCls = margin!==null?(parseFloat(margin)>=0?'td-green':'td-red'):'';
    const firstId  = g.ids[0];
    const gkey     = 'perso_' + (g.res+'|'+g.cat).replace(/[^a-z0-9|]/gi,'_');
    window._sdpGroups[gkey] = { ids: g.ids, isPerso: true };
    return `<tr style="cursor:pointer;" onclick="openStockDetail('${gkey}')"
      onmouseover="this.style.background='rgba(247,140,30,0.05)'" onmouseout="this.style.background=''">
      <td class="td-name" style="max-width:140px;">
        <div>🎒 ${esc(g.res)}</div>
        ${g.ids.length>1?`<div style="font-size:9px;color:var(--text-dim);">${g.ids.length} entrées</div>`:''}
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
          ${g.unit && g.unit!=='scu' ? `<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(96,165,250,0.4);color:#60a5fa;letter-spacing:1px;">UNITÉ</span>` : `<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(247,140,30,0.3);color:var(--text-dim);letter-spacing:1px;">SCU</span>`}
          ${g.qualityExact?`<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(0,255,163,0.3);color:var(--green);font-family:var(--mono);letter-spacing:1px;">${g.qualityExact}</span>`:''}
        </div>
        ${g.note?`<div style="font-size:9px;color:var(--text-dim);font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;" title="${esc(g.note)}">${esc(g.note)}</div>`:''}
      </td>
      <td><span class="cat-badge ${catCls(g.cat)}">${catLbl(g.cat)}</span></td>
      ${qtyCell(g.qa,'aucune')}${qtyCell(g.qv,'vente')}${qtyCell((g.qc||0)+(g.qf||0),'craft500')}
      <td class="td-dim">${g.price?g.price.toFixed(2)+' aUEC':'—'}</td>
      <td style="color:var(--blue);">${g.sellprice?g.sellprice.toFixed(2)+' aUEC':'—'}</td>
      <td class="${marginCls}">${margin!==null?(parseFloat(margin)>=0?'+':'')+margin+'%':'—'}</td>
      <td class="td-dim">${g.buyVal?Math.round(g.buyVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="td-green">${g.sellVal?Math.round(g.sellVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="${profit!==null?(profit>=0?'td-green':'td-red'):''}">${profit!==null?(profit>=0?'+':'')+Math.round(profit).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="td-dim" style="font-size:10px;"><div style="display:flex;align-items:center;gap:5px;"><span>📍</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px;" title="${esc(g.loc)}">${esc(g.loc||'—')}</span></div></td>
      <td class="td-dim" style="font-size:10px;">${fmtDate(g.addedAt)}</td>
      <td style="display:flex;gap:4px;" onclick="event.stopPropagation()">
        <button class="btn sm" onclick="openEditPerso('${firstId}')" style="border-color:var(--orange);color:var(--orange);" title="Modifier">✏</button>
        <button class="btn danger sm" onclick="confirmDelPerso('${firstId}','${esc(g.res)}')" title="Supprimer">✕</button>
      </td>
    </tr>`;
  }).join('');

  const tu = stocks.reduce((a,s)=>a+Number(s.qty),0);
  const tv = stocks.reduce((a,s)=>a+(s.price||0)*s.qty,0);
  document.getElementById('sf-perso-distinct').textContent = rows.length;
  document.getElementById('sf-perso-units').textContent    = tu.toLocaleString('fr-FR');
  document.getElementById('sf-perso-total').textContent    = Math.round(tv).toLocaleString('fr-FR')+' aUEC';
}

/* Open player stock modal */
/* ════════════════════════════════════════════════════════════
   DATALIST — Auto-alimenté par les ressources existantes
════════════════════════════════════════════════════════════ */
async function refreshDatalist() {
  const dl = document.getElementById('ps-datalist');
  if (!dl) return;

  // Collecter toutes les ressources uniques de tous les joueurs
  const seen = new Set();
  for (const p of players) {
    const stocks = (await DB.get('uex-stocks-' + p.id)) || [];
    stocks.forEach(s => { if (s.res) seen.add(s.res.trim()); });
  }

  // Trier alphabétiquement
  const sorted = [...seen].sort((a, b) => a.localeCompare(b, 'fr'));
  dl.innerHTML = sorted.map(r => `<option value="${esc(r)}">`).join('');
}

/* ════════════════════════════════════════════════════════════
   ÉDITION DES PRIX — Modal inline
════════════════════════════════════════════════════════════ */
var _editStockId = null;

async function openEditStock(sid) {
  if (!requireAuth(selectedPid, () => openEditStock(sid))) return;
  const stocks = (await DB.get('uex-stocks-' + selectedPid)) || [];
  const s = stocks.find(x => x.id === sid);
  if (!s) return;
  _editStockId = sid;

  document.getElementById('edit-res-label').textContent  = s.res;
  document.getElementById('edit-qty-label').textContent  = Number(s.qty).toLocaleString('fr-FR') + ' SCU';
  document.getElementById('edit-price').value     = s.price     || '';
  document.getElementById('edit-sellprice').value = s.sellprice || '';
  document.getElementById('edit-qty').value       = s.qty       || '';
  document.getElementById('edit-loc').value       = s.loc       || '';
  updateEditPreview();
  document.getElementById('edit-overlay').classList.add('open');
  setTimeout(() => document.getElementById('edit-price').focus(), 80);
}

function updateEditPreview() {
  const buy  = parseFloat(document.getElementById('edit-price').value)     || 0;
  const sell = parseFloat(document.getElementById('edit-sellprice').value)  || 0;
  const qty  = parseFloat(document.getElementById('edit-qty').value)        || 0;
  const prev = document.getElementById('edit-preview');
  if (buy > 0 && sell > 0 && qty > 0) {
    const margin = ((sell - buy) / buy * 100).toFixed(1);
    const profit = Math.round((sell - buy) * qty);
    const col    = sell >= buy ? 'var(--green)' : 'var(--red)';
    const sign   = sell >= buy ? '+' : '';
    prev.innerHTML = `Marge : <span style="color:${col};font-weight:700;">${sign}${margin}%</span> &nbsp;|&nbsp; Profit total : <span style="color:${col};font-weight:700;">${sign}${profit.toLocaleString('fr-FR')} aUEC</span>`;
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
}

function closeEditStock() {
  document.getElementById('edit-overlay').classList.remove('open');
  _editStockId = null;
}

async function saveEditStock() {
  const newPrice     = parseFloat(document.getElementById('edit-price').value)     || 0;
  const newSellprice = parseFloat(document.getElementById('edit-sellprice').value)  || 0;
  const newQty       = parseFloat(document.getElementById('edit-qty').value)        || 0;
  const newLoc       = document.getElementById('edit-loc').value.trim();

  if (!_editStockId || !selectedPid) return;
  if (newQty <= 0) { toast('Quantité invalide', 'La quantité doit être > 0.', 'error'); return; }

  const isPerso = _stockModalType === 'perso';
  const dbKey = isPerso ? 'uex-perso-'+selectedPid : 'uex-stocks-'+selectedPid;
  let stocks = (await DB.get(dbKey)) || [];
  const s = stocks.find(x => x.id === _editStockId);
  if (!s) return;

  const oldPrice = s.price;
  s.price     = newPrice;
  s.sellprice = newSellprice;
  s.qty       = newQty;
  s.loc       = newLoc;

  await DB.set(dbKey, stocks);
  closeEditStock();
  if (isPerso) {
    renderPersoTable(stocks);
  } else {
    renderStockTable(stocks);
    renderStocksFromPlayers();
    renderPartners();
    renderAuthBar();
    updateKPIs();
    syncObjectifsWithStock().then(() => refreshAllObjStockInfo());
    const p = players.find(x => x.id === selectedPid);
    pushActivity('✏', `Prix mis à jour : ${s.res} — ${newPrice.toFixed(2)} / ${newSellprice.toFixed(2)} aUEC (${p?.name||''})`, '', true);
  }
  toast('Prix mis à jour', `${s.res} — achat ${newPrice.toFixed(2)} / vente ${newSellprice.toFixed(2)} aUEC`, 'success');
}

/* ════════════════════════════════════════════════════════════
   AVATAR PICKER
════════════════════════════════════════════════════════════ */
var SC_AVATARS = [
  { label:'Pilote',      icon:'🧑‍✈️' },
  { label:'Mineur',      icon:'⛏' },
  { label:'Chasseur',    icon:'🎯' },
  { label:'Explorateur', icon:'🔭' },
  { label:'Médecin',     icon:'⚕' },
  { label:'Ingénieur',   icon:'🔧' },
  { label:'Marchand',    icon:'💼' },
  { label:'Corsaire',    icon:'☠' },
  { label:'Garde',       icon:'🛡' },
  { label:'Hacker',      icon:'💻' },
  { label:'Xénobio',     icon:'🧬' },
  { label:'Amiral',      icon:'⭐' },
];

function openAvatarPicker() {
  if (!SESSION) return;
  const player = players.find(p => p.id === SESSION.pid);
  const current = player?.avatar || '';

  // Construire le contenu du picker
  const grid = SC_AVATARS.map((a,i) => `
    <div onclick="selectAvatarEmoji('${a.icon}')" style="
      width:56px;height:56px;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:3px;cursor:pointer;border:2px solid ${current===a.icon?'var(--orange)':'var(--border)'};
      background:${current===a.icon?'var(--orange-faint)':'var(--bg3)'};
      border-radius:4px;transition:all 0.15s;font-size:22px;
    " onmouseover="this.style.borderColor='var(--orange)'" onmouseout="this.style.borderColor='${current===a.icon?'var(--orange)':'var(--border)'}'">
      ${a.icon}
      <span style="font-size:7px;color:var(--text-dim);letter-spacing:0.5px;">${a.label}</span>
    </div>`).join('');

  document.getElementById('avatar-grid').innerHTML = grid;

  // Afficher aperçu actuel
  const prev = document.getElementById('avatar-current-preview');
  prev.style.overflow='hidden'; prev.innerHTML = avHtml(player || SESSION.name, 52);

  document.getElementById('avatar-overlay').classList.add('open');
}

function closeAvatarPicker() {
  document.getElementById('avatar-overlay').classList.remove('open');
}

async function selectAvatarEmoji(emoji) {
  await saveAvatar(emoji);
  closeAvatarPicker();
}

async function triggerAvatarUpload() {
  document.getElementById('avatar-file-input').click();
}

async function handleAvatarFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 500 * 1024) { toast('Image trop lourde', 'Max 500 Ko.', 'error'); return; }
  if (!file.type.startsWith('image/')) { toast('Format invalide', 'Choisissez une image.', 'error'); return; }

  const reader = new FileReader();
  reader.onload = async (e) => {
    // Redimensionner en canvas 100x100
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100; canvas.height = 100;
      const ctx = canvas.getContext('2d');
      // Crop carré centré
      const size = Math.min(img.width, img.height);
      const ox = (img.width  - size) / 2;
      const oy = (img.height - size) / 2;
      ctx.drawImage(img, ox, oy, size, size, 0, 0, 100, 100);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      await saveAvatar(dataUrl);
      closeAvatarPicker();
      toast('Avatar mis à jour', '', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveAvatar(avatarData) {
  if (!SESSION) return;
  const idx = players.findIndex(p => p.id === SESSION.pid);
  if (idx < 0) return;
  players[idx].avatar = avatarData;
  await DB.set('uex-players', players);
  renderAuthBar();
  renderPlayerList();
  renderPartners();
  toast('Avatar mis à jour', '', 'success');
}

/* ════════════════════════════════════════════════════════════
   ÉDITION DU RÔLE
════════════════════════════════════════════════════════════ */
// Rôles dynamiques — chargés depuis DB, avec fallback
var ROLES = ['Trader','Mineur','Transporteur','Explorateur','Lead','Gestionnaire'];

// Droits par défaut — structure : { roleKey: { tab: bool, ... } }
// Chargé depuis DB via loadRolesConfig()
var ROLES_CONFIG = null;

// Définition des onglets/fonctions contrôlables
var DROITS_DEFS = [
  { id:'hub',           label:'🏠 Tableau de bord',      desc:'Accès au hub principal' },
  { id:'map',           label:'🗺 Carte Stanton',         desc:'Carte interactive' },
  { id:'partners',      label:'👥 Partenaires',            desc:'Voir la liste des partenaires' },
  { id:'stocks',        label:'📦 Stocks TELOS',           desc:'Voir le stock global consolidé' },
  { id:'ressource_par', label:'◈ Ressource par partenaire',desc:'Voir les stocks par partenaire' },
  { id:'blueprints',    label:'📐 Blueprints',             desc:'Voir les blueprints' },
  { id:'commandes',     label:'📋 Commandes',              desc:'Voir les commandes' },
  { id:'objectifs',     label:'🎯 Objectifs',              desc:'Voir les objectifs' },
  { id:'missions',      label:'🛡 Missions',               desc:'Voir les missions' },
  { id:'commerce',      label:'💹 Commerce',               desc:'Voir le panneau commerce' },
  { id:'banque',        label:'🏦 Banque',                 desc:'Accès à la banque TELOS' },
  { id:'logs',          label:'📡 Logs',                   desc:'Accès aux journaux système' },
  { id:'ressources',    label:'🔬 Data Ressource',         desc:'Catalogue ressources (admin/gest.)' },
  { id:'armurie',       label:'⚔ Data Armurie',           desc:'Catalogue armement (admin/gest.)' },
  { id:'edit_stock',    label:'✏ Modifier stock',          desc:'Ajouter/modifier son propre stock' },
  { id:'add_commande',  label:'+ Créer commande',          desc:'Créer une commande' },
  { id:'use_priority',  label:'🔴 Priorité commande',      desc:'Choisir la priorité d\'une commande' },
  { id:'use_branche',   label:'🔗 Commande de Branche',      desc:'Marquer une commande comme branchée' },
  { id:'add_objectif',  label:'+ Créer objectif',          desc:'Créer un objectif' },
  { id:'add_mission',   label:'+ Créer mission',           desc:'Créer une mission (Gest.)' },
  { id:'add_blueprint', label:'+ Ajouter blueprint',       desc:'Ajouter un blueprint' },
  { id:'add_transaction',label:'+ Créer transaction',      desc:'Ajouter une transaction banque' },
  { id:'delete_data',   label:'🗑 Supprimer données',      desc:'Supprimer commandes/objectifs/BP' },
  { id:'manage_roles',  label:'⬡ Gérer les rôles',        desc:'Attribuer les rôles aux joueurs' },
  { id:'backup',        label:'💾 Sauvegardes',            desc:'Accès à la gestion des sauvegardes' },
];


var DEFAULT_DROITS = {
  Trader:        { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Mineur:        { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Transporteur:  { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Explorateur:   { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Lead:          { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:1,logs:1,ressources:1,armurie:1,edit_stock:1,add_commande:1,use_priority:1,use_branche:1,add_objectif:1,add_mission:1,add_blueprint:1,add_transaction:1,delete_data:0,manage_roles:0 },
  Gestionnaire:  { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:1,logs:1,ressources:1,armurie:1,edit_stock:1,add_commande:1,use_priority:1,use_branche:1,add_objectif:1,add_mission:1,add_blueprint:1,add_transaction:1,delete_data:1,manage_roles:1 },
};

// Couleurs personnalisées des rôles { roleName: '#rrggbb' }
var ROLES_COLORS_CUSTOM = {};

async function loadRolesConfig() {
  try {
    const saved = await DB.get('telos-roles-config');
    if (saved) {
      ROLES = saved.roles || ROLES;
      ROLES_CONFIG = saved.droits || null;
      ROLES_COLORS_CUSTOM = saved.colors || {};
      ROLES_INSCRIPTION_CONFIG = saved.inscription || {};
    }
    if (!ROLES_CONFIG) ROLES_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DROITS));
    // Initialiser la config inscription pour les rôles qui n'ont pas encore de valeur
    ROLES.forEach(r => {
      if (!(r in ROLES_INSCRIPTION_CONFIG)) {
        ROLES_INSCRIPTION_CONFIG[r] = !ROLES_EXCLUS_INSCRIPTION.includes(r);
      }
    });
  } catch(e) { ROLES_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DROITS)); }
}

async function saveRolesConfig() {
  await DB.set('telos-roles-config', { roles: ROLES, droits: ROLES_CONFIG, colors: ROLES_COLORS_CUSTOM, inscription: ROLES_INSCRIPTION_CONFIG });
}

function hasDroit(droit) {
  if (!SESSION) return false;
  if (SESSION.isAdmin) return true;
  const player = players.find(p => p.id === SESSION.pid);
  if (!player) return false;
  const cfg = ROLES_CONFIG?.[player.role];
  if (!cfg) return true; // pas de config → accès par défaut
  return !!cfg[droit];
}

function openEditRole(pid) {
  if (!SESSION) { openLoginModal(null, () => openEditRole(pid)); return; }
  if (!canManageRoles()) {
    toast('Accès refusé', 'Seuls les Admins et Gestionnaires peuvent modifier les rôles.', 'error');
    return;
  }
  const player = players.find(p => p.id === pid);
  if (!player) return;
  document.getElementById('role-player-name').textContent = player.name;
  const sel = document.getElementById('role-select');
  sel.innerHTML = ROLES.map(r =>
    `<option value="${r}" ${player.role === r ? 'selected' : ''}>${r}</option>`
  ).join('');
  document.getElementById('role-pid').value = pid;
  document.getElementById('role-overlay').classList.add('open');
}

function closeEditRole() {
  document.getElementById('role-overlay').classList.remove('open');
}

async function saveEditRole() {
  const pid     = document.getElementById('role-pid').value;
  const newRole = document.getElementById('role-select').value;
  const i       = players.findIndex(p => p.id === pid);
  if (i < 0) return;
  const oldRole = players[i].role;
  players[i].role = newRole;
  await DB.set('uex-players', players);
  closeEditRole();
  renderAuthBar();
  renderPlayerList();
  renderPartners();
  renderStocksFromPlayers();
  pushActivity('⬡', `${players[i].name} : rôle changé (${oldRole} → ${newRole})`, '', true);
  toast('Rôle mis à jour', `${players[i].name} est maintenant ${newRole}.`, 'success');
}

/* ════════════════════════════════════════════════════════════
   RESSOURCE SELECT — Synchronisation catalogue ↔ champ texte
════════════════════════════════════════════════════════════ */
function populateResSelect() {
  const sel = document.getElementById('ps-res-select');
  if (!sel) return;

  // Grouper par catégorie
  const CAT_ORDER = ['mineral','salvage','ressources','equipements','armement','accessoires','autre'];
  const groups = {};
  RESSOURCE_CATALOGUE.forEach(r => {
    const cat = r.cat || 'autre';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(r);
  });

  let html = '<option value="">— Catalogue Corp TELOS —</option>';
  CAT_ORDER.forEach(cat => {
    if (!groups[cat] || !groups[cat].length) return;
    html += '<optgroup label="' + (CAT_LABELS[cat] || cat) + '">';
    groups[cat].sort((a,b)=>a.name.localeCompare(b.name,'fr')).forEach(r => {
      const qInfo = r.quality && QUALITY_META[r.quality] ? ' · ' + QUALITY_META[r.quality].label : '';
      html += '<option value="' + esc(r.name) + '" data-cat="' + r.cat + '" data-quality="' + (r.quality||'') + '">'
        + esc(r.name) + qInfo + '</option>';
    });
    html += '</optgroup>';
  });

  // Si aucune ressource dans le catalogue
  if (!RESSOURCE_CATALOGUE.length) {
    html += '<option value="" disabled>Aucune ressource — Ajoutez-en dans l&#39;onglet Ressources</option>';
  }

  sel.innerHTML = html;
}

// Filtre le dropdown par catégorie
function populateResSelectFiltered(cat) {
  const sel = document.getElementById('ps-res-select');
  if (!sel) return;

  // Correspondance entre les cats du modal et celles du catalogue
  const CAT_MAP = {
    mineral:'mineral', salvage:'salvage', resources:'ressources',
    equipment:'equipements', weapons:'armement', accessories:'accessoires', other:'autre'
  };
  const catKey = CAT_MAP[cat] || cat;

  let filtered = RESSOURCE_CATALOGUE.filter(r => (r.cat || 'autre') === catKey);
  // Si pas de résultats pour cette catégorie, afficher tous
  if (!filtered.length) filtered = RESSOURCE_CATALOGUE;

  let html = '<option value="">— Catalogue Corp TELOS —</option>';
  filtered.sort((a,b)=>a.name.localeCompare(b.name,'fr')).forEach(r => {
    const qInfo = r.quality && QUALITY_META[r.quality] ? ' · ' + QUALITY_META[r.quality].label : '';
    html += '<option value="' + esc(r.name) + '" data-cat="' + (r.cat||'') + '" data-quality="' + (r.quality||'') + '">'
      + esc(r.name) + qInfo + '</option>';
  });
  if (!RESSOURCE_CATALOGUE.length) {
    html += '<option value="" disabled>Aucune ressource — Ajoutez-en dans l&#39;onglet Ressources</option>';
  }
  sel.innerHTML = html;
}

function autofillPrices(resName) {
  if (!resName) return;
  // Chercher dans le catalogue TELOS
  const entry = RESSOURCE_CATALOGUE.find(r => r.name.toLowerCase() === resName.toLowerCase());
  if (!entry) return;

  const buyField  = document.getElementById('ps-price');
  const sellField = document.getElementById('ps-sellprice');

  if (buyField  && entry.buyRef  > 0 && (!buyField.value  || buyField.value  === '0' || buyField.value  === '0.00'))
    buyField.value  = entry.buyRef.toFixed(2);

  if (sellField && entry.sellRef > 0 && (!sellField.value || sellField.value === '0' || sellField.value === '0.00'))
    sellField.value = entry.sellRef.toFixed(2);

  // Mettre à jour le preview total si la fonction existe
  if (typeof updatePreview === 'function') updatePreview();
}

function onResSelectChange(sel) {
  const val = sel.value;
  const resInput = document.getElementById('ps-res');
  if (!resInput) return;

  if (val) {
    resInput.value = val;
    // Auto-sélectionner la catégorie correspondante
    const opt = sel.options[sel.selectedIndex];
    const cat = opt?.dataset?.cat;
    const quality = opt?.dataset?.quality;
    if (cat) {
      const catBtn = document.querySelector('[data-cat="'+cat+'"]');
      if (catBtn) selectCat(catBtn);
    }
    if (quality) {
      const qSel = document.getElementById('ps-quality');
      if (qSel) { qSel.value = quality; updateQualityBadge(qSel); }
    }
    checkUexName(val);
    autofillPrices(val);
  } else {
    resInput.value = '';
    document.getElementById('ps-uex-hint').style.display = 'none';
  }
}

function onResInputChange(val) {
  // Désélectionner le select si l'utilisateur tape manuellement
  const sel = document.getElementById('ps-res-select');
  if (sel && sel.value !== val) sel.value = '';
  checkUexName(val);
  // Auto-renseigner les prix si la ressource correspond au catalogue
  autofillPrices(val);
}

function ncSetRewardType(type) {
  ['auec','empreinte','honneur'].forEach(function(t) {
    const btn = document.getElementById('nc-rt-' + t);
    const sec = document.getElementById('nc-reward-' + t);
    if (btn) btn.className = t === type ? 'btn primary' : 'btn';
    if (sec) sec.style.display = t === type ? 'flex' : 'none';
  });
}

var UEX_COMMODITIES = ['Acryliplex Composite','Agricium','Agricultural Supplies','Altruciatoxin','Aluminum','Amioshi Plague','Ammonia','Aphorite','Argon','Aslarite','Astatine','Atlasium','Audio Visual Equipment','Beradom','Beryl','Bexalite','Bioplastic','Borase','CK13 Gid Seed Blend','Carbon','Carbon Silk','Carinite','Cave Kopion Horn','Chlorine','Cobalt','Compboard','Construction Materials','Copper','Corundum','DCSR2','Decari Pod','Degnous Root','Diamond','Diamond Laminate','Distilled Spirits','Dolivine','Dymantium','Dynaflex','Etam','Feynmaline','Fluorine','Foam','Fresh Food','Gasping Weevil Eggs','Glacosite','Gold','Golden Medmon','Hadanite','Heart Of The Woods','Helium','Hephaestanite','Hexapolymesh Coating','Human Food Bars','Hydrogen','Hydrogen Fuel','Iodine','Iron','Irradiated Kopion Horn','Jaclium','Janalite','Kopion Horn','Krypton','Laranite','Lindinium','Luminalia Gift','Marok Gem','Maze','Medical Supplies','Mercury','Methane','Neograph','Neon','Nitrogen','Omnapoxy','Organics','Osoian Hides','Ouratite','Partillium','Party Favors','Pitambu','Potassium','Pressurized Ice','Processed Food','Prota','Quantanium','Quantum Fuel','Quartz','Ranta Dung','Recycled Material Composite','Revenant Pod','Revenant Tree Pollen','Riccite','Sadaryx','Savrilium','Scrap','Silicon','Slam','Souvenirs','Steel','Stileron','Stims','Sunset Berries','Taranite','Tin','Titanium','Torite','Tritium','Tungsten','Waste','Widow','Wuotan Seed','Xapyen','Year Of The Pig Envelope'];
function checkUexName(val) {
  const hint = document.getElementById('ps-uex-hint') || document.getElementById('ares-uex-hint');
  const hint2 = document.getElementById('ares-uex-hint');
  if (!hint) return;
  if (!val || val.length < 2) { hint.style.display = 'none'; return; }

  const exact = UEX_COMMODITIES.find(n => n.toLowerCase() === val.toLowerCase());
  const close = UEX_COMMODITIES.filter(n => n.toLowerCase().includes(val.toLowerCase()));

  if (exact) {
    hint.style.display = 'block';
    hint.style.borderColor = 'var(--green)';
    hint.style.color = 'var(--green)';
    hint.style.background = 'rgba(0,255,163,0.05)';
    hint.textContent = '✓ Nom reconnu sur UEXCorp.space';
  if(hint2&&hint2!==hint){hint2.style.cssText=hint.style.cssText;hint2.textContent=hint.textContent;hint2.style.display='block';}
  } else if (close.length > 0 && close.length <= 5) {
    hint.style.display = 'block';
    hint.style.borderColor = 'var(--orange)';
    hint.style.color = 'var(--orange)';
    hint.style.background = 'rgba(247,140,30,0.05)';
    hint.textContent = '⚠ Ressource non exacte — Suggestions : ' + close.slice(0,3).join(', ');
  } else if (close.length === 0) {
    hint.style.display = 'block';
    hint.style.borderColor = 'var(--red)';
    hint.style.color = 'var(--red)';
    hint.style.background = 'rgba(255,68,68,0.05)';
    hint.textContent = '✕ Nom non reconnu sur UEXCorp.space — Vérifiez sur uexcorp.space/commodities';
  } else {
    hint.style.display = 'none';
  }
}

var QUALITY_META = {
  '':          { label:'',                          color:'var(--text-dim)',   score:'—'    },
  'mediocre':  { label:'Qualité Médiocre',          color:'#6b7280',          score:'< 500'  },
  'basique':    { label:'Qualité Basique',            color:'#ef4444',          score:'500–600'},
  'acceptable':{ label:'Qualité Acceptable',        color:'#f97316',          score:'600–700'},
  'honnete':   { label:'Qualité Honnête',           color:'#eab308',          score:'700–800'},
  'moyenne':   { label:'Qualité Moyenne',           color:'#22c55e',          score:'800–900'},
  'haute':     { label:'Haute Qualité',             color:'#60a5fa',          score:'900–1000'},
};

function updateQualityBadge(sel) {
  const badge = document.getElementById('ps-quality-badge');
  if (!badge) return;
  const q = QUALITY_META[sel.value];
  if (!sel.value || !q.label) { badge.style.display = 'none'; return; }
  badge.style.display = 'block';
  badge.style.borderColor = q.color;
  badge.style.color = q.color;
  badge.style.background = q.color + '14';
  badge.textContent = q.label + '  ·  SCU ' + q.score;
}

// Synchronise le select plage depuis la valeur exacte tapée
function syncQualityFromExact(val) {
  const n = parseInt(val);
  const sel = document.getElementById('ps-quality');
  if (!sel) return;
  if (!val || isNaN(n)) { sel.value = ''; }
  else if (n < 500)  sel.value = 'mediocre';
  else if (n < 600)  sel.value = 'basique';
  else if (n < 700)  sel.value = 'acceptable';
  else if (n < 800)  sel.value = 'honnete';
  else if (n < 900)  sel.value = 'moyenne';
  else               sel.value = 'haute';
  updateQualityBadge(sel);
}

// Type de stock actif dans les modals : 'telos' ou 'perso'
var _stockModalType = 'telos';

async function openPlayerStock(type){
  type = type || _currentPlTab || 'telos';
  _stockModalType = type;
  if (!selectedPid){ toast('Aucun joueur sélectionné','Cliquez d\'abord sur un joueur.','error'); return; }
  if (!requireAuth(selectedPid, ()=>openPlayerStock(type))) return;
  await refreshDatalist();
  populateResSelectFiltered('mineral');
  ['ps-res','ps-qty','ps-price','ps-sellprice','ps-note'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const qSel=document.getElementById('ps-quality'); if(qSel){qSel.value=''; updateQualityBadge(qSel);}
  const qExact=document.getElementById('ps-quality-exact'); if(qExact) qExact.value='';
  const unitSel=document.getElementById('ps-unit'); if(unitSel) unitSel.value='scu';
  const resSel=document.getElementById('ps-res-select'); if(resSel) resSel.value='';
  document.getElementById('ps-cat').value = 'mineral';
  const grid = document.getElementById('ps-cat-grid');
  if (grid) grid.querySelectorAll('.cat-sel-btn').forEach(b=>b.classList.toggle('active', b.dataset.cat==='mineral'));
  document.getElementById('margin-preview').style.display = 'none';
  document.getElementById('ps-total-preview').textContent = '';
  // Mettre à jour le titre du modal selon le type
  const modalTitle = document.getElementById('ps-modal-title');
  if (modalTitle) modalTitle.textContent = type === 'perso' ? '🎒 Ajouter — Stock Personnel' : '📦 Ajouter — Stock TELOS';
  document.getElementById('ps-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('ps-res').focus(),80);
}
function closePSModal(){ document.getElementById('ps-overlay').classList.remove('open'); }

/* ─── Modal retrait ressource — identique à l'ajout ─── */
var _rmStocks     = [];
var _rmSelectedId = null;
var _rmCatFilter  = 'all';

async function openRemoveStock(type){
  type = type || _currentPlTab || 'telos';
  _stockModalType = type;
  if (!selectedPid){ toast('Aucun partenaire sélectionné','','error'); return; }
  if (!requireAuth(selectedPid, ()=>openRemoveStock(type))) return;
  const p = players.find(x=>x.id===selectedPid);
  const dbKey = type === 'perso' ? 'uex-perso-'+selectedPid : 'uex-stocks-'+selectedPid;
  _rmStocks = (await DB.get(dbKey))||[];
  if (!_rmStocks.length){ toast('Aucune ressource', type==='perso'?'Aucun stock personnel à retirer.':'Ce partenaire n\'a aucun stock à retirer.', 'warn'); return; }

  const rmAv = document.getElementById('rm-avatar');
  if (rmAv) { rmAv.innerHTML = avHtml(p, 34); rmAv.style.overflow='hidden'; }
  document.getElementById('rm-player-name').textContent = p.name;

  _rmSelectedId = null;
  _rmCatFilter  = 'all';
  document.querySelectorAll('#rm-cat-grid .cat-sel-btn').forEach(b=>b.classList.toggle('active', b.dataset.cat==='all'));
  updateRMConfirmBtn();
  renderRMList();
  document.getElementById('rm-overlay').classList.add('open');
}

function filterRMCat(btn){
  _rmCatFilter  = btn.dataset.cat;
  _rmSelectedId = null;
  document.querySelectorAll('#rm-cat-grid .cat-sel-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  updateRMConfirmBtn();
  renderRMList();
}

function renderRMList(){
  const list  = document.getElementById('rm-stock-list');
  const empty = document.getElementById('rm-empty');
  const data  = _rmCatFilter==='all' ? _rmStocks : _rmStocks.filter(s=>s.cat===_rmCatFilter);

  if (!data.length){
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = data.map(s => {
    const sel     = s.id === _rmSelectedId;
    const buyVal  = (s.price||0) * s.qty;
    const sellVal = (s.sellprice||0) * s.qty;
    const profit  = sellVal - buyVal;
    const margin  = s.price>0 && s.sellprice>0 ? ((s.sellprice-s.price)/s.price*100) : null;
    const pCls    = profit>=0 ? 'var(--green)' : 'var(--red)';
    return `
    <div onclick="selectRMStock('${s.id}')" style="
      border:1px solid ${sel?'var(--red)':'var(--border)'};
      background:${sel?'rgba(255,68,68,0.07)':'var(--bg)'};
      padding:10px 13px;cursor:pointer;transition:all 0.12s;position:relative;
    ">
      ${sel?`<div style="position:absolute;top:0;left:0;bottom:0;width:3px;background:var(--red);"></div>`:''}
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px;">
        <span class="cat-badge ${catCls(s.cat)}" style="flex-shrink:0;">${catLbl(s.cat)}</span>
        <span style="font-size:13px;font-weight:700;color:${sel?'var(--red)':'var(--text-bright)'};">◈ ${esc(s.res)}</span>
        ${s.note?`<span style="font-size:9px;color:var(--text-dim);font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px;">${esc(s.note)}</span>`:''}
        ${sel?`<span style="margin-left:auto;font-size:9px;color:var(--red);letter-spacing:1px;font-weight:700;">✓ SÉLECTIONNÉE</span>`:''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;font-family:var(--mono);font-size:10px;">
        <div>
          <div style="color:var(--text-dim);font-size:8px;letter-spacing:1px;text-transform:uppercase;">Quantité</div>
          <div style="color:var(--orange);font-weight:700;">${Number(s.qty).toLocaleString('fr-FR')} SCU</div>
        </div>
        <div>
          <div style="color:var(--text-dim);font-size:8px;letter-spacing:1px;text-transform:uppercase;">Px achat</div>
          <div style="color:var(--text-dim);">${s.price?s.price.toFixed(2)+' aUEC':'—'}</div>
        </div>
        <div>
          <div style="color:var(--text-dim);font-size:8px;letter-spacing:1px;text-transform:uppercase;">Px vente</div>
          <div style="color:var(--blue);">${s.sellprice?s.sellprice.toFixed(2)+' aUEC':'—'}</div>
        </div>
        <div>
          <div style="color:var(--text-dim);font-size:8px;letter-spacing:1px;text-transform:uppercase;">Marge</div>
          <div style="color:${margin!==null?(margin>=0?'var(--green)':'var(--red)'):'var(--text-dim)'};">${margin!==null?(margin>=0?'+':'')+margin.toFixed(1)+'%':'—'}</div>
        </div>
        <div>
          <div style="color:var(--text-dim);font-size:8px;letter-spacing:1px;text-transform:uppercase;">Profit</div>
          <div style="color:${pCls};">${sellVal?Math.round(profit).toLocaleString('fr-FR')+' aUEC':'—'}</div>
        </div>
      </div>
      <div style="margin-top:18px;font-size:9px;color:var(--text-dim);display:flex;align-items:center;gap:4px;">
        <span>📍</span><span>${esc(s.loc||'—')}</span>
        <span style="margin-left:8px;opacity:0.5;">· Ajouté le ${fmtDate(s.addedAt)}</span>
      </div>
    </div>`;
  }).join('');
}

function selectRMStock(sid){
  _rmSelectedId = _rmSelectedId===sid ? null : sid;
  // Afficher/masquer le bloc quantité
  const qblock = document.getElementById('rm-qty-block');
  if (_rmSelectedId) {
    const s = _rmStocks.find(x=>x.id===_rmSelectedId);
    if (s) {
      qblock.style.display = 'block';
      document.getElementById('rm-qty').value = s.qty;
      document.getElementById('rm-qty').max   = s.qty;
      document.getElementById('rm-qty-max').textContent = `/ ${Number(s.qty).toLocaleString('fr-FR')} SCU total`;
      clampRMQty();
    }
  } else {
    qblock.style.display = 'none';
  }
  updateRMConfirmBtn();
  renderRMList();
}

function adjustRMQty(delta){
  const input = document.getElementById('rm-qty');
  const s     = _rmStocks.find(x=>x.id===_rmSelectedId);
  if (!input||!s) return;
  const cur = parseInt(input.value)||0;
  input.value = Math.max(1, Math.min(s.qty, cur+delta));
  clampRMQty();
  updateRMConfirmBtn();
}

function setRMQtyAll(){
  const s = _rmStocks.find(x=>x.id===_rmSelectedId);
  if (!s) return;
  document.getElementById('rm-qty').value = s.qty;
  clampRMQty();
  updateRMConfirmBtn();
}

function clampRMQty(){
  const input = document.getElementById('rm-qty');
  const s     = _rmStocks.find(x=>x.id===_rmSelectedId);
  const prev  = document.getElementById('rm-qty-preview');
  if (!input||!s) return;
  let v = parseInt(input.value)||1;
  v = Math.max(1, Math.min(s.qty, v));
  input.value = v;
  // Aperçu
  const remain = s.qty - v;
  const valRetire = (s.price||0)*v;
  const txt = remain===0
    ? `Retrait total — stock = 0 SCU après opération`
    : `Retrait de ${v.toLocaleString('fr-FR')} SCU · Restant : ${remain.toLocaleString('fr-FR')} SCU${valRetire?` · Val. retirée : ${Math.round(valRetire).toLocaleString('fr-FR')} aUEC`:''}`;
  if (prev) { prev.textContent = txt; prev.style.color = remain===0?'var(--red)':'var(--text-dim)'; }
  updateRMConfirmBtn();
}

function updateRMConfirmBtn(){
  const btn   = document.getElementById('rm-confirm-btn');
  const lbl   = document.getElementById('rm-selected-label');
  const input = document.getElementById('rm-qty');
  if (!btn) return;
  const s   = _rmSelectedId ? _rmStocks.find(x=>x.id===_rmSelectedId) : null;
  const qty = parseInt(input?.value)||0;
  const ok  = s && qty>=1 && qty<=s.qty;
  btn.disabled = !ok;
  btn.style.opacity  = ok ? '1' : '0.4';
  btn.style.cursor   = ok ? 'pointer' : 'not-allowed';
  if (lbl) {
    if (ok) {
      const isAll = qty===s.qty;
      lbl.textContent = isAll
        ? `Retrait total : ${s.res} (${qty} SCU)`
        : `Retrait partiel : ${qty} / ${s.qty} SCU de ${s.res}`;
      lbl.style.color = isAll ? 'var(--red)' : 'var(--orange)';
    } else {
      lbl.textContent = ''; lbl.style.color = 'var(--text-dim)';
    }
  }
}

function closeRMModal(){
  document.getElementById('rm-overlay').classList.remove('open');
  const qb = document.getElementById('rm-qty-block');
  if (qb) qb.style.display = 'none';
  _rmSelectedId = null;
}

async function confirmRemoveStock(){
  const input = document.getElementById('rm-qty');
  const qtyToRemove = parseInt(input?.value)||0;
  if (!_rmSelectedId || qtyToRemove<1) return;

  let stocks = (await DB.get('uex-stocks-'+selectedPid))||[];
  const target = stocks.find(s=>s.id===_rmSelectedId);
  if (!target) return;

  const pname = players.find(p=>p.id===selectedPid)?.name||'';
  const isPerso = _stockModalType === 'perso';
  const dbKey = isPerso ? 'uex-perso-'+selectedPid : 'uex-stocks-'+selectedPid;
  let msg = '';

  if (qtyToRemove >= target.qty) {
    stocks = stocks.filter(s=>s.id!==_rmSelectedId);
    msg = `"${target.res}" entièrement retiré du stock.`;
    if (!isPerso) { const retVal1=Math.round((target.price||0)*qtyToRemove); pushActivity('📤',`Retrait total : ${qtyToRemove}× ${target.res} (${pname})`,retVal1?'-'+retVal1.toLocaleString('fr-FR')+' aUEC':'',false); }
  } else {
    target.qty = target.qty - qtyToRemove;
    msg = `${qtyToRemove} SCU de "${target.res}" retirés. Restant : ${target.qty} SCU.`;
    if (!isPerso) { const retVal2=Math.round((target.price||0)*qtyToRemove); pushActivity('📤',`Retrait partiel : ${qtyToRemove}× ${target.res} (${pname})`,retVal2?'-'+retVal2.toLocaleString('fr-FR')+' aUEC':'',false); }
  }

  await DB.set(dbKey, stocks);
  _rmStocks = stocks;
  _rmSelectedId = null;
  closeRMModal();
  if (isPerso) {
    renderPersoTable(stocks);
  } else {
    renderStockTable(stocks);
    renderPlayerList(document.getElementById('pl-search').value);
    renderGlobal();
    renderStocksFromPlayers();
    syncObjectifsWithStock().then(() => refreshAllObjStockInfo());
    renderPartners();
    const tv=stocks.reduce((a,s)=>a+(s.price||0)*s.qty,0);
    const tu=stocks.reduce((a,s)=>a+Number(s.qty),0);
    document.getElementById('sf-distinct').textContent=stocks.length;
    document.getElementById('sf-units').textContent=tu.toLocaleString('fr-FR');
    document.getElementById('sf-total').textContent=Math.round(tv).toLocaleString('fr-FR')+' aUEC';
    renderAuthBar();
    updateKPIs();
  }
  toast('Stock mis à jour', msg, 'success');
}


/* Sélection catégorie via boutons */
function selectCat(btn){
  // Ne retirer active que sur les boutons du modal ps-overlay (pas les autres)
  const grid = document.getElementById('ps-cat-grid');
  if (grid) grid.querySelectorAll('.cat-sel-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const cat = btn.dataset.cat;
  document.getElementById('ps-cat').value = cat;
  // Filtrer le dropdown selon la catégorie sélectionnée
  populateResSelectFiltered(cat);
}

/* Aperçu marge en temps réel */
function updateMarginPreview(){
  const buy  = parseFloat(document.getElementById('ps-price').value)||0;
  const sell = parseFloat(document.getElementById('ps-sellprice').value)||0;
  const qty  = parseFloat(document.getElementById('ps-qty').value)||0;
  const prev = document.getElementById('margin-preview');
  const ptv  = document.getElementById('ps-total-preview');

  if (buy>0 && sell>0) {
    const pct    = ((sell-buy)/buy*100).toFixed(1);
    const profit = (sell-buy)*qty;
    const sign   = sell>=buy?'+':'';
    const col    = sell>=buy?'var(--green)':'var(--red)';
    document.getElementById('mp-pct').textContent   = sign+pct+'%';
    document.getElementById('mp-pct').style.color   = col;
    document.getElementById('mp-total').textContent = qty>0 ? sign+Math.round(profit).toLocaleString('fr-FR')+' aUEC' : '';
    prev.style.display = 'flex';
  } else {
    prev.style.display = 'none';
  }
  // Aperçu valeur achat total dans le footer
  if (buy>0 && qty>0) ptv.textContent = 'Achat total : '+Math.round(buy*qty).toLocaleString('fr-FR')+' aUEC';
  else ptv.textContent = '';
}

async function addPlayerStock(){
  const res       = document.getElementById('ps-res').value.trim();
  const qty       = parseFloat(document.getElementById('ps-qty').value);
  const price     = parseFloat(document.getElementById('ps-price').value)||0;
  const sellprice = parseFloat(document.getElementById('ps-sellprice').value)||0;
  const cat       = document.getElementById('ps-cat').value || 'mineral';
  const loc       = document.getElementById('ps-loc').value;
  const note      = document.getElementById('ps-note').value.trim();
  const quality   = document.getElementById('ps-quality')?.value || '';
  const qualityExact = parseInt(document.getElementById('ps-quality-exact')?.value) || null;
  const unit      = document.getElementById('ps-unit')?.value || 'scu';

  if (!res)         { toast('Ressource manquante','Entrez un nom de ressource.','error'); return; }
  if (!qty||qty<=0) { toast('Quantité invalide','Entrez une quantité > 0.','error'); return; }

  const isPerso = _stockModalType === 'perso';
  const dbKey = isPerso ? 'uex-perso-'+selectedPid : 'uex-stocks-'+selectedPid;
  const stocks=(await DB.get(dbKey))||[];
  stocks.push({ id:'s_'+Date.now(), res, cat, qty, price, sellprice, loc, note, quality, qualityExact, unit, addedAt:new Date().toISOString() });
  await DB.set(dbKey, stocks);
  closePSModal();
  if (isPerso) {
    renderPersoTable(stocks);
  } else {
    renderStockTable(stocks);
    renderPlayerList(document.getElementById('pl-search').value);
    renderGlobal();
    renderStocksFromPlayers();
    renderPartners();
    syncObjectifsWithStock().then(() => refreshAllObjStockInfo());
  }
  const p=players.find(x=>x.id===selectedPid);
  // Refresh hero stats
  const tv=stocks.reduce((a,s)=>a+(s.price||0)*s.qty,0);
  const tu=stocks.reduce((a,s)=>a+Number(s.qty),0);
  document.getElementById('sf-distinct').textContent=stocks.length;
  document.getElementById('sf-units').textContent=tu.toLocaleString('fr-FR');
  document.getElementById('sf-total').textContent=Math.round(tv).toLocaleString('fr-FR')+' aUEC';
  renderAuthBar();
  // Activité dynamique
  const addVal = Math.round(price * qty);
  pushActivity(
    '📦',
    `Dépôt ${qty}× ${res}${loc?' — '+loc:''} (${esc(p?.name||'')})`,
    addVal ? '+'+addVal.toLocaleString('fr-FR')+' aUEC' : '',
    true
  );
  updateKPIs();
  refreshDatalist(); // Nouvelle ressource → mettre à jour l'autocomplétion
  toast('Ressource ajoutée',`${qty}× ${res} enregistré pour ${p?.name||''}.`,'success');
  snapshotProfit(); // Snapshot du profit après ajout
}

/* Delete stock entry */
function confirmDelStock(sid,res){
  showConfirm('⚠ Supprimer cette ressource',
    `Retirer <strong style="color:var(--orange)">${res}</strong> du stock de ce joueur ?<br><small>Action irréversible.</small>`,
    async()=>{
      let stocks=(await DB.get('uex-stocks-'+selectedPid))||[];
      const delEntry = stocks.find(s=>s.id===sid);
      stocks=stocks.filter(s=>s.id!==sid);
      await DB.set('uex-stocks-'+selectedPid,stocks);
      syncObjectifsWithStock().then(() => refreshAllObjStockInfo());
      const pDel = players.find(p=>p.id===selectedPid);
      if (delEntry) pushActivity('🗑', `Suppression : ${delEntry.qty}× ${delEntry.res} (${pDel?.name||''})`, '', false);
      renderStockTable(stocks);
      renderPlayerList(document.getElementById('pl-search').value);
      renderGlobal();
      renderStocksFromPlayers();
      renderPartners();
      renderAuthBar();
      updateKPIs();
      toast('Ressource supprimée','','success');
      snapshotProfit();
    }
  );
}

// ── Stock Personnel — Edit & Delete ─────────────────────────
async function openEditPerso(sid) {
  if (!requireAuth(selectedPid, ()=>openEditPerso(sid))) return;
  const stocks = (await DB.get('uex-perso-'+selectedPid)) || [];
  const s = stocks.find(x=>x.id===sid);
  if (!s) return;
  _editStockId = sid;
  // Réutiliser le modal d'édition existant mais avec la clé perso
  _stockModalType = 'perso';
  document.getElementById('edit-price').value     = s.price     || '';
  document.getElementById('edit-sellprice').value = s.sellprice || '';
  document.getElementById('edit-qty').value       = s.qty       || '';
  document.getElementById('edit-loc').value       = s.loc       || '';
  document.getElementById('edit-res-name').textContent = s.res;
  document.getElementById('edit-overlay').classList.add('open');
}

function confirmDelPerso(sid, res) {
  showConfirm('⚠ Supprimer cette ressource',
    `Retirer <strong style="color:var(--orange)">${res}</strong> du stock personnel ?<br><small>Action irréversible.</small>`,
    async()=>{
      let stocks = (await DB.get('uex-perso-'+selectedPid)) || [];
      stocks = stocks.filter(s=>s.id!==sid);
      await DB.set('uex-perso-'+selectedPid, stocks);
      renderPersoTable(stocks);
      toast('Ressource supprimée','','success');
    }
  );
}

/* Delete player */
function confirmDeletePlayer(pid,name){
  if (!SESSION) { openLoginModal(null, ()=>confirmDeletePlayer(pid,name)); return; }
  if (!canManageRoles()) { toast('Accès refusé','Seuls les Admins et Gestionnaires peuvent supprimer un partenaire.','error'); return; }
  showConfirm('⚠ Supprimer ce joueur',
    `Supprimer <strong style="color:var(--orange)">${name}</strong> et tous ses stocks ?<br><small>Action irréversible.</small>`,
    async()=>{
      await DB.del('uex-stocks-'+pid);
      players=players.filter(p=>p.id!==pid);
      await DB.set('uex-players',players);
      if (selectedPid===pid){
        selectedPid=null;
        document.getElementById('pl-placeholder').style.display='flex';
        document.getElementById('pl-content').style.display='none';
      }
      renderPlayerList();
      renderGlobal();
      renderStocksFromPlayers();
      renderPartners();
      updateBadges();
      updateGlobalFilter();
      updateKPIs();
      toast('Joueur supprimé',`${name} a été retiré du réseau.`,'success');
    }
  );
}

/* Global stock view */
async function renderGlobal(){
  const fp=document.getElementById('gf-player')?.value||'';
  const fc=document.getElementById('gf-cat')?.value||'';
  let all=[];
  for (const p of players){
    const stocks=(await DB.get('uex-stocks-'+p.id))||[];
    stocks.forEach(s=>all.push({p,s}));
  }
  // KPI — guard
  const kpiStrip=document.getElementById('gkpi-strip');
  if (!kpiStrip) return;
  kpiStrip.innerHTML=`
    <div class="gkpi"><div class="gkpi-lbl">Joueurs</div><div class="gkpi-val orange">${players.length}</div></div>
    <div class="gkpi"><div class="gkpi-lbl">Ressources enregistrées</div><div class="gkpi-val">${all.length}</div></div>
    <div class="gkpi"><div class="gkpi-lbl">Unités totales (SCU)</div><div class="gkpi-val">${all.reduce((a,r)=>a+Number(r.s.qty),0).toLocaleString('fr-FR')}</div></div>
    <div class="gkpi"><div class="gkpi-lbl">Valeur réseau</div><div class="gkpi-val green">${Math.round(all.reduce((a,r)=>a+(r.s.price||0)*r.s.qty,0)).toLocaleString('fr-FR')} aUEC</div></div>`;
  let rows=all;
  if (fp) rows=rows.filter(r=>r.p.id===fp);
  if (fc) rows=rows.filter(r=>r.s.cat===fc);
  const body=document.getElementById('global-body');
  const empty=document.getElementById('global-empty');
  if (!body || !empty) return;
  if (!body || !empty) return;
  if (!rows.length){ body.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  body.innerHTML=rows.map(({p,s})=>`
    <tr style="cursor:pointer" onclick="goPanel('joueurs');setTimeout(()=>selectPlayer('${p.id}'),80)">
      <td><div style="display:flex;align-items:center;gap:7px;">
        <div style="width:22px;height:22px;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--orange);overflow:hidden;">${avHtml(players.find(x=>x.id===p.id)||p,22)}</div>
        <span style="font-weight:600;color:var(--text-bright);">${esc(p.name)}</span>
      </div></td>
      <td class="td-name">◈ ${esc(s.res)}</td>
      <td><span class="cat-badge cat-${s.cat}">${catLbl(s.cat)}</span></td>
      <td class="td-orange">${Number(s.qty).toLocaleString('fr-FR')}</td>
      <td class="td-dim">${s.price?s.price.toFixed(2)+' aUEC':'—'}</td>
      <td class="td-green">${s.price?Math.round(s.price*s.qty).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="td-dim">${esc(s.loc)}</td>
      <td class="td-dim">${fmtDate(s.addedAt)}</td>
    </tr>`).join('');
}

function updateGlobalFilter(){
  const sel=document.getElementById('gf-player');
  if (!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Tous les joueurs</option>'+players.map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(p.name)}</option>`).join('');
}
async function updateBadges(){
  const _s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  _s('badge-joueurs', players.length);
  _s('kpi-partners', players.length);
  // Compter toutes les ressources TELOS de tous les partenaires
  let totalRes = 0, totalArm = 0;
  for (const p of players) {
    const stocks = (await DB.get('uex-stocks-'+p.id)) || [];
    totalRes += stocks.filter(s => (parseFloat(s.qty)||0) > 0).length;
    const armory = (await DB.get('uex-armory-'+p.id)) || [];
    totalArm += armory.filter(a => (parseFloat(a.qty)||0) > 0).length;
  }
  const badgeRes = document.getElementById('badge-ressource-stock');
  if (badgeRes) {
    badgeRes.textContent = totalRes;
    badgeRes.style.display = totalRes > 0 ? '' : 'none';
  }
  const badgeArm = document.getElementById('badge-armurerie');
  if (badgeArm) {
    badgeArm.textContent = totalArm;
    badgeArm.style.display = totalArm > 0 ? '' : 'none';
  }
}

/* ════════════════════════════════════════════════════════════
   LOGS (live push)
════════════════════════════════════════════════════════════ */
function pushLog(type,tl,msg){
  const n=new Date();
  const ts=`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  FULL_LOGS_DATA.unshift({ts, type, tl, msg});
  // Mise à jour temps réel
  renderSysLogs();
  if (document.getElementById('panel-logs').classList.contains('active')) renderFullLogs();
}

/* ════════════════════════════════════════════════════════════
   REFRESH
════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════════════════ */
function toast(title,msg,type='info'){
  const icons={info:'ℹ️',success:'✅',error:'❌',warn:'⚠️'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span class="ti">${icons[type]||icons.info}</span><div><div class="tt">${title}</div>${msg?`<div class="tm">${msg}</div>`:''}</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(()=>el.remove(),4300);
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(iso){ if(!iso) return '—'; const d=new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
function shortUrl(url){ try{ const u=new URL(url); const parts=u.pathname.replace(/\/$/,'').split('/').filter(Boolean); return parts[parts.length-1]||u.hostname; }catch(e){ return url.slice(0,28); } }

/* ════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
════════════════════════════════════════════════════════════ */
document.addEventListener('keydown',e=>{
  if (e.key==='Escape'){ closeModal(); closeConfirm(); closePSModal(); closeEditStock(); closeAvatarPicker(); closeEditRole(); closeAddObjectif(); closeAddCommande(); closeAddBlueprint(); }
  if (e.key==='Enter'&&document.getElementById('ps-overlay').classList.contains('open')) addPlayerStock();
});

/* ════════════════════════════════════════════════════════════
   ANIMATION LOOP — avec resize automatique
════════════════════════════════════════════════════════════ */

// ResizeObserver global pour les canvas de carte
(function setupMapResizeObserver() {
  if (typeof ResizeObserver === 'undefined') return;
  const ro = new ResizeObserver(entries => {
    entries.forEach(entry => {
      const canvas = entry.target;
      const rect = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 10 || h < 10) return;
      // Redimensionner seulement si taille change vraiment
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
        // Forcer ré-init du hover
        canvas._inited = false;
      }
    });
  });
  // Observer dès que les canvas existent
  document.addEventListener('DOMContentLoaded', () => {
    ['stanton-canvas','map-canvas-full'].forEach(id => {
      const el = document.getElementById(id);
      if (el) ro.observe(el);
    });
  });
})();

function loop(t) {
  mapAnim = t;
  // Hub mini map
  const hubCanvas = document.getElementById('stanton-canvas');
  if (hubCanvas) {
    // Sync taille si pas encore fait ou si canvas pas initialisé
    if (!hubCanvas._inited) {
      const w = hubCanvas.offsetWidth;
      const h = hubCanvas.offsetHeight;
      if (w > 10 && h > 10) {
        hubCanvas.width  = w;
        hubCanvas.height = h;
        initMap(hubCanvas);
        hubCanvas._inited = true;
      }
    }
    if (hubCanvas._inited) drawMap(hubCanvas, hubCanvas.getContext('2d'), t);
  }
  // Full map panel
  const fullCanvas = document.getElementById('map-canvas-full');
  if (fullCanvas) {
    if (!fullCanvas._inited) {
      const w = fullCanvas.offsetWidth;
      const h = fullCanvas.offsetHeight;
      if (w > 10 && h > 10) {
        fullCanvas.width  = w;
        fullCanvas.height = h;
        initMap(fullCanvas);
        fullCanvas._inited = true;
      }
    }
    if (fullCanvas._inited) drawMap(fullCanvas, fullCanvas.getContext('2d'), t);
  }
  requestAnimationFrame(loop);
}

/* ════════════════════════════════════════════════════════════
   RESET COMPLET — vide tous les joueurs et stocks
════════════════════════════════════════════════════════════ */
async function resetAll() {
  // Sauvegarde préalable avant reset
  await exportData();
  const existingPlayers = (await DB.get('uex-players')) || [];
  for (const p of existingPlayers) { await DB.del('uex-stocks-' + p.id); }
  await DB.set('uex-players', []);
  players = [];
  pushLog('system','SYSTEM','Reset complet — sauvegarde exportée avant suppression.');
}


async function testSupabaseConnection(){try{const sb=getSB();if(!sb)throw new Error('no client');const{error}=await sb.from('telos_store').select('key').limit(1);if(error)throw new Error(error.message);console.log('[TELOS] ✅ Supabase connecté');return true;}catch(e){console.warn('[TELOS] ⚠',e.message);return false;}}
async function migrateLocalStorageToSupabase(){const btn=document.getElementById('btn-migrate'),status=document.getElementById('migrate-status');if(btn){btn.disabled=true;btn.textContent='⏳...';}const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('telos_'))keys.push(k.slice(6));}if(!keys.length){if(status)status.textContent='⚠ Aucune donnée';if(btn){btn.disabled=false;btn.textContent='📤 MIGRER';}return;}let done=0;for(const k of keys){try{const r=localStorage.getItem('telos_'+k);if(r){await DB.set(k,JSON.parse(r));done++;}}catch(e){}if(status)status.textContent=done+'/'+keys.length;}if(status)status.textContent='✅ '+done+' migrées';if(btn){btn.disabled=false;btn.textContent='✅ MIGRÉ';}toast('Migration',done+' clés migrées','success');}
async function testSupabaseWrite(){const el=document.getElementById('supa-write-status');if(el)el.textContent='⏳...';try{const sb=getSB();if(!sb)throw new Error('no client');const tk='_t'+Date.now();const{error:we}=await sb.from('telos_store').upsert({key:tk,value:{t:1},updated_at:new Date().toISOString()},{onConflict:'key'});if(we)throw new Error(we.message);const{data,error:re}=await sb.from('telos_store').select('value').eq('key',tk).maybeSingle();if(re||!data)throw new Error('lecture échouée');await sb.from('telos_store').delete().eq('key',tk);if(el){el.textContent='✅ OK';el.style.color='var(--green)';}toast('Supabase OK','Fonctionne','success');}catch(e){if(el){el.textContent='❌ '+e.message;el.style.color='var(--red)';}toast('Erreur',e.message,'error');}}
function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  testSupabaseConnection().then(ok=>{
    const el=document.getElementById('supa-status');
    if(el){ el.textContent=ok?'✅ Connecté':'⚠ Hors ligne'; el.style.color=ok?'var(--green)':'var(--orange)'; }
  });
  const s=document.getElementById('settings-admin-section');
  if(s) s.style.display=SESSION?.isAdmin?'':'none';
  // Sections Supabase et Migration visibles uniquement pour l'admin
  const sSupa=document.getElementById('settings-supabase-section');
  if(sSupa) sSupa.style.display=SESSION?.isAdmin?'':'none';
  const sMig=document.getElementById('settings-migration-section');
  if(sMig) sMig.style.display=SESSION?.isAdmin?'':'none';
  // Peupler le select récupération de code
  const recoverSel = document.getElementById('admin-recover-player');
  if (recoverSel && SESSION?.isAdmin) {
    recoverSel.innerHTML = '<option value="">— Sélectionner un joueur —</option>'
      + players.map(p=>'<option value="'+p.id+'">'+esc(p.name)+(p.isAdmin?' [ADMIN]':'')+'</option>').join('');
  }
  const recoverRes = document.getElementById('admin-recover-result');
  if (recoverRes) recoverRes.style.display = 'none';
  // Onglet rôles visible seulement admin
  const stabRoles=document.getElementById('stab-roles');
  if(stabRoles) stabRoles.style.display=SESSION?.isAdmin?'':'none';
  openSettingsTab('general');
}

function openSettingsTab(tab) {
  ['general','roles','backup'].forEach(t=>{
    const panel=document.getElementById('stab-panel-'+t);
    const btn=document.getElementById('stab-'+t);
    if(panel) panel.style.display = t===tab ? 'flex' : 'none';
    if(btn){ btn.style.color=t===tab?'var(--text-bright)':'var(--text-dim)'; btn.style.borderBottomColor=t===tab?'var(--orange)':'transparent'; }
  });
  if(tab==='roles') renderRolesDroitsPanel();
  if(tab==='backup') { if(!hasDroit('backup') && !SESSION?.isAdmin) { openSettingsTab('general'); return; } refreshBackupList(); }
}

// ── Rendu du panneau Rôles & Droits ──
function renderRolesDroitsPanel() {
  renderRolesNameList();
  renderDroitsTable();
}

function _roleColorHex(r) {
  // Retourne toujours une valeur hex valide pour input[type=color]
  const v = ROLES_COLORS_CUSTOM[r] || ROLE_COLORS_DEFAULT[r] || ROLE_COLORS_POOL[ROLES.indexOf(r) % ROLE_COLORS_POOL.length] || '#aaaaaa';
  // Si c'est une var() CSS, on retourne un fallback hex
  if (v.startsWith('var(')) return '#aaaaaa';
  return v;
}


function renderRolesNameList() {
  const el = document.getElementById('roles-name-list');
  if (!el) return;
  el.innerHTML = ROLES.map((r, i) => {
    const col = _roleColorHex(r);
    const inscrit = (r in ROLES_INSCRIPTION_CONFIG) ? ROLES_INSCRIPTION_CONFIG[r] : !ROLES_EXCLUS_INSCRIPTION.includes(r);
    const toggleTitle = inscrit ? 'Visible à l\'inscription — cliquer pour masquer' : 'Masqué à l\'inscription — cliquer pour rendre visible';
    const toggleStyle = inscrit
      ? 'border:1px solid var(--orange);color:var(--orange);background:rgba(247,140,30,0.1);'
      : 'border:1px solid var(--border);color:var(--text-dim);background:transparent;';
    const toggleIcon = inscrit ? '📋' : '🚫';
    return `
    <div style="display:grid;grid-template-columns:1fr 38px auto auto;gap:6px;align-items:center;">
      <input class="form-input" type="text" value="${r}" data-role-idx="${i}"
        style="padding:6px 9px;font-size:12px;border-left:3px solid ${col};"
        oninput="ROLES[${i}]=this.value; syncDroitsRoleKey(${i}, this.value);">
      <label title="Choisir une couleur" style="position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;width:38px;height:34px;border:1px solid var(--border);background:var(--bg3);">
        <div style="width:18px;height:18px;border-radius:50%;background:${col};border:2px solid rgba(255,255,255,0.15);pointer-events:none;"></div>
        <input type="color" value="${col}" data-role-color-idx="${i}"
          style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;border:none;padding:0;"
          oninput="setRoleColor(${i}, this.value)"
          onchange="setRoleColor(${i}, this.value)">
      </label>
      <button onclick="toggleRoleInscription('${r}')" title="${toggleTitle}"
        style="padding:2px 8px;cursor:pointer;font-family:var(--ui);font-size:11px;${toggleStyle}" >
        ${toggleIcon}
      </button>
      <button onclick="removeRole(${i})" style="padding:2px 8px;border:1px solid rgba(255,68,68,0.4);color:var(--red);background:transparent;cursor:pointer;font-family:var(--ui);font-size:11px;" title="Supprimer ce rôle">✕</button>
    </div>`;
  }).join('');
}

function setRoleColor(idx, hex) {
  const name = ROLES[idx];
  if (!name) return;
  ROLES_COLORS_CUSTOM[name] = hex;
  // Mettre à jour le cercle et la bordure de l'input en live
  const row = document.querySelectorAll('#roles-name-list > div')[idx];
  if (row) {
    const circle = row.querySelector('label div');
    const inp = row.querySelector('input[type="text"]');
    if (circle) circle.style.background = hex;
    if (inp) inp.style.borderLeftColor = hex;
  }
  // Mettre à jour le tableau des droits (couleurs dans les en-têtes)
  renderDroitsTable();
}

function toggleRoleInscription(roleName) {
  const current = (roleName in ROLES_INSCRIPTION_CONFIG)
    ? ROLES_INSCRIPTION_CONFIG[roleName]
    : !ROLES_EXCLUS_INSCRIPTION.includes(roleName);
  ROLES_INSCRIPTION_CONFIG[roleName] = !current;
  saveRolesConfig();
  renderRolesNameList();
  populateRegRoles && populateRegRoles();
}

function syncDroitsRoleKey(idx, newName) {
  if (oldName && oldName !== newName) {
    // Migrer droits
    ROLES_CONFIG[newName] = ROLES_CONFIG[oldName];
    delete ROLES_CONFIG[oldName];
    // Migrer couleur custom
    if (ROLES_COLORS_CUSTOM[oldName]) {
      ROLES_COLORS_CUSTOM[newName] = ROLES_COLORS_CUSTOM[oldName];
      delete ROLES_COLORS_CUSTOM[oldName];
    }
  }
  renderDroitsTable();
}

function addRole() {
  const name = 'Nouveau rôle';
  ROLES.push(name);
  ROLES_CONFIG[name] = { hub:1,map:1,partners:1,stocks:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,logs:0,ressources:0,edit_stock:1,add_commande:1,add_objectif:0,add_mission:0,add_blueprint:0,delete_data:0,manage_roles:0 };
  ROLES_COLORS_CUSTOM[name] = ROLE_COLORS_POOL[(ROLES.length - 1) % ROLE_COLORS_POOL.length];
  ROLES_INSCRIPTION_CONFIG[name] = true; // visible par défaut à l'inscription
  renderRolesNameList();
  renderDroitsTable();
  populateRegRoles && populateRegRoles();
}

function removeRole(idx) {
  if (ROLES.length <= 1) { toast('Impossible','Au moins un rôle requis.','error'); return; }
  const name = ROLES[idx];
  if (!confirm(`Supprimer le rôle "${name}" ?`)) return;
  ROLES.splice(idx, 1);
  delete ROLES_CONFIG[name];
  delete ROLES_COLORS_CUSTOM[name];
  delete ROLES_INSCRIPTION_CONFIG[name];
  renderRolesNameList();
  renderDroitsTable();
  populateRegRoles && populateRegRoles();
}

function renderDroitsTable() {
  const thead = document.getElementById('droits-thead');
  const tbody = document.getElementById('droits-tbody');
  if (!thead || !tbody) return;

  // Séparateurs visuels entre onglets et actions
  const SEPARATORS = { ressource_par: 'ONGLETS', edit_stock: 'ACTIONS' };

  // En-tête
  thead.innerHTML = '<tr>'
    + '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--border);color:var(--text-dim);font-size:11px;letter-spacing:1px;min-width:220px;position:sticky;left:0;background:var(--bg3);">FONCTION / ONGLET</th>'
    + ROLES.map(r=>`<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:center;white-space:nowrap;min-width:90px;"><span style="display:inline-block;padding:3px 8px;border:1px solid ${ROLE_COLORS[r]||'var(--border)'};color:${ROLE_COLORS[r]||'var(--text)'};font-size:11px;letter-spacing:1px;font-weight:700;">${r}</span></th>`).join('')
    + '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:center;min-width:70px;"><span style="color:#fff;font-size:11px;letter-spacing:1px;font-weight:700;">ADMIN</span></th>'
    + '</tr>';

  let rows = '';
  DROITS_DEFS.forEach(def => {
    // Séparateur de section
    if (SEPARATORS[def.id]) {
      const colSpan = ROLES.length + 2;
      rows += `<tr><td colspan="${colSpan}" style="padding:10px 12px 4px;background:var(--bg2);border-top:2px solid var(--border);border-bottom:1px solid var(--border);">
        <span style="font-size:9px;letter-spacing:2px;color:var(--orange);text-transform:uppercase;font-weight:700;">◈ ${SEPARATORS[def.id]}</span>
      </td></tr>`;
    }
    const cells = ROLES.map(r => {
      const cfg = ROLES_CONFIG[r] || {};
      const val = !!cfg[def.id];
      return `<td style="text-align:center;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <input type="checkbox" ${val?'checked':''} title="${def.desc}"
          onchange="setDroit('${r}','${def.id}',this.checked)"
          style="width:16px;height:16px;cursor:pointer;accent-color:var(--orange);">
      </td>`;
    }).join('');
    rows += `<tr onmouseover="this.style.background='rgba(247,140,30,0.05)'" onmouseout="this.style.background=''">
      <td style="padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.04);position:sticky;left:0;background:inherit;">
        <div style="font-size:13px;color:var(--text-bright);font-weight:600;">${def.label}</div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:1px;">${def.desc}</div>
      </td>
      ${cells}
      <td style="text-align:center;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--green);font-size:15px;">✓</td>
    </tr>`;
  });
  tbody.innerHTML = rows;
}

function setDroit(role, droit, val) {
  if (!ROLES_CONFIG[role]) ROLES_CONFIG[role] = {};
  ROLES_CONFIG[role][droit] = val ? 1 : 0;
  // Sauvegarde immédiate + mise à jour de la nav
  saveRolesConfig()
    .then(() => { updateNavRessources(); updateNavBanque && updateNavBanque(); })
    .catch(e => console.warn('setDroit save error:', e));
}

async function saveRolesAndDroits() {
  // Synchroniser les noms depuis les inputs
  const inputs = document.querySelectorAll('#roles-name-list input[data-role-idx]');
  inputs.forEach((inp, i) => { if (ROLES[i] !== undefined) ROLES[i] = inp.value.trim() || ROLES[i]; });
  await saveRolesConfig();
  toast('Rôles & droits sauvegardés', 'Configuration enregistrée.', 'success');
  renderRolesNameList();
  renderDroitsTable();
  populateRegRoles && populateRegRoles();
}

async function resetRolesConfig() {
  if (!confirm('Réinitialiser tous les rôles et droits aux valeurs par défaut ?')) return;
  ROLES = ['Trader','Mineur','Transporteur','Explorateur','Lead','Gestionnaire'];
  ROLES_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DROITS));
  ROLES_COLORS_CUSTOM = {};
  await saveRolesConfig();
  renderRolesDroitsPanel();
  populateRegRoles && populateRegRoles();
  toast('Réinitialisé', 'Rôles et droits remis par défaut.', 'info');
}
function closeSettings(){document.getElementById('settings-overlay').classList.remove('open');}
async function adminRecoverCode() {
  const pid = document.getElementById('admin-recover-player')?.value;
  const result = document.getElementById('admin-recover-result');
  if (!result) return;
  if (!pid) { result.style.display='block'; result.style.color='var(--red)'; result.textContent='Sélectionnez un joueur.'; return; }
  try {
    const data = await DB.get('telos-player-code-'+pid);
    if (data?.code) {
      result.style.display='block'; result.style.color='var(--green)';
      const p = players.find(x=>x.id===pid);
      result.innerHTML = '🔑 Code de <b>'+esc(p?.name||pid)+'</b> : <span style="color:var(--orange);font-weight:700;font-size:13px;">'+esc(data.code)+'</span><br><span style="font-size:9px;color:var(--text-dim);">Enregistré le '+new Date(data.savedAt).toLocaleString('fr-FR')+'</span>';
    } else {
      result.style.display='block'; result.style.color='var(--text-dim)';
      result.textContent='Aucun code sauvegardé pour ce joueur.';
    }
  } catch(e) {
    result.style.display='block'; result.style.color='var(--red)'; result.textContent='Erreur.';
  }
}

async function saveCorpoAccessCode() {
  const n  = document.getElementById('new-corpo-code')?.value.trim();
  const n2 = document.getElementById('confirm-corpo-code')?.value.trim();
  const msg = document.getElementById('corpo-code-msg');
  if (!msg) return;
  if (n !== n2) { msg.style.color='var(--red)'; msg.textContent='⚠ Les codes ne correspondent pas.'; return; }
  if (n && n.length < 4) { msg.style.color='var(--red)'; msg.textContent='⚠ Code trop court (min. 4 caractères).'; return; }
  if (n) {
    await setCorpoAccessCode(n);
    msg.style.color='var(--green)'; msg.textContent='✓ Code corpo enregistré.';
  } else {
    await DB.set(CORPO_ACCESS_CODE_KEY, null);
    msg.style.color='var(--text-dim)'; msg.textContent='Code supprimé — inscription libre.';
  }
  document.getElementById('new-corpo-code').value='';
  document.getElementById('confirm-corpo-code').value='';
  setTimeout(()=>{ if(msg) msg.textContent=''; }, 3000);
}


/* ══════════════════════════════════════════════════════════════════
   ARMURERIE TELOS — Équipements & Armes
════════════════════════════════════════════════════════════════════ */
var _armSelectedPid = null;
var _armCatFilter   = 'all';

var ARM_CAT_LABELS = {
  arme_fps:           '🔫 Arme FPS',
  armure:             '🛡 Armure',
  composant_vaisseau: '🔧 Composant',
  arme_vaisseau:      '🚀 Arme Vaisseau',
};
var ARM_CAT_COLORS = {
  arme_fps:           '#f87171',
  armure:             '#60a5fa',
  composant_vaisseau: '#f79028',
  arme_vaisseau:      '#a78bfa',
};

function goToArmurerie(el) {
  if (!SESSION) { openLoginModal(null, () => goToArmurerie(el)); return; }
  goPanel('armurerie', el);
}

// Rendre la liste des partenaires dans la sidebar armurerie
async function renderArmPartnerList(filter='') {
  const list = document.getElementById('arm-list');
  if (!list) return;
  const filtered = filter ? players.filter(p=>p.name.toLowerCase().includes(filter.toLowerCase())) : players;
  if (!filtered.length) { list.innerHTML='<div class="pl-empty-msg">Aucun partenaire.</div>'; return; }
  const items = await Promise.all(filtered.map(async p => {
    const items = (await DB.get('uex-armory-'+p.id)) || [];
    const active = _armSelectedPid === p.id ? 'sel' : '';
    return `<div class="pl-item ${active}" data-action="arm-select" data-id="${p.id}">
      <div class="pl-avatar" style="overflow:hidden;">${avHtml(p,32)}</div>
      <div class="pl-info">
        <div class="pl-name">${esc(p.name)}</div>
        <div class="pl-meta">${p.role}</div>
      </div>
      <span class="pl-badge ${items.length?'pb-stock':'pb-empty'}">${items.length||'vide'}</span>
    </div>`;
  }));
  list.innerHTML = items.join('');
}

function filterArmPartners(v) { renderArmPartnerList(v); }

var _currentArmTab = 'telos';

function switchArmTab(tab, btn) {
  _currentArmTab = tab;
  ['telos','perso'].forEach(t => {
    const b = document.getElementById('armtab-' + t);
    const c = document.getElementById('armtab-content-' + t);
    if (!b || !c) return;
    if (t === tab) {
      b.style.borderBottomColor = 'var(--orange)';
      b.style.color = 'var(--text-bright)';
      c.style.display = 'flex';
    } else {
      b.style.borderBottomColor = 'transparent';
      b.style.color = 'var(--text-dim)';
      c.style.display = 'none';
    }
  });
  if (_armSelectedPid) {
    if (tab === 'telos') renderArmTable();
    else DB.get('uex-armory-perso-'+_armSelectedPid).then(items => renderArmPersoTable(items||[]));
  }
}

async function renderArmPersoTable(items) {
  const tbody = document.getElementById('arm-perso-tbody');
  const empty = document.getElementById('arm-perso-empty');
  if (!tbody) return;
  if (!items.length) { tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';

  // Index pour panneau détail (perso)
  window._armGroups = window._armGroups || {};
  window._armPersoItems = items;
  window._armAllItems = items;

  const groups = {};
  items.forEach(s => {
    const key = (s.name||'').toLowerCase()+'|'+(s.cat||'');
    if (!groups[key]) groups[key] = { name:s.name, cat:s.cat, quality:s.quality||'',
      unit:s.unit||'unite', qualityExact:s.qualityExact||null,
      qty:0, buyVal:0, sellVal:0, price:0, sellprice:0, loc:s.loc||'', ids:[], addedAt:s.addedAt };
    const g = groups[key];
    g.qty += s.qty||0; g.buyVal += (s.price||0)*(s.qty||0); g.sellVal += (s.sellprice||0)*(s.qty||0);
    if (g.qty>0) { g.price=g.buyVal/g.qty; g.sellprice=g.sellVal/g.qty; }
    if (s.loc && !g.loc.includes(s.loc)) g.loc = g.loc?g.loc+', '+s.loc:s.loc;
    g.ids.push(s.id);
    if (!g.addedAt||s.addedAt>g.addedAt) g.addedAt=s.addedAt;
  });

  const rows = Object.values(groups).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  const qMeta = (q)=>QUALITY_META[q]||{label:q,color:'var(--text-dim)'};

  tbody.innerHTML = rows.map(g => {
    const margin = g.price>0&&g.sellprice>0?((g.sellprice-g.price)/g.price*100).toFixed(1):null;
    const col = ARM_CAT_COLORS[g.cat]||'var(--text-dim)';
    const qm = qMeta(g.quality);
    const gkey = 'armperso_'+(g.name+'|'+g.cat).replace(/[^a-z0-9|]/gi,'_');
    window._armGroups[gkey] = { ids: g.ids, isPerso: true };
    return `<tr style="cursor:pointer;" onclick="openArmDetail('${gkey}')"
      onmouseover="this.style.background='rgba(247,140,30,0.05)'" onmouseout="this.style.background=''">
      <td class="td-name">🎒 ${esc(g.name)}
        <div style="display:flex;gap:4px;margin-top:2px;">
          ${g.unit!=='unite'?`<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(247,140,30,0.3);color:var(--text-dim);">SCU</span>`:`<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(96,165,250,0.4);color:#60a5fa;">UNITÉ</span>`}
          ${g.qualityExact?`<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(0,255,163,0.3);color:var(--green);font-family:var(--mono);">${g.qualityExact}</span>`:''}
        </div>
      </td>
      <td><span class="arm-cat-badge" style="color:${col};border-color:${col};">${ARM_CAT_LABELS[g.cat]||g.cat}</span></td>
      <td>${g.quality?'<span style="color:'+qm.color+';font-size:10px;">'+qm.label+'</span>':'<span style="color:var(--text-dim);font-size:10px;">—</span>'}</td>
      <td style="text-align:center;font-weight:700;color:var(--text-bright);">${g.qty}</td>
      <td class="td-dim">${g.price?g.price.toFixed(0)+' aUEC':'—'}</td>
      <td style="color:var(--blue);">${g.sellprice?g.sellprice.toFixed(0)+' aUEC':'—'}</td>
      <td class="${margin!==null?(parseFloat(margin)>=0?'td-green':'td-red'):''}">${margin!==null?(parseFloat(margin)>=0?'+':'')+margin+'%':'—'}</td>
      <td class="td-dim">${g.buyVal?Math.round(g.buyVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="td-green">${g.sellVal?Math.round(g.sellVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="td-dim" style="font-size:10px;"><span>📍 ${esc((g.loc||'—').slice(0,20))}</span></td>
      <td class="td-dim" style="font-size:10px;">${fmtDate(g.addedAt)}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:4px;">
          <button class="btn sm" onclick="openArmModal('${g.ids[0]}','perso')" style="border-color:var(--orange);color:var(--orange);">✏</button>
          <button class="btn danger sm" onclick="armPersoDelItem('${g.ids[0]}','${esc(g.name)}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('arm-perso-distinct').textContent = rows.length;
  document.getElementById('arm-perso-units').textContent = rows.reduce((s,r)=>s+r.qty,0).toLocaleString('fr-FR');
  document.getElementById('arm-perso-total').textContent = Math.round(rows.reduce((s,r)=>s+r.buyVal,0)).toLocaleString('fr-FR')+' aUEC';
}

async function armPersoDelItem(sid, name) {
  showConfirm('⚠ Supprimer cet équipement',
    `Retirer <strong style="color:var(--orange)">${name}</strong> de l'armurerie personnelle ?`,
    async()=>{
      let items=(await DB.get('uex-armory-perso-'+_armSelectedPid))||[];
      items=items.filter(s=>s.id!==sid);
      await DB.set('uex-armory-perso-'+_armSelectedPid, items);
      renderArmPersoTable(items);
      toast('Équipement supprimé','','success');
    }
  );
}

function backToArmList() {
  document.getElementById('arm-list-view').style.display = 'flex';
  const ac = document.getElementById('arm-content');
  if (ac) ac.style.display = 'none';
  document.getElementById('arm-header-list').style.display = 'flex';
  document.getElementById('arm-header-view').style.display = 'none';
  document.querySelectorAll('#arm-list .pl-item').forEach(el => el.classList.remove('sel'));
  _armSelectedPid = null;
}

async function selectArmPlayer(pid) {
  _armSelectedPid = pid;
  const p = players.find(x=>x.id===pid);
  if (!p) return;

  // Basculer : masquer la liste, afficher la vue plein écran
  document.getElementById('arm-list-view').style.display = 'none';
  const armContent = document.getElementById('arm-content');
  if (armContent) { armContent.style.flex = '1'; armContent.style.display = 'flex'; armContent.style.flexDirection = 'column'; }
  document.getElementById('arm-header-list').style.display = 'none';
  document.getElementById('arm-header-view').style.display = 'flex';

  // Mettre à jour l'en-tête
  const nameEl = document.getElementById('arm-partner-name');
  if (nameEl) nameEl.textContent = p.name;
  // Profil compact — style identique à prof-hero du panel joueurs
  const head = document.getElementById('arm-profile-head');
  if (head) {
    const armCount = ((await DB.get('uex-armory-'+pid))||[]).length;
    const bpCount = ((window._playerBpCache&&window._playerBpCache[pid])||[]).length;
    head.style.background = 'var(--bg)';
    head.innerHTML = `
    <div style="display:flex;flex-direction:column;width:100%;">
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px 12px;border:1px solid var(--border);margin:12px;background:var(--bg2);position:relative;">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--orange),transparent);"></div>
        <div style="width:48px;height:48px;flex-shrink:0;background:var(--bg3);border:2px solid var(--orange);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--orange);font-weight:700;clip-path:polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%);overflow:hidden;">${avHtml(p,48)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:18px;font-weight:700;color:var(--text-bright);letter-spacing:1px;line-height:1.1;">${esc(p.name)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
            ${p.isAdmin
              ? `<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:2px 7px;border:1px solid #fff;color:#fff;font-family:var(--ui);">ADMIN</span>`
              : `<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:2px 7px;border:1px solid ${ROLE_COLORS[p.role]||'var(--orange)'};color:${ROLE_COLORS[p.role]||'var(--orange)'};font-family:var(--ui);">${p.role||'—'}</span>`
            }
            <span style="font-size:10px;color:var(--text-dim);font-family:var(--mono);">depuis ${fmtDate(p.joinedAt)}</span>
          </div>
          <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">
            <a class="prof-link" href="${esc(p.rsi)}" target="_blank" rel="noopener" style="font-size:9px;padding:2px 6px;"><span class="ll">RSI</span>${shortUrl(p.rsi)}</a>
            ${p.uex?`<a class="prof-link" href="${esc(p.uex)}" target="_blank" rel="noopener" style="font-size:9px;padding:2px 6px;"><span class="ll">UEX</span>${shortUrl(p.uex)}</a>`:''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
          <div style="text-align:right;">
            <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;">ÉQUIPEMENTS</div>
            <div style="font-family:var(--mono);font-size:17px;color:${armCount?'var(--orange)':'var(--text-dim)'};">${armCount} items</div>
          </div>
        </div>
      </div>
    </div>`;
  }
  // Afficher le panel actif
  document.getElementById('arm-placeholder').style.display = 'none';
  const active = document.getElementById('arm-active');
  active.style.display = 'flex';
  const rmBtn = document.getElementById('arm-remove-btn');
  if (rmBtn) rmBtn.style.display = (SESSION?.pid===pid||SESSION?.isAdmin) ? '' : 'none';
  // Réinitialiser sur l'onglet TELOS
  _currentArmTab = 'telos';
  ['telos','perso'].forEach(t => {
    const b = document.getElementById('armtab-' + t);
    const c = document.getElementById('armtab-content-' + t);
    if (b) { b.style.borderBottomColor = t==='telos'?'var(--orange)':'transparent'; b.style.color = t==='telos'?'var(--text-bright)':'var(--text-dim)'; }
    if (c) c.style.display = t==='telos' ? 'flex' : 'none';
  });
  await renderArmTable();
  DB.get('uex-armory-perso-'+pid).then(items => renderArmPersoTable(items||[]));
  renderArmPartnerList(document.getElementById('arm-search')?.value||'');
}

async function renderArmTable() {
  const tbody = document.getElementById('arm-partner-tbody');
  const empty = document.getElementById('arm-empty');
  if (!tbody || !_armSelectedPid) return;
  let items = (await DB.get('uex-armory-'+_armSelectedPid)) || [];
  // Filtres
  const catF  = document.getElementById('arm-cat-filter')?.value||'all';
  const qualF = document.getElementById('arm-quality-filter')?.value;
  const search= (document.getElementById('arm-item-search')?.value||'').toLowerCase();
  if (catF !== 'all') items = items.filter(i=>i.cat===catF);
  if (qualF !== 'all') items = items.filter(i=>(i.quality||'')===(qualF||''));
  if (search) items = items.filter(i=>(i.name||'').toLowerCase().includes(search)||(i.note||'').toLowerCase().includes(search));
  // Consolider par nom+cat
  const groups = {};
  items.forEach(s => {
    const key = (s.name||'').toLowerCase()+'|'+(s.cat||'');
    if (!groups[key]) groups[key] = { name:s.name, cat:s.cat, quality:s.quality||'',
      unit:s.unit||'unite', qualityExact:s.qualityExact||null,
      qty:0, buyVal:0, sellVal:0, price:0, sellprice:0, loc:s.loc||'', ids:[], addedAt:s.addedAt };
    const g = groups[key];
    g.qty     += s.qty||0;
    g.buyVal  += (s.price||0)*(s.qty||0);
    g.sellVal += (s.sellprice||0)*(s.qty||0);
    if (g.qty>0) { g.price=g.buyVal/g.qty; g.sellprice=g.sellVal/g.qty; }
    if (s.loc && !g.loc.includes(s.loc)) g.loc = g.loc?g.loc+', '+s.loc:s.loc;
    g.ids.push(s.id);
    if (!g.addedAt||s.addedAt>g.addedAt) g.addedAt=s.addedAt;
  });
  const rows = Object.values(groups).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  if (!rows.length) { tbody.innerHTML=''; empty.style.display='block'; updateArmFooter([]); return; }
  empty.style.display='none';
  const qMeta = (q)=>QUALITY_META[q]||{label:q,color:'var(--text-dim)'};

  // Index pour panneau détail (TELOS)
  window._armGroups = {};
  const _telosItemsFull = (await DB.get('uex-armory-'+_armSelectedPid))||[];
  window._armTelosItems = _telosItemsFull;
  window._armAllItems = _telosItemsFull;

  tbody.innerHTML = rows.map(g => {
    const margin = g.price>0&&g.sellprice>0?((g.sellprice-g.price)/g.price*100).toFixed(1):null;
    const profit = g.sellprice>0?g.sellVal-g.buyVal:null;
    const col = ARM_CAT_COLORS[g.cat]||'var(--text-dim)';
    const qm = qMeta(g.quality);
    const gkey = (g.name+'|'+g.cat).replace(/[^a-z0-9|]/gi,'_');
    window._armGroups[gkey] = g.ids;
    return `<tr style="cursor:pointer;" onclick="openArmDetail('${gkey}')"
      onmouseover="this.style.background='rgba(247,140,30,0.05)'" onmouseout="this.style.background=''">
      <td class="td-name">
        ◈ ${esc(g.name)}
        ${g.ids.length>1?'<div style="font-size:9px;color:var(--text-dim);">'+g.ids.length+' entrées</div>':''}
        <div style="display:flex;gap:4px;margin-top:2px;">
          ${g.unit&&g.unit!=='unite'?`<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(247,140,30,0.3);color:var(--text-dim);letter-spacing:1px;">SCU</span>`:`<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(96,165,250,0.4);color:#60a5fa;letter-spacing:1px;">UNITÉ</span>`}
          ${g.qualityExact?`<span style="font-size:9px;padding:1px 5px;border:1px solid rgba(0,255,163,0.3);color:var(--green);font-family:var(--mono);">${g.qualityExact}</span>`:''}
        </div>
      </td>
      <td><span class="arm-cat-badge" style="color:${col};border-color:${col};">${ARM_CAT_LABELS[g.cat]||g.cat}</span></td>
      <td>${g.quality?'<span style="color:'+qm.color+';font-size:10px;">'+qm.label+'</span>':'<span style="color:var(--text-dim);font-size:10px;">—</span>'}</td>
      <td style="text-align:center;font-weight:700;color:var(--text-bright);">${g.qty}</td>
      <td class="td-dim">${g.price?g.price.toFixed(0)+' aUEC':'—'}</td>
      <td style="color:var(--blue);">${g.sellprice?g.sellprice.toFixed(0)+' aUEC':'—'}</td>
      <td class="${margin!==null?(parseFloat(margin)>=0?'td-green':'td-red'):''}">${margin!==null?(parseFloat(margin)>=0?'+':'')+margin+'%':'—'}</td>
      <td class="td-dim">${g.buyVal?Math.round(g.buyVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="td-green">${g.sellVal?Math.round(g.sellVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
      <td class="td-dim" style="font-size:10px;"><span title="${esc(g.loc)}">📍 ${esc((g.loc||'—').slice(0,20))}</span></td>
      <td class="td-dim" style="font-size:10px;">${fmtDate(g.addedAt)}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:4px;">
          <button class="btn sm" onclick="openArmModal('${g.ids[0]}','telos')" style="border-color:var(--orange);color:var(--orange);" title="Modifier">✏</button>
          <button class="btn danger sm" onclick="armDelItem('${g.ids[0]}','${esc(g.name)}')">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  updateArmFooter(rows);
  // Badge nav
  const badge = document.getElementById('badge-armurerie');
  const allItems = ((await DB.get('uex-armory-'+_armSelectedPid))||[]).filter(a=>(parseFloat(a.qty)||0)>0);
  if (badge) { badge.textContent=allItems.length; badge.style.display=allItems.length?'':'none'; }
}

function updateArmFooter(rows) {
  document.getElementById('arm-sf-distinct').textContent = rows.length;
  document.getElementById('arm-sf-units').textContent    = rows.reduce((s,r)=>s+r.qty,0).toLocaleString('fr-FR');
  document.getElementById('arm-sf-total').textContent    = Math.round(rows.reduce((s,r)=>s+r.buyVal,0)).toLocaleString('fr-FR')+' aUEC';
}

function goArmStockFull() {
  document.getElementById('arm-cat-filter').value='all';
  document.getElementById('arm-quality-filter').value='all';
  document.getElementById('arm-item-search').value='';
  renderArmTable();
}

// ── Modal ajout item armurerie ──
var _armEditId = null;
var _armPsModalOpen = false;

function syncArmQualityBadge() {}

function openArmDetail(key) {
  const ids = (window._armGroups||{})[key];
  if (!ids||!ids.length) return;
  // Choisir le bon tableau selon le préfixe de clé
  const isPerso = key.startsWith('armperso_');
  const allItems = isPerso ? (window._armPersoItems||[]) : (window._armTelosItems||[]);
  const entries = ids.map(id=>allItems.find(s=>s.id===id)).filter(Boolean);
  if (!entries.length) return;

  const QUALITY_LABELS = { mediocre:'💀 Médiocre', basique:'🔴 Basique', acceptable:'🟠 Acceptable', honnete:'🟡 Honnête', moyenne:'🟢 Moyenne', haute:'💎 Haute' };
  const QUALITY_COLORS = { mediocre:'#6b7280', basique:'var(--red)', acceptable:'var(--orange)', honnete:'#eab308', moyenne:'var(--green)', haute:'#a855f7' };

  document.getElementById('sdp-res-name').textContent = entries[0].name;

  const totalQty  = entries.reduce((a,s)=>a+Number(s.qty),0);
  const totalBuy  = entries.reduce((a,s)=>a+(s.price||0)*s.qty,0);
  const totalSell = entries.reduce((a,s)=>a+(s.sellprice||0)*s.qty,0);
  const profit    = totalSell - totalBuy;
  document.getElementById('sdp-summary').innerHTML = `
    <div style="flex:1;padding:10px 12px;border-right:1px solid var(--border);text-align:center;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;">Entrées</div>
      <div style="font-size:20px;font-weight:700;color:var(--text-bright);font-family:var(--mono);">${entries.length}</div>
    </div>
    <div style="flex:1;padding:10px 12px;border-right:1px solid var(--border);text-align:center;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;">Quantité</div>
      <div style="font-size:20px;font-weight:700;color:var(--orange);font-family:var(--mono);">${totalQty.toLocaleString('fr-FR')}</div>
    </div>
    <div style="flex:1;padding:10px 12px;text-align:center;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;">Profit total</div>
      <div style="font-size:20px;font-weight:700;font-family:var(--mono);color:${profit>=0?'var(--green)':'var(--red)'};">${profit>=0?'+':''}${Math.round(profit).toLocaleString('fr-FR')} <span style="font-size:11px;">aUEC</span></div>
    </div>`;

  document.getElementById('sdp-entries').innerHTML = entries.map((s,i) => {
    const ql   = QUALITY_LABELS[s.quality]||'— Non spécifié';
    const qcol = QUALITY_COLORS[s.quality]||'var(--text-dim)';
    const unit = s.unit==='scu'?'SCU':'Unité';
    const pft  = s.sellprice>0?(s.sellprice-(s.price||0))*s.qty:null;
    const margin= s.price>0&&s.sellprice>0?((s.sellprice-s.price)/s.price*100).toFixed(1):null;
    const catCol= ARM_CAT_COLORS[s.cat]||'var(--text-dim)';
    return `<div style="background:var(--bg3);border:1px solid var(--border);border-left:3px solid ${qcol};padding:12px 14px;display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;letter-spacing:1.5px;color:var(--text-dim);">ENTRÉE #${i+1}</span>
        <div style="display:flex;gap:5px;">
          <button onclick="closeStockDetail();openArmModal('${s.id}')" style="font-size:10px;padding:2px 8px;border:1px solid var(--orange);color:var(--orange);background:transparent;cursor:pointer;font-family:var(--ui);">✏ Modifier</button>
          <button onclick="closeStockDetail();armDelItem('${s.id}','${esc(s.name)}')" style="font-size:10px;padding:2px 8px;border:1px solid rgba(255,68,68,0.5);color:var(--red);background:transparent;cursor:pointer;font-family:var(--ui);">✕</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:700;color:${qcol};">${ql}</span>
        ${s.qualityExact?`<span style="font-family:var(--mono);font-size:13px;color:${qcol};border:1px solid ${qcol};padding:1px 8px;">${s.qualityExact} <span style="font-size:9px;opacity:.7;">/ 1000</span></span>`:''}
        <span style="font-size:10px;padding:1px 7px;border:1px solid ${catCol};color:${catCol};">${ARM_CAT_LABELS[s.cat]||s.cat}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;font-size:11px;">
        <div><span style="color:var(--text-dim);">Quantité</span><br><span style="color:var(--text-bright);font-family:var(--mono);font-weight:700;">${Number(s.qty).toLocaleString('fr-FR')} <span style="font-size:9px;color:var(--text-dim);">${unit}</span></span></div>
        <div><span style="color:var(--text-dim);">Localisation</span><br><span style="color:var(--text-bright);">📍 ${esc(s.loc||'—')}</span></div>
        <div><span style="color:var(--text-dim);">Prix achat /u</span><br><span style="color:var(--text-bright);font-family:var(--mono);">${s.price?s.price.toFixed(0)+' aUEC':'—'}</span></div>
        <div><span style="color:var(--text-dim);">Prix vente /u</span><br><span style="color:var(--blue);font-family:var(--mono);">${s.sellprice?s.sellprice.toFixed(0)+' aUEC':'—'}</span></div>
        <div><span style="color:var(--text-dim);">Marge</span><br><span style="color:${margin!==null?(parseFloat(margin)>=0?'var(--green)':'var(--red)'):'var(--text-dim)'};font-family:var(--mono);">${margin!==null?(parseFloat(margin)>=0?'+':'')+margin+'%':'—'}</span></div>
        <div><span style="color:var(--text-dim);">Profit total</span><br><span style="color:${pft!==null?(pft>=0?'var(--green)':'var(--red)'):'var(--text-dim)'};font-family:var(--mono);">${pft!==null?(pft>=0?'+':'')+Math.round(pft).toLocaleString('fr-FR')+' aUEC':'—'}</span></div>
        <div><span style="color:var(--text-dim);">Date ajout</span><br><span style="color:var(--text-dim);font-size:10px;">${fmtDate(s.addedAt)}</span></div>
      </div>
      ${s.note?`<div style="border-top:1px solid var(--border);padding-top:6px;font-size:10px;color:var(--text-dim);font-family:var(--mono);">📝 ${esc(s.note)}</div>`:''}
    </div>`;
  }).join('');

  const ov = document.getElementById('stock-detail-overlay');
  const pn = document.getElementById('stock-detail-panel');
  ov.style.display = 'flex'; ov.style.alignItems = 'stretch';
  setTimeout(()=>pn.style.transform='translateX(0)', 10);
}

async function armDelItem(sid, name) {
  showConfirm('⚠ Supprimer cet équipement',
    `Retirer <strong style="color:var(--orange)">${name}</strong> de l'armurerie ?<br><small>Action irréversible.</small>`,
    async()=>{
      let items=(await DB.get('uex-armory-'+_armSelectedPid))||[];
      items=items.filter(s=>s.id!==sid);
      await DB.set('uex-armory-'+_armSelectedPid, items);
      await renderArmTable();
      updateBadges();
      toast('Équipement supprimé','','success');
    }
  );
}

var _armModalType = 'telos';

function openAddArmItem(type) {
  _armModalType = type || _currentArmTab || 'telos';
  openArmModal(null);
}

async function openArmModal(editId, type) {
  _armEditId = editId || null;
  if (type) _armModalType = type;
  const dbKey = _armModalType === 'perso' ? 'uex-armory-perso-'+_armSelectedPid : 'uex-armory-'+_armSelectedPid;
  const items = (await DB.get(dbKey)) || [];
  const item = editId ? items.find(x=>x.id===editId) : null;
  let overlay = document.getElementById('arm-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'arm-modal-overlay';
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="modal" style="max-width:520px;" onclick="event.stopPropagation()">
      <div class="modal-head"><span class="modal-title" id="arm-modal-title">⚔ AJOUTER UN ÉQUIPEMENT</span><button class="modal-close" onclick="closeArmModal()">✕</button></div>
      <div class="modal-body" style="gap:12px;">

        <!-- Catégorie -->
        <div class="form-field">
          <label class="form-lbl">Catégorie <span class="req">*</span></label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;" id="arm-cat-btns">
            <button type="button" class="cat-sel-btn active" data-armcat="arme_fps"           onclick="selectArmCat('arme_fps')"          style="flex:1;padding:6px 10px;font-size:11px;">🔫 Armes FPS</button>
            <button type="button" class="cat-sel-btn"        data-armcat="armure"             onclick="selectArmCat('armure')"            style="flex:1;padding:6px 10px;font-size:11px;">🛡 Armures</button>
            <button type="button" class="cat-sel-btn"        data-armcat="arme_vaisseau"      onclick="selectArmCat('arme_vaisseau')"     style="flex:1;padding:6px 10px;font-size:11px;">🚀 Armes Vaisseau</button>
            <button type="button" class="cat-sel-btn"        data-armcat="composant_vaisseau" onclick="selectArmCat('composant_vaisseau')" style="flex:1;padding:6px 10px;font-size:11px;">🔧 Composants</button>
          </div>
          <input type="hidden" id="arm-cat" value="arme_fps">
        </div>

        <!-- Sélect DB + saisie manuelle -->
        <div class="form-field">
          <label class="form-lbl">Désignation <span class="req">*</span></label>
          <select class="form-input" id="arm-db-select" style="height:auto;padding:9px 11px;" onchange="armDbSelectChange(this.value)">
            <option value="">— Catalogue Corp TELOS —</option>
          </select>
          <div style="display:flex;align-items:center;gap:6px;margin:4px 0;">
            <div style="flex:1;height:1px;background:var(--border);"></div>
            <span style="font-size:9px;letter-spacing:1px;color:var(--text-dim);">OU SAISIR MANUELLEMENT</span>
            <div style="flex:1;height:1px;background:var(--border);"></div>
          </div>
          <input class="form-input" type="text" id="arm-name" placeholder="ex: Custaniah Light Helmet" maxlength="100" oninput="document.getElementById('arm-db-select').value=''">
        </div>

        <div class="grid2">
          <!-- Quantité + unité -->
          <div class="form-field">
            <label class="form-lbl">Quantité <span class="req">*</span></label>
            <div style="display:flex;gap:6px;">
              <input class="form-input" type="number" id="arm-qty" min="1" step="1" value="1" style="flex:1;">
              <select class="form-input" id="arm-unit" style="width:90px;height:auto;padding:9px 8px;">
                <option value="unite">Unité</option>
                <option value="scu">SCU</option>
              </select>
            </div>
          </div>

          <!-- Qualité plage + exacte -->
          <div class="form-field">
            <label class="form-lbl">Qualité</label>
            <div style="display:flex;gap:6px;">
              <select class="form-input" id="arm-quality" style="flex:1;height:auto;padding:9px 8px;" onchange="syncArmQualityBadge()">
                <option value="">— Sans qualité —</option>
                <option value="mediocre">💀 Médiocre (&lt;500)</option>
                <option value="basique">🔴 Basique (500-600)</option>
                <option value="acceptable">🟠 Acceptable (600-700)</option>
                <option value="honnete">🟡 Honnête (700-800)</option>
                <option value="moyenne">🟢 Moyenne (800-900)</option>
                <option value="haute">💎 Haute (900-1000)</option>
              </select>
              <input class="form-input" type="number" id="arm-quality-exact" placeholder="0–1000" min="0" max="1000"
                style="width:80px;text-align:center;" oninput="syncArmQualityFromExact(this.value)">
            </div>
          </div>

          <div class="form-field"><label class="form-lbl">Prix achat (aUEC)</label>
            <input class="form-input" type="number" id="arm-price" min="0" placeholder="0"></div>
          <div class="form-field"><label class="form-lbl">Prix vente (aUEC)</label>
            <input class="form-input" type="number" id="arm-sellprice" min="0" placeholder="0"></div>
          <div class="form-field" style="grid-column:span 2;"><label class="form-lbl">Localisation</label>
            <select class="form-input" id="arm-loc" style="height:auto;padding:9px 11px;">
              <optgroup label="Planètes">
                <option>Area18 (ArcCorp)</option>
                <option>Lorville (Hurston)</option>
                <option>New Babbage (microTech)</option>
                <option>Orison (Crusader)</option>
              </optgroup>
              <optgroup label="Stations">
                <option>Port Tressler</option>
                <option>Grimhex</option>
                <option>Everus Harbor</option>
                <option>Baijini Point</option>
                <option>Pyro Gateway</option>
              </optgroup>
              <option>Autre</option>
            </select></div>
        </div>
        <div class="form-field"><label class="form-lbl">Notes</label>
          <input class="form-input" type="text" id="arm-note" placeholder="Grade, état, variante..." maxlength="120"></div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeArmModal()">Annuler</button>
        <button class="btn success" onclick="saveArmItem()" style="letter-spacing:1px;">⚔ ENREGISTRER</button>
      </div>
    </div>`;
    overlay.addEventListener('click', e=>{ if(e.target===overlay) closeArmModal(); });
    document.body.appendChild(overlay);
  }
  document.getElementById('arm-modal-title').textContent = editId ? "✏ MODIFIER L'ÉQUIPEMENT" : '⚔ AJOUTER UN ÉQUIPEMENT';
  // Remplir si édition
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
  const cat = item?.cat||'arme_fps';
  set('arm-cat', cat);
  set('arm-qty',          item?.qty||1);
  set('arm-unit',         item?.unit||'unite');
  set('arm-quality',      item?.quality||'');
  set('arm-quality-exact',item?.qualityExact||'');
  set('arm-price',        item?.price||'');
  set('arm-sellprice',    item?.sellprice||'');
  set('arm-loc',          item?.loc||'');
  set('arm-note',         item?.note||'');
  set('arm-name',         item?.name||'');
  // Catégorie boutons
  selectArmCat(cat);
  // Peupler le select DB
  populateArmDbSelect(cat, item?.name||'');
  overlay.classList.add('open');
  setTimeout(()=>document.getElementById('arm-name')?.focus(), 80);
}

function closeArmModal() {
  const o = document.getElementById('arm-modal-overlay');
  if (o) o.classList.remove('open');
  _armEditId = null;
}

// Mapping catégorie → clé SC_DB
const ARM_CAT_TO_DB = { arme_fps:'fps', armure:'armor', arme_vaisseau:'shipwep', composant_vaisseau:'shipcomp' };

function selectArmCat(cat) {
  document.getElementById('arm-cat').value = cat;
  document.querySelectorAll('#arm-cat-btns .cat-sel-btn').forEach(b => {
    const on = b.dataset.armcat === cat;
    b.style.borderColor   = on ? 'var(--orange)' : 'var(--border)';
    b.style.color         = on ? 'var(--orange)' : 'var(--text-dim)';
    b.style.background    = on ? 'rgba(247,140,30,0.1)' : 'transparent';
  });
  populateArmDbSelect(cat, '');
}

function populateArmDbSelect(cat, currentName) {
  const sel = document.getElementById('arm-db-select');
  if (!sel) return;
  const dbKey = ARM_CAT_TO_DB[cat] || 'fps';

  // Fusionner SC_DB + ARMURIE_CATALOGUE pour ce tab
  const scItems     = (SC_DB[dbKey] || []).map(i => Object.assign({}, i, {_src:'scdb'}));
  const customItems = (ARMURIE_CATALOGUE || [])
    .filter(i => (i.tab||'fps') === dbKey)
    .map(i => Object.assign({}, i, {_src:'custom'}));

  // Dédoublonner : custom prioritaire sur SC_DB si même nom
  const seen = new Set();
  const merged = [];
  customItems.forEach(i => { if (i.name) { seen.add(i.name.toLowerCase()); merged.push(i); } });
  scItems.forEach(i => { if (i.name && !seen.has(i.name.toLowerCase())) merged.push(i); });
  merged.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  sel.innerHTML = '<option value="">— Catalogue Corp TELOS —</option>'
    + merged.map(i => '<option value="' + esc(i.name) + '"' + (i.name === currentName ? ' selected' : '') + '>'
        + esc(i.name) + (i._src === 'custom' ? ' \u2736' : '') + '</option>').join('');
  if (currentName) sel.value = currentName;

  // Stocker la map nom->item pour armDbSelectChange
  window._armDbMap = {};
  merged.forEach(i => { window._armDbMap[i.name] = i; });
}

function armDbSelectChange(val) {
  if (!val) return;
  // Remplir le nom
  var nameEl = document.getElementById('arm-name');
  if (nameEl) nameEl.value = val;

  // Chercher dans la map fusion SC_DB + ARMURIE_CATALOGUE
  var found = (window._armDbMap && window._armDbMap[val]) || null;
  if (!found) {
    // Fallback direct SC_DB
    var cat2 = document.getElementById('arm-cat')?.value || 'arme_fps';
    var dbKey2 = ARM_CAT_TO_DB[cat2] || 'fps';
    found = (SC_DB[dbKey2] || []).find(function(i){ return i.name === val; }) || null;
  }
  if (!found) return;

  var set = function(id, v) { var el = document.getElementById(id); if (el && v !== undefined && v !== null && String(v) !== '') el.value = v; };

  // Prix + loc toujours remplis si disponibles
  set('arm-price', found.prix || found.price || '');
  set('arm-loc',   found.loc  || '');

  // Construire une note avec les stats techniques (injectée si champ vide)
  var stats = [];
  if (found.type)       stats.push('Type : ' + found.type);
  if (found.cal)        stats.push('Cal : ' + found.cal);
  if (found.taille)     stats.push('Taille : S' + found.taille);
  if (found.dps)        stats.push('DPS : ' + found.dps + '/s');
  if (found.magazin)    stats.push('Mag : ' + found.magazin);
  if (found.fire)       stats.push('Cadence : ' + found.fire);
  if (found.tiers)      stats.push('Tier : ' + found.tiers);
  if (found.résistance) stats.push('Rés : ' + found.résistance);
  if (found.bonus)      stats.push(found.bonus);
  if (found.energie)    stats.push('Énergie : ' + found.energie + 'u');
  if (found.portée)     stats.push('Portée : ' + found.portée + 'm');
  if (found.qualité)    stats.push('Qual : ' + found.qualité);

  var noteEl = document.getElementById('arm-note');
  if (noteEl && !noteEl.value && stats.length) noteEl.value = stats.join(' · ');
}

function syncArmQualityFromExact(val) {
  const n = parseInt(val);
  const sel = document.getElementById('arm-quality');
  if (!sel) return;
  if (!val || isNaN(n)) sel.value = '';
  else if (n < 500) sel.value = 'mediocre';
  else if (n < 600) sel.value = 'basique';
  else if (n < 700) sel.value = 'acceptable';
  else if (n < 800) sel.value = 'honnete';
  else if (n < 900) sel.value = 'moyenne';
  else              sel.value = 'haute';
}

function syncArmQualityBadge() {} // placeholder

async function saveArmItem() {
  if (!SESSION || !_armSelectedPid) return;
  const name = document.getElementById('arm-name')?.value.trim();
  if (!name) { toast('Nom requis','','error'); return; }
  const isPerso = _armModalType === 'perso';
  const dbKey = isPerso ? 'uex-armory-perso-'+_armSelectedPid : 'uex-armory-'+_armSelectedPid;
  const items = (await DB.get(dbKey)) || [];
  const entry = {
    id:           _armEditId || ('arm_'+Date.now()),
    name,
    cat:          document.getElementById('arm-cat')?.value       || 'arme_fps',
    quality:      document.getElementById('arm-quality')?.value   || '',
    qualityExact: parseInt(document.getElementById('arm-quality-exact')?.value)||null,
    unit:         document.getElementById('arm-unit')?.value      || 'unite',
    qty:          parseFloat(document.getElementById('arm-qty')?.value)||1,
    price:        parseFloat(document.getElementById('arm-price')?.value)||0,
    sellprice:    parseFloat(document.getElementById('arm-sellprice')?.value)||0,
    loc:          document.getElementById('arm-loc')?.value.trim()||'',
    note:         document.getElementById('arm-note')?.value.trim()||'',
    addedAt:      _armEditId ? (items.find(x=>x.id===_armEditId)?.addedAt||new Date().toISOString()) : new Date().toISOString(),
  };
  if (_armEditId) {
    const idx = items.findIndex(x=>x.id===_armEditId);
    if (idx>=0) items[idx]=entry; else items.push(entry);
  } else {
    items.push(entry);
  }
  await DB.set(dbKey, items);
  closeArmModal();
  if (isPerso) {
    renderArmPersoTable(items);
  } else {
    await renderArmTable();
    renderArmPartnerList(document.getElementById('arm-search')?.value||'');
    updateBadges();
  }
  toast(_armEditId?'Item modifié':'Item ajouté', name, 'success');
}

async function deleteArmItem(id, name) {
  if (!_armSelectedPid || !confirm('Supprimer "'+name+'" de l\'armurerie ?')) return;
  let items = (await DB.get('uex-armory-'+_armSelectedPid)) || [];
  items = items.filter(x=>x.id!==id);
  await DB.set('uex-armory-'+_armSelectedPid, items);
  await renderArmTable();
  renderArmPartnerList(document.getElementById('arm-search')?.value||'');
  toast('Item supprimé', name, 'info');
}

async function saveGestCode(){if(!SESSION?.isAdmin)return;const c1=document.getElementById('new-gest-code')?.value.trim(),c2=document.getElementById('confirm-gest-code')?.value.trim(),msg=document.getElementById('gest-code-msg');if(!c1){if(msg){msg.textContent='Requis';msg.style.color='var(--red)';}return;}if(c1!==c2){if(msg){msg.textContent='Différents';msg.style.color='var(--red)';}return;}await DB.set('telos-gestionnaire-code-hash',await sha256(c1));if(msg){msg.textContent='✓';msg.style.color='var(--green)';}toast('Code','Mis à jour','success');}
async function toggleBpOwner(bpId, checked) {
  if (!SESSION) { toast('Connexion requise','','error'); return; }
  const pid = SESSION.pid;
  // Toujours relire depuis DB pour être sûr d'avoir l'état le plus récent
  let myBps = (await DB.get('player-blueprints-' + pid)) || [];
  if (checked) { if (!myBps.includes(bpId)) myBps.push(bpId); }
  else { myBps = myBps.filter(id => id !== bpId); }
  // Sauvegarder uniquement en DB (pas de localStorage)
  await DB.set('player-blueprints-' + pid, myBps);
  // Mettre à jour le cache mémoire
  if (!window._playerBpCache) window._playerBpCache = {};
  window._playerBpCache[pid] = myBps;
  // Mettre à jour bp.owners dans l'objet blueprint et sauvegarder
  const bp = BLUEPRINTS.find(x => x.id === bpId);
  if (bp) {
    if (!bp.owners) bp.owners = [];
    if (checked) { if (!bp.owners.includes(pid)) bp.owners.push(pid); }
    else { bp.owners = bp.owners.filter(id => id !== pid); }
    await saveBlueprints();
  }
  await renderBlueprints();
  // Badge
  const _bb = document.getElementById('badge-blueprints');
  if (_bb) { _bb.textContent = myBps.length; _bb.style.display = myBps.length > 0 ? '' : 'none'; }
  toast(checked ? '✓ Blueprint sauvegardé' : 'Blueprint retiré', bp?.name || '', checked ? 'success' : 'info');
}
async function loadPlayerOwnedBlueprints() {
  if (!SESSION) return;
  const pid = SESSION.pid;
  // Toujours depuis DB — jamais localStorage
  const myBps = (await DB.get('player-blueprints-' + pid)) || [];
  if (!window._playerBpCache) window._playerBpCache = {};
  window._playerBpCache[pid] = myBps;
  // Mettre à jour le badge
  const _bb = document.getElementById('badge-blueprints');
  if (_bb) { _bb.textContent = myBps.length; _bb.style.display = myBps.length > 0 ? '' : 'none'; }
  return myBps;
}
async function loadAllPlayerBpCounts(){window._playerBpCache=window._playerBpCache||{};for(const p of players){if(!window._playerBpCache[p.id]){const bps=(await DB.get('player-blueprints-'+p.id))||[];window._playerBpCache[p.id]=bps;}}}
var UEX_PRICE_MAP={'Agricium':9700,'Agricultural Supplies':1400,'Aluminum':3700,'Ammonia':1000,'Aphorite':101100,'Argon':446,'Aslarite':5100,'Astatine':3500,'Atlasium':91900,'Beradom':144200,'Beryl':19900,'Bexalite':28800,'Bioplastic':7600,'Borase':27600,'Carbon':357,'Carbon Silk':20800,'CK13 Gid Seed Blend':533,'Chlorine':1500,'Cobalt':20800,'Compboard':29600,'Construction Materials':12500,'Copper':3700,'Corundum':3700,'DCSR2':1200,'Degnous Root':60300,'Diamond Laminate':87300,'Diamond':7500,'Distilled Spirits':1900,'Dolivine':146300,'Dymantium':22800,'Dynaflex':1900,'Etam':23200,'Feynmaline':341500,'Fresh Food':24800,'Fluorine':1300,'Foam':6300,'Gasping Weevil Eggs':63900,'Glacosite':98600,'Gold':30000,'Golden Medmon':59200,'Hadanite':544300,'Heart Of The Woods':35800,'Helium':1000,'Hephaestanite':4600,'Human Food Bars':487,'Hydrogen Fuel':180,'Hydrogen':1000,'Iodine':11500,'Iron':3400,'Janalite':2900000,'Kopion Horn':35500,'Laranite':8600,'Lindinium':47000,'Marok Gem':52900,'Maze':230000,'Medical Supplies':5200,'Mercury':1000,'Methane':3600,'Neograph':93900,'Neon':18500,'Nitrogen':3000,'Omnapoxy':4600,'Organics':12800,'Osoian Hides':870000,'Ouratite':42300,'Partillium':89900,'Pitambu':60300,'Potassium':569,'Processed Food':1400,'Prota':62400,'Quantanium':150400,'Quantum Fuel':928,'Quartz':4300,'Recycled Material Composite':7200,'Revenant Pod':9600,'Revenant Tree Pollen':1200,'Riccite':67900,'Sadaryx':500000,'Savrilium':123200,'Scrap':3500,'Silicon':2400,'Slam':37900,'Steel':2000,'Stileron':136700,'Stims':5400,'Sunset Berries':82100,'Taranite':25800,'Tin':4000,'Titanium':8100,'Torite':7700,'Tritium':33300,'Tungsten':10300,'Waste':342,'Widow':7400,'Xapyen':4800};
function getUexTier(n){const p=typeof n==='number'?n:(UEX_PRICE_MAP[n]||0);if(!p)return null;if(p<500)return{key:'vente',label:'🔴 Vente directe',color:'#ef4444',range:'< 500'};if(p<600)return{key:'craft_vaisseau',label:'🟢 500<',color:'var(--green)',range:'500–600'};return{key:'craft_fps',label:'🟢 500<',color:'var(--green)',range:'600+'};}
var ROLE_COLORS_DEFAULT={Trader:'#60a5fa',Mineur:'#f79028',Transporteur:'#00ffa3',Explorateur:'#a78bfa',Gestionnaire:'#ff4444'};
var ROLE_COLORS_POOL=['#60a5fa','#f79028','#00ffa3','#a78bfa','#ff4444','#59d0ff','#f472b6','#a3e635','#fb923c','#34d399'];
var ROLE_COLORS = new Proxy({}, { get(t,k){
  // Priorité : couleur custom → défaut → pool
  return (typeof ROLES_COLORS_CUSTOM !== 'undefined' && ROLES_COLORS_CUSTOM[k])
    || ROLE_COLORS_DEFAULT[k]
    || ROLE_COLORS_POOL[ROLES.indexOf(k) % ROLE_COLORS_POOL.length]
    || '#aaaaaa';
}});

function startAutoSave() { /* Supabase gère la persistance automatiquement */ }

/* ════ Blueprint table event delegation ════ */
document.addEventListener('change', function(e) {
  if (e.target.classList.contains('bp-own-cb')) {
    const bpId = e.target.dataset.bpid;
    if (bpId) toggleBpOwner(bpId, e.target.checked);
  }
});
document.addEventListener('click', function(e) {
  const delBtn = e.target.closest('[data-delbp]');
  if (delBtn) {
    const bpId = delBtn.dataset.delbp;
    if (bpId) deleteBlueprint(bpId);
  }
});

// ── REALTIME SYNC ────────────────────────────────────────────────────────────
var _realtimeChannel = null;

function _getActivePanel() {
  var p = document.querySelector('.panel.active');
  return p ? p.id.replace('panel-', '') : null;
}

async function _reloadForKey(key) {
  var panel = _getActivePanel();

  if (key === 'uex-players' || key.startsWith('uex-stocks-') || key.startsWith('uex-armory-')) {
    players = (await DB.get('uex-players')) || [];
    if (panel === 'joueurs')    { renderGlobal(); updateGlobalFilter(); }
    if (panel === 'stocks')     { renderStocksFromPlayers(); }
    if (panel === 'partners')   { renderPartners(); }
    if (panel === 'hub')        { renderHubBankStats(); renderActivity(); }
  }
  if (key === 'telos-bank' || key === 'telos-profit-history') {
    await loadBankData();
    await loadProfitHistory();
    if (panel === 'banque')     { renderBanque(); }
    if (panel === 'hub')        { renderHubBankStats(); drawChart(7); }
  }
  if (key === 'telos-commandes') {
    await loadCommandes();
    if (panel === 'commandes')  { renderCommandes(); }
    if (panel === 'hub')        { renderActivity(); }
  }
  if (key === 'telos-missions') {
    await loadMissions();
    if (panel === 'missions')   { renderMissions(); }
    if (panel === 'hub')        { renderActivity(); }
  }
  if (key === 'telos-objectifs') {
    await loadObjectifs();
    if (panel === 'objectifs')  { renderObjectifs(); }
  }
  if (key === 'telos-armurie-custom') {
    await loadArmurieCatalogue();
    if (panel === 'armurie')    { renderArmurie(); }
  }
  if (key === 'telos-historique') {
    HISTORIQUE_DATA = (await DB.get('telos-historique')) || [];
    if (panel === 'logs')       { renderFullLogs(); }
    if (panel === 'hub')        { renderActivity(); renderSysLogs(); }
  }
  if (key === 'telos-ressource-catalogue') {
    await loadRessourceCatalogue();
    if (panel === 'ressources') { renderRessources().catch(()=>{}); }
  }

  updateBadges && updateBadges();
  renderTopRes && renderTopRes();
}

function startRealtimeSync() {
  var sb = getSB();
  if (!sb || !sb.channel) {
    console.warn('[TELOS Realtime] Supabase non disponible.');
    return;
  }
  if (_realtimeChannel) { try { sb.removeChannel(_realtimeChannel); } catch(e) {} }

  _realtimeChannel = sb
    .channel('telos_store_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'telos_store' },
      function(payload) {
        var key = payload?.new?.key || payload?.old?.key;
        if (!key) return;
        var lastOwn = window._lastOwnWrite && window._lastOwnWrite[key];
        if (lastOwn && Date.now() - lastOwn < 3000) return;
        console.log('[TELOS Realtime] Changement détecté :', key);
        _reloadForKey(key);
      }
    )
    .subscribe(function(status) {
      if (status === 'SUBSCRIBED')
        console.log('[TELOS Realtime] Synchronisation en temps réel active.');
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR')
        setTimeout(startRealtimeSync, 5000);
    });
}

var _origDBset = DB.set.bind(DB);
DB.set = async function(key, value) {
  if (!window._lastOwnWrite) window._lastOwnWrite = {};
  window._lastOwnWrite[key] = Date.now();
  return _origDBset(key, value);
};

async function init(){
  await testSupabaseConnection();
  startRealtimeSync();
  // Clock
  tick(); setInterval(tick,1000);
  // Static renders
  renderTopRes(); renderPrices(); renderActivity(); renderSysLogs(); renderFullLogs();
  renderCommerce();
  await loadMissions();
  await loadRessourceCatalogue();
  await loadArmurieCatalogue();
  await loadObjectifs();
  await loadCommandes();
  await loadBlueprints();
  await refreshDatalist(); // Pré-remplir la datalist au démarrage
  await loadProfitHistory();
  drawChart(7);
  // Live prices
  setInterval(fluctuate,8500);
  // Load players from persistent storage
  players=(await DB.get('uex-players'))||[];
  // Migration : supprimer les avatars URL http (gardez seulement base64 et emoji)
  var _avatarFixed = false;
  players.forEach(p => {
    if (p.avatar && (p.avatar.startsWith('http://') || p.avatar.startsWith('https://'))) {
      p.avatar = null;
      _avatarFixed = true;
    }
  });
  if (_avatarFixed) await DB.set('uex-players', players);
  await loadRolesConfig();
  updateNavBanque && updateNavBanque();
  await loadBankData();
  renderHubBankStats();
  renderPlayerList();
  updateBadges();
  updateGlobalFilter();
  // Panels alimentés par les joueurs
  renderStocksFromPlayers();
  renderPartners();

  // Init hub canvas after layout
  setTimeout(() => {
    const c = document.getElementById('stanton-canvas');
    if (c) { c.width = c.offsetWidth; c.height = c.offsetHeight; initMap(c); c._inited = true; }
  }, 80);

  // Rafraîchir les "il y a X min" du feed d'activité
  setInterval(renderActivity, 60000);
  requestAnimationFrame(loop);
  renderAuthBar();
  startAutoSave();
  setTimeout(()=>toast('UEE NETWORK ONLINE','Synchronisation sécurisée établie.','success'),600);
  setTimeout(()=>toast('⚠ 3 alertes actives','Consultez le panneau Alertes.','warn'),1800);
}

window.addEventListener('DOMContentLoaded',()=>{init().catch(e=>console.error('[TELOS]',e));});

// ── Resize handler unique ─────────────────────────────────
(function() {
  function syncCanvas(c) {
    if (!c) return;
    const w = c.offsetWidth, h = c.offsetHeight;
    if (w < 10 || h < 10) return;
    if (c.width !== w || c.height !== h) {
      c.width = w; c.height = h;
      c._inited = false; // force re-init dans loop()
    }
  }
  function syncAll() {
    syncCanvas(document.getElementById('stanton-canvas'));
    syncCanvas(document.getElementById('map-canvas-full'));
    drawChart(chartDays);
  }

  // ResizeObserver (moderne)
  if (window.ResizeObserver) {
    const obs = new ResizeObserver(() => syncAll());
    document.addEventListener('DOMContentLoaded', () => {
      ['stanton-canvas','map-canvas-full'].forEach(id => {
        const el = document.getElementById(id);
        if (el) obs.observe(el);
      });
      const hubLeft = document.querySelector('.hub-left');
      if (hubLeft) obs.observe(hubLeft);
    });
  }

  // Fallback window resize
  let _rt;
  window.addEventListener('resize', () => { clearTimeout(_rt); _rt = setTimeout(syncAll, 80); });
  window.addEventListener('orientationchange', () => setTimeout(syncAll, 200));
})();

/* ════════════════════════════════════════════════════════════
   BANQUE TELOS — Trésorerie de la corporation
════════════════════════════════════════════════════════════ */
var BANK_DATA = [];        // Toutes les transactions
var _bankTab = 'transactions';
var _bankPage = 1;
var _bankPerPage = 15;
var _bankEditId = null;

var BANK_CAT_META = {
  don:       { label:'💰 Don',         color:'var(--green)'  },
  depense:   { label:'📤 Dépense',     color:'var(--red)'    },
  commerce:  { label:'💹 Commerce',    color:'#60a5fa'       },
  craft:     { label:'🔧 Craft',       color:'var(--orange)' },
  recompense:{ label:'🎖 Récompense',  color:'#f59e0b'       },
  penalite:  { label:'⚠ Pénalité',    color:'var(--red)'    },
  autre:     { label:'○ Autre',        color:'var(--text-dim)'},
};

async function loadBankData() {
  BANK_DATA = (await DB.get('telos-bank')) || [];
}
async function saveBankData() {
  await DB.set('telos-bank', BANK_DATA);
  renderHubBankStats && renderHubBankStats();
}

// ── Visiblité nav banque ──
function updateNavBanque() {
  const el = document.getElementById('nav-banque');
  if (el) el.style.display = (SESSION && hasDroit('banque')) ? '' : 'none';
}

// ── Onglets ──
function setBankTab(tab, btn) {
  _bankTab = tab;
  // Sécuriser les boutons tab
  document.querySelectorAll('.bank-tab').forEach(b => {
    b.style.color = 'var(--text-dim)';
    b.style.borderBottomColor = 'transparent';
  });
  if (btn) { btn.style.color = 'var(--text-bright)'; btn.style.borderBottomColor = 'var(--orange)'; }
  const activeBtnEl = document.getElementById('btab-'+tab);
  if (activeBtnEl) { activeBtnEl.style.color = 'var(--text-bright)'; activeBtnEl.style.borderBottomColor = 'var(--orange)'; }
  ['transactions','membres','stats'].forEach(t => {
    const p = document.getElementById('bank-panel-'+t);
    const b = document.getElementById('btab-'+t);
    if (p) p.style.display = t===tab ? (t==='transactions'?'flex':'block') : 'none';
    if (b) { b.classList.toggle('active', t===tab); b.style.color=t===tab?'var(--text-bright)':'var(--text-dim)'; b.style.borderBottomColor=t===tab?'var(--orange)':'transparent'; }
  });
  if (tab==='transactions') renderBankTransactions();
  if (tab==='membres')      renderBankMembres();
  if (tab==='stats') {
    if (!SESSION) {
      // Non connecté → afficher message d'accès refusé dans le panel
      const sp = document.getElementById('bank-panel-stats');
      if (sp) sp.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;color:var(--text-dim);">
        <div style="font-size:32px;">🔒</div>
        <div style="font-family:var(--mono);font-size:11px;letter-spacing:2px;color:var(--orange);">ACCÈS RESTREINT</div>
        <div style="font-size:12px;color:var(--text-dim);text-align:center;">Connectez-vous pour consulter les statistiques.</div>
        <button class="btn primary" onclick="openLoginModal()" style="margin-top:6px;padding:8px 22px;letter-spacing:1px;font-size:11px;">SE CONNECTER</button>
      </div>`;
      return;
    }
    renderBankStats();
  }
}

function resetBankFilters() {
  ['bank-date-from','bank-date-to','bank-cat-filter','bank-type-filter','bank-search'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  renderBankTransactions();
}

// ── Rendu principal banque ──
function renderBanque() {
  // Contrôle d'accès sur le bouton Nouvelle Transaction
  const btnTx = document.getElementById('btn-new-transaction');
  if (btnTx) btnTx.style.display = hasDroit('add_transaction') ? '' : 'none';
  renderBankKPI();
  setBankTab(_bankTab, document.getElementById('btab-'+_bankTab));
}

function renderBankKPI() {
  const el = document.getElementById('bank-kpi');
  if (!el) return;
  const now = Date.now();
  const d7  = now - 7*24*3600*1000;
  const credits7 = BANK_DATA.filter(t=>t.type==='credit'&&new Date(t.date).getTime()>=d7).reduce((s,t)=>s+(t.amount||0),0);
  const debits7  = BANK_DATA.filter(t=>t.type==='debit' &&new Date(t.date).getTime()>=d7).reduce((s,t)=>s+(t.amount||0),0);
  const total    = BANK_DATA.reduce((s,t)=>s+(t.type==='credit'?1:-1)*(t.amount||0),0);
  const todayStr = new Date().toISOString().slice(0,10);
  const txToday  = BANK_DATA.filter(t=>t.date?.slice(0,10)===todayStr).length;
  // Update total
  const tot = document.getElementById('bank-total');
  if (tot) tot.textContent = Math.round(total).toLocaleString('fr-FR')+' aUEC';
  const kpiData = [
    { label:'Revenus (7j)', val:'+'+Math.round(credits7).toLocaleString('fr-FR')+' aUEC', color:'var(--green)', sub: BANK_DATA.filter(t=>t.type==='credit'&&new Date(t.date).getTime()>=d7).length+' transactions' },
    { label:'Dépenses (7j)', val:'-'+Math.round(debits7).toLocaleString('fr-FR')+' aUEC', color:'var(--red)', sub: BANK_DATA.filter(t=>t.type==='debit'&&new Date(t.date).getTime()>=d7).length+' transactions' },
    { label:"Aujourd'hui", val:txToday+' tx', color:'var(--blue)', sub: txToday>0?'Dernière à '+BANK_DATA.filter(t=>t.date?.slice(0,10)===todayStr).at(-1)?.date?.slice(11,16)||'—':'Aucune' },
    { label:'Total transactions', val:BANK_DATA.length.toLocaleString('fr-FR'), color:'var(--text-bright)', sub:'Depuis la création' },
  ];
  el.innerHTML = kpiData.map(k=>`
    <div style="padding:12px 20px;border-right:1px solid var(--border);min-width:180px;flex-shrink:0;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px;">${k.label}</div>
      <div style="font-size:18px;font-weight:700;color:${k.color};font-family:var(--mono);">${k.val}</div>
      <div style="font-size:9px;color:var(--text-dim);margin-top:2px;">${k.sub}</div>
    </div>`).join('');
}

// ── Transactions ──
function getBankFiltered() {
  const search   = (document.getElementById('bank-search')?.value||'').toLowerCase();
  const cat      = document.getElementById('bank-cat-filter')?.value||'';
  const type     = document.getElementById('bank-type-filter')?.value||'';
  const dateFrom = document.getElementById('bank-date-from')?.value||'';
  const dateTo   = document.getElementById('bank-date-to')?.value||'';
  return BANK_DATA.filter(t => {
    if (search && !( (t.desc||'').toLowerCase().includes(search) || (t.member||'').toLowerCase().includes(search) )) return false;
    if (cat  && t.cat  !== cat)  return false;
    if (type && t.type !== type) return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo   && t.date > dateTo+'T23:59') return false;
    return true;
  }).sort((a,b) => (b.date||'').localeCompare(a.date||''));
}

function renderBankTransactions() {
  const container = document.getElementById('bank-tx-cards');
  const empty     = document.getElementById('bank-empty');
  const countEl   = document.getElementById('bank-count');
  if (!container) return;

  const data  = getBankFiltered();
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / _bankPerPage));
  if (_bankPage > pages) _bankPage = 1;
  const slice = data.slice((_bankPage - 1) * _bankPerPage, _bankPage * _bankPerPage);

  if (countEl) countEl.textContent = total ? `${(_bankPage-1)*_bankPerPage+1}–${Math.min(_bankPage*_bankPerPage,total)} sur ${total} transactions` : '';

  if (!slice.length) { container.innerHTML = ''; empty.style.display = 'block'; renderBankPagination(0, 0); return; }
  empty.style.display = 'none';

  const catMeta    = cat => BANK_CAT_META[cat] || { label: cat, color: 'var(--text-dim)', icon: '○' };
  const memberName = mid => { const p = players.find(x => x.id === mid); return p ? p.name : (mid || 'Système'); };

  container.innerHTML = `
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:2px solid var(--border);">
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;white-space:nowrap;">Date</th>
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Description</th>
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Membre</th>
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Catégorie</th>
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Type</th>
        <th style="text-align:right;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Montant</th>
        <th style="padding:7px 8px;width:36px;"></th>
      </tr>
    </thead>
    <tbody>
      ${slice.map(t => {
        const cm       = catMeta(t.cat);
        const isCredit = t.type === 'credit';
        const amt      = (isCredit ? '+' : '−') + Math.round(t.amount || 0).toLocaleString('fr-FR') + ' aUEC';
        const dateObj  = t.date ? new Date(t.date) : null;
        const dateStr  = dateObj ? dateObj.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';
        const timeStr  = dateObj ? dateObj.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '';
        const mName    = memberName(t.memberId);
        const accentCol = isCredit ? 'var(--green)' : 'var(--red)';
        return `<tr class="bank-row"
          onclick="openBankDetail('${t.id}')"
          style="border-bottom:1px solid var(--border);transition:background 0.1s;">
          <!-- Indicateur + date -->
          <td style="padding:10px 12px;white-space:nowrap;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:3px;height:32px;border-radius:2px;background:${accentCol};flex-shrink:0;"></div>
              <div>
                <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--text-bright);">${dateStr}</div>
                <div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);">${timeStr}</div>
              </div>
            </div>
          </td>
          <!-- Description -->
          <td style="padding:10px 12px;max-width:260px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.desc||'—')}</div>
            ${t.note ? `<div style="font-size:10px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic;margin-top:2px;">${esc(t.note)}</div>` : ''}
          </td>
          <!-- Membre -->
          <td style="padding:10px 12px;white-space:nowrap;">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:22px;height:22px;border-radius:50%;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--orange);flex-shrink:0;">${mName.charAt(0).toUpperCase()}</div>
              <span style="font-size:11px;color:var(--text-dim);">${esc(mName)}</span>
            </div>
          </td>
          <!-- Catégorie -->
          <td style="padding:10px 12px;white-space:nowrap;">
            <span style="font-size:10px;padding:2px 8px;border:1px solid var(--border);color:${cm.color};letter-spacing:0.5px;">${cm.icon} ${cm.label}</span>
          </td>
          <!-- Type -->
          <td style="padding:10px 12px;white-space:nowrap;">
            <span style="font-size:10px;padding:2px 8px;border:1px solid ${accentCol}33;color:${accentCol};letter-spacing:1px;font-family:var(--ui);">${isCredit?'↑ CRÉDIT':'↓ DÉBIT'}</span>
          </td>
          <!-- Montant -->
          <td style="padding:10px 12px;text-align:right;white-space:nowrap;">
            <div style="font-size:15px;font-weight:700;font-family:var(--mono);color:${accentCol};">${amt}</div>
          </td>
          <!-- Supprimer -->
          <td style="padding:10px 8px;text-align:center;" onclick="event.stopPropagation()">
            ${canManageRoles()
              ? `<button onclick="event.stopPropagation();deleteBankTransaction('${t.id}')"
                   style="padding:3px 7px;border:1px solid rgba(255,68,68,0.3);background:transparent;color:rgba(255,68,68,0.6);font-size:11px;cursor:pointer;opacity:0.6;" title="Supprimer"
                   onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">🗑</button>`
              : ''}
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;

  renderBankPagination(total, pages);
}

function renderBankPagination(total, pages) {
  const el = document.getElementById('bank-pagination');
  if (!el) return;
  if (pages <= 1) { el.innerHTML=''; return; }
  let html = '';
  // Afficher N par page
  html += `<select class="form-input" style="width:80px;padding:4px 8px;font-size:11px;height:auto;" onchange="_bankPerPage=parseInt(this.value);_bankPage=1;renderBankTransactions()">
    ${[10,15,25,50].map(n=>`<option value="${n}" ${_bankPerPage===n?'selected':''}>${n}</option>`).join('')}
  </select><span style="font-size:10px;color:var(--text-dim);">par page</span>`;
  html += `<button class="bank-pg-btn" onclick="_bankPage=1;renderBankTransactions()">«</button>`;
  html += `<button class="bank-pg-btn" onclick="_bankPage=Math.max(1,_bankPage-1);renderBankTransactions()">‹</button>`;
  // Pages
  const range = [];
  for (let i=1;i<=pages;i++) {
    if (i<=2||i>=pages-1||Math.abs(i-_bankPage)<=1) range.push(i);
    else if (range[range.length-1]!=='…') range.push('…');
  }
  range.forEach(p => {
    if (p==='…') html+='<span style="color:var(--text-dim);padding:0 4px;">…</span>';
    else html+=`<button class="bank-pg-btn ${p===_bankPage?'active':''}" onclick="_bankPage=${p};renderBankTransactions()">${p}</button>`;
  });
  html += `<button class="bank-pg-btn" onclick="_bankPage=Math.min(${pages},_bankPage+1);renderBankTransactions()">›</button>`;
  html += `<button class="bank-pg-btn" onclick="_bankPage=${pages};renderBankTransactions()">»</button>`;
  html += `<span style="margin-left:auto;font-size:10px;color:var(--text-dim);">${_bankPage*_bankPerPage-_bankPerPage+1}-${Math.min(_bankPage*_bankPerPage,total)} sur ${total}</span>`;
  el.innerHTML = html;
}

// ── Membres ──
function renderBankMembres() {
  const el = document.getElementById('bank-membres-list');
  if (!el) return;
  const byMember = {};
  BANK_DATA.forEach(t => {
    const mid = t.memberId||'';
    if (!byMember[mid]) byMember[mid] = { id:mid, credits:0, debits:0, count:0 };
    if (t.type==='credit') byMember[mid].credits += t.amount||0;
    else                   byMember[mid].debits  += t.amount||0;
    byMember[mid].count++;
  });
  const sorted = Object.values(byMember).sort((a,b)=>b.credits-a.credits);
  if (!sorted.length) { el.innerHTML='<div style="color:var(--text-dim);padding:20px;">Aucune donnée.</div>'; return; }
  el.innerHTML = sorted.map(m => {
    const p = players.find(x=>x.id===m.id);
    const name = p?.name || m.id || 'Système';
    const net = m.credits - m.debits;
    return `<div class="bank-member-card">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:var(--bg2);border:1px solid var(--orange);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--orange);">${name.charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-bright);">${esc(name)}</div>
          <div style="font-size:9px;color:var(--text-dim);">${m.count} transaction${m.count>1?'s':''}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:4px;">
        <div><div style="font-size:9px;color:var(--text-dim);">Contributions</div><div style="font-size:13px;color:var(--green);font-family:var(--mono);">+${Math.round(m.credits).toLocaleString('fr-FR')}</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Dépenses</div><div style="font-size:13px;color:var(--red);font-family:var(--mono);">-${Math.round(m.debits).toLocaleString('fr-FR')}</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Solde net</div><div style="font-size:13px;color:${net>=0?'var(--green)':'var(--red)'};font-family:var(--mono);">${net>=0?'+':''}${Math.round(net).toLocaleString('fr-FR')}</div></div>
      </div>
    </div>`;
  }).join('');
}

// ── Statistiques ──
function renderBankStats() {
  const el = document.getElementById('bank-stats-content');
  if (!el) return;
  const byCat = {};
  BANK_DATA.forEach(t => {
    if (!byCat[t.cat]) byCat[t.cat] = { credits:0, debits:0, count:0 };
    if (t.type==='credit') byCat[t.cat].credits += t.amount||0;
    else                   byCat[t.cat].debits  += t.amount||0;
    byCat[t.cat].count++;
  });
  const totalCredits = BANK_DATA.filter(t=>t.type==='credit').reduce((s,t)=>s+(t.amount||0),0);
  const totalDebits  = BANK_DATA.filter(t=>t.type==='debit').reduce((s,t)=>s+(t.amount||0),0);
  const balance = totalCredits - totalDebits;
  el.innerHTML = `
    <div class="bank-stat-card" style="grid-column:span 2;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);margin-bottom:12px;">BILAN GLOBAL</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        <div><div style="font-size:9px;color:var(--text-dim);">Total crédits</div><div style="font-size:20px;color:var(--green);font-family:var(--mono);font-weight:700;">+${Math.round(totalCredits).toLocaleString('fr-FR')} aUEC</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Total débits</div><div style="font-size:20px;color:var(--red);font-family:var(--mono);font-weight:700;">-${Math.round(totalDebits).toLocaleString('fr-FR')} aUEC</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Solde net</div><div style="font-size:20px;color:${balance>=0?'var(--green)':'var(--red)'};font-family:var(--mono);font-weight:700;">${balance>=0?'+':''}${Math.round(balance).toLocaleString('fr-FR')} aUEC</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Transactions</div><div style="font-size:20px;color:var(--text-bright);font-family:var(--mono);font-weight:700;">${BANK_DATA.length}</div></div>
      </div>
    </div>
    ${Object.entries(byCat).sort((a,b)=>b[1].credits+b[1].debits-a[1].credits-a[1].debits).map(([cat,d])=>{
      const cm = BANK_CAT_META[cat]||{label:cat,color:'var(--text-dim)'};
      return `<div class="bank-stat-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:12px;color:\${cm.color};">\${cm.label}</span>
          <span style="font-size:10px;color:var(--text-dim);">\${d.count} tx</span>
        </div>
        <div style="font-size:13px;color:var(--green);font-family:var(--mono);">+\${Math.round(d.credits).toLocaleString('fr-FR')}</div>
        <div style="font-size:13px;color:var(--red);font-family:var(--mono);">-\${Math.round(d.debits).toLocaleString('fr-FR')}</div>
      </div>`;
    }).join('')}`;
}

// ── Detail / suppression ──
function openBankDetail(id) { /* futur : modal détail */ }

async function deleteBankTransaction(id) {
  const t = BANK_DATA.find(x=>x.id===id);
  if (!t||!confirm('Supprimer cette transaction ?')) return;
  BANK_DATA = BANK_DATA.filter(x=>x.id!==id);
  await saveBankData();
  renderBanque();
  toast('Transaction supprimée','','info');
}

// ── Modal nouvelle transaction ──
// ── Modal nouvelle transaction ──
function setBtType(type) {
  document.getElementById('bt-type').value = type;
  const btnC = document.getElementById('bt-btn-credit');
  const btnD = document.getElementById('bt-btn-debit');
  const saveBtn = document.getElementById('bt-save-btn');
  if (type === 'credit') {
    btnC.style.background='rgba(0,255,163,0.18)'; btnC.style.color='var(--green)';
    btnD.style.background='transparent'; btnD.style.color='var(--text-dim)';
    if(saveBtn){saveBtn.style.borderColor='var(--green)';saveBtn.style.color='var(--green)';saveBtn.style.background='rgba(0,255,163,0.08)';}
  } else {
    btnD.style.background='rgba(255,68,68,0.18)'; btnD.style.color='var(--red)';
    btnC.style.background='transparent'; btnC.style.color='var(--text-dim)';
    if(saveBtn){saveBtn.style.borderColor='var(--red)';saveBtn.style.color='var(--red)';saveBtn.style.background='rgba(255,68,68,0.08)';}
  }
}

function closeBankTransaction() {
  document.getElementById('bt-overlay').classList.remove('open');
  _bankEditId = null;
}

function openBankTransaction(editId) {
  if (!editId && !hasDroit('add_transaction')) {
    toast('Accès refusé', 'Votre rôle ne permet pas de créer une transaction.', 'error');
    return;
  }
  _bankEditId = editId||null;
  const t = editId ? BANK_DATA.find(x=>x.id===editId) : null;
  // Peupler le select membres
  const mSel = document.getElementById('bt-member');
  if (mSel) mSel.innerHTML = '<option value="">— Aucun / Système —</option>'
    + players.map(p=>`<option value="${p.id}"${t?.memberId===p.id?' selected':''}>${esc(p.name)}</option>`).join('');
  // Pré-remplir
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
  set('bt-amount', t?.amount ||'');
  set('bt-desc',   t?.desc   ||'');
  set('bt-note',   t?.note   ||'');
  set('bt-cat',    t?.cat    ||'don');
  set('bt-date',   t?.date?.slice(0,16)||new Date().toISOString().slice(0,16));
  // Init boutons type
  setBtType(t?.type||'credit');
  // Titre
  const title = document.getElementById('bt-modal-title');
  if (title) title.textContent = editId ? '✏ MODIFIER LA TRANSACTION' : '💳 NOUVELLE TRANSACTION';
  document.getElementById('bt-overlay').classList.add('open');
}

async function saveBankTransaction() {
  if (!_bankEditId && !hasDroit('add_transaction')) {
    toast('Accès refusé', 'Votre rôle ne permet pas de créer une transaction.', 'error');
    return;
  }
  const memberId = document.getElementById('bt-member')?.value||'';
  const amount   = parseFloat(document.getElementById('bt-amount')?.value)||0;
  const desc     = document.getElementById('bt-desc')?.value.trim()||'';
  if (!desc)   { toast('Description requise','','error'); return; }
  if (!amount) { toast('Montant requis','','error'); return; }
  const entry = {
    id:       _bankEditId||('btx_'+Date.now()),
    memberId,
    type:     document.getElementById('bt-type')?.value||'credit',
    amount:   Math.abs(amount),
    desc,
    note:     document.getElementById('bt-note')?.value.trim()||'',
    cat:      document.getElementById('bt-cat')?.value||'don',
    date:     document.getElementById('bt-date')?.value||new Date().toISOString().slice(0,16),
    createdBy:SESSION?.pid||'',
  };
  if (_bankEditId) BANK_DATA = BANK_DATA.map(x=>x.id===_bankEditId?entry:x);
  else BANK_DATA.unshift(entry);
  await saveBankData();
  document.getElementById('bt-overlay').classList.remove('open');
  renderBanque();
  const memberName = players.find(p=>p.id===memberId)?.name||'Système';
  pushActivity('🏦', (_bankEditId?'Transaction modifiée':'Nouvelle transaction banque')+' : '+desc, (entry.type==='credit'?'+':'-')+Math.round(amount).toLocaleString('fr-FR')+' aUEC', true);
  toast(_bankEditId?'Transaction modifiée':'Transaction enregistrée', desc, 'success');
  _bankEditId = null;
}

