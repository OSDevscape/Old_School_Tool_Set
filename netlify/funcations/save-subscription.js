/**
 * OSTS — Save Push Subscription
 * POST → upsert endpoint + keys into push_subscriptions
 * Body: { endpoint, keys: { p256dh, auth }, rsn? }
 */
import { getConnection, HEADERS, optionsResponse } from './db.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { endpoint, keys, rsn = null } = body;
  const p256dh = keys?.p256dh || body.p256dh || '';
  const auth   = keys?.auth   || body.auth   || '';

  if (!endpoint || !p256dh || !auth) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing endpoint, p256dh, or auth' }) };
  }

  let conn;
  try {
    conn = await getConnection();

    await conn.execute(`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, rsn, created_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        p256dh = VALUES(p256dh),
        auth   = VALUES(auth),
        rsn    = VALUES(rsn)
    `, [endpoint, p256dh, auth, rsn || null]);

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('[save-subscription]', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  } finally {
    conn?.end().catch(() => {});
  }
};