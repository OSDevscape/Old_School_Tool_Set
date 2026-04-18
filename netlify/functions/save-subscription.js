const subscriptions = globalThis.__subscriptions || [];
globalThis.__subscriptions = subscriptions;

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method Not Allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const subscription = await request.json();

    if (
      !subscription ||
      !subscription.endpoint ||
      !subscription.keys ||
      !subscription.keys.auth ||
      !subscription.keys.p256dh
    ) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid subscription payload' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const exists = subscriptions.some(
      (sub) => sub.endpoint === subscription.endpoint
    );

    if (!exists) {
      subscriptions.push(subscription);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        saved: true,
        count: subscriptions.length
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
        error: error.message || 'Failed to save subscription'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};