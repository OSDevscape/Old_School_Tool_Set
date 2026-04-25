/**
 * OSTS v2 — Shared Module
 * Handles: theme · storage · player state · API routing · nav · toast · push
 *
 * Data sources:
 *   Hiscores  → /netlify/functions/hiscores (proxy to official OSRS hiscores)
 *   WOM       → https://api.wiseoldman.net/v2  (gains, charts, EHB, snapshots)
 *   Temple    → https://templeosrs.com/api      (achievements, supplemental data)
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  THEME:           'osts_theme_v2',
  RSN:             'osts_rsn_v2',
  ACCOUNT_TYPE:    'osts_acct_type_v2',
  PROFILES:        'osts_profiles_v2',
  CURRENT_PROFILE: 'osts_current_profile_v2',
  PLAYER_CACHE:    'osts_player_cache_v2',
  WOM_LAST_PUSH:   'osts_wom_last_push_v2',
};

export const ACCOUNT_TYPES = {
  ironman:  { label: 'Ironman',     badge: 'IRONMAN',      badgeClass: 'badge-ironman',  icon: '🛡' },
  hardcore: { label: 'Hardcore',    badge: 'HARDCORE',     badgeClass: 'badge-hardcore', icon: '💀' },
  ultimate: { label: 'Ultimate',    badge: 'ULTIMATE',     badgeClass: 'badge-ultimate', icon: '🔱' },
  regular:  { label: 'Regular',     badge: 'MAIN',         badgeClass: 'badge-regular',  icon: '⚔' },
  gim:      { label: 'Group Iron',  badge: 'GIM',          badgeClass: 'badge-gim',      icon: '👥' },
  ghcim:    { label: 'Group HC',    badge: 'GROUP HC',     badgeClass: 'badge-hardcore', icon: '☠' },
  ugim:     { label: 'Unranked GIM',badge: 'UGIM',         badgeClass: 'badge-gim',      icon: '👥' },
};

export const SKILLS = [
  ['overall',      'Overall',      'https://oldschool.runescape.wiki/images/thumb/Skills_icon.png/80px-Skills_icon.png',       '#c5a028'],
  ['attack',       'Attack',       'https://oldschool.runescape.wiki/images/Attack_icon.png',                                   '#e74c3c'],
  ['defence',      'Defence',      'https://oldschool.runescape.wiki/images/Defence_icon.png',                                  '#3498db'],
  ['strength',     'Strength',     'https://oldschool.runescape.wiki/images/Strength_icon.png',                                 '#8b4513'],
  ['hitpoints',    'Hitpoints',    'https://oldschool.runescape.wiki/images/Hitpoints_icon.png',                                '#c0392b'],
  ['ranged',       'Ranged',       'https://oldschool.runescape.wiki/images/Ranged_icon.png',                                   '#27ae60'],
  ['prayer',       'Prayer',       'https://oldschool.runescape.wiki/images/Prayer_icon.png',                                   '#f39c12'],
  ['magic',        'Magic',        'https://oldschool.runescape.wiki/images/Magic_icon.png',                                    '#8e44ad'],
  ['cooking',      'Cooking',      'https://oldschool.runescape.wiki/images/Cooking_icon.png',                                  '#e67e22'],
  ['woodcutting',  'Woodcutting',  'https://oldschool.runescape.wiki/images/Woodcutting_icon.png',                              '#2ecc71'],
  ['fletching',    'Fletching',    'https://oldschool.runescape.wiki/images/Fletching_icon.png',                                '#16a085'],
  ['fishing',      'Fishing',      'https://oldschool.runescape.wiki/images/Fishing_icon.png',                                  '#2980b9'],
  ['firemaking',   'Firemaking',   'https://oldschool.runescape.wiki/images/Firemaking_icon.png',                               '#e74c3c'],
  ['crafting',     'Crafting',     'https://oldschool.runescape.wiki/images/Crafting_icon.png',                                 '#9b59b6'],
  ['smithing',     'Smithing',     'https://oldschool.runescape.wiki/images/Smithing_icon.png',                                 '#95a5a6'],
  ['mining',       'Mining',       'https://oldschool.runescape.wiki/images/Mining_icon.png',                                   '#7f8c8d'],
  ['herblore',     'Herblore',     'https://oldschool.runescape.wiki/images/Herblore_icon.png',                                 '#27ae60'],
  ['agility',      'Agility',      'https://oldschool.runescape.wiki/images/Agility_icon.png',                                  '#1abc9c'],
  ['thieving',     'Thieving',     'https://oldschool.runescape.wiki/images/Thieving_icon.png',                                 '#8e44ad'],
  ['slayer',       'Slayer',       'https://oldschool.runescape.wiki/images/Slayer_icon.png',                                   '#e74c3c'],
  ['farming',      'Farming',      'https://oldschool.runescape.wiki/images/Farming_icon.png',                                  '#27ae60'],
  ['runecrafting', 'Runecraft',    'https://oldschool.runescape.wiki/images/Runecraft_icon.png',                                '#f39c12'],
  ['hunter',       'Hunter',       'https://oldschool.runescape.wiki/images/Hunter_icon.png',                                   '#795548'],
  ['construction', 'Construction', 'https://oldschool.runescape.wiki/images/Construction_icon.png',                             '#607d8b'],
  ['sailing',      'Sailing',      'https://oldschool.runescape.wiki/images/thumb/Sailing_icon.png/50px-Sailing_icon.png',      '#00b8d9'],
];

export const SKILL_MAP = Object.fromEntries(SKILLS.map(([id, name, icon, color]) => [id, { id, name, icon, color }]));

export const XP_TABLE = [0,0,83,174,276,388,512,650,801,969,1154,1358,1584,1833,2107,2411,2746,3115,3523,3973,4470,5018,5624,6291,7028,7842,8740,9730,10824,12031,13363,14833,16456,18247,20224,22406,24815,27473,30408,33648,37224,41171,45529,50339,55649,61512,67983,75127,83014,91721,101333,111945,123660,136594,150872,166636,184040,203254,224466,247886,273742,302288,333804,368599,407015,449428,496254,547953,605032,667991,737627,814445,899257,992895,1096278,1210421,1336443,1475581,1629200,1798808,1986068,2192818,2421087,2673114,2951373,3258594,3597792,3972294,4385776,4842295,5346332,5902831,6517253,7195629,7944614,8771558,9684577,10692629,11805606,13034431];

// ─── XP / Level Helpers ──────────────────────────────────────────────────────

export function xpToLevel(xp) {
  for (let i = XP_TABLE.length - 1; i >= 1; i--) if (xp >= XP_TABLE[i]) return Math.min(i, 99);
  return 1;
}
export function xpForLevel(l) { return XP_TABLE[Math.min(l, 99)] || 0; }
export function xpProgress(xp, lvl) {
  if (lvl >= 99) return 1;
  const c = xp - xpForLevel(lvl), n = xpForLevel(lvl + 1) - xpForLevel(lvl);
  return Math.max(0, Math.min(1, c / n));
}
export function calcCombat(skills) {
  const g = (id) => Number(skills[id]?.level || 1);
  const base = .25 * (g('defence') + g('hitpoints') + Math.floor(g('prayer') / 2));
  const melee = .325 * (g('attack') + g('strength'));
  const range = .325 * Math.floor(g('ranged') * 1.5);
  const mage  = .325 * Math.floor(g('magic')  * 1.5);
  return Math.floor(base + Math.max(melee, range, mage));
}

// ─── Format Helpers ──────────────────────────────────────────────────────────

export function fmtXP(n) {
  n = Number(n || 0);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
export function fmtNum(n) { return Number(n || 0).toLocaleString('en-GB'); }
export function fmtRank(n) { return (!n || n < 0) ? 'Unranked' : '#' + fmtNum(n); }

// ─── Storage ─────────────────────────────────────────────────────────────────

export const storage = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
};

// ─── Theme ───────────────────────────────────────────────────────────────────

export const theme = {
  THEMES: ['dark', 'light', 'brown'],
  current() { return storage.get(STORAGE_KEYS.THEME, 'brown'); },
  apply(t) {
    t = (t || 'dark').toLowerCase();
    document.body.classList.remove('theme-light', 'theme-brown');
    if (t === 'light') document.body.classList.add('theme-light');
    if (t === 'brown') document.body.classList.add('theme-brown');
    storage.set(STORAGE_KEYS.THEME, t);
    document.querySelectorAll('.theme-chip[data-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === t);
    });
  },
  init() { this.apply(this.current()); },
};

// ─── Toast ───────────────────────────────────────────────────────────────────

export function showToast(msg, dur = 4000) {
  const t = document.getElementById('toast');
  if (!t) return;
  clearTimeout(window.__ostsToastTimer);
  t.textContent = String(msg || '');
  t.classList.add('show');
  window.__ostsToastTimer = setTimeout(() => t.classList.remove('show'), dur);
}

// ─── Player State ─────────────────────────────────────────────────────────────

export const player = {
  _data: null,

  get() { return this._data; },

  set(data) {
    this._data = data;
    if (data) {
      storage.set(STORAGE_KEYS.PLAYER_CACHE, data);
      storage.set(STORAGE_KEYS.RSN, data.displayName || data.username || '');
      if (data.type) storage.set(STORAGE_KEYS.ACCOUNT_TYPE, normalizeAccountType(data.type));
    }
  },

  getFromCache() {
    const cached = storage.get(STORAGE_KEYS.PLAYER_CACHE);
    if (cached) this._data = cached;
    return cached;
  },

  getRsn() {
    return (this._data?.displayName || this._data?.username || storage.get(STORAGE_KEYS.RSN, '') || '').trim();
  },

  getAccountType() {
    return normalizeAccountType(this._data?.type || storage.get(STORAGE_KEYS.ACCOUNT_TYPE, 'ironman'));
  },

  clear() {
    this._data = null;
    storage.remove(STORAGE_KEYS.PLAYER_CACHE);
    storage.remove(STORAGE_KEYS.RSN);
  },
};

export function normalizeAccountType(raw, fallback = 'ironman') {
  const key = String(raw || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  const map = {
    regular:'regular', main:'regular', normal:'regular',
    ironman:'ironman', iron:'ironman', im:'ironman',
    hardcore:'hardcore', hcim:'hardcore', hardcoreironman:'hardcore',
    ultimate:'ultimate', uim:'ultimate', ultimateironman:'ultimate',
    gim:'gim', group:'gim', groupironman:'gim', groupiron:'gim',
    ghcim:'ghcim', grouphardcore:'ghcim', grouphardcoreironman:'ghcim',
    ugim:'ugim', unrankedgroup:'ugim', unrankedgroupironman:'ugim',
  };
  return map[key] || fallback;
}

// ─── API: Hiscores (via Netlify proxy) ───────────────────────────────────────

// Hiscores skill/activity/boss order from the official CSV
const HISCORES_SKILLS = [
  'overall','attack','defence','strength','hitpoints','ranged','prayer','magic',
  'cooking','woodcutting','fletching','fishing','firemaking','crafting','smithing',
  'mining','herblore','agility','thieving','slayer','farming','runecrafting',
  'hunter','construction','sailing',
];

const HISCORES_ACTIVITIES = [
  'bounty_hunter_hunter','bounty_hunter_rogue','bounty_hunter_legacy',
  'clue_all','clue_beginner','clue_easy','clue_medium','clue_hard','clue_elite','clue_master',
  'lms_rank','pvp_arena_rank','soul_wars_zeal','rifts_closed','colosseum_glory','mahogany_homes',
];

const HISCORES_BOSSES = [
  'abyssal_sire','alchemical_hydra','amoxliatl','araxxor','artio','barrows_chests',
  'bryophyta','callisto','calvarion','cerberus','chambers_of_xeric',
  'chambers_of_xeric_challenge_mode','chaos_elemental','chaos_fanatic',
  'commander_zilyana','corporeal_beast','crazy_archaeologist','dagannoth_prime',
  'dagannoth_rex','dagannoth_supreme','deranged_archaeologist','doom_of_mokhaiotl',
  'duke_sucellus','general_graardor','giant_mole','grotesque_guardians','hespori',
  'kalphite_queen','king_black_dragon','kraken','kreearra','kril_tsutsaroth',
  'lunar_chests','mimic','nex','nightmare','phosanis_nightmare','obor',
  'phantom_muspah','sarachnis','scorpia','scurrius','skotizo','sol_heredit','spindel',
  'tempoross','the_corrupted_gauntlet','the_gauntlet','the_hueycoatl','the_leviathan',
  'the_royal_titans','the_whisperer','thermonuclear_smoke_devil','tombs_of_amascut',
  'tombs_of_amascut_expert','tzkal_zuk','tztok_jad','vardorvis','venenatis','vetion',
  'vorkath','wintertodt','yama','zalcano','zulrah',
];

export function parseHiscoresCSV(csv) {
  const lines = csv.trim().split('\n');
  const skills = {}, activities = {}, bosses = {};

  HISCORES_SKILLS.forEach((id, i) => {
    const parts = (lines[i] || '-1,-1,-1').split(',');
    skills[id] = { rank: Number(parts[0]), level: Math.max(1, Number(parts[1])), experience: Number(parts[2]) };
  });

  const actOffset = HISCORES_SKILLS.length;
  HISCORES_ACTIVITIES.forEach((id, i) => {
    const parts = (lines[actOffset + i] || '-1,-1').split(',');
    activities[id] = { rank: Number(parts[0]), score: Number(parts[1]) };
  });

  const bossOffset = actOffset + HISCORES_ACTIVITIES.length;
  HISCORES_BOSSES.forEach((id, i) => {
    const parts = (lines[bossOffset + i] || '-1,-1').split(',');
    bosses[id] = { rank: Number(parts[0]), kills: Number(parts[1]) };
  });

  return { skills, activities, bosses };
}

export async function fetchHiscores(rsn, accountType = 'ironman') {
  const type = normalizeAccountType(accountType);
  const url = `/netlify/functions/hiscores?player=${encodeURIComponent(rsn)}&type=${type}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 404 ? 'Player not found on Hiscores' : `Hiscores error ${res.status}`);
  const json = await res.json();
  // Netlify function returns { csv: '...' }
  return parseHiscoresCSV(json.csv);
}

// ─── API: Wise Old Man ────────────────────────────────────────────────────────

const WOM_BASE = 'https://api.wiseoldman.net/v2';
const WOM_KEY  = 'qk0phdajd2rrxyt4jj58r5dz';
const WOM_UPDATE_LIMIT_MS = 10 * 60 * 1000;

function womHeaders() { return { 'x-api-key': WOM_KEY, 'Content-Type': 'application/json' }; }

export const wom = {
  async getPlayer(rsn) {
    const res = await fetch(`${WOM_BASE}/players/${encodeURIComponent(rsn)}`, { headers: womHeaders() });
    if (!res.ok) throw new Error(res.status === 404 ? 'Player not found on Wise Old Man' : `WOM error ${res.status}`);
    return res.json();
  },

  async updatePlayer(rsn) {
    const lastPush = storage.get(STORAGE_KEYS.WOM_LAST_PUSH, 0);
    const remaining = Math.max(0, WOM_UPDATE_LIMIT_MS - (Date.now() - lastPush));
    if (remaining > 0) {
      const m = Math.floor(remaining / 60000), s = Math.floor((remaining % 60000) / 1000);
      throw new Error(`Update on cooldown. Try again in ${m}m ${String(s).padStart(2,'0')}s.`);
    }
    const res = await fetch(`${WOM_BASE}/players/${encodeURIComponent(rsn)}`, { method: 'POST', headers: womHeaders() });
    if (!res.ok) throw new Error(`WOM update failed: ${res.status}`);
    storage.set(STORAGE_KEYS.WOM_LAST_PUSH, Date.now());
    return res.json();
  },

  async getGains(rsn, period = 'week') {
    const res = await fetch(`${WOM_BASE}/players/${encodeURIComponent(rsn)}/gained?period=${period}`, { headers: womHeaders() });
    if (!res.ok) throw new Error(`WOM gains error ${res.status}`);
    return res.json();
  },

  async getTimeline(rsn, metric = 'overall', period = 'month') {
    const res = await fetch(`${WOM_BASE}/players/${encodeURIComponent(rsn)}/snapshots/timeline?metric=${metric}&period=${period}`, { headers: womHeaders() });
    if (!res.ok) throw new Error(`WOM timeline error ${res.status}`);
    return res.json();
  },

  async getRecords(rsn) {
    const res = await fetch(`${WOM_BASE}/players/${encodeURIComponent(rsn)}/records`, { headers: womHeaders() });
    if (!res.ok) throw new Error(`WOM records error ${res.status}`);
    return res.json();
  },

  getUpdateCooldownMs() {
    const last = storage.get(STORAGE_KEYS.WOM_LAST_PUSH, 0);
    return Math.max(0, WOM_UPDATE_LIMIT_MS - (Date.now() - last));
  },

  formatCooldown(ms) {
    const total = Math.ceil(ms / 1000);
    return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2,'0')}s`;
  },
};

// ─── API: TempleOSRS (via Netlify proxy to avoid CORS) ───────────────────────

export const temple = {
  async getStats(rsn) {
    const res = await fetch(`/netlify/functions/temple?player=${encodeURIComponent(rsn)}&endpoint=stats`);
    if (!res.ok) throw new Error(`TempleOSRS error ${res.status}`);
    return res.json();
  },

  async getAchievements(rsn) {
    const res = await fetch(`/netlify/functions/temple?player=${encodeURIComponent(rsn)}&endpoint=achievements`);
    if (!res.ok) throw new Error(`TempleOSRS achievements error ${res.status}`);
    return res.json();
  },

  async getGains(rsn, period = '7') {
    const res = await fetch(`/netlify/functions/temple?player=${encodeURIComponent(rsn)}&endpoint=gains&time=${period}`);
    if (!res.ok) throw new Error(`TempleOSRS gains error ${res.status}`);
    return res.json();
  },
};

// ─── Combined Player Fetch ────────────────────────────────────────────────────

/**
 * Primary data fetch flow:
 *  1. WOM → snapshot for skills, boss data (has CORS, well-structured)
 *  2. Hiscores (via Netlify proxy) → authoritative current levels + KC
 *  3. Temple → supplemental data (achievements, EHP, etc.)
 *
 * Returns a unified player object.
 */
export async function fetchPlayer(rsn, accountType = null) {
  // Step 1: WOM (primary snapshot + player metadata)
  const womData = await wom.getPlayer(rsn);

  // Determine account type from WOM response or provided override
  const type = normalizeAccountType(accountType || womData.type, 'ironman');
  womData.type = type;

  // Step 2: Hiscores (authoritative current data)
  let hiscoresData = null;
  try {
    hiscoresData = await fetchHiscores(rsn, type);
    // Merge hiscores data into womData snapshot (hiscores is more current)
    if (hiscoresData && womData.latestSnapshot?.data?.skills) {
      SKILLS.forEach(([id]) => {
        if (hiscoresData.skills[id] && womData.latestSnapshot.data.skills[id]) {
          // Update with hiscores values if they're newer (higher XP)
          const hs = hiscoresData.skills[id];
          const wm = womData.latestSnapshot.data.skills[id];
          if (hs.experience > (wm.experience || 0)) {
            wm.level = hs.level;
            wm.experience = hs.experience;
            wm.rank = hs.rank;
          }
        }
      });
      // Attach raw hiscores boss data
      womData._hiscoresBosses = hiscoresData.bosses;
      womData._hiscoresActivities = hiscoresData.activities;
    }
  } catch (err) {
    console.warn('[OSTS] Hiscores fetch failed, using WOM data only:', err.message);
  }

  // Step 3: Temple (supplemental — non-blocking)
  try {
    const templeData = await temple.getStats(rsn);
    womData._temple = templeData;
  } catch (err) {
    console.warn('[OSTS] TempleOSRS fetch failed:', err.message);
  }

  // Step 4: Write to BOTH local and global recent players lists
  const _snap    = womData.latestSnapshot?.data || {};
  const _skills  = _snap.skills  || {};
  const _bosses  = { ...(_snap.bosses || {}), ...(womData._hiscoresBosses || {}) };
  const _overall = _skills.overall || {};
  const _recentEntry = {
    rsn:        womData.displayName || womData.username || rsn,
    type,
    searchedAt: new Date().toISOString(),
  };

  // Write 1: localStorage (immediate, always works, local to this device)
  const _LOCAL_KEY = 'osts_recent_players_v2';
  try {
    let _local = JSON.parse(localStorage.getItem(_LOCAL_KEY) || '[]');
    _local = [_recentEntry, ..._local.filter(p => p.rsn.toLowerCase() !== _recentEntry.rsn.toLowerCase())].slice(0, 5);
    localStorage.setItem(_LOCAL_KEY, JSON.stringify(_local));
  } catch (err) {
    console.warn('[OSTS] localStorage recent write failed:', err.message);
  }

  // Write 2: Global DB — recent_searches + players table
  fetch('/netlify/functions/recent-players', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      rsn:         _recentEntry.rsn,
      type,
      displayName: _recentEntry.rsn,
      combatLevel: Number(_overall.level ? calcCombat(_skills) : 3),
      totalLevel:  Number(_overall.level || 0),
      totalXp:     Number(_overall.experience || 0),
    }),
  }).then(res => {
    if (!res.ok) console.warn('[OSTS] Global recent write failed:', res.status);
    else console.log('[OSTS] Global recent write OK:', _recentEntry.rsn);
  }).catch(err => console.warn('[OSTS] Global recent write error:', err.message));

  // Write 3: Skill snapshot + boss KC — non-blocking
  fetch('/netlify/functions/snapshot', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      rsn:        _recentEntry.rsn,
      type,
      skills:     _skills,
      bosses:     _bosses,
      totalLevel: Number(_overall.level || 0),
      totalXp:    Number(_overall.experience || 0),
    }),
  }).then(res => {
    if (!res.ok) console.warn('[OSTS] Snapshot write failed:', res.status);
    else console.log('[OSTS] Snapshot write OK');
  }).catch(err => console.warn('[OSTS] Snapshot write error:', err.message));

  return womData;
}

// ─── Settings Panel ──────────────────────────────────────────────────────────

export const settings = {
  open() {
    document.body.classList.add('settings-open');
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');
    if (panel)   { panel.classList.add('show'); panel.setAttribute('aria-hidden', 'false'); }
    if (overlay) { overlay.style.display = 'block'; }
  },
  close() {
    document.body.classList.remove('settings-open');
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');
    if (panel)   { panel.classList.remove('show'); panel.setAttribute('aria-hidden', 'true'); }
    if (overlay) { overlay.style.display = 'none'; }
  },
  bindCloseOnOverlay() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) overlay.addEventListener('click', () => this.close());
  },
};

// ─── Navigation ──────────────────────────────────────────────────────────────

const NAV_PAGES = [
  { id: 'home',     label: 'Home',     icon: '🏠',  href: '../index.html' },
  { id: 'overview', label: 'Overview', icon: null,   href: '/Pages/overview.html', imgIcon: 'https://oldschool.runescape.wiki/images/thumb/Skills_icon.png/80px-Skills_icon.png' },
  { id: 'skills',   label: 'Skills',   icon: null,   href: '/Pages/skills.html',   imgIcon: 'https://oldschool.runescape.wiki/images/thumb/Skills_icon.png/80px-Skills_icon.png' },
  { id: 'gains',    label: 'Gains',    icon: '📈',  href: '/Pages/gains.html' },
  { id: 'more',     label: 'More',     icon: '…',   href: null },
];

export function renderNav(activePage) {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  nav.innerHTML = NAV_PAGES.map(p => {
    const iconHtml = p.imgIcon
      ? `<span class="nav-icon"><img src="${p.imgIcon}" alt="${p.label}" class="nav-icon-img" loading="lazy"></span>`
      : `<span class="nav-icon">${p.icon}</span>`;
    const isActive = p.id === activePage;
    const tag = p.href ? `a href="${p.href}"` : `button type="button"`;
    const close = p.href ? 'a' : 'button';
    return `<${tag} class="nav-btn${isActive ? ' active' : ''}" data-page="${p.id}">${iconHtml}${p.label}</${close}>`;
  }).join('');

  // More button opens modal
  nav.querySelector('[data-page="more"]')?.addEventListener('click', () => {
    document.getElementById('more-menu-overlay')?.classList.add('show');
  });
}

// ─── More Menu ───────────────────────────────────────────────────────────────

export function initMoreMenu() {
  const overlay = document.getElementById('more-menu-overlay');
  const closeBtn = document.getElementById('more-menu-close');
  if (!overlay) return;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
  closeBtn?.addEventListener('click', () => overlay.classList.remove('show'));
}

// ─── PWA Install Prompt ──────────────────────────────────────────────────────

export function initInstallPrompt() {
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('install-btn');
    if (btn) btn.style.display = 'block';
  });
  document.getElementById('install-btn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') document.getElementById('install-btn').style.display = 'none';
    deferredPrompt = null;
  });
}

// ─── Push Notifications ──────────────────────────────────────────────────────

export async function requestPushPermission() {
  if (!('Notification' in window)) throw new Error('Notifications not supported');
  if (Notification.permission === 'denied') throw new Error('Notifications blocked');
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Permission not granted');
  }
  return true;
}

export async function sendLocalNotification(title, body, tag = 'osts') {
  try {
    if (!('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker?.getRegistration('/');
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body, tag, renotify: true, icon: '/Assets/Logo/icon-192.png',
      });
      return true;
    }
    new Notification(title, { body, tag });
    return true;
  } catch { return false; }
}

// ─── Shared Init ─────────────────────────────────────────────────────────────

/**
 * Call this at the top of every page's DOMContentLoaded.
 * activePage: string matching NAV_PAGES id
 */
export function initPage(activePage) {
  theme.init();
  renderNav(activePage);
  initMoreMenu();
  initInstallPrompt();

  // Settings panel bindings (if present on this page)
  document.getElementById('settings-btn')?.addEventListener('click', e => {
    e.preventDefault(); settings.open();
  });
  document.getElementById('settings-close')?.addEventListener('click', e => {
    e.preventDefault(); settings.close();
  });
  settings.bindCloseOnOverlay();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') settings.close(); });

  // Theme chips
  document.querySelectorAll('.theme-chip[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => theme.apply(btn.dataset.theme));
  });

  // RSN input enter key
  document.getElementById('rsn-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('search-btn')?.click();
  });

  // Restore last RSN
  const lastRsn = storage.get(STORAGE_KEYS.RSN, '');
  const inp = document.getElementById('rsn-input');
  if (inp && lastRsn) inp.value = lastRsn;

  // Register service worker immediately (separate from push opt-in)
  if ('serviceWorker' in navigator) {
    import('./bootstrap.js')
      .then(({ registerSW }) => registerSW())
      .catch(() => {});
  }
}