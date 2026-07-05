/* ════════════════════════════════════════════════════════════
   HUB — dashboard, carte Stanton 3D, KPIs, graphiques
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:247] _pushKPI
function _pushKPI(valAchat, profit, nbRes, nbPartners) {
  const prevVal     = _kpiPrev.val;
  const prevProfit  = _kpiPrev.profit;
  const prevRes     = _kpiPrev.res;
  const prevPart    = _kpiPrev.partners;

  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const setD = (id, delta, unit) => {
    const el=document.getElementById(id); if(!el) return;
    if(delta===0){ el.textContent='—'; el.className='kpi-d'; return; }
    const sign = delta>0 ? '▲ +' : '▼ ';
    el.textContent = sign + Math.abs(Math.round(delta)).toLocaleString('fr-FR') + unit + ' (session)';
    el.className = 'kpi-d ' + (delta>0 ? 'up' : 'down');
  };

  set('kpi-stock',    Math.round(valAchat).toLocaleString('fr-FR') + ' aUEC');
  set('kpi-profit',   (profit>=0?'+':'') + Math.round(profit).toLocaleString('fr-FR') + ' aUEC');
  set('kpi-res',      nbRes.toLocaleString('fr-FR'));
  set('kpi-partners', String(nbPartners));

  const hasPrev = prevVal>0 || prevRes>0;
  if (hasPrev) {
    setD('kpi-res-d',      nbRes      - prevRes,   ' res.');
    setD('kpi-partners-d', nbPartners - prevPart,  ' partenaire'+(Math.abs(nbPartners-prevPart)>1?'s':''));
  }
  _kpiPrev = { val:valAchat, profit, res:nbRes, partners:nbPartners };
}


// [source main.js:275] updateKPIs
async function updateKPIs() {
  // Déclenche renderStocksFromPlayers qui calcule fA/fP et appelle _pushKPI
  await renderStocksFromPlayers();
}

// Valeurs de référence pour les deltas

// [source main.js:281] _kpiPrev
var _kpiPrev = { val: 0, profit: 0, res: 0, partners: 0 };

/* ════════════════════════════════════════════════════════════
   HELPER — Rendu avatar universel
════════════════════════════════════════════════════════════ */

// [source main.js:738] tick
function tick(){
  const n = new Date();
  document.getElementById('clock').textContent    = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  document.getElementById('dateline').textContent = `${pad(n.getDate())} / ${pad(n.getMonth()+1)} / 2956`;
}


/* ════════════════════════════════════════════
   STANTON MAP — v6 : positions exactes calées sur carte SC 3.9.1
   Tout fixe. Vue Commerce = interactive.
════════════════════════════════════════════ */

// [source main.js:749] mapView
var mapView = 'global';

// [source main.js:750] mapCanvas
var mapCanvas, mapCtx, mapW, mapH;

// [source main.js:751] mapAnim
var mapAnim = 0;

// [source main.js:752] hoveredPlanet
var hoveredPlanet = null;

/*
  MÉTHODOLOGIE :
  Image SC 3.9.1 = 1453×780px. Centre Stanton mesuré = (548,391).
  Chaque position mesurée en pixels → convertie en fx=(off_x)/(IW/2), fy=(off_y)/(IH/2).
  Scale global 0.52 appliqué dans pFixed() pour que microTech reste dans le canvas.
  
  Satellites (lunes/stations) : ao (angle en rad depuis la droite, sens trigo standard)
  et dr (distance en fraction de W du canvas, calculée depuis les pixels image).
  H/W ratio image = 780/1453 = 0.537 utilisé pour corriger l'aspect ratio.

  ORBITES SYSTÈME : ellipses 3D inclinées à -12° (ORBIT_TILT).
  Ratio ry/rx = 0.615 (perspective ~51° de hauteur).
  Radii mesurés sur l'image (fraction de IW) :
    Hurston  ≈ 0.116, Crusader ≈ 0.213, ArcCorp ≈ 0.317, microTech ≈ 0.427
*/


// [source main.js:770] ORBIT_TILT
var ORBIT_TILT  = Math.PI * (-0.068);  // -12.24°

// [source main.js:771] ORBIT_RATIO
var ORBIT_RATIO = 0.615;


// [source main.js:773] SYSTEM_ORBITS
var SYSTEM_ORBITS = [
  { ratio:0.190, col:'rgba(90,135,195,0.50)', lw:1.1 }, // Hurston
  { ratio:0.286, col:'rgba(90,135,195,0.48)', lw:1.0 }, // Crusader
  { ratio:0.538, col:'rgba(90,135,195,0.42)', lw:0.95}, // ArcCorp
  { ratio:0.894, col:'rgba(90,135,195,0.36)', lw:0.9 }, // microTech
];

// Planètes — fx/fy mesurés sur image (fraction de IW/2 et IH/2)

// [source main.js:781] PLANETS
var PLANETS = [
  {
    name:'HURSTON', sub:'Lorville',
    fx:+0.1374, fy:+0.2328,
    r:22,
    col1:'#e8834a', col2:'#b5471c', col3:'#7a2d0e', col4:'#2a0e04',
    atmo:'rgba(220,100,50,0.16)', glow:'rgba(200,90,40,0.32)',
    moonOrbit:{ rx:0.060, col:'rgba(200,220,240,0.45)', lw:0.7 },
    stocks:15, partners:8
  },
  {
    name:'CRUSADER', sub:'Orison',
    fx:-0.1648, fy:-0.4167,
    r:26,
    col1:'#f0cc70', col2:'#c8952a', col3:'#8a5e0a', col4:'#3a2502',
    atmo:'rgba(240,200,80,0.18)', glow:'rgba(220,170,60,0.38)',
    moonOrbit:{ rx:0.065, col:'rgba(200,220,240,0.45)', lw:0.7 },
    stocks:9, partners:4
  },
  {
    name:'ARCORP', sub:'Area 18',
    fx:-0.4052, fy:+0.6324,
    r:22,
    col1:'#7aa8e8', col2:'#3a68c0', col3:'#1a3880', col4:'#05091e',
    atmo:'rgba(80,130,240,0.18)', glow:'rgba(60,110,220,0.32)',
    moonOrbit:{ rx:0.055, col:'rgba(200,220,240,0.45)', lw:0.7 },
    stocks:14, partners:7
  },
  {
    name:'MICROTECH', sub:'New Babbage',
    fx:+0.8379, fy:-0.5564,
    r:22,
    col1:'#d0e8f8', col2:'#88b8d8', col3:'#3870a0', col4:'#0c2030',
    atmo:'rgba(150,200,255,0.20)', glow:'rgba(120,180,240,0.32)',
    moonOrbit:{ rx:0.055, col:'rgba(200,220,240,0.45)', lw:0.7 },
    stocks:12, partners:6
  },
];

/*
  ao = angle en radians (atan2 depuis centre planète, déjà corrigé ratio H/W)
  dr = distance en fraction de W du canvas
  Valeurs calculées depuis pixels image SC 3.9.1
*/

// [source main.js:825] MOONS
var MOONS = [
  // Hurston
  { name:'Aberdeen', pi:0, ao:-1.7735, dr:0.0620, moonR:7, col1:'#b8c0c8', col2:'#383e44' },
  { name:'Arial',    pi:0, ao:+1.9456, dr:0.0560, moonR:7, col1:'#c0b8a8', col2:'#3c3428' },
  { name:'Ita',      pi:0, ao:+2.8064, dr:0.0900, moonR:7, col1:'#a8b0b8', col2:'#2c3038' },
  { name:'Magda',    pi:0, ao:+2.3889, dr:0.0680, moonR:7, col1:'#b0a898', col2:'#302820' },
  // Crusader
  { name:'Cellin',   pi:1, ao:-3.0433, dr:0.0820, moonR:7, col1:'#c8d0b0', col2:'#344020' },
  { name:'Daymar',   pi:1, ao:-2.7806, dr:0.0650, moonR:7, col1:'#d0c8b8', col2:'#403830' },
  { name:'Yela',     pi:1, ao:+2.9139, dr:0.0780, moonR:7, col1:'#b8c0c8', col2:'#2a3038' },
  // ArcCorp
  { name:'Wala',     pi:2, ao:-0.4636, dr:0.0480, moonR:7, col1:'#c0b0a0', col2:'#302018' },
  { name:'Lyria',    pi:2, ao:+2.5076, dr:0.0560, moonR:7, col1:'#a8b8c8', col2:'#182030' },
  // MicroTech
  { name:'Calliope', pi:3, ao:-0.9328, dr:0.0520, moonR:7, col1:'#d8e0f0', col2:'#2a3040' },
  { name:'Clio',     pi:3, ao:-0.2625, dr:0.0500, moonR:7, col1:'#c8d8e8', col2:'#182030' },
  { name:'Euterpe',  pi:3, ao:+2.2719, dr:0.0620, moonR:7, col1:'#d0c8d8', col2:'#282030' },
];


// [source main.js:844] STATIONS
var STATIONS = [
  // Hurston — L-points + Everus Harbor
  { name:'HUR-L1',        pi:0, ao:-2.948, dr:0.115 },
  { name:'HUR-L2',        pi:0, ao:-0.283, dr:0.125 },
  { name:'HUR-L3',        pi:0, ao:-1.826, dr:0.160 },
  { name:'HUR-L4 R&R',    pi:0, ao:-0.895, dr:0.138 },
  { name:'HUR-L5',        pi:0, ao:+3.092, dr:0.195 },
  { name:'Everus Harbor', pi:0, ao:+2.950, dr:0.058 },
  // Crusader — stations + Port Olisar + GrimHEX
  { name:'Sec. Post Kareah', pi:1, ao:-3.008, dr:0.098 },
  { name:'Port Olisar',   pi:1, ao:-3.142, dr:0.148 },
  { name:'GrimHEX',       pi:1, ao:+2.917, dr:0.105 },
  { name:'CRU-L1',        pi:1, ao:+2.262, dr:0.038 },
  { name:'CRU-L3',        pi:1, ao:+1.444, dr:0.195 },
  { name:'CRU-L4',        pi:1, ao:+2.544, dr:0.175 },
  { name:'CRU-L5',        pi:1, ao:+0.057, dr:0.195 },
  { name:'Covalex Hub',   pi:1, ao:-2.704, dr:0.055 },
  // ArcCorp
  { name:'Baijini Point', pi:2, ao:+3.110, dr:0.032 },
  { name:'ARC-L1',        pi:2, ao:-2.661, dr:0.115 },
  { name:'ARC-L2',        pi:2, ao:+1.102, dr:0.070 },
  { name:'ARC-L3',        pi:2, ao:-0.881, dr:0.285 },
  { name:'ARC-L4',        pi:2, ao:-1.990, dr:0.290 },
  { name:'ARC-L5',        pi:2, ao:-1.958, dr:0.295 },
  // MicroTech
  { name:'Port Tressler', pi:3, ao:+0.134, dr:0.068 },
  { name:'MIC-L1',        pi:3, ao:-2.719, dr:0.092 },
];


// [source main.js:873] tradeRoutes
var tradeRoutes = [];

// ── Géométrie ──────────────────────────────────────────────────────

// Position fixe d'une planète dans le canvas
// Scale 0.52 pour que microTech (fx≈0.89) reste visible

// [source main.js:879] pFixed
function pFixed(pi, W, H) {
  const p = PLANETS[pi];
  return { x: W/2 + p.fx*(W/2)*0.755, y: H/2 + p.fy*(H/2)*0.755 };
}

// Position fixe d'un satellite autour de sa planète
// ao  = angle précalculé (rad), dr = fraction de W

// [source main.js:886] satPosFixed
function satPosFixed(pi, ao, dr, W, H) {
  const pp = pFixed(pi, W, H);
  return { x: pp.x + Math.cos(ao)*dr*W, y: pp.y + Math.sin(ao)*dr*W };
}

// Ellipse 3D inclinée (orbite système ou orbite lune)

// [source main.js:892] drawEllipse3D
function drawEllipse3D(ctx, cx, cy, rxPx, col, lw) {
  const ry = rxPx * ORBIT_RATIO;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(ORBIT_TILT);
  // Aura
  ctx.strokeStyle = col.replace(/[\d.]+\)$/, s => Math.min(1,parseFloat(s)*0.30).toFixed(2)+')');
  ctx.lineWidth = lw * 4; ctx.setLineDash([]);
  ctx.beginPath(); ctx.ellipse(0,0,rxPx,ry,0,0,Math.PI*2); ctx.stroke();
  // Trait principal
  ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.ellipse(0,0,rxPx,ry,0,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

// Planète 3D (illumination haut-gauche)

// [source main.js:907] drawPlanet3D
function drawPlanet3D(ctx, x, y, r, c1, c2, c3, c4) {
  const lx=x-r*0.38, ly=y-r*0.38;
  const g=ctx.createRadialGradient(lx,ly,r*0.04,x,y,r);
  g.addColorStop(0,c1); g.addColorStop(0.35,c2); g.addColorStop(0.70,c3); g.addColorStop(1,c4);
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  const sp=ctx.createRadialGradient(lx+r*0.04,ly+r*0.04,0,lx,ly,r*0.52);
  sp.addColorStop(0,'rgba(255,255,255,0.42)'); sp.addColorStop(0.3,'rgba(255,255,255,0.10)'); sp.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sp; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  const sh=ctx.createRadialGradient(x+r*0.28,y+r*0.28,r*0.08,x,y,r);
  sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(0.52,'rgba(0,0,0,0.18)'); sh.addColorStop(1,'rgba(0,0,0,0.68)');
  ctx.fillStyle=sh; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=0.8; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
}

// Lune 3D miniature

// [source main.js:923] drawMoon3D
function drawMoon3D(ctx, x, y, r, c1, c2) {
  const lx=x-r*0.35,ly=y-r*0.35;
  const g=ctx.createRadialGradient(lx,ly,0,x,y,r);
  g.addColorStop(0,c1); g.addColorStop(0.65,c2); g.addColorStop(1,'#0d1018');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  const sh=ctx.createRadialGradient(x+r*0.22,y+r*0.22,0,x,y,r);
  sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(0.58,'rgba(0,0,0,0.22)'); sh.addColorStop(1,'rgba(0,0,0,0.60)');
  ctx.fillStyle=sh; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
}

// ── Init ──────────────────────────────────────────────────────────


// [source main.js:935] initMap
function initMap(canvas) {
  if (!canvas) return;
  canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight;
  mapCanvas=canvas; mapCtx=canvas.getContext('2d');
  mapW=canvas.width; mapH=canvas.height;
  tradeRoutes=[[0,1],[1,2],[2,3],[3,0],[0,2],[3,1]];
  canvas.addEventListener('mousemove', e=>{
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    hoveredPlanet=null;
    PLANETS.forEach((_,i)=>{
      const pp=pFixed(i,mapW,mapH);
      if(Math.hypot(mx-pp.x,my-pp.y)<PLANETS[i].r+14) hoveredPlanet=i;
    });
    canvas.style.cursor=hoveredPlanet!==null?'pointer':'default';
  });
}


// [source main.js:953] orbitPos
function orbitPos(pi,ao,dr,t,W,H){ return satPosFixed(pi,ao,dr,W,H); }

// ── Draw ──────────────────────────────────────────────────────────


// [source main.js:957] drawMap
function drawMap(canvas, ctx, t) {
  if(!ctx) return;
  const W=canvas.width, H=canvas.height;
  const S=Math.min(W,H); // Référence carrée pour éviter la déformation
  ctx.clearRect(0,0,W,H);

  // ══ FOND NOIR BLEUTÉ ════════════════════════════════════════════
  const bgG=ctx.createRadialGradient(W*0.42,H*0.40,0,W*0.42,H*0.40,Math.max(W,H)*0.80);
  bgG.addColorStop(0,'#0c1220'); bgG.addColorStop(0.35,'#080c18');
  bgG.addColorStop(0.65,'#04070e'); bgG.addColorStop(1,'#010308');
  ctx.fillStyle=bgG; ctx.fillRect(0,0,W,H);
  // Nuées
  const nb1=ctx.createLinearGradient(0,H*0.25,W,H*0.75);
  nb1.addColorStop(0,'rgba(15,25,60,0)'); nb1.addColorStop(0.45,'rgba(28,44,88,0.16)');
  nb1.addColorStop(0.55,'rgba(32,50,95,0.22)'); nb1.addColorStop(1,'rgba(15,25,60,0)');
  ctx.fillStyle=nb1; ctx.fillRect(0,0,W,H);
  const nb2=ctx.createRadialGradient(W*0.70,H*0.25,0,W*0.70,H*0.25,W*0.40);
  nb2.addColorStop(0,'rgba(18,32,75,0.13)'); nb2.addColorStop(0.5,'rgba(12,22,55,0.06)'); nb2.addColorStop(1,'rgba(8,15,40,0)');
  ctx.fillStyle=nb2; ctx.fillRect(0,0,W,H);

  // ── Zoom / pan ──
  const _sc = canvas._mapScale || 1;
  const _ox = canvas._mapOffX  || 0;
  const _oy = canvas._mapOffY  || 0;
  ctx.save();
  ctx.translate(W/2 + _ox, H/2 + _oy);
  ctx.scale(_sc, _sc);
  ctx.translate(-W/2, -H/2);

  // ══ ÉTOILES (4 couches) ══════════════════════════════════════════
  for(let i=0;i<500;i++){
    const sx=((Math.sin(i*31.41+7)*0.5+0.5)*W)|0, sy=((Math.sin(i*17.23+7)*0.5+0.5)*H)|0;
    const a=0.05+0.18*(Math.sin(i*7.3+t*0.0004)*0.5+0.5);
    ctx.fillStyle=`rgba(180,200,255,${a})`; ctx.fillRect(sx,sy,0.6,0.6);
  }
  for(let i=0;i<300;i++){
    const sx=((Math.sin(i*27.41+13)*0.5+0.5)*W)|0, sy=((Math.sin(i*13.73+13)*0.5+0.5)*H)|0;
    const a=0.10+0.35*(Math.sin(i*5.17+t*0.0005)*0.5+0.5);
    ctx.fillStyle=`rgba(200,215,255,${a})`;
    ctx.beginPath(); ctx.arc(sx,sy,0.8,0,Math.PI*2); ctx.fill();
  }
  for(let i=0;i<90;i++){
    const sx=((Math.sin(i*43.17+21)*0.5+0.5)*W)|0, sy=((Math.sin(i*19.31+21)*0.5+0.5)*H)|0;
    const a=0.20+0.52*(Math.sin(i*3.81+t*0.0006)*0.5+0.5);
    ctx.fillStyle=`rgba(215,228,255,${a})`;
    ctx.beginPath(); ctx.arc(sx,sy,1.1,0,Math.PI*2); ctx.fill();
  }
  for(let i=0;i<28;i++){
    const sx=((Math.sin(i*71.3+31)*0.5+0.5)*W)|0, sy=((Math.sin(i*37.9+31)*0.5+0.5)*H)|0;
    const a=0.55+0.42*(Math.sin(i*2.3+t*0.0008)*0.5+0.5);
    ctx.fillStyle=`rgba(240,245,255,${a})`;
    ctx.beginPath(); ctx.arc(sx,sy,1.35,0,Math.PI*2); ctx.fill();
    if(i%4===0){
      ctx.strokeStyle=`rgba(200,220,255,${a*0.30})`; ctx.lineWidth=0.55; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(sx-5,sy); ctx.lineTo(sx+5,sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx,sy-5); ctx.lineTo(sx,sy+5); ctx.stroke();
    }
  }

  const cx=W/2, cy=H/2;

  // ══ ORBITES SYSTÈME BLEUES (ellipses 3D) ═════════════════════════
  SYSTEM_ORBITS.forEach(o=>{
    drawEllipse3D(ctx, cx, cy, o.ratio*S, o.col, o.lw);
  });

  // ══ ROUTES COMMERCIALES (vue Commerce uniquement) ═════════════════
  const ppos=PLANETS.map((_,i)=>pFixed(i,W,H));
  if(mapView==='commerce'){
    const RC=['rgba(247,140,30,0.45)','rgba(0,255,163,0.35)','rgba(89,208,255,0.32)','rgba(220,100,255,0.30)','rgba(255,200,0,0.40)','rgba(180,100,255,0.50)'];
    const RN=[['HURSTON','CRUSADER'],['CRUSADER','ARCORP'],['ARCORP','MICROTECH'],['MICROTECH','HURSTON'],['HURSTON','ARCORP'],['MICROTECH','CRUSADER']];
    tradeRoutes.forEach(([a,b],ri)=>{
      const ax=ppos[a].x,ay=ppos[a].y,bx=ppos[b].x,by=ppos[b].y;
      ctx.save();
      ctx.strokeStyle=RC[ri]; ctx.lineWidth=1.4; ctx.setLineDash([8,12]);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      ctx.setLineDash([]);
      const p1=(t*0.00024+ri*0.2)%1;
      ctx.fillStyle=RC[ri].replace(/[\d.]+\)$/,'0.95)');
      ctx.beginPath(); ctx.arc(ax+(bx-ax)*p1,ay+(by-ay)*p1,3,0,Math.PI*2); ctx.fill();
      const p2=(t*0.00024+ri*0.2+0.5)%1;
      ctx.beginPath(); ctx.arc(ax+(bx-ax)*p2,ay+(by-ay)*p2,1.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(247,140,30,0.68)'; ctx.font=`6.5px 'Share Tech Mono',monospace`; ctx.textAlign='center';
      ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=3;
      if(RN[ri]) ctx.fillText(RN[ri].join(' → '),(ax+bx)/2,(ay+by)/2-7);
      ctx.restore();
    });
  }

  // ══ SOLEIL STANTON ════════════════════════════════════════════════
  const sR=15  ;
  const gSO=ctx.createRadialGradient(cx,cy,sR*0.4,cx,cy,sR*7.5);
  gSO.addColorStop(0,'rgba(255,190,50,0.28)'); gSO.addColorStop(0.35,'rgba(255,140,10,0.10)');
  gSO.addColorStop(0.65,'rgba(255,100,0,0.04)'); gSO.addColorStop(1,'transparent');
  ctx.fillStyle=gSO; ctx.beginPath(); ctx.arc(cx,cy,sR*7.5,0,Math.PI*2); ctx.fill();
  const gS=ctx.createRadialGradient(cx-sR*0.32,cy-sR*0.32,0,cx,cy,sR);
  gS.addColorStop(0,'#fffef0'); gS.addColorStop(0.2,'#fff8a0');
  gS.addColorStop(0.55,'#ffcc30'); gS.addColorStop(0.82,'#ff9010'); gS.addColorStop(1,'#c04800');
  ctx.fillStyle=gS; ctx.beginPath(); ctx.arc(cx,cy,sR,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,205,60,0.22)'; ctx.lineWidth=4.5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(cx,cy,sR+4+Math.sin(t*0.0018)*2.5,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(255,165,30,0.09)'; ctx.lineWidth=9;
  ctx.beginPath(); ctx.arc(cx,cy,sR+9+Math.sin(t*0.0013)*3.5,0,Math.PI*2); ctx.stroke();
  ctx.save(); ctx.textAlign='center'; ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=5;
  ctx.fillStyle='rgba(255,245,150,0.72)'; ctx.font=`bold 11px 'Share Tech Mono',monospace`;
  ctx.fillText('Stanton',cx,cy+sR+17); ctx.restore();

  // ══ PLANÈTES avec orbites-lunes, lunes, stations ══════════════════
  PLANETS.forEach((p,i)=>{
    const pp=pFixed(i,W,H);
    const px=pp.x, py=pp.y;
    const hov=hoveredPlanet===i;

    // ── Orbite des lunes (ellipse 3D blanche-bleutée) ──
    if(p.moonOrbit){
      drawEllipse3D(ctx, px, py, p.moonOrbit.rx*W, p.moonOrbit.col, p.moonOrbit.lw);
    }

    // ── Lunes (FIXES) ──
    MOONS.filter(m=>m.pi===i).forEach(m=>{
      const mp=satPosFixed(i,m.ao,m.dr,W,H);
      drawMoon3D(ctx,mp.x,mp.y,m.moonR,m.col1,m.col2);
      ctx.save(); ctx.textAlign='center';
      ctx.fillStyle='rgba(155,175,200,0.85)'; ctx.font=`6.5px 'Share Tech Mono',monospace`;
      ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=3;
      ctx.fillText(m.name,mp.x,mp.y-m.moonR-4);
      ctx.restore();
    });

    // ── Stations (FIXES, croix × cyan) ──
    STATIONS.filter(s=>s.pi===i).forEach(s=>{
      const sp=satPosFixed(i,s.ao,s.dr,W,H);
      const r=4.5;
      ctx.save();
      ctx.strokeStyle='rgba(89,208,255,0.18)'; ctx.lineWidth=7; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(sp.x-r,sp.y); ctx.lineTo(sp.x+r,sp.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sp.x,sp.y-r); ctx.lineTo(sp.x,sp.y+r); ctx.stroke();
      ctx.strokeStyle='rgba(89,208,255,0.92)'; ctx.lineWidth=1.3;
      ctx.beginPath(); ctx.moveTo(sp.x-r,sp.y); ctx.lineTo(sp.x+r,sp.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sp.x,sp.y-r); ctx.lineTo(sp.x,sp.y+r); ctx.stroke();
      ctx.fillStyle='rgba(89,208,255,0.80)'; ctx.font=`6.5px 'Share Tech Mono',monospace`;
      ctx.textAlign='center'; ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=3;
      ctx.fillText(s.name,sp.x,sp.y-r-4);
      ctx.restore();
    });

    // ── Glow planète ──
    const gr=ctx.createRadialGradient(px,py,p.r*0.4,px,py,p.r*(hov?3.6:2.6));
    gr.addColorStop(0,p.glow); gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(px,py,p.r*(hov?3.6:2.6),0,Math.PI*2); ctx.fill();

    // ── Corps planète 3D ──
    drawPlanet3D(ctx,px,py,p.r,p.col1,p.col2,p.col3,p.col4);

    // ── Atmosphère ──
    if(p.atmo){
      const atm=ctx.createRadialGradient(px,py,p.r*0.82,px,py,p.r*1.28);
      atm.addColorStop(0,p.atmo); atm.addColorStop(1,'transparent');
      ctx.fillStyle=atm; ctx.beginPath(); ctx.arc(px,py,p.r*1.28,0,Math.PI*2); ctx.fill();
    }

    // ── Hover ring ──
    if(hov){
      ctx.save(); ctx.strokeStyle='rgba(247,140,30,0.85)'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(px,py,p.r+6+Math.sin(t*0.005)*2,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // ── Labels ──
    ctx.save(); ctx.textAlign='center';
    ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=5;
    ctx.fillStyle=hov?'#f78c1e':'#d8eaf8';
    ctx.font=`bold ${hov?13:11}px 'Rajdhani',sans-serif`;
    ctx.fillText(p.name,px,py-p.r-6);
    ctx.fillStyle='rgba(130,165,200,0.82)'; ctx.font=`7.5px 'Share Tech Mono',monospace`;
    ctx.fillText(p.sub,px,py-p.r-15);
    ctx.shadowBlur=0;
    if(hov||mapView==='commerce'){
      ctx.fillStyle='rgba(0,255,163,0.90)'; ctx.font=`7.5px 'Share Tech Mono',monospace`;
      ctx.fillText(`S:${p.stocks}  P:${p.partners}`,px,py+p.r+16);
    }
    ctx.restore();
  });

  // ══ DELAMAR (asteroïde) ══════════════════════════════════════════
  {
    const DX = W/2 + 0.522*(W/2)*0.755;
    const DY = H/2 + (-0.042)*(H/2)*0.755;
    // Halo
    const dg = ctx.createRadialGradient(DX,DY,0,DX,DY,16);
    dg.addColorStop(0,'rgba(160,140,120,0.35)'); dg.addColorStop(1,'transparent');
    ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(DX,DY,16,0,Math.PI*2); ctx.fill();
    // Corps asteroïde (irrégulier)
    ctx.save();
    ctx.fillStyle='#8a7a68';
    ctx.beginPath();
    ctx.ellipse(DX,DY,9,6,0.4,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle='rgba(180,160,140,0.4)'; ctx.lineWidth=0.7;
    ctx.stroke();
    ctx.restore();
    // Label
    ctx.save(); ctx.textAlign='center';
    ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=4;
    ctx.fillStyle='#c8b89a'; ctx.font=`bold 10px 'Rajdhani',sans-serif`;
    ctx.fillText('DELAMAR',DX,DY-13);
    ctx.fillStyle='rgba(150,135,115,0.80)'; ctx.font=`7px 'Share Tech Mono',monospace`;
    ctx.fillText('Levski',DX,DY-5);
    ctx.restore();
    // Station Levski (croix cyan)
    const LX=DX+18, LY=DY-4, r=3.5;
    ctx.save();
    ctx.strokeStyle='rgba(89,208,255,0.85)'; ctx.lineWidth=1.2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(LX-r,LY); ctx.lineTo(LX+r,LY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(LX,LY-r); ctx.lineTo(LX,LY+r); ctx.stroke();
    ctx.fillStyle='rgba(89,208,255,0.75)'; ctx.font=`6px 'Share Tech Mono',monospace`;
    ctx.textAlign='center'; ctx.fillText('Levski',LX,LY-r-3);
    ctx.restore();
  }

  ctx.restore(); // ── fin zoom/pan ──

  // ══ LÉGENDE (hors zoom) ════════════════════════════════════════════
  const leg=[
    {sym:'×',  col:'rgba(89,208,255,0.92)', label:'Station'},
    {sym:'○',  col:'rgba(200,220,240,0.80)',label:'Lune'},
    {sym:'●',  col:'#6a9ccc',              label:'Planète'},
    {sym:'◯',  col:'rgba(200,220,240,0.55)',label:'Orbite lune'},
    {sym:'──', col:'rgba(90,135,195,0.55)', label:'Orbite'},
    {sym:'--', col:'rgba(247,140,30,0.78)', label:'Route comm.'},
  ];
  ctx.save();
  ctx.fillStyle='rgba(4,7,16,0.70)';
  ctx.fillRect(0,H-24,leg.length*106+12,24);
  leg.forEach((item,i)=>{
    ctx.fillStyle=item.col; ctx.font=`bold 8.5px 'Share Tech Mono',monospace`; ctx.textAlign='left';
    ctx.fillText(`${item.sym} ${item.label}`,8+i*106,H-9);
  });
  ctx.restore();
}


// [source main.js:1198] lighten
function lighten(hex, pct) {
  let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  r=Math.min(255,r+pct); g=Math.min(255,g+pct); b=Math.min(255,b+pct);
  return `rgb(${r},${g},${b})`;
}

// [source main.js:1203] darken
function darken(hex, pct) {
  let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  r=Math.max(0,r-pct); g=Math.max(0,g-pct); b=Math.max(0,b-pct);
  return `rgb(${r},${g},${b})`;
}


// [source main.js:1209] setMapView
function setMapView(v) {
  mapView = v;
  document.getElementById('btn-global').classList.toggle('active', v==='global');
  document.getElementById('btn-commerce').classList.toggle('active', v==='commerce');
}

// [source main.js:1214] mapScale
var mapScale=1, mapOffX=0, mapOffY=0;

// [source main.js:1215] centerMap
function centerMap() { mapScale=1; mapOffX=0; mapOffY=0; }




/* ════════════════════════════════════════════════════════════
   PROFIT CHART
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   PROFIT HISTORY — Suivi dynamique valeur stock NEXORA
════════════════════════════════════════════════════════════ */

// [source main.js:1226] PROFIT_HISTORY
var PROFIT_HISTORY = []; // [{ts: timestamp, value: aUEC}]

// [source main.js:1227] chartDays
var chartDays = 7;


// [source main.js:1229] loadProfitHistory
async function loadProfitHistory() {
  const saved = await DB.get('telos-profit-history');
  if (saved && Array.isArray(saved)) PROFIT_HISTORY = saved;
}


// [source main.js:1234] saveProfitHistory
async function saveProfitHistory() {
  // Garder max 90 jours de points
  const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
  PROFIT_HISTORY = PROFIT_HISTORY.filter(p => p.ts >= cutoff);
  await DB.set('telos-profit-history', PROFIT_HISTORY);
}


// [source main.js:1241] calcTotalStockValue
function calcTotalStockValue() {
  // Valeur totale = somme (qty * sellprice) de tous les stocks de tous les joueurs
  let total = 0;
  players.forEach(p => {
    (p.stock || []).forEach(s => {
      const qty  = Number(s.qty)       || 0;
      const sell = Number(s.sellprice) || Number(s.price) || 0;
      total += qty * sell;
    });
  });
  return Math.round(total);
}


// [source main.js:1254] _bankStatDays
var _bankStatDays = 7;


// [source main.js:1256] setBankStat
function setBankStat(days, btn) {
  _bankStatDays = days;
  document.querySelectorAll('#bank-stat-7,#bank-stat-30,#bank-stat-all').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderHubBankStats();
}


// [source main.js:1263] renderHubBankStats
function renderHubBankStats() {
  if (!BANK_DATA) return;

  const now = Date.now();
  const cutoff = _bankStatDays > 0 ? now - _bankStatDays * 86400000 : 0;
  const filtered = BANK_DATA.filter(t => !cutoff || new Date(t.date||t.addedAt||0).getTime() >= cutoff);

  const credits = filtered.filter(t=>t.type==='credit').reduce((s,t)=>s+(t.amount||0),0);
  const debits  = filtered.filter(t=>t.type==='debit') .reduce((s,t)=>s+(t.amount||0),0);
  const solde   = BANK_DATA.reduce((s,t)=>s+(t.type==='credit'?1:-1)*(t.amount||0),0);
  const fmt = v => Math.round(v).toLocaleString('fr-FR');

  const el_s = document.getElementById('hbs-solde');
  const el_c = document.getElementById('hbs-credits');
  const el_d = document.getElementById('hbs-debits');
  const el_n = document.getElementById('hbs-count');
  if (el_s) { el_s.textContent = fmt(solde)+' aUEC'; el_s.style.color = solde>=0?'var(--orange)':'var(--red)'; }
  if (el_c) el_c.textContent = '+'+fmt(credits)+' aUEC';
  if (el_d) el_d.textContent = '-'+fmt(debits)+' aUEC';
  if (el_n) el_n.textContent = filtered.length+' tx';

  // Grouper par jour
  const days = {};
  filtered.forEach(t => {
    const d = (t.date||t.addedAt||'').slice(0,10);
    if (!d) return;
    if (!days[d]) days[d] = { credit:0, debit:0 };
    if (t.type==='credit') days[d].credit += t.amount||0;
    else days[d].debit += t.amount||0;
  });

  const sorted = Object.keys(days).sort();
  draw3DBarChart(sorted, days);
}


// [source main.js:1298] draw3DBarChart
function draw3DBarChart(labels, data) {
  const canvas = document.getElementById('bank-3d-chart');
  const empty  = document.getElementById('bank-chart-empty');
  const tip    = document.getElementById('bank-chart-tooltip');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth  || 600;
  const H = canvas.offsetHeight || 160;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (!labels.length) {
    if (empty) empty.style.display = 'flex';
    canvas.onmousemove = null; canvas.onmouseleave = null;
    return;
  }
  if (empty) empty.style.display = 'none';

  const n   = labels.length;
  const pad = { l:52, r:20, t:24, b:36 };
  const cW  = W - pad.l - pad.r;
  const cH  = H - pad.t - pad.b;

  // Construire les points de solde cumulatif
  let runBalance = 0;
  const pts = labels.map(l => {
    const c = data[l].credit || 0;
    const d = data[l].debit  || 0;
    runBalance += c - d;
    return { label:l, credit:c, debit:d, balance:runBalance };
  });

  // Plage des valeurs : crédits au-dessus du zéro, débits en négatif, solde
  const maxPos = Math.max(...pts.map(p => Math.max(p.credit, p.balance, 0)), 1);
  const maxNeg = Math.max(...pts.map(p => p.debit), 0);
  const rawMax =  maxPos;
  const rawMin = -maxNeg;
  const span   = (rawMax - rawMin) || 1;
  const yMax   = rawMax + span * 0.12;
  const yMin   = rawMin - span * 0.08;
  const ySpan  = yMax - yMin;

  function toY(v) { return pad.t + cH * (1 - (v - yMin) / ySpan); }
  function toX(i) { return pad.l + (n === 1 ? cW / 2 : i * cW / (n - 1)); }
  const barW = Math.max(4, Math.min(28, cW / n * 0.55));

  const zeroY = toY(0);

  // ── Grille horizontale ──
  const gridSteps = 5;
  ctx.lineWidth = 1;
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  for (let s = 0; s <= gridSteps; s++) {
    const v = yMin + ySpan * (s / gridSteps);
    const y = toY(v);
    ctx.strokeStyle = v === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)';
    ctx.setLineDash(v === 0 ? [] : [3, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
    ctx.setLineDash([]);
    const lbl = (v >= 0 ? '' : '-') + (Math.abs(v) >= 1e6 ? (Math.abs(v)/1e6).toFixed(1)+'M' : Math.abs(v) >= 1e3 ? (Math.abs(v)/1e3).toFixed(0)+'k' : Math.round(Math.abs(v))+'');
    ctx.fillStyle = v >= 0 ? 'rgba(0,255,163,0.4)' : 'rgba(255,80,80,0.4)';
    ctx.fillText(lbl, pad.l - 5, y + 3);
  }

  // ── Barres crédits (vers le haut, vertes) ──
  pts.forEach((p, i) => {
    if (p.credit <= 0) return;
    const x  = toX(i) - barW / 2;
    const y  = toY(p.credit);
    const bH = zeroY - y;
    if (bH <= 0) return;
    const g = ctx.createLinearGradient(0, y, 0, zeroY);
    g.addColorStop(0, 'rgba(0,255,163,0.75)');
    g.addColorStop(1, 'rgba(0,255,163,0.20)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, barW, bH);
    // Bord haut
    ctx.fillStyle = 'rgba(0,255,163,0.9)';
    ctx.fillRect(x, y, barW, 2);
  });

  // ── Barres débits (vers le bas, rouges) ──
  pts.forEach((p, i) => {
    if (p.debit <= 0) return;
    const x  = toX(i) - barW / 2;
    const y  = zeroY;
    const bH = toY(-p.debit) - zeroY;
    if (bH <= 0) return;
    const g = ctx.createLinearGradient(0, y, 0, y + bH);
    g.addColorStop(0, 'rgba(255,68,68,0.65)');
    g.addColorStop(1, 'rgba(255,68,68,0.15)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, barW, bH);
    // Bord bas
    ctx.fillStyle = 'rgba(255,68,68,0.85)';
    ctx.fillRect(x, y + bH - 2, barW, 2);
  });

  // ── Zone de remplissage courbe solde ──
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(toX(0), zeroY);
  pts.forEach((p, i) => ctx.lineTo(toX(i), toY(p.balance)));
  ctx.lineTo(toX(n - 1), zeroY);
  ctx.closePath();
  const gradFill = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
  const lastBal = pts[pts.length - 1].balance;
  if (lastBal >= 0) {
    gradFill.addColorStop(0, 'rgba(247,140,30,0.18)');
    gradFill.addColorStop(1, 'rgba(247,140,30,0.02)');
  } else {
    gradFill.addColorStop(0, 'rgba(247,140,30,0.02)');
    gradFill.addColorStop(1, 'rgba(247,140,30,0.18)');
  }
  ctx.fillStyle = gradFill;
  ctx.fill();
  ctx.restore();

  // ── Courbe solde (orange épaisse) ──
  ctx.strokeStyle = 'rgba(247,140,30,0.95)';
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p.balance)) : ctx.lineTo(toX(i), toY(p.balance)));
  ctx.stroke();

  // ── Points solde ──
  pts.forEach((p, i) => {
    const x = toX(i), y = toY(p.balance);
    ctx.beginPath();
    ctx.arc(x, y, i === pts.length - 1 ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = p.balance >= 0 ? 'rgba(247,140,30,1)' : 'rgba(255,68,68,1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });

  // ── Labels axe X ──
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  const maxLbl = Math.floor(cW / 38);
  const step = Math.max(1, Math.ceil(n / maxLbl));
  labels.forEach((l, i) => {
    if (i % step === 0 || i === n - 1) {
      ctx.fillText(l.slice(5), toX(i), pad.t + cH + 22);
    }
  });

  // ── Légende ──
  const legItems = [
    [pad.l + 4,    'rgba(247,140,30,0.95)', 'Solde',    false],
    [pad.l + 68,   'rgba(0,255,163,0.8)',   'Crédits',  true ],
    [pad.l + 140,  'rgba(255,68,68,0.8)',   'Débits',   true ],
  ];
  legItems.forEach(([x, col, lbl, isBar]) => {
    if (isBar) {
      ctx.fillStyle = col;
      ctx.fillRect(x, 3, 14, 9);
    } else {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + 14, 8); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText(lbl, x + 18, 12);
  });

  // ── Tooltip ──
  canvas.onmousemove = (e) => {
    if (!tip) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let closest = 0, minDist = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(toX(i) - mx); if (d < minDist) { minDist = d; closest = i; } });
    if (minDist < cW / n * 0.75) {
      const p = pts[closest];
      const fmt = v => Math.round(v).toLocaleString('fr-FR');
      tip.style.display = 'block';
      tip.style.left = Math.min(mx + 12, W - 160) + 'px';
      tip.style.top  = Math.max(4, e.clientY - rect.top - 48) + 'px';
      tip.innerHTML =
        '<span style="color:rgba(255,255,255,0.5);display:block;margin-bottom:3px;">' + p.label + '</span>' +
        '<span style="color:var(--green)">+' + fmt(p.credit) + ' aUEC</span>  ' +
        '<span style="color:var(--red)">-' + fmt(p.debit) + ' aUEC</span><br>' +
        '<span style="color:' + (p.balance>=0?'var(--orange)':'var(--red)') + '">Solde cumulé : ' + (p.balance>=0?'+':'') + fmt(p.balance) + ' aUEC</span>';
    } else {
      tip.style.display = 'none';
    }
  };
  canvas.onmouseleave = () => { if (tip) tip.style.display = 'none'; };
}


// [source main.js:1500] snapshotProfit
async function snapshotProfit() {
  const val = calcTotalStockValue();
  if (val <= 0) return; // Ne pas enregistrer si vide
  const now = Date.now();
  // Éviter doublons rapprochés (< 2 min)
  const last = PROFIT_HISTORY[PROFIT_HISTORY.length - 1];
  if (last && now - last.ts < 120000) {
    last.value = val; // Mettre à jour le dernier point
  } else {
    PROFIT_HISTORY.push({ ts: now, value: val });
  }
  await saveProfitHistory();
  drawChart(chartDays);
}


// [source main.js:1515] drawChart
function drawChart(days) {
  chartDays = days;
  const canvas = document.getElementById('profit-chart');
  if (!canvas) return;

  // Dimensions réelles
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(rect.width  || canvas.offsetWidth  || 400, 100);
  const H = Math.max(rect.height || canvas.offsetHeight || 100, 60);
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Filtrer les données selon la période
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  let data = PROFIT_HISTORY.filter(p => p.ts >= cutoff);

  // Si pas assez de points, afficher un message
  if (data.length < 2) {
    ctx.fillStyle = 'rgba(247,140,30,0.15)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#6a7585';
    ctx.font = '12px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Données insuffisantes — effectuez des opérations de stock', W/2, H/2 - 8);
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillText('Le graphique se remplit automatiquement', W/2, H/2 + 10);
    // Stocker pour tooltip
    canvas._chartData = [];
    return;
  }

  const pad = { l:48, r:14, t:16, b:24 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;

  const vals = data.map(p => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  // Coordonnées des points
  const pts = data.map((p, i) => ({
    x: pad.l + (i / (data.length - 1)) * cW,
    y: pad.t + cH - ((p.value - minV) / range) * cH,
    ts: p.ts,
    value: p.value
  }));

  // ── Grille horizontale ──
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const y = pad.t + f * cH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    // Label axe Y
    const v = maxV - f * range;
    ctx.fillStyle = '#4a5568';
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : Math.round(v).toString(), pad.l - 4, y + 3);
  });

  // ── Gradient de remplissage ──
  const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
  grad.addColorStop(0, 'rgba(247,140,30,0.28)');
  grad.addColorStop(1, 'rgba(247,140,30,0)');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, H - pad.b);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, H - pad.b);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Courbe ──
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  // Courbe lisse (bezier)
  for (let i = 1; i < pts.length; i++) {
    const cp1x = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cp1x, pts[i-1].y, cp1x, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = '#f78c1e';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // ── Points ──
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === pts.length - 1 ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = i === pts.length - 1 ? '#f78c1e' : 'rgba(247,140,30,0.7)';
    ctx.fill();
    if (i === pts.length - 1) {
      ctx.strokeStyle = 'rgba(247,140,30,0.3)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  });

  // ── Labels axe X (dates) ──
  ctx.fillStyle = '#4a5568';
  ctx.font = '9px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(data.length / 5));
  data.forEach((p, i) => {
    if (i % step === 0 || i === data.length - 1) {
      const x = pad.l + (i / (data.length - 1)) * cW;
      const d = new Date(p.ts);
      ctx.fillText(d.getDate() + '/' + (d.getMonth()+1), x, H - 4);
    }
  });

  // ── Valeur courante en haut à droite ──
  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const diff = prev ? last.value - prev.value : 0;
  const diffPct = prev && prev.value ? (diff / prev.value * 100) : 0;
  ctx.textAlign = 'right';
  ctx.font = 'bold 11px "Share Tech Mono", monospace';
  ctx.fillStyle = diff >= 0 ? '#00ffa3' : '#ff4444';
  ctx.fillText(
    (diff >= 0 ? '+' : '') + (last.value/1e6).toFixed(2) + 'M  (' + (diff >= 0 ? '+' : '') + diffPct.toFixed(1) + '%)',
    W - pad.r, pad.t - 4
  );

  // Stocker pour tooltip
  canvas._chartData = pts;
}


// [source main.js:1646] setChart
function setChart(d, btn) {
  chartDays = d;
  document.querySelectorAll('.chart-ctrl').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  drawChart(d);
}

// ── Tooltip interactif ──
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('profit-chart');
    const tip    = document.getElementById('profit-tooltip');
    if (!canvas || !tip) return;

    canvas.addEventListener('mousemove', e => {
      const data = canvas._chartData;
      if (!data || !data.length) { tip.style.display='none'; return; }
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      // Trouver le point le plus proche
      let closest = null, minDist = Infinity;
      data.forEach(p => {
        const d = Math.abs(p.x - mx);
        if (d < minDist) { minDist = d; closest = p; }
      });
      if (!closest || minDist > 40) { tip.style.display='none'; return; }
      const date = new Date(closest.ts);
      const fmt = date.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      tip.innerHTML = `<span style="color:var(--text-dim)">${fmt}</span><br><span style="color:var(--orange);font-size:13px;">${closest.value.toLocaleString('fr-FR')} aUEC</span>`;
      tip.style.display = 'block';
      let lx = e.clientX - rect.left + 12;
      let ty = e.clientY - rect.top - 38;
      if (lx + 180 > rect.width) lx = e.clientX - rect.left - 190;
      tip.style.left = lx + 'px';
      tip.style.top  = ty + 'px';
    });
    canvas.addEventListener('mouseleave', () => { tip.style.display='none'; });
  });
})();

/* ════════════════════════════════════════════════════════════
   RENDER: HUB components
════════════════════════════════════════════════════════════ */

// [source main.js:1689] renderTopRes
function renderTopRes(){
  const top=[...RESOURCES].sort((a,b)=>(b.sell-b.buy)*b.qty-(a.sell-a.buy)*a.qty).slice(0,5);
  document.getElementById('top-res-body').innerHTML=top.map((r,i)=>`
    <tr><td>${i+1}</td><td>◈ ${r.name}</td><td>${r.qty}</td><td>${r.sell.toFixed(2)}</td>
    <td class="profit">+${((r.sell-r.buy)*r.qty).toLocaleString('fr-FR')}</td></tr>`).join('');
}

// [source main.js:1695] renderPrices
function renderPrices(){
  document.getElementById('price-body').innerHTML=RESOURCES.slice(0,7).map(r=>`
    <tr><td>◈ ${r.name}</td><td>${r.buy.toFixed(2)}</td><td>${r.sell.toFixed(2)}</td>
    <td class="evo ${r.delta>=0?'up':'down'}">${r.delta>=0?'▲':'▼'} ${Math.abs(r.delta).toFixed(1)}%</td></tr>`).join('');
}

// [source main.js:1700] renderActivity
function renderActivity(){
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  if (!LIVE_ACTIVITY.length) {
    feed.innerHTML = `<div style="padding:16px 14px;color:var(--text-dim);font-size:12px;letter-spacing:1px;text-align:center;opacity:0.6;">Aucune activité enregistrée.<br>Les dépôts et retraits apparaîtront ici.</div>`;
    return;
  }
  feed.innerHTML = LIVE_ACTIVITY.slice(0,8).map(a => `
    <div class="act-item" style="animation:tIn .3s ease;">
      <div class="act-icon">${a.icon}</div>
      <div style="flex:1">
        <div class="act-desc">${a.desc}</div>
        <div class="act-meta">
          ${a.amt ? `<span class="act-amt ${a.pos?'pos':'neg'}">${a.amt}</span>` : '<span></span>'}
          <span class="act-time">${timeAgo(a.ts)}</span>
        </div>
      </div>
    </div>`).join('');
}

