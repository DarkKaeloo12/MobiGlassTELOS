/* ════════════════════════════════════════════════════════════
   COMMANDES
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:3725] COMMANDES
var COMMANDES = [];

// [source main.js:3726] _cmdTab
var _cmdTab = 'toutes';

// [source main.js:3727] _cmdType
var _cmdType = 'interne';

// [source main.js:3728] _editCmdId
var _editCmdId = null;


// [source main.js:3730] CMD_STATUS_LABELS
var CMD_STATUS_LABELS = {
  attente:'En attente', en_cours:'En cours', livree:'Livrée', annulee:'Annulée'
};

// [source main.js:3733] CMD_PRIO_COLORS
var CMD_PRIO_COLORS = { normale:'var(--text-dim)', haute:'var(--orange)', urgente:'var(--red)' };

// [source main.js:3734] CMD_PRIO_ICONS
var CMD_PRIO_ICONS  = { normale:'⚪', haute:'🟠', urgente:'🔴' };


// [source main.js:3736] loadCommandes
async function loadCommandes() {
  COMMANDES = (await DB.get('telos-commandes')) || [];
  renderCommandes();
}


// [source main.js:3741] saveCommandes
async function saveCommandes() {
  await DB.set('telos-commandes', COMMANDES);
}


// [source main.js:3745] setCmdTab
function setCmdTab(tab, btn) {
  _cmdTab = tab;
  document.querySelectorAll('#panel-commandes .obj-tab').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCommandes();
}


// [source main.js:3752] setCmdType
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


// [source main.js:3767] renderCommandes
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
          ${c.branche ? '<span style="font-size:9px;letter-spacing:1px;padding:2px 7px;border:1px solid var(--orange);color:var(--orange);background:rgba(247,140,30,0.08);">🔗 COMMANDE DE BRANCHE</span>' : ''}
          ${(()=>{ const labels={haute:'🟠 HAUTE',urgente:'🔴 URGENTE'}; return labels[c.priority]?`<span style="font-size:9px;letter-spacing:1px;padding:2px 7px;border:1px solid ${c.priority==='urgente'?'var(--red)':'#f97316'};color:${c.priority==='urgente'?'var(--red)':'#f97316'};background:${c.priority==='urgente'?'rgba(255,68,68,0.08)':'rgba(249,115,22,0.08)'};">${labels[c.priority]}</span>`:''; })()}
        </div>
      </div>

      <div class="cmd-body">
        <div class="cmd-field"><div class="cmd-lbl">Commanditaire</div><div class="cmd-val">${esc(players.find(p=>p.id===c.client)?.name || c.client || '—')}</div></div>
        ${(()=>{
          const craftLabels = { fps:'🔫 Armes FPS', armor:'🛡 Armures FPS', vaisseau:'🚀 Armes Vaisseau', composant:'⚙ Composants Vaisseau', industriel:'🏭 Industriel', autre:'○ Autre' };
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
          if(canManageRoles()||hasDroit('status_commande')){
          if(c.status==='attente')                   _s+='<button data-action="cmd-status" data-id="'+c.id+'" data-id2="en_cours" style="'+S+'1px solid var(--orange);color:var(--orange);background:transparent;letter-spacing:1px;">▶ EN COURS</button>';
          if(c.status==='en_cours')                  _s+='<button data-action="cmd-status" data-id="'+c.id+'" data-id2="livree"   style="'+S+'1px solid var(--green);color:var(--green);background:rgba(0,255,163,0.07);font-weight:700;">✓ LIVRÉE</button>';
          if(c.status==='livree'||c.status==='annulee') _s+='<button data-action="cmd-status" data-id="'+c.id+'" data-id2="attente" style="'+S+'1px solid var(--text-dim);color:var(--text-dim);background:transparent;">↺ ROUVRIR</button>';
          }
          if(canEditCommande(c))
          _s+='<button data-action="cmd-edit"   data-id="'+c.id+'" style="'+S+'1px solid var(--orange);color:var(--orange);background:transparent;">✏</button>';
          _s+='<button data-action="cmd-check"  data-id="'+c.id+'" title="Vérifier le stock NEXORA" style="'+S+'1px solid rgba(89,208,255,0.5);color:#59d0ff;background:transparent;">📦</button>';
          _s+='<button data-action="cmd-delete" data-id="'+c.id+'" title="Supprimer" style="'+S+'1px solid rgba(255,68,68,0.5);color:var(--red);background:transparent;">🗑</button>';
          return _s;
        })()}
        <span style="margin-left:auto;font-size:9px;color:var(--text-dim);font-family:var(--mono);">${new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>`;
  }).join('');
}

// Ingrédients de base du blueprint (avant multiplication)

// [source main.js:3882] _cmdBpBaseIngredients
var _cmdBpBaseIngredients = [];


// [source main.js:3884] openAddCommande
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


// [source main.js:3948] _updateBrancheToggle
function _updateBrancheToggle(val) {
  const track = document.getElementById('cmd-branche-track');
  const thumb = document.getElementById('cmd-branche-thumb');
  if (!track || !thumb) return;
  const on = !!parseInt(val);
  track.style.background = on ? 'var(--orange)' : 'var(--border)';
  thumb.style.background = on ? '#fff' : 'var(--text-dim)';
  thumb.style.left = on ? '20px' : '2px';
}


// [source main.js:3958] toggleCmdBranche
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

// [source main.js:3972] _sdpTelosStocks
var _sdpTelosStocks = []; // stocks TELOS bruts du partenaire actif

// [source main.js:3973] _sdpPersoStocks
var _sdpPersoStocks = []; // stocks personnels bruts du partenaire actif

// [source main.js:3974] _sdpAllStocks
var _sdpAllStocks = []; // alias — pointe vers le bon contexte selon la clé


// [source main.js:3976] openStockDetail
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
  const BUCKET_LABELS  = { aucune:'⚪ Sans qualité', vente:'🔴 Vente (Inférieur à 500)', vaisseau:'🟢 Supérieur à 500', fps:'🟢 Supérieur à 500' };

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


// [source main.js:4062] closeStockDetail
function closeStockDetail() {
  const ov = document.getElementById('stock-detail-overlay');
  const pn = document.getElementById('stock-detail-panel');
  pn.style.transform = 'translateX(100%)';
  setTimeout(() => { ov.style.display = 'none'; }, 220);
}

// Vider et repeupler les lignes de ressources

// [source main.js:4070] setCmdResources
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


// [source main.js:4089] addCmdResRow
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


// [source main.js:4101] removeCmdResRow
function removeCmdResRow(btn) {
  const list = document.getElementById('cmd-resources-list');
  if (!list) return;
  const rows = list.querySelectorAll('.cmd-res-row');
  if (rows.length <= 1) { btn.closest('.cmd-res-row').querySelectorAll('input').forEach(i=>i.value=''); return; }
  btn.closest('.cmd-res-row').remove();
}

// Mapping type de craft → cat blueprint

// [source main.js:4110] CRAFT_TYPE_TO_BP_CAT
const CRAFT_TYPE_TO_BP_CAT = {
  fps:       ['fps'],
  armor:     ['armor'],
  vaisseau:  ['vaisseau'],
  composant: ['composant'],
  industriel:['industriel'],
  autre:     null,
  '':        null,
};


// [source main.js:4120] filterCmdBlueprints
function filterCmdBlueprints(selectedBpId) {
  const craftType = document.getElementById('cmd-assigned')?.value || '';
  const bpSel = document.getElementById('cmd-blueprint');
  if (!bpSel) return;

  let bps = BLUEPRINTS || [];

  const cats = CRAFT_TYPE_TO_BP_CAT[craftType];
  if (cats) {
    bps = bps.filter(b => cats.includes((b.cat||'').toLowerCase()));
  }

  const current = selectedBpId || bpSel.value;
  bpSel.innerHTML = '<option value="">— Aucun blueprint —</option>'
    + bps.map(b => `<option value="${b.id}"${b.id===current?' selected':''}>${esc(b.name)}</option>`).join('');
  if (current && bps.find(b=>b.id===current)) bpSel.value = current;
}
 

// [source main.js:4138] onCmdBlueprintChange
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


// [source main.js:4151] changeCmdQty
function changeCmdQty(delta) {
  const el = document.getElementById('cmd-qty-mult');
  if (!el) return;
  const v = Math.max(1, (parseInt(el.value)||1) + delta);
  el.value = v;
  onCmdQtyMultChange();
}


// [source main.js:4159] onCmdQtyMultChange
function onCmdQtyMultChange() {
  applyCmdQtyMult();
  updateCmdQtyHint();
}


// [source main.js:4164] updateCmdQtyHint
function updateCmdQtyHint() {
  const el = document.getElementById('cmd-qty-mult');
  const hint = document.getElementById('cmd-qty-hint');
  if (!hint) return;
  const v = parseInt(el?.value)||1;
  hint.textContent = v > 1 ? `× ${v} exemplaires` : '';
}


// [source main.js:4172] applyCmdQtyMult
function applyCmdQtyMult() {
  if (!_cmdBpBaseIngredients.length) return;
  const mult = Math.max(1, parseInt(document.getElementById('cmd-qty-mult')?.value)||1);
  setCmdResources(_cmdBpBaseIngredients.map(i=>({
    name: i.name,
    qty: Math.round(i.qty * mult * 1000) / 1000  // arrondi 3 décimales
  })));
}


// [source main.js:4181] closeAddCommande
function closeAddCommande() {
  document.getElementById('cmd-overlay').classList.remove('open');
  _editCmdId = null;
}


// [source main.js:4186] editCommande
function editCommande(id) {
  const c = COMMANDES.find(x => x.id === id);
  if (c && !canEditCommande(c)) {
    toast('Accès refusé', 'Modification non autorisée pour cette commande.', 'error');
    return;
  }
  openAddCommande(id);
}


// [source main.js:4195] saveCommande
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

// [source main.js:4269] objStockBucket
function objStockBucket(obj) {
  // Tous les objectifs comptabilisent TOUT le stock Supérieur à 500 (vaisseau + fps),
  // sans exception, quel que soit le craftType ou blueprint associé.
  // Seul le stock 'vente' (<500) et 'aucune' (non classé) sont exclus.
  return ['vaisseau', 'fps'];
}


// [source main.js:4276] getStockNetForObjectif
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

// [source main.js:4327] refreshObjStockInfo
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

// [source main.js:4352] refreshAllObjStockInfo
async function refreshAllObjStockInfo() {
  const active = OBJECTIFS.filter(o => !o.done && o.ingredients?.length);
  for (const o of active) await refreshObjStockInfo(o.id);
  renderObjectifs();
}

// ══ CONTRÔLE STOCK AUTOMATIQUE À LA CRÉATION D'UNE COMMANDE ════════════════

// [source main.js:4359] checkStockForCommande
async function checkStockForCommande(cmd) {
  if (!cmd.resources || !cmd.resources.length) return;

  // ── 1. Agréger stock NEXORA utilisable (sans les ressources 'vente' <500) ──
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

// [source main.js:4461] DISCORD_WEBHOOK
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1515240542605414511/QLxdHc1kfi5_3PZaIOyijrQCnmtbSYH2CH__BWNuYoAL_jPXdsF0FfHKkjwowUhl_z-Y';


// [source main.js:4463] notifyDiscord
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
        username: 'NEXORA',
        avatar_url: 'https://media.alienwarearena.com/media/00825a3ff4d68867c811e8e36c2e828b.png?quality=75&width=184',
        embeds: [{
          title,
          description: desc,
          color,
          fields,
          footer: { text: `NEXORA • ${new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}` },
          thumbnail: { url: 'https://media.alienwarearena.com/media/00825a3ff4d68867c811e8e36c2e828b.png?quality=75&width=184' }
        }]
      })
    });
  } catch(e) {
    console.warn('Discord webhook error:', e);
  }
}


// [source main.js:4523] setCmdStatus
async function setCmdStatus(id, status) {
  if (!canManageRoles() && !hasDroit('status_commande')) { toast('Accès refusé','','error'); return; }
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


// [source main.js:4552] cancelCommande
async function cancelCommande(id) {
  const comm = COMMANDES.find(x=>x.id===id);
  if (!comm) return;
  if (!confirm('Annuler la commande "'+comm.title+'" ?')) return;
  comm.status = 'annulee';
  await saveCommandes();
  renderCommandes();
  toast('Commande annulée', comm.title, 'info');
}


// [source main.js:4562] deleteCommande
async function deleteCommande(id) {
  if (!canManageRoles() && !hasDroit('delete_commande')) { toast('Accès refusé','','error'); return; }
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

// [source main.js:4576] syncObjectifsWithStock
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

  // Agréger tout le stock NEXORA par bucket de qualité
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



// [source main.js:4665] checkCmdStock
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
  alert('Stock NEXORA — ' + comm.title + '\n\n' + lines.join('\n') + '\n\n' + summary);
  toast(allOk ? 'Stock OK' : 'Ressources manquantes', summary, allOk ? 'success' : 'warn');
}


/* ════════════════════════════════════════════════════════════
   UEX API SYNC — Synchronisation temps réel du catalogue
   API : https://api.uexcorp.uk/2.0/commodities
════════════════════════════════════════════════════════════ */

