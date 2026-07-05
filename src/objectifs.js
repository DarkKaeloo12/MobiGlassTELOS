/* ════════════════════════════════════════════════════════════
   OBJECTIFS
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:3218] _objTab
var _objTab = 'tous';

// [source main.js:3219] _editObjId
var _editObjId = null;


// [source main.js:3221] OBJ_CAT_LABELS
var OBJ_CAT_LABELS = { ressource:'📦 Ressource', craft:'🔧 Craft', autre:'○ Autre' };

// [source main.js:3222] OBJ_PRIO_COLORS
var OBJ_PRIO_COLORS = { normale:'var(--text-dim)', haute:'var(--orange)', critique:'var(--red)' };

// [source main.js:3223] OBJ_PRIO_LABELS
var OBJ_PRIO_LABELS = { normale:'⚪ Normale', haute:'🟠 Haute', critique:'🔴 Critique' };


// [source main.js:3225] loadObjectifs
async function loadObjectifs() {
  OBJECTIFS = (await DB.get('telos-objectifs')) || [];
  renderObjectifs();
}


// [source main.js:3230] saveObjectifs
async function saveObjectifs() {
  await DB.set('telos-objectifs', OBJECTIFS);
}


// [source main.js:3234] setObjTab
function setObjTab(tab, btn) {
  _objTab = tab;
  document.querySelectorAll('.obj-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderObjectifs();
}


// [source main.js:3241] renderObjectifs
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
          ${SESSION && (canManageRoles()||hasDroit('edit_objectif')) ? '<button data-action="obj-edit" data-id="'+o.id+'" style="padding:3px 10px;border:1px solid var(--orange);color:var(--orange);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);letter-spacing:1px;">✏ ÉDITER</button>' : ''}
          ${!o.done && SESSION && (canManageRoles()||hasDroit('status_objectif')) ? '<button data-action="obj-toggle" data-id="'+o.id+'" style="padding:3px 10px;border:1px solid var(--green);color:var(--green);background:rgba(0,255,163,0.07);cursor:pointer;font-size:10px;font-family:var(--ui);letter-spacing:1px;font-weight:700;">✓ VALIDER</button>' : ''}
          ${o.done && SESSION && (canManageRoles()||hasDroit('status_objectif')) ? '<button data-action="obj-toggle" data-id="'+o.id+'" style="padding:3px 10px;border:1px solid var(--text-dim);color:var(--text-dim);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);letter-spacing:1px;">↺ RÉACTIVER</button>' : ''}
          ${(canManageRoles()||hasDroit('delete_objectif')) ? '<button data-action="obj-delete" data-id="'+o.id+'" style="padding:3px 8px;border:1px solid rgba(255,68,68,0.4);color:var(--red);background:transparent;cursor:pointer;font-size:10px;font-family:var(--ui);">✕</button>' : ''}
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

// [source main.js:3364] _objIngredients
var _objIngredients = []; // [{name, qty, collected}]

// ── Actions selon le select Action ──

// [source main.js:3367] OBJ_ACTION_LABELS
var OBJ_ACTION_LABELS = { collecter:'Collecter', craft:'Crafter', livraison:'Livrer', mission:'Mission', commerce:'Vendre', autre:'Objectif' };

// [source main.js:3368] OBJ_ACTION_UNIT
var OBJ_ACTION_UNIT   = { collecter:'SCU', craft:'unité(s)', livraison:'SCU', mission:'', commerce:'aUEC', autre:'' };

// [source main.js:3369] OBJ_ACTION_CAT
var OBJ_ACTION_CAT    = { collecter:'ressource', craft:'craft', livraison:'ressource', mission:'autre', commerce:'commerce', autre:'autre' };


// [source main.js:3371] onObjActionChange
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


// [source main.js:3388] onObjResSelect
function onObjResSelect(val) {
  const customEl = document.getElementById('obj-res-custom');
  if (val && customEl) customEl.value = '';
  autoGenObjTitle();
}


// [source main.js:3394] onObjQualityChange
function onObjQualityChange(val) {
  const badge = document.getElementById('obj-quality-badge');
  if (!badge) return;
  if (!val) { badge.style.display = 'none'; return; }
  const meta = QUALITY_META[val];
  if (!meta || !meta.label) { badge.style.display = 'none'; return; }
  const bucketMap = { mediocre:'🔴 Vente uniquement', basique:'🟢 Supérieur à 500', acceptable:'🟢 Supérieur à 500',
    honnete:'🟢 Supérieur à 500', moyenne:'🟢 Supérieur à 500', haute:'🟢 Supérieur à 500' };
  badge.style.display = 'block';
  badge.style.borderLeftColor = meta.color;
  badge.style.color = meta.color;
  badge.textContent = meta.label + '  ·  SCU ' + meta.score + '  →  ' + (bucketMap[val] || '');
}


// [source main.js:3408] onObjResCustom
function onObjResCustom(val) {
  const selEl = document.getElementById('obj-res-select');
  if (val && selEl) selEl.value = '';
  autoGenObjTitle();
}


// [source main.js:3414] getObjResName
function getObjResName() {
  return document.getElementById('obj-res-select')?.value
      || document.getElementById('obj-res-custom')?.value.trim()
      || '';
}


// [source main.js:3420] autoGenObjTitle
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


// [source main.js:3437] populateObjResSelect
function populateObjResSelect() {
  const sel = document.getElementById('obj-res-select');
  if (!sel) return;
  const resources = RESSOURCE_CATALOGUE.length ? RESSOURCE_CATALOGUE : (UEX_COMMODITIES || []);
  const opts = resources.map(r => r.name || r.commodity_name || r).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  sel.innerHTML = '<option value="">— Sélectionner —</option>'
    + opts.map(name => '<option value="'+name+'">'+name+'</option>').join('');
}


// [source main.js:3446] onObjCatChange
function onObjCatChange(cat) {
  // compat — no-op, géré par onObjActionChange
}


// [source main.js:3450] populateObjBpSelect
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


// [source main.js:3482] onObjBpSelect
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


// [source main.js:3519] refreshObjIngredients
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


// [source main.js:3539] openAddObjectif
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


// [source main.js:3609] closeAddObjectif
function closeAddObjectif() {
  document.getElementById('obj-overlay').classList.remove('open');
  _editObjId = null;
}


// [source main.js:3614] saveObjectif
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


// [source main.js:3654] updateIngredient
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


// [source main.js:3674] editObjectif
function editObjectif(id) { openAddObjectif(id); }


// [source main.js:3676] deleteObjectif
async function deleteObjectif(id) {
  if (!canManageRoles() && !hasDroit('delete_objectif')) { toast('Accès refusé','','error'); return; }
  const o = OBJECTIFS.find(x => x.id === id);
  if (!o || !confirm('Supprimer "' + o.title + '" ?')) return;
  OBJECTIFS = OBJECTIFS.filter(x => x.id !== id);
  await saveObjectifs();
  renderObjectifs();
  toast('Objectif supprimé', o.title, 'success');
}


// [source main.js:3686] toggleObjDone
async function toggleObjDone(id) {
  if (!canManageRoles() && !hasDroit('status_objectif')) { toast('Accès refusé','','error'); return; }
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


// [source main.js:3709] updateObjProgress
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

