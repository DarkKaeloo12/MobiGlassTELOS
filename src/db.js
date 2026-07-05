/* ════════════════════════════════════════════════════════════
   DB — client Supabase, sync offline, realtime, bootstrap init()
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:389] _autoSaveTimer
var _autoSaveTimer = null;

/* ════ DATABASE — Supabase ════ */
// SUPABASE_URL et SUPABASE_KEY définis dans config/config.js

// [source main.js:393] _sb
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


// [source main.js:417] getSB
function getSB(){if(_sb)return _sb;try{const{createClient}=window.supabase;_sb=createClient(SUPABASE_URL,SUPABASE_KEY);}catch(e){}return _sb;}
// ══ SYSTÈME DE STOCKAGE — Supabase prioritaire, localStorage fallback ══════
// Sérialise proprement pour éviter DataCloneError

// [source main.js:420] _dbSerialize
function _dbSerialize(v) {
  try { return JSON.parse(JSON.stringify(v)); }
  catch(e) { console.warn('[DB] Sérialisation échouée:', e?.message); return null; }
}

// Clé de marquage des entrées localStorage à synchroniser

// [source main.js:426] _DB_OFFLINE_KEY
var _DB_OFFLINE_KEY = 'telos_offline_pending';


// [source main.js:428] _dbMarkPending
function _dbMarkPending(k) {
  try {
    const pending = JSON.parse(localStorage.getItem(_DB_OFFLINE_KEY)||'[]');
    if (!pending.includes(k)) { pending.push(k); localStorage.setItem(_DB_OFFLINE_KEY, JSON.stringify(pending)); }
  } catch(e) {}
}

// [source main.js:434] _dbUnmarkPending
function _dbUnmarkPending(k) {
  try {
    const pending = JSON.parse(localStorage.getItem(_DB_OFFLINE_KEY)||'[]');
    const filtered = pending.filter(x=>x!==k);
    localStorage.setItem(_DB_OFFLINE_KEY, JSON.stringify(filtered));
  } catch(e) {}
}

// Sync automatique : vide le localStorage → Supabase quand la connexion est rétablie

// [source main.js:443] syncLocalStorageToSupabase
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


// [source main.js:477] DB
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

// [source main.js:7446] resetAll
async function resetAll() {
  // Sauvegarde préalable avant reset
  await exportData();
  const existingPlayers = (await DB.get('uex-players')) || [];
  for (const p of existingPlayers) { await DB.del('uex-stocks-' + p.id); }
  await DB.set('uex-players', []);
  players = [];
  pushLog('system','SYSTEM','Reset complet — sauvegarde exportée avant suppression.');
}



// [source main.js:7457] testSupabaseConnection
async function testSupabaseConnection(){try{const sb=getSB();if(!sb)throw new Error('no client');const{error}=await sb.from('telos_store').select('key').limit(1);if(error)throw new Error(error.message);console.log('[TELOS] ✅ Supabase connecté');return true;}catch(e){console.warn('[TELOS] ⚠',e.message);return false;}}

// [source main.js:7458] migrateLocalStorageToSupabase
async function migrateLocalStorageToSupabase(){const btn=document.getElementById('btn-migrate'),status=document.getElementById('migrate-status');if(btn){btn.disabled=true;btn.textContent='⏳...';}const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('telos_'))keys.push(k.slice(6));}if(!keys.length){if(status)status.textContent='⚠ Aucune donnée';if(btn){btn.disabled=false;btn.textContent='📤 MIGRER';}return;}let done=0;for(const k of keys){try{const r=localStorage.getItem('telos_'+k);if(r){await DB.set(k,JSON.parse(r));done++;}}catch(e){}if(status)status.textContent=done+'/'+keys.length;}if(status)status.textContent='✅ '+done+' migrées';if(btn){btn.disabled=false;btn.textContent='✅ MIGRÉ';}toast('Migration',done+' clés migrées','success');}

// [source main.js:7459] testSupabaseWrite
async function testSupabaseWrite(){const el=document.getElementById('supa-write-status');if(el)el.textContent='⏳...';try{const sb=getSB();if(!sb)throw new Error('no client');const tk='_t'+Date.now();const{error:we}=await sb.from('telos_store').upsert({key:tk,value:{t:1},updated_at:new Date().toISOString()},{onConflict:'key'});if(we)throw new Error(we.message);const{data,error:re}=await sb.from('telos_store').select('value').eq('key',tk).maybeSingle();if(re||!data)throw new Error('lecture échouée');await sb.from('telos_store').delete().eq('key',tk);if(el){el.textContent='✅ OK';el.style.color='var(--green)';}toast('Supabase OK','Fonctionne','success');}catch(e){if(el){el.textContent='❌ '+e.message;el.style.color='var(--red)';}toast('Erreur',e.message,'error');}}

// [source main.js:8490] startAutoSave
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

// [source main.js:8508] _realtimeChannel
var _realtimeChannel = null;


// [source main.js:8510] _getActivePanel
function _getActivePanel() {
  var p = document.querySelector('.panel.active');
  return p ? p.id.replace('panel-', '') : null;
}


// [source main.js:8515] _reloadForKey
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


// [source main.js:8563] startRealtimeSync
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


// [source main.js:8592] _origDBset
var _origDBset = DB.set.bind(DB);
DB.set = async function(key, value) {
  if (!window._lastOwnWrite) window._lastOwnWrite = {};
  window._lastOwnWrite[key] = Date.now();
  return _origDBset(key, value);
};


// [source main.js:8599] init
async function init(){
  await testSupabaseConnection();
  startRealtimeSync();
  // Clock
  tick(); setInterval(tick,1000);
  // Static renders
  FULL_LOGS_DATA = (await DB.get('telos-logs')) || [];
  renderTopRes(); renderPrices(); renderActivity(); renderSysLogs(); renderFullLogs();
  renderCommerce();
  await loadMissions();
  await loadRessourceCatalogue();
  await loadArmurieCatalogue();
  await loadObjectifs();
  await loadCommandes();
  await loadBlueprints();
  await refreshDatalist();
  await loadProfitHistory();
  drawChart(7);
  // Live prices
  setInterval(fluctuate,8500);
  // Load players from persistent storage
  players=(await DB.get('uex-players'))||[];
  var _avatarFixed=false;
  players.forEach(p=>{
    if(p.avatar&&(p.avatar.startsWith('http://')||p.avatar.startsWith('https://'))){p.avatar=null;_avatarFixed=true;}
    if(!p.status){p.status='approved';_avatarFixed=true;}
  });
  if(_avatarFixed) await DB.set('uex-players',players);
  await loadRolesConfig();
  updateDemandesBadge&&updateDemandesBadge();
  updateNavBanque&&updateNavBanque();
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
  const _authBtn = document.getElementById('sb-auth-btn');
  if (_authBtn) {
    _authBtn.addEventListener('click', () => {
      if (SESSION) logout();
      else openLoginModal();
    });
  }
  startAutoSave();
  if(SESSION){if(typeof hideLanding==='function')hideLanding();}
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

