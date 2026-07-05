/* ════════════════════════════════════════════════════════════
   DATA ARMURIE — catalogue SC_DB
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:2837] SC_DB
var SC_DB = {};

// [source main.js:2838] _armTab
var _armTab = 'fps';


// [source main.js:2840] loadArmurieCatalogue
async function loadArmurieCatalogue() {
  const stored = await DB.get('telos-armurie-custom');
  if (stored && Array.isArray(stored)) ARMURIE_CATALOGUE = stored;
}


// [source main.js:2845] clearArmurieCatalogue
async function clearArmurieCatalogue() {
  if (!canManageRoles()) { toast('Accès refusé', 'Action réservée aux admins/gestionnaires.', 'error'); return; }
  if (!confirm('Vider tout le catalogue armurie ? Cette action est irréversible.')) return;
  ARMURIE_CATALOGUE = [];
  await DB.set('telos-armurie-custom', []);
  renderArmurie();
  toast('Catalogue vidé', 'Toutes les entrées armurie ont été supprimées.', 'info');
}


// [source main.js:2854] importBlueprintsToArmurieData
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


// [source main.js:2907] setArmTab
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


// [source main.js:2919] _updateArmTypeFilter
function _updateArmTypeFilter() {
  const sel = document.getElementById('arm-type-filter');
  if (!sel) return;
  const data = SC_DB[_armTab] || [];
  const typeKey = _armTab === 'fps' ? 'type' : _armTab === 'armor' ? 'type' : _armTab === 'shipwep' ? 'type' : 'cat';
  const types = [...new Set(data.map(i => i[typeKey]).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Tous les types</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
}

// Ancienne fonction conservée pour compatibilité

// [source main.js:2929] setArmFilter
function setArmFilter(cat, btn) { setArmTab(cat === 'all' ? 'fps' : cat, null); }


// [source main.js:2931] renderArmurie
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
    industriel: ['Nom','Type','Capacité','Rendement','Portée','Stats','Lieu','Prix aUEC'],
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
    if (_armTab === 'industriel') {
      cells = `
        <td style="font-weight:700;color:var(--text-bright);">🏭 ${esc(item.name)}</td>
        <td><span style="font-size:10px;padding:1px 6px;border:1px solid var(--border);color:var(--text-dim);">${esc(item.type||'—')}</span></td>
        <td style="font-family:var(--mono);color:var(--orange);">${esc(item.capacité||'—')}</td>
        <td style="font-family:var(--mono);color:var(--red);">${esc(item.rendement||'—')}</td>
        <td style="font-family:var(--mono);">${esc(item.portée||'—')}</td>
        <td style="font-size:11px;color:var(--blue);">${esc(item.bonus||'—')}</td>
        <td style="font-size:11px;color:var(--text-dim);">${esc(item.loc||'—')}</td>
        <td style="font-family:var(--mono);color:var(--green);">${item.prix ? fmt(item.prix)+' aUEC' : '—'}</td>`;
    } else if (_armTab === 'fps') {
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


// [source main.js:3030] addArmurieItem
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



// [source main.js:3043] _armCatEditId
var _armCatEditId   = null;  // id item en cours d'édition

// [source main.js:3044] _armCatEditScdb
var _armCatEditScdb = false; // true = item SC_DB (pas de custom existant)

// ── Ouvre le modal d'édition catalogue armurie ──────────────────────────────

// [source main.js:3047] openArmCatEdit
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
    ['fps','armor','shipwep','shipcomp','industriel'].forEach(function(tab) {
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


// [source main.js:3106] selectArmCatEdit
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


// [source main.js:3151] saveArmCatEdit
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


// [source main.js:3210] closeArmCatEdit
function closeArmCatEdit() {
  var o = document.getElementById('arm-cat-edit-overlay');
  if (o) o.classList.remove('open');
  _armCatEditId = null;
  _armCatEditScdb = false;
}



