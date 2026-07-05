/* ════════════════════════════════════════════════════════════
   AUTH — session, login, TOTP, droits de base
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   PERSISTENT STORAGE — window.storage avec fallback localStorage
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   AUTH — SYSTÈME CORPO TELOS
════════════════════════════════════════════════════════════ */
// [source main.js:7] ADMIN_ID
var ADMIN_ID = 'p_admin'; // DarkKaeloo admin

// [source main.js:8] SESSION
var SESSION = null; // { pid, name, isAdmin }

// ══ DISPATCHER GLOBAL — évite les problèmes de quotes dans les onclick ══════
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id     = btn.dataset.id   || '';
  const id2    = btn.dataset.id2  || '';
  e.stopPropagation();
  switch(action) {
    case 'cmd-status':  setCmdStatus(id, id2); break;
    case 'cmd-edit':    editCommande(id); break;
    case 'cmd-check':   checkCmdStock(id); break;
    case 'cmd-delete':  deleteCommande(id); break;
    case 'cmd-cancel':  cancelCommande(id); break;
    case 'obj-edit':    editObjectif(id); break;
    case 'obj-toggle':  toggleObjDone(id); break;
    case 'obj-delete':       deleteObjectif(id); break;
    case 'obj-check-stock':  refreshObjStockInfo(id).then(() => renderObjectifs()); break;
    case 'bp-remove-ing':    removeBpIngredient(id); break;
    case 'miss-accept':   acceptMission(id); break;
    case 'miss-complete': completeMission(id); break;
    case 'miss-validate': validateMission(id); break;
    case 'miss-reject':   rejectMission(id); break;
    case 'miss-delete':   deleteMission(id); break;
    case 'arm-select':    selectArmPlayer(id); break;
    case 'arm-edit':      openAddArmItem(id); break;
    case 'bp-edit':       editBlueprint(id); break;
    case 'arm-cat-edit':  openArmCatEdit(id); break;
    case 'arm-del':       deleteArmItem(id, event?.target?.closest('[data-name]')?.dataset?.name||id); break;
    case 'bank-delete':  deleteBankTransaction(id); break;
  }
});


// [source main.js:43] PANELS_PUBLIC
var PANELS_PUBLIC = ['hub', 'inscription'];
// Code d'accès Gestionnaire — modifiable par l'Admin
// SHA-256 de "TELOS-CORP-2956" (changeable via les paramètres admin)

// [source main.js:46] GESTIONNAIRE_CODE_KEY
var GESTIONNAIRE_CODE_KEY = 'telos-gestionnaire-code-hash';

// [source main.js:47] CORPO_ACCESS_CODE_KEY
var CORPO_ACCESS_CODE_KEY  = 'telos-corpo-access-code-hash';


// [source main.js:49] getCorpoAccessHash
async function getCorpoAccessHash() {
  const saved = await DB.get(CORPO_ACCESS_CODE_KEY);
  return saved || null; // null = pas de code défini → inscription libre
}


// [source main.js:54] setCorpoAccessCode
async function setCorpoAccessCode(plainCode) {
  const h = await sha256(plainCode);
  await DB.set(CORPO_ACCESS_CODE_KEY, h);
  return h;
}


// [source main.js:60] verifyCorpoAccessCode
async function verifyCorpoAccessCode(input) {
  const stored = await getCorpoAccessHash();
  if (!stored) return false; // Aucun code défini en DB → inscription bloquée
  if (!input || !input.trim()) return false;
  const inputHash = await sha256(input.trim());
  return inputHash === stored;
}

// [source main.js:67] _gestionnaireCodeHash
var _gestionnaireCodeHash = null;


// [source main.js:69] getGestionnaireHash
async function getGestionnaireHash() {
  if (_gestionnaireCodeHash) return _gestionnaireCodeHash;
  // Charger depuis DB ou utiliser le hash par défaut
  const stored = await DB.get(GESTIONNAIRE_CODE_KEY);
  if (stored) { _gestionnaireCodeHash = stored; return stored; }
  // Hash par défaut : SHA-256("TELOS-CORP-2956")
  const defaultHash = await sha256('TELOS-CORP-2956');
  _gestionnaireCodeHash = defaultHash;
  return defaultHash;
}


// [source main.js:80] sha256
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}


// [source main.js:85] isLoggedIn
function isLoggedIn()   { return SESSION !== null; }

// [source main.js:86] isAdmin
function isAdmin()      { return SESSION && SESSION.isAdmin; }

// [source main.js:87] canEdit
function canEdit(pid)   { return SESSION && (SESSION.isAdmin || SESSION.pid === pid); }

// [source main.js:88] requireAuth
function requireAuth(pid, callback) {
  if (canEdit(pid)) return true;
  openLoginModal(pid, callback);
  return false;
}

// [source main.js:93] canManageRoles
function canManageRoles() {
  if (!SESSION) return false;
  const p = players.find(x => x.id === SESSION.pid);
  return SESSION.isAdmin || p?.role === 'Gestionnaire';
}

// Peut éditer une commande EN COURS : Admin, Gestionnaire ou Lead
// Peut éditer une commande selon son statut et le rôle

// [source main.js:101] canEditCommande
function canEditCommande(c) {
  if (!SESSION || !c) return false;
  if (canManageRoles() || hasDroit('edit_commande')) return true;
  const isOwner = (c.createdBy && c.createdBy === SESSION.pid) || (c.client && c.client === SESSION.pid);
  if (c.status === 'attente') return isOwner;
  return false;
}


// [source main.js:148] setSession
function setSession(player) {
  SESSION = { pid: player.id, name: player.name, isAdmin: player.isAdmin||false };
  if (typeof hideLanding === 'function') hideLanding();
  renderAuthBar();
  // Afficher l'onglet RESSOURCES si Admin/Gestionnaire
  pushLog('system', 'SYSTEM', `Connexion établie : ${player.name} — Accès NEXORA ${player.isAdmin?'ADMIN':'standard'}.`);
  if(document.getElementById('panel-stocks').classList.contains('active')) renderStocksFromPlayers();
  renderMissions();
  updateNavRessources();
  updateNavBanque && updateNavBanque();
  const plSbOut = document.getElementById('pl-sidebar');
  if (plSbOut) plSbOut.style.display = 'none';
  renderObjectifs();
  // Masquer la sidebar joueurs — l'onglet Stock est personnel
  const plSb = document.getElementById('pl-sidebar');
  if (plSb) plSb.style.display = 'none';
  toast('Connexion établie', `Bienvenue, ${player.name} — Accès NEXORA sécurisé.`, 'success');
  refreshStockPanel();
  // Recharger les blueprints cochés depuis la DB à chaque connexion
  loadPlayerOwnedBlueprints().then(() => renderBlueprints());
  setTimeout(()=>{ const _ap=document.querySelector('.panel.active'); if(_ap){ const _id=_ap.id.replace('panel-',''); if(!PANELS_PUBLIC.includes(_id)) goPanel(_id); }}, 50);

}


// [source main.js:172] logout
function logout() {
  SESSION = null;
  renderAuthBar();
  // Afficher login wall sur le panel actif si protégé
  const _apl = document.querySelector('.panel.active');
  if (_apl) { const _idl=_apl.id.replace('panel-',''); if(!PANELS_PUBLIC.includes(_idl)) showLoginWall(_apl, _idl); }
  pushLog('system', 'SYSTEM', 'Session NEXORA fermée — déconnexion utilisateur.');
  renderMissions();
  updateNavRessources && updateNavRessources();
  updateNavBanque && updateNavBanque();
  const _sb = document.querySelector('.pl-sidebar');
  if (_sb) _sb.style.display = '';
  toast('Déconnexion', 'Session NEXORA fermée.', 'info');
  setTimeout(() => { if (typeof showLanding === 'function') showLanding(); }, 300);
}


// [source main.js:188] renderAuthBar
async function renderAuthBar() {
  const elName    = document.getElementById('sb-name');
  const elId      = document.getElementById('sb-id');
  const elRang    = document.getElementById('sb-rang');
  const elRes     = document.getElementById('sb-res');
  const elVal     = document.getElementById('sb-stock-val');
  const elAvatar  = document.getElementById('sb-avatar');
  const elRepFill = document.getElementById('sb-rep-fill');
  const elBtn     = document.getElementById('sb-auth-btn');

  if (SESSION) {
    const player = players.find(p => p.id === SESSION.pid);
    const stocks = player ? (await DB.get('uex-stocks-' + player.id)) || [] : [];
    const totalVal = stocks.reduce((a,s) => a + (s.price||0)*s.qty, 0);
    const totalRes = stocks.filter(s => (parseFloat(s.qty)||0) > 0).length;
    const rang     = SESSION.isAdmin ? 'ADMIN' : (player?.role || 'PARTENAIRE');
    const barPct   = Math.min(100, Math.round(totalRes / 20 * 100));

    if (elName)    elName.textContent    = SESSION.name.toUpperCase();
    if (elId)      elId.textContent      = 'ID : ' + (player?.id?.replace('p_','TELOS-') || '—');
    if (elRang) {
      elRang.textContent = rang.toUpperCase();
      elRang.style.color = SESSION.isAdmin ? '#ffffff' : 'var(--text)';
      elRang.style.fontWeight = SESSION.isAdmin ? '700' : '600';
    }
    if (elRes)     elRes.textContent     = totalRes + ' ressource' + (totalRes > 1 ? 's' : '');
    if (elVal)     elVal.textContent     = Math.round(totalVal).toLocaleString('fr-FR') + ' aUEC';
    if (elAvatar) {
      elAvatar.style.overflow = 'hidden';
      elAvatar.innerHTML = avHtml(player || SESSION.name, 44);
    }
    if (elRepFill) elRepFill.style.width = barPct + '%';
    if (elBtn) {
      elBtn.textContent = 'DÉCO';
      elBtn.style.borderColor = 'rgba(255,68,68,0.4)';
      elBtn.style.color = 'var(--red)';
    }
  } else {
    if (elName)    elName.textContent    = '—';
    if (elId)      elId.textContent      = 'ID : —';
    if (elRang)    elRang.textContent    = '—';
    if (elRes)     elRes.textContent     = '—';
    if (elVal)     elVal.textContent     = '—';
    if (elAvatar)  elAvatar.textContent  = '⬡';
    if (elRepFill) elRepFill.style.width = '0%';
    if (elBtn) {
      elBtn.textContent = 'CONNEXION';
      elBtn.style.borderColor = 'var(--orange)';
      elBtn.style.color = 'var(--orange)';
    }
  }
  updateNavRessources && updateNavRessources();
  updateNavBanque && updateNavBanque();
}


/* ════════════════════════════════════════════════════════════
   KPI STRIP — Source unique : valeurs exactes de renderStocksFromPlayers
════════════════════════════════════════════════════════════ */

// [source main.js:301] _loginPendingPlayer
var _loginPendingPlayer = null;


// [source main.js:303] openLoginModal
function openLoginModal(targetPid=null, afterAction=null) {
  _loginTarget = { pid: targetPid, action: afterAction };
  const overlay = document.getElementById('login-overlay');
  const s1 = document.getElementById('login-step-1');
  const s2 = document.getElementById('login-step-2');
  if(s1) s1.style.display='';
  if(s2) s2.style.display='none';
  const ni = document.getElementById('login-name-input');
  if(ni) ni.value='';
  document.getElementById('login-code').value = '';
  document.getElementById('login-err').textContent = '';
  const te = document.getElementById('login-totp-err');
  if(te) te.textContent='';
  _loginPendingPlayer = null;
  overlay.style.display = '';
  overlay.classList.add('open');
  setTimeout(()=>{ const el=document.getElementById('login-name-input'); if(el) el.focus(); else document.getElementById('login-code').focus(); }, 100);
}


// [source main.js:322] closeLoginModal
function closeLoginModal() {
  document.getElementById('login-overlay').classList.remove('open');
  _loginTarget = null;
  _loginPendingPlayer = null;
}


// [source main.js:328] backToLoginStep1
function backToLoginStep1() {
  _loginPendingPlayer = null;
  document.getElementById('login-step-1').style.display='';
  document.getElementById('login-step-2').style.display='none';
}


// [source main.js:334] totpLoginDigit
function totpLoginDigit(el, idx) {
  if(el.value && idx<5) document.querySelectorAll('#login-step-2 .totp-digit-input')[idx+1].focus();
  const code=Array.from(document.querySelectorAll('#login-step-2 .totp-digit-input')).map(i=>i.value).join('');
  if(code.length===6) doLoginTotp();
}


// [source main.js:340] doLoginTotp
async function doLoginTotp() {
  if(!_loginPendingPlayer) return;
  const inputs=document.querySelectorAll('#login-step-2 .totp-digit-input');
  const code=Array.from(inputs).map(i=>i.value).join('');
  const errEl=document.getElementById('login-totp-err');
  if(code.length!==6){errEl.textContent='Entrez les 6 chiffres.';return;}
  const valid=verifyTotpCode(_loginPendingPlayer.totp_secret,code);
  if(!valid){
    errEl.textContent='⚠ Code incorrect ou expiré. Réessayez.';
    inputs.forEach(i=>i.value='');inputs[0].focus();return;
  }
  setSession(_loginPendingPlayer);
  _loginPendingPlayer=null;
  closeLoginModal();
  if(_loginTarget?.action) _loginTarget.action();
}


// [source main.js:357] doLogin
async function doLogin() {
  const nameInput=document.getElementById('login-name-input');
  const name=nameInput?nameInput.value.trim():'';
  const code=document.getElementById('login-code').value.trim();
  const err=document.getElementById('login-err');
  err.textContent='';
  if(!name){err.textContent='Entrez votre pseudo.';return;}
  if(!code){err.textContent='Entrez votre mot de passe.';return;}
  const player=players.find(p=>p.name.toLowerCase()===name.toLowerCase());
  if(!player){err.textContent='Pseudo introuvable.';return;}
  if(player.status==='pending'){err.textContent='⏳ Votre demande est en attente de validation.';return;}
  if(player.status==='suspended'){err.textContent='🔴 Accès suspendu. Contactez un Admin.';return;}
  if(player.status==='rejected'){err.textContent='❌ Votre demande a été refusée.';return;}
  const hash=await sha256(code);
  if(hash!==player.codeHash){err.textContent='⚠ Mot de passe incorrect.';return;}
  setSession(player);closeLoginModal();if(_loginTarget?.action)_loginTarget.action();
}

/* ════════════════════════════════════════════════════════════
   PERSISTANCE — Triple couche : localStorage + window.storage + export JSON
   Clé préfixée 'telos_' pour isoler les données TELOS
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   PERSISTANCE TOTALE — Données embarquées dans le fichier HTML
   Les données sont injectées dans le HTML au moment de la sauvegarde
   Téléchargez le fichier pour une sauvegarde complète et portable
════════════════════════════════════════════════════════════ */

// Données embarquées (injectées lors de la dernière sauvegarde)
/* ── Chargement depuis données embarquées + localStorage ── */
/* ── Export HTML avec données intégrées ── */
/* ── Auto-sauvegarde toutes les 5 minutes ── */

