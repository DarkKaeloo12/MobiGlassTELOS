/* ════════════════════════════════════════════════════════════
   LOGS — historique système
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */

// [source main.js:699] FULL_LOGS_DATA
var FULL_LOGS_DATA = []; // Alimenté en temps réel par les actions

// [source main.js:700] HISTORIQUE_DATA
var HISTORIQUE_DATA = []; // Persistant — commandes livrées/annulées + objectifs validés

// [source main.js:701] _histFilter
var _histFilter = 'all';

// [source main.js:702] _currentLogTab
var _currentLogTab = 'logs';


// [source main.js:1719] renderSysLogs
function renderSysLogs(){
  const el = document.getElementById('sys-logs-mini');
  if (!el) return;
  // Prendre les 6 dernières entrées du vrai flux
  const recent = FULL_LOGS_DATA.slice(0, 6);
  const countEl = document.getElementById('mini-log-count');
  if (countEl) countEl.textContent = FULL_LOGS_DATA.length + ' entrée' + (FULL_LOGS_DATA.length > 1 ? 's' : '');
  if (!recent.length) {
    el.innerHTML = `<div style="color:var(--text-dim);font-size:11px;padding:4px 0;letter-spacing:1px;opacity:0.6;">En attente d'activité...</div>`;
    return;
  }
  const typeCol = { trade:'var(--green)', system:'var(--blue)', partner:'var(--purple)', alert:'var(--orange)', error:'var(--red)' };
  el.innerHTML = recent.map((l,i) => `
    <div class="log-ln" style="animation-delay:${i*0.07}s;cursor:pointer;" onclick="goPanel('logs',document.querySelector('[onclick*=logs]'));setTimeout(()=>setLogFilter('${l.type}',document.querySelector('#panel-logs .filter-btn[onclick*=${l.type}]')),80)">
      <span class="log-ts" style="flex-shrink:0;">[${l.ts}]</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${typeCol[l.type]||'var(--text-dim)'};">${esc(l.msg)}</span>
      <span class="log-ok">OK</span>
    </div>`).join('');
}

// [source main.js:1738] logFilter
var logFilter = 'all';

/* ════════════════════════════════════════════════════════════
   LOGS — Sous-onglets (Logs / Historique)
════════════════════════════════════════════════════════════ */

// [source main.js:1743] switchLogTab
function switchLogTab(tab, btn) {
  _currentLogTab = tab;
  document.getElementById('logtab-content-logs').style.display       = tab === 'logs'       ? 'flex' : 'none';
  document.getElementById('logtab-content-historique').style.display = tab === 'historique' ? 'flex' : 'none';
  ['logs','historique'].forEach(t => {
    const b = document.getElementById('logtab-'+t);
    if (b) {
      b.style.borderBottom = t === tab ? '2px solid var(--orange)' : '2px solid transparent';
      b.style.color        = t === tab ? 'var(--text-bright)' : 'var(--text-dim)';
    }
  });
  if (tab === 'historique') renderHistorique();
  else renderFullLogs();
}

/* ════════════════════════════════════════════════════════════
   HISTORIQUE — Persistant (commandes livrées/annulées + objectifs validés)
════════════════════════════════════════════════════════════ */

// [source main.js:1761] loadHistorique
async function loadHistorique() {
  HISTORIQUE_DATA = (await DB.get('telos-historique')) || [];
}


// [source main.js:1765] pushHistorique
async function pushHistorique(entry) {
  if (!HISTORIQUE_DATA) HISTORIQUE_DATA = [];
  HISTORIQUE_DATA.unshift(entry);
  await DB.set('telos-historique', HISTORIQUE_DATA);
  if (_currentLogTab === 'historique') renderHistorique();
}


// [source main.js:1772] setHistFilter
function setHistFilter(f, btn) {
  _histFilter = f;
  document.querySelectorAll('#panel-logs #logtab-content-historique .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderHistorique();
}


// [source main.js:1779] renderHistorique
function renderHistorique() {
  const el = document.getElementById('hist-full');
  if (!el) return;
  const search = (document.getElementById('hist-search')?.value || '').toLowerCase();

  let data = [...(HISTORIQUE_DATA || [])];
  if (_histFilter === 'commande') data = data.filter(h => h.kind === 'commande' && h.status === 'livree');
  else if (_histFilter === 'objectif') data = data.filter(h => h.kind === 'objectif');
  else if (_histFilter === 'annulee') data = data.filter(h => h.kind === 'commande' && h.status === 'annulee');
  if (search) data = data.filter(h => (h.title||'').toLowerCase().includes(search) || (h.by||'').toLowerCase().includes(search) || (h.commanditaire||'').toLowerCase().includes(search));

  const countEl = document.getElementById('hist-count');
  if (countEl) countEl.textContent = data.length + ' entrée' + (data.length > 1 ? 's' : '');

  if (!data.length) {
    el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-dim);font-size:12px;letter-spacing:1px;">Aucune entrée dans l\'historique.</div>';
    return;
  }

  el.innerHTML = data.map(h => {
    const d = new Date(h.at);
    const dateStr = !isNaN(d) ? d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) : '—';
    const isCmd = h.kind === 'commande';
    const isLivree = h.status === 'livree';
    const isAnnulee = h.status === 'annulee';

    const icon  = isCmd ? (isLivree ? '📋' : '✕') : '✅';
    const color = isCmd ? (isLivree ? 'var(--green)' : 'var(--red)') : 'var(--green)';
    const badge = isCmd
      ? (isLivree ? '<span style="color:var(--green);font-size:9px;letter-spacing:1px;font-family:var(--ui);">LIVRÉE</span>' : '<span style="color:var(--red);font-size:9px;letter-spacing:1px;font-family:var(--ui);">ANNULÉE</span>')
      : '<span style="color:var(--green);font-size:9px;letter-spacing:1px;font-family:var(--ui);">VALIDÉ</span>';
    const sub = isCmd
      ? (h.commanditaire ? ' · ' + esc(h.commanditaire) : '') + (h.craftType ? ' · ' + esc(h.craftType) : '')
      : (h.reward ? ' · ' + esc(h.reward) : '');

    return '<div class="log-entry" style="padding:7px 0;border-bottom:1px solid rgba(247,140,30,0.06);display:flex;gap:10px;align-items:center;">'
      + '<span style="flex-shrink:0;font-size:15px;">' + icon + '</span>'
      + '<div style="flex:1;min-width:0;">'
      +   '<div style="display:flex;align-items:center;gap:8px;">'
      +     '<span style="font-weight:700;color:var(--text-bright);font-size:12px;">' + esc(h.title) + '</span>'
      +     badge
      +   '</div>'
      +   '<div style="font-size:10px;color:var(--text-dim);margin-top:2px;">'
      +     '<span style="color:' + color + ';">' + (isCmd ? (h.type === 'interne' ? 'INTERNE' : 'EXTERNE') : 'OBJECTIF') + '</span>'
      +     esc(sub)
      +     (h.by ? ' · par <span style="color:var(--orange);">' + esc(h.by) + '</span>' : '')
      +   '</div>'
      + '</div>'
      + '<span style="flex-shrink:0;font-size:10px;color:var(--text-dim);font-family:var(--mono);white-space:nowrap;">' + dateStr + '</span>'
      + '</div>';
  }).join('');
}


// [source main.js:1832] setLogFilter
function setLogFilter(f, btn) {
  logFilter = f;
  document.querySelectorAll('#panel-logs .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderFullLogs();
}


// [source main.js:1839] renderFullLogs
function renderFullLogs(){
  const el = document.getElementById('logs-full');
  if (!el) return;
  const search = (document.getElementById('log-search')?.value || '').toLowerCase();

  let data = [...FULL_LOGS_DATA];
  if (logFilter !== 'all') data = data.filter(l => l.type === logFilter);
  if (search) data = data.filter(l => l.msg.toLowerCase().includes(search) || l.tl.toLowerCase().includes(search));

  const countEl = document.getElementById('log-count');
  if (countEl) countEl.textContent = data.length + ' entrée' + (data.length > 1 ? 's' : '');

  if (!data.length) {
    el.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-dim);font-size:12px;letter-spacing:1px;">Aucun log correspondant.</div>`;
    return;
  }

  const typeIcon = { trade:'◈', system:'▸', partner:'⬡', alert:'⚠', error:'✕' };

  el.innerHTML = data.map(l => `
    <div class="log-entry" style="padding:5px 0;border-bottom:1px solid rgba(247,140,30,0.04);display:flex;gap:11px;align-items:baseline;">
      <span class="le-ts" style="flex-shrink:0;">${l.ts}</span>
      <span class="le-type type-${l.type}" style="flex-shrink:0;min-width:72px;">${typeIcon[l.type]||'▸'} [${l.tl}]</span>
      <span class="le-msg" style="flex:1;">${esc(l.msg)}</span>
    </div>`).join('');
}

/* ════════════════════════════════════════════════════════════
   RENDER: STOCKS panel — alimenté par les stocks joueurs + données marché
════════════════════════════════════════════════════════════ */


