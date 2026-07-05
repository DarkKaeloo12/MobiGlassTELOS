/* ════════════════════════════════════════════════════════════
   PARAMETRES — rôles/droits, code accès
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:7460] openSettings
function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  testSupabaseConnection().then(ok=>{
    const el=document.getElementById('supa-status');
    if(el){ el.textContent=ok?'✅ Connecté':'⚠ Hors ligne'; el.style.color=ok?'var(--green)':'var(--orange)'; }
  });
  const s=document.getElementById('settings-admin-section');
  if(s) s.style.display=SESSION?.isAdmin?'':'none';
  // Sections Supabase et Migration visibles uniquement pour l'admin
  const sSupa=document.getElementById('settings-supabase-section');
  if(sSupa) sSupa.style.display=SESSION?.isAdmin?'':'none';
  const sMig=document.getElementById('settings-migration-section');
  if(sMig) sMig.style.display=SESSION?.isAdmin?'':'none';
  // Peupler le select récupération de code
  const recoverSel = document.getElementById('admin-recover-player');
  if (recoverSel && SESSION?.isAdmin) {
    recoverSel.innerHTML = '<option value="">— Sélectionner un joueur —</option>'
      + players.map(p=>'<option value="'+p.id+'">'+esc(p.name)+(p.isAdmin?' [ADMIN]':'')+'</option>').join('');
  }
  const recoverRes = document.getElementById('admin-recover-result');
  if (recoverRes) recoverRes.style.display = 'none';
  // Onglet rôles visible seulement admin
  const stabRoles=document.getElementById('stab-roles');
  if(stabRoles) stabRoles.style.display=SESSION?.isAdmin?'':'none';
  openSettingsTab('general');
}


// [source main.js:7487] openSettingsTab
function openSettingsTab(tab) {
  ['general','demandes','roles','backup'].forEach(t=>{
    const panel=document.getElementById('stab-panel-'+t);
    const btn=document.getElementById('stab-'+t);
    if(panel) panel.style.display = t===tab ? 'flex' : 'none';
    if(btn){ btn.style.color=t===tab?'var(--text-bright)':'var(--text-dim)'; btn.style.borderBottomColor=t===tab?'var(--orange)':'transparent'; }
  });
  if(tab==='roles') renderRolesDroitsPanel();
  if(tab==='demandes') { if(!canManageRoles()) { openSettingsTab('general'); return; } refreshPendingRequests(); }
  if(tab==='backup') { if(!hasDroit('backup') && !SESSION?.isAdmin) { openSettingsTab('general'); return; } refreshBackupList(); }
}

// ── Rendu du panneau Rôles & Droits ──

// [source main.js:7500] renderRolesDroitsPanel
function renderRolesDroitsPanel() {
  renderRolesNameList();
  renderDroitsTable();
}


// [source main.js:7505] _roleColorHex
function _roleColorHex(r) {
  // Retourne toujours une valeur hex valide pour input[type=color]
  const v = ROLES_COLORS_CUSTOM[r] || ROLE_COLORS_DEFAULT[r] || ROLE_COLORS_POOL[ROLES.indexOf(r) % ROLE_COLORS_POOL.length] || '#aaaaaa';
  // Si c'est une var() CSS, on retourne un fallback hex
  if (v.startsWith('var(')) return '#aaaaaa';
  return v;
}



// [source main.js:7514] renderRolesNameList
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
    return `
    <div style="display:grid;grid-template-columns:1fr 38px auto auto auto auto;gap:6px;align-items:center;">
      <input class="form-input" type="text" value="${r}" data-role-idx="${i}"
        style="padding:6px 9px;font-size:12px;border-left:3px solid ${col};"
        oninput="ROLES[${i}]=this.value; syncDroitsRoleKey(${i}, this.value);">
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


// [source main.js:7550] setRoleColor
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


// [source main.js:7566] toggleRoleInscription
function toggleRoleInscription(roleName) {
  const current = (roleName in ROLES_INSCRIPTION_CONFIG)
    ? ROLES_INSCRIPTION_CONFIG[roleName]
    : !ROLES_EXCLUS_INSCRIPTION.includes(roleName);
  ROLES_INSCRIPTION_CONFIG[roleName] = !current;
  saveRolesConfig();
  renderRolesNameList();
  populateRegRoles && populateRegRoles();
}


// [source main.js:7576] syncDroitsRoleKey
function syncDroitsRoleKey(idx, newName) {
  if (oldName && oldName !== newName) {
    // Migrer droits
    ROLES_CONFIG[newName] = ROLES_CONFIG[oldName];
    delete ROLES_CONFIG[oldName];
    // Migrer couleur custom
    if (ROLES_COLORS_CUSTOM[oldName]) {
      ROLES_COLORS_CUSTOM[newName] = ROLES_COLORS_CUSTOM[oldName];
      delete ROLES_COLORS_CUSTOM[oldName];
    }
  }
  renderDroitsTable();
}


// [source main.js:7590] addRole
function addRole() {
  const name = 'Nouveau rôle';
  ROLES.push(name);
  ROLES_CONFIG[name] = { hub:1,map:1,partners:1,stocks:1,blueprints:1,commandes:1,objectifs:1,missions:1,commerce:1,logs:0,ressources:0,edit_stock:1,add_commande:1,add_objectif:0,add_mission:0,add_blueprint:0,delete_data:0,manage_roles:0 };
  ROLES_COLORS_CUSTOM[name] = ROLE_COLORS_POOL[(ROLES.length - 1) % ROLE_COLORS_POOL.length];
  ROLES_INSCRIPTION_CONFIG[name] = true; // visible par défaut à l'inscription
  renderRolesNameList();
  renderDroitsTable();
  populateRegRoles && populateRegRoles();
}


// [source main.js:7601] removeRole
function removeRole(idx) {
  if (ROLES.length <= 1) { toast('Impossible','Au moins un rôle requis.','error'); return; }
  const name = ROLES[idx];
  if (!confirm(`Supprimer le rôle "${name}" ?`)) return;
  ROLES.splice(idx, 1);
  delete ROLES_CONFIG[name];
  delete ROLES_COLORS_CUSTOM[name];
  delete ROLES_INSCRIPTION_CONFIG[name];
  renderRolesNameList();
  renderDroitsTable();
  populateRegRoles && populateRegRoles();
}


// [source main.js:7614] moveRole
function moveRole(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= ROLES.length) return;
  [ROLES[idx], ROLES[newIdx]] = [ROLES[newIdx], ROLES[idx]];
  renderRolesNameList();
  renderDroitsTable();
}


// [source main.js:7622] renderDroitsTable
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


// [source main.js:7667] setDroit
function setDroit(role, droit, val) {
  if (!ROLES_CONFIG[role]) ROLES_CONFIG[role] = {};
  ROLES_CONFIG[role][droit] = val ? 1 : 0;
  saveRolesConfig()
    .then(() => { updateAllNav(); })
    .catch(e => console.warn('setDroit save error:', e));
}


// [source main.js:7675] saveRolesAndDroits
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


// [source main.js:7686] resetRolesConfig
async function resetRolesConfig() {
  if (!confirm('Réinitialiser tous les rôles et droits aux valeurs par défaut ?')) return;
  ROLES = ['Trader','Mineur','Transporteur','Explorateur','Lead','Gestionnaire'];
  ROLES_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DROITS));
  ROLES_COLORS_CUSTOM = {};
  await saveRolesConfig();
  renderRolesDroitsPanel();
  populateRegRoles && populateRegRoles();
  toast('Réinitialisé', 'Rôles et droits remis par défaut.', 'info');
}

// [source main.js:7696] closeSettings
function closeSettings(){document.getElementById('settings-overlay').classList.remove('open');}

// [source main.js:7697] adminRecoverCode
async function adminRecoverCode() {
  const pid = document.getElementById('admin-recover-player')?.value;
  const result = document.getElementById('admin-recover-result');
  if (!result) return;
  if (!pid) { result.style.display='block'; result.style.color='var(--red)'; result.textContent='Sélectionnez un joueur.'; return; }
  try {
    const data = await DB.get('telos-player-code-'+pid);
    if (data?.code) {
      result.style.display='block'; result.style.color='var(--green)';
      const p = players.find(x=>x.id===pid);
      result.innerHTML = '🔑 Code de <b>'+esc(p?.name||pid)+'</b> : <span style="color:var(--orange);font-weight:700;font-size:13px;">'+esc(data.code)+'</span><br><span style="font-size:9px;color:var(--text-dim);">Enregistré le '+new Date(data.savedAt).toLocaleString('fr-FR')+'</span>';
    } else {
      result.style.display='block'; result.style.color='var(--text-dim)';
      result.textContent='Aucun code sauvegardé pour ce joueur.';
    }
  } catch(e) {
    result.style.display='block'; result.style.color='var(--red)'; result.textContent='Erreur.';
  }
}


// [source main.js:7717] saveCorpoAccessCode
async function saveCorpoAccessCode() {
  const n  = document.getElementById('new-corpo-code')?.value.trim();
  const n2 = document.getElementById('confirm-corpo-code')?.value.trim();
  const msg = document.getElementById('corpo-code-msg');
  if (!msg) return;
  if (n !== n2) { msg.style.color='var(--red)'; msg.textContent='⚠ Les codes ne correspondent pas.'; return; }
  if (n && n.length < 4) { msg.style.color='var(--red)'; msg.textContent='⚠ Code trop court (min. 4 caractères).'; return; }
  if (n) {
    await setCorpoAccessCode(n);
    msg.style.color='var(--green)'; msg.textContent='✓ Code corpo enregistré.';
  } else {
    await DB.set(CORPO_ACCESS_CODE_KEY, null);
    msg.style.color='var(--text-dim)'; msg.textContent='Code supprimé — inscription libre.';
  }
  document.getElementById('new-corpo-code').value='';
  document.getElementById('confirm-corpo-code').value='';
  setTimeout(()=>{ if(msg) msg.textContent=''; }, 3000);
}


/* ══════════════════════════════════════════════════════════════════
   ARMURERIE TELOS — Équipements & Armes
════════════════════════════════════════════════════════════════════ */

// [source main.js:8438] saveGestCode
async function saveGestCode(){if(!SESSION?.isAdmin)return;const c1=document.getElementById('new-gest-code')?.value.trim(),c2=document.getElementById('confirm-gest-code')?.value.trim(),msg=document.getElementById('gest-code-msg');if(!c1){if(msg){msg.textContent='Requis';msg.style.color='var(--red)';}return;}if(c1!==c2){if(msg){msg.textContent='Différents';msg.style.color='var(--red)';}return;}await DB.set('telos-gestionnaire-code-hash',await sha256(c1));if(msg){msg.textContent='✓';msg.style.color='var(--green)';}toast('Code','Mis à jour','success');}

