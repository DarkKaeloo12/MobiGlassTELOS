/* ════════════════════════════════════════════════════════════
   DATA RESSOURCE — catalogue + sync UEX
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:2747] RESSOURCE_CATALOGUE
var RESSOURCE_CATALOGUE = [];

// [source main.js:2748] _resCatFilter
var _resCatFilter = 'all';


// [source main.js:2750] CAT_LABELS
var CAT_LABELS = {
  mineral:'⛏ Minéraux', salvage:'🔧 Salvage', ressources:'📦 Ressources',
  equipements:'🛡 Équipements', armement:'⚔ Armement', accessoires:'🎒 Accessoires', autre:'○ Autre'
};


// [source main.js:2755] loadRessourceCatalogue
async function loadRessourceCatalogue() {
  const stored = await DB.get('telos-ressource-catalogue');
  if (stored && stored.length) {
    RESSOURCE_CATALOGUE = stored;
  } else {
    // Pas de catalogue stocké — on utilise syncFromUEXLocal comme fallback
    syncFromUEXLocal();
  }
}



// [source main.js:2766] setResFilter
function setResFilter(f, btn) {
  _resCatFilter = f;
  document.querySelectorAll('#panel-ressources .filter-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderRessources();
}


// [source main.js:2773] renderRessources
async function renderRessources() {
  const tbody = document.getElementById('res-tbody');
  if (!tbody) return;
  if (!canManageRoles()) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">Acces reserve aux Admins et Gestionnaires.</td></tr>';
    return;
  }
  const search = (document.getElementById('res-search')?.value||'').toLowerCase();
  let data = [...RESSOURCE_CATALOGUE];
  if (_resCatFilter !== 'all') data = data.filter(r=>r.cat===_resCatFilter);
  if (search) data = data.filter(r=>r.name.toLowerCase().includes(search)||(r.desc||'').toLowerCase().includes(search));
  data.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  const countEl = document.getElementById('res-count');
  if (countEl) countEl.textContent = data.length + ' ressource'+(data.length>1?'s':'');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">Aucune ressource — cliquez sur + AJOUTER</td></tr>';
    return;
  }
  const stockStats = {};
  for (const p of players) {
    const stocks = (await DB.get('uex-stocks-'+p.id))||[];
    for (const s of stocks) {
      if (!s.res) continue;
      const key = s.res.toLowerCase().trim();
      if (!stockStats[key]) stockStats[key]={qty:0,partners:new Set()};
      stockStats[key].qty += Number(s.qty)||0;
      stockStats[key].partners.add(p.id);
    }
  }
  const qBadge = (q) => q&&QUALITY_META[q]?.label
    ? '<span style="color:'+QUALITY_META[q].color+';font-size:10px;">'+QUALITY_META[q].label+'</span>'
    : '<span style="color:var(--text-dim);font-size:10px;">—</span>';
  tbody.innerHTML = data.map(r => {
    const key = r.name.toLowerCase().trim();
    const st = stockStats[key]||{qty:0,partners:new Set()};
    // margin calculée dans le rendu td ci-dessous
    return '<tr>'
      +'<td style="font-weight:700;color:var(--text-bright);">◈ '+esc(r.name)+(r.fromUEX?'<span style="font-size:8px;margin-left:5px;padding:1px 5px;border:1px solid rgba(89,208,255,0.4);color:var(--blue);letter-spacing:1px;">UEX</span>':'')+(r.desc?'<div style="font-size:10px;color:var(--text-dim);">'+esc(r.desc)+'</div>':'')+'</td>'
      +'<td><span style="font-size:11px;padding:2px 7px;border:1px solid var(--border);color:var(--text-dim);">'+(CAT_LABELS[r.cat]||r.cat)+'</span></td>'
      +'<td>'+qBadge(r.quality)+'</td>'
      +(()=>{
        const bMin = r.buyMin || r.buyRef || 0;
        const sMax = r.sellMax || r.sellRef || 0;
        const margin2 = bMin>0&&sMax>0 ? ((sMax-bMin)/bMin*100).toFixed(1) : null;
        return '<td class="td-dim">'
          + (bMin ? '<span style="font-size:11px;">'+bMin.toLocaleString('fr-FR')+' aUEC</span>'
            + '<div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;">ACHAT MIN</div>' : '—')
          + '</td>'
          + '<td style="color:var(--green);">'
          + (sMax ? '<span style="font-size:11px;">'+sMax.toLocaleString('fr-FR')+' aUEC</span>'
            + '<div style="font-size:9px;color:var(--text-dim);letter-spacing:1px;">VENTE MAX</div>' : '—')
          + (margin2 ? '<div style="font-size:9px;color:var(--orange);">+'+margin2+'%</div>' : '')
          + '</td>';
      })()
      
      +'</tr>';
  }).join('');
}


// [source main.js:2832] goToRessources
function goToRessources(el) {
  if (!canManageRoles()) { toast('Acces refuse','Reserve aux Admins et Gestionnaires.','error'); return; }
  goPanel('ressources', el);
}


// [source main.js:4732] UEX_API_BASE
var UEX_API_BASE = 'https://api.uexcorp.uk/2.0';

// [source main.js:4733] _uexSyncRunning
var _uexSyncRunning = false;


// [source main.js:4735] syncFromUEX
async function syncFromUEX() {
  if (_uexSyncRunning) return;
  if (!canManageRoles()) { toast('Accès refusé','','error'); return; }

  _uexSyncRunning = true;
  const btn    = document.getElementById('btn-uex-sync');
  const status = document.getElementById('uex-sync-status');
  if (btn)    btn.textContent = '⏳ Sync...';
  if (status) status.textContent = 'Connexion à UEXCorp API...';

  const BEARER   = '0b7797b0ee37052d9c8dfe493305b7a2d1ab8f43';
  const API_BASE = 'https://api.uexcorp.uk/2.0';

  async function apiFetch(endpoint) {
    const url = API_BASE + '/' + endpoint;
    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + BEARER };
    // Stratégies dans l'ordre : direct d'abord (fonctionne si CORS OK), puis proxies
    const strategies = [
      () => fetch(url, { headers }),
      () => fetch('https://corsproxy.io/?' + encodeURIComponent(url), { headers }),
      () => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url)),
      () => fetch('https://corsproxy.io/?' + encodeURIComponent(url)),
    ];
    let lastErr;
    for (const attempt of strategies) {
      try {
        const r = await attempt();
        if (!r.ok) { if (r.status === 429) throw new Error('429'); throw new Error('HTTP ' + r.status); }
        const j = await r.json();
        if (j && j.status === 'ok' && j.data !== undefined) return j.data;
        if (Array.isArray(j)) return j;
        if (j && typeof j === 'object' && !j.status) return j; // réponse brute
        throw new Error(j?.message || 'Réponse invalide');
      } catch(e) {
        lastErr = e;
        // Ne pas réessayer sur 429 (rate limit) — attendre
        if (e.message === '429') { await new Promise(r => setTimeout(r, 2000)); }
      }
    }
    throw lastErr || new Error('Échec toutes stratégies');
  }

  try {
    // ── ÉTAPE 1 : Liste des commodités ──
    if (status) status.textContent = 'Récupération des commodités...';
    const commodities = await apiFetch('commodities');
    if (!commodities || !commodities.length) throw new Error('Aucune commodité reçue');

    // ── ÉTAPE 2 : Prix min achat / max vente ──
    // On utilise les champs de prix directement dans l'objet commodities
    // puis on tente commodities_prices_all (1 seule requête globale) pour les min/max précis
    if (status) status.textContent = 'Récupération des prix...';
    const priceMap = {};

    // D'abord : extraire les prix déjà dans commodities (fallback garanti)
    commodities.forEach(com => {
      const cid = com.id || com.id_commodity;
      if (!cid) return;
      priceMap[cid] = {
        buy:  Number(com.price_buy_min  || com.price_buy  || com.trade_price_buy  || com.buy  || 0),
        sell: Number(com.price_sell_max || com.price_sell || com.trade_price_sell || com.sell || 0),
      };
    });

    // Ensuite : commodities_prices par batch de 10 terminaux
    try {
      if (status) status.textContent = 'Chargement liste terminaux...';
      const terminals1 = await apiFetch('terminals?id_star_system=68');
      const terminals2 = await apiFetch('terminals?id_star_system=64');
      const termArr = [...(Array.isArray(terminals1) ? terminals1 : []), ...(Array.isArray(terminals2) ? terminals2 : [])];
      const ids = termArr.map(t => t.id).filter(Boolean);
      const batches = [];
      for (var _i = 0; _i < ids.length; _i += 10) batches.push(ids.slice(_i, _i + 10));

      var allPrices = [];
      for (var _b = 0; _b < batches.length; _b++) {
        if (status) status.textContent = 'Prix terminaux ' + (_b * 10 + 1) + '/' + ids.length + '...';
        try {
          var _chunk = await apiFetch('commodities_prices?id_terminal=' + batches[_b].join(','));
          if (Array.isArray(_chunk)) allPrices = allPrices.concat(_chunk);
        } catch(e) {}
        await new Promise(r => setTimeout(r, 150));
      }

      if (allPrices.length > 0) {
        const agg = {};
        allPrices.forEach(p => {
          const cid = p.id_commodity;
          if (!cid) return;
          const buy  = Number(p.price_buy_min  || p.price_buy  || 0);
          const sell = Number(p.price_sell_max || p.price_sell || 0);
          if (!agg[cid]) agg[cid] = { buys:[], sells:[] };
          if (buy  > 0) agg[cid].buys.push(buy);
          if (sell > 0) agg[cid].sells.push(sell);
        });
        Object.entries(agg).forEach(([cid, {buys, sells}]) => {
          priceMap[cid] = {
            buy:  buys.length  ? Math.min(...buys)  : (priceMap[cid]?.buy  || 0),
            sell: sells.length ? Math.max(...sells) : (priceMap[cid]?.sell || 0),
          };
        });
        if (status) status.textContent = allPrices.length + ' prix chargés (' + ids.length + ' terminaux)';
      }
    } catch(e) {
      if (status) status.textContent = 'Fallback prix inline';
    }

    // ── ÉTAPE 3 : Mapping catégories UEX → TELOS ──
    const catMap = {
      'Mineral':'mineral','Gas':'mineral','Metal':'mineral','Ore':'mineral',
      'Salvage':'salvage','Scrap':'salvage',
      'Agricultural':'ressources','Food':'ressources','Medical':'ressources',
      'Drug':'ressources','Liquid':'ressources',
      'Weapon':'armement','Ammunition':'armement',
      'Armor':'equipements','Component':'equipements','Electronics':'equipements',
      'Consumable':'accessoires','Personal':'accessoires',
      'Other':'autre','Data':'autre',
    };

    const now = new Date().toISOString();
    let added = 0, updated = 0;

    commodities.forEach(c => {
      const name  = (c.name || c.commodity_name || '').trim();
      if (!name) return;
      const cid   = c.id || c.id_commodity;
      const cat   = catMap[c.kind || c.category] || 'autre';
      const pData = priceMap[cid] || {};
      const buyRef  = pData.buy  || Number(c.price_buy  || 0);
      const sellRef = pData.sell || Number(c.price_sell || 0);

      const pEntry = priceMap[cid] || {};
      const buyMin  = pEntry.buy  || buyRef;   // min achat  (ou fallback)
      const sellMax = pEntry.sell || sellRef;  // max vente  (ou fallback)
      const terminals = pEntry.terminals || 0;

      const existing = RESSOURCE_CATALOGUE.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (buyMin  > 0) { existing.buyRef  = buyMin;  existing.buyMin  = buyMin; }
        if (sellMax > 0) { existing.sellRef = sellMax; existing.sellMax = sellMax; }
        if (terminals)     existing.terminals = terminals;
        existing.cat       = existing.cat || cat;
        existing.fromUEX   = true;
        existing.uexId     = cid;
        existing.updatedAt = now;
        updated++;
      } else {
        RESSOURCE_CATALOGUE.push({
          id:      'r_uex_' + (cid || Date.now() + '_' + Math.random().toString(36).slice(2,5)),
          name, cat, quality: '', buyRef: buyMin, sellRef: sellMax,
          buyMin, sellMax, terminals,
          desc: c.description || '',
          fromUEX: true, uexId: cid, addedAt: now, updatedAt: now
        });
        added++;
      }
    });

    // ── ÉTAPE 4 : Sauvegarde & mise à jour UI ──
    await DB.set('telos-ressource-catalogue', RESSOURCE_CATALOGUE);
    await DB.set('telos-last-uex-sync', String(Date.now()));
    await refreshDatalist();
    populateResSelect();
    const _rPanelM = document.getElementById('panel-ressources');
    const _rNavM   = document.getElementById('nav-ressources');
    if (_rPanelM && !_rPanelM.classList.contains('active')) {
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
      _rPanelM.classList.add('active');
      if (_rNavM) _rNavM.classList.add('active');
    }
    await renderRessources();

    const priced = Object.keys(priceMap).length;
    const msg = added + ' ajoutées, ' + updated + ' mises à jour (' + priced + ' prix récupérés)';
    if (status) status.textContent = '✓ ' + msg + ' · ' + new Date().toLocaleTimeString('fr-FR');
    if (btn)    btn.textContent = '↻ SYNC UEX';
    pushLog('system','SYSTEM','Sync UEX API : ' + msg);
    toast('Catalogue UEX synchronisé', msg, 'success');

  } catch(err) {
    if (status) status.textContent = '⚠ API inaccessible — fallback local';
    if (btn)    btn.textContent = '↻ SYNC UEX';
    pushLog('system','SYSTEM','Sync UEX échoué : ' + err.message + ' — fallback local');
    toast('API inaccessible', err.message, 'info');
    syncFromUEXLocal();
  } finally {
    _uexSyncRunning = false;
  }
}

// Fallback avec données embarquées (si CORS bloque)

// [source main.js:4927] syncFromUEXLocal
async function syncFromUEXLocal() {
  const now = new Date().toISOString();
  const LOCAL_DATA = [
    // buyRef = achat min (moins cher tous terminaux), sellRef = vente max (plus cher)
    {name:'Agricium',          cat:'mineral',    buyRef:8200,   sellRef:12800},
    {name:'Agricultural Supplies',cat:'ressources',buyRef:1100, sellRef:1800},
    {name:'Aluminum',          cat:'mineral',    buyRef:3100,   sellRef:4300},
    {name:'Amioshi Plague',    cat:'ressources', buyRef:20000,  sellRef:28000},
    {name:'Ammonia',           cat:'mineral',    buyRef:800,    sellRef:1300},
    {name:'Aphorite',          cat:'mineral',    buyRef:89000,  sellRef:118000},
    {name:'Argon',             cat:'mineral',    buyRef:380,    sellRef:520},
    {name:'Aslarite',          cat:'mineral',    buyRef:4400,   sellRef:6200},
    {name:'Astatine',          cat:'mineral',    buyRef:2900,   sellRef:4200},
    {name:'Atlasium',          cat:'mineral',    buyRef:79000,  sellRef:108000},
    {name:'Audio Visual Equipment',cat:'equipements',buyRef:29000,sellRef:43000},
    {name:'Altruciatoxin',     cat:'ressources', buyRef:5400,   sellRef:7800},
    {name:'Beradom',           cat:'mineral',    buyRef:122000, sellRef:172000},
    {name:'Beryl',             cat:'mineral',    buyRef:16800,  sellRef:24000},
    {name:'Bexalite',          cat:'mineral',    buyRef:24000,  sellRef:34500},
    {name:'Bioplastic',        cat:'ressources', buyRef:6400,   sellRef:9200},
    {name:'Borase',            cat:'mineral',    buyRef:23000,  sellRef:33000},
    {name:'Carbon',            cat:'mineral',    buyRef:290,    sellRef:430},
    {name:'Carbon Silk',       cat:'ressources', buyRef:17500,  sellRef:25000},
    {name:'Cave Kopion Horn',  cat:'ressources', buyRef:29000,  sellRef:43000},
    {name:'CK13 Gid Seed Blend',cat:'ressources',buyRef:440,   sellRef:640},
    {name:'Chlorine',          cat:'mineral',    buyRef:1200,   sellRef:1800},
    {name:'Cobalt',            cat:'mineral',    buyRef:17500,  sellRef:25000},
    {name:'Compboard',         cat:'equipements',buyRef:24500,  sellRef:36000},
    {name:'Construction Materials',cat:'equipements',buyRef:10500,sellRef:15500},
    {name:'Copper',            cat:'mineral',    buyRef:3100,   sellRef:4500},
    {name:'Corundum',          cat:'mineral',    buyRef:3100,   sellRef:4500},
    {name:'DCSR2',             cat:'ressources', buyRef:1000,   sellRef:1500},
    {name:'Degnous Root',      cat:'ressources', buyRef:50000,  sellRef:73000},
    {name:'Diamond Laminate',  cat:'mineral',    buyRef:73000,  sellRef:105000},
    {name:'Diamond',           cat:'mineral',    buyRef:6300,   sellRef:9200},
    {name:'Distilled Spirits', cat:'ressources', buyRef:1600,   sellRef:2400},
    {name:'Dolivine',          cat:'mineral',    buyRef:122000, sellRef:178000},
    {name:'Dymantium',         cat:'mineral',    buyRef:19000,  sellRef:28000},
    {name:'Dynaflex',          cat:'equipements',buyRef:1600,   sellRef:2400},
    {name:'Etam',              cat:'mineral',    buyRef:19500,  sellRef:28500},
    {name:'Feynmaline',        cat:'mineral',    buyRef:285000, sellRef:415000},
    {name:'Fresh Food',        cat:'ressources', buyRef:21000,  sellRef:30500},
    {name:'Fluorine',          cat:'mineral',    buyRef:1100,   sellRef:1600},
    {name:'Foam',              cat:'equipements',buyRef:5300,   sellRef:7700},
    {name:'Gasping Weevil Eggs',cat:'ressources',buyRef:53000,  sellRef:77000},
    {name:'Glacosite',         cat:'mineral',    buyRef:82000,  sellRef:120000},
    {name:'Gold',              cat:'mineral',    buyRef:25000,  sellRef:37000},
    {name:'Golden Medmon',     cat:'ressources', buyRef:49500,  sellRef:72000},
    {name:'Hadanite',          cat:'mineral',    buyRef:455000, sellRef:660000},
    {name:'Heart Of The Woods',cat:'ressources', buyRef:30000,  sellRef:44000},
    {name:'Helium',            cat:'mineral',    buyRef:850,    sellRef:1250},
    {name:'Hephaestanite',     cat:'mineral',    buyRef:3900,   sellRef:5700},
    {name:'Human Food Bars',   cat:'ressources', buyRef:410,    sellRef:600},
    {name:'Hydrogen Fuel',     cat:'mineral',    buyRef:150,    sellRef:220},
    {name:'Hydrogen',          cat:'mineral',    buyRef:850,    sellRef:1250},
    {name:'Irradiated Kopion Horn',cat:'ressources',buyRef:29000,sellRef:43000},
    {name:'Iodine',            cat:'mineral',    buyRef:9600,   sellRef:14000},
    {name:'Iron',              cat:'mineral',    buyRef:2800,   sellRef:4100},
    {name:'Janalite',          cat:'mineral',    buyRef:2400000,sellRef:3500000},
    {name:'Kopion Horn',       cat:'ressources', buyRef:29000,  sellRef:43000},
    {name:'Laranite',          cat:'mineral',    buyRef:7200,   sellRef:10500},
    {name:'Lindinium',         cat:'mineral',    buyRef:39000,  sellRef:57000},
    {name:'Luminalia Gift',    cat:'autre',      buyRef:4250000,sellRef:6200000},
    {name:'Marok Gem',         cat:'ressources', buyRef:42000,  sellRef:61000},
    {name:'Maze',              cat:'ressources', buyRef:2400,   sellRef:3500},
    {name:'Medical Supplies',  cat:'equipements',buyRef:12500,  sellRef:18500},
    {name:'Mercury',           cat:'mineral',    buyRef:9200,   sellRef:13500},
    {name:'Methane',           cat:'mineral',    buyRef:1600,   sellRef:2400},
    {name:'Neograph',          cat:'mineral',    buyRef:7600,   sellRef:11000},
    {name:'Neon',              cat:'mineral',    buyRef:5000,   sellRef:7300},
    {name:'Nitrogen',          cat:'mineral',    buyRef:2600,   sellRef:3800},
    {name:'Omnapoxy',          cat:'equipements',buyRef:7000,   sellRef:10200},
    {name:'Organics',          cat:'ressources', buyRef:1100,   sellRef:1700},
    {name:'Osoian Hides',      cat:'ressources', buyRef:42000,  sellRef:61000},
    {name:'Ouratite',          cat:'mineral',    buyRef:36000,  sellRef:52000},
    {name:'Partillium',        cat:'mineral',    buyRef:11500,  sellRef:16800},
    {name:'Pitambu',           cat:'ressources', buyRef:5000,   sellRef:7300},
    {name:'Potassium',         cat:'mineral',    buyRef:2900,   sellRef:4200},
    {name:'Pressurized Ice',   cat:'mineral',    buyRef:8500,   sellRef:12500},
    {name:'Processed Food',    cat:'ressources', buyRef:2300,   sellRef:3400},
    {name:'Prota',             cat:'ressources', buyRef:13500,  sellRef:19700},
    {name:'Quantanium',        cat:'mineral',    buyRef:128000, sellRef:186000},
    {name:'Quantum Fuel',      cat:'mineral',    buyRef:1200,   sellRef:1800},
    {name:'Quartz',            cat:'mineral',    buyRef:2900,   sellRef:4200},
    {name:'Ranta Dung',        cat:'ressources', buyRef:4200,   sellRef:6100},
    {name:'Recycled Material Composite',cat:'salvage',buyRef:1200,sellRef:1800},
    {name:'Revenant Pod',      cat:'ressources', buyRef:47000,  sellRef:68000},
    {name:'Revenant Tree Pollen',cat:'ressources',buyRef:47000, sellRef:68000},
    {name:'Riccite',           cat:'mineral',    buyRef:49000,  sellRef:71000},
    {name:'Sadaryx',           cat:'mineral',    buyRef:9600,   sellRef:14000},
    {name:'Savrilium',         cat:'mineral',    buyRef:18500,  sellRef:27000},
    {name:'Scrap',             cat:'salvage',    buyRef:820,    sellRef:1300},
    {name:'Silicon',           cat:'mineral',    buyRef:4100,   sellRef:6000},
    {name:'Slam',              cat:'ressources', buyRef:8000,   sellRef:11700},
    {name:'Souvenirs',         cat:'autre',      buyRef:1000,   sellRef:1500},
    {name:'Steel',             cat:'mineral',    buyRef:5400,   sellRef:7900},
    {name:'Stileron',          cat:'mineral',    buyRef:49000,  sellRef:71000},
    {name:'Stims',             cat:'ressources', buyRef:2900,   sellRef:4300},
    {name:'Sunset Berries',    cat:'ressources', buyRef:5300,   sellRef:7700},
    {name:'Taranite',          cat:'mineral',    buyRef:27000,  sellRef:39000},
    {name:'Tin',               cat:'mineral',    buyRef:2800,   sellRef:4100},
    {name:'Titanium',          cat:'mineral',    buyRef:5200,   sellRef:7600},
    {name:'Torite',            cat:'mineral',    buyRef:3300,   sellRef:4800},
    {name:'Tritium',           cat:'mineral',    buyRef:11500,  sellRef:16800},
    {name:'Tungsten',          cat:'mineral',    buyRef:5400,   sellRef:7900},
    {name:'Waste',             cat:'salvage',    buyRef:690,    sellRef:1100},
    {name:'Widow',             cat:'ressources', buyRef:8000,   sellRef:11700},
    {name:'Wuotan Seed',       cat:'ressources', buyRef:5300,   sellRef:7700},
    {name:'Xapyen',            cat:'mineral',    buyRef:23000,  sellRef:33500},
    {name:'Year Of The Pig Envelope',cat:'autre',buyRef:5000000,sellRef:7300000},
  ];


  let added=0, updated=0;
  LOCAL_DATA.forEach(c => {
    const existing = RESSOURCE_CATALOGUE.find(x => x.name.toLowerCase()===c.name.toLowerCase());
    if (existing) {
      if (c.buyRef  > 0) { existing.buyRef  = c.buyRef;  existing.buyMin  = c.buyRef; }
      if (c.sellRef > 0) { existing.sellRef = c.sellRef; existing.sellMax = c.sellRef; }
      existing.fromUEX=true; existing.updatedAt=now; updated++;
    } else {
      RESSOURCE_CATALOGUE.push({
        id:'r_uex_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
        name:c.name, cat:c.cat, quality:'',
        buyRef:c.buyRef, sellRef:c.sellRef, buyMin:c.buyRef, sellMax:c.sellRef, desc:'',
        fromUEX:true, addedAt:now, updatedAt:now
      });
      added++;
    }
  });
  await DB.set('telos-ressource-catalogue', RESSOURCE_CATALOGUE);
  await DB.set('telos-last-uex-sync', String(Date.now()));
  await refreshDatalist();
  populateResSelect();

  // Forcer l'affichage du panel ressources et re-render
  const _rPanel = document.getElementById('panel-ressources');
  const _rNav   = document.getElementById('nav-ressources');
  if (_rPanel && !_rPanel.classList.contains('active')) {
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    _rPanel.classList.add('active');
    if (_rNav) _rNav.classList.add('active');
  }
  await renderRessources();
  const msg = added+' ajoutées, '+updated+' mises à jour (données locales v4.8.0)';
  const status = document.getElementById('uex-sync-status');
  if (status) status.textContent = '✓ '+msg;
  toast('Catalogue mis à jour', msg, 'success');
}

/* Lance une sync auto au chargement du panel ressources */

// [source main.js:5079] autoSyncUEX
async function autoSyncUEX() {
  const lastSync = await DB.get('telos-last-uex-sync');
  const now = Date.now();
  // Sync auto si la dernière sync date de plus de 30 minutes
  if (!lastSync || now - parseInt(lastSync) > 30 * 60 * 1000) {
    await DB.set('telos-last-uex-sync', String(now));
    syncFromUEX();
  }
}

/* ════════════════════════════════════════════════════════════
   BLUEPRINTS — Catalogue Corp
════════════════════════════════════════════════════════════ */

