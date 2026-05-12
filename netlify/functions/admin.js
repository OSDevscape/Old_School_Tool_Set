/**
 * OSTS — Admin Function (Owner Only)
 * POST { action: 'login',           password }                        → { token }
 * POST { action: 'search',          token, query }                   → { users: [] }
 * POST { action: 'update_username', token, userId, newUsername }     → { ok }
 * POST { action: 'update_password', token, userId, newPassword }     → { ok }
 * POST { action: 'delete_user',     token, userId }                  → { ok }
 *
 * Set ADMIN_PASSWORD env var in Netlify dashboard.
 * Tokens are HMAC-SHA256 signed, expire after 4 hours.
 */
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_CONFIG = {
  host:           process.env.DB_HOST     || 'sql3.freesqldatabase.com',
  port:  Number(  process.env.DB_PORT)    || 3306,
  database:       process.env.DB_NAME     || 'sql3823639',
  user:           process.env.DB_USER     || 'sql3823639',
  password:       process.env.DB_PASSWORD || 'VvNAQi7PZQ',
  connectTimeout: 8000,
};

const HEADERS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
};

const TOKEN_TTL_MS  = 4 * 60 * 60 * 1000; // 4 hours
const BCRYPT_ROUNDS = 10;

// ── Token helpers (HMAC — no DB table needed) ─────────────────────────────────
function getSecret() {
  const s = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'fallback';
  return crypto.createHash('sha256').update(s).digest();
}

function makeToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(String(exp)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const exp = Number(Buffer.from(payload, 'base64url').toString());
  return Date.now() < exp;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getConn() { return mysql.createConnection(DB_CONFIG); }
function ok(body)         { return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) }; }
function err(status, msg) { return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) }; }

function validateUsername(u) {
  if (!u || typeof u !== 'string') return 'Username is required.';
  if (u.length < 3 || u.length > 20) return 'Username must be 3–20 characters.';
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Letters, numbers and underscores only.';
  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return err(400, 'Invalid JSON'); }

  const { action } = body;

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return err(500, 'ADMIN_PASSWORD env var not set.');
    if (!body.password)  return err(400, 'Password required.');
    if (body.password !== adminPassword) return err(401, 'Incorrect password.');
    return ok({ token: makeToken() });
  }

  // ── All other actions require a valid token ───────────────────────────────
  if (!verifyToken(body.token)) return err(401, 'Invalid or expired session. Please log in again.');

  let conn;
  try {
    conn = await getConn();

    // ── SEARCH USERS ─────────────────────────────────────────────────────────
    if (action === 'search') {
      const q = (body.query || '').trim();
      if (!q) return err(400, 'Search query required.');
      const like = `%${q}%`;
      const [rows] = await conn.execute(
        `SELECT id, username, created_at FROM osts_users
         WHERE username LIKE ? ORDER BY username LIMIT 25`,
        [like]
      );
      return ok({ users: rows });
    }

    // ── UPDATE USERNAME ───────────────────────────────────────────────────────
    if (action === 'update_username') {
      const { userId, newUsername } = body;
      if (!userId) return err(400, 'userId required.');
      const uErr = validateUsername(newUsername);
      if (uErr) return err(400, uErr);

      const [existing] = await conn.execute(
        'SELECT id FROM osts_users WHERE username = ? AND id != ?', [newUsername, userId]
      );
      if (existing.length > 0) return err(409, 'Username already taken.');

      await conn.execute('UPDATE osts_users SET username = ? WHERE id = ?', [newUsername, userId]);
      return ok({ ok: true });
    }

    // ── UPDATE PASSWORD ───────────────────────────────────────────────────────
    if (action === 'update_password') {
      const { userId, newPassword } = body;
      if (!userId)      return err(400, 'userId required.');
      if (!newPassword || newPassword.length < 8)  return err(400, 'Password must be at least 8 characters.');
      if (newPassword.length > 64) return err(400, 'Password must be 64 characters or fewer.');

      const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await conn.execute('UPDATE osts_users SET password_hash = ? WHERE id = ?', [hash, userId]);
      // Invalidate all their sessions
      await conn.execute('DELETE FROM osts_sessions WHERE user_id = ?', [userId]);
      return ok({ ok: true });
    }

    // ── DELETE USER ───────────────────────────────────────────────────────────
    if (action === 'delete_user') {
      const { userId } = body;
      if (!userId) return err(400, 'userId required.');

      const [rows] = await conn.execute('SELECT username FROM osts_users WHERE id = ?', [userId]);
      if (rows.length === 0) return err(404, 'User not found.');

      await conn.execute('DELETE FROM osts_sessions WHERE user_id = ?', [userId]);
      await conn.execute('DELETE FROM osts_users WHERE id = ?', [userId]);
      return ok({ ok: true, deleted: rows[0].username });
    }

    return err(400, 'Unknown action.');

  } catch (e) {
    console.error('[admin]', e.message);
    return err(500, 'Server error: ' + e.message);
  } finally {
    conn?.end().catch(() => {});
  }
};
