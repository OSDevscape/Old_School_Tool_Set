import { initPage, settings, storage, normalizeAccountType } from '/src/app/shared.js';

initPage('guides');

// ── Theoatrix 1-99 skill definitions ───────────────────────────────────────
const SKILLS_99 = [
  { id: 'attack',        name: 'Attack',       color: '#8B0000', icon: 'Attack_icon.png' },
  { id: 'strength',      name: 'Strength',     color: '#1a4d1a', icon: 'Strength_icon.png' },
  { id: 'defence',       name: 'Defence',      color: '#3a6ba8', icon: 'Defence_icon.png' },
  { id: 'hitpoints',     name: 'Hitpoints',    color: '#8B0000', icon: 'Hitpoints_icon.png' },
  { id: 'ranged',        name: 'Ranged',       color: '#3d6b1f', icon: 'Ranged_icon.png' },
  { id: 'prayer',        name: 'Prayer',       color: '#8a8a3a', icon: 'Prayer_icon.png' },
  { id: 'magic',         name: 'Magic',        color: '#4b0082', icon: 'Magic_icon.png' },
  { id: 'runecraft',     name: 'Runecraft',    color: '#b8860b', icon: 'Runecraft_icon.png' },
  { id: 'construction',  name: 'Construction', color: '#8B6914', icon: 'Construction_icon.png' },
  { id: 'agility',       name: 'Agility',      color: '#2f4f8f', icon: 'Agility_icon.png' },
  { id: 'herblore',      name: 'Herblore',     color: '#2d7a2d', icon: 'Herblore_icon.png' },
  { id: 'thieving',      name: 'Thieving',     color: '#6b2fa0', icon: 'Thieving_icon.png' },
  { id: 'crafting',      name: 'Crafting',     color: '#8B6914', icon: 'Crafting_icon.png' },
  { id: 'fletching',     name: 'Fletching',    color: '#2d7a4f', icon: 'Fletching_icon.png' },
  { id: 'slayer',        name: 'Slayer',       color: '#8B0000', icon: 'Slayer_icon.png' },
  { id: 'hunter',        name: 'Hunter',       color: '#7a5c2d', icon: 'Hunter_icon.png' },
  { id: 'mining',        name: 'Mining',       color: '#5a5a7a', icon: 'Mining_icon.png' },
  { id: 'smithing',      name: 'Smithing',     color: '#7a6040', icon: 'Smithing_icon.png' },
  { id: 'fishing',       name: 'Fishing',      color: '#2a6b8a', icon: 'Fishing_icon.png' },
  { id: 'cooking',       name: 'Cooking',      color: '#8a3a2a', icon: 'Cooking_icon.png' },
  { id: 'firemaking',    name: 'Firemaking',   color: '#c85000', icon: 'Firemaking_icon.png' },
  { id: 'woodcutting',   name: 'Woodcutting',  color: '#4a7a2a', icon: 'Woodcutting_icon.png' },
  { id: 'farming',       name: 'Farming',      color: '#3d7a3d', icon: 'Farming_icon.png' },
  { id: 'sailing',       name: 'Sailing',      color: '#1a6b8a', icon: 'Sailing_icon.png' },
];

function iconUrl(name) {
  return `https://oldschool.runescape.wiki/images/thumb/${name}/30px-${name}`;
}

function theoSearchUrl(skill) {
  const q = encodeURIComponent(`theoatrix osrs 1-99 ${skill} guide`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

// ── Render Theoatrix grid ───────────────────────────────────────────────────
function renderTheoGrid(filter = '') {
  const grid = document.getElementById('theo-grid');
  const q = filter.toLowerCase().trim();

  const filtered = q
    ? SKILLS_99.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q))
    : SKILLS_99;

  if (!filtered.length) { grid.innerHTML = ''; return; }

  grid.innerHTML = filtered.map(s => `
    <a class="theo-card"
       href="${theoSearchUrl(s.name)}"
       target="_blank" rel="noopener"
       data-skill="${s.id}"
       title="Theoatrix 1-99 ${s.name} Guide">
      <div class="theo-card-stripe" style="background:${s.color}"></div>
      <img class="theo-icon"
           src="${iconUrl(s.icon)}"
           alt="${s.name}"
           loading="lazy"
           onerror="this.style.display='none'">
      <div class="theo-skill-name">${s.name}</div>
      <div class="theo-label">1-99 Guide</div>
      <div class="theo-yt-badge">▶</div>
    </a>
  `).join('');
}

renderTheoGrid();

// ── Theoatrix dropdown toggle ───────────────────────────────────────────────
const theoToggleBtn  = document.getElementById('theo-toggle');
const theoDropdown   = document.getElementById('theo-dropdown');

theoToggleBtn.addEventListener('click', () => {
  const isOpen = theoDropdown.classList.contains('open');
  theoDropdown.classList.toggle('open', !isOpen);
  theoToggleBtn.classList.toggle('open', !isOpen);
  theoToggleBtn.setAttribute('aria-expanded', String(!isOpen));
});

// ── Search ─────────────────────────────────────────────────────────────────
const searchEl   = document.getElementById('guide-search');
const emptyEl    = document.getElementById('guides-empty');
const emptyQuery = document.getElementById('empty-query');
const allSections = document.querySelectorAll('.guide-section');
const allVidCards = document.querySelectorAll('.vid-card');

function applySearch(q) {
  q = q.toLowerCase().trim();

  if (!q) {
    // Reset everything
    allSections.forEach(s => s.classList.remove('hidden'));
    allVidCards.forEach(c => c.style.display = '');
    renderTheoGrid();
    emptyEl.style.display = 'none';
    return;
  }

  // Filter theo grid
  renderTheoGrid(q);

  // Filter video cards
  allVidCards.forEach(card => {
    const kw   = (card.dataset.keywords || '').toLowerCase();
    const title = card.querySelector('.vid-title')?.textContent.toLowerCase() || '';
    const creator = card.querySelector('.vid-creator')?.textContent.toLowerCase() || '';
    const match = kw.includes(q) || title.includes(q) || creator.includes(q);
    card.style.display = match ? '' : 'none';
  });

  // Hide empty creator sections
  let anyVisible = false;
  document.querySelectorAll('.creator-card').forEach(cc => {
    const cards = cc.querySelectorAll('.vid-card');
    if (!cards.length) { anyVisible = true; return; } // theo section has no vid-cards
    const visible = [...cards].some(c => c.style.display !== 'none');
    cc.closest('.guide-section').classList.toggle('hidden', !visible);
    if (visible) anyVisible = true;
  });

  // Theo section: show if any skill matched — also auto-open dropdown
  const theoHasCards = !!document.querySelector('#theo-grid .theo-card');
  document.getElementById('section-theo').classList.toggle('hidden', !theoHasCards);
  if (theoHasCards) {
    anyVisible = true;
    theoDropdown.classList.add('open');
    theoToggleBtn.classList.add('open');
    theoToggleBtn.setAttribute('aria-expanded', 'true');
  }

  emptyEl.style.display = anyVisible ? 'none' : 'block';
  if (!anyVisible) emptyQuery.textContent = q;
}

searchEl.addEventListener('input', e => applySearch(e.target.value));

// ── Category tabs ───────────────────────────────────────────────────────────
const catTabs = document.querySelectorAll('.cat-tab');

catTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // clear search
    searchEl.value = '';
    catTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const cat = tab.dataset.cat;

    if (cat === 'all') {
      allSections.forEach(s => s.classList.remove('hidden'));
      allVidCards.forEach(c => c.style.display = '');
      renderTheoGrid();
      emptyEl.style.display = 'none';
      return;
    }

    // Show/hide sections by data-cats
    allSections.forEach(s => {
      const cats = (s.dataset.cats || '').split(',');
      s.classList.toggle('hidden', !cats.includes(cat));
    });

    // Show/hide individual video cards
    allVidCards.forEach(c => {
      const cats = (c.dataset.cats || '').split(',');
      c.style.display = cats.includes(cat) ? '' : 'none';
    });

    // Theoatrix grid: only show for skilling or all
    if (cat === 'skilling') {
      renderTheoGrid();
      theoDropdown.classList.add('open');
      theoToggleBtn.classList.add('open');
      theoToggleBtn.setAttribute('aria-expanded', 'true');
    } else {
      document.getElementById('theo-grid').innerHTML = '';
      document.getElementById('section-theo').classList.add('hidden');
    }

    emptyEl.style.display = 'none';
  });
});

// ── Settings profile panel ──────────────────────────────────────────────────
const PROFILES_KEY    = 'osts_profiles_v2';
const ACTIVE_PROF_KEY = 'osts_active_profile_v2';
const SP_ICONS  = { ironman:'🛡', hardcore:'💀', ultimate:'🔱', regular:'⚔', gim:'👥', ghcim:'☠', ugim:'👥' };
const SP_LABELS = { ironman:'Iron', hardcore:'HCIM', ultimate:'UIM', regular:'Regular', gim:'GIM', ghcim:'GHCIM', ugim:'UGIM' };

function norm(t) { return normalizeAccountType(t); }
function getProfiles()  { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]'); }
function getActiveId()  { return localStorage.getItem(ACTIVE_PROF_KEY); }
function setActiveId(id){ localStorage.setItem(ACTIVE_PROF_KEY, id); }

function renderSpProfiles() {
  const list = document.getElementById('sp-profile-list');
  if (!list) return;
  const profiles = getProfiles();
  const activeId = getActiveId();
  if (!profiles.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">No saved profiles yet.</div>';
    return;
  }
  const sorted = [...profiles].sort((a,b) => (b.id === activeId) - (a.id === activeId));
  list.innerHTML = sorted.map(p => `
    <div class="sp-profile-card${p.id === activeId ? ' active' : ''}">
      <div class="sp-avatar">${SP_ICONS[norm(p.type)] || '⚔'}</div>
      <div class="sp-info">
        <div class="sp-nickname">${p.nickname}</div>
        <div class="sp-rsn-type">${p.rsn} · ${SP_LABELS[norm(p.type)] || 'Iron'}</div>
      </div>
      ${p.id !== activeId
        ? `<button class="sp-btn" data-sp-load="${p.id}">Load</button>`
        : '<span style="font-size:10px;color:var(--gold)">Active</span>'}
    </div>`).join('');

  list.querySelectorAll('[data-sp-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = getProfiles().find(x => x.id === btn.dataset.spLoad);
      if (!p) return;
      setActiveId(p.id);
      settings.close();
      window.location.href = '/overview.html?rsn=' + encodeURIComponent(p.rsn);
    });
  });
}

document.getElementById('settings-btn')?.addEventListener('click', renderSpProfiles, true);