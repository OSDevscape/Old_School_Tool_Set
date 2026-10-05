import { initPage } from '/src/app/shared.js';
initPage('bestiary');

// Bestiary full implementation — coming next.
// Will pull monster stats from OSRS Wiki Cargo API,
// with Anthropic API fallback (same pattern as original OSTS bestiary).


// ── Player Profiles ───────────────────────────────────────────────────────────
const PROFILES_KEY_SP    = 'osts_profiles_v2';
const ACTIVE_PROF_KEY_SP = 'osts_active_profile_v2';
const SP_ICONS  = { ironman:'🛡', hardcore:'💀', ultimate:'🔱', regular:'⚔', gim:'👥', ghcim:'☠', ugim:'👥' };
const SP_LABELS = { ironman:'Iron', hardcore:'HCIM', ultimate:'UIM', regular:'Regular', gim:'GIM', ghcim:'GHCIM', ugim:'UGIM' };

function spGetProfiles() { return storage.get(PROFILES_KEY_SP, []); }
function spGetActiveId()  { return storage.get(ACTIVE_PROF_KEY_SP, null); }
function spSetActiveId(id){ storage.set(ACTIVE_PROF_KEY_SP, id); }
function spNorm(t){ return normalizeAccountType(t); }

function renderSpProfiles() {
  const list = document.getElementById('sp-profile-list');
  if (!list) return;
  const profiles = spGetProfiles();
  const activeId = spGetActiveId();
  if (!profiles.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted)">No saved profiles.<br>Search a player on <a href="overview.html" style="color:var(--gold)">Overview</a> to create one.</div>';
    return;
  }
  const sorted = [...profiles].sort((a,b) => (b.id === activeId) - (a.id === activeId));
  list.innerHTML = sorted.map(p => `
    <div class="sp-profile-card${p.id === activeId ? ' active' : ''}">
      <div class="sp-avatar">${SP_ICONS[spNorm(p.type)] || '⚔'}</div>
      <div class="sp-info">
        <div class="sp-nickname">${p.nickname}</div>
        <div class="sp-rsn-type">${p.rsn} · ${SP_LABELS[spNorm(p.type)] || 'Iron'}</div>
      </div>
      ${p.id !== activeId ? `<button class="sp-btn" data-sp-load="${p.id}">Load</button>` : '<span style="font-size:10px;color:var(--gold)">Active</span>'}
    </div>`).join('');

  list.querySelectorAll('[data-sp-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = spGetProfiles().find(x => x.id === btn.dataset.spLoad);
      if (!p) return;
      spSetActiveId(p.id);
      storage.set(STORAGE_KEYS.ACCOUNT_TYPE, spNorm(p.type));
      storage.set(STORAGE_KEYS.RSN, p.rsn);
      settings.close();
      showToast('Switched to ' + p.nickname);
    });
  });
}

document.getElementById('settings-btn')?.addEventListener('click', renderSpProfiles, true);

