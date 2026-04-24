/**
 * OSTS — Recent Players (Global)
 * Stores the last 5 RSNs searched by ANY user, globally.
 * Uses Netlify Blobs in production; returns empty gracefully on localhost.
 *
 * GET  → returns last 5 global players
 * POST → { rsn, type, displayName } — prepends to global list
 */

const MAX_RECENT = 5;
const STORE_KEY  = 'recent-players-list';

const HEADERS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
};

// Lazy-load Blobs so the function doesn't hard-crash when the env isn't set up
async function getStore() {
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name: 'osts-data', consistency: 'strong' });
}

async function readList(store) {
  try {
    const raw = await store.get(STORE_KEY, { type: 'text' });
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeList(store, list) {
  await store.set(STORE_KEY, JSON.stringify(list));
}

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' },
      body: '',
    };
  }

  // ── GET ──────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const store = await getStore();
      const list  = await readList(store);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(list) };
    } catch (err) {
      // Blobs not available (local dev) — return empty list, don't crash
      console.warn('[recent-players] GET fallback (no Blobs):', err.message);
      return { statusCode: 200, headers: HEADERS, body: '[]' };
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { rsn, type = 'ironman', displayName } = body;
    const name = (displayName || rsn || '').trim();

    if (!name || name.length > 12) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid RSN' }) };
    }

    const entry = {
      rsn:        name,
      type:       type || 'ironman',
      searchedAt: new Date().toISOString(),
    };

    try {
      const store = await getStore();
      let list    = await readList(store);

      // Deduplicate by RSN (case-insensitive), prepend new entry, cap at MAX_RECENT
      list = [
        entry,
        ...list.filter(p => p.rsn.toLowerCase() !== name.toLowerCase()),
      ].slice(0, MAX_RECENT);

      await writeList(store, list);

      return {
        statusCode: 200,
        headers:    HEADERS,
        body:       JSON.stringify({ success: true, list }),
      };
    } catch (err) {
      // Blobs not available — acknowledge the write so the client doesn't error
      console.warn('[recent-players] POST fallback (no Blobs):', err.message);
      return {
        statusCode: 200,
        headers:    HEADERS,
        body:       JSON.stringify({ success: false, reason: 'Blobs unavailable', entry }),
      };
    }
  }

  return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};