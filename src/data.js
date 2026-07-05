/* ════════════════════════════════════════════════════════════
   DATA — catalogues et références partagées (players, RESOURCES, UEX...)
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:564] RESOURCES
var RESOURCES = [
  { name:'Quantanium', cat:'rare',    qty:120, buy:24.80, sell:42.10, delta:3.2,  loc:'Aaron Halo' },
  { name:'Titanium',   cat:'metal',   qty:340, buy:5.20,  sell:8.10,  delta:-0.4, loc:'Area18' },
  { name:'Bexalite',   cat:'rare',    qty:12,  buy:54.00, sell:71.20, delta:5.1,  loc:'New Babbage' },
  { name:'Taranite',   cat:'mineral', qty:95,  buy:12.50, sell:18.30, delta:1.8,  loc:'Lorville' },
  { name:'Agricium',   cat:'mineral', qty:60,  buy:20.00, sell:28.50, delta:-1.2, loc:'Orison' },
  { name:'Copper',     cat:'metal',   qty:180, buy:3.20,  sell:5.50,  delta:0.5,  loc:'Area18' },
  { name:'Corundum',   cat:'gas',     qty:220, buy:6.00,  sell:9.20,  delta:0.8,  loc:'Crusader' },
  { name:'Hephaestanite',cat:'gas',   qty:75,  buy:18.40, sell:25.10, delta:2.1,  loc:'Hurston' },
  { name:'Beryl',      cat:'mineral', qty:140, buy:9.80,  sell:14.60, delta:0.6,  loc:'microTech' },
];


// [source main.js:576] STATIC_PARTNERS
var STATIC_PARTNERS = [
  { name:'DarkKaeloo',      id:'TELOS-0001', rank:'Fondateur',  credits:7842512, vol:1380000, trades:142, rep:95 },
  { name:'Yann4023',        id:'TELOS-0042', rank:'Partenaire', credits:2100450, vol:890000,  trades:87,  rep:78 },
  { name:'Kuro_Shinigami',  id:'TELOS-0107', rank:'Associé',    credits:890200,  vol:420000,  trades:34,  rep:62 },
  { name:'Volkov_Trade',    id:'TELOS-0198', rank:'Partenaire', credits:3450000, vol:1120000, trades:203, rep:88 },
  { name:'StarRunner99',    id:'TELOS-0215', rank:'Associé',    credits:650000,  vol:210000,  trades:19,  rep:55 },
  { name:'NightOwl_SCT',    id:'TELOS-0302', rank:'Partenaire', credits:1890000, vol:760000,  trades:91,  rep:81 },
];

// Missions stockées en DB — chargées au démarrage

// [source main.js:728] players
var players     = [];

// [source main.js:8478] UEX_PRICE_MAP
var UEX_PRICE_MAP={'Agricium':9700,'Agricultural Supplies':1400,'Aluminum':3700,'Ammonia':1000,'Aphorite':101100,'Argon':446,'Aslarite':5100,'Astatine':3500,'Atlasium':91900,'Beradom':144200,'Beryl':19900,'Bexalite':28800,'Bioplastic':7600,'Borase':27600,'Carbon':357,'Carbon Silk':20800,'CK13 Gid Seed Blend':533,'Chlorine':1500,'Cobalt':20800,'Compboard':29600,'Construction Materials':12500,'Copper':3700,'Corundum':3700,'DCSR2':1200,'Degnous Root':60300,'Diamond Laminate':87300,'Diamond':7500,'Distilled Spirits':1900,'Dolivine':146300,'Dymantium':22800,'Dynaflex':1900,'Etam':23200,'Feynmaline':341500,'Fresh Food':24800,'Fluorine':1300,'Foam':6300,'Gasping Weevil Eggs':63900,'Glacosite':98600,'Gold':30000,'Golden Medmon':59200,'Hadanite':544300,'Heart Of The Woods':35800,'Helium':1000,'Hephaestanite':4600,'Human Food Bars':487,'Hydrogen Fuel':180,'Hydrogen':1000,'Iodine':11500,'Iron':3400,'Janalite':2900000,'Kopion Horn':35500,'Laranite':8600,'Lindinium':47000,'Marok Gem':52900,'Maze':230000,'Medical Supplies':5200,'Mercury':1000,'Methane':3600,'Neograph':93900,'Neon':18500,'Nitrogen':3000,'Omnapoxy':4600,'Organics':12800,'Osoian Hides':870000,'Ouratite':42300,'Partillium':89900,'Pitambu':60300,'Potassium':569,'Processed Food':1400,'Prota':62400,'Quantanium':150400,'Quantum Fuel':928,'Quartz':4300,'Recycled Material Composite':7200,'Revenant Pod':9600,'Revenant Tree Pollen':1200,'Riccite':67900,'Sadaryx':500000,'Savrilium':123200,'Scrap':3500,'Silicon':2400,'Slam':37900,'Steel':2000,'Stileron':136700,'Stims':5400,'Sunset Berries':82100,'Taranite':25800,'Tin':4000,'Titanium':8100,'Torite':7700,'Tritium':33300,'Tungsten':10300,'Waste':342,'Widow':7400,'Xapyen':4800};

// [source main.js:8479] getUexTier
function getUexTier(n){const p=typeof n==='number'?n:(UEX_PRICE_MAP[n]||0);if(!p)return null;if(p<500)return{key:'vente',label:'🔴 Vente directe',color:'#ef4444',range:'Inférieur à 500'};if(p<600)return{key:'craft_vaisseau',label:'🟢 Supérieur à 500',color:'var(--green)',range:'500–600'};return{key:'craft_fps',label:'🟢 Supérieur à 500',color:'var(--green)',range:'600+'};}

// [source main.js:8480] ROLE_COLORS_DEFAULT
var ROLE_COLORS_DEFAULT={Trader:'#60a5fa',Mineur:'#f79028',Transporteur:'#00ffa3',Explorateur:'#a78bfa',Gestionnaire:'#ff4444'};

// [source main.js:8481] ROLE_COLORS_POOL
var ROLE_COLORS_POOL=['#60a5fa','#f79028','#00ffa3','#a78bfa','#ff4444','#59d0ff','#f472b6','#a3e635','#fb923c','#34d399'];

// [source main.js:8482] ROLE_COLORS
var ROLE_COLORS = new Proxy({}, { get(t,k){
  // Priorité : couleur custom → défaut → pool
  return (typeof ROLES_COLORS_CUSTOM !== 'undefined' && ROLES_COLORS_CUSTOM[k])
    || ROLE_COLORS_DEFAULT[k]
    || ROLE_COLORS_POOL[ROLES.indexOf(k) % ROLE_COLORS_POOL.length]
    || '#aaaaaa';
}});


