/* ════════════════════════════════════════════════════════════
   JOUEURS — détail partenaire, stock perso/TELOS
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:729] selectedPid
var selectedPid = null;

// [source main.js:5864] renderPlayerList
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


// [source main.js:5886] filterPlayers
function filterPlayers(v){ renderPlayerList(v); }

/* Select and display a player */
// Onglet actif dans la vue partenaire : 'telos' ou 'perso'

// [source main.js:5890] _currentPlTab
var _currentPlTab = 'telos';


// [source main.js:5892] switchPlTab
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


// [source main.js:5919] backToPartnerList
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


// [source main.js:5930] selectPlayer
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

// [source main.js:6025] computeTierSummary
function computeTierSummary(stocks) {
  // stocks = [{res, qty, price, sellprice, ...}]
  const summary = {
    total:      { qty: 0, valAchat: 0, valVente: 0 },
    vente:      { qty: 0, valAchat: 0, valVente: 0 },   // Inférieur à 500 aUEC
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


// [source main.js:6053] renderTierBar
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
      <div style="padding:7px 14px;border-right:1px solid var(--border);min-width:130px;flex-shrink:0;" title="Inférieur à 500 aUEC/SCU — Vente directe recommandée">
        <div style="font-size:9px;letter-spacing:1.5px;color:#ef4444;text-transform:uppercase;margin-bottom:2px;">🔴 Vente directe</div>
        <div style="font-family:var(--mono);font-size:14px;color:#ef4444;font-weight:700;">${fmt(summary.vente.qty)} <span style="font-size:9px;color:var(--text-dim);">SCU</span></div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:1px;">${fmtK(summary.vente.valVente)} aUEC · Inférieur à 500</div>
      </div>

      <!-- Supérieur à 500 (Craft Vaisseau + FPS) -->
      <div style="padding:7px 14px;border-right:1px solid var(--border);min-width:150px;flex-shrink:0;" title="Supérieur à 500 aUEC/SCU — Craft Vaisseau &amp; FPS">
        <div style="font-size:9px;letter-spacing:1.5px;color:var(--green);text-transform:uppercase;margin-bottom:2px;">🟢 Supérieur à 500</div>
        <div style="font-family:var(--mono);font-size:14px;color:var(--green);font-weight:700;">${fmt((summary.craft_ship.qty||0)+(summary.craft_fps.qty||0))} <span style="font-size:9px;color:var(--text-dim);">SCU</span></div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:1px;">${fmtK((summary.craft_ship.valVente||0)+(summary.craft_fps.valVente||0))} aUEC · Supérieur à 500</div>
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

// [source main.js:6097] qualityBucket
function qualityBucket(s) {
  const q = s.quality || '';
  if (!q || q === '') return 'aucune';  // pas de qualité = colonne dédiée
  const scores = { mediocre:250, basique:550, acceptable:650, honnete:750, moyenne:850, haute:950 };
  const score = scores[q] || 0;
  if (score < 500)  return 'vente';    // Inférieur à 500 : vente uniquement
  if (score < 800)  return 'vaisseau'; // 500–800 : craft vaisseau
  return 'fps';                        // 800–1000 : craft FPS
}

// Colore une quantité selon la bucket

// [source main.js:6108] qtyCell
function qtyCell(qty, bucket) {
  if (!qty) return '<td class="td-dim" style="text-align:center;">—</td>';
  const colors = { aucune:'var(--text-bright)', vente:'var(--orange)', vaisseau:'#60a5fa', fps:'var(--green)', craft500:'var(--green)' };
  const col = colors[bucket] || 'var(--text)';
  return '<td style="text-align:center;color:'+col+';font-weight:600;">'+Number(qty).toLocaleString('fr-FR')+'</td>';
}



// [source main.js:6116] renderStockTable
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


// [source main.js:6216] renderPersoTable
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

// [source main.js:6295] refreshDatalist
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

// [source main.js:6314] _editStockId
var _editStockId = null;


// [source main.js:6316] openEditStock
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


// [source main.js:6334] updateEditPreview
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


// [source main.js:6351] closeEditStock
function closeEditStock() {
  document.getElementById('edit-overlay').classList.remove('open');
  _editStockId = null;
}


// [source main.js:6356] saveEditStock
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

// [source main.js:6397] SC_AVATARS
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


// [source main.js:6412] openAvatarPicker
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


// [source main.js:6438] closeAvatarPicker
function closeAvatarPicker() {
  document.getElementById('avatar-overlay').classList.remove('open');
}


// [source main.js:6442] selectAvatarEmoji
async function selectAvatarEmoji(emoji) {
  await saveAvatar(emoji);
  closeAvatarPicker();
}


// [source main.js:6447] triggerAvatarUpload
async function triggerAvatarUpload() {
  document.getElementById('avatar-file-input').click();
}


// [source main.js:6451] handleAvatarFile
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


// [source main.js:6480] saveAvatar
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

// [source main.js:6822] _stockModalType
var _stockModalType = 'telos';


// [source main.js:6824] openPlayerStock
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

// [source main.js:6847] closePSModal
function closePSModal(){ document.getElementById('ps-overlay').classList.remove('open'); }

/* ─── Modal retrait ressource — identique à l'ajout ─── */

// [source main.js:6850] _rmStocks
var _rmStocks     = [];

// [source main.js:6851] _rmSelectedId
var _rmSelectedId = null;

// [source main.js:6852] _rmCatFilter
var _rmCatFilter  = 'all';


// [source main.js:6854] openRemoveStock
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


// [source main.js:6876] filterRMCat
function filterRMCat(btn){
  _rmCatFilter  = btn.dataset.cat;
  _rmSelectedId = null;
  document.querySelectorAll('#rm-cat-grid .cat-sel-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  updateRMConfirmBtn();
  renderRMList();
}


// [source main.js:6885] renderRMList
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


// [source main.js:6947] selectRMStock
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


// [source main.js:6967] adjustRMQty
function adjustRMQty(delta){
  const input = document.getElementById('rm-qty');
  const s     = _rmStocks.find(x=>x.id===_rmSelectedId);
  if (!input||!s) return;
  const cur = parseInt(input.value)||0;
  input.value = Math.max(1, Math.min(s.qty, cur+delta));
  clampRMQty();
  updateRMConfirmBtn();
}


// [source main.js:6977] setRMQtyAll
function setRMQtyAll(){
  const s = _rmStocks.find(x=>x.id===_rmSelectedId);
  if (!s) return;
  document.getElementById('rm-qty').value = s.qty;
  clampRMQty();
  updateRMConfirmBtn();
}


// [source main.js:6985] clampRMQty
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


// [source main.js:7003] updateRMConfirmBtn
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


// [source main.js:7027] closeRMModal
function closeRMModal(){
  document.getElementById('rm-overlay').classList.remove('open');
  const qb = document.getElementById('rm-qty-block');
  if (qb) qb.style.display = 'none';
  _rmSelectedId = null;
}


// [source main.js:7034] confirmRemoveStock
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

// [source main.js:7084] selectCat
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

// [source main.js:7096] updateMarginPreview
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


// [source main.js:7120] addPlayerStock
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

// [source main.js:7174] confirmDelStock
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

// [source main.js:7199] openEditPerso
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


// [source main.js:7215] confirmDelPerso
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

// [source main.js:7229] confirmDeletePlayer
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

