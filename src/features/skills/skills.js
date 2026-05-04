import {
  initPage, fetchPlayer, player, settings, showToast, storage,
  STORAGE_KEYS, SKILLS, SKILL_MAP, fmtXP, fmtNum, fmtRank,
  xpToLevel, xpForLevel, xpProgress, normalizeAccountType,
} from '/src/app/shared.js';

initPage('skills');

const XP_FOR_99 = 13_034_431;

// ─────────────────────────────────────────────────────────────────────────────
// Best training methods per skill (level-gated)
// ─────────────────────────────────────────────────────────────────────────────
const METHODS = {
  attack:       [[1,'Sand Crabs (AFK)',15000],[40,'Nightmare Zone (Rumble)',65000],[70,'Slayer melee tasks',90000],[85,'Nightmare Zone (Absorption)',110000]],
  strength:     [[1,'Sand Crabs (AFK)',15000],[40,'Nightmare Zone (Rumble)',70000],[70,'Slayer melee tasks',100000],[85,'Nightmare Zone (Absorption)',130000]],
  defence:      [[1,'Sand Crabs (defensive)',15000],[40,'Nightmare Zone (Rumble)',55000],[70,'Slayer tasks (defensive)',80000],[85,'Nightmare Zone (Absorption)',100000]],
  hitpoints:    [[1,'Sand Crabs',8000],[40,'Nightmare Zone',30000],[70,'Slayer tasks',45000],[85,'Nightmare Zone (Absorption)',55000]],
  ranged:       [[1,'Sand Crabs',20000],[40,'Dorgeshuun Crossbow',40000],[70,'Red Chinchompas (MM tunnels)',300000],[85,'Red Chins (Hard MM)',500000]],
  prayer:       [[1,'Ensouled Heads (goblin)',50000],[38,'Ensouled Heads (giant)',160000],[60,'Ensouled Heads (dragon)',260000],[70,'Dragon Bones on altar',350000]],
  magic:        [[1,'Low Level Alchemy',30000],[43,'Superheat Item',75000],[55,'High Alch (AFK)',70000],[70,'Barraging (MM2 tunnels)',280000]],
  cooking:      [[1,'Shrimps / Anchovies',50000],[35,'Tuna',120000],[64,'Wines of Zamorak',490000],[80,'Karambwan',200000]],
  woodcutting:  [[1,'Regular Trees',7000],[35,'Teak Trees (Ape Atoll)',55000],[60,'Blisterwood Tree',68000],[75,'Redwood Trees (AFK)',42000]],
  fletching:    [[1,'Arrow Shafts',40000],[52,'Stringing Maple Longbows',200000],[65,'Cutting Magic Shortbows',250000],[85,'Stringing Dragon Longbows',900000]],
  fishing:      [[1,'Shrimps (Draynor)',8000],[35,'Barbarian Fishing',40000],[58,'Minnows (Fishing Guild)',50000],[70,'Aerial Fishing',55000]],
  firemaking:   [[1,'Regular Logs',50000],[35,'Maple Logs',165000],[50,'Wintertodt (AFK)',100000],[60,'Magic Logs',200000]],
  crafting:     [[1,'Leather Gloves',60000],[40,'Spinning Flax',70000],[63,'Blue Dragonhide Bodies',200000],[77,'Black Dragonhide Bodies',225000]],
  smithing:     [[1,'Bronze Bars (furnace)',10000],[40,'Gold Bars + Goldsmith Gauntlets',380000],[60,'Blast Furnace (Mithril)',250000],[70,'Blast Furnace (Adamant)',320000]],
  mining:       [[1,'Copper / Tin Ore',8000],[30,'Iron Ore (3-tick)',70000],[60,'Motherlode Mine (AFK)',30000],[65,'Granite (3-tick)',100000]],
  herblore:     [[1,'Guam Potions',50000],[38,'Ranarr Potions',150000],[66,'Super Restore Potions',280000],[78,'Ranging Potions',350000]],
  agility:      [[1,'Gnome Stronghold Course',8000],[40,"Seers' Village Rooftop",42000],[60,'Pollnivneach Rooftop',60000],[80,'Ardougne Rooftop Course',62000]],
  thieving:     [[1,'Men / Women',15000],[45,'Blackjacking Bandits',250000],[55,'Pyramid Plunder',200000],[75,'Master Farmers',180000]],
  slayer:       [[1,'Turael tasks',10000],[50,'Vannaka tasks',25000],[70,'Konar tasks',45000],[85,'Duradel tasks',60000]],
  farming:      [[1,'Allotments + Herb runs',10000],[45,'Herb runs (Ranarr)',30000],[65,'Herb runs (Snapdragon)',45000],[85,'Herb runs (Torstol) + Trees',60000]],
  runecrafting: [[1,'Air Runes (Air Altar)',12000],[44,'Nature Runes (Abyss)',38000],[65,'Lava Runes (Binding Necklace)',72000],[75,'Blood Runes (Arceuus)',38000]],
  hunter:       [[1,'Polar Kebbits',5000],[29,'Orange Salamanders',30000],[53,'Black Chinchompas (Wilderness)',100000],[73,'Red Chinchompas (Ape Atoll)',75000]],
  construction: [[1,'Crude Wooden Chairs',30000],[52,'Oak Larders',480000],[74,'Mahogany Tables',900000],[77,'Mahogany Homes (AFK)',350000]],
  sailing:      [[1,'Coastal Voyages',10000],[30,'Island Hopping',30000],[60,'Deep Sea Expeditions',60000],[80,'Treasure Fleet Voyages',90000]],
};

function bestMethod(skillId, lvl) {
  const list = METHODS[skillId] || [[1,'Standard training',20000]];
  const avail = list.filter(([minLvl]) => lvl >= minLvl);
  return avail.length ? avail[avail.length - 1] : list[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile panel
// ─────────────────────────────────────────────────────────────────────────────
const PROFILES_KEY    = 'osts_profiles_v2';
const ACTIVE_PROF_KEY = 'osts_active_profile_v2';
const SP_ICONS  = { ironman:'🛡', hardcore:'💀', ultimate:'🔱', regular:'⚔', gim:'👥', ghcim:'☠', ugim:'👥' };
const SP_LABELS = { ironman:'Iron', hardcore:'HCIM', ultimate:'UIM', regular:'Regular', gim:'GIM', ghcim:'GHCIM', ugim:'UGIM' };

function norm(t) { return normalizeAccountType(t); }
function getProfiles() { return storage.get(PROFILES_KEY, []); }
function getActiveId() { return storage.get(ACTIVE_PROF_KEY, null); }
function setActiveId(id) { storage.set(ACTIVE_PROF_KEY, id); }

function renderProfilePanel() {
  const list     = document.getElementById('sp-profile-list');
  if (!list) return;
  const profiles = getProfiles();
  const activeId = getActiveId();
  if (!profiles.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted)">No saved profiles.<br>Go to <a href="overview.html" style="color:var(--gold)">Overview</a> to create one.</div>';
    return;
  }
  list.innerHTML = [...profiles]
    .sort((a, b) => (b.id === activeId) - (a.id === activeId))
    .map(p => `
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

document.getElementById('settings-btn')?.addEventListener('click', renderProfilePanel, true);

// ─────────────────────────────────────────────────────────────────────────────
// Load player
// ─────────────────────────────────────────────────────────────────────────────
async function loadPlayer(rsn, accountType) {
  if (!rsn) rsn = storage.get(STORAGE_KEYS.RSN, '');
  if (!rsn) return;
  if (!accountType) accountType = storage.get(STORAGE_KEYS.ACCOUNT_TYPE, 'ironman');
  setLoading(true); clearError();
  try {
    const data = await fetchPlayer(rsn, accountType);
    player.set(data);
    renderSkills(data);
    showToast('✅ ' + (data.displayName || rsn));
  } catch (err) { showError(err.message); }
  finally { setLoading(false); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Render skills grid
// ─────────────────────────────────────────────────────────────────────────────
function renderSkills(data) {
  const snap = data.latestSnapshot?.data?.skills || {};
  const grid = document.getElementById('skills-grid');
  document.getElementById('welcome-msg').style.display = 'none';
  grid.style.display = '';

  const ov    = snap.overall || {};
  const ovLvl = Number(ov.level || 0);
  const ovXp  = Number(ov.experience || 0);
  const ovRnk = ov.rank;

  // Overall full-width row
  const overallHtml = `
    <div class="skill-card-overall" data-skill="overall">
      <img class="ov-icon"
           src="https://oldschool.runescape.wiki/images/thumb/Skills_icon.png/80px-Skills_icon.png"
           alt="Overall" loading="lazy"
           onerror="this.style.display='none'">
      <div class="ov-stats">
        <div class="ov-stat"><span class="ov-lbl">Total Level</span><span class="ov-val">${fmtNum(ovLvl)}</span></div>
        <div class="ov-stat"><span class="ov-lbl">Total XP</span><span class="ov-val">${fmtXPLong(ovXp)}</span></div>
        <div class="ov-stat"><span class="ov-lbl">Rank</span><span class="ov-val">${fmtRank(ovRnk)}</span></div>
      </div>
    </div>`;

  // Individual skill cards (exclude overall)
  const skillHtml = SKILLS.filter(([id]) => id !== 'overall').map(([id, name, icon, color]) => {
    const s    = snap[id] || {};
    const xp   = Number(s.experience || 0);
    const lvl  = Number(s.level || xpToLevel(xp));
    const rnk  = s.rank;
    const prog = lvl >= 99 ? 1 : xpProgress(xp, lvl);

    return `<div class="skill-card" data-skill="${id}" style="border-top-color:${color}">
      <img class="sk-icon" src="${icon}" alt="${name}" loading="lazy"
           onerror="this.style.display='none'">
      <div class="sk-name">${name}</div>
      <div class="sk-lvl" style="color:${color}">${lvl || '—'}</div>
      <div class="sk-rank">${fmtRank(rnk)}</div>
      <div class="xp-bar-wrap">
        <div class="xp-bar-fill" style="width:${(prog*100).toFixed(1)}%;background:${color}"></div>
      </div>
    </div>`;
  }).join('');

  grid.innerHTML = overallHtml + skillHtml;

  grid.querySelectorAll('[data-skill]').forEach(card => {
    card.addEventListener('click', () => openSkillSheet(card.dataset.skill, data));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ring SVG helper
// ─────────────────────────────────────────────────────────────────────────────
function ringHtml(pct, color) {
  const R = 26, SZ = 64, CIRC = 2 * Math.PI * R;
  const offset = CIRC * (1 - Math.max(0, Math.min(1, pct / 100)));
  return `<div class="ring-wrap">
    <svg width="${SZ}" height="${SZ}" viewBox="0 0 ${SZ} ${SZ}">
      <circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--surface3)" stroke-width="5"/>
      <circle cx="32" cy="32" r="${R}" fill="none" stroke="${color}" stroke-width="5"
        stroke-linecap="round"
        stroke-dasharray="${CIRC.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"/>
    </svg>
    <div class="ring-label" style="color:${color}">
      ${Math.round(pct)}%
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// R2M Plan HTML
// ─────────────────────────────────────────────────────────────────────────────
function r2mPlanHtml(skillId, skillName, lvl, xp, xpTo99) {
  if (lvl >= 99) {
    return `<div class="r2m-plan">
      <div class="r2m-plan-title">🗺 Road to Max Plan</div>
      <div class="r2m-row"><span class="k">Status</span><span class="v" style="color:var(--green)">🏆 Level 99 — Maxed!</span></div>
    </div>`;
  }

  const [, methodName, xphr] = bestMethod(skillId, lvl);
  const xpNextLvl  = Math.max(0, xpForLevel(lvl + 1) - xp);
  const xpPerDay   = xphr * 2;
  const hoursTo99  = xpTo99 / xphr;
  const daysTo99   = hoursTo99 / 2;
  const finishDate = new Date(Date.now() + daysTo99 * 86400000)
    .toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

  return `<div class="r2m-plan">
    <div class="r2m-plan-title">🗺 Road to Max Plan</div>

    <div class="r2m-row"><span class="k">Level</span><span class="v">${lvl} → 99</span></div>
    <div class="r2m-row"><span class="k">XP to next level</span><span class="v">${fmtXPLong(xpNextLvl)}</span></div>
    <div class="r2m-row"><span class="k">XP to 99</span><span class="v">${fmtXPLong(xpTo99)}</span></div>

    <span class="r2m-sub">Best Method</span>
    <div class="r2m-row"><span class="k">Activity</span><span class="v" style="color:var(--gold)">${methodName}</span></div>
    <div class="r2m-row"><span class="k">XP / hr</span><span class="v" style="color:var(--gold)">${fmtXPLong(xphr)}</span></div>
    <div class="r2m-row"><span class="k">XP / day (2hr session)</span><span class="v" style="color:var(--gold)">${fmtXPLong(xpPerDay)}</span></div>

    <span class="r2m-sub">Timeline</span>
    <div class="r2m-row"><span class="k">Hours to 99</span><span class="v">${Math.ceil(hoursTo99)} hrs</span></div>
    <div class="r2m-row"><span class="k">Days to 99 (2hr/day)</span><span class="v">${Math.ceil(daysTo99)} days</span></div>
    <div class="r2m-row"><span class="k">Finish by</span><span class="v" style="color:var(--green)">${finishDate}</span></div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill sheet
// ─────────────────────────────────────────────────────────────────────────────
function openSkillSheet(skillId, data) {
  const found = SKILLS.find(s => s[0] === skillId);
  if (!found || !data) return;
  const [id, name, icon, color] = found;
  const snap = data.latestSnapshot?.data?.skills || {};

  // ── Overall sheet ──────────────────────────────────────────────────────────
  if (id === 'overall') {
    const ov     = snap.overall || {};
    const ovLvl  = Number(ov.level || 0);
    const ovXp   = Number(ov.experience || 0);
    const ovRnk  = ov.rank;

    const entries   = SKILLS.filter(([sid]) => sid !== 'overall').map(([sid]) => {
      const s = snap[sid] || {};
      return { xp: Number(s.experience || 0), lvl: Number(s.level || xpToLevel(Number(s.experience || 0))) };
    });
    const skillCount   = entries.length;
    const r2mTotal     = entries.reduce((s, e) => s + Math.min(e.lvl, 99), 0);
    const r2mXpSum     = entries.reduce((s, e) => s + Math.min(e.xp, XP_FOR_99), 0);
    const r2mPct       = (r2mXpSum / (XP_FOR_99 * skillCount)) * 100;
    const maxed        = entries.filter(e => e.lvl >= 99).length;
    const levelsNeeded = (skillCount * 99) - r2mTotal;

    document.getElementById('ss-name').textContent = 'Overall';
    document.getElementById('ss-desc').textContent = `Total Level ${fmtNum(ovLvl)} · ${fmtXPLong(ovXp)} XP`;
    document.getElementById('ss-icon').innerHTML   = `<img src="${icon}" alt="Overall" style="width:32px;height:32px;object-fit:contain">`;

    document.getElementById('ss-body').innerHTML = `
      <div class="sheet-section">
        <div class="sheet-section-title">Stats</div>
        <div class="detail-stats">
          <div class="dstat"><div class="dval" style="color:${color}">${fmtNum(ovLvl)}</div><div class="dlbl">Total Level</div></div>
          <div class="dstat"><div class="dval">${fmtXPLong(ovXp)}</div><div class="dlbl">Total XP</div></div>
          <div class="dstat"><div class="dval">${fmtRank(ovRnk)}</div><div class="dlbl">Rank</div></div>
          <div class="dstat"><div class="dval">${maxed}</div><div class="dlbl">Maxed</div></div>
        </div>
      </div>
      <div class="sheet-section">
        <div class="sheet-section-title">Road to Max</div>
        <div class="ring-row">
          ${ringHtml(r2mPct, color)}
          <div class="ring-stats">
            <div class="ring-stat"><span class="k">Current Total</span><span class="v gold">${fmtNum(r2mTotal)}</span></div>
            <div class="ring-stat"><span class="k">Max Total</span><span class="v">${fmtNum(skillCount * 99)}</span></div>
            <div class="ring-stat"><span class="k">Levels Needed</span><span class="v">${fmtNum(levelsNeeded)}</span></div>
            <div class="ring-stat"><span class="k">Maxed Skills</span><span class="v green">${maxed}/${skillCount}</span></div>
          </div>
        </div>
        <div class="sh-prog-wrap">
          <div class="sh-prog-fill" style="width:${r2mPct.toFixed(1)}%;background:${color}"></div>
        </div>
        <div class="sh-prog-labels">
          <span>${r2mPct.toFixed(1)}% complete</span>
          <span>${fmtXPLong(XP_FOR_99 * skillCount - r2mXpSum)} XP remaining</span>
        </div>
      </div>`;

    openSheet();
    return;
  }

  // ── Individual skill sheet ─────────────────────────────────────────────────
  const s       = snap[id] || {};
  const xp      = Number(s.experience || 0);
  const lvl     = Number(s.level || xpToLevel(xp));
  const rnk     = s.rank;
  const xpTo99  = Math.max(0, XP_FOR_99 - xp);
  const r2mPct  = (xp / XP_FOR_99) * 100;
  const nextReq = lvl >= 99 ? 0 : Math.max(0, xpForLevel(lvl + 1) - xp);
  const inLvl   = lvl >= 99 ? 0 : Math.max(0, xp - xpForLevel(lvl));
  const lvlSpan = lvl >= 99 ? 1 : Math.max(1, xpForLevel(lvl + 1) - xpForLevel(lvl));
  const lvlPct  = lvl >= 99 ? 100 : (xpProgress(xp, lvl) * 100);

  document.getElementById('ss-name').textContent = name;
  document.getElementById('ss-desc').textContent = `Level ${lvl} · ${fmtXPLong(xp)} XP`;
  document.getElementById('ss-icon').innerHTML   = icon
    ? `<img src="${icon}" alt="${name}" style="width:32px;height:32px;object-fit:contain">` : '';

  document.getElementById('ss-body').innerHTML = `
    <div class="sheet-section">
      <div class="sheet-section-title">Stats</div>
      <div class="detail-stats">
        <div class="dstat"><div class="dval" style="color:${color}">${lvl}</div><div class="dlbl">Level</div></div>
        <div class="dstat"><div class="dval">${fmtXPLong(xp)}</div><div class="dlbl">Total XP</div></div>
        <div class="dstat"><div class="dval">${fmtRank(rnk)}</div><div class="dlbl">Rank</div></div>
        <div class="dstat"><div class="dval" style="color:var(--blue)">${lvl >= 99 ? 'MAX' : fmtXPLong(nextReq)}</div><div class="dlbl">To Next Lvl</div></div>
      </div>
    </div>

    <div class="sheet-section">
      <div class="sheet-section-title">Road to 99</div>
      <div class="ring-row">
        ${ringHtml(r2mPct, color)}
        <div class="ring-stats">
          <div class="ring-stat"><span class="k">Current XP</span><span class="v">${fmtXPLong(xp)}</span></div>
          <div class="ring-stat"><span class="k">XP to 99</span><span class="v gold">${lvl >= 99 ? 'MAX' : fmtXPLong(xpTo99)}</span></div>
          <div class="ring-stat"><span class="k">Progress</span><span class="v gold">${r2mPct.toFixed(1)}%</span></div>
          <div class="ring-stat"><span class="k">Status</span><span class="v green">${lvl >= 99 ? '🏆 Maxed' : 'Level ' + lvl}</span></div>
        </div>
      </div>
      <div class="sh-prog-wrap">
        <div class="sh-prog-fill" style="width:${Math.min(100, r2mPct).toFixed(1)}%;background:${color}"></div>
      </div>
      <div class="sh-prog-labels">
        <span>${r2mPct.toFixed(1)}% to 99</span>
        <span>${fmtXPLong(XP_FOR_99)} XP needed</span>
      </div>
    </div>

    ${r2mPlanHtml(id, name, lvl, xp, xpTo99)}`;

  openSheet();
}

// Longhand XP formatter: 3900000 → "3,900,000"
function fmtXPLong(n) {
  return Number(n || 0).toLocaleString('en-GB');
}

function openSheet() {
  document.getElementById('skill-sheet-overlay').classList.add('show');
  requestAnimationFrame(() => document.getElementById('skill-sheet').classList.add('show'));
}
function closeSheet() {
  const sheet = document.getElementById('skill-sheet');
  sheet.style.transition = '';
  sheet.style.transform = '';
  sheet.classList.remove('show');
  document.getElementById('skill-sheet-overlay').classList.remove('show');
}

document.getElementById('ss-close').addEventListener('click', closeSheet);
document.getElementById('skill-sheet-overlay').addEventListener('click', closeSheet);

// ─── Drag-down + horizontal swipe to close ────────────────────────────────
(function attachSheetGestures() {
  const sheet    = document.getElementById('skill-sheet');
  const dragZone = sheet; // full sheet — activates when touch starts in top 80px
  let startX = 0, startY = 0, dragY = 0, dragX = 0, active = false, dir = null;

  dragZone.addEventListener('touchstart', e => {
    // Only activate drag if touch starts within the top 80px of the sheet
    const sheetTop = sheet.getBoundingClientRect().top;
    if (e.touches[0].clientY - sheetTop > 80) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragY = dragX = 0; dir = null; active = true;
    sheet.style.transition = 'none';
  }, { passive: true });

  window.addEventListener('touchmove', e => {
    if (!active) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    if (!dir) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) dir = 'h';
      else if (Math.abs(dy) > 8) dir = 'v';
    }
    if (dir === 'v') { dragY = Math.max(0, dy); sheet.style.transform = `translateY(${dragY}px)`; }
    else if (dir === 'h') { dragX = dx; sheet.style.transform = `translateX(${dragX}px)`; }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    sheet.style.transition = 'transform .3s cubic-bezier(.25,.8,.25,1)';
    if ((dir === 'v' && dragY > 100) || (dir === 'h' && Math.abs(dragX) > 120)) {
      closeSheet();
    } else {
      sheet.style.transform = 'translateY(0)';
    }
    dragY = dragX = 0; dir = null;
  });
})();

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────
function setLoading(on) { document.getElementById('loader').classList.toggle('loading', on); }
function clearError() {
  const el = document.getElementById('error-msg');
  el.textContent = ''; el.classList.remove('show');
}
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg; el.classList.add('show');
  document.getElementById('welcome-msg').style.display = '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
const cached = player.getFromCache();
if (cached) {
  renderSkills(cached);
} else {
  const lastRsn = storage.get(STORAGE_KEYS.RSN, '');
  if (lastRsn) loadPlayer(lastRsn);
}
