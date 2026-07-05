/* ════════════════════════════════════════════════════════════
   INSCRIPTION — TOTP setup, RSI check, demandes admin
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:5623] switchJTab
function switchJTab(tab){
  // Sous-onglet unique — on s'assure juste que la liste est visible
  const sp = document.getElementById('jsp-list');
  if (sp) sp.style.display = 'flex';
}

/* Register a new player */
// Rôles exclus de la fiche d'inscription (non sélectionnables à l'inscription)
// Désormais géré dynamiquement via ROLES_INSCRIPTION_CONFIG

// [source main.js:5632] ROLES_EXCLUS_INSCRIPTION
const ROLES_EXCLUS_INSCRIPTION = ['Gestionnaire', 'Lead'];

// Config dynamique : true = visible à l'inscription, false = exclu
// Initialisé dans loadRolesConfig / par défaut selon ROLES_EXCLUS_INSCRIPTION

// [source main.js:5636] ROLES_INSCRIPTION_CONFIG
var ROLES_INSCRIPTION_CONFIG = {};


// [source main.js:5638] populateRegRoles
function populateRegRoles() {
  const sel = document.getElementById('reg-role');
  if (!sel) return;
  const current = sel.value;
  // Utilise ROLES_INSCRIPTION_CONFIG si dispo, sinon ROLES_EXCLUS_INSCRIPTION par défaut
  const visibles = ROLES.filter(r => {
    if (r in ROLES_INSCRIPTION_CONFIG) return ROLES_INSCRIPTION_CONFIG[r];
    return !ROLES_EXCLUS_INSCRIPTION.includes(r);
  });
  sel.innerHTML = visibles.length
    ? visibles.map(r => `<option value="${r}">${r}</option>`).join('')
    : '<option value="" disabled>Aucun rôle disponible</option>';
  if (visibles.includes(current)) sel.value = current;
  toggleGestionnaireCode(sel.value);
}


// [source main.js:5654] toggleGestionnaireCode
function toggleGestionnaireCode(role) {
  const field = document.getElementById('gestionnaire-code-field');
  const input = document.getElementById('reg-gestionnaire-code');
  if (!field) return;
  if (role === 'Gestionnaire') {
    field.style.display = 'flex';
    field.style.flexDirection = 'column';
    field.style.gap = '4px';
  } else {
    field.style.display = 'none';
    if (input) input.value = '';
  }
}


// [source main.js:5668] registerPlayer
async function registerPlayer() {
  const name = document.getElementById('reg-name').value.trim();
  const rsi  = document.getElementById('reg-rsi').value.trim();
  const uex  = document.getElementById('reg-uex')?.value.trim() || '';
  const regCode = document.getElementById('reg-code').value.trim();
  const regCodeConfirm = document.getElementById('reg-code-confirm').value.trim();
  ['err-name','err-rsi','err-code','err-code-confirm'].forEach(id=>{const e=document.getElementById(id);if(e){e.textContent='';e.classList.remove('show');}});
  let ok=true;
  if(!name||name.length<2){showErr('err-name','Le pseudo doit faire au moins 2 caractères.');ok=false;}
  else if(players.find(p=>p.name.toLowerCase()===name.toLowerCase())){showErr('err-name','Ce pseudo est déjà enregistré.');ok=false;}
  if(!_rsiVerified){showErr('err-rsi','Veuillez vérifier votre appartenance à TELOS COVENANT.');ok=false;}
  if(!regCode||regCode.length<6){showErr('err-code','Le mot de passe doit faire au moins 6 caractères.');ok=false;}
  if(regCode!==regCodeConfirm){showErr('err-code-confirm','Les mots de passe ne correspondent pas.');ok=false;}
  if(!ok) return;
  const codeHash=await sha256(regCode);
  const isFounder=players.length===0;
  const pid='p_'+Date.now();
  const p={id:pid,name,rsi,uex:uex||null,rsi_handle:_rsiVerifiedHandle||name,
    role:isFounder?'Admin':ROLES[0]||'Fleet',codeHash,isAdmin:isFounder,
    status:isFounder?'approved':'pending',joinedAt:new Date().toISOString(),
    totp_secret:null,totp_verified:false};
  players.push(p);
  await DB.set('uex-players',players);
  if(isFounder){setSession(p);showTotpSetup(p);}
  else{
    document.getElementById('reg-step-1').style.display='none';
    document.getElementById('reg-step-2').style.display='';
    document.getElementById('reg-waiting-name').innerHTML=
      `Votre demande a été transmise aux administrateurs TELOS.<br>Pseudo : <span style="color:var(--orange);">${esc(name)}</span>`;
    notifyDiscordNewRequest(p);
    updateDemandesBadge&&updateDemandesBadge();
  }
}


// [source main.js:5702] _totpSecret
var _totpSecret=null,_rsiVerified=false,_rsiVerifiedHandle=null,_setupTotpPlayer=null;


// [source main.js:5704] resetRsiCheck
function resetRsiCheck(){_rsiVerified=false;_rsiVerifiedHandle=null;const s=document.getElementById('rsi-check-status');if(s){s.textContent='';s.className='';}}


// [source main.js:5706] verifyRsiMembership
async function verifyRsiMembership(){
  const rsiUrl=document.getElementById('reg-rsi').value.trim();
  const name=document.getElementById('reg-name').value.trim();
  const statusEl=document.getElementById('rsi-check-status');
  const btn=document.getElementById('btn-verify-rsi');
  let handle=name;
  const match=rsiUrl.match(/citizens\/([^\/\?]+)/i);
  if(match) handle=match[1];
  if(!handle){statusEl.textContent='⚠ Entrez votre pseudo ou lien RSI.';statusEl.className='err';return;}
  statusEl.textContent='⟳ Vérification en cours...';statusEl.className='loading';
  btn.disabled=true;
  try{
    const res=await fetch('https://ykdamleudeatahrxicgk.supabase.co/functions/v1/verify-rsi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:handle})});
    const data=await res.json();
    if(data.valid){_rsiVerified=true;_rsiVerifiedHandle=data.handle||handle;statusEl.textContent=`✅ Membre TELOS COVENANT confirmé (${_rsiVerifiedHandle})`;statusEl.className='ok';}
    else{_rsiVerified=false;statusEl.textContent=`❌ ${data.error||'Non membre de TELOS COVENANT'}`;statusEl.className='err';}
  }catch(e){statusEl.textContent='⚠ Erreur de vérification.';statusEl.className='err';}
  btn.disabled=false;
}


// [source main.js:5726] notifyDiscordNewRequest
async function notifyDiscordNewRequest(p){
  const webhook=await DB.get('telos-discord-webhook');if(!webhook)return;
  try{await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({embeds:[{title:"📥 Nouvelle demande d'accès — NEXORA",color:0xf78c1e,fields:[{name:'Pseudo',value:p.name,inline:true},{name:'RSI Handle',value:p.rsi_handle||'—',inline:true},{name:'Profil RSI',value:p.rsi,inline:false}],footer:{text:'NEXORA'},timestamp:new Date().toISOString()}]})});}catch(e){}
}


// [source main.js:5731] showTotpSetup
function showTotpSetup(player){
  _setupTotpPlayer=player;
  document.getElementById('reg-step-1').style.display='none';
  document.getElementById('reg-step-2').style.display='none';
  document.getElementById('reg-step-3').style.display='';
  const secret=generateTotpSecret();_totpSecret=secret;
  const cleanSecret=secret.replace(/=+$/,'');
  document.getElementById('totp-secret-display').textContent=`Clé manuelle : ${cleanSecret.match(/.{1,4}/g).join(' ')}`;
  const qrEl=document.getElementById('totp-qrcode');qrEl.innerHTML='';
  const otpUrl=`otpauth://totp/NEXORA:${encodeURIComponent(player.name)}?secret=${cleanSecret}&issuer=NEXORA&algorithm=SHA1&digits=6&period=30`;
  new QRCode(qrEl,{text:otpUrl,width:160,height:160,colorDark:'#000',colorLight:'#fff'});
  document.querySelectorAll('#reg-step-3 .totp-digit-input').forEach(i=>i.value='');
}


// [source main.js:5745] showTotpSetupModal
function showTotpSetupModal(player){
  _setupTotpPlayer=player;
  const secret=generateTotpSecret();_totpSecret=secret;
  sessionStorage.setItem('_totp_tmp', secret); // persist en cas de refresh
  const cleanSecret=secret.replace(/=+$/,'');
  let modal=document.getElementById('totp-setup-overlay');
  if(!modal){
    modal=document.createElement('div');modal.id='totp-setup-overlay';modal.className='overlay';
    modal.style.cssText='display:flex;z-index:10000;';
    modal.innerHTML=`<div class="modal" style="max-width:420px;"><div class="modal-head" style="background:linear-gradient(90deg,rgba(247,140,30,0.15),transparent);"><span class="modal-title" style="font-size:14px;letter-spacing:2px;">🔐 CONFIGURER LA 2FA</span></div><div class="modal-body" style="gap:14px;"><div style="font-size:11px;color:var(--text-dim);letter-spacing:1px;line-height:1.8;">Configurez l'authentification à deux facteurs :<br><br>1. Installez <strong style="color:var(--text);">Microsoft Authenticator</strong> ou <strong>Google Authenticator</strong><br>2. Scannez le QR code<br>3. Entrez le code pour confirmer</div><div id="totp-modal-qrcode" style="display:flex;justify-content:center;margin:8px 0;"></div><div id="totp-modal-secret" style="font-family:var(--mono);font-size:11px;color:var(--text-dim);text-align:center;letter-spacing:1px;"></div><div style="display:flex;gap:8px;justify-content:center;margin:8px 0;"><input class="totp-digit-input totp-modal-digit" maxlength="1" oninput="totpModalDigit(this,0)"><input class="totp-digit-input totp-modal-digit" maxlength="1" oninput="totpModalDigit(this,1)"><input class="totp-digit-input totp-modal-digit" maxlength="1" oninput="totpModalDigit(this,2)"><input class="totp-digit-input totp-modal-digit" maxlength="1" oninput="totpModalDigit(this,3)"><input class="totp-digit-input totp-modal-digit" maxlength="1" oninput="totpModalDigit(this,4)"><input class="totp-digit-input totp-modal-digit" maxlength="1" oninput="totpModalDigit(this,5)"></div><div id="totp-modal-err" style="font-size:11px;color:var(--red);text-align:center;min-height:16px;"></div></div><div class="modal-foot"><button class="btn success" onclick="confirmTotpModal()" style="letter-spacing:2px;">✓ CONFIRMER</button></div></div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('totp-modal-secret').textContent=`Clé manuelle : ${cleanSecret.match(/.{1,4}/g).join(' ')}`;
  const qrEl=document.getElementById('totp-modal-qrcode');qrEl.innerHTML='';
  const otpUrl=`otpauth://totp/NEXORA:${encodeURIComponent(player.name)}?secret=${cleanSecret}&issuer=NEXORA&algorithm=SHA1&digits=6&period=30`;
  new QRCode(qrEl,{text:otpUrl,width:160,height:160,colorDark:'#000',colorLight:'#fff'});
  document.querySelectorAll('.totp-modal-digit').forEach(i=>i.value='');
  document.getElementById('totp-modal-err').textContent='';
  modal.classList.add('open');
  setTimeout(()=>document.querySelector('.totp-modal-digit').focus(),200);
}


// [source main.js:5767] totpModalDigit
function totpModalDigit(el,idx){
  if(el.value&&idx<5) document.querySelectorAll('.totp-modal-digit')[idx+1].focus();
  const code=Array.from(document.querySelectorAll('.totp-modal-digit')).map(i=>i.value).join('');
  if(code.length===6) confirmTotpModal();
}


// [source main.js:5773] confirmTotpModal
async function confirmTotpModal(){
  const inputs=document.querySelectorAll('.totp-modal-digit');
  const code=Array.from(inputs).map(i=>i.value).join('');
  const errEl=document.getElementById('totp-modal-err');
  if(code.length!==6){errEl.textContent='Entrez les 6 chiffres.';return;}
  // Récupérer le secret depuis sessionStorage si _totpSecret est null
  if(!_totpSecret) _totpSecret = sessionStorage.getItem('_totp_tmp');
  if(!_totpSecret){errEl.textContent='⚠ Erreur : session expirée. Rechargez la page.';return;}
  const valid=verifyTotpCode(_totpSecret,code);
  if(!valid){errEl.textContent='⚠ Code incorrect.';inputs.forEach(i=>i.value='');inputs[0].focus();return;}
  const player=_setupTotpPlayer||players.find(p=>p.id===SESSION?.pid);
  if(player){player.totp_secret=_totpSecret;player.totp_verified=true;await DB.set('uex-players',players);}
  _totpSecret=null;_setupTotpPlayer=null;
  sessionStorage.removeItem('_totp_tmp');
  document.getElementById('totp-setup-overlay').classList.remove('open');
  toast('2FA activée !','Votre compte est maintenant sécurisé.','success');
}


// [source main.js:5791] confirmTotpSetup
async function confirmTotpSetup(){
  const inputs=document.querySelectorAll('#reg-step-3 .totp-digit-input');
  const code=Array.from(inputs).map(i=>i.value).join('');
  const errEl=document.getElementById('err-totp-setup');
  if(code.length!==6){errEl.textContent='Entrez les 6 chiffres.';errEl.classList.add('show');return;}
  if(!_totpSecret){errEl.textContent='Erreur : secret TOTP manquant.';errEl.classList.add('show');return;}
  const valid=verifyTotpCode(_totpSecret,code);
  if(!valid){errEl.textContent='⚠ Code incorrect.';errEl.classList.add('show');inputs.forEach(i=>i.value='');inputs[0].focus();return;}
  const player=_setupTotpPlayer||players.find(p=>p.name===document.getElementById('reg-name')?.value.trim());
  if(player){player.totp_secret=_totpSecret;player.totp_verified=true;await DB.set('uex-players',players);}
  _totpSecret=null;_setupTotpPlayer=null;
  toast('2FA configurée !','Authentification à deux facteurs active.','success');
  goPanel('hub');
}


// [source main.js:5806] totpDigitInput
function totpDigitInput(el,idx){
  if(el.value&&idx<5) document.querySelectorAll('#reg-step-3 .totp-digit-input')[idx+1].focus();
}


// [source main.js:5810] generateTotpSecret
function generateTotpSecret(){
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret='';
  const arr=new Uint8Array(16);
  crypto.getRandomValues(arr);
  arr.forEach(b=>{secret+=chars[b%32];});
  return secret;
}


// [source main.js:5819] verifyTotpCode
function verifyTotpCode(secret,token){
  try{
    const cleanSecret=secret.replace(/[^A-Z2-7]/gi,'').toUpperCase();
    const totp=new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(cleanSecret),algorithm:'SHA1',digits:6,period:30});
    const delta=totp.validate({token:token.replace(/\s/g,''),window:2});
    return delta!==null;
  }catch(e){console.error('TOTP error:',e);return false;}
}


// [source main.js:5828] refreshPendingRequests
function refreshPendingRequests(){
  const list=document.getElementById('pending-requests-list');if(!list)return;
  const pending=players.filter(p=>p.status==='pending');
  if(!pending.length){list.innerHTML='<div style="font-size:12px;color:var(--text-dim);text-align:center;padding:20px;">Aucune demande en attente.</div>';updateDemandesBadge();return;}
  list.innerHTML=pending.map(p=>`<div class="pending-request-card"><div class="pr-name">${esc(p.name)}</div><div class="pr-meta">RSI : ${esc(p.rsi_handle||'—')} &nbsp;·&nbsp; <a href="${esc(p.rsi)}" target="_blank" style="color:var(--blue);">Voir profil RSI ↗</a></div><div class="pr-actions"><select id="role-select-${p.id}" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--ui);font-size:12px;padding:5px 8px;">${ROLES.map(r=>`<option value="${r}">${r}</option>`).join('')}</select><button onclick="approvePlayer('${p.id}')" style="padding:4px 14px;border:1px solid var(--green);color:var(--green);background:transparent;cursor:pointer;font-family:var(--ui);font-size:11px;">✓ ACCEPTER</button><button onclick="rejectPlayer('${p.id}')" style="padding:4px 14px;border:1px solid var(--red);color:var(--red);background:transparent;cursor:pointer;font-family:var(--ui);font-size:11px;">✕ REFUSER</button></div></div>`).join('');
  updateDemandesBadge();
}


// [source main.js:5836] approvePlayer
async function approvePlayer(pid){
  const p=players.find(x=>x.id===pid);if(!p)return;
  const role=document.getElementById(`role-select-${pid}`)?.value||ROLES[0];
  p.status='approved';p.role=role;p.approvedAt=new Date().toISOString();
  await DB.set('uex-players',players);refreshPendingRequests();renderPlayerList();
  toast('Joueur accepté',`${p.name} — rôle ${role}.`,'success');
  pushLog('system','Système',`✅ ${p.name} accepté dans TELOS (rôle: ${role})`);
}


// [source main.js:5845] rejectPlayer
async function rejectPlayer(pid){
  const p=players.find(x=>x.id===pid);
  if(!p||!confirm(`Refuser la demande de "${p.name}" ?`))return;
  p.status='rejected';p.rejectedAt=new Date().toISOString();
  await DB.set('uex-players',players);refreshPendingRequests();
  toast('Demande refusée',p.name,'info');
  pushLog('system','Système',`❌ Demande de ${p.name} refusée`);
}


// [source main.js:5854] updateDemandesBadge
function updateDemandesBadge(){
  const badge=document.getElementById('demandes-badge');if(!badge)return;
  const count=players.filter(p=>p.status==='pending').length;
  if(count>0){badge.textContent=count;badge.style.display='inline';}else{badge.style.display='none';}
}



// [source main.js:5861] showErr
function showErr(id,msg){ document.getElementById(id).textContent=msg; document.getElementById(id).classList.add('show'); }

/* Render sidebar player list */

