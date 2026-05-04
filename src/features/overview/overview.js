import {
  initPage, fetchPlayer, player, settings, showToast, storage, wom,
  STORAGE_KEYS, ACCOUNT_TYPES, SKILLS, SKILL_MAP,
  fmtXP, fmtNum, fmtRank, calcCombat,
  xpToLevel, xpForLevel, xpProgress, normalizeAccountType,
  sendLocalNotification,
} from '/src/app/shared.js';


// ─────────────────────────────────────────────────────────────────────────────
// Profiles system
// ─────────────────────────────────────────────────────────────────────────────
const PROFILES_KEY    = 'osts_profiles_v2';
const ACTIVE_PROF_KEY = 'osts_active_profile_v2';

const ACCOUNT_TYPE_LABELS = {
  ironman:'Iron', hardcore:'HCIM', ultimate:'UIM',
  regular:'Regular', gim:'GIM', ghcim:'GHCIM', ugim:'UGIM',
};
const ACCOUNT_TYPE_ICONS = {
  ironman:'🛡', hardcore:'💀', ultimate:'🔱',
  regular:'⚔', gim:'👥', ghcim:'☠', ugim:'👥',
};

function getProfiles()     { return storage.get(PROFILES_KEY, []); }
function saveProfiles(arr) { storage.set(PROFILES_KEY, arr); }
function getActiveId()     { return storage.get(ACTIVE_PROF_KEY, null); }
function setActiveId(id)   { storage.set(ACTIVE_PROF_KEY, id); }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

function profileTypeLabel(type) {
  return ACCOUNT_TYPE_LABELS[normalizeAccountType(type)] || 'Iron';
}
function profileTypeIcon(type) {
  return ACCOUNT_TYPE_ICONS[normalizeAccountType(type)] || '🛡';
}

// ── Quick-switch modal ────────────────────────────────────────────────────────
function openProfilesModal() {
  renderProfilesModal();
  document.getElementById('profiles-modal-overlay').classList.add('show');
}
function closeProfilesModal() {
  document.getElementById('profiles-modal-overlay').classList.remove('show');
}
document.getElementById('profile-btn').addEventListener('click', openProfilesModal);
document.getElementById('pm-close').addEventListener('click', closeProfilesModal);
document.getElementById('profiles-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('profiles-modal-overlay')) closeProfilesModal();
});

function renderProfilesModal() {
  const profiles  = getProfiles();
  const activeId  = getActiveId();
  const list      = document.getElementById('pm-list');
  const countEl   = document.getElementById('pm-count');
  countEl.textContent = `${profiles.length} saved profile${profiles.length !== 1 ? 's' : ''}`;
  if (!profiles.length) {
    list.innerHTML = '<div class="no-data" style="padding:12px">No saved profiles yet.</div>'; return;
  }
  list.innerHTML = profiles.map(p => `
    <button class="pm-profile-btn${p.id === activeId ? ' active' : ''}" data-pid="${p.id}">
      <div class="pm-avatar">${profileTypeIcon(p.type)}</div>
      <div class="pm-info">
        <div class="pm-nickname">${p.nickname}</div>
        <div class="pm-rsn-type">${p.rsn} • ${profileTypeLabel(p.type)}</div>
      </div>
    </button>
  `).join('');
  list.querySelectorAll('[data-pid]').forEach(btn => {
    btn.addEventListener('click', () => switchToProfile(btn.dataset.pid));
  });
}

// ── Settings panel profiles ───────────────────────────────────────────────────
function renderSettingsProfiles() {
  const profiles = getProfiles();
  const activeId = getActiveId();
  const list     = document.getElementById('sp-profile-list');

  // Sort active first
  const sorted = [...profiles].sort((a,b) => (b.id === activeId) - (a.id === activeId));

  list.innerHTML = sorted.map(p => `
    <div class="sp-profile-card${p.id === activeId ? ' active' : ''}" id="spc-${p.id}">
      <div class="sp-avatar">${profileTypeIcon(p.type)}</div>
      <div class="sp-info">
        <div class="sp-nickname">${p.nickname}</div>
        <div class="sp-rsn-type">${p.rsn} • ${profileTypeLabel(p.type)}</div>
      </div>
      <div class="sp-btns">
        ${p.id !== activeId ? `<button class="sp-btn" data-load="${p.id}">Load</button>` : ''}
        <button class="sp-btn" data-rename="${p.id}">Rename</button>
        <button class="sp-btn danger" data-delete="${p.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-load]').forEach(btn =>
    btn.addEventListener('click', () => switchToProfile(btn.dataset.load)));
  list.querySelectorAll('[data-rename]').forEach(btn =>
    btn.addEventListener('click', () => renameProfile(btn.dataset.rename)));
  list.querySelectorAll('[data-delete]').forEach(btn =>
    btn.addEventListener('click', () => deleteProfile(btn.dataset.delete)));

  // Enable/disable save buttons based on whether a player is loaded
  const hasPlayer = !!player.get();
  document.getElementById('sp-save-current').disabled = !hasPlayer || !activeId;
  document.getElementById('sp-save-new').disabled     = !hasPlayer;
}

// ── Profile actions ───────────────────────────────────────────────────────────
function switchToProfile(id) {
  const profiles = getProfiles();
  const p = profiles.find(x => x.id === id);
  if (!p) { showToast('Profile not found'); return; }

  // Close any open panels first
  closeProfilesModal();
  settings.close();

  setActiveId(id);

  // Update account type selector
  currentAccountType = normalizeAccountType(p.type);
  storage.set(STORAGE_KEYS.ACCOUNT_TYPE, currentAccountType);
  document.querySelectorAll('.acct-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === currentAccountType);
  });

  // Update RSN input
  document.getElementById('rsn-input').value = p.rsn;

  // Update header button immediately so it feels responsive
  updateProfileBtn();

  // Always fresh fetch — cache is unreliable after storage round-trip
  _doFetchSwitch(p);
}

async function _doFetchSwitch(p) {
  showToast('Loading ' + p.nickname + '…');
  setLoading(true);
  clearError();
  hideContent();
  try {
    const data = await fetchPlayer(p.rsn, normalizeAccountType(p.type));
    player.set(data);
    // Update cached copy
    const profiles = getProfiles();
    const idx = profiles.findIndex(x => x.id === p.id);
    if (idx !== -1) {
      profiles[idx].cachedData = slimCache(data);
      try { saveProfiles(profiles); } catch {}
    }
    renderOverview(data);
    showToast('✅ ' + p.nickname);
  } catch (err) {
    showError('Could not load ' + p.nickname + ': ' + err.message);
    showToast('❌ Failed to load ' + p.nickname, 5000);
  } finally {
    setLoading(false);
    updateProfileBtn();
    renderSettingsProfiles();
  }
}

function saveCurrentProfile() {
  const data = player.get(); if (!data) return;
  const activeId = getActiveId();
  if (!activeId) return;
  const profiles = getProfiles();
  const idx = profiles.findIndex(x => x.id === activeId);
  if (idx === -1) return;
  profiles[idx].cachedData = slimCache(data);
  profiles[idx].rsn  = data.displayName || data.username || profiles[idx].rsn;
  profiles[idx].type = data.type || profiles[idx].type;
  try { saveProfiles(profiles); } catch {}
  showToast('✅ Profile updated');
  renderSettingsProfiles();
}

function saveAsNewProfile() {
  const data = player.get(); if (!data) return;
  // Show the inline nickname input row
  const row   = document.getElementById('sp-nickname-row');
  const input = document.getElementById('sp-nickname-input');
  input.value = data.displayName || data.username || '';
  row.classList.add('show');
  input.focus();
  input.select();
}

function commitSaveAsNew() {
  const data = player.get(); if (!data) return;
  const row   = document.getElementById('sp-nickname-row');
  const input = document.getElementById('sp-nickname-input');
  const nick  = input.value.trim() || data.displayName || data.username || 'Profile';
  const rsn   = data.displayName || data.username || '';
  const type  = normalizeAccountType(data.type);
  const id    = genId();
  const profiles = getProfiles();
  profiles.push({ id, nickname: nick, rsn, type, cachedData: slimCache(data) });
  try {
    saveProfiles(profiles);
  } catch (e) {
    // Quota exceeded — save without cache, fetch fresh on switch
    profiles[profiles.length - 1].cachedData = null;
    try { saveProfiles(profiles); } catch {}
    showToast('⚠️ Profile saved (no cache — will fetch on switch)');
  }
  setActiveId(id);
  row.classList.remove('show');
  input.value = '';
  showToast('✅ Profile "' + nick + '" saved');
  updateProfileBtn();
  renderSettingsProfiles();
}

// Slim the WOM data down to only what OSTS needs to render, avoiding localStorage quota
function slimCache(data) {
  if (!data) return null;
  return {
    id:             data.id,
    username:       data.username,
    displayName:    data.displayName,
    type:           data.type,
    updatedAt:      data.updatedAt,
    latestSnapshot: data.latestSnapshot,
    _hiscoresBosses:   data._hiscoresBosses   || null,
    _hiscoresActivities: data._hiscoresActivities || null,
    _temple:        data._temple || null,
  };
}

function renameProfile(id) {
  const profiles = getProfiles();
  const p = profiles.find(x => x.id === id); if (!p) return;
  // Inline edit: replace nickname text with an input inside the card
  const card = document.getElementById('spc-' + id);
  if (!card) return;
  const nameEl = card.querySelector('.sp-nickname');
  if (!nameEl) return;
  const original = p.nickname;
  const inp = document.createElement('input');
  inp.value     = original;
  inp.className = 'sp-nickname-input';
  inp.style.cssText = 'width:100%;margin:0;padding:4px 8px;font-size:13px;border-radius:6px';
  inp.maxLength = 20;
  nameEl.replaceWith(inp);
  inp.focus(); inp.select();
  function commit() {
    const v = inp.value.trim() || original;
    p.nickname = v;
    saveProfiles(profiles);
    updateProfileBtn();
    renderSettingsProfiles();
    showToast('Renamed to "' + v + '"');
  }
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') renderSettingsProfiles(); });
  inp.addEventListener('blur', commit);
}

function deleteProfile(id) {
  const btn = document.querySelector(`.sp-btn.danger[data-delete="${id}"]`);
  if (btn && !btn.dataset.confirming) {
    btn.dataset.confirming = '1';
    btn.classList.add('danger-confirm');
    btn.textContent = 'Confirm?';
    setTimeout(() => {
      if (btn.dataset.confirming) {
        delete btn.dataset.confirming;
        btn.classList.remove('danger-confirm');
        btn.textContent = 'Delete';
      }
    }, 3000);
    return;
  }
  const profiles = getProfiles();
  const p = profiles.find(x => x.id === id); if (!p) return;
  const remaining = profiles.filter(x => x.id !== id);
  saveProfiles(remaining);
  if (getActiveId() === id) {
    setActiveId(remaining[0]?.id || null);
    if (remaining[0]?.cachedData) {
      player.set(remaining[0].cachedData);
      renderOverview(remaining[0].cachedData);
    }
  }
  updateProfileBtn();
  renderSettingsProfiles();
  showToast('Profile deleted');
}

function updateProfileBtn() {
  const btn      = document.getElementById('profile-btn');
  const label    = document.getElementById('profile-btn-label');
  const profiles = getProfiles();
  const activeId = getActiveId();
  const active   = profiles.find(x => x.id === activeId);
  if (active) {
    label.textContent = active.nickname;
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
}

// Save buttons
document.getElementById('sp-save-current').addEventListener('click', saveCurrentProfile);
document.getElementById('sp-save-new').addEventListener('click', saveAsNewProfile);
document.getElementById('sp-nickname-confirm').addEventListener('click', commitSaveAsNew);
document.getElementById('sp-nickname-cancel').addEventListener('click', () => {
  document.getElementById('sp-nickname-row').classList.remove('show');
  document.getElementById('sp-nickname-input').value = '';
});
document.getElementById('sp-nickname-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  commitSaveAsNew();
  if (e.key === 'Escape') {
    document.getElementById('sp-nickname-row').classList.remove('show');
    document.getElementById('sp-nickname-input').value = '';
  }
});

// Re-render settings profiles when panel opens
document.getElementById('settings-btn').addEventListener('click', () => renderSettingsProfiles(), true);

initPage('overview');

// ── OSRS canvas panel order (for share card) ─────────────────────────────
const PANEL_ORDER = [
  'attack','hitpoints','mining',
  'strength','agility','smithing',
  'defence','herblore','fishing',
  'ranged','thieving','cooking',
  'prayer','crafting','firemaking',
  'magic','fletching','woodcutting',
  'runecrafting','slayer','farming',
  'construction','hunter','sailing',
];

const XP_FOR_99 = 13_034_431;

// ── Account type buttons ─────────────────────────────────────────────────
let currentAccountType = storage.get(STORAGE_KEYS.ACCOUNT_TYPE, 'ironman');
document.querySelectorAll('.acct-btn[data-type]').forEach(btn => {
  if (btn.dataset.type === currentAccountType) btn.classList.add('active');
  btn.addEventListener('click', () => {
    document.querySelectorAll('.acct-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAccountType = btn.dataset.type;
    storage.set(STORAGE_KEYS.ACCOUNT_TYPE, currentAccountType);
  });
});

// ── Search ───────────────────────────────────────────────────────────────
document.getElementById('search-btn').addEventListener('click', loadPlayer);

async function loadPlayer() {
  const rsn = document.getElementById('rsn-input').value.trim();
  if (!rsn) { showToast('Enter a player name'); return; }
  setLoading(true); clearError(); hideContent();
  try {
    const data = await fetchPlayer(rsn, currentAccountType);
    player.set(data);
    renderOverview(data);
    settings.close();
    showToast('✅ ' + (data.displayName || rsn) + ' loaded');
  } catch (err) {
    showError(err.message || 'Failed to load player');
  } finally { setLoading(false); }
}

// ── WOM push update ──────────────────────────────────────────────────────
document.getElementById('push-update-btn').addEventListener('click', async () => {
  const rsn = player.getRsn() || document.getElementById('rsn-input').value.trim();
  if (!rsn) { showToast('Load a player first'); return; }
  const btn = document.getElementById('push-update-btn');
  btn.disabled = true; btn.textContent = 'Updating…';
  try {
    const data = await wom.updatePlayer(rsn);
    player.set(data); renderOverview(data);
    showToast('✅ WOM profile updated');
  } catch (err) { showToast(err.message, 6000); }
  finally { btn.disabled = false; btn.textContent = 'Push WOM Update'; }
});

setInterval(() => {
  const ms  = wom.getUpdateCooldownMs();
  const btn = document.getElementById('push-update-btn');
  if (!btn) return;
  btn.disabled    = ms > 0;
  btn.textContent = ms > 0 ? `Wait ${wom.formatCooldown(ms)}` : 'Push WOM Update';
}, 1000);

// ── Disconnect ───────────────────────────────────────────────────────────
document.getElementById('disconnect-btn').addEventListener('click', () => {
  player.clear(); hideContent();
  document.getElementById('welcome-msg').style.display = '';
  document.getElementById('rsn-input').value = '';
  settings.close(); showToast('RSN disconnected');
});

// ── Push notifications ───────────────────────────────────────────────────
updatePushStatus();
document.getElementById('enable-push-btn').addEventListener('click', async () => {
  try {
    const { registerPush } = await import('../JS/bootstrap.js');
    await registerPush();
    showToast('✅ Push notifications enabled');
    updatePushStatus();
  } catch (err) { showToast('Push setup failed: ' + err.message, 6000); }
});
function updatePushStatus() {
  const el = document.getElementById('push-status');
  if (!el || !('Notification' in window)) return;
  el.textContent = { granted:'✅ Enabled', denied:'🚫 Blocked', default:'Not set up yet.' }[Notification.permission] || '';
}

// ── Collapsible sections ─────────────────────────────────────────────────
document.querySelectorAll('.ov-collapse-head[data-collapse]').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = document.getElementById('collapse-' + btn.dataset.collapse);
    section.classList.toggle('open');
  });
});

// ── Copy Link ────────────────────────────────────────────────────────────
document.getElementById('btn-copy-link').addEventListener('click', () => {
  const rsn = player.getRsn();
  if (!rsn) { showToast('Load a player first'); return; }
  const url = `${location.origin}${location.pathname}?rsn=${encodeURIComponent(rsn)}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => showToast('🔗 Profile link copied!'));
  } else {
    const ta = Object.assign(document.createElement('textarea'),
      { value: url, style: 'position:fixed;opacity:0' });
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    showToast('🔗 Profile link copied!');
  }
});

// ── Save Card ────────────────────────────────────────────────────────────
document.getElementById('btn-save-card').addEventListener('click', () => {
  const data = player.get();
  if (!data) { showToast('Load a player first'); return; }
  drawProfileCard(data);
});

// ─────────────────────────────────────────────────────────────────────────
// Local data helpers — reads from petLog + goals localStorage
// ─────────────────────────────────────────────────────────────────────────

function getLocalPetCount() {
  try {
    const pets = JSON.parse(localStorage.getItem('osts-pet-log-v2') || '[]');
    return { total: pets.length, unique: new Set(pets.map(p => p.petName)).size };
  } catch { return { total: 0, unique: 0 }; }
}

function getLocalQuestPoints() {
  try {
    const activeId = storage.get('osts_active_profile_v2', null);
    const key = activeId ? `osts-qp-v1-${activeId}` : 'osts-qp-v1-guest';
    const qp = storage.get(key, -1);
    return typeof qp === 'number' && qp >= 0 ? qp : -1;
  } catch { return -1; }
}

// ─────────────────────────────────────────────────────────────────────────
// renderOverview
// ─────────────────────────────────────────────────────────────────────────
function renderOverview(data) {
  const snap  = data.latestSnapshot?.data?.skills || {};
  const type  = normalizeAccountType(data.type, 'ironman');
  const meta  = ACCOUNT_TYPES[type] || ACCOUNT_TYPES.ironman;
  const overall = snap.overall || {};
  const name  = data.displayName || data.username || '—';

  // Header
  document.getElementById('ov-name').textContent = name;
  document.getElementById('ov-avatar-emoji').textContent = meta.icon;
  const badge = document.getElementById('ov-badge');
  badge.className = `badge ${meta.badgeClass}`;
  badge.textContent = meta.badge;

  // Top 3 stats
  document.getElementById('ov-total-level').textContent = fmtNum(overall.level || 0);
  document.getElementById('ov-total-xp').textContent    = fmtXP(overall.experience || 0);
  document.getElementById('ov-rank').textContent        = fmtRank(overall.rank);

  // Skill entries
  const skillEntries = SKILLS.filter(([id]) => id !== 'overall').map(([id]) => ({
    id,
    lvl: Number(snap[id]?.level || xpToLevel(snap[id]?.experience || 0)),
    xp:  Number(snap[id]?.experience || 0),
  }));
  const skillCount = skillEntries.length;
  const maxed      = skillEntries.filter(s => s.lvl >= 99).length;

  // Sort by closest to 99 by XP remaining
  const notMaxed   = skillEntries.filter(s => s.lvl < 99)
    .sort((a, b) => (xpForLevel(99) - a.xp) - (xpForLevel(99) - b.xp));
  const topSkill   = skillEntries.slice().sort((a, b) => b.lvl - a.lvl || b.xp - a.xp)[0];
  const next99     = notMaxed[0];
  const combat     = calcCombat(snap);

  // Quick stats
  document.getElementById('ov-combat').textContent      = combat || '—';
  document.getElementById('ov-maxed').textContent       = maxed;
  document.getElementById('ov-top-skill').textContent   = topSkill ? `${SKILL_MAP[topSkill.id]?.name} ${topSkill.lvl}` : '—';
  document.getElementById('ov-top-skill-sub').textContent = topSkill ? fmtXP(topSkill.xp) + ' XP' : '—';
  document.getElementById('ov-next-99').textContent     = next99 ? `${SKILL_MAP[next99.id]?.name} ${next99.lvl}` : 'Maxed!';
  document.getElementById('ov-next-99-sub').textContent = next99 ? fmtXP(xpForLevel(99) - next99.xp) + ' to 99' : 'All skills maxed';

  // Quest Points — from Goals page (osts-goals-v1, type === 'qp')
  const questPts = getLocalQuestPoints();
  const qpEl    = document.getElementById('ov-quest-pts');
  const qpSubEl = document.getElementById('ov-quest-pts-sub');
  if (questPts >= 0) {
    qpEl.textContent    = questPts;
    qpSubEl.textContent = 'of 333 total';
  } else {
    qpEl.textContent    = '—';
    qpSubEl.textContent = 'track in Goals →';
  }

  // Pet Count — from Pet Log page (osts-pet-log-v2)
  const { total: petTotal, unique: petUnique } = getLocalPetCount();
  const petEl    = document.getElementById('ov-pets');
  const petSubEl = document.getElementById('ov-pets-sub');
  petEl.textContent    = petTotal;
  petSubEl.textContent = petTotal === 0
    ? 'log in Pet Log →'
    : `${petUnique} unique pet${petUnique !== 1 ? 's' : ''}`;

  // Road to Max (XP-based %)
  const r2mTotal  = skillEntries.reduce((s, e) => s + Math.min(e.lvl, 99), 0);
  const maxTotal  = skillCount * 99;        // e.g. 2475 for 25 skills
  const r2mXpSum  = skillEntries.reduce((s, e) => s + Math.min(e.xp, XP_FOR_99), 0);
  const r2mPct    = ((r2mXpSum / (XP_FOR_99 * skillCount)) * 100).toFixed(1);
  const levelsNeeded = maxTotal - r2mTotal;
  const ratePerDay   = (levelsNeeded / 365).toFixed(1);

  document.getElementById('r2m-total').textContent        = fmtNum(r2mTotal);
  document.getElementById('r2m-total-sub').textContent    = `of ${fmtNum(maxTotal)} max`;
  document.getElementById('r2m-levels-needed').textContent= fmtNum(levelsNeeded);
  document.getElementById('r2m-rate').textContent         = `${ratePerDay} levels/day for 365 days`;
  document.getElementById('r2m-pct').textContent          = r2mPct + '%';
  document.getElementById('r2m-combat').textContent       = combat || '—';
  document.getElementById('r2m-bar').style.width          = r2mPct + '%';

  // Nearest 99s
  renderNearest99s(notMaxed.slice(0, 3), snap);

  // Nearest skill achievements (milestone levels: 50, 60, 70, 75, 80, 85, 90, 92, 95, 99)
  renderAchievements(skillEntries);

  // Account notes
  const notes = `${name} has total level ${fmtNum(r2mTotal)}, estimated combat ${combat}, ` +
    `${maxed} maxed skill${maxed !== 1 ? 's' : ''}, and ` +
    `${next99 ? SKILL_MAP[next99.id]?.name + ' as the closest next 99' : 'all skills maxed'}.`;
  document.getElementById('ov-notes-body').textContent = notes;
  document.getElementById('ov-notes').style.display = '';

  // Last updated
  document.getElementById('ov-last-updated').textContent = data.updatedAt
    ? 'Last updated: ' + new Date(data.updatedAt).toLocaleString() : '';

  // Fetch global search count from DB (non-blocking, subtle display)
  fetch(`/.netlify/functions/recent-players`)
    .then(r => r.ok ? r.json() : [])
    .then(list => {
      const match = Array.isArray(list) && list.find(p =>
        p.rsn?.toLowerCase() === (data.displayName || data.username || '').toLowerCase()
      );
      const el = document.getElementById('ov-search-count');
      if (el && match?.searchCount > 0) {
        el.textContent = `🔍 Searched ${match.searchCount.toLocaleString()} time${match.searchCount !== 1 ? 's' : ''} on OSTS`;
      }
    }).catch(() => {});

  // Show content + action bar
  document.getElementById('ov-content').style.display = '';
  document.getElementById('welcome-msg').style.display = 'none';
  document.getElementById('action-bar').classList.add('visible');
  document.getElementById('main').classList.add('has-action-bar');

  // Update active profile cache + header button
  const _activeId = getActiveId();
  if (_activeId) {
    const _profiles = getProfiles();
    const _idx = _profiles.findIndex(x => x.id === _activeId);
    if (_idx !== -1) {
      _profiles[_idx].cachedData = slimCache(data);
      try { saveProfiles(_profiles); } catch {}
    }
  }
  updateProfileBtn();
  renderSettingsProfiles();
}

// ── Nearest 99s list ─────────────────────────────────────────────────────
// ── Circular ring SVG helper ──────────────────────────────────────────────
function ringHtml(pct, color) {
  const R = 18, SZ = 44, CIRC = 2 * Math.PI * R;
  const offset = CIRC * (1 - Math.max(0, Math.min(1, pct / 100)));
  return `<div class="ring-wrap">
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle class="ring-track" cx="22" cy="22" r="${R}" stroke-width="4"/>
      <circle class="ring-fill" cx="22" cy="22" r="${R}" stroke-width="4"
        stroke="${color}" stroke-dasharray="${CIRC.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"/>
    </svg>
    <div class="ring-label">${Math.round(pct)}%</div>
  </div>`;
}

// ── Nearest 99s list ─────────────────────────────────────────────────────
function renderNearest99s(sorted, snap) {
  const container = document.getElementById('body-nearest99');
  if (!sorted.length) {
    container.innerHTML = '<div class="no-data">All skills are maxed! 🏆</div>'; return;
  }
  container.innerHTML = sorted.map(e => {
    const meta     = SKILL_MAP[e.id] || {};
    const xpNeeded = xpForLevel(99) - e.xp;
    const pct      = (e.xp / XP_FOR_99) * 100;
    const color    = meta.color || 'var(--gold)';
    return `<div class="n99-card">
      <div class="n99-icon-wrap">
        <img src="${meta.icon || ''}" alt="${meta.name || e.id}" loading="lazy"
             onerror="this.style.display='none'">
      </div>
      <div class="n99-info">
        <div class="n99-title">99 ${meta.name || e.id}</div>
        <div class="n99-sub">${fmtNum(xpNeeded)} xp left</div>
      </div>
      ${ringHtml(pct, color)}
    </div>`;
  }).join('');
}

// ── Nearest skill achievements (grouped by base milestone) ────────────────
const BASE_MILESTONES = [50,60,70,80,85,90,92,95,99];
const XP_MILESTONES   = [
  { label: '50m Total XP',  xp: 50_000_000  },
  { label: '100m Total XP', xp: 100_000_000 },
  { label: '200m Total XP', xp: 200_000_000 },
];

function renderAchievements(entries) {
  const container = document.getElementById('body-achievements');
  const groups    = [];

  // ── Base X Stats groups ───────────────────────────────────────────────
  BASE_MILESTONES.forEach(target => {
    const blocking = entries
      .filter(e => e.lvl < target)
      .map(e => ({
        ...e,
        meta:     SKILL_MAP[e.id] || {},
        xpNeeded: Math.max(0, xpForLevel(target) - e.xp),
      }))
      .sort((a, b) => a.xpNeeded - b.xpNeeded);

    if (!blocking.length) return;

    const totalXpNeeded = blocking.reduce((s, e) => s + e.xpNeeded, 0);
    const skillCount    = entries.length;
    const atOrAbove     = entries.filter(e => e.lvl >= target).length;
    const pct           = atOrAbove / skillCount * 100;

    groups.push({ key: `base${target}`, title: `Base ${target} Stats`,
      subtitle: `${blocking.length} skill${blocking.length !== 1 ? 's' : ''}`,
      xpLeft: totalXpNeeded, pct, color: 'var(--gold)', blocking });
  });

  // ── Total XP milestones ───────────────────────────────────────────────
  const totalXp = entries.reduce((s, e) => s + e.xp, 0);
  XP_MILESTONES.forEach(({ label, xp }) => {
    if (totalXp >= xp) return;
    groups.push({ key: label.replace(/\s/g, '_'), title: label, subtitle: null,
      xpLeft: xp - totalXp, pct: Math.min(99, totalXp / xp * 100),
      color: 'var(--orange,#f0883e)', blocking: [] });
  });

  if (!groups.length) {
    container.innerHTML = '<div class="no-data">All milestones reached! 🏆</div>'; return;
  }

  groups.sort((a, b) => a.xpLeft - b.xpLeft);

  container.innerHTML = groups.map(g => {
    const hasDropdown = g.blocking.length > 0;
    const titleHtml = g.title + (g.subtitle
      ? ` <span style="color:var(--muted);font-weight:400;font-size:11px">(${g.subtitle})</span>` : '');
    const caretHtml = hasDropdown ? `<span class="achv-caret">▼</span>` : '';
    const tableHtml = hasDropdown ? `
      <div class="achv-body">
        <div class="achv-section-label">Skills holding you back</div>
        <div class="achv-table-head"><span>Skill</span><span>Level</span><span>XP needed</span></div>
        ${g.blocking.map(b => `
          <div class="achv-skill-row">
            <div class="achv-skill-name">
              <img src="${b.meta.icon || ''}" alt="${b.meta.name || b.id}" loading="lazy"
                   onerror="this.style.display='none'">
              ${b.meta.name || b.id}
            </div>
            <div class="achv-skill-lvl">${b.lvl}</div>
            <div class="achv-skill-xp">${fmtNum(b.xpNeeded)}</div>
          </div>`).join('')}
      </div>` : '';

    return `<div class="achv-group" id="achv-${g.key}">
      <button class="achv-group-head" data-achv="${g.key}">
        <div class="achv-head-info">
          <div class="achv-head-title">${titleHtml}</div>
          <div class="achv-head-sub">${fmtNum(g.xpLeft)} xp left</div>
        </div>
        ${ringHtml(g.pct, g.color)}
        ${caretHtml}
      </button>
      ${tableHtml}
    </div>`;
  }).join('');

  container.querySelectorAll('[data-achv]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('achv-' + btn.dataset.achv)?.classList.toggle('open');
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Canvas card (unchanged logic, XP-based R2M fixed)
// ─────────────────────────────────────────────────────────────────────────
const THEMES = {
  dark:  { bg:'#0d1117', surface:'#161b22', surface2:'#21262d', surface3:'#2d333b', border:'#30363d', gold:'#b88848', gold2:'#d0a060', text:'#e6edf3', muted:'#8b949e' },
  light: { bg:'#f4efe4', surface:'#fffaf0', surface2:'#f0e6d2', surface3:'#e6d6b7', border:'#cfbea1', gold:'#9f7740', gold2:'#c89f62', text:'#23180f', muted:'#6d5a46' },
  brown: { bg:'#2b241b', surface:'#3a3024', surface2:'#4a3c2c', surface3:'#5a4934', border:'#8d6b3e', gold:'#c9a35a', gold2:'#e2bf78', text:'#e2bf78', muted:'#b39a73' },
};
function getTheme() {
  if (document.body.classList.contains('theme-light')) return THEMES.light;
  if (document.body.classList.contains('theme-brown')) return THEMES.brown;
  return THEMES.dark;
}
function hexToRgba(hex, a) {
  hex = hex.replace('#','');
  const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function loadImg(url, ms=4000) {
  return new Promise(resolve => {
    const img=new Image(); let done=false;
    const t=setTimeout(()=>{done=true;resolve(null);},ms);
    img.crossOrigin='anonymous';
    img.onload =()=>{if(!done){clearTimeout(t);done=true;resolve(img);}};
    img.onerror=()=>{if(!done){clearTimeout(t);done=true;resolve(null);}};
    img.src=url;
  });
}

async function drawProfileCard(data) {
  const btn = document.getElementById('btn-save-card');
  btn.disabled=true; btn.textContent='⏳ Building…';
  try {
    const snap = data.latestSnapshot?.data?.skills || {};
    const type = normalizeAccountType(data.type,'ironman');
    const C    = getTheme();
    const DPR  = 2;

    const W=400, PAD=18, COLS=3, ROWS=8;
    const TILE_W=Math.floor((W-PAD*2)/COLS), TILE_H=60, BAR_H=3, ICON_S=30;

    const Y_TOP_BAR=0, TOP_BAR_H=4;
    const Y_HEADER=TOP_BAR_H+10, HEADER_H=74;
    const Y_SEP1=Y_HEADER+HEADER_H+10;
    const Y_STATS=Y_SEP1+8, STATS_H=48;
    const Y_SEP2=Y_STATS+STATS_H+10;
    const Y_SKL_LABEL=Y_SEP2+8, SKL_LABEL_H=18;
    const Y_GRID=Y_SKL_LABEL+SKL_LABEL_H+4, GRID_H=ROWS*TILE_H;
    const Y_SEP3=Y_GRID+GRID_H+8;
    const Y_R2M=Y_SEP3+8, R2M_H=44;
    const Y_SEP4=Y_R2M+R2M_H+8;
    const Y_FOOTER=Y_SEP4+8, FOOTER_H=20;
    const Y_BOT_BAR=Y_FOOTER+FOOTER_H+8;
    const H=Y_BOT_BAR+TOP_BAR_H+2;

    const canvas=document.createElement('canvas');
    canvas.width=W*DPR; canvas.height=H*DPR;
    const ctx=canvas.getContext('2d');
    ctx.scale(DPR,DPR);

    function rrect(x,y,w,h,r){
      ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
      ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
      ctx.closePath();
    }
    function goldGrad(x1,x2,y){
      const g=ctx.createLinearGradient(x1,y,x2,y);
      g.addColorStop(0,C.gold);g.addColorStop(0.5,C.gold2);g.addColorStop(1,C.gold);return g;
    }
    function sep(y){ctx.strokeStyle=C.border;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(PAD,y);ctx.lineTo(W-PAD,y);ctx.stroke();}

    const skillData=PANEL_ORDER.map(id=>{
      const meta=SKILL_MAP[id]||{};
      const s=snap[id]||{};
      const xp=Number(s.experience||0);
      const lvl=Math.min(Number(s.level||xpToLevel(xp)),99);
      const prog=lvl>=99?1:xpProgress(xp,lvl);
      return{id,name:meta.name||id,icon:meta.icon||'',color:meta.color||C.gold,lvl,xp,prog};
    });

    const[iconImgs,avatarImg]=await Promise.all([
      Promise.all(skillData.map(s=>loadImg(s.icon,3500))),
      (async()=>{
        const m={ironman:'https://oldschool.runescape.wiki/images/Ironman_chat_badge.png',
          hardcore:'https://oldschool.runescape.wiki/images/Hardcore_ironman_chat_badge.png',
          ultimate:'https://oldschool.runescape.wiki/images/Ultimate_ironman_chat_badge.png',
          gim:'https://oldschool.runescape.wiki/images/Group_ironman_chat_badge.png',
          ghcim:'https://oldschool.runescape.wiki/images/Hardcore_group_ironman_chat_badge.png',
          ugim:'https://oldschool.runescape.wiki/images/Unranked_group_ironman_chat_badge.png'};
        return m[type]?loadImg(m[type],3000):null;
      })(),
    ]);

    // Background
    ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
    // Top bar
    ctx.fillStyle=goldGrad(0,W,0); ctx.fillRect(0,Y_TOP_BAR,W,TOP_BAR_H);

    // Header
    const AVA_X=PAD,AVA_Y=Y_HEADER,AVA_S=52;
    ctx.fillStyle=hexToRgba(C.gold,0.15);rrect(AVA_X,AVA_Y,AVA_S,AVA_S,10);ctx.fill();
    ctx.strokeStyle=C.gold;ctx.lineWidth=1.5;ctx.stroke();
    if(avatarImg){try{ctx.drawImage(avatarImg,AVA_X+6,AVA_Y+6,AVA_S-12,AVA_S-12);}catch{}}
    else{ctx.font='bold 26px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.gold;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('⚔',AVA_X+AVA_S/2,AVA_Y+AVA_S/2);ctx.textAlign='left';ctx.textBaseline='alphabetic';}

    const nameX=AVA_X+AVA_S+12;
    ctx.font='bold 22px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.text;ctx.textAlign='left';
    ctx.fillText(data.displayName||data.username||'—',nameX,Y_HEADER+26);

    const badgeLabels={ironman:'IRONMAN',hardcore:'HARDCORE',ultimate:'ULTIMATE',regular:'MAIN',gim:'GIM',ghcim:'GROUP HC',ugim:'UGIM'};
    const bLabel=badgeLabels[type]||'IRONMAN';
    ctx.font='bold 9px "Segoe UI",system-ui,sans-serif';
    const bW=ctx.measureText(bLabel).width+16,bX=nameX,bY=Y_HEADER+34,bH=18;
    rrect(bX,bY,bW,bH,9);ctx.fillStyle=hexToRgba(C.gold,0.15);ctx.fill();
    ctx.strokeStyle=C.gold;ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=C.gold;ctx.textBaseline='middle';ctx.fillText(bLabel,bX+8,bY+bH/2);ctx.textBaseline='alphabetic';

    const now=new Date();const p2=n=>String(n).padStart(2,'0');
    ctx.font='10px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.muted;ctx.textAlign='right';
    ctx.fillText(`${p2(now.getUTCMonth()+1)}/${p2(now.getUTCDate())}/${String(now.getUTCFullYear()).slice(-2)}`,W-PAD,Y_HEADER+20);
    ctx.fillText(`${p2(now.getUTCHours())}:${p2(now.getUTCMinutes())} UTC`,W-PAD,Y_HEADER+34);
    ctx.textAlign='left';

    sep(Y_SEP1);

    // Stats row — 6 items across full width
    const overall2=snap.overall||{};
    const combat2=calcCombat(snap);
    // Read directly from DOM — already populated by renderOverview when Save Card is clicked
    const qpDom   = document.getElementById('ov-quest-pts')?.textContent?.trim();
    const petsDom = document.getElementById('ov-pets')?.textContent?.trim();
    const questPts2 = (qpDom && qpDom !== '—') ? qpDom : getLocalQuestPoints() >= 0 ? String(getLocalQuestPoints()) : '—';
    const pets2     = (petsDom && petsDom !== '—') ? petsDom : String(getLocalPetCount().total);
    const statItems=[
      [fmtNum(overall2.level||0),'TOTAL LEVEL'],
      [fmtXP(Number(overall2.experience||0)),'TOTAL XP'],
      [Number(overall2.rank||0)>0?'#'+fmtNum(overall2.rank):'Unranked','RANK'],
      [String(combat2||'—'),'COMBAT'],
      [questPts2,'QUESTS'],
      [pets2,'PETS'],
    ];
    const sw=(W-PAD*2)/statItems.length;
    statItems.forEach(([val,lbl],i)=>{
      const sx=PAD+i*sw;
      ctx.font='bold 13px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.gold2;ctx.textAlign='left';ctx.fillText(val,sx,Y_STATS+22);
      ctx.font='8px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.muted;ctx.fillText(lbl,sx,Y_STATS+36);
    });

    sep(Y_SEP2);

    ctx.font='bold 9px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.gold;ctx.fillText('SKILLS',PAD,Y_SKL_LABEL+SKL_LABEL_H);

    // Skill tiles
    skillData.forEach((sk,i)=>{
      const col=i%COLS,row=Math.floor(i/COLS);
      const tx=PAD+col*TILE_W,ty=Y_GRID+row*TILE_H,tw=TILE_W-2,th=TILE_H-4;
      rrect(tx+1,ty+2,tw,th,6);ctx.fillStyle=C.surface2;ctx.fill();ctx.strokeStyle=C.border;ctx.lineWidth=0.5;ctx.stroke();
      const icX=tx+8,icY=ty+(th-ICON_S)/2+2;
      rrect(icX,icY,ICON_S,ICON_S,5);ctx.fillStyle=C.surface3;ctx.fill();
      const img=iconImgs[i];
      if(img){try{ctx.drawImage(img,icX+3,icY+3,ICON_S-6,ICON_S-6);}catch{}}
      else{ctx.font='bold 12px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=sk.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(sk.name[0],icX+ICON_S/2,icY+ICON_S/2);ctx.textAlign='left';ctx.textBaseline='alphabetic';}
      ctx.font='bold 21px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=sk.lvl>=99?C.gold2:C.text;ctx.textAlign='left';
      ctx.fillText(String(sk.lvl||'—'),icX+ICON_S+6,ty+th/2+8);
      const barY2=ty+th-BAR_H,barX2=tx+2,barW2=tw-2,fillW=Math.max(0,Math.min(barW2,sk.prog*barW2));
      rrect(barX2,barY2,barW2,BAR_H,1);ctx.fillStyle=C.surface3;ctx.fill();
      if(fillW>0){rrect(barX2,barY2,fillW,BAR_H,1);ctx.fillStyle=sk.color;ctx.fill();}
    });

    sep(Y_SEP3);

    // Road to Max — XP-based
    const skillCount2=skillData.length;
    const r2mXpSum2=skillData.reduce((s,sk)=>s+Math.min(sk.xp,XP_FOR_99),0);
    const r2mPct2=((r2mXpSum2/(XP_FOR_99*skillCount2))*100).toFixed(1);
    const maxedCnt=skillData.filter(sk=>sk.lvl>=99).length;

    ctx.font='bold 9px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.muted;ctx.textAlign='left';ctx.fillText('ROAD TO MAX',PAD,Y_R2M+14);
    const barX3=PAD+100,barY3=Y_R2M+4,barW3=W-PAD*2-100-46,barH3=8;
    const fillW3=Math.max(0,Math.min(barW3,(r2mXpSum2/(XP_FOR_99*skillCount2))*barW3));
    rrect(barX3,barY3,barW3,barH3,4);ctx.fillStyle=C.surface3;ctx.fill();
    if(fillW3>0){rrect(barX3,barY3,fillW3,barH3,4);ctx.fillStyle=goldGrad(barX3,barX3+fillW3,barY3);ctx.fill();}
    ctx.font='bold 11px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.gold2;ctx.textAlign='left';ctx.fillText(r2mPct2+'%',barX3+barW3+6,Y_R2M+13);
    ctx.font='11px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.muted;ctx.textAlign='center';ctx.fillText(`${maxedCnt}/${skillCount2} Maxed`,W/2,Y_R2M+34);

    sep(Y_SEP4);

    ctx.font='9px "Segoe UI",system-ui,sans-serif';ctx.fillStyle=C.muted;ctx.textAlign='center';
    ctx.fillText('Old School Tool Set  ·  OSDevscape  ·  Data: wiseoldman.net',W/2,Y_FOOTER+14);

    ctx.fillStyle=goldGrad(0,W,Y_BOT_BAR);ctx.fillRect(0,Y_BOT_BAR,W,TOP_BAR_H);

    const playerName=(data.displayName||data.username||'profile').replace(/\s+/g,'_');
    const fileName=`${playerName}_osts_card.png`;
    canvas.toBlob(async blob=>{
      if(!blob){showToast('Export failed');return;}
      if(navigator.canShare&&navigator.share){
        const file=new File([blob],fileName,{type:'image/png'});
        if(navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:playerName+' OSRS Card'});return;}catch{}}
      }
      if(window.showSaveFilePicker){
        try{const h=await window.showSaveFilePicker({suggestedName:fileName,types:[{description:'PNG image',accept:{'image/png':['.png']}}]});const w=await h.createWritable();await w.write(blob);await w.close();showToast('🖼 Card saved!');return;}catch{}
      }
      const url=URL.createObjectURL(blob);
      const a=Object.assign(document.createElement('a'),{download:fileName,href:url});
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      showToast('🖼 Card saved!');
    },'image/png');
  } catch(err){
    console.error('drawProfileCard error:',err);
    showToast('Card generation failed: '+err.message,7000);
  } finally { btn.disabled=false; btn.textContent='🖼 Save Card'; }
}

// ── UI helpers ────────────────────────────────────────────────────────────
function setLoading(on) { document.getElementById('loader').classList.toggle('loading', on); }
function clearError() { const e=document.getElementById('error-msg'); e.textContent=''; e.classList.remove('show'); }
function showError(msg) {
  const e=document.getElementById('error-msg'); e.textContent=msg; e.classList.add('show');
  document.getElementById('welcome-msg').style.display='';
}
function hideContent() {
  document.getElementById('ov-content').style.display='none';
  document.getElementById('action-bar').classList.remove('visible');
  document.getElementById('main').classList.remove('has-action-bar');
}

// ── Auto-load from cache / URL param ─────────────────────────────────────
const urlRsn = new URLSearchParams(location.search).get('rsn');
if (urlRsn) {
  document.getElementById('rsn-input').value = urlRsn;
  loadPlayer();
} else {
  // Try active profile first
  const _bootProfiles = getProfiles();
  const _bootActiveId = getActiveId();
  const _bootProfile  = _bootProfiles.find(x => x.id === _bootActiveId);
  if (_bootProfile?.cachedData) {
    currentAccountType = normalizeAccountType(_bootProfile.type);
    storage.set(STORAGE_KEYS.ACCOUNT_TYPE, currentAccountType);
    document.querySelectorAll('.acct-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.type === currentAccountType));
    document.getElementById('rsn-input').value = _bootProfile.rsn;
    player.set(_bootProfile.cachedData);
    renderOverview(_bootProfile.cachedData);
  } else {
    const cached = player.getFromCache();
    if (cached) {
      renderOverview(cached);
    } else {
      const lastRsn = storage.get(STORAGE_KEYS.RSN, '');
      if (lastRsn) document.getElementById('rsn-input').value = lastRsn;
    }
  }
}
updateProfileBtn();
renderSettingsProfiles();
