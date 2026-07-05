/* ════════════════════════════════════════════════════════════
   PARTENAIRES (liste)
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:2219] renderPartners
async function renderPartners(){
  const search = (document.getElementById('partner-search')||{}).value||'';

  // Charger le cache blueprints si pas encore fait
  if (!window._playerBpCache) window._playerBpCache = {};
  await Promise.all(players.map(async p => {
    if (!window._playerBpCache[p.id]) {
      try {
        const bps = await DB.get('player-blueprints-' + p.id);
        if (bps) window._playerBpCache[p.id] = bps;
      } catch(e) {}
    }
  }));

  // Charger tous les joueurs + leurs stocks
  const data = await Promise.all(players.map(async p => {
    const stocks = (await DB.get('uex-stocks-'+p.id))||[];
    const totalUnits = stocks.reduce((a,s)=>a+Number(s.qty),0);
    const totalVal   = stocks.reduce((a,s)=>a+(s.price||0)*s.qty,0);
    // Valeur marché : enrichir avec prix vente TELOS si dispo
    const marketVal  = stocks.reduce((a,s)=>{
      const m = MARKET_PRICES[s.res.toLowerCase()];
      return a + (m ? m.sell * s.qty : (s.price||0)*s.qty);
    }, 0);
    return { p, stocks, totalUnits, totalVal, marketVal };
  }));

  // KPI réseau total
  const totalPlayers = players.length;
  const totalRes     = data.reduce((a,d)=>a+d.stocks.length,0);
  const totalSCU     = data.reduce((a,d)=>a+d.totalUnits,0);
  const totalMktVal  = data.reduce((a,d)=>a+d.marketVal,0);

  const kpi = document.getElementById('partners-kpi');
  if (kpi) kpi.innerHTML = `
    <div class="gkpi"><div class="gkpi-lbl">Joueurs réseau</div><div class="gkpi-val orange">${totalPlayers}</div></div>
    <div class="gkpi"><div class="gkpi-lbl">Ressources déclarées</div><div class="gkpi-val">${totalRes}</div></div>
    <div class="gkpi"><div class="gkpi-lbl">SCU total réseau</div><div class="gkpi-val">${totalSCU.toLocaleString('fr-FR')}</div></div>
    <div class="gkpi"><div class="gkpi-lbl">Valeur marché totale</div><div class="gkpi-val green">${Math.round(totalMktVal).toLocaleString('fr-FR')} aUEC</div></div>
  `;

  const grid  = document.getElementById('partners-grid');
  const empty = document.getElementById('partners-empty');

  // Filtre recherche
  const filtered = search
    ? data.filter(d=>d.p.name.toLowerCase().includes(search.toLowerCase()) || d.p.role.toLowerCase().includes(search.toLowerCase()))
    : data;

  if (!filtered.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const roleCol = { Trader:'var(--blue)', Mineur:'var(--orange)', Transporteur:'var(--green)', Explorateur:'var(--purple)', Gestionnaire:'var(--red)' };

  grid.innerHTML = filtered.map(({ p, stocks, totalUnits, totalVal, marketVal }) => {
    // Top 3 ressources par valeur
    const top3 = [...stocks]
      .sort((a,b)=>(b.price||0)*b.qty-(a.price||0)*a.qty)
      .slice(0,3);

    const profit = marketVal - totalVal;
    const profitSign = profit >= 0 ? '+' : '';
    const profitCls  = profit >= 0 ? 'var(--green)' : 'var(--red)';

    // Barre de répartition par catégorie
    const catGroups = {};
    stocks.forEach(s=>{ catGroups[s.cat]=(catGroups[s.cat]||0)+Number(s.qty); });
    const totalQ = Object.values(catGroups).reduce((a,v)=>a+v,0)||1;
    const catColors = { mineral:'var(--orange)', metal:'var(--blue)', gas:'var(--green)', rare:'var(--purple)', other:'#aaa' };

    const barParts = Object.entries(catGroups).map(([cat,qty])=>
      `<div style="flex:${qty/totalQ};height:3px;background:${catColors[cat]||'#aaa'};" title="${catLbl(cat)}: ${qty} SCU"></div>`
    ).join('');

    return `
    <div class="partner-card" style="cursor:pointer;" onclick="openPartnerDetail('${p.id}')">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        <div style="
          width:42px;height:42px;flex-shrink:0;
          background:var(--bg);border:1.5px solid var(--orange);
          display:flex;align-items:center;justify-content:center;
          font-size:18px;color:var(--orange);font-weight:700;
          clip-path:polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%);
        ">${avHtml(p,42)}</div>
        <div style="flex:1;min-width:0;">
          <div class="pc-name" style="font-size:15px;">${esc(p.name)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
            ${p.isAdmin
              ? `<span class="pc-rank" style="color:#ffffff;border-color:#ffffff;font-size:8px;padding:1px 6px;">ADMIN</span>`
              : `<span class="pc-rank" style="color:${ROLE_COLORS[p.role]||'var(--text)'};border-color:${ROLE_COLORS[p.role]||'var(--border)'};font-size:8px;padding:1px 6px;">${p.role}</span>
                 ${canManageRoles()?`<span onclick="event.stopPropagation();openEditRole('${p.id}')" title="Modifier le rôle" style="cursor:pointer;font-size:10px;color:var(--text-dim);padding:1px 5px;border:1px solid var(--border);margin-left:3px;" onmouseover="this.style.color='var(--orange)'" onmouseout="this.style.color='var(--text-dim)'">✏</span>`:''}`
            }
            <span style="font-size:9px;color:var(--text-dim);font-family:var(--mono);">depuis ${fmtDate(p.joinedAt)}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
          <div style="text-align:right;">
            <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">STOCK</div>
            <div style="font-family:var(--mono);font-size:14px;color:var(--orange);">${stocks.length} res.</div>
          </div>
          ${((window._playerBpCache&&window._playerBpCache[p.id])||[]).length>0?`
          <div style="text-align:right;">
            <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">BLUEPRINTS</div>
            <div style="font-family:var(--mono);font-size:14px;color:#60a5fa;">${((window._playerBpCache&&window._playerBpCache[p.id])||[]).length} 📐</div>
          </div>`:''}
        </div>
      </div>

      <!-- Liens RSI/TELOS -->
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
        <a href="${esc(p.rsi)}" target="_blank" rel="noopener" class="prof-link" onclick="event.stopPropagation()" style="font-size:9px;padding:2px 7px;">
          <span class="ll">RSI</span>${shortUrl(p.rsi)}
        </a>
        ${p.uex ? `<a href="${esc(p.uex)}" target="_blank" rel="noopener" class="prof-link" onclick="event.stopPropagation()" style="font-size:9px;padding:2px 7px;"><span class="ll">UEX</span>${shortUrl(p.uex)}</a>` : ''}
      </div>

      <!-- Stats principales -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
        <div>
          <div style="font-family:var(--mono);font-size:14px;color:var(--text-bright);">${totalUnits.toLocaleString('fr-FR')}</div>
          <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">SCU total</div>
        </div>
        <div>
          <div style="font-family:var(--mono);font-size:14px;color:var(--orange);">${Math.round(totalVal).toLocaleString('fr-FR')}</div>
          <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">Valeur achat</div>
        </div>
        <div>
          <div style="font-family:var(--mono);font-size:14px;color:${profitCls};">${profitSign}${Math.round(profit).toLocaleString('fr-FR')}</div>
          <div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">P/L marché</div>
        </div>
      </div>

      <!-- Valeur marché totale -->
      <div style="background:var(--bg);border:1px solid var(--border);padding:6px 10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase;">Valeur marché</span>
        <span style="font-family:var(--mono);font-size:13px;color:var(--green);">${Math.round(marketVal).toLocaleString('fr-FR')} aUEC</span>
      </div>

      <!-- Top 3 ressources -->
      ${top3.length ? `
      <div style="margin-bottom:8px;">
        <div style="font-size:8px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;">Top ressources</div>
        ${top3.map(s=>{
          const m = MARKET_PRICES[s.res.toLowerCase()];
          const sellVal = m ? m.sell * s.qty : (s.price||0)*s.qty;
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(247,140,30,0.05);">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="cat-badge cat-${s.cat}" style="font-size:7px;padding:1px 5px;">${catLbl(s.cat)}</span>
              <span style="font-size:11px;color:var(--text-bright);font-weight:600;">◈ ${esc(s.res)}</span>${s.quality&&QUALITY_META[s.quality]?.label?`<div style='font-size:9px;margin-top:1px;color:${QUALITY_META[s.quality].color};'>${QUALITY_META[s.quality].label}</div>`:''}
              ${(()=>{const _t=getUexTier(s.res);return _t?`<div style='font-size:9px;margin-top:1px;color:${_t.color};letter-spacing:0.5px;'>${_t.label}</div>`:'';})()} 
            </div>
            <div style="text-align:right;">
              <span style="font-family:var(--mono);font-size:10px;color:var(--orange);">${Number(s.qty).toLocaleString('fr-FR')} SCU</span>
              <span style="font-family:var(--mono);font-size:10px;color:var(--green);margin-left:8px;">${Math.round(sellVal).toLocaleString('fr-FR')} aUEC</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div style="font-size:10px;color:var(--text-dim);text-align:center;padding:10px 0;">Aucun stock déclaré</div>`}

      <!-- Barre catégories -->
      ${stocks.length ? `
      <div style="margin-top:18px;">
        <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;margin-bottom:3px;">RÉPARTITION</div>
        <div style="display:flex;height:3px;gap:1px;border-radius:2px;overflow:hidden;">${barParts}</div>
        <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
          ${Object.entries(catGroups).map(([cat,qty])=>`
            <span style="font-size:8px;color:${catColors[cat]||'#aaa'};">● ${catLbl(cat)} (${qty})</span>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- Bouton voir profil + supprimer -->
      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:9px;color:var(--orange);letter-spacing:1px;text-transform:uppercase;">Voir stock complet →</span>
        ${canManageRoles() ? `<button onclick="event.stopPropagation();confirmDeletePlayer('${p.id}','${esc(p.name)}')"
          style="padding:2px 9px;border:1px solid rgba(255,68,68,0.4);background:transparent;color:var(--red);font-family:var(--ui);font-size:9px;letter-spacing:1px;cursor:pointer;text-transform:uppercase;"
          onmouseover="this.style.background='rgba(255,68,68,0.1)'" onmouseout="this.style.background='transparent'">✕ Supprimer</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* Ouvrir la modale de détail stock d'un joueur depuis Partenaires */

// [source main.js:2406] openPartnerDetail
async function openPartnerDetail(pid) {
  const p = players.find(x=>x.id===pid);
  if (!p) return;
  const stocks = (await DB.get('uex-stocks-'+pid))||[];

  document.getElementById('pd-title').textContent = `⬡ ${p.name.toUpperCase()} — STOCK COMPLET`;

  const totalVal  = stocks.reduce((a,s)=>a+(s.price||0)*s.qty,0);
  const totalUnits= stocks.reduce((a,s)=>a+Number(s.qty),0);
  const marketVal = stocks.reduce((a,s)=>{ const m=MARKET_PRICES[s.res.toLowerCase()]; return a+(m?m.sell*s.qty:(s.price||0)*s.qty); },0);
  const profit    = marketVal - totalVal;

  document.getElementById('pd-body').innerHTML = `
    <!-- Hero -->
    <div style="padding:16px 18px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;gap:14px;align-items:center;">
      <div style="width:50px;height:50px;background:var(--bg);border:2px solid var(--orange);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--orange);clip-path:polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%);overflow:hidden;">${avHtml(p,50)}</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:700;color:var(--text-bright);">${esc(p.name)}</div>
        <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;">
          <a href="${esc(p.rsi)}" target="_blank" class="prof-link" style="font-size:9px;padding:2px 8px;"><span class="ll">RSI</span>${shortUrl(p.rsi)}</a>
          ${p.uex?`<a href="${esc(p.uex)}" target="_blank" class="prof-link" style="font-size:9px;padding:2px 8px;"><span class="ll">UEX</span>${shortUrl(p.uex)}</a>`:''}
        </div>
      </div>
      <div style="display:flex;gap:16px;">
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:16px;color:var(--orange);">${stocks.length}</div>
          <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;">RES.</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:16px;color:var(--text-bright);">${totalUnits.toLocaleString('fr-FR')}</div>
          <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;">SCU</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:16px;color:var(--green);">${Math.round(marketVal).toLocaleString('fr-FR')}</div>
          <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;">aUEC MKT</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:var(--mono);font-size:16px;color:${profit>=0?'var(--green)':'var(--red)'};">${profit>=0?'+':''}${Math.round(profit).toLocaleString('fr-FR')}</div>
          <div style="font-size:8px;color:var(--text-dim);letter-spacing:1px;">P/L</div>
        </div>
      </div>
    </div>

    <!-- Table stocks -->
    ${stocks.length ? `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:var(--bg2);">
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:left;border-bottom:1px solid var(--border);">Ressource</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:left;border-bottom:1px solid var(--border);">Catégorie</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">SCU</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Prix achat</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Prix marché</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Valeur achat</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:right;border-bottom:1px solid var(--border);">Valeur marché</th>
          <th style="padding:7px 14px;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);text-align:left;border-bottom:1px solid var(--border);">Localisation</th>
        </tr>
      </thead>
      <tbody>
        ${stocks.map(s=>{
          const m = MARKET_PRICES[s.res.toLowerCase()];
          const sellPrice = m ? m.sell : 0;
          const buyVal    = (s.price||0)*s.qty;
          const sellVal   = sellPrice * s.qty;
          const diff      = sellVal - buyVal;
          return `<tr style="border-bottom:1px solid rgba(247,140,30,0.05);">
            <td style="padding:8px 14px;font-weight:600;color:var(--text-bright);font-size:12px;">◈ ${esc(s.res)}</td>
            <td style="padding:8px 14px;"><span class="cat-badge cat-${s.cat}" style="font-size:8px;">${catLbl(s.cat)}</span></td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:12px;color:var(--orange);">${Number(s.qty).toLocaleString('fr-FR')}</td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--text-dim);">${s.price?s.price.toFixed(2)+' aUEC':'—'}</td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:11px;">${sellPrice?sellPrice.toFixed(2)+' aUEC':'—'}</td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--text-dim);">${buyVal?Math.round(buyVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
            <td style="padding:8px 14px;text-align:right;font-family:var(--mono);font-size:11px;color:var(--green);">${sellVal?Math.round(sellVal).toLocaleString('fr-FR')+' aUEC':'—'}</td>
            <td style="padding:8px 14px;font-size:10px;color:var(--text-dim);">${esc(s.loc)}</td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:var(--bg2);border-top:1px solid var(--border);">
          <td colspan="2" style="padding:8px 14px;font-size:10px;font-weight:700;color:var(--text-dim);letter-spacing:1px;">TOTAL</td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--orange);font-weight:700;">${totalUnits.toLocaleString('fr-FR')}</td>
          <td colspan="2"></td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--text-dim);font-weight:700;">${Math.round(totalVal).toLocaleString('fr-FR')} aUEC</td>
          <td style="padding:8px 14px;text-align:right;font-family:var(--mono);color:var(--green);font-weight:700;">${Math.round(marketVal).toLocaleString('fr-FR')} aUEC</td>
          <td></td>
        </tr>
      </tfoot>
    </table>` : `<div style="padding:30px;text-align:center;color:var(--text-dim);font-size:11px;letter-spacing:1px;">Aucun stock déclaré par ce joueur.</div>`}

    <!-- Boutons action -->
    <div style="padding:12px 18px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end;background:var(--bg2);">
      <button class="btn primary" onclick="closePartnerDetail();goPanel('joueurs');setTimeout(()=>selectPlayer('${pid}'),80);">Voir le stock →</button>
      <button class="btn" onclick="closePartnerDetail()">Fermer</button>
    </div>
  `;

  document.getElementById('partner-detail-overlay').classList.add('open');
}


// [source main.js:2505] closePartnerDetail
function closePartnerDetail(){
  document.getElementById('partner-detail-overlay').classList.remove('open');
}

/* ════════════════════════════════════════════════════════════
   RENDER: MISSIONS
════════════════════════════════════════════════════════════ */

