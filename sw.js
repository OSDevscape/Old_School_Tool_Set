const CACHE_NAME = 'OSTS V11.0.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(
        STATIC_ASSETS.filter(url => !url.startsWith('http') || !navigator.onLine ? true : true)
      )
    ).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.wiseoldman.net')) return; // Don't cache API calls
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return res;
    })).catch(() => caches.match('./index.html'))
  );
});

/* Firebase Messaging service worker for OSTS */
importScripts("https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
  measurementId: "__FIREBASE_MEASUREMENT_ID__"
});

const messaging = firebase.messaging();

// Runs when a push arrives and page is in background / closed
messaging.onBackgroundMessage(payload => {
  const title = payload?.notification?.title || "Timer finished";
  const options = {
    body: payload?.notification?.body || "Your timer is ready to collect.",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: payload?.fcmOptions?.link || "./"
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(clientsArr => {
        for (const client of clientsArr) {
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow(event.notification.data || "./");
      })
  );
});