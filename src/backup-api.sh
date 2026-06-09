#!/bin/bash
# ════════════════════════════════════════════════════════════
#  MobiGlass TELOS — API Backup (serveur Node.js léger)
#  Lance ce script sur le VPS pour activer l'API backup
#  Installe et démarre un micro-serveur Node.js sur le port 3001
# ════════════════════════════════════════════════════════════

cat > /var/www/MobiGlassTELOS/backup-server.js << 'NODEEOF'
const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = '/var/backups/mobiglass';
const LOG_FILE   = '/var/log/mobiglass-backup.log';
const BACKUP_SCRIPT = '/usr/local/bin/mobiglass-backup.sh';
const API_TOKEN  = process.env.BACKUP_TOKEN || 'changeme-token-secret';
const PORT       = 3001;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
}

function json(res, data, status=200) {
  cors(res);
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(1) + ' MB';
}

function formatDate(mtime) {
  return new Date(mtime).toLocaleString('fr-FR');
}

http.createServer((req, res) => {
  // Vérifier le token
  const url = new URL(req.url, 'http://localhost');
  if (url.searchParams.get('token') !== API_TOKEN) {
    return json(res, { error: 'Non autorisé' }, 403);
  }

  const action = url.searchParams.get('action');

  // GET /api/backup?action=list
  if (action === 'list') {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.tar.gz'))
        .map(f => {
          const stat = fs.statSync(path.join(BACKUP_DIR, f));
          return { name: f, size: formatSize(stat.size), date: formatDate(stat.mtime), mtime: stat.mtime };
        })
        .sort((a,b) => new Date(b.mtime) - new Date(a.mtime));

      const totalBytes = files.reduce((acc, f) => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f.name));
        return acc + stat.size;
      }, 0);

      json(res, { backups: files, total_size: formatSize(totalBytes) });
    } catch(e) {
      json(res, { error: e.message }, 500);
    }

  // POST /api/backup?action=create
  } else if (action === 'create' && req.method === 'POST') {
    exec('sudo ' + BACKUP_SCRIPT, (err, stdout, stderr) => {
      if (err) return json(res, { success: false, error: stderr }, 500);
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.tar.gz'));
      const latest = files.sort().pop();
      json(res, { success: true, filename: latest });
    });

  // GET /api/backup?action=download&file=xxx
  } else if (action === 'download') {
    const file = url.searchParams.get('file');
    const filePath = path.join(BACKUP_DIR, path.basename(file));
    if (!fs.existsSync(filePath)) return json(res, { error: 'Fichier introuvable' }, 404);
    res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(file) + '"');
    res.setHeader('Content-Type', 'application/gzip');
    fs.createReadStream(filePath).pipe(res);

  // POST /api/backup?action=delete&file=xxx
  } else if (action === 'delete' && req.method === 'POST') {
    const file = url.searchParams.get('file');
    const filePath = path.join(BACKUP_DIR, path.basename(file));
    try {
      fs.unlinkSync(filePath);
      json(res, { success: true });
    } catch(e) {
      json(res, { success: false, error: e.message }, 500);
    }

  // GET /api/backup?action=logs
  } else if (action === 'logs') {
    try {
      const logs = fs.readFileSync(LOG_FILE, 'utf8');
      const lastLines = logs.split('\n').slice(-50).join('\n');
      json(res, { logs: lastLines });
    } catch(e) {
      json(res, { logs: 'Aucun log disponible.' });
    }

  } else {
    json(res, { error: 'Action inconnue' }, 400);
  }

}).listen(PORT, () => {
  console.log('Backup API démarrée sur le port ' + PORT);
});
NODEEOF

echo "backup-server.js créé dans /var/www/MobiGlassTELOS/"

# Créer le service systemd pour démarrage automatique
cat > /etc/systemd/system/mobiglass-backup-api.service << 'SVCEOF'
[Unit]
Description=MobiGlass Backup API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/MobiGlassTELOS
Environment=BACKUP_TOKEN=changeme-token-secret
ExecStart=/usr/bin/node /var/www/MobiGlassTELOS/backup-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable mobiglass-backup-api
systemctl start mobiglass-backup-api
echo "Service backup-api démarré !"
