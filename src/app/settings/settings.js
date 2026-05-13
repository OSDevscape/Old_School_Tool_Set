import {
  initPage, fetchPlayer, player, showToast, storage, wom,
  STORAGE_KEYS, normalizeAccountType, updateHeaderName,
} from '/src/app/shared.js';

// ─── Init ─────────────────────────────────────────────────────────────────────
initPage('settings');
updateHeaderName();

// ─── Back navigation ──────────────────────────────────────────────────────────
document.getElementById('back-btn').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else window.location.href = '/index.html';
});

// ─── Theme ────────────────────────────────────────────────────────────────────
const savedTheme = storage.get(STORAGE_KEYS.THEME, 'dark');
document.querySelectorAll('.theme-chip').forEach(btn => {
  if (btn.dataset.theme === savedTheme) btn.classList.add('active');
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ─── Profiles ─────────────────────────────────────────────────────────────────
const PROFILES_KEY    = 'osts_profiles_v2';
const ACTIVE_PROF_KEY = 'osts_active_profile_v2';

const TYPE_LABELS = { ironman:'Iron', hardcore:'HCIM', ultimate:'UIM', regular:'Regular', gim:'GIM', ghcim:'GHCIM', ugim:'UGIM' };
const TYPE_ICONS  = { ironman:'🛡', hardcore:'💀', ultimate:'🔱', regular:'⚔', gim:'👥', ghcim:'☠', ugim:'👥' };

function getProfiles()     { return storage.get(PROFILES_KEY, []); }
function saveProfiles(arr) { storage.set(PROFILES_KEY, arr); }
function getActiveId()     { return storage.get(ACTIVE_PROF_KEY, null); }
function setActiveId(id)   { storage.set(ACTIVE_PROF_KEY, id); }
function genId()           { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function typeLabel(t)      { return TYPE_LABELS[normalizeAccountType(t)] || 'Iron'; }
function typeIcon(t)       { return TYPE_ICONS[normalizeAccountType(t)]  || '🛡'; }

function slimCache(data) {
  if (!data) return null;
  return {
    id: data.id, username: data.username, displayName: data.displayName,
    type: data.type, updatedAt: data.updatedAt, latestSnapshot: data.latestSnapshot,
    _hiscoresBosses: data._hiscoresBosses || null,
    _hiscoresActivities: data._hiscoresActivities || null,
    _temple: data._temple || null,
  };
}

function renderProfiles() {
  const profiles = getProfiles();
  const activeId = getActiveId();
  const list     = document.getElementById('sp-profile-list');
  const hasPlayer = !!player.get();

  document.getElementById('sp-save-current').disabled = !hasPlayer || !activeId;
  document.getElementById('sp-save-new').disabled     = !hasPlayer;

  if (!profiles.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0">No saved profiles yet.</div>';
    return;
  }

  const sorted = [...profiles].sort((a,b) => (b.id === activeId) - (a.id === activeId));
  list.innerHTML = sorted.map(p => `
    <div class="sp-profile-card${p.id === activeId ? ' active' : ''}" id="spc-${p.id}">
      <div class="sp-avatar">${typeIcon(p.type)}</div>
      <div class="sp-info">
        <div class="sp-nickname">${p.nickname}</div>
        <div class="sp-rsn-type">${p.rsn} · ${typeLabel(p.type)}</div>
      </div>
      <div class="sp-btns" style="display:flex;gap:4px">
        ${p.id !== activeId ? `<button class="sp-btn" data-load="${p.id}">Load</button>` : '<span style="font-size:10px;color:var(--gold);padding:0 4px">Active</span>'}
        <button class="sp-btn" data-rename="${p.id}">Rename</button>
        <button class="sp-btn" style="border-color:var(--red);color:var(--red)" data-delete="${p.id}">Del</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-load]').forEach(btn =>
    btn.addEventListener('click', () => loadProfile(btn.dataset.load)));
  list.querySelectorAll('[data-rename]').forEach(btn =>
    btn.addEventListener('click', () => renameProfile(btn.dataset.rename)));
  list.querySelectorAll('[data-delete]').forEach(btn =>
    btn.addEventListener('click', () => deleteProfile(btn.dataset.delete)));
}

async function loadProfile(id) {
  const p = getProfiles().find(x => x.id === id);
  if (!p) return;
  setActiveId(id);
  storage.set(STORAGE_KEYS.RSN, p.rsn);
  storage.set(STORAGE_KEYS.ACCOUNT_TYPE, normalizeAccountType(p.type));
  showToast('Loading ' + p.nickname + '…');
  try {
    const data = await fetchPlayer(p.rsn, normalizeAccountType(p.type));
    player.set(data);
    updateHeaderName();
    const profiles = getProfiles();
    const idx = profiles.findIndex(x => x.id === id);
    if (idx !== -1) { profiles[idx].cachedData = slimCache(data); try { saveProfiles(profiles); } catch {} }
    showToast('✅ ' + p.nickname + ' loaded');
    renderProfiles();
  } catch (err) { showToast('❌ ' + (err.message || 'Failed'), 5000); }
}

function renameProfile(id) {
  const profiles = getProfiles();
  const p = profiles.find(x => x.id === id); if (!p) return;
  const card = document.getElementById('spc-' + id); if (!card) return;
  const nameEl = card.querySelector('.sp-nickname');
  const original = p.nickname;
  const inp = document.createElement('input');
  inp.value = original; inp.className = 'sp-nickname-input';
  inp.style.cssText = 'width:100%;margin:0;padding:4px 8px;font-size:13px;border-radius:6px';
  inp.maxLength = 20;
  nameEl.replaceWith(inp); inp.focus(); inp.select();
  function commit() {
    p.nickname = inp.value.trim() || original;
    saveProfiles(profiles); renderProfiles();
    showToast('Renamed to "' + p.nickname + '"');
  }
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') renderProfiles(); });
  inp.addEventListener('blur', commit);
}

function deleteProfile(id) {
  const btn = document.querySelector(`[data-delete="${id}"]`);
  if (btn && !btn.dataset.confirming) {
    btn.dataset.confirming = '1';
    btn.textContent = 'Sure?';
    setTimeout(() => { if (btn.dataset.confirming) { delete btn.dataset.confirming; btn.textContent = 'Del'; } }, 3000);
    return;
  }
  const profiles = getProfiles();
  const p = profiles.find(x => x.id === id); if (!p) return;
  const remaining = profiles.filter(x => x.id !== id);
  saveProfiles(remaining);
  if (getActiveId() === id) {
    setActiveId(remaining[0]?.id || null);
    if (remaining[0]?.cachedData) player.set(remaining[0].cachedData);
  }
  renderProfiles(); showToast('Profile deleted');
}

// Save current profile
document.getElementById('sp-save-current').addEventListener('click', () => {
  const data = player.get(); if (!data) return;
  const activeId = getActiveId(); if (!activeId) return;
  const profiles = getProfiles();
  const idx = profiles.findIndex(x => x.id === activeId); if (idx === -1) return;
  profiles[idx].cachedData = slimCache(data);
  profiles[idx].rsn  = data.displayName || data.username || profiles[idx].rsn;
  profiles[idx].type = data.type || profiles[idx].type;
  try { saveProfiles(profiles); } catch {}
  showToast('✅ Profile updated'); renderProfiles();
});

// Save as new
const nicknameRow = document.getElementById('sp-nickname-row');
document.getElementById('sp-save-new').addEventListener('click', () => {
  const data = player.get(); if (!data) return;
  const input = document.getElementById('sp-nickname-input');
  input.value = data.displayName || data.username || '';
  nicknameRow.style.display = 'flex'; input.focus(); input.select();
});

function commitSaveNew() {
  const data = player.get(); if (!data) return;
  const input = document.getElementById('sp-nickname-input');
  const nick  = input.value.trim() || data.displayName || data.username || 'Profile';
  const rsn   = data.displayName || data.username || '';
  const type  = normalizeAccountType(data.type);
  const id    = genId();
  const profiles = getProfiles();
  profiles.push({ id, nickname: nick, rsn, type, cachedData: slimCache(data) });
  try { saveProfiles(profiles); } catch {
    profiles[profiles.length-1].cachedData = null;
    try { saveProfiles(profiles); } catch {}
  }
  setActiveId(id);
  nicknameRow.style.display = 'none'; input.value = '';
  showToast('✅ Profile "' + nick + '" saved'); renderProfiles();
}

document.getElementById('sp-nickname-confirm').addEventListener('click', commitSaveNew);
document.getElementById('sp-nickname-cancel').addEventListener('click', () => {
  nicknameRow.style.display = 'none';
  document.getElementById('sp-nickname-input').value = '';
});
document.getElementById('sp-nickname-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') commitSaveNew();
  if (e.key === 'Escape') { nicknameRow.style.display = 'none'; document.getElementById('sp-nickname-input').value = ''; }
});

// ─── Account / RSN Search ─────────────────────────────────────────────────────
const rsnInput = document.getElementById('rsn-input');
const savedRsn = player.getRsn() || storage.get(STORAGE_KEYS.RSN, '');
if (savedRsn) rsnInput.value = savedRsn;

// Show detected type if player loaded
const activeData = player.getFromCache();
if (activeData) {
  const detEl = document.getElementById('account-type-detected');
  const t = normalizeAccountType(activeData.type, 'ironman');
  const icons  = TYPE_ICONS;
  const labels = TYPE_LABELS;
  detEl.textContent = `Detected: ${icons[t] || '🛡'} ${labels[t] || 'Iron'}`;
}

rsnInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
document.getElementById('search-btn').addEventListener('click', doSearch);

async function doSearch() {
  const rsn = rsnInput.value.trim();
  if (!rsn) { showToast('Enter a player name'); return; }
  const btn = document.getElementById('search-btn');
  btn.disabled = true; btn.textContent = 'Searching…';
  try {
    const data = await fetchPlayer(rsn, null);
    player.set(data); updateHeaderName();
    const detEl = document.getElementById('account-type-detected');
    const t = normalizeAccountType(data.type, 'ironman');
    detEl.textContent = `Detected: ${TYPE_ICONS[t] || '🛡'} ${TYPE_LABELS[t] || 'Iron'}`;
    renderProfiles();
    showToast('✅ ' + (data.displayName || rsn) + ' loaded');
  } catch (err) { showToast('❌ ' + (err.message || 'Failed'), 5000); }
  finally { btn.disabled = false; btn.textContent = 'Search'; }
}

// WOM push update
document.getElementById('push-update-btn').addEventListener('click', async () => {
  const rsn = player.getRsn() || rsnInput.value.trim();
  if (!rsn) { showToast('Load a player first'); return; }
  const btn = document.getElementById('push-update-btn');
  btn.disabled = true; btn.textContent = 'Updating…';
  try {
    const data = await wom.updatePlayer(rsn);
    player.set(data); updateHeaderName();
    showToast('✅ WOM profile updated');
  } catch (err) { showToast(err.message, 6000); }
  finally { btn.disabled = false; btn.textContent = 'Push update'; }
});

setInterval(() => {
  const ms  = wom.getUpdateCooldownMs?.() || 0;
  const btn = document.getElementById('push-update-btn');
  if (!btn) return;
  btn.disabled    = ms > 0;
  btn.textContent = ms > 0 ? `Wait ${wom.formatCooldown?.(ms) || '…'}` : 'Push update';
}, 1000);

// Disconnect
document.getElementById('disconnect-btn').addEventListener('click', () => {
  player.clear();
  rsnInput.value = '';
  document.getElementById('account-type-detected').textContent = '';
  renderProfiles(); updateHeaderName();
  showToast('RSN disconnected');
});

// ─── Push Notifications ───────────────────────────────────────────────────────
function updatePushBtn() {
  const btn    = document.getElementById('push-enable-btn');
  const status = document.getElementById('push-status');
  if (!('Notification' in window) || !('PushManager' in window)) {
    btn.disabled = true; btn.textContent = '🔔 Push not supported';
    return;
  }
  if (Notification.permission === 'granted') {
    btn.textContent = '✅ Push Enabled'; btn.disabled = true;
    if (status) status.textContent = 'You will receive push notifications.';
  } else if (Notification.permission === 'denied') {
    btn.disabled = true; btn.textContent = '🔔 Push Blocked';
    if (status) status.textContent = 'Enable notifications in your browser settings.';
  }
}
updatePushBtn();

document.getElementById('push-enable-btn').addEventListener('click', async () => {
  const btn = document.getElementById('push-enable-btn');
  btn.disabled = true; btn.textContent = '⏳ Requesting…';
  try {
    const { registerPush } = await import('/src/app/bootstrap.js');
    await registerPush();
    updatePushBtn();
    showToast('✅ Push notifications enabled');
  } catch (err) {
    btn.disabled = false; btn.textContent = '🔔 Enable Push Notifications';
    showToast('Push setup failed: ' + err.message, 6000);
  }
});

// ─── Timers ───────────────────────────────────────────────────────────────────
document.getElementById('clear-progress-btn').addEventListener('click', () => {
  if (!confirm('Clear all timer progress? This cannot be undone.')) return;
  const keys = Object.keys(localStorage).filter(k => k.startsWith('osts_timer_') || k.startsWith('osts_progress_'));
  keys.forEach(k => localStorage.removeItem(k));
  // Also clear from storage helper
  storage.remove?.('osts_timer_progress_v2');
  showToast('Timer progress cleared');
});

document.getElementById('clear-pins-btn').addEventListener('click', () => {
  if (!confirm('Clear all pinned timers?')) return;
  storage.remove?.('osts_timer_pins_v2');
  const keys = Object.keys(localStorage).filter(k => k.includes('pin'));
  keys.forEach(k => localStorage.removeItem(k));
  showToast('Pins cleared');
});

// ─── Collection Log ───────────────────────────────────────────────────────────
document.getElementById('reset-clog-btn').addEventListener('click', () => {
  if (!confirm('Reset all collection log progress? This cannot be undone.')) return;
  storage.remove('osts_clog_v2');
  showToast('Collection log reset');
});

// ─── PWA Install ─────────────────────────────────────────────────────────────
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('install-group').style.display = 'block';
});
document.getElementById('install-btn-settings').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') document.getElementById('install-group').style.display = 'none';
  deferredInstallPrompt = null;
});

// ─── Render ───────────────────────────────────────────────────────────────────
renderProfiles();