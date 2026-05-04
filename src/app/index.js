import {
  initPage, showToast, normalizeAccountType,
} from '/src/app/shared.js';

initPage('home');

// ── Constants ─────────────────────────────────────────────────────────────────
const LOCAL_RECENT_KEY = 'osts_recent_players_v2';

const TYPE_ICONS  = { ironman:'🛡', hardcore:'💀', ultimate:'🔱', regular:'⚔', gim:'👥', ghcim:'☠', ugim:'👥' };
const TYPE_LABELS = { ironman:'Iron', hardcore:'HCIM', ultimate:'UIM', regular:'Regular', gim:'GIM', ghcim:'GHCIM', ugim:'UGIM' };
const typeIcon  = t => TYPE_ICONS[normalizeAccountType(t)]  || '⚔';
const typeLabel = t => TYPE_LABELS[normalizeAccountType(t)] || 'Iron';

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s / 60)   + 'm ago';
  if (s < 86400) return Math.floor(s / 3600)  + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function fmtDate(str) {
  if (!str) return '';
  try {
    return new Date(str).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).toUpperCase();
  } catch { return str; }
}

// ── Recent Players ────────────────────────────────────────────────────────────
function recentChipsHtml(list) {
  return `<div class="recent-grid">${
    list.map(p => {
      const sub = p.totalLevel
        ? `${typeLabel(p.type)} · Lvl ${p.totalLevel}`
        : typeLabel(p.type);
      return `
        <a class="recent-chip"
           href="Pages/overview.html?rsn=${encodeURIComponent(p.rsn)}"
           title="Load ${p.rsn}">
          <span class="rc-icon">${typeIcon(p.type)}</span>
          <div class="rc-info">
            <div class="rc-name">${p.displayName || p.rsn}</div>
            <div class="rc-type">${sub}</div>
          </div>
          <span class="rc-time">${timeAgo(p.searchedAt)}</span>
        </a>`;
    }).join('')
  }</div>`;
}

async function loadGlobalRecent() {
  const el = document.getElementById('recent-global-container');
  try {
    const res = await fetch('/.netlify/functions/recent-players');
    console.log('[OSTS] recent-players GET status:', res.status);

    if (res.ok) {
      const data = await res.json();
      console.log('[OSTS] recent-players GET data:', data);

      if (Array.isArray(data) && data.length) {
        el.innerHTML = recentChipsHtml(data);
        return;
      }
      el.innerHTML = '<div class="recent-empty">No global searches recorded yet — be the first!</div>';
      return;
    }

    const text = await res.text().catch(() => '');
    console.warn('[OSTS] recent-players GET failed:', res.status, text);
    el.innerHTML = `<div class="recent-empty">Global list unavailable (${res.status}) — deploy to Netlify to enable.</div>`;
  } catch (err) {
    console.warn('[OSTS] recent-players GET error:', err.message);
    el.innerHTML = '<div class="recent-empty">Could not reach database — check Netlify deploy logs.</div>';
  }
}

async function loadLocalRecent() {
  const el = document.getElementById('recent-local-container');
  try {
    const local = JSON.parse(localStorage.getItem(LOCAL_RECENT_KEY) || '[]');
    if (Array.isArray(local) && local.length) {
      el.innerHTML = recentChipsHtml(local);
      return;
    }
  } catch {}
  el.innerHTML = `<div class="recent-empty">No local searches yet.<br>
    Search a player on the <a href="Pages/overview.html" style="color:var(--gold);font-weight:600">Overview</a> page to get started.</div>`;
}

// ── OSRS News ─────────────────────────────────────────────────────────────────
const OSRS_RSS = 'https://secure.runescape.com/m=news/latest_news.rss?oldschool=true';
const RSS2JSON = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(OSRS_RSS)}&api_key=&count=10`;

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#\d+;/g,'').trim();
}

async function loadNews() {
  let items = [];

  // 1. Try Netlify proxy (production — avoids CORS)
  try {
    const res = await fetch('/.netlify/functions/osrs-news');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) items = data;
    }
  } catch {}

  // 2. Fallback: rss2json public API (works on localhost, no CORS issues)
  if (!items.length) {
    try {
      const res  = await fetch(RSS2JSON);
      const data = res.ok ? await res.json() : null;
      if (data?.status === 'ok' && Array.isArray(data.items)) {
        items = data.items.map(i => ({
          title:       i.title || '',
          link:        i.link  || '',
          description: stripHtml(i.description).slice(0, 220),
          pubDate:     i.pubDate || '',
          thumbnail:   i.enclosure?.link || i.thumbnail || '',
          category:    Array.isArray(i.categories) ? i.categories[0] : (i.category || ''),
        })).filter(i => i.title);
      }
    } catch {}
  }

  renderNews(items);
}

function renderNews(items) {
  const el = document.getElementById('news-container');

  if (!items.length) {
    el.innerHTML = `
      <div class="news-list">
        <a class="news-card featured"
           href="https://oldschool.runescape.com/news" target="_blank" rel="noopener">
          <div class="news-thumb-fallback news-card.featured" style="height:100px">📰</div>
          <div class="news-body">
            <div class="news-title">View OSRS News</div>
            <div class="news-desc">Open the official Old School RuneScape news page for the latest updates.</div>
          </div>
        </a>
      </div>`;
    return;
  }

  const cards = items.slice(0, 8).map((item, i) => {
    const isFirst = i === 0;

    const thumbHtml = item.thumbnail
      ? `<div class="news-thumb-wrap">
           <img src="${item.thumbnail}" alt="" loading="lazy"
                onerror="this.parentElement.innerHTML='<div class=\\'news-thumb-fallback\\' style=\\'height:80px\\'>📰</div>'">
         </div>`
      : `<div class="news-thumb-wrap"><div class="news-thumb-fallback" style="height:${isFirst ? '100' : '80'}px">📰</div></div>`;

    const metaHtml = (item.category || item.pubDate)
      ? `<div class="news-meta">
           ${item.category ? `<span class="news-cat">${item.category}</span>` : '<span></span>'}
           ${item.pubDate  ? `<span class="news-date">${fmtDate(item.pubDate)}</span>` : ''}
         </div>`
      : '';

    return `<a class="news-card${isFirst ? ' featured' : ''}"
         href="${item.link || 'https://oldschool.runescape.com/news'}"
         target="_blank" rel="noopener">
      ${thumbHtml}
      ${metaHtml}
      <div class="news-body">
        <div class="news-title">${item.title}</div>
        ${item.description ? `<div class="news-desc">${item.description}</div>` : ''}
      </div>
    </a>`;
  });

  el.innerHTML = `<div class="news-list">${cards.join('')}</div>`;
}

// ── Refresh ───────────────────────────────────────────────────────────────────
async function withSpin(btn, fn) {
  btn.classList.add('spinning');
  try { await fn(); } finally { btn.classList.remove('spinning'); }
}

document.getElementById('refresh-recent-global').addEventListener('click', e =>
  withSpin(e.currentTarget, loadGlobalRecent));
document.getElementById('refresh-recent-local').addEventListener('click', e =>
  withSpin(e.currentTarget, loadLocalRecent));
document.getElementById('refresh-news').addEventListener('click', e =>
  withSpin(e.currentTarget, loadNews));

// ── Boot ──────────────────────────────────────────────────────────────────────
loadGlobalRecent();
loadLocalRecent();
loadNews();

// ── Player Profiles ───────────────────────────────────────────────────────────
const PROFILES_KEY_SP    = 'osts_profiles_v2';
const ACTIVE_PROF_KEY_SP = 'osts_active_profile_v2';
const SP_ICONS  = { ironman:'🛡', hardcore:'💀', ultimate:'🔱', regular:'⚔', gim:'👥', ghcim:'☠', ugim:'👥' };
const SP_LABELS = { ironman:'Iron', hardcore:'HCIM', ultimate:'UIM', regular:'Regular', gim:'GIM', ghcim:'GHCIM', ugim:'UGIM' };

function spGetProfiles() { return JSON.parse(localStorage.getItem(PROFILES_KEY_SP) || '[]'); }
function spGetActiveId()  { return localStorage.getItem(ACTIVE_PROF_KEY_SP); }
function spSetActiveId(id){ localStorage.setItem(ACTIVE_PROF_KEY_SP, id); }
function spNorm(t){ return normalizeAccountType(t); }

function renderSpProfiles() {
  const list = document.getElementById('sp-profile-list');
  if (!list) return;
  const profiles = spGetProfiles();
  const activeId = spGetActiveId();
  if (!profiles.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">No saved profiles yet.</div>';
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
      ${p.id !== activeId
        ? `<button class="sp-btn" data-sp-load="${p.id}">Load</button>`
        : '<span style="font-size:10px;color:var(--gold)">Active</span>'}
    </div>`).join('');

  list.querySelectorAll('[data-sp-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = spGetProfiles().find(x => x.id === btn.dataset.spLoad);
      if (!p) return;
      spSetActiveId(p.id);
      settings.close();
      window.location.href = 'Pages/overview.html?rsn=' + encodeURIComponent(p.rsn);
    });
  });
}
document.getElementById('settings-btn')?.addEventListener('click', renderSpProfiles, true);