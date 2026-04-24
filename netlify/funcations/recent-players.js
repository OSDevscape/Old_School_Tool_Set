/**
 * OSTS — Recent Players
 * Stores and retrieves the last 5 RSNs searched across all users.
 * Uses Netlify Blobs for persistent key-value storage.
 *
 * GET  /netlify/functions/recent-players          → returns last 5 players
 * POST /netlify/functions/recent-players          → body: { rsn, type, displayName }
 */

import { getStore } from '@netlify/blobs';

const STORE_KEY  = 'recent-players-list';
const MAX_RECENT = 5;

function getPlayerStore() {
  return getStore({ name: 'osts-data', consistency: 'strong' });
}

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // ── GET ──────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const store = getPlayerStore();
      const raw   = await store.get(STORE_KEY, { type: 'text' });
      const list  = raw ? JSON.parse(raw) : [];
      return { statusCode: 200, headers, body: JSON.stringify(list) };
    } catch (err) {
      // Blobs not configured or other error — return empty gracefully
      return { statusCode: 200, headers, body: '[]' };
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const { rsn, type = 'ironman', displayName } = JSON.parse(event.body || '{}');

      if (!rsn || typeof rsn !== 'string' || rsn.length > 12) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid RSN' }) };
      }

      const store = getPlayerStore();
      const raw   = await store.get(STORE_KEY, { type: 'text' }).catch(() => null);
      let   list  = raw ? JSON.parse(raw) : [];

      const entry = {
        rsn:         displayName || rsn,
        type:        type,
        searchedAt:  new Date().toISOString(),
      };

      // Remove any existing entry for this RSN (case-insensitive), prepend new one
      list = [entry, ...list.filter(p => p.rsn.toLowerCase() !== rsn.toLowerCase())]
        .slice(0, MAX_RECENT);

      await store.set(STORE_KEY, JSON.stringify(list));

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, list }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── OPTIONS (CORS preflight) ──────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' } };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};