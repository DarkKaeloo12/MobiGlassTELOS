/* ════════════════════════════════════════════════════════════
   STOCKS TELOS
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:731] stockCat
var stockCat    = 'all';

// [source main.js:732] stockSort
var stockSort   = { k:'profit', d:-1 };

/* ════════════════════════════════════════════════════════════
   CLOCK
════════════════════════════════════════════════════════════ */

// [source main.js:1885] buildStockRow
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

// [source main.js:1904] renderStocksFromPlayers
async function renderStocksFromPlayers() {
  // ── Masquer le contenu si non connecté ──
  const telosBody = document.getElementById('stocks-body');
  const telosFooter = document.getElementById('telos-footer');
  const telosKpi = document.getElementById('telos-kpi');
  if (!SESSION) {
    if (telosBody) telosBody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--text-dim);">
      <div style="font-size:28px;margin-bottom:12px;opacity:0.3;">🔒</div>
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Accès restreint</div>
      <div style="font-size:12px;opacity:0.7;margin-bottom:16px;">Connectez-vous pour consulter les stocks du réseau NEXORA.</div>
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


// [source main.js:2111] renderStocks
function renderStocks(){ renderStocksFromPlayers(); }

// [source main.js:2112] filterStocks
function filterStocks(){ renderStocksFromPlayers(); }

// [source main.js:2113] filterCat
function filterCat(c,btn){ stockCat=c; document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderStocksFromPlayers(); }

// [source main.js:2114] sortStocks
function sortStocks(k){ stockSort.k===k?stockSort.d*=-1:(stockSort={k,d:-1}); renderStocksFromPlayers(); }

/* ════════════════════════════════════════════════════════════
   POPUP DÉTAIL RESSOURCE — partenaires contributeurs
════════════════════════════════════════════════════════════ */

// [source main.js:2718] goToStock
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


// [source main.js:2737] refreshStockPanel
function refreshStockPanel() {
  // Appelé après login/logout pour mettre à jour l'affichage du panel stock
  if (document.getElementById('panel-joueurs').classList.contains('active')) {
    goToStock(document.getElementById('nav-joueurs'));
  }
}

/* ════════════════════════════════════════════════════════════
   CATALOGUE RESSOURCES — Admin/Gestionnaire uniquement
════════════════════════════════════════════════════════════ */

// [source main.js:6625] populateResSelect
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

// [source main.js:6659] populateResSelectFiltered
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


// [source main.js:6686] autofillPrices
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


// [source main.js:6705] onResSelectChange
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


// [source main.js:6732] onResInputChange
function onResInputChange(val) {
  // Désélectionner le select si l'utilisateur tape manuellement
  const sel = document.getElementById('ps-res-select');
  if (sel && sel.value !== val) sel.value = '';
  checkUexName(val);
  // Auto-renseigner les prix si la ressource correspond au catalogue
  autofillPrices(val);
}


// [source main.js:6741] ncSetRewardType
function ncSetRewardType(type) {
  ['auec','empreinte','honneur'].forEach(function(t) {
    const btn = document.getElementById('nc-rt-' + t);
    const sec = document.getElementById('nc-reward-' + t);
    if (btn) btn.className = t === type ? 'btn primary' : 'btn';
    if (sec) sec.style.display = t === type ? 'flex' : 'none';
  });
}


// [source main.js:6750] UEX_COMMODITIES
var UEX_COMMODITIES = ['Acryliplex Composite','Agricium','Agricultural Supplies','Altruciatoxin','Aluminum','Amioshi Plague','Ammonia','Aphorite','Argon','Aslarite','Astatine','Atlasium','Audio Visual Equipment','Beradom','Beryl','Bexalite','Bioplastic','Borase','CK13 Gid Seed Blend','Carbon','Carbon Silk','Carinite','Cave Kopion Horn','Chlorine','Cobalt','Compboard','Construction Materials','Copper','Corundum','DCSR2','Decari Pod','Degnous Root','Diamond','Diamond Laminate','Distilled Spirits','Dolivine','Dymantium','Dynaflex','Etam','Feynmaline','Fluorine','Foam','Fresh Food','Gasping Weevil Eggs','Glacosite','Gold','Golden Medmon','Hadanite','Heart Of The Woods','Helium','Hephaestanite','Hexapolymesh Coating','Human Food Bars','Hydrogen','Hydrogen Fuel','Iodine','Iron','Irradiated Kopion Horn','Jaclium','Janalite','Kopion Horn','Krypton','Laranite','Lindinium','Luminalia Gift','Marok Gem','Maze','Medical Supplies','Mercury','Methane','Neograph','Neon','Nitrogen','Omnapoxy','Organics','Osoian Hides','Ouratite','Partillium','Party Favors','Pitambu','Potassium','Pressurized Ice','Processed Food','Prota','Quantanium','Quantum Fuel','Quartz','Ranta Dung','Recycled Material Composite','Revenant Pod','Revenant Tree Pollen','Riccite','Sadaryx','Savrilium','Scrap','Silicon','Slam','Souvenirs','Steel','Stileron','Stims','Sunset Berries','Taranite','Tin','Titanium','Torite','Tritium','Tungsten','Waste','Widow','Wuotan Seed','Xapyen','Year Of The Pig Envelope'];

// [source main.js:6751] checkUexName
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


// [source main.js:6784] QUALITY_META
var QUALITY_META = {
  '':          { label:'',                          color:'var(--text-dim)',   score:'—'    },
  'mediocre':  { label:'Qualité Médiocre',          color:'#6b7280',          score:'Inférieur à 500'  },
  'basique':    { label:'Qualité Basique',            color:'#ef4444',          score:'500–600'},
  'acceptable':{ label:'Qualité Acceptable',        color:'#f97316',          score:'600–700'},
  'honnete':   { label:'Qualité Honnête',           color:'#eab308',          score:'700–800'},
  'moyenne':   { label:'Qualité Moyenne',           color:'#22c55e',          score:'800–900'},
  'haute':     { label:'Haute Qualité',             color:'#60a5fa',          score:'900–1000'},
};


// [source main.js:6794] updateQualityBadge
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

// [source main.js:6807] syncQualityFromExact
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

// [source main.js:7256] renderGlobal
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


// [source main.js:7297] updateGlobalFilter
function updateGlobalFilter(){
  const sel=document.getElementById('gf-player');
  if (!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">Tous les joueurs</option>'+players.map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${esc(p.name)}</option>`).join('');
}

