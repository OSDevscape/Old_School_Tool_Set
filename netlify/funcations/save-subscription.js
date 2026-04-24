/**
 * OSTS — Save Push Subscription Function
 * Stores Web Push subscriptions.
 * In production, persist to a database (e.g. Fauna, PlanetScale, Supabase).
 * For now, acknowledges the subscription and logs it.
 */

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const subscription = JSON.parse(event.body || '{}');

    if (!subscription.endpoint) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid subscription object' }) };
    }

    // TODO: Persist subscription to your database here.
    // Example with Fauna:
    //   const client = new faunadb.Client({ secret: process.env.FAUNA_SECRET });
    //   await client.query(q.Create(q.Collection('subscriptions'), { data: subscription }));

    console.log('[OSTS Push] Subscription saved:', subscription.endpoint.slice(0, 60) + '...');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Subscription saved' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save subscription', details: err.message }),
    };
  }
};
