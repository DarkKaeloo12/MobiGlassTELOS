/* ════════════════════════════════════════════════════════════
   BANQUE
   Module extrait de main.js — NEXORA / MobiGlass TELOS
════════════════════════════════════════════════════════════ */


// [source main.js:8703] BANK_DATA
var BANK_DATA = [];        // Toutes les transactions

// [source main.js:8704] _bankTab
var _bankTab = 'transactions';

// [source main.js:8705] _bankPage
var _bankPage = 1;

// [source main.js:8706] _bankPerPage
var _bankPerPage = 15;

// [source main.js:8707] _bankEditId
var _bankEditId = null;


// [source main.js:8709] BANK_CAT_META
var BANK_CAT_META = {
  don:       { label:'💰 Don',         color:'var(--green)'  },
  depense:   { label:'📤 Dépense',     color:'var(--red)'    },
  commerce:  { label:'💹 Commerce',    color:'#60a5fa'       },
  craft:     { label:'🔧 Craft',       color:'var(--orange)' },
  recompense:{ label:'🎖 Récompense',  color:'#f59e0b'       },
  penalite:  { label:'⚠ Pénalité',    color:'var(--red)'    },
  autre:     { label:'○ Autre',        color:'var(--text-dim)'},
};


// [source main.js:8719] loadBankData
async function loadBankData() {
  BANK_DATA = (await DB.get('telos-bank')) || [];
}

// [source main.js:8722] saveBankData
async function saveBankData() {
  await DB.set('telos-bank', BANK_DATA);
  renderHubBankStats && renderHubBankStats();
}

// ── Visiblité nav banque ──

// [source main.js:8728] updateNavBanque
function updateNavBanque() {
  const el = document.getElementById('nav-banque');
  if (el) el.style.display = (SESSION && hasDroit('banque')) ? '' : 'none';
}

// ── Onglets ──

// [source main.js:8734] setBankTab
function setBankTab(tab, btn) {
  _bankTab = tab;
  // Sécuriser les boutons tab
  document.querySelectorAll('.bank-tab').forEach(b => {
    b.style.color = 'var(--text-dim)';
    b.style.borderBottomColor = 'transparent';
  });
  if (btn) { btn.style.color = 'var(--text-bright)'; btn.style.borderBottomColor = 'var(--orange)'; }
  const activeBtnEl = document.getElementById('btab-'+tab);
  if (activeBtnEl) { activeBtnEl.style.color = 'var(--text-bright)'; activeBtnEl.style.borderBottomColor = 'var(--orange)'; }
  ['transactions','membres','stats'].forEach(t => {
    const p = document.getElementById('bank-panel-'+t);
    const b = document.getElementById('btab-'+t);
    if (p) p.style.display = t===tab ? (t==='transactions'?'flex':'block') : 'none';
    if (b) { b.classList.toggle('active', t===tab); b.style.color=t===tab?'var(--text-bright)':'var(--text-dim)'; b.style.borderBottomColor=t===tab?'var(--orange)':'transparent'; }
  });
  if (tab==='transactions') renderBankTransactions();
  if (tab==='membres')      renderBankMembres();
  if (tab==='stats') {
    if (!SESSION) {
      // Non connecté → afficher message d'accès refusé dans le panel
      const sp = document.getElementById('bank-panel-stats');
      if (sp) sp.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;color:var(--text-dim);">
        <div style="font-size:32px;">🔒</div>
        <div style="font-family:var(--mono);font-size:11px;letter-spacing:2px;color:var(--orange);">ACCÈS RESTREINT</div>
        <div style="font-size:12px;color:var(--text-dim);text-align:center;">Connectez-vous pour consulter les statistiques.</div>
        <button class="btn primary" onclick="openLoginModal()" style="margin-top:6px;padding:8px 22px;letter-spacing:1px;font-size:11px;">SE CONNECTER</button>
      </div>`;
      return;
    }
    renderBankStats();
  }
}


// [source main.js:8768] resetBankFilters
function resetBankFilters() {
  ['bank-date-from','bank-date-to','bank-cat-filter','bank-type-filter','bank-search'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  renderBankTransactions();
}

// ── Rendu principal banque ──

// [source main.js:8776] renderBanque
function renderBanque() {
  // Contrôle d'accès sur le bouton Nouvelle Transaction
  const btnTx = document.getElementById('btn-new-transaction');
  if (btnTx) btnTx.style.display = hasDroit('add_transaction') ? '' : 'none';
  renderBankKPI();
  setBankTab(_bankTab, document.getElementById('btab-'+_bankTab));
}


// [source main.js:8784] renderBankKPI
function renderBankKPI() {
  const el = document.getElementById('bank-kpi');
  if (!el) return;
  const now = Date.now();
  const d7  = now - 7*24*3600*1000;
  const credits7 = BANK_DATA.filter(t=>t.type==='credit'&&new Date(t.date).getTime()>=d7).reduce((s,t)=>s+(t.amount||0),0);
  const debits7  = BANK_DATA.filter(t=>t.type==='debit' &&new Date(t.date).getTime()>=d7).reduce((s,t)=>s+(t.amount||0),0);
  const total    = BANK_DATA.reduce((s,t)=>s+(t.type==='credit'?1:-1)*(t.amount||0),0);
  const todayStr = new Date().toISOString().slice(0,10);
  const txToday  = BANK_DATA.filter(t=>t.date?.slice(0,10)===todayStr).length;
  // Update total
  const tot = document.getElementById('bank-total');
  if (tot) tot.textContent = Math.round(total).toLocaleString('fr-FR')+' aUEC';
  const kpiData = [
    { label:'Revenus (7j)', val:'+'+Math.round(credits7).toLocaleString('fr-FR')+' aUEC', color:'var(--green)', sub: BANK_DATA.filter(t=>t.type==='credit'&&new Date(t.date).getTime()>=d7).length+' transactions' },
    { label:'Dépenses (7j)', val:'-'+Math.round(debits7).toLocaleString('fr-FR')+' aUEC', color:'var(--red)', sub: BANK_DATA.filter(t=>t.type==='debit'&&new Date(t.date).getTime()>=d7).length+' transactions' },
    { label:"Aujourd'hui", val:txToday+' tx', color:'var(--blue)', sub: txToday>0?'Dernière à '+BANK_DATA.filter(t=>t.date?.slice(0,10)===todayStr).at(-1)?.date?.slice(11,16)||'—':'Aucune' },
    { label:'Total transactions', val:BANK_DATA.length.toLocaleString('fr-FR'), color:'var(--text-bright)', sub:'Depuis la création' },
  ];
  el.innerHTML = kpiData.map(k=>`
    <div style="padding:12px 20px;border-right:1px solid var(--border);min-width:180px;flex-shrink:0;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px;">${k.label}</div>
      <div style="font-size:18px;font-weight:700;color:${k.color};font-family:var(--mono);">${k.val}</div>
      <div style="font-size:9px;color:var(--text-dim);margin-top:2px;">${k.sub}</div>
    </div>`).join('');
}

// ── Transactions ──

// [source main.js:8812] getBankFiltered
function getBankFiltered() {
  const search   = (document.getElementById('bank-search')?.value||'').toLowerCase();
  const cat      = document.getElementById('bank-cat-filter')?.value||'';
  const type     = document.getElementById('bank-type-filter')?.value||'';
  const dateFrom = document.getElementById('bank-date-from')?.value||'';
  const dateTo   = document.getElementById('bank-date-to')?.value||'';
  return BANK_DATA.filter(t => {
    if (search && !( (t.desc||'').toLowerCase().includes(search) || (t.member||'').toLowerCase().includes(search) )) return false;
    if (cat  && t.cat  !== cat)  return false;
    if (type && t.type !== type) return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo   && t.date > dateTo+'T23:59') return false;
    return true;
  }).sort((a,b) => (b.date||'').localeCompare(a.date||''));
}


// [source main.js:8828] renderBankTransactions
function renderBankTransactions() {
  const container = document.getElementById('bank-tx-cards');
  const empty     = document.getElementById('bank-empty');
  const countEl   = document.getElementById('bank-count');
  if (!container) return;

  const data  = getBankFiltered();
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / _bankPerPage));
  if (_bankPage > pages) _bankPage = 1;
  const slice = data.slice((_bankPage - 1) * _bankPerPage, _bankPage * _bankPerPage);

  if (countEl) countEl.textContent = total ? `${(_bankPage-1)*_bankPerPage+1}–${Math.min(_bankPage*_bankPerPage,total)} sur ${total} transactions` : '';

  if (!slice.length) { container.innerHTML = ''; empty.style.display = 'block'; renderBankPagination(0, 0); return; }
  empty.style.display = 'none';

  const catMeta    = cat => BANK_CAT_META[cat] || { label: cat, color: 'var(--text-dim)', icon: '○' };
  const memberName = mid => { const p = players.find(x => x.id === mid); return p ? p.name : (mid || 'Système'); };

  container.innerHTML = `
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:2px solid var(--border);">
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;white-space:nowrap;">Date</th>
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Description</th>
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Membre</th>
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Catégorie</th>
        <th style="text-align:left;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Type</th>
        <th style="text-align:right;padding:7px 12px;font-size:9px;letter-spacing:1.5px;color:var(--text-dim);text-transform:uppercase;font-weight:600;">Montant</th>
        <th style="padding:7px 8px;width:36px;"></th>
      </tr>
    </thead>
    <tbody>
      ${slice.map(t => {
        const cm       = catMeta(t.cat);
        const isCredit = t.type === 'credit';
        const amt      = (isCredit ? '+' : '−') + Math.round(t.amount || 0).toLocaleString('fr-FR') + ' aUEC';
        const dateObj  = t.date ? new Date(t.date) : null;
        const dateStr  = dateObj ? dateObj.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';
        const timeStr  = dateObj ? dateObj.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '';
        const mName    = memberName(t.memberId);
        const accentCol = isCredit ? 'var(--green)' : 'var(--red)';
        return `<tr class="bank-row"
          onclick="openBankDetail('${t.id}')"
          style="border-bottom:1px solid var(--border);transition:background 0.1s;">
          <!-- Indicateur + date -->
          <td style="padding:10px 12px;white-space:nowrap;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:3px;height:32px;border-radius:2px;background:${accentCol};flex-shrink:0;"></div>
              <div>
                <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--text-bright);">${dateStr}</div>
                <div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);">${timeStr}</div>
              </div>
            </div>
          </td>
          <!-- Description -->
          <td style="padding:10px 12px;max-width:260px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.desc||'—')}</div>
            ${t.note ? `<div style="font-size:10px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic;margin-top:2px;">${esc(t.note)}</div>` : ''}
          </td>
          <!-- Membre -->
          <td style="padding:10px 12px;white-space:nowrap;">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:22px;height:22px;border-radius:50%;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--orange);flex-shrink:0;">${mName.charAt(0).toUpperCase()}</div>
              <span style="font-size:11px;color:var(--text-dim);">${esc(mName)}</span>
            </div>
          </td>
          <!-- Catégorie -->
          <td style="padding:10px 12px;white-space:nowrap;">
            <span style="font-size:10px;padding:2px 8px;border:1px solid var(--border);color:${cm.color};letter-spacing:0.5px;">${cm.icon} ${cm.label}</span>
          </td>
          <!-- Type -->
          <td style="padding:10px 12px;white-space:nowrap;">
            <span style="font-size:10px;padding:2px 8px;border:1px solid ${accentCol}33;color:${accentCol};letter-spacing:1px;font-family:var(--ui);">${isCredit?'↑ CRÉDIT':'↓ DÉBIT'}</span>
          </td>
          <!-- Montant -->
          <td style="padding:10px 12px;text-align:right;white-space:nowrap;">
            <div style="font-size:15px;font-weight:700;font-family:var(--mono);color:${accentCol};">${amt}</div>
          </td>
          <!-- Supprimer -->
          <td style="padding:10px 8px;text-align:center;" onclick="event.stopPropagation()">
            ${canManageRoles()
              ? `<button onclick="event.stopPropagation();deleteBankTransaction('${t.id}')"
                   style="padding:3px 7px;border:1px solid rgba(255,68,68,0.3);background:transparent;color:rgba(255,68,68,0.6);font-size:11px;cursor:pointer;opacity:0.6;" title="Supprimer"
                   onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">🗑</button>`
              : ''}
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;

  renderBankPagination(total, pages);
}


// [source main.js:8924] renderBankPagination
function renderBankPagination(total, pages) {
  const el = document.getElementById('bank-pagination');
  if (!el) return;
  if (pages <= 1) { el.innerHTML=''; return; }
  let html = '';
  // Afficher N par page
  html += `<select class="form-input" style="width:80px;padding:4px 8px;font-size:11px;height:auto;" onchange="_bankPerPage=parseInt(this.value);_bankPage=1;renderBankTransactions()">
    ${[10,15,25,50].map(n=>`<option value="${n}" ${_bankPerPage===n?'selected':''}>${n}</option>`).join('')}
  </select><span style="font-size:10px;color:var(--text-dim);">par page</span>`;
  html += `<button class="bank-pg-btn" onclick="_bankPage=1;renderBankTransactions()">«</button>`;
  html += `<button class="bank-pg-btn" onclick="_bankPage=Math.max(1,_bankPage-1);renderBankTransactions()">‹</button>`;
  // Pages
  const range = [];
  for (let i=1;i<=pages;i++) {
    if (i<=2||i>=pages-1||Math.abs(i-_bankPage)<=1) range.push(i);
    else if (range[range.length-1]!=='…') range.push('…');
  }
  range.forEach(p => {
    if (p==='…') html+='<span style="color:var(--text-dim);padding:0 4px;">…</span>';
    else html+=`<button class="bank-pg-btn ${p===_bankPage?'active':''}" onclick="_bankPage=${p};renderBankTransactions()">${p}</button>`;
  });
  html += `<button class="bank-pg-btn" onclick="_bankPage=Math.min(${pages},_bankPage+1);renderBankTransactions()">›</button>`;
  html += `<button class="bank-pg-btn" onclick="_bankPage=${pages};renderBankTransactions()">»</button>`;
  html += `<span style="margin-left:auto;font-size:10px;color:var(--text-dim);">${_bankPage*_bankPerPage-_bankPerPage+1}-${Math.min(_bankPage*_bankPerPage,total)} sur ${total}</span>`;
  el.innerHTML = html;
}

// ── Membres ──

// [source main.js:8952] renderBankMembres
function renderBankMembres() {
  const el = document.getElementById('bank-membres-list');
  if (!el) return;
  const byMember = {};
  BANK_DATA.forEach(t => {
    const mid = t.memberId||'';
    if (!byMember[mid]) byMember[mid] = { id:mid, credits:0, debits:0, count:0 };
    if (t.type==='credit') byMember[mid].credits += t.amount||0;
    else                   byMember[mid].debits  += t.amount||0;
    byMember[mid].count++;
  });
  const sorted = Object.values(byMember).sort((a,b)=>b.credits-a.credits);
  if (!sorted.length) { el.innerHTML='<div style="color:var(--text-dim);padding:20px;">Aucune donnée.</div>'; return; }
  el.innerHTML = sorted.map(m => {
    const p = players.find(x=>x.id===m.id);
    const name = p?.name || m.id || 'Système';
    const net = m.credits - m.debits;
    return `<div class="bank-member-card">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:var(--bg2);border:1px solid var(--orange);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--orange);">${name.charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text-bright);">${esc(name)}</div>
          <div style="font-size:9px;color:var(--text-dim);">${m.count} transaction${m.count>1?'s':''}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:4px;">
        <div><div style="font-size:9px;color:var(--text-dim);">Contributions</div><div style="font-size:13px;color:var(--green);font-family:var(--mono);">+${Math.round(m.credits).toLocaleString('fr-FR')}</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Dépenses</div><div style="font-size:13px;color:var(--red);font-family:var(--mono);">-${Math.round(m.debits).toLocaleString('fr-FR')}</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Solde net</div><div style="font-size:13px;color:${net>=0?'var(--green)':'var(--red)'};font-family:var(--mono);">${net>=0?'+':''}${Math.round(net).toLocaleString('fr-FR')}</div></div>
      </div>
    </div>`;
  }).join('');
}

// ── Statistiques ──

// [source main.js:8987] renderBankStats
function renderBankStats() {
  const el = document.getElementById('bank-stats-content');
  if (!el) return;
  const byCat = {};
  BANK_DATA.forEach(t => {
    if (!byCat[t.cat]) byCat[t.cat] = { credits:0, debits:0, count:0 };
    if (t.type==='credit') byCat[t.cat].credits += t.amount||0;
    else                   byCat[t.cat].debits  += t.amount||0;
    byCat[t.cat].count++;
  });
  const totalCredits = BANK_DATA.filter(t=>t.type==='credit').reduce((s,t)=>s+(t.amount||0),0);
  const totalDebits  = BANK_DATA.filter(t=>t.type==='debit').reduce((s,t)=>s+(t.amount||0),0);
  const balance = totalCredits - totalDebits;
  el.innerHTML = `
    <div class="bank-stat-card" style="grid-column:span 2;">
      <div style="font-size:9px;letter-spacing:1.5px;color:var(--text-dim);margin-bottom:12px;">BILAN GLOBAL</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        <div><div style="font-size:9px;color:var(--text-dim);">Total crédits</div><div style="font-size:20px;color:var(--green);font-family:var(--mono);font-weight:700;">+${Math.round(totalCredits).toLocaleString('fr-FR')} aUEC</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Total débits</div><div style="font-size:20px;color:var(--red);font-family:var(--mono);font-weight:700;">-${Math.round(totalDebits).toLocaleString('fr-FR')} aUEC</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Solde net</div><div style="font-size:20px;color:${balance>=0?'var(--green)':'var(--red)'};font-family:var(--mono);font-weight:700;">${balance>=0?'+':''}${Math.round(balance).toLocaleString('fr-FR')} aUEC</div></div>
        <div><div style="font-size:9px;color:var(--text-dim);">Transactions</div><div style="font-size:20px;color:var(--text-bright);font-family:var(--mono);font-weight:700;">${BANK_DATA.length}</div></div>
      </div>
    </div>
    ${Object.entries(byCat).sort((a,b)=>b[1].credits+b[1].debits-a[1].credits-a[1].debits).map(([cat,d])=>{
      const cm = BANK_CAT_META[cat]||{label:cat,color:'var(--text-dim)'};
      return `<div class="bank-stat-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:12px;color:\${cm.color};">\${cm.label}</span>
          <span style="font-size:10px;color:var(--text-dim);">\${d.count} tx</span>
        </div>
        <div style="font-size:13px;color:var(--green);font-family:var(--mono);">+\${Math.round(d.credits).toLocaleString('fr-FR')}</div>
        <div style="font-size:13px;color:var(--red);font-family:var(--mono);">-\${Math.round(d.debits).toLocaleString('fr-FR')}</div>
      </div>`;
    }).join('')}`;
}

// ── Detail / suppression ──

// [source main.js:9024] openBankDetail
function openBankDetail(id) { /* futur : modal détail */ }


// [source main.js:9026] deleteBankTransaction
async function deleteBankTransaction(id) {
  const t = BANK_DATA.find(x=>x.id===id);
  if (!t||!confirm('Supprimer cette transaction ?')) return;
  BANK_DATA = BANK_DATA.filter(x=>x.id!==id);
  await saveBankData();
  renderBanque();
  toast('Transaction supprimée','','info');
}

// ── Modal nouvelle transaction ──
// ── Modal nouvelle transaction ──

// [source main.js:9037] setBtType
function setBtType(type) {
  document.getElementById('bt-type').value = type;
  const btnC = document.getElementById('bt-btn-credit');
  const btnD = document.getElementById('bt-btn-debit');
  const saveBtn = document.getElementById('bt-save-btn');
  if (type === 'credit') {
    btnC.style.background='rgba(0,255,163,0.18)'; btnC.style.color='var(--green)';
    btnD.style.background='transparent'; btnD.style.color='var(--text-dim)';
    if(saveBtn){saveBtn.style.borderColor='var(--green)';saveBtn.style.color='var(--green)';saveBtn.style.background='rgba(0,255,163,0.08)';}
  } else {
    btnD.style.background='rgba(255,68,68,0.18)'; btnD.style.color='var(--red)';
    btnC.style.background='transparent'; btnC.style.color='var(--text-dim)';
    if(saveBtn){saveBtn.style.borderColor='var(--red)';saveBtn.style.color='var(--red)';saveBtn.style.background='rgba(255,68,68,0.08)';}
  }
}


// [source main.js:9053] closeBankTransaction
function closeBankTransaction() {
  document.getElementById('bt-overlay').classList.remove('open');
  _bankEditId = null;
}


// [source main.js:9058] openBankTransaction
function openBankTransaction(editId) {
  if (!editId && !hasDroit('add_transaction')) {
    toast('Accès refusé', 'Votre rôle ne permet pas de créer une transaction.', 'error');
    return;
  }
  _bankEditId = editId||null;
  const t = editId ? BANK_DATA.find(x=>x.id===editId) : null;
  // Peupler le select membres
  const mSel = document.getElementById('bt-member');
  if (mSel) mSel.innerHTML = '<option value="">— Aucun / Système —</option>'
    + players.map(p=>`<option value="${p.id}"${t?.memberId===p.id?' selected':''}>${esc(p.name)}</option>`).join('');
  // Pré-remplir
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
  set('bt-amount', t?.amount ||'');
  set('bt-desc',   t?.desc   ||'');
  set('bt-note',   t?.note   ||'');
  set('bt-cat',    t?.cat    ||'don');
  set('bt-date',   t?.date?.slice(0,16)||new Date().toISOString().slice(0,16));
  // Init boutons type
  setBtType(t?.type||'credit');
  // Titre
  const title = document.getElementById('bt-modal-title');
  if (title) title.textContent = editId ? '✏ MODIFIER LA TRANSACTION' : '💳 NOUVELLE TRANSACTION';
  document.getElementById('bt-overlay').classList.add('open');
}


// [source main.js:9084] saveBankTransaction
async function saveBankTransaction() {
  if (!_bankEditId && !hasDroit('add_transaction')) {
    toast('Accès refusé', 'Votre rôle ne permet pas de créer une transaction.', 'error');
    return;
  }
  const memberId = document.getElementById('bt-member')?.value||'';
  const amount   = parseFloat(document.getElementById('bt-amount')?.value)||0;
  const desc     = document.getElementById('bt-desc')?.value.trim()||'';
  if (!desc)   { toast('Description requise','','error'); return; }
  if (!amount) { toast('Montant requis','','error'); return; }
  const entry = {
    id:       _bankEditId||('btx_'+Date.now()),
    memberId,
    type:     document.getElementById('bt-type')?.value||'credit',
    amount:   Math.abs(amount),
    desc,
    note:     document.getElementById('bt-note')?.value.trim()||'',
    cat:      document.getElementById('bt-cat')?.value||'don',
    date:     document.getElementById('bt-date')?.value||new Date().toISOString().slice(0,16),
    createdBy:SESSION?.pid||'',
  };
  if (_bankEditId) BANK_DATA = BANK_DATA.map(x=>x.id===_bankEditId?entry:x);
  else BANK_DATA.unshift(entry);
  await saveBankData();
  document.getElementById('bt-overlay').classList.remove('open');
  renderBanque();
  const memberName = players.find(p=>p.id===memberId)?.name||'Système';
  pushActivity('🏦', (_bankEditId?'Transaction modifiée':'Nouvelle transaction banque')+' : '+desc, (entry.type==='credit'?'+':'-')+Math.round(amount).toLocaleString('fr-FR')+' aUEC', true);
  toast(_bankEditId?'Transaction modifiée':'Transaction enregistrée', desc, 'success');
  _bankEditId = null;
}



