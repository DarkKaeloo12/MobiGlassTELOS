/* ════════════════════════════════════════════════════════════
   ARMURERIE — équipements par partenaire
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:7740] _armSelectedPid
var _armSelectedPid = null;

// [source main.js:7741] _armCatFilter
var _armCatFilter   = 'all';


// [source main.js:7743] ARM_CAT_LABELS
var ARM_CAT_LABELS = {
  arme_fps:           '🔫 Arme FPS',
  armure:             '🛡 Armure',
  composant_vaisseau: '🔧 Composant',
  arme_vaisseau:      '🚀 Arme Vaisseau',
};

// [source main.js:7749] ARM_CAT_COLORS
var ARM_CAT_COLORS = {
  arme_fps:           '#f87171',
  armure:             '#60a5fa',
  composant_vaisseau: '#f79028',
  arme_vaisseau:      '#a78bfa',
};


// [source main.js:7756] goToArmurerie
function goToArmurerie(el) {
  if (!SESSION) { openLoginModal(null, () => goToArmurerie(el)); return; }
  goPanel('armurerie', el);
}

// Rendre la liste des partenaires dans la sidebar armurerie

// [source main.js:7762] renderArmPartnerList
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


// [source main.js:7782] filterArmPartners
function filterArmPartners(v) { renderArmPartnerList(v); }


// [source main.js:7784] _currentArmTab
var _currentArmTab = 'telos';


// [source main.js:7786] switchArmTab
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


// [source main.js:7808] renderArmPersoTable
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


// [source main.js:7875] armPersoDelItem
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


// [source main.js:7888] backToArmList
function backToArmList() {
  document.getElementById('arm-list-view').style.display = 'flex';
  const ac = document.getElementById('arm-content');
  if (ac) ac.style.display = 'none';
  document.getElementById('arm-header-list').style.display = 'flex';
  document.getElementById('arm-header-view').style.display = 'none';
  document.querySelectorAll('#arm-list .pl-item').forEach(el => el.classList.remove('sel'));
  _armSelectedPid = null;
}


// [source main.js:7898] selectArmPlayer
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


// [source main.js:7966] renderArmTable
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


// [source main.js:8047] updateArmFooter
function updateArmFooter(rows) {
  document.getElementById('arm-sf-distinct').textContent = rows.length;
  document.getElementById('arm-sf-units').textContent    = rows.reduce((s,r)=>s+r.qty,0).toLocaleString('fr-FR');
  document.getElementById('arm-sf-total').textContent    = Math.round(rows.reduce((s,r)=>s+r.buyVal,0)).toLocaleString('fr-FR')+' aUEC';
}


// [source main.js:8053] goArmStockFull
function goArmStockFull() {
  document.getElementById('arm-cat-filter').value='all';
  document.getElementById('arm-quality-filter').value='all';
  document.getElementById('arm-item-search').value='';
  renderArmTable();
}

// ── Modal ajout item armurerie ──

// [source main.js:8061] _armEditId
var _armEditId = null;

// [source main.js:8062] _armPsModalOpen
var _armPsModalOpen = false;


// [source main.js:8064] syncArmQualityBadge
function syncArmQualityBadge() {}


// [source main.js:8066] openArmDetail
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


// [source main.js:8137] armDelItem
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


// [source main.js:8151] _armModalType
var _armModalType = 'telos';


// [source main.js:8153] openAddArmItem
function openAddArmItem(type) {
  _armModalType = type || _currentArmTab || 'telos';
  openArmModal(null);
}


// [source main.js:8158] openArmModal
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


// [source main.js:8285] closeArmModal
function closeArmModal() {
  const o = document.getElementById('arm-modal-overlay');
  if (o) o.classList.remove('open');
  _armEditId = null;
}

// Mapping catégorie → clé SC_DB

// [source main.js:8292] ARM_CAT_TO_DB
const ARM_CAT_TO_DB = { arme_fps:'fps', armure:'armor', arme_vaisseau:'shipwep', composant_vaisseau:'shipcomp' };


// [source main.js:8294] selectArmCat
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


// [source main.js:8305] populateArmDbSelect
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


// [source main.js:8333] armDbSelectChange
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


// [source main.js:8374] syncArmQualityFromExact
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


// [source main.js:8387] syncArmQualityBadge
function syncArmQualityBadge() {} // placeholder


// [source main.js:8389] saveArmItem
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


// [source main.js:8428] deleteArmItem
async function deleteArmItem(id, name) {
  if (!_armSelectedPid || !confirm('Supprimer "'+name+'" de l\'armurerie ?')) return;
  let items = (await DB.get('uex-armory-'+_armSelectedPid)) || [];
  items = items.filter(x=>x.id!==id);
  await DB.set('uex-armory-'+_armSelectedPid, items);
  await renderArmTable();
  renderArmPartnerList(document.getElementById('arm-search')?.value||'');
  toast('Item supprimé', name, 'info');
}


