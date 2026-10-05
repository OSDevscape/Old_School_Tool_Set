// ─── OSTS Wiki Viewer ─────────────────────────────────────────────────────────
import { initPage } from '/src/app/shared.js';
initPage('more');

// ── Constants ─────────────────────────────────────────────────────────────────
const WIKI_API   = 'https://oldschool.runescape.wiki/api.php';
const WIKI_BASE  = 'https://oldschool.runescape.wiki/w/';
const DEBOUNCE_MS = 320;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const searchEl      = document.getElementById('wiki-search');
const clearBtn      = document.getElementById('wiki-clear-btn');
const backBtn       = document.getElementById('wiki-back-btn');
const openBtn       = document.getElementById('wiki-open-btn');
const dropdown      = document.getElementById('wiki-results-dropdown');
const homeView      = document.getElementById('wiki-home');
const articleView   = document.getElementById('wiki-article');
const articleLoad   = document.getElementById('wiki-article-loading');
const articleErr    = document.getElementById('wiki-article-error');
const articleErrMsg = document.getElementById('wiki-error-msg');
const articleBody   = document.getElementById('wiki-article-content');
const retryBtn      = document.getElementById('wiki-retry-btn');
const headerTitle   = document.getElementById('wiki-header-title');
const quickGrid     = document.getElementById('wiki-quick-grid');
const bossGrid      = document.getElementById('wiki-boss-grid');

// ── State ─────────────────────────────────────────────────────────────────────
let history     = [];   // stack of article titles for back navigation
let currentPage = null; // currently displayed article title
let lastRetry   = null; // for retry button
let debounceTimer;

// ── Utility ───────────────────────────────────────────────────────────────────
function apiUrl(params) {
  const url = new URL(WIKI_API);
  Object.entries({ format: 'json', origin: '*', ...params })
    .forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

// ── Search ────────────────────────────────────────────────────────────────────
searchEl.addEventListener('input', () => {
  const q = searchEl.value.trim();
  clearBtn.style.display = q ? '' : 'none';
  clearTimeout(debounceTimer);
  if (!q) { hideDropdown(); return; }
  debounceTimer = setTimeout(() => runSearch(q), DEBOUNCE_MS);
});

searchEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = searchEl.value.trim();
    if (q) { hideDropdown(); loadArticle(q); }
  }
  if (e.key === 'Escape') { clearSearch(); }
});

clearBtn.addEventListener('click', clearSearch);

function clearSearch() {
  searchEl.value = '';
  clearBtn.style.display = 'none';
  hideDropdown();
  searchEl.blur();
}

function hideDropdown() {
  dropdown.style.display = 'none';
  dropdown.innerHTML = '';
}

async function runSearch(query) {
  dropdown.innerHTML = `<div class="wiki-results-searching">Searching…</div>`;
  dropdown.style.display = '';

  try {
    const url = apiUrl({
      action:      'opensearch',
      search:      query,
      limit:       8,
      namespace:   0,
      redirects:   'resolve',
    });
    const res  = await fetch(url);
    const data = await res.json();
    // data = [query, [titles], [descs], [urls]]
    const titles = data[1] || [];
    const descs  = data[2] || [];

    if (!titles.length) {
      dropdown.innerHTML = `<div class="wiki-results-none">No results for "<strong>${query}</strong>"</div>`;
      return;
    }

    dropdown.innerHTML = titles.map((title, i) => `
      <div class="wiki-result-item" data-page="${encodeURIComponent(title)}">
        <span class="wiki-result-icon">📄</span>
        <div class="wiki-result-text">
          <div class="wiki-result-title">${title}</div>
          ${descs[i] ? `<div class="wiki-result-desc">${descs[i]}</div>` : ''}
        </div>
        <span class="wiki-result-arrow">›</span>
      </div>
    `).join('');

    dropdown.querySelectorAll('.wiki-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const title = decodeURIComponent(el.dataset.page);
        clearSearch();
        hideDropdown();
        loadArticle(title);
      });
    });
  } catch (err) {
    dropdown.innerHTML = `<div class="wiki-results-none">Search failed. Check your connection.</div>`;
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
backBtn.addEventListener('click', goBack);

function goBack() {
  if (!history.length) { showHome(); return; }
  const prev = history.pop();
  if (prev) {
    loadArticle(prev, /* pushHistory */ false);
  } else {
    showHome();
  }
}

function showHome() {
  currentPage = null;
  history     = [];
  homeView.style.display    = '';
  articleView.style.display = 'none';
  backBtn.style.display     = 'none';
  openBtn.style.display     = 'none';
  headerTitle.textContent   = 'OSTS — Wiki';
}

// ── Article Loader ────────────────────────────────────────────────────────────
async function loadArticle(title, pushHistory = true) {
  // Push current to back-stack if we're navigating away from an article
  if (pushHistory && currentPage) {
    history.push(currentPage);
  } else if (pushHistory) {
    history.push(null); // null = home
  }

  currentPage = title;
  lastRetry   = title;

  // Switch to article view
  homeView.style.display    = 'none';
  articleView.style.display = '';
  articleLoad.style.display = 'flex';
  articleErr.style.display  = 'none';
  articleBody.style.display = 'none';
  articleBody.innerHTML     = '';

  // Update header + controls
  headerTitle.textContent = title.replace(/_/g, ' ');
  backBtn.style.display   = '';
  openBtn.style.display   = '';
  openBtn.onclick         = () => window.open(WIKI_BASE + encodeURIComponent(title.replace(/ /g, '_')), '_blank');

  // Scroll to top
  document.getElementById('main').scrollTop = 0;

  try {
    const url  = apiUrl({
      action:   'parse',
      page:     title,
      prop:     'text',
      disableeditsection: '1',
      disabletoc: '1',
    });
    const res  = await fetch(url);
    const data = await res.json();

    if (data.error) throw new Error(data.error.info || 'Article not found');

    const rawHtml = data.parse?.text?.['*'] || '';
    renderArticle(rawHtml, title);
  } catch (err) {
    articleLoad.style.display = 'none';
    articleErr.style.display  = 'flex';
    articleErrMsg.textContent = err.message || 'Could not load article.';
  }
}

retryBtn.addEventListener('click', () => {
  if (lastRetry) loadArticle(lastRetry, false);
});

// ── Article Renderer ──────────────────────────────────────────────────────────
function renderArticle(html, pageTitle) {
  // Parse into DOM for manipulation
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');

  // Rewrite all internal wiki links to be handled by our viewer
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('/w/')) {
      // Internal wiki link — capture it
      const wikTitle = decodeURIComponent(href.slice(3).replace(/_/g, ' ').split('#')[0]);
      a.removeAttribute('href');
      a.style.cursor = 'pointer';
      a.dataset.wikiNav = wikTitle;
    } else if (href.startsWith('http')) {
      // External link — open in new tab
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    } else if (href.startsWith('#')) {
      // Anchor link — just prevent default (would scroll weirdly)
      a.removeAttribute('href');
    } else {
      // Other relative links — point to wiki
      a.setAttribute('href', 'https://oldschool.runescape.wiki' + href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    }
  });

  // Fix image sources — prepend wiki origin if relative
  doc.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('//')) {
      img.setAttribute('src', 'https:' + src);
    } else if (src.startsWith('/')) {
      img.setAttribute('src', 'https://oldschool.runescape.wiki' + src);
    }
    // Lazy-load
    img.setAttribute('loading', 'lazy');
    // Remove fixed width/height to allow responsive
    img.removeAttribute('width');
    img.removeAttribute('height');
  });

  // Wrap wide tables in scrollable container
  doc.querySelectorAll('table').forEach(table => {
    const wrap = doc.createElement('div');
    wrap.className = 'wiki-table-scroll';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });

  // Remove elements that clutter the mobile view
  const REMOVE_SELECTORS = [
    '.mw-editsection',
    '#toc', '.toc',
    '.navbox',
    '.noprint',
    '.printfooter',
    '.mw-references-wrap',
    'script',
    'style',
    // Wiki nav templates at page bottom
    'table.navbox',
    '.succession-box',
  ];
  REMOVE_SELECTORS.forEach(sel => {
    doc.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Inject cleaned HTML
  articleBody.innerHTML = doc.body.innerHTML;

  // Wire up internal navigation links
  articleBody.querySelectorAll('[data-wiki-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const title = el.dataset.wikiNav;
      if (title) loadArticle(title);
    });
  });

  // Show
  articleLoad.style.display  = 'none';
  articleErr.style.display   = 'none';
  articleBody.style.display  = '';
}

// ── Quick access buttons ──────────────────────────────────────────────────────
[quickGrid, bossGrid].forEach(grid => {
  grid.querySelectorAll('.wiki-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page) loadArticle(page);
    });
  });
});

// ── Handle browser back gesture (popstate not used but handle focus blur) ─────
document.addEventListener('keydown', e => {
  if (e.key === 'Backspace' && document.activeElement === document.body && currentPage) {
    goBack();
  }
});
