// ─── OSTS Service Worker v2.1 ─────────────────────────────────────────────────
const CACHE      = 'osts-shell-v2.1';
const API_CACHE  = 'osts-api-v2.1';

// App shell — every file needed to render the app offline
const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/JS/shared.js',
  '/JS/bootstrap.js',
  '/Pages/overview.html',
  '/Pages/skills.html',
  '/Pages/gains.html',
  '/Pages/bossing.html',
  '/Pages/timers.html',
  '/Pages/bestiary.html',
];

// ── Install: precache the entire app shell ────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: wipe old caches ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== API_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip: non-same-origin (CDNs, APIs, images), vscode devtools noise
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('vscode-livepreview')) return;

  // Netlify functions → network-only (never cache API responses in shell)
  if (url.pathname.startsWith('/netlify/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Navigation requests (HTML pages) → cache-first, fallback to /index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(res => {
              if (res.ok) {
                caches.open(CACHE).then(c => c.put(event.request, res.clone()));
              }
              return res;
            })
            .catch(() => caches.match('/index.html'));
        })
    );
    return;
  }

  // Static assets (JS, CSS, fonts, icons) → cache-first, update in background
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request).then(res => {
        if (res && res.ok) cache.put(event.request, res.clone());
        return res;
      }).catch(() => null);

      // Return cached immediately; update in background
      return cached || networkFetch || new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      });
    })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'OSTS', body: event.data?.text() || 'New notification' }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'OSTS Notification', {
      body:     data.body  || 'You have a new notification.',
      icon:     '/Assets/Logo/icon-192.png',
      badge:    '/Assets/Logo/icon-192.png',
      tag:      data.tag   || 'osts-push',
      renotify: true,
      data:     { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url === target && 'focus' in c) return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});