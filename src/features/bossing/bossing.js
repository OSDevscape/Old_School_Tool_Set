import {
  initPage, fetchPlayer, player, settings, showToast, storage,
  STORAGE_KEYS, fmtNum, fmtRank, normalizeAccountType,
} from '/src/app/shared.js';

initPage('bossing');

// ── Boss bookmarks ─────────────────────────────────────────────────────────────
const BOSS_BOOK_KEY = 'osts_boss_bookmarks_v2';
function getBossBookmarks()      { return storage.get(BOSS_BOOK_KEY, []); }
function isBossBookmarked(name)  { return getBossBookmarks().includes(name); }
function toggleBossBookmark(name) {
  const list    = getBossBookmarks();
  const updated = list.includes(name) ? list.filter(n => n !== name) : [...list, name];
  storage.set(BOSS_BOOK_KEY, updated);
  // Update all bookmark buttons for this boss
  document.querySelectorAll(`[data-bm-boss="${CSS.escape(name)}"]`).forEach(btn => {
    btn.classList.toggle('saved', updated.includes(name));
    btn.title = updated.includes(name) ? 'Remove bookmark' : 'Bookmark this boss';
  });
  showToast(updated.includes(name) ? `${name} bookmarked 🔖` : `${name} removed`);
}

// ── Profile system ────────────────────────────────────────────────────────────
const PROFILES_KEY    = 'osts_profiles_v2';
const ACTIVE_PROF_KEY = 'osts_active_profile_v2';
const SP_ICONS  = { ironman:'🛡', hardcore:'💀', ultimate:'🔱', regular:'⚔', gim:'👥', ghcim:'☠', ugim:'👥' };
const SP_LABELS = { ironman:'Iron', hardcore:'HCIM', ultimate:'UIM', regular:'Regular', gim:'GIM', ghcim:'GHCIM', ugim:'UGIM' };

function getProfiles() { return storage.get(PROFILES_KEY, []); }
function getActiveId() { return storage.get(ACTIVE_PROF_KEY, null); }
function setActiveId(id) { storage.set(ACTIVE_PROF_KEY, id); }
function norm(t) { return normalizeAccountType(t); }

function renderProfilePanel() {
  const list = document.getElementById('sp-profile-list');
  if (!list) return;
  const profiles = getProfiles();
  const activeId = getActiveId();
  if (!profiles.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted)">No saved profiles.<br>Go to <a href="overview.html" style="color:var(--gold)">Overview</a> to create one.</div>';
    return;
  }
  const sorted = [...profiles].sort((a, b) => (b.id === activeId) - (a.id === activeId));
  list.innerHTML = sorted.map(p => `
    <div class="sp-profile-card${p.id === activeId ? ' active' : ''}">
      <div class="sp-avatar">${SP_ICONS[norm(p.type)] || '⚔'}</div>
      <div class="sp-info">
        <div class="sp-nickname">${p.nickname}</div>
        <div class="sp-rsn-type">${p.rsn} · ${SP_LABELS[norm(p.type)] || 'Iron'}</div>
      </div>
      ${p.id !== activeId
        ? `<button class="sp-btn" data-load="${p.id}">Load</button>`
        : '<span style="font-size:10px;color:var(--gold)">Active</span>'}
    </div>`).join('');

  list.querySelectorAll('[data-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = getProfiles().find(x => x.id === btn.dataset.load);
      if (!p) return;
      setActiveId(p.id);
      storage.set(STORAGE_KEYS.ACCOUNT_TYPE, norm(p.type));
      storage.set(STORAGE_KEYS.RSN, p.rsn);
      settings.close();
      loadPlayer(p.rsn, norm(p.type));
    });
  });
}

document.getElementById('settings-btn')
  ?.addEventListener('click', renderProfilePanel, true);

// ── Load player ───────────────────────────────────────────────────────────────
async function loadPlayer(rsn, accountType) {
  if (!rsn) rsn = storage.get(STORAGE_KEYS.RSN, '');
  if (!rsn) return;
  if (!accountType) accountType = storage.get(STORAGE_KEYS.ACCOUNT_TYPE, 'ironman');
  setLoading(true); clearError();
  try {
    const data = await fetchPlayer(rsn, accountType);
    player.set(data);
    renderBossing(data);
    showToast('✅ ' + (data.displayName || rsn));
  } catch (err) { showError(err.message); }
  finally { setLoading(false); }
}

// ── Render bossing ────────────────────────────────────────────────────────────
function humanizeBoss(id) {
  const special = { ehp:'EHP', ehb:'EHB', toa:'ToA', cox:'CoX', tob:'ToB', tzkal:'TzKal', tztok:'TzTok', kril:"K'ril", kreearra:"Kree'arra" };
  return id.split('_').map(w => special[w] || w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function renderBossing(data) {
  document.getElementById('welcome-msg').style.display    = 'none';
  document.getElementById('bossing-content').style.display = '';

  const womBosses = data.latestSnapshot?.data?.bosses || {};
  const hsBosses  = data._hiscoresBosses || {};

  const entries = Object.entries(womBosses).map(([id, b]) => {
    const hsKc = hsBosses[id]?.kills ?? -1;
    const kc   = hsKc >= 0 ? hsKc : Number(b?.kills || 0);
    const rank  = hsBosses[id]?.rank > 0 ? hsBosses[id].rank : Number(b?.rank || -1);
    const ehb   = Number(b?.ehb || 0);
    return { id, name: humanizeBoss(id), kc, rank, ehb };
  }).sort((a, b) => b.kc - a.kc || b.ehb - a.ehb);

  const active   = entries.filter(e => e.kc > 0);
  const totalKC  = entries.reduce((s, e) => s + e.kc, 0);
  const totalEHB = entries.reduce((s, e) => s + e.ehb, 0);
  const ranked   = entries.filter(e => e.rank > 0).sort((a, b) => a.rank - b.rank);

  document.getElementById('bs-count').textContent    = active.length;
  document.getElementById('bs-total-kc').textContent = fmtNum(totalKC);
  document.getElementById('bs-ehb').textContent      = totalEHB.toFixed(1);
  document.getElementById('bs-best-rank').textContent= ranked[0] ? '#' + fmtNum(ranked[0].rank) : 'Unranked';

  if (!entries.length) {
    document.getElementById('boss-list').innerHTML = '<div class="no-data">No boss data available.</div>';
    return;
  }

  document.getElementById('boss-list').innerHTML = entries.map((e, i) => `
    <details class="boss-item"${i === 0 ? ' open' : ''}>
      <summary class="boss-summary">
        <div class="boss-thumb">
          <div class="boss-fallback">${e.name.split(' ').map(w => w[0]).join('').slice(0,2)}</div>
        </div>
        <div class="boss-name-wrap">
          <div class="boss-name">${e.name}</div>
          <div class="boss-mini">${e.rank > 0 ? 'Ranked' : 'Unranked'} · ${e.ehb.toFixed(1)} EHB</div>
        </div>
        <div class="boss-kc">${fmtNum(e.kc)} KC</div>
        <button class="boss-bm-btn${isBossBookmarked(e.name) ? ' saved' : ''}"
          data-bm-boss="${e.name}"
          title="${isBossBookmarked(e.name) ? 'Remove bookmark' : 'Bookmark this boss'}">🔖</button>
        <div style="color:var(--muted);font-size:12px;padding-left:2px">▾</div>
      </summary>
      <div class="boss-body">
        <div class="boss-metrics">
          <div class="boss-metric"><div class="k">Kills</div><div class="v">${fmtNum(e.kc)}</div></div>
          <div class="boss-metric"><div class="k">Rank</div><div class="v">${e.rank > 0 ? '#' + fmtNum(e.rank) : 'Unranked'}</div></div>
          <div class="boss-metric"><div class="k">EHB</div><div class="v">${e.ehb.toFixed(1)}</div></div>
          <div class="boss-metric"><div class="k">EHB/KC</div><div class="v">${e.kc > 0 ? (e.ehb / e.kc).toFixed(2) : '0'}</div></div>
        </div>
      </div>
    </details>`).join('');

  document.querySelectorAll('.boss-item').forEach(item => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      document.querySelectorAll('.boss-item').forEach(other => { if (other !== item) other.open = false; });
    });
  });

  // Bookmark buttons — stop propagation so <details> doesn't toggle on click
  document.querySelectorAll('.boss-bm-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      toggleBossBookmark(btn.dataset.bmBoss);
    });
  });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setLoading(on) { document.getElementById('loader').classList.toggle('loading', on); }
function clearError() { const el = document.getElementById('error-msg'); el.textContent = ''; el.classList.remove('show'); }
function showError(msg) { const el = document.getElementById('error-msg'); el.textContent = msg; el.classList.add('show'); document.getElementById('welcome-msg').style.display = ''; }

// ── Boot ──────────────────────────────────────────────────────────────────────
const cached = player.getFromCache();
if (cached) {
  renderBossing(cached);
} else {
  const lastRsn = storage.get(STORAGE_KEYS.RSN, '');
  if (lastRsn) loadPlayer(lastRsn);
}