import { initPage, storage, showToast, settings } from '/src/app/shared.js';

// ─── Constants ─────────────────────────────────────────────────────────────────
const API    = 'https://prices.runescape.wiki/api/v1/osrs/';
const IMG    = 'https://oldschool.runescape.wiki/images/';
const GE_URL = 'https://secure.runescape.com/m=itemdb_oldschool/viewitem?obj=';
const STORE_KEY_WATCH = 'osts_ge_watchlist_v2';
const STORE_KEY_RECENT= 'osts_ge_recent_v2';

// ─── State ─────────────────────────────────────────────────────────────────────
let itemMap   = new Map();   // id → {name,icon,limit,highalch,lowalch,value,members,examine}
let nameIndex = [];          // [{id,name,lower}] sorted for search
let prices    = new Map();   // id → {high,low,highTime,lowTime}
let hourly    = new Map();   // id → {avgHighPrice,avgLowPrice,highPriceVolume,lowPriceVolume}
let watchlist = new Set(storage.get(STORE_KEY_WATCH, []));
let recentIds = storage.get(STORE_KEY_RECENT, []);

let activeTab   = 'market';
let moversMode  = 'rising';  // rising | falling | flips
let searchQ     = '';
let lastUpdated = null;
let refreshTimer = null;
let currentItemId= null;
let chartStep   = '1h';

// ─── Fetch helpers ─────────────────────────────────────────────────────────────
async function apiFetch(endpoint) {
  const r = await fetch(API + endpoint, { headers:{ Accept:'application/json' } });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

// ─── Format helpers ────────────────────────────────────────────────────────────
const fmtGP  = n => n == null ? '—' : (n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toLocaleString('en-GB'));
const fmtFull= n => n == null ? '—' : n.toLocaleString('en-GB') + ' gp';
const fmtPct = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const fmtTime= ts => { const d=Math.floor((Date.now()-ts*1000)/1000); return d<60?`${d}s ago`:d<3600?`${Math.floor(d/60)}m ago`:`${Math.floor(d/3600)}h ago`; };
const imgUrl = icon => icon ? IMG + icon.replace(/ /g,'_') : '';
const h      = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function pctChange(current, avg) {
  if (!current || !avg || avg === 0) return null;
  return ((current - avg) / avg) * 100;
}

// ─── Load all data ──────────────────────────────────────────────────────────────
async function loadData() {
  showLoader();
  try {
    // Parallel: mapping + latest + 1h
    const [mapData, latestData, hourlyData] = await Promise.all([
      apiFetch('mapping'),
      apiFetch('latest'),
      apiFetch('1h'),
    ]);

    itemMap.clear(); nameIndex = [];
    for (const item of mapData) {
      itemMap.set(item.id, item);
      nameIndex.push({ id: item.id, name: item.name, lower: item.name.toLowerCase() });
    }
    nameIndex.sort((a,b) => a.lower.localeCompare(b.lower));

    prices.clear();
    for (const [id, v] of Object.entries(latestData.data || {})) {
      prices.set(+id, v);
    }

    hourly.clear();
    for (const [id, v] of Object.entries(hourlyData.data || {})) {
      hourly.set(+id, v);
    }

    lastUpdated = Date.now();
    renderContent();
  } catch(e) {
    console.error('[OSTS GE] Load failed:', e);
    document.getElementById('ge-content').innerHTML = `
      <div style="text-align:center;padding:48px 20px;color:var(--muted)">
        <div style="font-size:36px;margin-bottom:12px">⚠️</div>
        Failed to load market data.<br>
        <span style="font-size:11px;opacity:.6;display:block;margin:6px 0 12px">${h(e.message || 'Network error')}</span>
        <button onclick="loadData()" style="padding:8px 20px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--gold);cursor:pointer;font-weight:700">Retry</button>
      </div>`;
  }
}

async function refreshPrices() {
  try {
    const [latestData, hourlyData] = await Promise.all([
      apiFetch('latest'),
      apiFetch('1h'),
    ]);
    prices.clear();
    for (const [id, v] of Object.entries(latestData.data || {})) prices.set(+id, v);
    hourly.clear();
    for (const [id, v] of Object.entries(hourlyData.data || {})) hourly.set(+id, v);
    lastUpdated = Date.now();
    renderContent();
  } catch {}
}

function showLoader() {
  document.getElementById('ge-content').innerHTML = `
    <div class="ge-loader">
      <div class="ge-spinner"></div>
      <div class="ge-loader-text">Loading market data…</div>
    </div>`;
}

// ─── Render content (switches based on activeTab) ────────────────────────────
function renderContent() {
  if (activeTab === 'market')    renderMarket();
  else if (activeTab === 'search')   renderSearch();
  else if (activeTab === 'alch')     renderAlch();
  else if (activeTab === 'watchlist') renderWatchlist();
}

// ─── ALCH TAB ─────────────────────────────────────────────────────────────────
let alchFilter = 'profitable'; // profitable | all | nat_cost

function renderAlch() {
  const el = document.getElementById('ge-content');
  if (prices.size === 0) { showLoader(); return; }

  // Nature rune price (id 561)
  const natPrice = prices.get(561)?.high || prices.get(561)?.low || 200;

  // Build alch list
  const list = [];
  for (const [id, item] of itemMap) {
    if (!item.highalch || item.highalch <= 1) continue;
    const p = prices.get(id);
    if (!p?.high && !p?.low) continue;
    const buyPrice = p.low || p.high; // cheapest buy = insta-sell (what others sell for)
    const profit   = item.highalch - buyPrice - natPrice;
    const roi      = ((profit / buyPrice) * 100);
    const profitInv= profit * 28; // per inventory of 28
    list.push({ id, item, buyPrice, profit, roi, profitInv, natPrice });
  }

  let filtered = list;
  if (alchFilter === 'profitable') filtered = list.filter(x => x.profit > 0);
  if (alchFilter === 'nat_cost')   filtered = list.filter(x => x.profit > natPrice);

  filtered.sort((a,b) => b.profit - a.profit);
  const shown = filtered.slice(0, 60);

  el.innerHTML = `
    <!-- Nat rune chip + filter chips on same row -->
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px">
      <!-- Live nature rune price chip -->
      <div style="flex-shrink:0;display:flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--gold);border-radius:999px;padding:5px 11px;cursor:pointer" data-id="561" class="ge-nat-chip">
        <img src="${imgUrl(itemMap.get(561)?.icon)}" alt="" style="width:18px;height:18px;object-fit:contain;image-rendering:pixelated" onerror="this.style.display='none'">
        <span style="font-size:11px;font-weight:800;color:var(--gold)">${fmtGP(natPrice)} gp</span>
        <span style="font-size:10px;color:var(--muted);font-weight:600">Nat rune</span>
      </div>
      <div class="ge-alch-chip${alchFilter==='profitable'?' active':''}" data-af="profitable">✅ Profitable</div>
      <div class="ge-alch-chip${alchFilter==='nat_cost'?' active':''}" data-af="nat_cost">💰 1.5× Nat cost</div>
      <div class="ge-alch-chip${alchFilter==='all'?' active':''}" data-af="all">🔎 All</div>
    </div>

    <!-- Info banner -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:11px;color:var(--muted);line-height:1.6">
      <strong style="color:var(--text)">How to read this:</strong> ${shown.length} items shown.<br>
      Buy at insta-sell price → High Alch → profit = Alch value − Buy price − Nat rune.
    </div>

    <!-- Column headers -->
    <div class="ge-alch-table-head">
      <div style="width:28px;flex-shrink:0"></div>
      <div style="flex:1">Item</div>
      <div style="min-width:52px;text-align:right">Buy</div>
      <div style="min-width:52px;text-align:right">Alch</div>
      <div style="min-width:58px;text-align:right">Profit</div>
    </div>

    ${shown.length === 0
      ? `<div class="ge-search-hint">No ${alchFilter === 'profitable' ? 'profitable' : ''} alch items found right now.</div>`
      : shown.map(x => `
    <div class="ge-alch-row" data-id="${x.id}">
      <div class="ge-alch-thumb">
        <img src="${imgUrl(x.item.icon)}" alt="" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="ge-alch-name">${h(x.item.name)}</div>
      <div class="ge-alch-cols">
        <div class="ge-alch-col">
          <div class="ge-alch-col-val">${fmtGP(x.buyPrice)}</div>
        </div>
        <div class="ge-alch-col">
          <div class="ge-alch-col-val">${fmtGP(x.item.highalch)}</div>
        </div>
        <div class="ge-alch-col">
          <div class="ge-alch-col-val ${x.profit>0?'profit':'loss'}">${x.profit>0?'+':''}${fmtGP(x.profit)}</div>
        </div>
      </div>
    </div>`).join('')}`;

  // Wire nature rune chip → open item sheet
  el.querySelector('.ge-nat-chip')?.addEventListener('click', () => openItemSheet(561));

  // Wire filter chips
  el.querySelectorAll('[data-af]').forEach(chip => {
    chip.addEventListener('click', () => {
      alchFilter = chip.dataset.af;
      renderAlch();
    });
  });

  // Wire item row clicks
  el.querySelectorAll('.ge-alch-row[data-id]').forEach(row => {
    row.addEventListener('click', () => openItemSheet(+row.dataset.id));
  });
}

// ─── MARKET TAB ──────────────────────────────────────────────────────────────
function renderMarket() {
  const el = document.getElementById('ge-content');
  if (prices.size === 0) { showLoader(); return; }

  // Compute pulse stats
  const itemsWithData = [...prices.entries()].filter(([id]) => hourly.has(id));
  const totalVol = [...hourly.values()].reduce((s,v) => s + (v.highPriceVolume||0) + (v.lowPriceVolume||0), 0);
  const active   = itemsWithData.length;

  // Compute movers
  const moveable = itemsWithData
    .map(([id, p]) => {
      const h = hourly.get(id);
      const item = itemMap.get(id);
      if (!item || !p.high || !h.avgHighPrice) return null;
      const chg = pctChange(p.high, h.avgHighPrice);
      const margin = (p.high && p.low) ? p.high - p.low : 0;
      const roi    = p.high ? (margin / p.high * 100) : 0;
      const vol    = (h.highPriceVolume||0) + (h.lowPriceVolume||0);
      return { id, item, p, h, chg, margin, roi, vol };
    })
    .filter(Boolean);

  const rising = [...moveable].filter(x => x.chg > 0).sort((a,b) => b.chg - a.chg).slice(0, 15);
  const falling= [...moveable].filter(x => x.chg < 0).sort((a,b) => a.chg - b.chg).slice(0, 15);
  const flips  = [...moveable].filter(x => x.vol >= 50 && x.margin > 100 && x.roi > 0.5)
                              .sort((a,b) => b.roi - a.roi).slice(0, 20);

  const updatedAgo = lastUpdated ? Math.floor((Date.now()-lastUpdated)/1000) : 0;

  el.innerHTML = `
    <div class="ge-updated" id="ge-updated-time">Updated ${updatedAgo}s ago</div>

    <!-- Pulse -->
    <div class="ge-pulse">
      <div class="ge-pulse-card">
        <div class="ge-pulse-label">Items Tracked</div>
        <div class="ge-pulse-value">${fmtGP(active)}</div>
        <div class="ge-pulse-sub">with price data</div>
      </div>
      <div class="ge-pulse-card">
        <div class="ge-pulse-label">1h Volume</div>
        <div class="ge-pulse-value">${fmtGP(totalVol)}</div>
        <div class="ge-pulse-sub">trades this hour</div>
      </div>
      <div class="ge-pulse-card">
        <div class="ge-pulse-label">Top Mover</div>
        <div class="ge-pulse-value" style="font-size:13px;color:#3fb950">${rising[0] ? h(rising[0].item.name) : '—'}</div>
        <div class="ge-pulse-sub">${rising[0] ? fmtPct(rising[0].chg) : ''}</div>
      </div>
      <div class="ge-pulse-card">
        <div class="ge-pulse-label">Best Flip</div>
        <div class="ge-pulse-value" style="font-size:13px;color:var(--gold)">${flips[0] ? h(flips[0].item.name) : '—'}</div>
        <div class="ge-pulse-sub">${flips[0] ? fmtGP(flips[0].margin)+' margin' : ''}</div>
      </div>
    </div>

    <!-- Movers sub-tabs -->
    <div class="ge-subtabs">
      <div class="ge-subtab${moversMode==='rising' ? ' active up' : ''}" data-mode="rising">📈 Rising</div>
      <div class="ge-subtab${moversMode==='falling' ? ' active down' : ''}" data-mode="falling">📉 Falling</div>
      <div class="ge-subtab${moversMode==='flips' ? ' active up' : ''}" data-mode="flips">💰 Flips</div>
    </div>

    <div id="ge-movers-list">
      ${renderMoversList(moversMode === 'rising' ? rising : moversMode === 'falling' ? falling : flips, moversMode)}
    </div>`;

  // Wire subtab clicks
  el.querySelectorAll('.ge-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      moversMode = btn.dataset.mode;
      el.querySelectorAll('.ge-subtab').forEach(b => {
        b.className = 'ge-subtab' + (b.dataset.mode === moversMode ? (moversMode==='falling' ? ' active down' : ' active up') : '');
      });
      const list = moversMode === 'rising' ? rising : moversMode === 'falling' ? falling : flips;
      document.getElementById('ge-movers-list').innerHTML = renderMoversList(list, moversMode);
      wireItemRows(el);
    });
  });

  wireItemRows(el);

  // Live countdown update
  clearInterval(window._geUpdateTimer);
  window._geUpdateTimer = setInterval(() => {
    const el2 = document.getElementById('ge-updated-time');
    if (el2) el2.textContent = `Updated ${Math.floor((Date.now()-lastUpdated)/1000)}s ago`;
  }, 5000);
}

function renderMoversList(list, mode) {
  if (!list.length) return `<div class="ge-search-hint">No data available for this view yet.</div>`;
  return list.map(x => {
    const chgHtml = x.chg != null
      ? `<div class="ge-item-change ${x.chg > 0 ? 'up' : x.chg < 0 ? 'down' : 'flat'}">${fmtPct(x.chg)}</div>`
      : '';
    const subText = mode === 'flips'
      ? `Margin: ${fmtGP(x.margin)} gp · ROI: ${x.roi.toFixed(1)}%`
      : `Vol: ${fmtGP(x.vol)}/hr`;
    return `
    <div class="ge-item-row" data-id="${x.id}">
      <div class="ge-item-thumb">
        <img src="${imgUrl(x.item.icon)}" alt="" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="ge-item-info">
        <div class="ge-item-name">${h(x.item.name)}</div>
        <div class="ge-item-sub">${subText}</div>
      </div>
      <div class="ge-item-right">
        <div class="ge-item-price">${fmtGP(x.p.high || x.p.low)} gp</div>
        ${chgHtml}
      </div>
    </div>`;
  }).join('');
}

// ─── SEARCH TAB ──────────────────────────────────────────────────────────────
function renderSearch() {
  const el = document.getElementById('ge-content');
  if (!searchQ) {
    // Show recent + popular items
    const recentHtml = recentIds.slice(0,8).map(id => {
      const item = itemMap.get(id);
      const p    = prices.get(id);
      if (!item) return '';
      return itemRowHtml(id, item, p);
    }).filter(Boolean).join('');

    el.innerHTML = `
      ${recentIds.length ? `
        <div class="ge-section-hdr"><span>🕐 Recently Viewed</span></div>
        ${recentHtml}
      ` : `<div class="ge-search-hint">
        <div style="font-size:32px;margin-bottom:8px">🔍</div>
        Search for any tradeable item<br>
        <span style="font-size:11px;opacity:.6">Type in the search bar above</span>
      </div>`}`;
  } else {
    // Show search results
    const q = searchQ.toLowerCase();
    const results = nameIndex.filter(n => n.lower.includes(q)).slice(0, 40);
    if (!results.length) {
      el.innerHTML = `<div class="ge-search-hint">No items found for "<strong>${h(searchQ)}</strong>"</div>`;
    } else {
      el.innerHTML = `
        <div class="ge-section-hdr"><span>Results for "${h(searchQ)}"</span> <span style="color:var(--muted);font-size:10px">${results.length} items</span></div>
        ${results.map(n => {
          const item = itemMap.get(n.id);
          const p    = prices.get(n.id);
          return itemRowHtml(n.id, item, p);
        }).join('')}`;
    }
  }
  wireItemRows(el);
}

function itemRowHtml(id, item, p) {
  const price = p?.high || p?.low;
  const h1 = hourly.get(id);
  const chg = h1 && p?.high && h1.avgHighPrice ? pctChange(p.high, h1.avgHighPrice) : null;
  return `
  <div class="ge-item-row" data-id="${id}">
    <div class="ge-item-thumb">
      <img src="${imgUrl(item.icon)}" alt="" loading="lazy" onerror="this.style.display='none'">
    </div>
    <div class="ge-item-info">
      <div class="ge-item-name">${h(item.name)}</div>
      <div class="ge-item-sub">${item.members ? 'Members' : 'F2P'}${item.limit ? ` · Limit: ${item.limit.toLocaleString('en-GB')}` : ''}</div>
    </div>
    <div class="ge-item-right">
      <div class="ge-item-price">${price ? fmtGP(price)+' gp' : '—'}</div>
      ${chg != null ? `<div class="ge-item-change ${chg>0?'up':chg<0?'down':'flat'}">${fmtPct(chg)}</div>` : ''}
    </div>
  </div>`;
}

// ─── WATCHLIST TAB ───────────────────────────────────────────────────────────
function renderWatchlist() {
  const el = document.getElementById('ge-content');
  if (!watchlist.size) {
    el.innerHTML = `
      <div class="ge-watchlist-empty">
        <div class="ge-watchlist-empty-icon">🔖</div>
        No items on your watchlist.<br>
        Search for an item and tap <strong>Watch</strong> to add it here.
      </div>`;
    return;
  }
  const rows = [...watchlist].map(id => {
    const item = itemMap.get(+id);
    const p    = prices.get(+id);
    if (!item) return '';
    return itemRowHtml(+id, item, p);
  }).filter(Boolean).join('');
  el.innerHTML = `
    <div class="ge-section-hdr"><span>🔖 Watching ${watchlist.size} item${watchlist.size>1?'s':''}</span></div>
    ${rows}`;
  wireItemRows(el);
}

// ─── Wire item row click → open sheet ────────────────────────────────────────
function wireItemRows(container) {
  container.querySelectorAll('.ge-item-row[data-id]').forEach(row => {
    row.addEventListener('click', () => openItemSheet(+row.dataset.id));
  });
}

// ─── Item detail sheet ────────────────────────────────────────────────────────
function openItemSheet(id) {
  currentItemId = id;

  // Track recent
  recentIds = [id, ...recentIds.filter(x => x !== id)].slice(0, 20);
  storage.set(STORE_KEY_RECENT, recentIds);

  renderSheet(id);
  document.getElementById('ge-sheet-overlay').classList.add('open');
  document.getElementById('ge-sheet').classList.add('open');
}

function closeSheet() {
  document.getElementById('ge-sheet-overlay').classList.remove('open');
  document.getElementById('ge-sheet').classList.remove('open');
  currentItemId = null;
}

function renderSheet(id) {
  const item  = itemMap.get(id);
  const p     = prices.get(id);
  const h1    = hourly.get(id);
  if (!item) return;

  const buy   = p?.high;
  const sell  = p?.low;
  const margin= (buy && sell) ? buy - sell : null;
  const roi   = (buy && margin) ? (margin/buy*100) : null;
  const vol   = h1 ? (h1.highPriceVolume||0) + (h1.lowPriceVolume||0) : null;
  const alchProfit = buy && item.highalch ? item.highalch - buy : null;
  const watching = watchlist.has(id);
  const chg   = (p?.high && h1?.avgHighPrice) ? pctChange(p.high, h1.avgHighPrice) : null;

  document.getElementById('ge-sheet-inner').innerHTML = `
    <!-- Header -->
    <div class="ge-sheet-head">
      <div class="ge-sheet-icon">
        <img src="${imgUrl(item.icon)}" alt="" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="ge-sheet-title">
        <div class="ge-sheet-name">${h(item.name)}</div>
        <div class="ge-sheet-badges">
          ${item.members ? '<span class="ge-badge members">Members</span>' : '<span class="ge-badge">F2P</span>'}
          ${item.limit   ? `<span class="ge-badge">Limit: ${item.limit.toLocaleString('en-GB')}</span>` : ''}
          ${chg != null  ? `<span class="ge-badge" style="color:${chg>0?'#3fb950':chg<0?'#e74c3c':'var(--muted)'}">${fmtPct(chg)} 1h</span>` : ''}
        </div>
      </div>
      <button class="ge-sheet-close" id="ge-sheet-close-btn">✕</button>
    </div>

    <!-- Buy / Sell prices -->
    <div class="ge-prices-row">
      <div class="ge-price-box buy">
        <div class="ge-price-label">Insta-Buy</div>
        <div class="ge-price-amount">${buy ? fmtGP(buy) : '—'}</div>
        <div class="ge-price-sub">${buy ? `${buy.toLocaleString('en-GB')} gp` : 'No data'}</div>
        ${p?.highTime ? `<div class="ge-price-sub">${fmtTime(p.highTime)}</div>` : ''}
      </div>
      <div class="ge-price-box sell">
        <div class="ge-price-label">Insta-Sell</div>
        <div class="ge-price-amount">${sell ? fmtGP(sell) : '—'}</div>
        <div class="ge-price-sub">${sell ? `${sell.toLocaleString('en-GB')} gp` : 'No data'}</div>
        ${p?.lowTime ? `<div class="ge-price-sub">${fmtTime(p.lowTime)}</div>` : ''}
      </div>
    </div>

    <!-- Margin row -->
    <div class="ge-margin-row">
      <div class="ge-margin-chip">
        <div class="ge-margin-chip-label">Margin</div>
        <div class="ge-margin-chip-val">${margin != null ? fmtGP(margin)+' gp' : '—'}</div>
      </div>
      <div class="ge-margin-chip">
        <div class="ge-margin-chip-label">ROI</div>
        <div class="ge-margin-chip-val" style="color:${roi>5?'#3fb950':roi>0?'var(--gold)':'var(--muted)'}">${roi != null ? roi.toFixed(1)+'%' : '—'}</div>
      </div>
      <div class="ge-margin-chip">
        <div class="ge-margin-chip-label">1h Volume</div>
        <div class="ge-margin-chip-val">${vol != null ? fmtGP(vol) : '—'}</div>
      </div>
    </div>

    <!-- Alch indicator -->
    ${item.highalch ? `
    <div class="ge-alch-bar">
      <div class="ge-alch-banner ${alchProfit > 0 ? 'profit' : 'loss'}">
        🔥 High Alch: ${item.highalch.toLocaleString('en-GB')} gp
        ${alchProfit != null ? ` · ${alchProfit > 0 ? `+${fmtGP(alchProfit)} profit vs buy` : `${fmtGP(alchProfit)} loss vs buy`}` : ''}
      </div>
    </div>` : ''}

    <!-- Chart -->
    <div class="ge-chart-section">
      <div class="ge-chart-controls">
        ${['5m','1h','6h','24h'].map(s => `<button class="ge-chart-btn${s===chartStep?' active':''}" data-step="${s}">${s}</button>`).join('')}
      </div>
      <div class="ge-chart-canvas-wrap">
        <canvas id="ge-chart-canvas"></canvas>
        <div class="ge-chart-loading" id="ge-chart-loading">Loading chart…</div>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="ge-stats-grid">
      <div class="ge-stat-cell">
        <div class="ge-stat-label">GE Limit</div>
        <div class="ge-stat-val">${item.limit ? item.limit.toLocaleString('en-GB') : 'Unknown'}</div>
      </div>
      <div class="ge-stat-cell">
        <div class="ge-stat-label">High Alch</div>
        <div class="ge-stat-val gold">${item.highalch ? fmtGP(item.highalch)+' gp' : '—'}</div>
      </div>
      <div class="ge-stat-cell">
        <div class="ge-stat-label">Low Alch</div>
        <div class="ge-stat-val">${item.lowalch ? fmtGP(item.lowalch)+' gp' : '—'}</div>
      </div>
      <div class="ge-stat-cell">
        <div class="ge-stat-label">Store Value</div>
        <div class="ge-stat-val">${item.value ? fmtGP(item.value)+' gp' : '—'}</div>
      </div>
    </div>

    <!-- Flip / Alch calculator -->
    ${item.highalch && buy ? (() => {
      const liveNat = prices.get(561)?.high || prices.get(561)?.low || 200;
      const alchProfit0 = item.highalch - buy - liveNat;
      return `
    <div class="ge-calc-section">
      <div class="ge-calc-title">🔥 Alch Flip Calculator</div>
      <!-- Rune cost selector -->
      <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">
        <button class="ge-rune-opt active" data-rune="live" style="flex:1;padding:6px 8px;border-radius:8px;border:1px solid var(--gold);background:rgba(184,136,72,.15);color:var(--gold);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
          🍃 Live ${fmtGP(liveNat)} gp
        </button>
        <button class="ge-rune-opt" data-rune="npc" style="flex:1;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
          🏪 NPC 180 gp
        </button>
        <button class="ge-rune-opt" data-rune="none" style="flex:1;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
          ⛔ No cost
        </button>
      </div>
      <!-- IM Profit toggle -->
      <div style="margin-bottom:8px">
        <button id="ge-im-toggle" style="width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;text-align:left">
          🛡️ IM Profit — exclude buy price (drop/boss loot)
        </button>
      </div>
      <!-- Quantity + result -->
      <div class="ge-calc-row">
        <input class="ge-calc-input" id="ge-calc-qty" type="number" value="1"
          min="1" max="${item.limit || 10000}" placeholder="Qty">
        <div class="ge-calc-result">
          <div class="ge-calc-result-label" id="ge-calc-label">Alch Profit</div>
          <div class="ge-calc-result-val ${alchProfit0 >= 0 ? 'profit' : 'loss'}" id="ge-calc-result">${fmtGP(alchProfit0)} gp</div>
        </div>
      </div>
      <!-- Breakdown row -->
      <div id="ge-calc-breakdown" style="font-size:10px;color:var(--muted);margin-top:6px;line-height:1.8;padding:8px 10px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
        Alch: <strong style="color:var(--text)">${fmtGP(item.highalch)} gp</strong> −
        Buy: <strong style="color:var(--text)">${fmtGP(buy)} gp</strong> −
        Live nat: <strong style="color:var(--text)">${fmtGP(liveNat)} gp</strong> =
        <strong style="color:${alchProfit0 >= 0 ? '#3fb950' : '#e74c3c'}">${fmtGP(alchProfit0)} gp/ea</strong>
      </div>
    </div>`;
    })() : margin != null ? `
    <div class="ge-calc-section">
      <div class="ge-calc-title">💰 Flip Calculator</div>
      <div class="ge-calc-row">
        <input class="ge-calc-input" id="ge-calc-qty" type="number" value="1"
          min="1" max="${item.limit || 10000}" placeholder="Qty">
        <div class="ge-calc-result">
          <div class="ge-calc-result-label">Profit</div>
          <div class="ge-calc-result-val profit" id="ge-calc-result">${fmtGP(margin)} gp</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Action buttons -->
    <div class="ge-sheet-actions">
      <button class="ge-sheet-btn${watching?' watching':''}" id="ge-watch-btn">
        ${watching ? '🔖 Watching' : '🔖 Watch'}
      </button>
      <a class="ge-sheet-btn external" href="${GE_URL}${id}" target="_blank" rel="noopener">
        🌐 Jagex GE
      </a>
      <a class="ge-sheet-btn external" href="https://oldschool.runescape.wiki/w/${encodeURIComponent(item.name.replace(/ /g,'_'))}" target="_blank" rel="noopener">
        📖 Wiki
      </a>
    </div>`;

  // Wire sheet buttons
  document.getElementById('ge-sheet-close-btn').addEventListener('click', closeSheet);

  document.getElementById('ge-watch-btn').addEventListener('click', () => {
    if (watchlist.has(id)) {
      watchlist.delete(id);
      showToast(`${item.name} removed from watchlist`);
    } else {
      watchlist.add(id);
      showToast(`${item.name} added to watchlist 🔖`);
    }
    storage.set(STORE_KEY_WATCH, [...watchlist]);
    document.getElementById('ge-watch-btn').className = `ge-sheet-btn${watchlist.has(id)?' watching':''}`;
    document.getElementById('ge-watch-btn').textContent = watchlist.has(id) ? '🔖 Watching' : '🔖 Watch';
    if (activeTab === 'watchlist') renderWatchlist();
    if (activeTab === 'alch') renderAlch();
  });

  // Alch Flip Calculator wiring
  const calcInput = document.getElementById('ge-calc-qty');
  if (calcInput && item.highalch && buy) {
    const liveNat = prices.get(561)?.high || prices.get(561)?.low || 200;
    const RUNE_COSTS = { live: liveNat, npc: 180, none: 0 };
    let runeMode = 'live';
    let imMode   = false;

    const ACTIVE_STYLE  = 'flex:1;padding:6px 8px;border-radius:8px;border:1px solid var(--gold);background:rgba(184,136,72,.15);color:var(--gold);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap';
    const INACTIVE_STYLE= 'flex:1;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap';
    const IM_ACTIVE  = 'width:100%;padding:6px 10px;border-radius:8px;border:1px solid #58a6ff;background:rgba(88,166,255,.12);color:#58a6ff;font-size:11px;font-weight:700;cursor:pointer;text-align:left';
    const IM_INACTIVE= 'width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;text-align:left';

    function updateAlchCalc() {
      const qty      = Math.max(1, parseInt(calcInput.value) || 1);
      const runeCost = RUNE_COSTS[runeMode];
      const buyCost  = imMode ? 0 : buy;
      const profitPer= item.highalch - buyCost - runeCost;
      const totalProfit = profitPer * qty;

      const resultEl  = document.getElementById('ge-calc-result');
      const labelEl   = document.getElementById('ge-calc-label');
      const breakdown = document.getElementById('ge-calc-breakdown');

      if (labelEl) labelEl.textContent = imMode ? 'IM Profit' : 'Alch Profit';

      if (resultEl) {
        resultEl.textContent = fmtGP(totalProfit) + (qty > 1 ? ` gp (${fmtGP(profitPer)}/ea)` : ' gp');
        resultEl.className = `ge-calc-result-val ${totalProfit >= 0 ? 'profit' : 'loss'}`;
      }

      if (breakdown) {
        const runeLabel = runeMode === 'none' ? 'No rune' : runeMode === 'npc' ? 'NPC nat' : 'Live nat';
        const buyPart  = imMode ? '' : `− Buy: <strong style="color:var(--text)">${fmtGP(buy)} gp</strong> `;
        breakdown.innerHTML =
          `Alch: <strong style="color:var(--text)">${fmtGP(item.highalch)} gp</strong> `
          + buyPart
          + `− ${runeLabel}: <strong style="color:var(--text)">${fmtGP(runeCost)} gp</strong> = `
          + `<strong style="color:${profitPer >= 0 ? '#3fb950' : '#e74c3c'}">${fmtGP(profitPer)} gp/ea</strong>`
          + (qty > 1 ? ` · <strong style="color:${totalProfit>=0?'#3fb950':'#e74c3c'}">${fmtGP(totalProfit)} gp total</strong>` : '');
      }
    }

    // Rune option buttons
    document.querySelectorAll('.ge-rune-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        runeMode = btn.dataset.rune;
        document.querySelectorAll('.ge-rune-opt').forEach(b => b.style.cssText = b.dataset.rune === runeMode ? ACTIVE_STYLE : INACTIVE_STYLE);
        updateAlchCalc();
      });
    });

    // IM toggle
    const imBtn = document.getElementById('ge-im-toggle');
    if (imBtn) {
      imBtn.addEventListener('click', () => {
        imMode = !imMode;
        imBtn.style.cssText = imMode ? IM_ACTIVE : IM_INACTIVE;
        imBtn.textContent = imMode
          ? '🛡️ IM Profit ON — excluding buy price'
          : '🛡️ IM Profit — exclude buy price (drop/boss loot)';
        updateAlchCalc();
      });
    }

    calcInput.addEventListener('input', updateAlchCalc);
    updateAlchCalc();

  } else if (calcInput) {
    // Regular flip calc (no alch value)
    calcInput.addEventListener('input', () => {
      const qty = Math.max(1, parseInt(calcInput.value) || 1);
      const profit = margin * qty;
      const el2 = document.getElementById('ge-calc-result');
      el2.textContent = fmtGP(profit) + ' gp';
      el2.className = `ge-calc-result-val ${profit >= 0 ? 'profit' : 'loss'}`;
    });
  }

  // Chart step buttons
  document.querySelectorAll('.ge-chart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chartStep = btn.dataset.step;
      document.querySelectorAll('.ge-chart-btn').forEach(b => b.classList.toggle('active', b.dataset.step===chartStep));
      loadChart(id);
    });
  });

  // Load chart
  loadChart(id);
}

// ─── Chart rendering ──────────────────────────────────────────────────────────
async function loadChart(id) {
  const loadEl = document.getElementById('ge-chart-loading');
  const canvas = document.getElementById('ge-chart-canvas');
  if (!loadEl || !canvas) return;
  loadEl.style.display = 'flex';

  try {
    const data = await apiFetch(`timeseries?id=${id}&timestep=${chartStep}`);
    const points = (data.data || []).slice(-96); // last 96 data points
    loadEl.style.display = 'none';
    drawChart(canvas, points);
  } catch {
    loadEl.textContent = 'Chart unavailable';
  }
}

function drawChart(canvas, points) {
  if (!points.length) { return; }
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.parentElement.offsetWidth;
  const H   = 160;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  canvas.width  = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Theme-aware colors
  const style     = getComputedStyle(document.body);
  const colBg     = style.getPropertyValue('--surface2').trim() || '#1e1a14';
  const colBorder = style.getPropertyValue('--border').trim()   || '#3a3020';
  const colBuy    = '#f0883e';
  const colSell   = '#3fb950';
  const colText   = style.getPropertyValue('--muted').trim()    || '#857860';

  const highs = points.map(p => p.avgHighPrice).filter(Boolean);
  const lows  = points.map(p => p.avgLowPrice).filter(Boolean);
  const allPrices = [...highs, ...lows];
  if (!allPrices.length) return;

  const minP = Math.min(...allPrices) * 0.998;
  const maxP = Math.max(...allPrices) * 1.002;
  const range = maxP - minP || 1;

  const PAD = { top:10, right:8, bottom:22, left:8 };
  const cW  = W - PAD.left - PAD.right;
  const cH  = H - PAD.top  - PAD.bottom;

  const toX = i => PAD.left + (i / (points.length - 1)) * cW;
  const toY = v => PAD.top  + (1 - (v - minP) / range)  * cH;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = colBorder;
  ctx.lineWidth   = 0.5;
  for (let i = 0; i <= 3; i++) {
    const y = PAD.top + (i / 3) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    const price = maxP - (i / 3) * range;
    ctx.fillStyle = colText; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(fmtGP(Math.round(price)), W - PAD.right, y - 2);
  }

  // Fill areas
  function drawFill(data, col) {
    const pts = data.map((v,i) => v ? [toX(i), toY(v)] : null).filter(Boolean);
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[pts.length-1][0], PAD.top + cH);
    ctx.lineTo(pts[0][0], PAD.top + cH);
    ctx.closePath();
    ctx.fillStyle = col + '1a'; // 10% opacity
    ctx.fill();
  }

  drawFill(points.map(p => p.avgHighPrice), colBuy);
  drawFill(points.map(p => p.avgLowPrice),  colSell);

  // Lines
  function drawLine(data, col) {
    const validPts = data.map((v,i) => v ? [toX(i), toY(v)] : null);
    ctx.beginPath();
    ctx.strokeStyle = col;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    let started = false;
    for (const pt of validPts) {
      if (!pt) { started = false; continue; }
      if (!started) { ctx.moveTo(pt[0], pt[1]); started = true; }
      else ctx.lineTo(pt[0], pt[1]);
    }
    ctx.stroke();
  }

  drawLine(points.map(p => p.avgHighPrice), colBuy);
  drawLine(points.map(p => p.avgLowPrice),  colSell);

  // Legend
  ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = colBuy;  ctx.fillText('Buy',  PAD.left,     H - 6);
  ctx.fillStyle = colSell; ctx.fillText('Sell', PAD.left + 28, H - 6);
}

// ─── Search autocomplete ──────────────────────────────────────────────────────
const searchEl     = document.getElementById('ge-search');
const acEl         = document.getElementById('ge-autocomplete');
const clearBtn     = document.getElementById('ge-search-clear');
let acTimer;

searchEl.addEventListener('input', () => {
  const q = searchEl.value.trim();
  searchQ = q;
  clearBtn.classList.toggle('visible', q.length > 0);
  clearTimeout(acTimer);
  acTimer = setTimeout(() => {
    if (q.length >= 2) showAutocomplete(q);
    else               acEl.classList.remove('open');
    if (activeTab === 'search') renderSearch();
  }, 150);
});

searchEl.addEventListener('focus', () => {
  if (searchEl.value.trim().length >= 2) showAutocomplete(searchEl.value.trim());
});

function showAutocomplete(q) {
  const ql = q.toLowerCase();
  const results = nameIndex.filter(n => n.lower.includes(ql)).slice(0, 8);
  if (!results.length) { acEl.classList.remove('open'); return; }
  acEl.innerHTML = results.map(n => {
    const item = itemMap.get(n.id);
    const p    = prices.get(n.id);
    const price = p?.high || p?.low;
    return `
    <div class="ge-ac-item" data-id="${n.id}">
      <img class="ge-ac-img" src="${imgUrl(item.icon)}" alt="" loading="lazy" onerror="this.style.display='none'">
      <div class="ge-ac-name">${h(item.name)}</div>
      <div class="ge-ac-price">${price ? fmtGP(price)+' gp' : ''}</div>
    </div>`;
  }).join('');
  acEl.classList.add('open');
  acEl.querySelectorAll('.ge-ac-item').forEach(row => {
    row.addEventListener('click', () => {
      const id = +row.dataset.id;
      acEl.classList.remove('open');
      searchEl.value = itemMap.get(id)?.name || '';
      searchEl.blur();
      openItemSheet(id);
    });
  });
}

clearBtn.addEventListener('click', () => {
  searchEl.value = ''; searchQ = '';
  clearBtn.classList.remove('visible');
  acEl.classList.remove('open');
  if (activeTab === 'search') renderSearch();
});

document.addEventListener('click', e => {
  if (!e.target.closest('#ge-search-wrap')) acEl.classList.remove('open');
});

// ─── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll('.ge-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    document.querySelectorAll('.ge-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
    renderContent();
  });
});

// ─── Sheet overlay close ──────────────────────────────────────────────────────
document.getElementById('ge-sheet-overlay').addEventListener('click', closeSheet);

// ─── Settings ─────────────────────────────────────────────────────────────────
document.getElementById('settings-btn').addEventListener('click', ()=>settings.open());
document.getElementById('settings-close').addEventListener('click', ()=>settings.close());
document.getElementById('settings-overlay').addEventListener('click', ()=>settings.close());
document.getElementById('clear-watchlist-btn').addEventListener('click', () => {
  watchlist.clear(); storage.set(STORE_KEY_WATCH, []);
  settings.close(); showToast('Watchlist cleared');
  if (activeTab === 'watchlist') renderWatchlist();
});
document.querySelectorAll('.theme-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.theme;
    document.body.className = t==='dark'?'':`theme-${t}`;
    localStorage.setItem('osts_theme_v2', t);
  });
});

// ─── Auto-refresh every 60 seconds ───────────────────────────────────────────
clearInterval(refreshTimer);
refreshTimer = setInterval(() => {
  if (!document.hidden) refreshPrices();
}, 60_000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshPrices();
});

// ─── Init ──────────────────────────────────────────────────────────────────────
initPage({ activePage:'more' });
loadData();