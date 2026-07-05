/* ════════════════════════════════════════════════════════════
   BLUEPRINTS
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:5092] BLUEPRINTS
var BLUEPRINTS = [];

// [source main.js:5093] _bpFilter
var _bpFilter = 'all';

// [source main.js:5094] _bpCorpoMode
var _bpCorpoMode = false;

// [source main.js:5095] _mesCatFilter
var _mesCatFilter = 'all';

// [source main.js:5096] _editBpId
var _editBpId = null;

// [source main.js:5097] _bpIngredients
var _bpIngredients = [];


// [source main.js:5099] BP_CAT_LABELS
var BP_CAT_LABELS = {
  fps:'🔫 Armes FPS', armor:'🛡 Armures FPS', vaisseau:'🚀 Armes Vaisseau', composant:'⚙ Composants Vaisseau', industriel:'🏭 Industriel', autre:'○ Autre', mes:'⭐ Mes Blueprints'
};


// [source main.js:5103] loadBlueprints
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


// [source main.js:5119] saveBlueprints
async function saveBlueprints() {
  await DB.set('telos-blueprints', BLUEPRINTS);
}


// [source main.js:5123] setBpFilter
function setBpFilter(f, btn) {
  // Si mode "Mes Blueprints" actif et on clique sur un filtre cat → garder mes BP actif
  const _mesModeActif = _bpFilter === 'mes' && ['vaisseau','fps','composant'].includes(f);
  _bpFilter = _mesModeActif ? 'mes' : f;
  document.querySelectorAll('#panel-blueprints .filter-btn').forEach(b=>b.classList.remove('active'));
  if (_mesModeActif) {
    // Garder "Mes Blueprints" actif + mettre en surbrillance le filtre cat
    const mesBtn = document.querySelector('#panel-blueprints .filter-btn[onclick*="mes"]');
    if (mesBtn) mesBtn.classList.add('active');
    if (btn) btn.classList.add('active');
  } else {
    if (btn) btn.classList.add('active');
  }
  if (!_bpCorpoMode && _bpFilter !== 'mes') {
    const corpoBtn = document.getElementById('btn-bp-corpo');
    if (corpoBtn) { corpoBtn.classList.remove('active'); corpoBtn.style.background='transparent'; }
  }
  if (_bpCorpoMode) {
    // Garder "Blueprint Corpo" actif + mettre en surbrillance le filtre cat
    const corpoBtn = document.getElementById('btn-bp-corpo');
    if (corpoBtn) corpoBtn.classList.add('active');
  }
  if (_mesModeActif) _mesCatFilter = f;
  else if (f === 'mes') _mesCatFilter = 'all';
  else if (!_bpCorpoMode) _mesCatFilter = 'all';
  renderBlueprints();
}


// [source main.js:5151] toggleBpCorpo
function toggleBpCorpo(btn) {
  _bpCorpoMode = !_bpCorpoMode;
  if (_bpCorpoMode) {
    document.querySelectorAll('#panel-blueprints .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    btn.style.background = 'rgba(247,140,30,0.15)';
    _bpFilter = 'all';
    _mesCatFilter = 'all';
  } else {
    btn.classList.remove('active');
    btn.style.background = 'transparent';
    const allBtn = document.querySelector('#panel-blueprints .filter-btn:first-of-type');
    if (allBtn) allBtn.classList.add('active');
    _bpFilter = 'all';
    _mesCatFilter = 'all';
  }
  renderBlueprints();
}


// [source main.js:5170] goToBlueprints
function goToBlueprints(el) {
  if (!SESSION) { openLoginModal(null, () => goToBlueprints(el)); return; }
  goPanel('blueprints', el);
}


// [source main.js:5175] renderBlueprints
async function renderBlueprints() {
  const tbody = document.getElementById('bp-tbody');
  if (!tbody) return;
  if (!SESSION) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">🔒 Connectez-vous pour accéder aux blueprints.</td></tr>';
    return;
  }

  const search = (document.getElementById('bp-search')?.value||'').toLowerCase();
  let data = [...BLUEPRINTS];
  if (_bpCorpoMode) {
    const cache = window._playerBpCache || {};
    const corpoBpIds = new Set();
    Object.values(cache).forEach(ids => (ids||[]).forEach(id => corpoBpIds.add(id)));
    data = data.filter(b => corpoBpIds.has(b.id));
    if (_bpFilter !== 'all' && _bpFilter !== 'mes') {
      data = data.filter(b => b.cat === _bpFilter);
    }
  } else if (_bpFilter === 'mes') {
    const myBpIds = (window._playerBpCache && window._playerBpCache[SESSION.pid]) || [];
    data = data.filter(b => myBpIds.includes(b.id));
    // Filtre cat secondaire si actif
    if (_mesCatFilter && _mesCatFilter !== 'all') {
      data = data.filter(b => b.cat === _mesCatFilter);
    }
  } else if (_bpFilter !== 'all') {
    data = data.filter(b => b.cat === _bpFilter);
  }
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

    let owners;
    if (_bpCorpoMode) {
      const cache = window._playerBpCache || {};
      owners = players
        .filter(p => (cache[p.id]||[]).includes(b.id))
        .map(p => '<span style="font-size:10px;padding:1px 6px;border:1px solid rgba(89,208,255,0.3);color:var(--blue);margin:1px;display:inline-block;">'+esc(p.name)+'</span>')
        .join('');
    } else {
      owners = (b.owners||[]).map(oid => {
        const p = players.find(x=>x.id===oid);
        return p ? '<span style="font-size:10px;color:var(--blue);">'+esc(p.name)+'</span>' : '';
      }).filter(Boolean).join(', ');
    }

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
        if(canManageRoles() || hasDroit('edit_blueprint')) td+='<button data-action="bp-edit" data-id="'+b.id.replace(/"/g,'')+'" style="padding:3px 10px;border:1px solid rgba(247,140,30,0.4);color:var(--orange);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);letter-spacing:1px;margin-right:4px;">✏ Éditer</button>';
        if(canManageRoles()) td+='<button data-delbp="'+b.id.replace(/"/g,'')+'" style="padding:3px 10px;border:1px solid rgba(255,68,68,0.4);color:var(--red);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);letter-spacing:1px;">✕ Supprimer</button>';
        td+='</td>';
        return td;
      })()
      +'</tr>';
  }).join('');
}

// [source main.js:5259] removeBpIngredient
function removeBpIngredient(id) {
  _bpIngredients = _bpIngredients.filter(i=>i.id!==id);
  refreshBpIngredients();
}


// [source main.js:5264] refreshBpIngredients
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


// [source main.js:5284] refreshBpOwners
function refreshBpOwners(currentOwners) {
  const el = document.getElementById('bp-owners-list');
  if (!el) return;
  el.innerHTML = players.map(p =>
    '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;color:var(--text-dim);">'
    +'<input type="checkbox" value="'+p.id+'"'+(currentOwners?.includes(p.id)?' checked':'')
    +' style="accent-color:var(--orange);">'+esc(p.name)+'</label>'
  ).join('');
}


// [source main.js:5294] openAddBlueprint
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


// [source main.js:5316] closeAddBlueprint
function closeAddBlueprint() {
  document.getElementById('bp-overlay').classList.remove('open');
  _editBpId = null;
}


// [source main.js:5321] editBlueprint
function editBlueprint(id) { openAddBlueprint(id); }


// [source main.js:5323] deleteBlueprint
async function deleteBlueprint(id) {
  const b = BLUEPRINTS.find(x=>x.id===id);
  if (!b || !confirm('Supprimer "'+b.name+'" ?')) return;
  BLUEPRINTS = BLUEPRINTS.filter(x=>x.id!==id);
  await saveBlueprints();
  renderBlueprints();
  toast('Blueprint supprimé', b.name, 'success');
}


// [source main.js:5332] saveBlueprint
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

// [source main.js:5367] _bpSyncRunning
var _bpSyncRunning = false;


// [source main.js:5369] syncBlueprintsFromWiki
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
        if (!existing.ingredients || !existing.ingredients.length) existing.ingredients = ingredients;
        if (!existing.level)     existing.level     = size;
        if (!existing.craftTime) existing.craftTime = craftTime;
        if (!existing.wikiUuid)  existing.wikiUuid  = bp.uuid;
        existing.fromWiki = true;
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



// [source main.js:8439] toggleBpOwner
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

// [source main.js:8465] loadPlayerOwnedBlueprints
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

// [source main.js:8477] loadAllPlayerBpCounts
async function loadAllPlayerBpCounts(){window._playerBpCache=window._playerBpCache||{};for(const p of players){if(!window._playerBpCache[p.id]){const bps=(await DB.get('player-blueprints-'+p.id))||[];window._playerBpCache[p.id]=bps;}}}

