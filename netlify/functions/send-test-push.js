import webpush from 'web-push';

const subscriptions = globalThis.__subscriptions || [];
globalThis.__subscriptions = subscriptions;

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async () => {
  try {
    if (!subscriptions.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'No subscriptions saved yet'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const payload = JSON.stringify({
      title: 'OSTS Test Push',
      body: 'Your Netlify push setup is working.',
      tag: 'osts-test',
      url: '/index.html'
    });

    const results = [];

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(subscription, payload);
        results.push({
          endpoint: subscription.endpoint,
          success: true
        });
      } catch (error) {
        results.push({
          endpoint: subscription.endpoint,
          success: false,
          error: error.message || 'Send failed'
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        results
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Unexpected error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};