/* ═══════════════════════════════════════════════════════════════════
   NEXORA — roles.js
   Système de rôles personnalisés + matrice de droits granulaire
   + panneau DEMANDES (approbation/liaison Discord) + sous-onglet SAUVEGARDE.

   Ce fichier est ISOLÉ depuis le main.js monolithique pour correspondre
   à l'architecture modulaire du projet (src/roles.js, src/nav.js, etc.)

   ─────────────────────────────────────────────────────────────────────
   DÉPENDANCES ATTENDUES (déjà définies ailleurs, ne pas redéclarer ici) :
     - DB                     (db.js)      : DB.get(key) / DB.set(key,val)
     - SESSION, players       (auth.js)    : session courante + liste joueurs
     - esc(), toast()         (ui.js)
     - pushLog()              (logs.js)
     - populateRegRoles()     (inscription.js) — peut être absent, appelé avec && 
     - refreshBackupList(), triggerBackup(), loadBackupLogs() (backup-panel.js)
     - renderPlayerList()     (partners.js / joueurs.js)
     - updateAllNav()         (nav.js)     — doit appeler hasDroit() par onglet

   CE FICHIER EXPOSE (utilisé par tout le reste de l'app) :
     - hasDroit(droit)        → utilisé partout pour gater actions/UI
     - canManageRoles()       → utilisé partout pour les droits admin/gestion
     - ROLES, ROLES_CONFIG, ROLES_BASE, ROLES_COLORS_CUSTOM, ROLES_INSCRIPTION_CONFIG

   ⚠ ORDRE DE CHARGEMENT : ce fichier doit être chargé TÔT (juste après
   auth.js et data.js), car hasDroit()/canManageRoles() sont appelés par
   quasiment tous les autres modules (stocks.js, commandes.js, banque.js...).

   ─────────────────────────────────────────────────────────────────────
   INTÉGRATION REQUISE DANS LES AUTRES FICHIERS (à faire manuellement) :

   1) index.html — nav-item dédié dans la sidebar (après PARAMÈTRES) :

      <div class="nav-item" id="nav-roles-droits" onclick="goPanel('roles-droits',this)">
        <div class="n-icon">⬡</div>
        <div><div class="n-main">RÔLES &amp; DROITS</div><div class="n-sub">Permissions Corpo</div></div>
        <span class="nav-badge" id="badge-roles-droits" style="display:none;">0</span>
      </div>

   2) index.html — panel dédié (voir panel-roles-droits-markup.html fourni à part,
      ou redemander si besoin) avec 3 sous-onglets #rd-tab-roles/demandes/backup
      et leurs conteneurs #rd-content-roles/demandes/backup, plus les éléments :
      #roles-name-list, #droits-thead, #droits-tbody, #pending-requests-list,
      #backup-stats, #backup-list, #backup-logs, #demandes-badge.

   3) nav.js — dans updateAllNav(), ajouter :

      const elRD = document.getElementById('nav-roles-droits');
      if (elRD) elRD.style.display = (SESSION && (canManageRoles() || hasDroit('backup'))) ? '' : 'none';

   4) nav.js — dans goPanel(id, el), ajouter le cas d'entrée :

      if (id==='roles-droits') {
        const canRD = canManageRoles(), canBackup = hasDroit('backup');
        if (!canRD && !canBackup) { toast('Accès refusé','Réservé aux Admins et Gestionnaires.','error'); goPanel('hub'); return; }
        const tRoles = document.getElementById('rd-tab-roles');
        const tDemandes = document.getElementById('rd-tab-demandes');
        if (tRoles) tRoles.style.display = canRD ? '' : 'none';
        if (tDemandes) tDemandes.style.display = canRD ? '' : 'none';
        switchRDTab(canRD ? 'roles' : 'backup');
      }

   5) Au démarrage de l'app (entry.js / init()), appeler : await loadRolesConfig();
═══════════════════════════════════════════════════════════════════ */


/* ────────────────── ÉTAT / CONFIGURATION ────────────────── */

// Rôles dynamiques — chargés depuis DB, avec fallback
var ROLES = ['Trader','Mineur','Transporteur','Explorateur','Lead','Gestionnaire'];

// Rôles masqués par défaut du formulaire d'inscription publique
const ROLES_EXCLUS_INSCRIPTION = ['Gestionnaire', 'Lead'];

// Visibilité de chaque rôle dans le formulaire d'inscription { roleName: bool }
var ROLES_INSCRIPTION_CONFIG = {};

// Droits par défaut — structure : { roleKey: { tab: bool, ... } }
// Chargé depuis DB via loadRolesConfig()
var ROLES_CONFIG = null;

// Définition des onglets/fonctions contrôlables
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

var DEFAULT_DROITS = {
  Trader:        { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Mineur:        { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Transporteur:  { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Explorateur:   { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:0,logs:0,ressources:0,armurie:0,edit_stock:1,add_commande:1,use_priority:0,use_branche:0,add_objectif:0,add_mission:0,add_blueprint:0,add_transaction:0,delete_data:0,manage_roles:0 },
  Lead:          { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:1,logs:1,ressources:1,armurie:1,edit_stock:1,add_commande:1,use_priority:1,use_branche:1,add_objectif:1,add_mission:1,add_blueprint:1,add_transaction:1,delete_data:0,manage_roles:0 },
  Gestionnaire:  { hub:1,map:1,partners:1,stocks:1,ressource_par:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,banque:1,logs:1,ressources:1,armurie:1,edit_stock:1,add_commande:1,use_priority:1,use_branche:1,add_objectif:1,add_mission:1,add_blueprint:1,add_transaction:1,delete_data:1,manage_roles:1 },
};

// Couleurs personnalisées des rôles { roleName: '#rrggbb' }
var ROLES_COLORS_CUSTOM = {};

// Rôle de base ('membre' | 'gestionnaire') — découple le NOM affiché du rôle
// de son niveau de pouvoir réel. Renommer un rôle ne casse plus les accès.
var ROLES_BASE = {};

// Palette couleurs par défaut / de secours pour les rôles
var ROLE_COLORS_DEFAULT = { Trader:'#60a5fa', Mineur:'#f79028', Transporteur:'#00ffa3', Explorateur:'#a78bfa', Gestionnaire:'#ff4444' };
var ROLE_COLORS_POOL = ['#60a5fa','#f79028','#00ffa3','#a78bfa','#ff4444','#59d0ff','#f472b6','#a3e635','#fb923c','#34d399'];
var ROLE_COLORS = new Proxy({}, { get(t,k){
  // Priorité : couleur custom → défaut → pool
  return (typeof ROLES_COLORS_CUSTOM !== 'undefined' && ROLES_COLORS_CUSTOM[k])
    || ROLE_COLORS_DEFAULT[k]
    || ROLE_COLORS_POOL[ROLES.indexOf(k) % ROLE_COLORS_POOL.length]
    || '#aaaaaa';
}});


/* ────────────────── CHARGEMENT / SAUVEGARDE ────────────────── */

async function loadRolesConfig() {
  try {
    const saved = await DB.get('telos-roles-config');
    if (saved) {
      ROLES = saved.roles || ROLES;
      ROLES_CONFIG = saved.droits || null;
      ROLES_COLORS_CUSTOM = saved.colors || {};
      ROLES_INSCRIPTION_CONFIG = saved.inscription || {};
      ROLES_BASE = saved.base || {};
    }
    if (!ROLES_CONFIG) ROLES_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DROITS));
    // Initialiser la config inscription pour les rôles qui n'ont pas encore de valeur
    ROLES.forEach(r => {
      if (!(r in ROLES_INSCRIPTION_CONFIG)) {
        ROLES_INSCRIPTION_CONFIG[r] = !ROLES_EXCLUS_INSCRIPTION.includes(r);
      }
      // Rôle de base par défaut : "Gestionnaire" (nom historique) → gestionnaire, sinon membre
      if (!(r in ROLES_BASE)) {
        ROLES_BASE[r] = r === 'Gestionnaire' ? 'gestionnaire' : 'membre';
      }
    });
  } catch(e) { ROLES_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DROITS)); }
}

async function saveRolesConfig() {
  await DB.set('telos-roles-config', { roles: ROLES, droits: ROLES_CONFIG, colors: ROLES_COLORS_CUSTOM, inscription: ROLES_INSCRIPTION_CONFIG, base: ROLES_BASE });
}


/* ────────────────── VÉRIFICATION DES DROITS (utilisé partout) ────────────────── */

function hasDroit(droit) {
  if (!SESSION) return false;
  if (SESSION.isAdmin) return true;
  const player = players.find(p => p.id === SESSION.pid);
  if (!player) return false;
  const cfg = ROLES_CONFIG?.[player.role];
  if (!cfg) return true; // pas de config → accès par défaut
  return !!cfg[droit];
}

function canManageRoles() {
  if (!SESSION) return false;
  if (SESSION.isAdmin) return true;
  const p = players.find(x => x.id === SESSION.pid);
  if (!p) return false;
  return ROLES_BASE[p.role] === 'gestionnaire' || hasDroit('manage_roles');
}


/* ────────────────── PANEL DISTINCT : sous-onglets Rôle&Droit / Demandes / Sauvegarde ────────────────── */

function switchRDTab(tab, btn) {
  if ((tab==='roles' || tab==='demandes') && !canManageRoles()) { toast('Accès refusé','Réservé aux Admins et Gestionnaires.','error'); return; }
  if (tab==='backup' && !canManageRoles() && !hasDroit('backup')) { toast('Accès refusé','','error'); return; }
  ['roles','demandes','backup'].forEach(t=>{
    const content = document.getElementById('rd-content-'+t);
    const tbtn = document.getElementById('rd-tab-'+t);
    if (content) content.style.display = t===tab ? 'flex' : 'none';
    if (tbtn) { tbtn.style.color = t===tab?'var(--text-bright)':'var(--text-dim)'; tbtn.style.borderBottomColor = t===tab?'var(--orange)':'transparent'; }
  });
  if (tab==='roles')    renderRolesDroitsPanel();
  if (tab==='demandes') refreshPendingRequests();
  if (tab==='backup')   refreshBackupList();
}


/* ────────────────── RENDU : RÔLES & DROITS ────────────────── */

function renderRolesDroitsPanel() {
  renderRolesNameList();
  renderDroitsTable();
}

function _roleColorHex(r) {
  // Retourne toujours une valeur hex valide pour input[type=color]
  const v = ROLES_COLORS_CUSTOM[r] || ROLE_COLORS_DEFAULT[r] || ROLE_COLORS_POOL[ROLES.indexOf(r) % ROLE_COLORS_POOL.length] || '#aaaaaa';
  // Si c'est une var() CSS, on retourne un fallback hex
  if (v.startsWith('var(')) return '#aaaaaa';
  return v;
}

function renderRolesNameList() {
  const el = document.getElementById('roles-name-list');
  if (!el) return;
  el.innerHTML = ROLES.map((r, i) => {
    const col = _roleColorHex(r);
    const inscrit = (r in ROLES_INSCRIPTION_CONFIG) ? ROLES_INSCRIPTION_CONFIG[r] : !ROLES_EXCLUS_INSCRIPTION.includes(r);
    const toggleTitle = inscrit ? 'Visible à l\'inscription — cliquer pour masquer' : 'Masqué à l\'inscription — cliquer pour rendre visible';
    const toggleStyle = inscrit
      ? 'border:1px solid var(--orange);color:var(--orange);background:rgba(247,140,30,0.1);'
      : 'border:1px solid var(--border);color:var(--text-dim);background:transparent;';
    const toggleIcon = inscrit ? '📋' : '🚫';
    const base = ROLES_BASE[r] || 'membre';
    return `
    <div style="display:grid;grid-template-columns:1fr 100px 38px auto auto auto auto;gap:6px;align-items:center;">
      <input class="form-input" type="text" value="${r}" data-role-idx="${i}"
        style="padding:6px 9px;font-size:12px;border-left:3px solid ${col};"
        oninput="const _old=ROLES[${i}]; ROLES[${i}]=this.value; syncDroitsRoleKey(${i}, _old, this.value);">
      <select class="form-input" title="Rôle de base — détermine les pouvoirs d'administration réels" style="padding:5px 7px;font-size:10px;" onchange="setRoleBase(${i}, this.value)">
        <option value="membre" ${base==='membre'?'selected':''}>Membre</option>
        <option value="gestionnaire" ${base==='gestionnaire'?'selected':''}>Gestionnaire</option>
      </select>
      <label title="Choisir une couleur" style="position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;width:38px;height:34px;border:1px solid var(--border);background:var(--bg3);">
        <div style="width:18px;height:18px;border-radius:50%;background:${col};border:2px solid rgba(255,255,255,0.15);pointer-events:none;"></div>
        <input type="color" value="${col}" data-role-color-idx="${i}"
          style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;border:none;padding:0;"
          oninput="setRoleColor(${i}, this.value)"
          onchange="setRoleColor(${i}, this.value)">
      </label>
      <button onclick="moveRole(${i},-1)" ${i===0?'disabled':''} title="Monter"
        style="padding:2px 7px;border:1px solid var(--border);color:var(--text-dim);background:transparent;cursor:pointer;font-size:12px;${i===0?'opacity:0.3;':''}" >↑</button>
      <button onclick="moveRole(${i},1)" ${i===ROLES.length-1?'disabled':''} title="Descendre"
        style="padding:2px 7px;border:1px solid var(--border);color:var(--text-dim);background:transparent;cursor:pointer;font-size:12px;${i===ROLES.length-1?'opacity:0.3;':''}" >↓</button>
      <button onclick="toggleRoleInscription('${r}')" title="${toggleTitle}"
        style="padding:2px 8px;cursor:pointer;font-family:var(--ui);font-size:11px;${toggleStyle}" >
        ${toggleIcon}
      </button>
      <button onclick="removeRole(${i})" style="padding:2px 8px;border:1px solid rgba(255,68,68,0.4);color:var(--red);background:transparent;cursor:pointer;font-family:var(--ui);font-size:11px;" title="Supprimer ce rôle">✕</button>
    </div>`;
  }).join('');
}

function setRoleBase(idx, baseRole) {
  const name = ROLES[idx];
  if (!name) return;
  ROLES_BASE[name] = baseRole;
  saveRolesConfig();
}

function setRoleColor(idx, hex) {
  const name = ROLES[idx];
  if (!name) return;
  ROLES_COLORS_CUSTOM[name] = hex;
  // Mettre à jour le cercle et la bordure de l'input en live
  const row = document.querySelectorAll('#roles-name-list > div')[idx];
  if (row) {
    const circle = row.querySelector('label div');
    const inp = row.querySelector('input[type="text"]');
    if (circle) circle.style.background = hex;
    if (inp) inp.style.borderLeftColor = hex;
  }
  // Mettre à jour le tableau des droits (couleurs dans les en-têtes)
  renderDroitsTable();
}

function toggleRoleInscription(roleName) {
  const current = (roleName in ROLES_INSCRIPTION_CONFIG)
    ? ROLES_INSCRIPTION_CONFIG[roleName]
    : !ROLES_EXCLUS_INSCRIPTION.includes(roleName);
  ROLES_INSCRIPTION_CONFIG[roleName] = !current;
  saveRolesConfig();
  renderRolesNameList();
  populateRegRoles && populateRegRoles();
}

function syncDroitsRoleKey(idx, oldName, newName) {
  if (oldName && oldName !== newName) {
    // Migrer droits
    ROLES_CONFIG[newName] = ROLES_CONFIG[oldName];
    delete ROLES_CONFIG[oldName];
    // Migrer couleur custom
    if (ROLES_COLORS_CUSTOM[oldName]) {
      ROLES_COLORS_CUSTOM[newName] = ROLES_COLORS_CUSTOM[oldName];
      delete ROLES_COLORS_CUSTOM[oldName];
    }
    // Migrer rôle de base
    if (oldName in ROLES_BASE) {
      ROLES_BASE[newName] = ROLES_BASE[oldName];
      delete ROLES_BASE[oldName];
    }
    // Migrer visibilité à l'inscription
    if (oldName in ROLES_INSCRIPTION_CONFIG) {
      ROLES_INSCRIPTION_CONFIG[newName] = ROLES_INSCRIPTION_CONFIG[oldName];
      delete ROLES_INSCRIPTION_CONFIG[oldName];
    }
  }
  renderDroitsTable();
}

function addRole() {
  const name = 'Nouveau rôle';
  ROLES.push(name);
  ROLES_CONFIG[name] = { hub:1,map:1,partners:1,stocks:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,logs:0,ressources:0,edit_stock:1,add_commande:1,add_objectif:0,add_mission:0,add_blueprint:0,delete_data:0,manage_roles:0 };
  ROLES_COLORS_CUSTOM[name] = ROLE_COLORS_POOL[(ROLES.length - 1) % ROLE_COLORS_POOL.length];
  ROLES_INSCRIPTION_CONFIG[name] = true; // visible par défaut à l'inscription
  ROLES_BASE[name] = 'membre'; // rôle de base par défaut
  renderRolesNameList();
  renderDroitsTable();
  populateRegRoles && populateRegRoles();
}

function removeRole(idx) {
  if (ROLES.length <= 1) { toast('Impossible','Au moins un rôle requis.','error'); return; }
  const name = ROLES[idx];
  if (!confirm(`Supprimer le rôle "${name}" ?`)) return;
  ROLES.splice(idx, 1);
  delete ROLES_CONFIG[name];
  delete ROLES_COLORS_CUSTOM[name];
  delete ROLES_INSCRIPTION_CONFIG[name];
  delete ROLES_BASE[name];
  renderRolesNameList();
  renderDroitsTable();
  populateRegRoles && populateRegRoles();
}

function moveRole(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= ROLES.length) return;
  [ROLES[idx], ROLES[newIdx]] = [ROLES[newIdx], ROLES[idx]];
  renderRolesNameList();
  renderDroitsTable();
}

function renderDroitsTable() {
  const thead = document.getElementById('droits-thead');
  const tbody = document.getElementById('droits-tbody');
  if (!thead || !tbody) return;

  // Séparateurs visuels entre onglets et actions
  const SEPARATORS = { ressource_par: 'ONGLETS', edit_stock: 'ACTIONS' };

  // En-tête
  thead.innerHTML = '<tr>'
    + '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--border);color:var(--text-dim);font-size:11px;letter-spacing:1px;min-width:220px;position:sticky;left:0;background:var(--bg3);">FONCTION / ONGLET</th>'
    + ROLES.map(r=>`<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:center;white-space:nowrap;min-width:90px;"><span style="display:inline-block;padding:3px 8px;border:1px solid ${ROLE_COLORS[r]||'var(--border)'};color:${ROLE_COLORS[r]||'var(--text)'};font-size:11px;letter-spacing:1px;font-weight:700;">${r}</span></th>`).join('')
    + '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:center;min-width:70px;"><span style="color:#fff;font-size:11px;letter-spacing:1px;font-weight:700;">ADMIN</span></th>'
    + '</tr>';

  let rows = '';
  DROITS_DEFS.forEach(def => {
    // Séparateur de section
    if (SEPARATORS[def.id]) {
      const colSpan = ROLES.length + 2;
      rows += `<tr><td colspan="${colSpan}" style="padding:10px 12px 4px;background:var(--bg2);border-top:2px solid var(--border);border-bottom:1px solid var(--border);">
        <span style="font-size:9px;letter-spacing:2px;color:var(--orange);text-transform:uppercase;font-weight:700;">◈ ${SEPARATORS[def.id]}</span>
      </td></tr>`;
    }
    const cells = ROLES.map(r => {
      const cfg = ROLES_CONFIG[r] || {};
      const val = !!cfg[def.id];
      return `<td style="text-align:center;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <input type="checkbox" ${val?'checked':''} title="${def.desc}"
          onchange="setDroit('${r}','${def.id}',this.checked)"
          style="width:16px;height:16px;cursor:pointer;accent-color:var(--orange);">
      </td>`;
    }).join('');
    rows += `<tr onmouseover="this.style.background='rgba(247,140,30,0.05)'" onmouseout="this.style.background=''">
      <td style="padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.04);position:sticky;left:0;background:inherit;">
        <div style="font-size:13px;color:var(--text-bright);font-weight:600;">${def.label}</div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:1px;">${def.desc}</div>
      </td>
      ${cells}
      <td style="text-align:center;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--green);font-size:15px;">✓</td>
    </tr>`;
  });
  tbody.innerHTML = rows;
}

function setDroit(role, droit, val) {
  if (!ROLES_CONFIG[role]) ROLES_CONFIG[role] = {};
  ROLES_CONFIG[role][droit] = val ? 1 : 0;
  saveRolesConfig()
    .then(() => { updateAllNav(); })
    .catch(e => console.warn('setDroit save error:', e));
}

async function saveRolesAndDroits() {
  // Synchroniser les noms depuis les inputs
  const inputs = document.querySelectorAll('#roles-name-list input[data-role-idx]');
  inputs.forEach((inp, i) => { if (ROLES[i] !== undefined) ROLES[i] = inp.value.trim() || ROLES[i]; });
  await saveRolesConfig();
  toast('Rôles & droits sauvegardés', 'Configuration enregistrée.', 'success');
  renderRolesNameList();
  renderDroitsTable();
  populateRegRoles && populateRegRoles();
}

async function resetRolesConfig() {
  if (!confirm('Réinitialiser tous les rôles et droits aux valeurs par défaut ?')) return;
  ROLES = ['Trader','Mineur','Transporteur','Explorateur','Lead','Gestionnaire'];
  ROLES_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DROITS));
  ROLES_COLORS_CUSTOM = {};
  ROLES_BASE = { Trader:'membre', Mineur:'membre', Transporteur:'membre', Explorateur:'membre', Lead:'membre', Gestionnaire:'gestionnaire' };
  await saveRolesConfig();
  renderRolesDroitsPanel();
  populateRegRoles && populateRegRoles();
  toast('Réinitialisé', 'Rôles et droits remis par défaut.', 'info');
}


/* ────────────────── SOUS-ONGLET : DEMANDES (approbation + liaison Discord) ────────────────── */

function refreshPendingRequests(){
  const list=document.getElementById('pending-requests-list');if(!list)return;
  const pending=players.filter(p=>p.status==='pending');
  if(!pending.length){list.innerHTML='<div style="font-size:12px;color:var(--text-dim);text-align:center;padding:20px;">Aucune demande en attente.</div>';updateDemandesBadge();return;}
  list.innerHTML=pending.map(p=>{
    const discordBadge = p.discordId ? `<span style="font-size:9px;color:#5865F2;border:1px solid #5865F2;padding:1px 6px;margin-left:6px;letter-spacing:1px;">DISCORD</span>` : '';
    const metaLine = p.discordId
      ? `Connecté via Discord — aucun compte NEXORA existant ne correspond à ce pseudo.`
      : `RSI : ${esc(p.rsi_handle||'—')} &nbsp;·&nbsp; <a href="${esc(p.rsi)}" target="_blank" style="color:var(--blue);">Voir profil RSI ↗</a>`;
    const linkUI = p.discordId ? `
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:10px;color:var(--text-dim);">Ou lier à un compte existant :</span>
        <select id="link-select-${p.id}" style="flex:1;min-width:120px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--ui);font-size:11px;padding:4px 6px;">
          <option value="">— choisir un joueur —</option>
          ${players.filter(x=>x.status==='approved'&&x.id!==p.id).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}
        </select>
        <button onclick="linkPendingToExisting('${p.id}')" style="padding:4px 10px;border:1px solid var(--blue);color:var(--blue);background:transparent;cursor:pointer;font-family:var(--ui);font-size:11px;">🔗 LIER</button>
      </div>` : '';
    return `<div class="pending-request-card">
      <div class="pr-name">${esc(p.name)}${discordBadge}</div>
      <div class="pr-meta">${metaLine}</div>
      <div class="pr-actions"><select id="role-select-${p.id}" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--ui);font-size:12px;padding:5px 8px;">${ROLES.map(r=>`<option value="${r}">${r}</option>`).join('')}</select><button onclick="approvePlayer('${p.id}')" style="padding:4px 14px;border:1px solid var(--green);color:var(--green);background:transparent;cursor:pointer;font-family:var(--ui);font-size:11px;">✓ ACCEPTER</button><button onclick="rejectPlayer('${p.id}')" style="padding:4px 14px;border:1px solid var(--red);color:var(--red);background:transparent;cursor:pointer;font-family:var(--ui);font-size:11px;">✕ REFUSER</button></div>
      ${linkUI}
    </div>`;
  }).join('');
  updateDemandesBadge();
}

async function linkPendingToExisting(pendingId) {
  const pending = players.find(x=>x.id===pendingId);
  if (!pending) return;
  const sel = document.getElementById(`link-select-${pendingId}`);
  const targetId = sel?.value;
  if (!targetId) { toast('Sélectionnez un joueur','Choisissez le compte à lier avant de valider.','error'); return; }
  const target = players.find(x=>x.id===targetId);
  if (!target) return;
  target.discordId = pending.discordId;
  target.discordUsername = pending.discordUsername;
  target.discordAvatar = pending.discordAvatar;
  players = players.filter(x=>x.id!==pendingId);
  await DB.set('uex-players', players);
  refreshPendingRequests(); renderPlayerList&&renderPlayerList(); updateDemandesBadge();
  toast('Compte Discord associé', `Discord lié à ${target.name}.`, 'success');
  pushLog('system','Système',`🔗 Discord de "${pending.name}" associé manuellement au compte existant ${target.name}`);
}

async function approvePlayer(pid){
  const p=players.find(x=>x.id===pid);if(!p)return;
  const role=document.getElementById(`role-select-${pid}`)?.value||ROLES[0];
  p.status='approved';p.role=role;p.approvedAt=new Date().toISOString();
  await DB.set('uex-players',players);refreshPendingRequests();renderPlayerList();
  toast('Joueur accepté',`${p.name} — rôle ${role}.`,'success');
  pushLog('system','Système',`✅ ${p.name} accepté dans TELOS (rôle: ${role})`);
}

async function rejectPlayer(pid){
  const p=players.find(x=>x.id===pid);
  if(!p||!confirm(`Refuser la demande de "${p.name}" ?`))return;
  p.status='rejected';p.rejectedAt=new Date().toISOString();
  await DB.set('uex-players',players);refreshPendingRequests();
  toast('Demande refusée',p.name,'info');
  pushLog('system','Système',`❌ Demande de ${p.name} refusée`);
}

function updateDemandesBadge(){
  const count=players.filter(p=>p.status==='pending').length;
  const badge=document.getElementById('demandes-badge');
  if(badge){ if(count>0){badge.textContent=count;badge.style.display='inline';}else{badge.style.display='none';} }
  const navBadge=document.getElementById('badge-roles-droits');
  if(navBadge){ if(count>0){navBadge.textContent=count;navBadge.style.display='';}else{navBadge.style.display='none';} }
}