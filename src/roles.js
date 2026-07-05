/* ════════════════════════════════════════════════════════════
   ROLES & DROITS — système de permissions (hasDroit)
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:6496] ROLES
var ROLES = ['Trader','Mineur','Transporteur','Explorateur','Lead','Gestionnaire'];

// Droits par défaut — structure : { roleKey: { tab: bool, ... } }
// Chargé depuis DB via loadRolesConfig()

// [source main.js:6500] ROLES_CONFIG
var ROLES_CONFIG = null;

// Définition des onglets/fonctions contrôlables

// [source main.js:6503] DROITS_DEFS
var DROITS_DEFS = [
  { id:'hub',           label:'🏠 Tableau de bord',      desc:'Accès au hub principal' },
  { id:'map',           label:'🗺 Carte Stanton',         desc:'Carte interactive' },
  { id:'partners',      label:'👥 Partenaires',            desc:'Voir la liste des partenaires' },
  { id:'stocks',        label:'📦 Stocks TELOS',           desc:'Voir le stock global consolidé' },
  { id:'ressource_par', label:'◈ Ressource par partenaire',desc:'Voir les stocks par partenaire' },
  { id:'blueprints',    label:'📐 Blueprints',             desc:'Voir les blueprints' },
  { id:'commandes',     label:'📋 Commandes',              desc:'Voir les commandes' },
  { id:'objectifs',     label:'🎯 Objectifs',              desc:'Voir les objectifs' },
  { id:'missions',      label:'🛡 Missions',               desc:'Voir les missions' },
  { id:'commerce',      label:'💹 Commerce',               desc:'Voir le panneau commerce' },
  { id:'banque',        label:'🏦 Banque',                 desc:'Accès à la banque TELOS' },
  { id:'logs',          label:'📡 Logs',                   desc:'Accès aux journaux système' },
  { id:'ressources',    label:'🔬 Data Ressource',         desc:'Catalogue ressources (admin/gest.)' },
  { id:'armurie',       label:'⚔ Data Armurie',           desc:'Catalogue armement (admin/gest.)' },
  { id:'edit_stock',    label:'✏ Modifier stock',          desc:'Ajouter/modifier son propre stock' },
  { id:'add_commande',    label:'+ Créer commande',          desc:'Créer une commande' },
  { id:'edit_commande',   label:'✏ Modifier commande',       desc:'Modifier une commande existante' },
  { id:'delete_commande', label:'🗑 Supprimer commande',      desc:'Supprimer une commande' },
  { id:'status_commande', label:'▶ Gérer état commande',      desc:'Changer le statut d\'une commande (en cours, livrée...)' },
  { id:'edit_objectif',   label:'✏ Modifier objectif',       desc:'Modifier un objectif existant' },
  { id:'status_objectif', label:'▶ Gérer état objectif',     desc:'Valider ou réactiver un objectif' },
  { id:'delete_objectif', label:'🗑 Supprimer objectif',      desc:'Supprimer un objectif' },
  { id:'edit_blueprint',  label:'✏ Modifier blueprint',      desc:'Modifier un blueprint existant' },
  { id:'use_priority',  label:'🔴 Priorité commande',      desc:'Choisir la priorité d\'une commande' },
  { id:'use_branche',   label:'🔗 Commande de Branche',      desc:'Marquer une commande comme branchée' },
  { id:'add_objectif',  label:'+ Créer objectif',          desc:'Créer un objectif' },
  { id:'add_mission',   label:'+ Créer mission',           desc:'Créer une mission (Gest.)' },
  { id:'add_blueprint', label:'+ Ajouter blueprint',       desc:'Ajouter un blueprint' },
  { id:'add_transaction',label:'+ Créer transaction',      desc:'Ajouter une transaction banque' },
  { id:'delete_data',   label:'🗑 Supprimer données',      desc:'Supprimer commandes/objectifs/BP' },
  { id:'manage_roles',  label:'⬡ Gérer les rôles',        desc:'Attribuer les rôles aux joueurs' },
  { id:'backup',        label:'💾 Sauvegardes',            desc:'Accès à la gestion des sauvegardes' },
];



// [source main.js:6539] DEFAULT_DROITS
var DEFAULT_DROITS = {
  Trader:        { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Mineur:        { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Transporteur:  { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Explorateur:   { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Lead:          { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:1,logs:1,ressources:1,armurie:1,edit_stock:1,add_commande:1,use_priority:1,use_branche:1,add_objectif:1,add_mission:1,add_blueprint:1,add_transaction:1,delete_data:0,manage_roles:0 },
  Gestionnaire:  { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:1,logs:1,ressources:1,armurie:1,edit_stock:1,add_commande:1,use_priority:1,use_branche:1,add_objectif:1,add_mission:1,add_blueprint:1,add_transaction:1,delete_data:1,manage_roles:1 },
};

// Couleurs personnalisées des rôles { roleName: '#rrggbb' }

// [source main.js:6549] ROLES_COLORS_CUSTOM
var ROLES_COLORS_CUSTOM = {};


// [source main.js:6551] loadRolesConfig
async function loadRolesConfig() {
  try {
    const saved = await DB.get('telos-roles-config');
    if (saved) {
      ROLES = saved.roles || ROLES;
      ROLES_CONFIG = saved.droits || null;
      ROLES_COLORS_CUSTOM = saved.colors || {};
      ROLES_INSCRIPTION_CONFIG = saved.inscription || {};
    }
    if (!ROLES_CONFIG) ROLES_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DROITS));
    // Initialiser la config inscription pour les rôles qui n'ont pas encore de valeur
    ROLES.forEach(r => {
      if (!(r in ROLES_INSCRIPTION_CONFIG)) {
        ROLES_INSCRIPTION_CONFIG[r] = !ROLES_EXCLUS_INSCRIPTION.includes(r);
      }
    });
  } catch(e) { ROLES_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DROITS)); }
}


// [source main.js:6570] saveRolesConfig
async function saveRolesConfig() {
  await DB.set('telos-roles-config', { roles: ROLES, droits: ROLES_CONFIG, colors: ROLES_COLORS_CUSTOM, inscription: ROLES_INSCRIPTION_CONFIG });
}


// [source main.js:6574] hasDroit
function hasDroit(droit) {
  if (!SESSION) return false;
  if (SESSION.isAdmin) return true;
  const player = players.find(p => p.id === SESSION.pid);
  if (!player) return false;
  const cfg = ROLES_CONFIG?.[player.role];
  if (!cfg) return true; // pas de config → accès par défaut
  return !!cfg[droit];
}


// [source main.js:6584] openEditRole
function openEditRole(pid) {
  if (!SESSION) { openLoginModal(null, () => openEditRole(pid)); return; }
  if (!canManageRoles()) {
    toast('Accès refusé', 'Seuls les Admins et Gestionnaires peuvent modifier les rôles.', 'error');
    return;
  }
  const player = players.find(p => p.id === pid);
  if (!player) return;
  document.getElementById('role-player-name').textContent = player.name;
  const sel = document.getElementById('role-select');
  sel.innerHTML = ROLES.map(r =>
    `<option value="${r}" ${player.role === r ? 'selected' : ''}>${r}</option>`
  ).join('');
  document.getElementById('role-pid').value = pid;
  document.getElementById('role-overlay').classList.add('open');
}


// [source main.js:6601] closeEditRole
function closeEditRole() {
  document.getElementById('role-overlay').classList.remove('open');
}


// [source main.js:6605] saveEditRole
async function saveEditRole() {
  const pid     = document.getElementById('role-pid').value;
  const newRole = document.getElementById('role-select').value;
  const i       = players.findIndex(p => p.id === pid);
  if (i < 0) return;
  const oldRole = players[i].role;
  players[i].role = newRole;
  await DB.set('uex-players', players);
  closeEditRole();
  renderAuthBar();
  renderPlayerList();
  renderPartners();
  renderStocksFromPlayers();
  pushActivity('⬡', `${players[i].name} : rôle changé (${oldRole} → ${newRole})`, '', true);
  toast('Rôle mis à jour', `${players[i].name} est maintenant ${newRole}.`, 'success');
}

/* ════════════════════════════════════════════════════════════
   RESSOURCE SELECT — Synchronisation catalogue ↔ champ texte
════════════════════════════════════════════════════════════ */

