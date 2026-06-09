/* ════════════════════════════════════════════════════════════
   BACKUP PANEL — Gestion des sauvegardes MobiGlass TELOS
   Communique avec le VPS via une API légère (backup-api.php
   ou un endpoint Node.js minimal sur le VPS)
════════════════════════════════════════════════════════════ */

// BACKUP_API et BACKUP_TOKEN définis dans config/config.js
// var BACKUP_API = BACKUP_API; // déjà défini dans config.js // endpoint sur le VPS

/* ── Ouvrir le panel backup ─────────────────────────────── */
function openBackupPanel() {
  document.getElementById('backup-overlay').classList.add('open');
  loadBackupList();
}

function closeBackupPanel() {
  document.getElementById('backup-overlay').classList.remove('open');
}

/* ── Charger la liste des backups ───────────────────────── */
async function loadBackupList() {
  const list = document.getElementById('backup-list');
  const stats = document.getElementById('backup-stats');
  list.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center;">Chargement...</div>';

  try {
    const res = await fetch(BACKUP_API + '?action=list&token=' + BACKUP_TOKEN);
    const data = await res.json();

    if (!data.backups || data.backups.length === 0) {
      list.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center;">Aucun backup disponible</div>';
      return;
    }

    // Stats
    stats.innerHTML = `
      <span>📦 ${data.backups.length} backup(s)</span>
      <span>💾 Total : ${data.total_size}</span>
      <span>🕒 Dernier : ${data.backups[0]?.date || '—'}</span>
    `;

    // Liste
    list.innerHTML = data.backups.map((b, i) => `
      <div class="backup-row ${i===0?'backup-latest':''}">
        <div class="backup-info">
          <div class="backup-name">${b.name}</div>
          <div class="backup-meta">${b.date} · ${b.size}</div>
        </div>
        <div class="backup-actions">
          <button class="btn" onclick="downloadBackup('${b.name}')" title="Télécharger">⬇ Télécharger</button>
          <button class="btn danger" onclick="deleteBackup('${b.name}')" title="Supprimer">🗑</button>
        </div>
      </div>
    `).join('');

  } catch(e) {
    list.innerHTML = `<div style="color:var(--red);padding:20px;text-align:center;">
      ⚠ Impossible de contacter l'API backup.<br>
      <small style="color:var(--text-dim)">Vérifiez que le serveur backup est actif sur le VPS.</small>
    </div>`;
  }
}

/* ── Lancer un backup manuel ────────────────────────────── */
async function triggerBackup() {
  const btn = document.getElementById('backup-trigger-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Backup en cours...';
  toast('Backup', 'Sauvegarde en cours...', 'info');

  try {
    const res = await fetch(BACKUP_API + '?action=create&token=' + BACKUP_TOKEN, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      toast('Backup', '✓ Sauvegarde créée : ' + data.filename, 'success');
      loadBackupList();
    } else {
      toast('Backup', '✗ Erreur : ' + data.error, 'error');
    }
  } catch(e) {
    toast('Backup', '✗ Impossible de contacter le serveur', 'error');
  }

  btn.disabled = false;
  btn.textContent = '💾 Lancer un backup maintenant';
}

/* ── Télécharger un backup ──────────────────────────────── */
function downloadBackup(name) {
  window.open(BACKUP_API + '?action=download&file=' + encodeURIComponent(name) + '&token=' + BACKUP_TOKEN, '_blank');
}

/* ── Supprimer un backup ────────────────────────────────── */
async function deleteBackup(name) {
  if (!confirm('Supprimer le backup ' + name + ' ?')) return;

  try {
    const res = await fetch(BACKUP_API + '?action=delete&file=' + encodeURIComponent(name) + '&token=' + BACKUP_TOKEN, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      toast('Backup', 'Backup supprimé', 'success');
      loadBackupList();
    }
  } catch(e) {
    toast('Backup', 'Erreur lors de la suppression', 'error');
  }
}

/* ── Voir les logs backup ───────────────────────────────── */
async function loadBackupLogs() {
  const logs = document.getElementById('backup-logs');
  logs.textContent = 'Chargement...';

  try {
    const res = await fetch(BACKUP_API + '?action=logs&token=' + BACKUP_TOKEN);
    const data = await res.json();
    logs.textContent = data.logs || 'Aucun log disponible';
    logs.scrollTop = logs.scrollHeight;
  } catch(e) {
    logs.textContent = 'Impossible de charger les logs.';
  }
}

/* ── Switcher d'onglets ─────────────────────────────────── */
function switchBackupTab(tab, btn) {
  document.querySelectorAll('.backup-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('backup-tab-backups').style.display = tab === 'backups' ? '' : 'none';
  document.getElementById('backup-tab-logs').style.display = tab === 'logs' ? '' : 'none';
  if (tab === 'logs') loadBackupLogs();
}

/* ── Alias pour openSettingsTab ─────────────────────────── */
function refreshBackupList() { loadBackupList(); }
