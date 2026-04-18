const VAPID_PUBLIC_KEY = 'BOvZsgow2RLFTnop_8HT3ftrpx1GvpdcH1X7smdv3X9yYXxZdu0D75TF1Gq6DKckUGY6Qj9BAX6czc9w0DVaDPg';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function saveSubscription(subscription) {
  const response = await fetch('/.netlify/functions/save-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(subscription.toJSON())
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default async function registerPush() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported');
  }

  if (!('PushManager' in window)) {
    throw new Error('Push notifications are not supported');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  if (Notification.permission === 'denied') {
    throw new Error('Notifications are blocked');
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission was not granted');
    }
  }

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  await saveSubscription(subscription);
  return subscription;
}