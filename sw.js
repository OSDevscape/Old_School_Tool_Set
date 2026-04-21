const CACHE_NAME = "osts-cache-v5.0.0";
const APP_SHELL = [
  "./",
  "./manifest.json"
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'OSTS Notification',
      body: event.data ? event.data.text() : 'New notification'
    };
  }

  const title = data.title || 'OSTS Notification';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: 'Logo/icon-192.png',
    badge: 'Logo/icon-192.png',
    tag: data.tag || 'osts-push',
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});