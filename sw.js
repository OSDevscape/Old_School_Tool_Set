const CACHE_NAME = 'osts-v2.0.0';
const APP_SHELL  = ['./', './manifest.json', './style.css'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache app shell on first fetch
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Only cache same-origin pages/assets — not API calls
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/netlify/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request).then(res => {
        if (res && res.status === 200) cache.put(event.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'OSTS Notification',
      body: event.data ? event.data.text() : 'New notification',
    };
  }

  const title   = data.title || 'OSTS Notification';
  const options = {
    body:   data.body  || 'You have a new notification.',
    icon:   'Assets/Logo/icon-192.png',
    badge:  'Assets/Logo/icon-192.png',
    tag:    data.tag   || 'osts-push',
    renotify: true,
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(targetUrl); return client.focus(); }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
