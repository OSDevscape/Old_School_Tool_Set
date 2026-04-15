// Firebase Messaging bootstrap for OSTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
  measurementId: "__FIREBASE_MEASUREMENT_ID__"
};

const VAPID_KEY = "__VAPID_KEY__";

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function registerPush() {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return null;
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const reg = await navigator.serviceWorker.register("./sw.js");

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg
  });

  onMessage(messaging, payload => {
    const title = payload?.notification?.title || "Timer update";
    const body = payload?.notification?.body || "A timer needs attention.";
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  });

  console.log("FCM token:", token);
  return token;
}