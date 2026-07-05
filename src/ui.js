/* ════════════════════════════════════════════════════════════
   UI — modales génériques, toast, logs, utilitaires (esc, pad, pushActivity...)
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:286] avHtml
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

// [source main.js:675] LIVE_ACTIVITY
var LIVE_ACTIVITY = [];

// [source main.js:676] MAX_ACTIVITY
var MAX_ACTIVITY = 20;


// [source main.js:678] pushActivity
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


// [source main.js:689] timeAgo
function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return 'à l\'instant';
  if (diff < 3600) return 'il y a ' + Math.floor(diff/60) + ' min';
  if (diff < 86400) return 'il y a ' + Math.floor(diff/3600) + ' h';
  return 'il y a ' + Math.floor(diff/86400) + ' j';
}

// SYS_LOGS_DATA remplacé — le mini-log hub lit directement FULL_LOGS_DATA


// [source main.js:730] confirmCb
var confirmCb   = null;

// [source main.js:737] pad
function pad(v){ return String(v).padStart(2,'0'); }

// [source main.js:2575] MODALS
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
      // Fallback : ressources du stock NEXORA si catalogue vide
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

// [source main.js:2700] currentModal
var currentModal=null;

// [source main.js:2701] openModal
function openModal(id){ const m=MODALS[id]; if(!m) return; currentModal=m; document.getElementById('modal-title').textContent=m.title; document.getElementById('modal-body').innerHTML=typeof m.body==='function'?m.body():m.body; document.getElementById('modal-overlay').classList.add('open'); }

// [source main.js:2702] closeModal
function closeModal(){ document.getElementById('modal-overlay').classList.remove('open'); currentModal=null; }

// [source main.js:2703] confirmModal
async function confirmModal(){ if(currentModal?.ok) await currentModal.ok(); closeModal(); }

/* ════════════════════════════════════════════════════════════
   CONFIRM DIALOG
════════════════════════════════════════════════════════════ */

// [source main.js:2708] showConfirm
function showConfirm(title,msg,cb){ document.getElementById('cb-title').textContent=title; document.getElementById('cb-msg').innerHTML=msg; confirmCb=cb; document.getElementById('confirm-overlay').classList.add('open'); }

// [source main.js:2709] closeConfirm
function closeConfirm(){ document.getElementById('confirm-overlay').classList.remove('open'); confirmCb=null; }

// [source main.js:2710] execConfirm
function execConfirm(){ if(confirmCb) confirmCb(); closeConfirm(); }

/* ════════════════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   STOCK PANEL — Accès conditionnel selon la session
════════════════════════════════════════════════════════════ */

// [source main.js:5510] showLoginWall
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
      Connectez-vous pour accéder à cet espace du réseau NEXORA.
    </div>
    <button onclick="openLoginModal(null,()=>goPanel('${id}'))"
      style="padding:10px 28px;border:1px solid var(--orange);background:rgba(247,140,30,0.08);color:var(--orange);font-family:var(--ui);font-size:11px;letter-spacing:2px;cursor:pointer;">
      🔑 SE CONNECTER
    </button>`;
  panelEl.appendChild(wall);
  panelEl._loginWall = true;
}


// [source main.js:5540] clearLoginWall
function clearLoginWall(panelEl) {
  if (!panelEl) return;
  const wall = panelEl.querySelector('.telos-login-wall');
  if (wall) wall.remove();
  panelEl._loginWall = false;
}


// [source main.js:5547] goPanel
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

// [source main.js:7303] updateBadges
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

// [source main.js:7330] pushLog
function pushLog(type, tl, msg) {
  const n = new Date();
  const ts = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  const entry = { ts, type, tl, msg, date: new Date().toISOString() };
  FULL_LOGS_DATA.unshift(entry);
  if (FULL_LOGS_DATA.length > 500) FULL_LOGS_DATA = FULL_LOGS_DATA.slice(0, 500);
  // Persister
  DB.set('telos-logs', FULL_LOGS_DATA).catch(()=>{});
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

// [source main.js:7350] toast
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

// [source main.js:7362] esc
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// [source main.js:7363] fmtDate
function fmtDate(iso){ if(!iso) return '—'; const d=new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }

// [source main.js:7364] shortUrl
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


// [source main.js:7407] loop
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

