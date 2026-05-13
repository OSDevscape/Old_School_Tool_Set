const API = '/.netlify/functions/admin';
const TOKEN_KEY = 'osts_admin_token';
const THEME_KEY = 'osts_theme_v2'; // shared with main app
let adminToken = sessionStorage.getItem(TOKEN_KEY) || null;

// ── Theme — synced with main OSTS app (osts_theme_v2) ─────────────────────────
function applyTheme(t) {
  document.body.className = t === 'dark' ? '' : `theme-${t}`;
  // Store as JSON string to match main app's storage.set format
  localStorage.setItem(THEME_KEY, JSON.stringify(t));
  document.querySelectorAll('.theme-chip').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
}
function getSavedTheme() {
  try { return JSON.parse(localStorage.getItem(THEME_KEY)) || 'dark'; }
  catch { return localStorage.getItem(THEME_KEY) || 'dark'; }
}
document.querySelectorAll('.theme-chip').forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.theme)));
applyTheme(getSavedTheme());

// ── Helpers ───────────────────────────────────────────────────────────────────
async function api(payload) {
  const res = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...payload, token:adminToken}) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
let toastTimer;
function toast(msg, colour='var(--text)') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.style.color = colour; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '–'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '–'; }
function checkAuth(e) {
  if (e.message.includes('expired') || e.message.includes('Invalid')) { toast('Session expired — please log in again.','var(--red)'); showLogin(); return true; }
  return false;
}

// ── Login / logout ────────────────────────────────────────────────────────────
function showLogin() {
  adminToken = null; sessionStorage.removeItem(TOKEN_KEY);
  document.getElementById('admin-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}
function showAdmin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-screen').style.display = 'block';
  navigateTo('stats');
}
document.getElementById('login-btn').addEventListener('click', async () => {
  const pw = document.getElementById('login-pw').value;
  const err = document.getElementById('global-error');
  err.textContent = '';
  if (!pw) { err.textContent = 'Enter password.'; return; }
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const data = await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',password:pw})}).then(r=>r.json());
    if (data.error) throw new Error(data.error);
    adminToken = data.token; sessionStorage.setItem(TOKEN_KEY, adminToken); showAdmin();
  } catch(e) { err.textContent = e.message; }
  finally { btn.disabled = false; btn.textContent = 'Enter'; }
});
document.getElementById('login-pw').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-btn').click(); });
document.getElementById('logout-btn').addEventListener('click', showLogin);

// ── Navigation ────────────────────────────────────────────────────────────────
const sectionLoaders = {};
function navigateTo(sec) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(`sec-${sec}`)?.classList.add('active');
  document.querySelector(`nav a[data-sec="${sec}"]`)?.classList.add('active');
  if (sectionLoaders[sec]) sectionLoaders[sec]();
}
document.querySelectorAll('nav a[data-sec]').forEach(a => a.addEventListener('click', () => navigateTo(a.dataset.sec)));

// ── STATS ─────────────────────────────────────────────────────────────────────
sectionLoaders.stats = async () => {
  try {
    const d = await api({action:'stats'});
    document.getElementById('s-users').textContent    = Number(d.totalUsers    ?? 0);
    document.getElementById('s-sessions').textContent = Number(d.activeSessions ?? 0);
    document.getElementById('s-push').textContent     = Number(d.pushSubs       ?? 0);
    document.getElementById('s-30').textContent       = Number(d.signups30      ?? 0);
    const chartEl = document.getElementById('signup-chart');
    const labelsEl = document.getElementById('signup-labels');
    if (d.signups7?.length) {
      const counts = d.signups7.map(r => Number(r.count));
      const max = Math.max(...counts, 1);
      chartEl.innerHTML = d.signups7.map((r,i) => {
        const pct = Math.max(5, Math.round((counts[i]/max)*100));
        const day = new Date(r.day).toLocaleDateString('en-GB',{weekday:'short',day:'numeric'});
        return `<div class="chart-bar" style="height:${pct}%" data-tip="${day}: ${counts[i]}"></div>`;
      }).join('');
      labelsEl.innerHTML = d.signups7.map(r => `<span>${new Date(r.day).toLocaleDateString('en-GB',{weekday:'short'})}</span>`).join('');
    } else { chartEl.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px">No signups in last 7 days.</div>'; }
    const nu = document.getElementById('newest-users');
    nu.innerHTML = d.newestUsers?.length
      ? d.newestUsers.map(u => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="color:var(--gold2);font-weight:500">${escHtml(u.username)}</span><span style="color:var(--muted)">${fmtDate(u.created_at)}</span></div>`).join('')
      : '<div style="color:var(--muted);font-size:12px">No users yet.</div>';
  } catch(e) { if (!checkAuth(e)) toast('Stats error: '+e.message,'var(--red)'); }
};

// ── DB HEALTH ─────────────────────────────────────────────────────────────────
sectionLoaders.db = async () => {
  try {
    const d = await api({action:'db_health'});
    document.getElementById('db-version').textContent = d.version || '–';
    document.getElementById('db-expired').textContent = d.expiredSessions ?? '–';
    document.getElementById('db-oldest').textContent  = d.oldestSnapshot ? fmtDate(d.oldestSnapshot) : '–';
    document.getElementById('db-table-grid').innerHTML = Object.entries(d.tables||{}).map(([t,n]) =>
      `<div class="db-row"><span class="tname">${t}</span><span class="tcount">${n??'–'}</span></div>`).join('');
  } catch(e) { if (!checkAuth(e)) toast('DB error: '+e.message,'var(--red)'); }
};
document.getElementById('btn-clear-expired').addEventListener('click', async () => {
  try { const d = await api({action:'clear_expired'}); document.getElementById('session-msg').textContent = `✅ Cleared ${d.deleted} expired sessions.`; sectionLoaders.db(); }
  catch(e) { if (!checkAuth(e)) document.getElementById('session-msg').textContent = '❌ '+e.message; }
});
document.getElementById('btn-nuke-sessions').addEventListener('click', async () => {
  if (!confirm('Delete ALL active user sessions? Everyone will be logged out.')) return;
  try { const d = await api({action:'nuke_sessions'}); document.getElementById('session-msg').textContent = `⚡ Nuked ${d.deleted} sessions.`; sectionLoaders.db(); }
  catch(e) { if (!checkAuth(e)) document.getElementById('session-msg').textContent = '❌ '+e.message; }
});

// ── USERS ─────────────────────────────────────────────────────────────────────
async function doUserSearch() {
  const q = document.getElementById('user-search-input').value.trim(); if (!q) return;
  const container = document.getElementById('user-results');
  container.innerHTML = '<div class="empty">Searching…</div>';
  try {
    const d = await api({action:'search',query:q});
    if (!d.users.length) { container.innerHTML = '<div class="empty">No users found.</div>'; return; }
    container.innerHTML = d.users.map(u => `
      <div class="user-card" data-uid="${u.id}">
        <div class="uh"><div><div class="uname">${escHtml(u.username)}</div><div class="umeta">ID: ${u.id} &middot; Joined ${fmtDate(u.created_at)}</div></div></div>
        <div class="action-row"><label>Username</label><input type="text" class="inp-uname" value="${escHtml(u.username)}" maxlength="20" autocomplete="off"><button class="sm btn-rename">Save</button></div>
        <div class="action-row"><label>Password</label><input type="password" class="inp-pw" placeholder="New password…" maxlength="64" autocomplete="off"><button class="sm btn-setpw">Set</button></div>
        <div class="action-row"><label>Account</label><button class="danger sm btn-del" style="width:100%">Delete Account</button></div>
        <div class="card-status" id="cs-${u.id}"></div>
      </div>`).join('');
    document.querySelectorAll('.user-card').forEach(card => {
      const uid = card.dataset.uid, st = document.getElementById(`cs-${uid}`);
      const setOk = m => { st.textContent=m; st.className='card-status ok'; };
      const setErr = m => { st.textContent=m; st.className='card-status err'; };
      card.querySelector('.btn-rename').addEventListener('click', async () => {
        const btn = card.querySelector('.btn-rename'), newUsername = card.querySelector('.inp-uname').value.trim();
        btn.disabled=true; btn.textContent='⏳';
        try { await api({action:'update_username',userId:uid,newUsername}); card.querySelector('.uname').textContent=newUsername; setOk(`✅ Renamed to "${newUsername}"`); }
        catch(e) { setErr(e.message); } finally { btn.disabled=false; btn.textContent='Save'; }
      });
      card.querySelector('.btn-setpw').addEventListener('click', async () => {
        const btn = card.querySelector('.btn-setpw'), newPassword = card.querySelector('.inp-pw').value;
        btn.disabled=true; btn.textContent='⏳';
        try { await api({action:'update_password',userId:uid,newPassword}); card.querySelector('.inp-pw').value=''; setOk('✅ Password updated. Their sessions cleared.'); }
        catch(e) { setErr(e.message); } finally { btn.disabled=false; btn.textContent='Set'; }
      });
      card.querySelector('.btn-del').addEventListener('click', async () => {
        if (!confirm(`Permanently delete "${card.querySelector('.uname').textContent}"?`)) return;
        const btn = card.querySelector('.btn-del'); btn.disabled=true; btn.textContent='⏳';
        try { await api({action:'delete_user',userId:uid}); card.style.opacity='.4'; card.style.pointerEvents='none'; setOk('✅ Account deleted.'); }
        catch(e) { setErr(e.message); btn.disabled=false; btn.textContent='Delete Account'; }
      });
    });
  } catch(e) { if (!checkAuth(e)) container.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`; }
}
document.getElementById('user-search-btn').addEventListener('click', doUserSearch);
document.getElementById('user-search-input').addEventListener('keydown', e => { if (e.key==='Enter') doUserSearch(); });

// ── PLAYER LOOKUP ─────────────────────────────────────────────────────────────
async function doPlayerSearch() {
  const rsn = document.getElementById('player-rsn-input').value.trim(); if (!rsn) return;
  const container = document.getElementById('player-results');
  container.innerHTML = '<div class="empty">Searching…</div>';
  try {
    const d = await api({action:'player_lookup',rsn});
    if (!d.players.length) { container.innerHTML = '<div class="empty">No players found.</div>'; return; }
    container.innerHTML = d.players.map(p => `
      <div class="player-row" data-rsn="${escHtml(p.rsn)}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div><div class="pname">${escHtml(p.display_name||p.rsn)}</div>
          <div class="pmeta">${escHtml(p.account_type||'?')} &middot; Total Lv ${p.total_level??'–'} &middot; Searched ${p.search_count??0}× &middot; ${p.snapshots??0} snapshots${p.latestSnap?` &middot; Latest: ${fmtDate(p.latestSnap)}`:''}</div></div>
          <button class="sm danger btn-clear-cache" data-rsn="${escHtml(p.rsn)}">Clear Cache</button>
        </div>
        <div class="card-status" id="pcs-${escHtml(p.rsn)}"></div>
      </div>`).join('');
    document.querySelectorAll('.btn-clear-cache').forEach(btn => btn.addEventListener('click', async () => {
      const r = btn.dataset.rsn;
      if (!confirm(`Clear all cached snapshots for "${r}"?`)) return;
      btn.disabled=true; btn.textContent='⏳';
      try { const res = await api({action:'clear_player_cache',rsn:r}); const st=document.getElementById(`pcs-${r}`); if(st){st.textContent=`✅ Cleared ${res.snapshotsDeleted} snapshots.`;st.className='card-status ok';} }
      catch(e) { const st=document.getElementById(`pcs-${r}`); if(st){st.textContent=e.message;st.className='card-status err';} btn.disabled=false; btn.textContent='Clear Cache'; }
    }));
  } catch(e) { if (!checkAuth(e)) container.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`; }
}
document.getElementById('player-search-btn').addEventListener('click', doPlayerSearch);
document.getElementById('player-rsn-input').addEventListener('keydown', e => { if (e.key==='Enter') doPlayerSearch(); });

// ── SEARCH LOG ────────────────────────────────────────────────────────────────
document.getElementById('load-searches-btn').addEventListener('click', async () => {
  const limit = document.getElementById('search-limit').value;
  const container = document.getElementById('search-log-container');
  container.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const d = await api({action:'recent_searches',limit:Number(limit)});
    if (!d.searches.length) { container.innerHTML = '<div class="empty">No searches yet.</div>'; return; }
    container.innerHTML = d.searches.map(s => `
      <div class="search-log-row">
        <div><span class="srsn">${escHtml(s.display_name||s.rsn)}</span>
          ${s.account_type?`<span style="color:var(--muted);font-size:10px;margin-left:6px">${escHtml(s.account_type)}</span>`:''}
          ${s.total_level?`<span style="color:var(--muted);font-size:10px;margin-left:4px">Lv ${s.total_level}</span>`:''}
        </div><span class="stime">${fmtDateTime(s.searched_at)}</span>
      </div>`).join('');
  } catch(e) { if (!checkAuth(e)) container.innerHTML = `<div class="empty" style="color:var(--red)">${e.message}</div>`; }
});

// ── PUSH ──────────────────────────────────────────────────────────────────────
sectionLoaders.push = async () => {
  try {
    const d = await api({action:'push_stats'});
    document.getElementById('push-total').textContent = d.total ?? '–';
    const list = document.getElementById('push-sub-list');
    list.innerHTML = d.recent?.length
      ? d.recent.map(s => `<div class="sub-row"><span class="ep">${escHtml(s.endpoint)}</span><span style="color:var(--muted);white-space:nowrap;margin-left:8px">${fmtDate(s.created_at)}</span></div>`).join('')
      : '<div class="empty">No subscriptions yet.</div>';
  } catch(e) { if (!checkAuth(e)) toast('Push error: '+e.message,'var(--red)'); }
};
document.getElementById('broadcast-btn').addEventListener('click', async () => {
  const title=document.getElementById('push-title').value.trim(), body=document.getElementById('push-body').value.trim(), url=document.getElementById('push-url').value.trim()||'/', status=document.getElementById('broadcast-status');
  if (!title||!body){status.textContent='Title and body are required.';status.style.color='var(--red)';return;}
  if (!confirm(`Send push notification to all subscribers?\n\n"${title}"\n${body}`)) return;
  const btn=document.getElementById('broadcast-btn'); btn.disabled=true; btn.textContent='⏳ Sending…'; status.textContent='';
  try { const d=await api({action:'broadcast',title,body,url}); status.textContent=`✅ Sent: ${d.sent}  Failed: ${d.failed}  Cleaned: ${d.cleaned}`; status.style.color='var(--green)'; sectionLoaders.push(); }
  catch(e) { if(!checkAuth(e)){status.textContent='❌ '+e.message;status.style.color='var(--red)';} }
  finally { btn.disabled=false; btn.textContent='📢 Send to All Subscribers'; }
});

// ── APP CONTROLS ──────────────────────────────────────────────────────────────
sectionLoaders.controls = async () => {
  try {
    const d = await api({action:'get_controls'});
    const pill = document.getElementById('maint-pill');
    pill.textContent = d.maintenance ? 'On' : 'Off';
    pill.className = `pill ${d.maintenance?'on':'off'}`;
    document.getElementById('maint-msg').value     = d.maintenanceMsg || '';
    document.getElementById('announce-text').value = d.announcement   || '';
  } catch(e) { if (!checkAuth(e)) toast('Controls error: '+e.message,'var(--red)'); }
};
document.getElementById('maint-on-btn').addEventListener('click', async () => {
  const msg=document.getElementById('maint-msg').value.trim(), st=document.getElementById('maint-status');
  try { await api({action:'set_maintenance',enabled:true,message:msg}); st.textContent='✅ Maintenance mode enabled.'; document.getElementById('maint-pill').textContent='On'; document.getElementById('maint-pill').className='pill on'; }
  catch(e) { if(!checkAuth(e)){st.textContent='❌ '+e.message;st.style.color='var(--red)';} }
});
document.getElementById('maint-off-btn').addEventListener('click', async () => {
  const st=document.getElementById('maint-status');
  try { await api({action:'set_maintenance',enabled:false}); st.textContent='✅ Maintenance mode disabled.'; document.getElementById('maint-pill').textContent='Off'; document.getElementById('maint-pill').className='pill off'; }
  catch(e) { if(!checkAuth(e)){st.textContent='❌ '+e.message;st.style.color='var(--red)';} }
});
document.getElementById('announce-save-btn').addEventListener('click', async () => {
  const text=document.getElementById('announce-text').value.trim(), st=document.getElementById('announce-status');
  try { await api({action:'set_announcement',text}); st.textContent=text?'✅ Announcement saved.':'✅ Announcement cleared.'; st.style.color='var(--green)'; }
  catch(e) { if(!checkAuth(e)){st.textContent='❌ '+e.message;st.style.color='var(--red)';} }
});
document.getElementById('announce-clear-btn').addEventListener('click', () => {
  document.getElementById('announce-text').value = '';
  document.getElementById('announce-save-btn').click();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
if (adminToken) showAdmin();