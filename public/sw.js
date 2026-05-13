// ─── OSTS Service Worker v3.0  ─────────────────────────────────────────────────
// Strategy: network-first for navigation, cache-on-demand for assets
// No precaching — avoids install failures from wrong paths

const CACHE     = 'osts-v3.0';
const API_CACHE = 'osts-api-v2.5';

// ── Install: skip waiting, no precache ───────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
});

// ── Activate: clear old caches ───────────────────────────────────────────────
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

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip: cross-origin, vscode noise
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('vscode-livepreview')) return;

  // Netlify functions: network only, never cache
  if (url.pathname.startsWith('/.netlify/')) {
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

  // Everything else: network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // For navigation, return index as fallback
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'OSTS', body: event.data?.text() || 'New notification' }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'OSTS Notification', {
      body:     data.body || 'You have a new notification.',
      icon:     '/src/assets/data/images/Logo/icon-192.png',
      badge:    '/src/assets/data/images/Logo/icon-192.png',
      tag:      data.tag || 'osts-push',
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