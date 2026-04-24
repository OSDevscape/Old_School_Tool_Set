// ─── OSTS Bootstrap ───────────────────────────────────────────────────────────
// registerSW()   — always called on page load, registers the service worker
// registerPush() — opt-in, called only when user enables push notifications

const VAPID_PUBLIC_KEY = 'BOvZsgow2RLFTnop_8HT3ftrpx1GvpdcH1X7smdv3X9yYXxZdu0D75TF1Gq6DKckUGY6Qj9BAX6czc9w0DVaDPg';

function urlBase64ToUint8Array(base64) {
  const pad  = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw  = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── Service Worker registration ───────────────────────────────────────────────
let _swRegistration = null;

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    _swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[OSTS] SW registered — scope:', _swRegistration.scope);

    // Check for waiting SW and notify user
    _swRegistration.addEventListener('updatefound', () => {
      const newSW = _swRegistration.installing;
      newSW?.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[OSTS] New SW ready — reload for update');
        }
      });
    });

    return _swRegistration;
  } catch (err) {
    console.warn('[OSTS] SW registration failed:', err.message);
    return null;
  }
}

// ── Push subscription (opt-in only) ──────────────────────────────────────────
async function saveSubscription(sub) {
  const res = await fetch('/netlify/functions/save-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function registerPush() {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  if (!('PushManager' in window))       throw new Error('Push not supported on this browser');
  if (Notification.permission === 'denied') throw new Error('Notifications blocked — enable in browser settings');

  // Ensure SW is registered
  const reg = _swRegistration || await registerSW();
  if (!reg) throw new Error('Service worker unavailable');

  await navigator.serviceWorker.ready;

  // Request permission if not already granted
  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') throw new Error('Notification permission denied');
  }

  // Get or create push subscription
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await saveSubscription(sub);
  return sub.endpoint;
}

// Default export kept for compatibility (registers push)
export default registerPush;