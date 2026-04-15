// Firebase Messaging bootstrap for OSTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDm80SF0r5J-a71Sgev0WCCYoXMBKHIkJU",
  authDomain: "osts-198338.firebaseapp.com",
  projectId: "osts-198338",
  storageBucket: "osts-198338.firebasestorage.app",
  messagingSenderId: "1004904569319",
  appId: "1:1004904569319:web:5daba1f29eccb18fc20542",
  measurementId: "G-Y9BJM39VWS"
};

// Your Web Push (VAPID) public key from Firebase console
const VAPID_KEY =
  "BJkuWdeRzadNf4lk42HVoPA3PccrfjEiDv5H1RSN36Z4IL8WYWhxW3HROjyq2oyXchJVBDvUvQBGvxfhHMqUUaE";

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Call this once after app load (e.g. when user opens Timers)
export async function registerPush() {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return null;
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  // Register the Firebase messaging service worker
  const reg = await navigator.serviceWorker.register(
    "./firebase-messaging-sw.js"
  );

  // Get FCM token for this browser
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg
  });

  // Optional: handle foreground messages (when app is open)
  onMessage(messaging, payload => {
    const title = payload?.notification?.title || "Timer update";
    const body = payload?.notification?.body || "A timer needs attention.";
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  });

  // TODO: send `token` to your backend / Firestore so you can push timer alerts
  console.log("FCM token:", token);
  return token;
}