  import {
    initPage, fetchPlayer, player, wom, settings, showToast, storage,
    STORAGE_KEYS, SKILLS, SKILL_MAP, fmtXP, fmtRank,
    xpForLevel, xpProgress, normalizeAccountType,
  } from '/src/app/shared.js';

  initPage('gains');

  let currentPeriod    = 'week';
  let currentRsn       = '';
  let currentGainsData = null;   // full gains API response
  let chartTimeline    = null;
  let chartLevels      = null;
  let chartSkillSheet  = null;   // chart inside the popup
  let chartDonut       = null;
  let chartRadar       = null;

  const PERIOD_LABELS = { day: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' };
  const PERIOD_DAYS   = { day: 1,       week: 7,           month: 30,           year: 365 };

  // ── Profile system ──────────────────────────────────────────────────────────
  const PROFILES_KEY    = 'osts_profiles_v2';
  const ACTIVE_PROF_KEY = 'osts_active_profile_v2';
  const SP_ICONS  = { ironman:'🛡', hardcore:'💀', ultimate:'🔱', regular:'⚔', gim:'👥', ghcim:'☠', ugim:'👥' };
  const SP_LABELS = { ironman:'Iron', hardcore:'HCIM', ultimate:'UIM', regular:'Regular', gim:'GIM', ghcim:'GHCIM', ugim:'UGIM' };

  function norm(t) { return normalizeAccountType(t); }
  function getProfiles()  { return storage.get(PROFILES_KEY, []); }
  function getActiveId()  { return storage.get(ACTIVE_PROF_KEY, null); }
  function setActiveId(id){ storage.set(ACTIVE_PROF_KEY, id); }

  function renderProfilePanel() {
    const list = document.getElementById('sp-profile-list');
    if (!list) return;
    const profiles = getProfiles();
    const activeId = getActiveId();
    if (!profiles.length) {
      list.innerHTML = '<div style="font-size:12px;color:var(--muted)">No saved profiles.<br>Go to <a href="/index.html" style="color:var(--gold)">Overview</a> to create one.</div>';
      return;
    }
    list.innerHTML = [...profiles]
      .sort((a,b) => (b.id === activeId) - (a.id === activeId))
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

  // ── Period tabs ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      document.getElementById('period-badge').textContent = PERIOD_LABELS[currentPeriod];
      closeGainSheet();
      if (currentRsn) loadGains(currentRsn, currentPeriod);
    });
  });

  // ── Load player ─────────────────────────────────────────────────────────────
  async function loadPlayer(rsn, accountType) {
    if (!rsn) rsn = storage.get(STORAGE_KEYS.RSN, '');
    if (!rsn) return;
    if (!accountType) accountType = storage.get(STORAGE_KEYS.ACCOUNT_TYPE, 'ironman');
    setLoading(true); clearError();
    try {
      const data = await fetchPlayer(rsn, accountType);
      player.set(data);
      currentRsn = data.displayName || data.username || rsn;
      document.getElementById('player-name-header').textContent = ' — ' + currentRsn;
      renderLevelsChart(data);
      renderRadarChart(data);
      await loadGains(currentRsn, currentPeriod);
      showToast('✅ ' + currentRsn);
    } catch (err) { showError(err.message); }
    finally { setLoading(false); }
  }

  async function loadGains(rsn, period) {
    setLoading(true);
    try {
      const gains = await wom.getGains(rsn, period);
      currentGainsData = gains;
      renderGains(gains);
      document.getElementById('gains-content').style.display = '';
      document.getElementById('welcome-msg').style.display   = 'none';
      loadOverviewTimeline(rsn, period);
    } catch (err) { showError('Could not load gains: ' + err.message); }
    finally { setLoading(false); }
  }

  // ── Render gain cards ───────────────────────────────────────────────────────
  function renderGains(data) {
    const skills = data?.data?.skills;
    const grid   = document.getElementById('gains-grid');

    if (!skills) {
      grid.innerHTML = '<div class="no-data" style="grid-column:span 3">No gains data for this period.</div>';
      return;
    }

    const entries = SKILLS.filter(([id]) => id !== 'overall').map(([id, name, icon, color]) => {
      const g = skills[id] || {};
      const gained      = Number(g.experience?.gained || 0);
      const xpStart     = Number(g.experience?.start  || 0);
      const xpEnd       = Number(g.experience?.end    || 0);
      const lvlStart    = Number(g.level?.start  || 0);
      const lvlEnd      = Number(g.level?.end    || 0);
      const lvlGain     = Math.max(0, lvlEnd - lvlStart);
      const rankStart   = Number(g.rank?.start   || 0);
      const rankEnd     = Number(g.rank?.end     || 0);
      const rankGained  = Number(g.rank?.gained  || 0); // negative = improved
      return { id, name, icon, color, gained, xpStart, xpEnd, lvlStart, lvlEnd, lvlGain, rankStart, rankEnd, rankGained };
    }).filter(e => e.gained > 0).sort((a, b) => b.gained - a.gained);

    if (!entries.length) {
      grid.innerHTML = '<div class="no-data" style="grid-column:span 3">No XP gains in this period.</div>';
      return;
    }

    // Total gained this period (for % calculation)
    const totalGained = entries.reduce((s, e) => s + e.gained, 0);

    grid.innerHTML = entries.map(e => {
      const lvlBadge = e.lvlGain > 0
        ? `<div class="gc-lvl">+${e.lvlGain} lvl${e.lvlGain > 1 ? 's' : ''}</div>`
        : `<div class="gc-lvl no-lvl">Lvl ${e.lvlEnd}</div>`;
      const shortName = e.name.length > 9 ? e.name.slice(0, 8) + '…' : e.name;
      return `
      <div class="gain-card" data-skill="${e.id}" style="--gc-color:${e.color}">
        <img class="gc-icon" src="${e.icon}" alt="${e.name}" loading="lazy"
             onerror="this.style.display='none'">
        <div class="gc-name">${shortName}</div>
        ${lvlBadge}
        <div class="gc-xp">+${fmtXPLong(e.gained)}</div>
      </div>`;
    }).join('');

    // Tap → open detail sheet
    grid.querySelectorAll('.gain-card').forEach(card => {
      card.addEventListener('click', () => {
        const skillId = card.dataset.skill;
        const entry   = entries.find(e => e.id === skillId);
        if (entry) openGainSheet(entry, totalGained);
      });
    });

    // Donut — XP breakdown for this period
    renderDonutChart(entries);
  }

  // ── Gain Detail Sheet ───────────────────────────────────────────────────────
  function openGainSheet(entry, totalGained) {
    const { id, name, icon, color, gained, xpStart, xpEnd, lvlStart, lvlEnd, lvlGain, rankGained } = entry;

    // ── Derived stats ──
    const days      = PERIOD_DAYS[currentPeriod];
    const xpPerDay  = gained > 0 ? Math.round(gained / days) : 0;
    const pct       = totalGained > 0 ? ((gained / totalGained) * 100).toFixed(1) : '0.0';

    // Rank change display (negative = improved = good)
    const rankDelta = rankGained;
    const rankStr   = rankDelta < 0 ? `▲ ${fmtXP(Math.abs(rankDelta))}` :
                      rankDelta > 0 ? `▼ ${fmtXP(rankDelta)}` : '—';
    const rankColor = rankDelta < 0 ? 'var(--green)' : rankDelta > 0 ? 'var(--red)' : 'var(--muted)';

    // Level progress using end-of-period XP
    const isMaxed  = lvlEnd >= 99;
    const nextLvl  = Math.min(lvlEnd + 1, 99);
    const xpToNext = isMaxed ? 0 : Math.max(0, xpForLevel(nextLvl) - xpEnd);
    const inLevel  = isMaxed ? 0 : Math.max(0, xpEnd - xpForLevel(lvlEnd));
    const lvlSpan  = isMaxed ? 1 : Math.max(1, xpForLevel(nextLvl) - xpForLevel(lvlEnd));
    const barPct   = isMaxed ? 100 : Math.min(100, (inLevel / lvlSpan) * 100);

    // Time to 99 at current rate
    let timeTo99Html = '';
    if (!isMaxed && xpPerDay > 0) {
      const xpTo99   = Math.max(0, xpForLevel(99) - xpEnd);
      const daysTo99 = Math.ceil(xpTo99 / xpPerDay);
      if (daysTo99 < 3650) {
        const label = daysTo99 >= 365 ? `${(daysTo99 / 365).toFixed(1)}y` :
                      daysTo99 >= 30  ? `${Math.round(daysTo99 / 30)}mo`  :
                                        `${daysTo99}d`;
        timeTo99Html = `<div class="gs-chip good">🏆 ${label} to 99</div>`;
      }
    }

    // ── Populate header ──
    document.getElementById('gs-name').textContent  = name;
    document.getElementById('gs-desc').textContent  = lvlGain > 0
      ? `+${lvlGain} level${lvlGain > 1 ? 's' : ''} · Lvl ${lvlStart} → ${lvlEnd}`
      : `Lvl ${lvlEnd} · No level up`;
    document.getElementById('gs-icon').innerHTML = icon
      ? `<img src="${icon}" alt="${name}" style="width:32px;height:32px;object-fit:contain">` : '';

    // ── Populate body ──
    document.getElementById('gs-body').innerHTML = `

      <!-- Row 1: Core gains -->
      <div class="detail-stats" style="margin-bottom:10px">
        <div class="dstat">
          <div class="dval" style="color:${color}">+${fmtXPLong(gained)}</div>
          <div class="dlbl">XP Gained</div>
        </div>
        <div class="dstat">
          <div class="dval" style="color:var(--green)">${lvlGain > 0 ? '+' + lvlGain : '—'}</div>
          <div class="dlbl">Lvls Gained</div>
        </div>
        <div class="dstat">
          <div class="dval">${lvlStart || '—'}</div>
          <div class="dlbl">Start Lvl</div>
        </div>
        <div class="dstat">
          <div class="dval">${lvlEnd || '—'}</div>
          <div class="dlbl">End Lvl</div>
        </div>
      </div>

      <!-- Row 2: XP snapshots + rank -->
      <div class="detail-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
        <div class="dstat">
          <div class="dval" style="font-size:11px">${fmtXPLong(xpStart)}</div>
          <div class="dlbl">Start XP</div>
        </div>
        <div class="dstat">
          <div class="dval" style="font-size:11px">${fmtXPLong(xpEnd)}</div>
          <div class="dlbl">End XP</div>
        </div>
        <div class="dstat">
          <div class="dval" style="color:${rankColor};font-size:13px">${rankStr}</div>
          <div class="dlbl">Rank Δ</div>
        </div>
      </div>

      <!-- Rate / share / time chips -->
      <div class="gs-chips">
        <div class="gs-chip">📈 +${fmtXPLong(xpPerDay)}/day</div>
        <div class="gs-chip gold">🎯 ${pct}% of period XP</div>
        ${timeTo99Html}
      </div>

      <!-- XP progress bar toward next level -->
      ${isMaxed
        ? `<div style="text-align:center;font-size:12px;color:var(--gold);font-weight:700;padding:4px 0 14px">⭐ MAX LEVEL (99)</div>`
        : `<div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:6px">
              <span>Progress to Level ${nextLvl}</span>
              <span>${barPct.toFixed(1)}%</span>
            </div>
            <div class="progress-wrap">
              <div class="progress-fill" style="width:${barPct.toFixed(1)}%;background:${color}"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:5px">
              <span>${fmtXPLong(inLevel)} in level</span>
              <span>${fmtXPLong(xpToNext)} to go</span>
            </div>
          </div>`}

      <!-- Individual skill heatmap -->
      <div class="chart-section" style="margin-bottom:12px">
        <h3>Activity Heatmap</h3>
        <div id="sheet-heatmap" class="heatmap-container">
          <div class="heatmap-loading"><div class="spinner"></div> Loading…</div>
        </div>
        <div class="heatmap-legend">
          <span>Less</span>
          <div class="hm-legend-cells" id="sheet-heatmap-legend"></div>
          <span>More</span>
        </div>
      </div>

      <!-- Individual XP over time chart -->
      <div class="chart-section" style="margin-bottom:0">
        <h3>XP Over Time</h3>
        <div id="sheet-chart-wrap" class="chart-wrap">
          <div class="sheet-chart-loading">
            <div class="spinner"></div> Loading chart…
          </div>
        </div>
      </div>
    `;

    // Open the sheet
    document.getElementById('gain-sheet-overlay').classList.add('show');
    requestAnimationFrame(() => document.getElementById('gain-sheet').classList.add('show'));

    // Fetch and render this skill's timeline
    if (currentRsn) loadSkillTimeline(currentRsn, id, currentPeriod, color);
  }

  function closeGainSheet() {
    document.getElementById('gain-sheet').classList.remove('show');
    document.getElementById('gain-sheet-overlay').classList.remove('show');
    if (chartSkillSheet) { chartSkillSheet.destroy(); chartSkillSheet = null; }
  }

  document.getElementById('gs-close').addEventListener('click', closeGainSheet);
  document.getElementById('gain-sheet-overlay').addEventListener('click', closeGainSheet);

  // ── Drag to close ────────────────────────────────────────────────────────────
  makeDraggable(document.getElementById('gain-sheet'), closeGainSheet);

  // ── Skill timeline (inside popup) ───────────────────────────────────────────
  async function loadSkillTimeline(rsn, skillId, period, color) {
    try {
      const timeline = await wom.getTimeline(rsn, skillId, period);
      renderHeatmap('sheet-heatmap', 'sheet-heatmap-legend', timeline, color);
      renderSkillChart(timeline, color);
    } catch (err) {
      const wrap = document.getElementById('sheet-chart-wrap');
      if (wrap) wrap.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--muted)">Chart data unavailable</div>';
      const hm = document.getElementById('sheet-heatmap');
      if (hm) hm.innerHTML = '';
    }
  }

  function renderSkillChart(timeline, color) {
    const wrap = document.getElementById('sheet-chart-wrap');
    if (!wrap) return;

    // Destroy old chart
    if (chartSkillSheet) { chartSkillSheet.destroy(); chartSkillSheet = null; }

    if (!timeline?.length || timeline.length < 2) {
      wrap.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--muted)">Not enough data for this period</div>';
      return;
    }

    const points = timeline.map(p => ({
      x: new Date(p.date),
      y: p.value,
    })).filter(p => p.y !== null && !isNaN(p.y));

    if (points.length < 2) {
      wrap.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--muted)">Not enough data for this period</div>';
      return;
    }

    const labels = points.map(p => p.x.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));
    const values = points.map(p => p.y);

    // Swap loading spinner for canvas
    wrap.innerHTML = '<canvas id="chart-skill-sheet" height="160"></canvas>';
    const canvas   = document.getElementById('chart-skill-sheet');

    chartSkillSheet = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 2,
          pointRadius: 3,
          fill: true,
          tension: .35,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: '#8b949e', font: { size: 9 }, maxTicksLimit: 7 },
            grid:  { color: '#21262d' },
          },
          y: {
            ticks: {
              color: '#8b949e',
              callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v,
            },
            grid: { color: '#21262d' },
          },
        },
      },
    });
  }

  // ── Overview timeline (main page, always overall) ───────────────────────────
  async function loadOverviewTimeline(rsn, period) {
    try {
      const timeline = await wom.getTimeline(rsn, 'overall', period);
      renderOverviewChart(timeline);
      renderHeatmap('heatmap-overall', 'heatmap-legend-cells', timeline, '#b88848');
    } catch (err) {
      console.warn('[OSTS] Overview timeline failed:', err.message);
    }
  }

  function renderOverviewChart(timeline) {
    const canvas = document.getElementById('chart-timeline');
    if (!canvas) return;
    if (chartTimeline) { chartTimeline.destroy(); chartTimeline = null; }

    if (!timeline?.length || timeline.length < 2) return;

    const points = timeline.map(p => ({
      x: new Date(p.date),
      y: p.value,
    })).filter(p => p.y !== null && !isNaN(p.y));

    if (points.length < 2) return;

    const labels = points.map(p => p.x.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }));
    const values = points.map(p => p.y);

    chartTimeline = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: '#b88848',
          backgroundColor: '#b8884822',
          borderWidth: 2,
          pointRadius: 3,
          fill: true,
          tension: .35,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: '#8b949e', font: { size: 9 }, maxTicksLimit: 7 },
            grid:  { color: '#21262d' },
          },
          y: {
            ticks: {
              color: '#8b949e',
              callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v,
            },
            grid: { color: '#21262d' },
          },
        },
      },
    });
  }

  // ── Current skill levels bar chart ──────────────────────────────────────────
  function renderLevelsChart(data) {
    const canvas = document.getElementById('chart-levels');
    if (!canvas) return;
    if (chartLevels) { chartLevels.destroy(); chartLevels = null; }

    const snap   = data.latestSnapshot?.data?.skills || {};
    const skills = SKILLS.filter(([id]) => id !== 'overall');

    chartLevels = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: skills.map(([, n]) => n),
        datasets: [{
          data: skills.map(([id]) => Number(snap[id]?.level || 0)),
          backgroundColor: skills.map(([,,,c]) => c + '66'),
          borderColor:     skills.map(([,,,c]) => c),
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8b949e', font: { size: 8 } }, grid: { color: '#21262d' } },
          y: { min: 0, max: 99, ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        },
      },
    });
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────
  function setLoading(on) { document.getElementById('loader').classList.toggle('loading', on); }
  function clearError()   { const e = document.getElementById('error-msg'); e.textContent=''; e.classList.remove('show'); }
  function showError(msg) { const e = document.getElementById('error-msg'); e.textContent=msg; e.classList.add('show'); }

  // ── Heatmap ──────────────────────────────────────────────────────────────────
  function renderHeatmap(containerId, legendId, timeline, color) {
    const container = document.getElementById(containerId);
    const legendEl  = document.getElementById(legendId);
    if (!container) return;

    if (!timeline?.length || timeline.length < 2) {
      container.innerHTML = '<div style="text-align:center;padding:16px;font-size:12px;color:var(--muted)">Not enough data</div>';
      return;
    }

    // Convert cumulative XP to daily gains
    const daily = [];
    for (let i = 1; i < timeline.length; i++) {
      const diff = Number(timeline[i].value) - Number(timeline[i-1].value);
      daily.push({ date: new Date(timeline[i].date), xp: Math.max(0, diff) });
    }

    const maxXP = Math.max(...daily.map(d => d.xp), 1);
    const isYear = daily.length > 60;

    // Build legend
    if (legendEl) {
      legendEl.innerHTML = [0.1, 0.3, 0.55, 0.75, 1].map(t => {
        const hex = Math.round(t * 220).toString(16).padStart(2, '0');
        return `<div class="hm-cell hm-cell-sm" style="background:${color}${hex}"></div>`;
      }).join('');
    }

    if (isYear) {
      // GitHub-style: 7 rows (days of week), columns = weeks
      // Pad start so day 0 lands on its correct weekday
      const firstDay = daily[0].date.getDay(); // 0=Sun
      const padCount = firstDay; // Sun=0 → no pad; Mon=1 → 1 empty cell etc.

      const cells = [];
      for (let i = 0; i < padCount; i++) cells.push('<div class="hm-cell hm-cell-sm hm-empty"></div>');
      for (const d of daily) {
        const intensity = d.xp / maxXP;
        const alpha = d.xp === 0 ? '18' : Math.round(30 + intensity * 200).toString(16).padStart(2, '0');
        const label = d.date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) + ': +' + fmtXPLong(d.xp) + ' XP';
        cells.push(`<div class="hm-cell hm-cell-sm" style="background:${color}${alpha}" title="${label}"></div>`);
      }

      container.innerHTML = `<div class="heatmap-year">${cells.join('')}</div>`;
    } else {
      // Row of labelled cells for day/week/month
      const cells = daily.map(d => {
        const intensity = d.xp / maxXP;
        const alpha = d.xp === 0 ? '18' : Math.round(30 + intensity * 200).toString(16).padStart(2, '0');
        const label = d.date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
        const shortLbl = daily.length <= 7
          ? d.date.toLocaleDateString('en-GB', { weekday: 'short' })
          : d.date.toLocaleDateString('en-GB', { day: 'numeric' });
        return `
          <div class="hm-col">
            <div class="hm-cell hm-cell-lg" style="background:${color}${alpha}"
              title="${label}: +${fmtXPLong(d.xp)} XP"></div>
            <div class="hm-date">${shortLbl}</div>
          </div>`;
      });
      container.innerHTML = `<div class="heatmap-row">${cells.join('')}</div>`;
    }
  }

  // ── Donut — period XP breakdown ──────────────────────────────────────────────
  function renderDonutChart(entries) {
    const canvas = document.getElementById('chart-donut');
    if (!canvas || !entries?.length) return;
    if (chartDonut) { chartDonut.destroy(); chartDonut = null; }

    // Top 8 by XP, rest grouped as "Other"
    const sorted = [...entries].sort((a, b) => b.gained - a.gained);
    const top    = sorted.slice(0, 8);
    const rest   = sorted.slice(8);
    const restXP = rest.reduce((s, e) => s + e.gained, 0);

    const labels = top.map(e => e.name);
    const values = top.map(e => e.gained);
    const colors = top.map(e => e.color);

    if (restXP > 0) { labels.push('Other'); values.push(restXP); colors.push('#555'); }

    chartDonut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.map(c => c + 'cc'),
          borderColor:     colors,
          borderWidth: 1.5,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        cutout: '62%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: '#8b949e',
              font: { size: 10 },
              boxWidth: 10,
              padding: 8,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${fmtXPLong(ctx.parsed)} XP (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  // ── Radar — skill level profile ──────────────────────────────────────────────
  function renderRadarChart(data) {
    const canvas = document.getElementById('chart-radar');
    if (!canvas) return;
    if (chartRadar) { chartRadar.destroy(); chartRadar = null; }

    const snap   = data.latestSnapshot?.data?.skills || {};
    const skills = SKILLS.filter(([id]) => id !== 'overall');
    const levels = skills.map(([id]) => Number(snap[id]?.level || 1));

    chartRadar = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: skills.map(([, n]) => n),
        datasets: [{
          label: 'Level',
          data: levels,
          backgroundColor: 'rgba(184,136,72,0.15)',
          borderColor: '#b88848',
          borderWidth: 2,
          pointBackgroundColor: skills.map(([,,,c]) => c),
          pointBorderColor: '#0000',
          pointRadius: 3,
          pointHoverRadius: 5,
        }],
      },
      options: {
        responsive: true,
        scales: {
          r: {
            min: 0,
            max: 99,
            ticks: {
              stepSize: 33,
              color: '#8b949e',
              font: { size: 8 },
              backdropColor: 'transparent',
            },
            grid:        { color: '#21262d' },
            angleLines:  { color: '#21262d' },
            pointLabels: { color: '#8b949e', font: { size: 9 } },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  // ── Drag-to-close ─────────────────────────────────────────────────────────────
  function makeDraggable(sheetEl, closeFn) {
    let startY = 0, dragY = 0, active = false;

    // Attach to whole sheet — activates only when touch starts in top 80px
    sheetEl.addEventListener('touchstart', e => {
      const sheetTop = sheetEl.getBoundingClientRect().top;
      if (e.touches[0].clientY - sheetTop > 80) return;
      startY = e.touches[0].clientY;
      dragY = 0; active = true;
      sheetEl.style.transition = 'none';
    }, { passive: true });

    window.addEventListener('touchmove', e => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      dragY = Math.max(0, dy);
      sheetEl.style.transform = `translateY(${dragY}px)`;
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (!active) return;
      active = false;
      sheetEl.style.transition = '';
      if (dragY > 100) {
        sheetEl.style.transform = 'translateY(110%)';
        setTimeout(() => {
          closeFn();
          sheetEl.style.transform = '';
        }, 320);
      } else {
        sheetEl.style.transform = '';
      }
      dragY = 0;
    });
  }

  // Longhand XP formatter: 3900000 → "3,900,000"
  function fmtXPLong(n) {
    return Number(n || 0).toLocaleString('en-GB');
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  const cached = player.getFromCache();
  if (cached) {
    currentRsn = cached.displayName || cached.username || '';
    if (currentRsn) document.getElementById('player-name-header').textContent = ' — ' + currentRsn;
    renderLevelsChart(cached);
    renderRadarChart(cached);
    if (currentRsn) loadGains(currentRsn, currentPeriod);
  } else {
    const lastRsn = storage.get(STORAGE_KEYS.RSN, '');
    if (lastRsn) loadPlayer(lastRsn);
  }
