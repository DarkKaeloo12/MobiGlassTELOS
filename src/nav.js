/* ════════════════════════════════════════════════════════════
   NAV — visibilité des onglets selon droits
   Module extrait de main.js — NEXORA / MobiGlass TELOS

   Dépend de : SESSION (auth.js), hasDroit() et canManageRoles() (roles.js)
   ⚠ roles.js doit être chargé AVANT ce fichier.
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

  // Nav RÔLES & DROITS : réservé aux Admins/Gestionnaires (ou droit manage_roles),
  // mais aussi accessible (onglet Sauvegarde seul) à qui a le droit backup
  const elRD = document.getElementById('nav-roles-droits');
  if (elRD) elRD.style.display = (SESSION && (canManageRoles() || hasDroit('backup'))) ? '' : 'none';

  // Inscription visible uniquement si non connecté
  const elInsc = document.getElementById('nav-inscription');
  if (elInsc) elInsc.style.display = SESSION ? 'none' : '';
}