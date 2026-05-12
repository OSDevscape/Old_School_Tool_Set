import { initPage, storage, showToast, sendLocalNotification } from '/src/app/shared.js';
initPage('timers');

// ─────────────────────────────────────────────────────────────────────────────
// Built-in groups
// ─────────────────────────────────────────────────────────────────────────────
const BUILT_IN_GROUPS = [
  { key:'herbs', label:'Herbs', icon:'🌿', items:[
    ['guam','Guam',9,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Guam_leaf_detail.png/64px-Guam_leaf_detail.png?85d6d'],
    ['marrentill','Marrentill',14,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Marrentill_detail.png/64px-Marrentill_detail.png?a6345'],
    ['tarromin','Tarromin',19,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Tarromin_detail.png/64px-Tarromin_detail.png?859ba'],
    ['harralander','Harralander',26,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Harralander_detail.png/64px-Harralander_detail.png?d6a6b'],
    ['ranarr','Ranarr',32,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Ranarr_weed_detail.png/64px-Ranarr_weed_detail.png?9e257'],
    ['toadflax','Toadflax',38,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Toadflax_detail.png/64px-Toadflax_detail.png?933e2'],
    ['irit','Irit',44,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Irit_leaf_detail.png/64px-Irit_leaf_detail.png?baf94'],
    ['avantoe','Avantoe',50,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Avantoe_detail.png/64px-Avantoe_detail.png?209b3'],
    ['kwuarm','Kwuarm',56,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Kwuarm_detail.png/64px-Kwuarm_detail.png?194c8'],
    ['snapdragon','Snapdragon',62,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Snapdragon_detail.png/64px-Snapdragon_detail.png?f5526'],
    ['cadantine','Cadantine',67,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Cadantine_detail.png/64px-Cadantine_detail.png?d6a6b'],
    ['lantadyme','Lantadyme',73,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Lantadyme_detail.png/64px-Lantadyme_detail.png?8337c'],
    ['dwarf-weed','Dwarf Weed',79,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Dwarf_weed_detail.png/64px-Dwarf_weed_detail.png?194c8'],
    ['torstol','Torstol',85,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Torstol_detail.png/64px-Torstol_detail.png?859ba'],
  ]},
  { key:'allotments', label:'Allotments', icon:'❖', items:[
    ['potato','Potato',1,'40m','https://oldschool.runescape.wiki/images/thumb/Potato_detail.png/64px-Potato_detail.png?18b75'],
    ['onion','Onion',5,'40m','https://oldschool.runescape.wiki/images/thumb/Onion_detail.png/64px-Onion_detail.png?46915'],
    ['tomato','Tomato',12,'40m','https://oldschool.runescape.wiki/images/thumb/Tomato_detail.png/64px-Tomato_detail.png?68ce7'],
    ['sweetcorn','Sweetcorn',20,'1h','https://oldschool.runescape.wiki/images/thumb/Sweetcorn_detail.png/64px-Sweetcorn_detail.png?05420'],
    ['strawberry','Strawberry',31,'1h','https://oldschool.runescape.wiki/images/thumb/Strawberry_detail.png/64px-Strawberry_detail.png?b5384'],
    ['watermelon','Watermelon',47,'1h 20m','https://oldschool.runescape.wiki/images/thumb/Watermelon_detail.png/64px-Watermelon_detail.png?a0167'],
  ]},
  { key:'trees', label:'Trees', icon:'🌲', items:[
    ['oak','Oak',15,'2h 40m','https://oldschool.runescape.wiki/images/thumb/Oak_sapling_detail.png/64px-Oak_sapling_detail.png?164e0'],
    ['willow','Willow',30,'4h','https://oldschool.runescape.wiki/images/thumb/Willow_sapling_detail.png/64px-Willow_sapling_detail.png?583a4'],
    ['maple','Maple',45,'5h 20m','https://oldschool.runescape.wiki/images/thumb/Maple_sapling_detail.png/64px-Maple_sapling_detail.png?b9c9e'],
    ['yew','Yew',60,'6h 40m','https://oldschool.runescape.wiki/images/thumb/Yew_sapling_detail.png/64px-Yew_sapling_detail.png?db804'],
    ['magic-tree','Magic',75,'8h','https://oldschool.runescape.wiki/images/thumb/Magic_sapling_detail.png/64px-Magic_sapling_detail.png?90ab7'],
  ]},
  { key:'fruit-trees', label:'Fruit Trees', icon:'🍎', items:[
    ['apple','Apple',27,'16h','https://oldschool.runescape.wiki/images/thumb/Apple_sapling_detail.png/64px-Apple_sapling_detail.png?1b183'],
    ['banana','Banana',33,'16h','https://oldschool.runescape.wiki/images/thumb/Banana_sapling_detail.png/64px-Banana_sapling_detail.png?43d1d'],
    ['orange','Orange',39,'16h','https://oldschool.runescape.wiki/images/thumb/Orange_sapling_detail.png/64px-Orange_sapling_detail.png?f9649'],
    ['pineapple','Pineapple',51,'16h','https://oldschool.runescape.wiki/images/thumb/Pineapple_sapling_detail.png/64px-Pineapple_sapling_detail.png?a3b00'],
    ['papaya','Papaya',57,'16h','https://oldschool.runescape.wiki/images/thumb/Papaya_sapling_detail.png/64px-Papaya_sapling_detail.png?a3b00'],
    ['palm','Palm',68,'16h','https://oldschool.runescape.wiki/images/thumb/Palm_sapling_detail.png/64px-Palm_sapling_detail.png?a3b00'],
    ['dragonfruit','Dragonfruit',81,'16h','https://oldschool.runescape.wiki/images/thumb/Dragonfruit_sapling_detail.png/64px-Dragonfruit_sapling_detail.png?af998'],
  ]},
  { key:'birdhouses', label:'Birdhouses', icon:'◉', items:[
    ['bird-house','Bird House',5,'50m','https://oldschool.runescape.wiki/images/thumb/Bird_house_trapping.png/64px-Bird_house_trapping.png?d617f'],
    ['oak-bird-house','Oak Bird House',14,'50m','https://oldschool.runescape.wiki/images/thumb/Oak_bird_house_detail.png/64px-Oak_bird_house_detail.png?5468f'],
    ['willow-bird-house','Willow Bird House',24,'50m','https://oldschool.runescape.wiki/images/thumb/Willow_bird_house_detail.png/64px-Willow_bird_house_detail.png?9b339'],
    ['teak-bird-house','Teak Bird House',34,'50m','https://oldschool.runescape.wiki/images/thumb/Teak_bird_house_detail.png/64px-Teak_bird_house_detail.png?859ba'],
    ['maple-bird-house','Maple Bird House',44,'50m','https://oldschool.runescape.wiki/images/thumb/Maple_bird_house_detail.png/64px-Maple_bird_house_detail.png?15d44'],
    ['yew-bird-house','Yew Bird House',59,'50m','https://oldschool.runescape.wiki/images/thumb/Yew_bird_house_detail.png/64px-Yew_bird_house_detail.png?7d4ca'],
    ['magic-bird-house','Magic Bird House',74,'50m','https://oldschool.runescape.wiki/images/thumb/Magic_bird_house_detail.png/64px-Magic_bird_house_detail.png?03de7'],
    ['redwood-bird-house','Redwood Bird House',89,'50m','https://oldschool.runescape.wiki/images/thumb/Redwood_bird_house_detail.png/64px-Redwood_bird_house_detail.png?9e257'],
  ]},
  { key:'extras', label:'Extras', icon:'⋯', items:[
    ['battlestaves','Battlestaves',1,'24h','https://oldschool.runescape.wiki/images/thumb/Battlestaff_detail.png/64px-Battlestaff_detail.png?c5b58'],
    ['herb-boxes','Herb Boxes',1,'24h','https://oldschool.runescape.wiki/images/thumb/Herb_box_detail.png/64px-Herb_box_detail.png?0470b'],
    ['kingdom','Kingdom of Miscellania',1,'24h','https://oldschool.runescape.wiki/images/thumb/Throne_of_Miscellania.png/64px-Throne_of_Miscellania.png?45c45'],
    ['tears','Tears of Guthix',1,'168h','https://oldschool.runescape.wiki/images/thumb/Tears_of_Guthix.png/64px-Tears_of_Guthix.png?1fc60'],
  ]},
];

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────────────────────
const CUSTOM_KEY   = 'osts_custom_timers_v2';
const ENTRIES_KEY  = 'osts_timer_entries_v2';
const PINS_KEY     = 'osts_timer_pins_v2';
const COLLAPSE_KEY = 'osts_timer_collapse_v2';

let customTimers = storage.get(CUSTOM_KEY, []);
let entries      = storage.get(ENTRIES_KEY, {});
let pins         = storage.get(PINS_KEY, []);
let collapsed    = storage.get(COLLAPSE_KEY, {});

function saveCustom()  { storage.set(CUSTOM_KEY,   customTimers); }
function saveEntries() { storage.set(ENTRIES_KEY,  entries); }
function savePins()    { storage.set(PINS_KEY,     pins); }
function saveCollapse(){ storage.set(COLLAPSE_KEY, collapsed); }

// ─────────────────────────────────────────────────────────────────────────────
// Timer map — built-in + custom merged
// ─────────────────────────────────────────────────────────────────────────────
let TIMER_MAP = {};

function rebuildTimerMap() {
  TIMER_MAP = {};
  BUILT_IN_GROUPS.forEach(g => g.items.forEach(([id, name, lvl, dur, icon]) => {
    TIMER_MAP[id] = { id, name, lvl, dur, icon, group: g.key, secs: parseDur(dur), custom: false };
  }));
  customTimers.forEach(t => {
    TIMER_MAP[t.id] = { ...t, custom: true };
  });
}
rebuildTimerMap();

// Remove duplicate custom timers (by ID)
const seenIds = new Set();
customTimers = customTimers.filter(t => {
  if (seenIds.has(t.id)) return false;
  seenIds.add(t.id);
  return true;
});
saveCustom();

// Remove duplicate pins
pins = [...new Set(pins)];
savePins();


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function parseDur(t) {
  let total = 0;
  String(t).replace(/(\d+)h/g, (_, n) => { total += Number(n) * 3600; });
  String(t).replace(/(\d+)m/g, (_, n) => { total += Number(n) * 60; });
  return total;
}
function secsToText(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
function fmtRemain(s) {
  if (s <= 0) return 'Ready';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  let parts = [];
  if (d > 0) parts.push(d + 'd');
  if (h > 0 || d > 0) parts.push(h + 'h');
  if (m > 0 || h > 0 || d > 0) parts.push(m + 'm');
  parts.push(sec + 's');
  return parts.join(' ');
}
function slugify(v) {
  return String(v || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom';
}

// ─────────────────────────────────────────────────────────────────────────────
// Build all render groups (custom-only groups first, then built-ins with any
// custom items prepended to their matching category)
// ─────────────────────────────────────────────────────────────────────────────
function getAllGroups() {
  const builtIn = BUILT_IN_GROUPS.map(g => ({ ...g, items: g.items.slice(), custom: false }));
  const byKey   = Object.fromEntries(builtIn.map(g => [g.key, g]));

  // Bucket custom timers by category
  const customGroups = {};
  customTimers.forEach(t => {
    const key = t.categoryKey || 'custom';
    if (!customGroups[key]) customGroups[key] = { key, label: t.categoryLabel || 'Custom', icon: '✦', items: [], custom: true };
    customGroups[key].items.push([t.id, t.name, 0, t.dur, t.icon]);
  });

  const newGroups = [];
  Object.values(customGroups).forEach(cg => {
    if (byKey[cg.key]) {
      // Prepend custom items to the matching built-in group
      byKey[cg.key].items = [...cg.items, ...byKey[cg.key].items];
    } else {
      newGroups.push(cg);
    }
  });

  return [...newGroups, ...builtIn];
}

// ─────────────────────────────────────────────────────────────────────────────
// Init collapse defaults
// ─────────────────────────────────────────────────────────────────────────────
BUILT_IN_GROUPS.forEach(g => { if (collapsed[g.key] === undefined) collapsed[g.key] = true; });

// Normalize running entries on page load (subtract any elapsed time)
function normalizeEntries() {
  Object.entries(entries).forEach(([id, e]) => {
    if (!TIMER_MAP[id]) { delete entries[id]; return; }
    if (!e.paused && e.lastTick) {
      const diff = Math.floor((Date.now() - e.lastTick) / 1000);
      e.remaining = Math.max(0, (e.remaining || 0) - diff);
      if (e.remaining <= 0) { e.remaining = 0; e.paused = true; }
      e.lastTick = e.remaining > 0 ? Date.now() : 0;
    }
  });
}
normalizeEntries();
saveEntries();

// ─────────────────────────────────────────────────────────────────────────────
// Timer actions
// ─────────────────────────────────────────────────────────────────────────────
function startTimer(id) {
  const meta = TIMER_MAP[id]; if (!meta) return;
  if (!entries[id]) entries[id] = { duration: meta.secs, remaining: meta.secs, paused: true, lastTick: 0 };
  const e = entries[id];
  if (e.remaining <= 0) e.remaining = e.duration || meta.secs;
  e.duration = e.duration || meta.secs;
  e.paused = false; e.lastTick = Date.now();
  saveEntries(); renderTimers();
  showToast('⏱ ' + meta.name + ' started');
}

function pauseTimer(id) {
  const e = entries[id]; if (!e || e.paused) return;
  const diff = Math.floor((Date.now() - (e.lastTick || Date.now())) / 1000);
  e.remaining = Math.max(0, e.remaining - diff);
  e.paused = true; e.lastTick = 0;
  saveEntries(); renderTimers();
  showToast('⏸ ' + (TIMER_MAP[id]?.name || '') + ' paused');
}

function resetTimer(id) {
  const meta = TIMER_MAP[id]; if (!meta) return;
  entries[id] = { duration: meta.secs, remaining: meta.secs, paused: true, lastTick: 0 };
  saveEntries(); renderTimers();
  showToast('↺ ' + meta.name + ' reset');
}

function clearTimer(id) {
  delete entries[id]; saveEntries(); renderTimers();
}

function togglePin(id) {
  pins = pins.includes(id) ? pins.filter(p => p !== id) : [id, ...pins];
  pins = [...new Set(pins)].slice(0, 24);
  savePins(); renderTimers();
}

function deleteCustomTimer(id) {
  const t = customTimers.find(x => x.id === id);
  if (!t) return;
  customTimers = customTimers.filter(x => x.id !== id);
  pins = pins.filter(p => p !== id);
  delete entries[id];
  saveCustom(); savePins(); saveEntries();
  rebuildTimerMap();
  renderTimers();
  showToast('🗑 ' + t.name + ' deleted');
}

function timerStatus(id) {
  const e = entries[id];
  if (!e) return { state: 'idle', left: 0 };
  const left = Math.max(0, e.remaining || 0);
  if (left === 0) return { state: 'ready', left: 0 };
  if (e.paused) return { state: 'paused', left };
  return { state: 'active', left };
}

// ─────────────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────────────
function timerCardHtml(id, showReorderButtons = false) {
  const meta = TIMER_MAP[id]; if (!meta) return '';
  const st       = timerStatus(id);
  const isCustom = !!meta.custom;

  const iconHtml = String(meta.icon || '').startsWith('http')
    ? `<img class="timer-icon" src="${meta.icon}" alt="${meta.name}" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="timer-icon" style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;font-size:16px;font-weight:800;color:var(--gold);background:var(--surface2);border-radius:6px">${meta.icon || meta.name[0].toUpperCase()}</div>`;

  const stateText =
    st.state === 'ready'  ? '● Ready' :
    st.state === 'active' ? '⏱ ' + fmtRemain(st.left) :
    st.state === 'paused' ? '⏸ ' + fmtRemain(st.left) : meta.dur;

  const ctrl = st.state === 'active'
    ? `<button class="timer-btn" data-pause="${id}" title="Pause">⏸</button>`
    : `<button class="timer-btn" data-start="${id}" title="Start">▶</button>`;

  const resetBtn = st.state !== 'idle' ? `<button class="timer-btn" data-reset="${id}" title="Reset">↺</button>` : '';
  const clearBtn = st.state !== 'idle' ? `<button class="timer-btn" data-clear="${id}" title="Clear">✕</button>` : '';
  const delBtn   = isCustom ? `<button class="timer-btn danger" data-delete="${id}" title="Delete">🗑</button>` : '';
  const pinCls   = pins.includes(id) ? ' active' : '';
  const lvlText  = meta.lvl ? `Lv ${meta.lvl} · ` : '';

  // Only show reorder buttons if explicitly requested (pinned section)
  const pinIndex = pins.indexOf(id);
  const isFirst = pinIndex === 0;
  const isLast = pinIndex === pins.length - 1;

  // Add reorder buttons only when showReorderButtons is true
  const reorderControls = showReorderButtons ? `
    <div class="reorder-controls">
      <button class="reorder-btn" data-move-up="${id}" ${isFirst ? 'disabled' : ''} title="Move up">▲</button>
      <button class="reorder-btn" data-move-down="${id}" ${isLast ? 'disabled' : ''} title="Move down">▼</button>
    </div>
  ` : '';

  return `<div class="timer-card${st.state === 'active' ? ' running' : st.state === 'ready' ? ' ready' : ''}">
    <div class="timer-card-inner">
      ${reorderControls}
      ${iconHtml}
      <div class="timer-main">
        <div class="timer-name">${meta.name}</div>
        <div class="timer-dur">${lvlText}${stateText}</div>
      </div>
      <div class="timer-actions">
        <button class="timer-btn${pinCls}" data-pin="${id}" title="Pin">📌</button>
        ${ctrl}${resetBtn}${clearBtn}${delBtn}
      </div>
    </div>
  </div>`;
}

function renderTimers() {
  const q = (document.getElementById('timer-search')?.value || '').toLowerCase().trim();

  // ── Pinned ────────────────────────────────────────────────────────────────
  const pinnedRoot = document.getElementById('timer-pinned');
  const validPins  = pins.filter(id => TIMER_MAP[id]);
  pinnedRoot.innerHTML = validPins.length
    ? `<div class="data-label">Pinned</div>${validPins.map(id => timerCardHtml(id, true)).join('')}`
    : '';

  // ── Groups ────────────────────────────────────────────────────────────────
  const allGroups = getAllGroups();

  // Ensure collapse state exists for any new custom-only groups
  allGroups.forEach(g => {
    if (collapsed[g.key] === undefined) collapsed[g.key] = false; // custom groups default open
  });

  let html = '';
  allGroups.forEach(g => {
    const items = g.items.filter(([id, name]) =>
      !q || name.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)
    );
    if (!items.length) return;

    const coll = !!collapsed[g.key];
    const customBadge = g.custom ? `<span class="custom-badge">Custom</span>` : '';

    html += `<div class="timer-group${coll ? ' collapsed' : ''}" data-group="${g.key}">
      <button class="timer-group-head" data-toggle-group="${g.key}">
        <div class="left"><span>${g.icon}</span><span>${g.label}${customBadge}</span></div>
        <span class="caret">⌄</span>
      </button>
      <div class="timer-items">${items.map(([id]) => timerCardHtml(id)).join('')}</div>
    </div>`;
  });

  document.getElementById('timer-groups').innerHTML = html || '<div class="no-data">No timers match your search.</div>';
  bindTimerEvents();
}

function bindTimerEvents() {
  document.querySelectorAll('[data-toggle-group]').forEach(btn => {
    btn.onclick = () => {
      collapsed[btn.dataset.toggleGroup] = !collapsed[btn.dataset.toggleGroup];
      saveCollapse(); renderTimers();
    };
  });
  document.querySelectorAll('[data-pin]').forEach(el => {
    el.onclick = () => togglePin(el.dataset.pin);
  });
  document.querySelectorAll('[data-start]').forEach(el => {
    el.onclick = () => startTimer(el.dataset.start);
  });
  document.querySelectorAll('[data-pause]').forEach(el => {
    el.onclick = () => pauseTimer(el.dataset.pause);
  });
  document.querySelectorAll('[data-reset]').forEach(el => {
    el.onclick = () => resetTimer(el.dataset.reset);
  });
  document.querySelectorAll('[data-clear]').forEach(el => {
    el.onclick = () => clearTimer(el.dataset.clear);
  });
  document.querySelectorAll('[data-delete]').forEach(el => {
    el.onclick = () => deleteCustomTimer(el.dataset.delete);
  });

  // Move up/down handlers for pinned timers
  document.querySelectorAll('[data-move-up]').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const id = el.dataset.moveUp;
      const index = pins.indexOf(id);
      if (index > 0) {
        // Swap with previous
        [pins[index - 1], pins[index]] = [pins[index], pins[index - 1]];
        savePins();
        renderTimers();
        showToast('📌 Moved up');
      }
    };
  });

  document.querySelectorAll('[data-move-down]').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const id = el.dataset.moveDown;
      const index = pins.indexOf(id);
      if (index < pins.length - 1 && index !== -1) {
        // Swap with next
        [pins[index], pins[index + 1]] = [pins[index + 1], pins[index]];
        savePins();
        renderTimers();
        showToast('📌 Moved down');
      }
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick — 1 second interval
// ─────────────────────────────────────────────────────────────────────────────
function tick() {
  let dirty = false;
  Object.entries(entries).forEach(([id, e]) => {
    if (!TIMER_MAP[id]) { delete entries[id]; dirty = true; return; }
    if (e.paused || !e.lastTick || e.remaining <= 0) return;
    const diff = Math.floor((Date.now() - e.lastTick) / 1000);
    if (diff <= 0) return;
    e.remaining = Math.max(0, e.remaining - diff);
    e.lastTick  = Date.now();
    if (e.remaining <= 0) {
      e.remaining = 0; e.paused = true; e.lastTick = 0;
      sendLocalNotification(
        TIMER_MAP[id].name + ' finished!',
        'Your timer is ready to collect.',
        'timer-' + id
      );
      showToast('✅ ' + TIMER_MAP[id].name + ' finished!', 3000);
    }
    dirty = true;
  });
  if (dirty) saveEntries();
  if (document.getElementById('page-timers')?.classList.contains('active')) renderTimers();
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Timer Modal & Pickers
// ─────────────────────────────────────────────────────────────────────────────
const ctOverlay = document.getElementById('create-timer-overlay');
const ctNameInp = document.getElementById('ct-name');
const ctErrEl = document.getElementById('ct-err');

// State
let selectedDuration = null;
let selectedCategory = null;
let selectedLocation = null;

// Duration options
const DURATION_OPTIONS = [
  '20m', '40m', '50m', '1h', '1h 20m', '2h', '2h 40m', '3h', '4h',
  '5h 20m', '6h', '6h 40m', '8h', '12h', '16h', '24h', '48h', '72h', '168h'
];

// Farming locations in OSRS
const FARMING_LOCATIONS = [
  'Falador', 'Ardougne', 'Catherby', 'Port Phasmatys', 'Canifis',
  'Hosidius', 'Farming Guild', 'Weiss', 'Harmony Island', 'Troll Stronghold',
  'Gnome Stronghold', 'Lletya', 'Prifddinas', 'Brimhaven', 'Calquat',
  'Herbiboar', 'Seaweed (Fossil Island)', 'Cactus (Al Kharid)', 'Hespori'
];

// ─────────────────────────────────────────────────────────────────────────────
// Duration Picker
// ─────────────────────────────────────────────────────────────────────────────
const durOverlay = document.getElementById('duration-overlay');
const durGrid = document.getElementById('dur-grid');
const durDisplay = document.getElementById('duration-display');
const durPickerBtn = document.getElementById('duration-picker-btn');

function openDurationPicker() {
  durGrid.innerHTML = DURATION_OPTIONS.map(dur => `
    <button class="modal-option${selectedDuration === dur ? ' selected' : ''}" data-value="${dur}">
      ${dur}
    </button>
  `).join('');

  durGrid.querySelectorAll('.modal-option').forEach(btn => {
    btn.onclick = () => {
      selectedDuration = btn.dataset.value;
      durDisplay.textContent = btn.dataset.value;
      durPickerBtn.classList.remove('placeholder');
      closeDurationPicker();
    };
  });

  durOverlay.classList.add('show');
}

function closeDurationPicker() {
  durOverlay.classList.remove('show');
}

durPickerBtn.addEventListener('click', openDurationPicker);
document.getElementById('dur-close').addEventListener('click', closeDurationPicker);
durOverlay.addEventListener('click', (e) => {
  if (e.target === durOverlay) closeDurationPicker();
});


// Custom Duration Input
document.getElementById('custom-duration-btn').addEventListener('click', () => {
  const customDur = document.getElementById('custom-duration-input').value.trim();
  const secs = parseDur(customDur);

  if (!secs || secs < 60) {
    document.getElementById('custom-duration-input').style.borderColor = 'var(--red)';
    setTimeout(() => {
      document.getElementById('custom-duration-input').style.borderColor = '';
    }, 2000);
    return;
  }

  selectedDuration = customDur;
  durDisplay.textContent = customDur;
  durPickerBtn.classList.remove('placeholder');
  document.getElementById('custom-duration-input').value = '';
  closeDurationPicker();
});

// Allow Enter key in custom duration input
document.getElementById('custom-duration-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('custom-duration-btn').click();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Category Picker
// ─────────────────────────────────────────────────────────────────────────────
const catOverlay = document.getElementById('category-overlay');
const catGrid = document.getElementById('cat-grid');
const catDisplay = document.getElementById('category-display');
const catPickerBtn = document.getElementById('category-picker-btn');

function openCategoryPicker() {
  // Get built-in categories
  const builtInCats = BUILT_IN_GROUPS.map(g => ({ key: g.key, label: g.label }));

  // Get custom categories
  const customCatKeys = [...new Set(customTimers.map(t => t.categoryKey).filter(Boolean))];
  const customOnlyCats = customCatKeys
    .filter(key => !builtInCats.find(b => b.key === key))
    .map(key => {
      const t = customTimers.find(x => x.categoryKey === key);
      return { key, label: t?.categoryLabel || key };
    });

  // Combine all categories, but only add "Custom" if it doesn't already exist
  const allCats = [...builtInCats, ...customOnlyCats];
  if (!allCats.find(c => c.key === 'custom')) {
    allCats.push({ key: 'custom', label: 'Custom' });
  }

  catGrid.innerHTML = allCats.map(c => `
    <button class="modal-option${selectedCategory?.key === c.key ? ' selected' : ''}" 
            data-key="${c.key}" data-label="${c.label}">
      ${c.label}
    </button>
  `).join('');

  catGrid.querySelectorAll('.modal-option').forEach(btn => {
    btn.onclick = () => {
      selectedCategory = { key: btn.dataset.key, label: btn.dataset.label };
      catDisplay.textContent = btn.dataset.label;
      catPickerBtn.classList.remove('placeholder');
      closeCategoryPicker();
    };
  });

  catOverlay.classList.add('show');
}

function closeCategoryPicker() {
  catOverlay.classList.remove('show');
}

catPickerBtn.addEventListener('click', openCategoryPicker);
document.getElementById('cat-close').addEventListener('click', closeCategoryPicker);
catOverlay.addEventListener('click', (e) => {
  if (e.target === catOverlay) closeCategoryPicker();
});


// Custom Category Input
document.getElementById('custom-category-btn').addEventListener('click', () => {
  const customCat = document.getElementById('custom-category-input').value.trim();

  if (!customCat) {
    document.getElementById('custom-category-input').style.borderColor = 'var(--red)';
    setTimeout(() => {
      document.getElementById('custom-category-input').style.borderColor = '';
    }, 2000);
    return;
  }

  const catKey = slugify(customCat);
  selectedCategory = { key: catKey, label: customCat };
  catDisplay.textContent = customCat;
  catPickerBtn.classList.remove('placeholder');
  document.getElementById('custom-category-input').value = '';
  closeCategoryPicker();
});

// Allow Enter key in custom category input
document.getElementById('custom-category-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('custom-category-btn').click();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Farming Location Picker
// ─────────────────────────────────────────────────────────────────────────────
const locOverlay = document.getElementById('location-overlay');
const locGrid = document.getElementById('loc-grid');
const locDisplay = document.getElementById('location-display');
const locPickerBtn = document.getElementById('location-picker-btn');

function openLocationPicker() {
  locGrid.innerHTML = FARMING_LOCATIONS.map(loc => `
    <button class="modal-option${selectedLocation === loc ? ' selected' : ''}" data-value="${loc}">
      ${loc}
    </button>
  `).join('');

  locGrid.querySelectorAll('.modal-option').forEach(btn => {
    btn.onclick = () => {
      selectedLocation = btn.dataset.value;
      locDisplay.textContent = btn.dataset.value;
      locPickerBtn.classList.remove('placeholder');
      closeLocationPicker();
    };
  });

  locOverlay.classList.add('show');
}

function closeLocationPicker() {
  locOverlay.classList.remove('show');
}

locPickerBtn.addEventListener('click', openLocationPicker);
document.getElementById('loc-close').addEventListener('click', closeLocationPicker);
locOverlay.addEventListener('click', (e) => {
  if (e.target === locOverlay) closeLocationPicker();
});

// ─────────────────────────────────────────────────────────────────────────────
// Create Timer Modal
// ─────────────────────────────────────────────────────────────────────────────
function openCreateModal() {
  ctNameInp.value = '';
  ctErrEl.textContent = '';
  selectedDuration = null;
  selectedCategory = null;
  selectedLocation = null;

  durDisplay.textContent = 'Select duration...';
  catDisplay.textContent = 'Select category...';
  locDisplay.textContent = 'Select farming location...';

  durPickerBtn.classList.add('placeholder');
  catPickerBtn.classList.add('placeholder');
  locPickerBtn.classList.add('placeholder');

  ctOverlay.classList.add('show');
  setTimeout(() => ctNameInp.focus(), 320);
}

function closeCreateModal() {
  ctOverlay.classList.remove('show');
}

// Submit
document.getElementById('ct-submit').addEventListener('click', () => {
  let name = ctNameInp.value.trim();
  const durRaw = selectedDuration;
  const secs = parseDur(durRaw);

  ctErrEl.textContent = '';

  if (!name) {
    ctErrEl.textContent = 'Enter a timer name.';
    ctNameInp.focus();
    return;
  }

  if (!secs || secs < 60) {
    ctErrEl.textContent = 'Select a duration (minimum 1 minute).';
    return;
  }

  // Append location to name if selected
  if (selectedLocation) {
    name = name + ' - ' + selectedLocation;
  }

  // Check for duplicate names (case-insensitive)
  const nameLower = name.toLowerCase();
  const existingTimer = Object.values(TIMER_MAP).find(t => t.name.toLowerCase() === nameLower);
  if (existingTimer) {
    ctErrEl.textContent = 'A timer with this name already exists. Please choose a different name.';
    ctNameInp.focus();
    return;
  }

  // Resolve category
  let catKey, catLabel;
  if (selectedCategory) {
    catKey = selectedCategory.key;
    catLabel = selectedCategory.label;
  } else {
    catKey = 'custom';
    catLabel = 'Custom';
  }

  const id = 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const dur = secsToText(secs);
  const icon = name.trim()[0].toUpperCase();

  const timer = { id, name, secs, dur, icon, categoryKey: catKey, categoryLabel: catLabel, custom: true };
  customTimers.unshift(timer);
  saveCustom();
  rebuildTimerMap();

  // Create timer entry (paused)
  entries[id] = { duration: secs, remaining: secs, paused: true, lastTick: 0 };
  pins = [id, ...pins.filter(p => p !== id)].slice(0, 24);
  saveEntries();
  savePins();

  // Open its category group
  collapsed[catKey] = false;
  saveCollapse();

  closeCreateModal();
  renderTimers();
  showToast('✅ ' + name + ' created');
});

document.getElementById('ct-close').addEventListener('click', closeCreateModal);
ctOverlay.addEventListener('click', (e) => {
  if (e.target === ctOverlay) closeCreateModal();
});

document.getElementById('open-create-btn').addEventListener('click', openCreateModal);


// Settings tools
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('clear-progress-btn').addEventListener('click', () => {
  if (!confirm('Clear all timer progress? This cannot be undone.')) return;
  entries = {}; saveEntries(); renderTimers();
  showToast('All timer progress cleared');
});
document.getElementById('clear-pins-btn').addEventListener('click', () => {
  pins = []; savePins(); renderTimers();
  showToast('All pins cleared');
});

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById('timer-search').addEventListener('input', renderTimers);
setInterval(tick, 1000);
renderTimers();

// ── Push Notifications ───────────────────────────────────────────────────────
updatePushStatus();
document.getElementById('enable-push-btn')?.addEventListener('click', async () => {
  try {
    const { registerPush } = await import('/src/app/bootstrap.js');
    await registerPush();
    showToast('✅ Push notifications enabled');
    updatePushStatus();
  } catch (err) { showToast('Push setup failed: ' + err.message, 6000); }
});
function updatePushStatus() {
  const el = document.getElementById('push-status');
  if (!el || !('Notification' in window)) return;
  el.textContent = { granted: '✅ Enabled', denied: '🚫 Blocked in browser settings', default: 'Not set up yet.' }[Notification.permission] || '';
}

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