/* ════════════════════════════════════════════════════════════
   NAV — visibilité des onglets selon droits
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:109] updateNavRessources
function updateNavRessources() { updateAllNav(); }

// [source main.js:112] updateAllNav
function updateAllNav() {
  // Mapping nav-id → droit requis (null = toujours visible si connecté)
  const NAV_DROITS = {
    'nav-partners':   'partners',
    'nav-joueurs':    'ressource_par',
    'nav-armurerie':  'ressource_par',
    'nav-blueprints': 'blueprints',
    'nav-commandes':  'commandes',
    'nav-objectifs':  'objectifs',
    'nav-missions':   'missions',
    'nav-commerce':   'commerce',
    'nav-stocks':     'stocks',
    'nav-ressources': 'ressources',
    'nav-armurie':    'armurie',
    'nav-banque':     'banque',
    'nav-logs':       'logs',
  };

  // Onglets visibles même sans connexion
  const PUBLIC_NAV = [];

  Object.entries(NAV_DROITS).forEach(([navId, droit]) => {
    const el = document.getElementById(navId);
    if (!el) return;
    if (!SESSION) {
      el.style.display = PUBLIC_NAV.includes(navId) ? '' : 'none';
    } else {
      el.style.display = hasDroit(droit) ? '' : 'none';
    }
  });

  // Inscription visible uniquement si non connecté
  const elInsc = document.getElementById('nav-inscription');
  if (elInsc) elInsc.style.display = SESSION ? 'none' : '';
}


