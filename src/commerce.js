/* ════════════════════════════════════════════════════════════
   COMMERCE
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:704] BUYS
var BUYS  = [
  { res:'Gold',     qty:120, price:7.45,  total:894,  loc:'Lorville',    time:'il y a 25min' },
  { res:'Laranite', qty:50,  price:15.90, total:795,  loc:'Lorville',    time:'il y a 8h' },
  { res:'Beryl',    qty:140, price:9.80,  total:1372, loc:'microTech',   time:'il y a 1j' },
];

// [source main.js:709] SELLS
var SELLS = [
  { res:'Quantanium', qty:45,  price:31.70, total:1382, loc:'Area18',      time:'il y a 10min' },
  { res:'Titanium',   qty:200, price:8.10,  total:1620, loc:'Lorville',    time:'il y a 1h' },
];

// [source main.js:713] ROUTES
var ROUTES = [
  { from:'Lorville',    to:'Area18',      res:'Quantanium', margin:'+27.8%', profit:'+6.90/u' },
  { from:'New Babbage', to:'Lorville',    res:'Diamond',    margin:'+44.8%', profit:'+14.80/u' },
  { from:'Orison',      to:'New Babbage', res:'Gold',       margin:'+69.1%', profit:'+5.15/u' },
  { from:'New Babbage', to:'Orison',      res:'Hephaestanite', margin:'+36.4%', profit:'+6.70/u' },
];

// [source main.js:719] OPPS
var OPPS = [
  { res:'Bexalite', desc:'Prix en hausse +5.1% — acheter maintenant', action:'ACHETER',    color:'var(--green)' },
  { res:'Titanium', desc:'Stock bas à New Babbage — opportunité vente', action:'VENDRE',   color:'var(--blue)' },
  { res:'Laranite', desc:'Réapprovisionnement urgent (<10 restantes)', action:'URGENT',    color:'var(--orange)' },
];

/* ════════════════════════════════════════════════════════════
   PLAYERS STATE
════════════════════════════════════════════════════════════ */

// [source main.js:1870] catLbl
function catLbl(c){ return {mineral:'Minéraux',salvage:'Salvage',resources:'Ressources',equipment:'Équipements',weapons:'Armement',accessories:'Accessoires',other:'Autre'}[c]||c; }

// [source main.js:1871] catCls
function catCls(c){ return 'cat-'+c; }

// [source main.js:1872] spark
function spark(r){
  const pts=Array.from({length:7},(_,i)=>(r.sell||1)*(0.95+Math.sin(i*2.3+(r.buy||0))*0.08));
  const mn=Math.min(...pts),mx=Math.max(...pts),rng=mx-mn||1;
  const d=pts.map((v,i)=>`${i===0?'M':'L'}${i*8},${12-(v-mn)/rng*10}`).join(' ');
  const c=(r.delta||0)>=0?'#00ffa3':'#ff4444';
  return `<svg width="50" height="14" class="spark"><path d="${d}" fill="none" stroke="${c}" stroke-width="1.2"/></svg>`;
}

// Cache des prix marché par ressource (pour enrichir les stocks joueurs)

// [source main.js:1881] MARKET_PRICES
var MARKET_PRICES = {};
RESOURCES.forEach(r=>{ MARKET_PRICES[r.name.toLowerCase()] = r; });

// Construit une ligne de données unifiée depuis un stock joueur

// [source main.js:2119] openTelosPopup
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

// [source main.js:2201] closeTelosPopup
function closeTelosPopup(){ document.getElementById('telos-popup').classList.remove('open'); }



/* ════════════════════════════════════════════════════════════
   RENDER: COMMERCE
════════════════════════════════════════════════════════════ */

// [source main.js:2208] renderCommerce
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

// [source main.js:2566] fluctuate
async function fluctuate(){
  // Fluctuation des prix marché uniquement — ne touche plus aux KPI stock/profit
  RESOURCES.forEach(r=>{ r.sell=Math.max(r.buy*1.05, r.sell*(1+(Math.random()-0.48)*0.07)); r.delta=+(r.delta+(Math.random()-0.5)*0.3).toFixed(1); });
  renderPrices(); renderTopRes();
}

/* ════════════════════════════════════════════════════════════
   MODAL (generic)
════════════════════════════════════════════════════════════ */

