const CACHE_NAME = 'osts-v2.0.1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Pass through: cross-origin, netlify functions, vscode live preview noise
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/netlify/')) return;
  if (url.searchParams.has('vscode-livepreview')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Try cache first
      const cached = await cache.match(event.request);

      // 2. Try network
      try {
        const networkRes = await fetch(event.request);
        if (networkRes && networkRes.ok) {
          cache.put(event.request, networkRes.clone());
        }
        return networkRes;
      } catch {
        // Network failed — return cache if we have it, otherwise a proper 503
        if (cached) return cached;
        return new Response('Offline — resource not cached.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
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
      body:     data.body  || 'You have a new notification.',
      icon:     'Assets/Logo/icon-192.png',
      badge:    'Assets/Logo/icon-192.png',
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
        if ('focus' in c) { c.navigate(target); return c.focus(); }
      }
      return clients.openWindow(target);
    })
  );
});