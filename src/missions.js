/* ════════════════════════════════════════════════════════════
   MISSIONS
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:586] MISSIONS
var MISSIONS = [];


// [source main.js:588] loadMissions
async function loadMissions() {
  const stored = await DB.get('telos-missions');
  if (stored && stored.length) {
    MISSIONS = stored;
  } else {
    // Missions par défaut au premier lancement
    MISSIONS = [
      { id:'m1', icon:'📦', title:'Livraison Titanium — Lorville', desc:'Transporter 340 unités de Titanium de Area18 vers Lorville avant le 25/05.', reward:'+272 000 aUEC', status:'open', dl:'25/05/2956', assignedTo:null, assignedName:null, createdAt:new Date().toISOString() },
      { id:'m2', icon:'💎', title:'Acquisition Bexalite Premium',  desc:'Obtenir 50 unités de Bexalite grade A sur New Babbage pour TradeFleet_Corp.', reward:'+518 000 aUEC', status:'open', dl:'28/05/2956', assignedTo:null, assignedName:null, createdAt:new Date().toISOString() },
      { id:'m3', icon:'🤝', title:'Contrat partenariat Volkov',    desc:'Négocier un contrat de distribution exclusif Quantanium avec Volkov_Trade.', reward:'+150 000 aUEC', status:'done', dl:'21/05/2956', assignedTo:null, assignedName:null, createdAt:new Date().toISOString() },
      { id:'m4', icon:'⚠️', title:'Stock critique — Laranite',     desc:'Réapprovisionner le stock de Laranite (actuellement <10 unités).', reward:'Éviter -320 000 aUEC', status:'open', dl:'24/05/2956', assignedTo:null, assignedName:null, createdAt:new Date().toISOString() },
    ];
    await DB.set('telos-missions', MISSIONS);
  }
  renderMissions();
}


// [source main.js:605] saveMissions
async function saveMissions() {
  await DB.set('telos-missions', MISSIONS);
}


// [source main.js:609] acceptMission
async function acceptMission(id) {
  if (!SESSION) { openLoginModal(null, ()=>acceptMission(id)); return; }
  const m = MISSIONS.find(x=>x.id===id);
  if (!m) return;
  if (m.status !== 'open') { toast('Mission indisponible','Cette mission n\'est plus disponible.','error'); return; }
  m.status = 'accepted';
  m.assignedTo = SESSION.pid;
  m.assignedName = SESSION.name;
  m.acceptedAt = new Date().toISOString();
  await saveMissions();
  renderMissions();
  pushActivity('📋', `${SESSION.name} a accepté la mission : ${m.title}`, m.reward, true);
  toast('Mission acceptée', m.title, 'success');
}


// [source main.js:624] completeMission
async function completeMission(id) {
  if (!SESSION) return;
  const m = MISSIONS.find(x=>x.id===id);
  if (!m || m.assignedTo !== SESSION.pid) return;
  m.status = 'pending_validation';
  m.completedAt = new Date().toISOString();
  await saveMissions();
  renderMissions();
  pushActivity('⏳', `${SESSION.name} a terminé la mission : ${m.title} — En attente de validation`, '', true);
  toast('Mission terminée', 'En attente de validation par un Admin ou Gestionnaire.', 'success');
}


// [source main.js:636] validateMission
async function validateMission(id) {
  if (!canManageRoles()) { toast('Accès refusé','Seuls les Admins et Gestionnaires peuvent valider.','error'); return; }
  const m = MISSIONS.find(x=>x.id===id);
  if (!m) return;
  m.status = 'done';
  m.validatedBy = SESSION.name;
  m.validatedAt = new Date().toISOString();
  await saveMissions();
  renderMissions();
  pushActivity('✅', `Mission validée : ${m.title} — ${m.assignedName||''}`, m.reward, true);
  pushLog('trade','TRADE',`Mission complétée et validée par ${SESSION.name} : "${m.title}" — Reward: ${m.reward}`);
  toast('Mission validée !', `${m.assignedName} a reçu : ${m.reward}`, 'success');
}


// [source main.js:650] rejectMission
async function rejectMission(id) {
  if (!canManageRoles()) return;
  const m = MISSIONS.find(x=>x.id===id);
  if (!m) return;
  m.status = 'open';
  m.assignedTo = null; m.assignedName = null;
  delete m.completedAt; delete m.acceptedAt;
  await saveMissions();
  renderMissions();
  toast('Mission rejetée', 'La mission est de nouveau disponible.', 'info');
}


// [source main.js:662] deleteMission
async function deleteMission(id) {
  const m = MISSIONS.find(x => x.id === id);
  if (!m || !confirm('Supprimer la mission "' + m.title + '" ?')) return;
  MISSIONS = MISSIONS.filter(x => x.id !== id);
  await saveMissions();
  renderMissions();
  toast('Mission supprimée', m.title, 'info');
  pushLog('system', 'ADMIN', 'Mission supprimée : ' + m.title);
}


/* ── Login Modal ── */


// [source main.js:2512] renderMissions
function renderMissions(){
  const el = document.getElementById('missions-list');
  if (!el) return;

  const statusLabel = { open:'OUVERT', accepted:'EN COURS', pending_validation:'EN VALIDATION', done:'TERMINÉ' };
  const statusClass = { open:'ms-open', accepted:'ms-progress', pending_validation:'ms-pending', done:'ms-done' };
  const statusColor = { open:'var(--blue)', accepted:'var(--orange)', pending_validation:'var(--purple)', done:'var(--green)' };

  el.innerHTML = MISSIONS.map(m => {
    const isMine   = SESSION && m.assignedTo === SESSION.pid;
    const isManager = canManageRoles();
    const isPending = m.status === 'pending_validation';
    const isOpen    = m.status === 'open';
    const isAccepted= m.status === 'accepted';
    const isDone    = m.status === 'done';

    // Boutons d'action selon rôle et état — data-action pour éviter les pb de quotes
    const S = 'font-family:var(--ui);font-size:10px;letter-spacing:1px;cursor:pointer;';
    let actions = '';
    if (isOpen && SESSION && !isDone)
      actions += `<button data-action="miss-accept" data-id="${m.id}" style="${S}padding:3px 12px;border:1px solid var(--orange);background:var(--orange-faint);color:var(--orange);text-transform:uppercase;">► ACCEPTER</button>`;
    if (isAccepted && isMine)
      actions += `<button data-action="miss-complete" data-id="${m.id}" style="${S}padding:3px 12px;border:1px solid var(--green);background:rgba(0,255,163,0.08);color:var(--green);text-transform:uppercase;">✓ MARQUER TERMINÉ</button>`;
    if (isPending && isManager) {
      actions += `<button data-action="miss-validate" data-id="${m.id}" style="${S}padding:3px 12px;border:1px solid var(--green);background:rgba(0,255,163,0.08);color:var(--green);">✓ VALIDER</button>`;
      actions += `<button data-action="miss-reject"   data-id="${m.id}" style="${S}padding:3px 10px;border:1px solid rgba(255,68,68,0.4);background:transparent;color:var(--red);">✕ REJETER</button>`;
    }
    // Bouton supprimer — admin/gestionnaire uniquement
    if (isManager)
      actions += `<button data-action="miss-delete" data-id="${m.id}" title="Supprimer la mission" style="${S}padding:3px 9px;border:1px solid rgba(255,68,68,0.35);background:transparent;color:var(--red);margin-left:auto;">🗑</button>`;

    const assignInfo = m.assignedName ? `<span style="font-size:10px;color:var(--text-dim);margin-left:8px;">→ ${esc(m.assignedName)}</span>` : '';

    return `<div class="mission-card" style="border-left:3px solid ${statusColor[m.status]||'var(--border)'};">
      <div class="m-icon">${m.icon}</div>
      <div style="flex:1;">
        <div class="m-title">${esc(m.title)}</div>
        <div class="m-desc">${esc(m.desc)}</div>
        <div class="m-footer" style="flex-wrap:wrap;gap:6px;">
          <span class="m-reward">${esc(m.reward)}</span>
          <span class="m-status ${statusClass[m.status]||''}">${statusLabel[m.status]||m.status}</span>
          <span class="m-dl">⏱ ${m.dl}</span>
          ${isPending ? `<span style="font-size:10px;color:var(--purple);letter-spacing:1px;">⏳ Validation requise</span>` : ''}
          ${isDone && m.validatedBy ? `<span style="font-size:10px;color:var(--green);">✓ Validé par ${esc(m.validatedBy)}</span>` : ''}
        </div>
        ${actions ? `<div style="margin-top:8px;display:flex;gap:6px;align-items:center;">${actions}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
   LIVE PRICE FLUCTUATION
════════════════════════════════════════════════════════════ */

