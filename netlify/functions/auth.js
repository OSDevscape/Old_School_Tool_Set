/**
 * OSTS — Auth
 * POST { action: 'register', username, password } → { token, username, userId }
 * POST { action: 'login',    username, password } → { token, username, userId }
 * POST { action: 'verify',   token }             → { valid, username, userId }
 * POST { action: 'delete',   token, password }   → { deleted: true }
 */
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');

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

const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 10;

async function getConn() {
  return mysql.createConnection(DB_CONFIG);
}

function ok(body)    { return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) }; }
function created(body) { return { statusCode: 201, headers: HEADERS, body: JSON.stringify(body) }; }
function err(status, msg) { return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) }; }

function genToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex
}

function validateUsername(u) {
  if (!u || typeof u !== 'string') return 'Username is required.';
  if (u.length < 3 || u.length > 20) return 'Username must be 3–20 characters.';
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Username can only contain letters, numbers, and underscores.';
  if (/^\d+$/.test(u)) return 'Username cannot be purely numeric.';
  return null;
}

function validatePassword(p) {
  if (!p || typeof p !== 'string') return 'Password is required.';
  if (p.length < 8) return 'Password must be at least 8 characters.';
  if (p.length > 64) return 'Password must be 64 characters or fewer.';
  return null;
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return err(400, 'Invalid JSON'); }

  const { action } = body;
  let conn;

  try {
    conn = await getConn();

    // ── REGISTER ────────────────────────────────────────────────────────────
    if (action === 'register') {
      const { username, password } = body;

      const uErr = validateUsername(username);
      if (uErr) return err(400, uErr);
      const pErr = validatePassword(password);
      if (pErr) return err(400, pErr);

      // Check username taken
      const [existing] = await conn.execute(
        'SELECT id FROM osts_users WHERE username = ?', [username]
      );
      if (existing.length > 0) return err(409, 'Username already taken.');

      const hash    = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const [result] = await conn.execute(
        'INSERT INTO osts_users (username, password_hash) VALUES (?, ?)', [username, hash]
      );
      const userId = result.insertId;

      const token   = genToken();
      const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
      await conn.execute(
        'INSERT INTO osts_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
        [token, userId, expires]
      );

      return created({ token, username, userId });
    }

    // ── LOGIN ────────────────────────────────────────────────────────────────
    if (action === 'login') {
      const { username, password } = body;
      if (!username || !password) return err(400, 'Username and password are required.');

      const [rows] = await conn.execute(
        'SELECT id, username, password_hash FROM osts_users WHERE username = ?', [username]
      );
      if (rows.length === 0) return err(401, 'Invalid username or password.');

      const user  = rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return err(401, 'Invalid username or password.');

      // Clean up old sessions for this user
      await conn.execute(
        'DELETE FROM osts_sessions WHERE user_id = ? AND expires_at < NOW()', [user.id]
      );

      const token   = genToken();
      const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
      await conn.execute(
        'INSERT INTO osts_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
        [token, user.id, expires]
      );

      return ok({ token, username: user.username, userId: user.id });
    }

    // ── VERIFY ───────────────────────────────────────────────────────────────
    if (action === 'verify') {
      const { token } = body;
      if (!token) return err(400, 'Token is required.');

      const [rows] = await conn.execute(`
        SELECT s.token, u.id AS userId, u.username
        FROM   osts_sessions s
        JOIN   osts_users u ON u.id = s.user_id
        WHERE  s.token = ? AND s.expires_at > NOW()
      `, [token]);

      if (rows.length === 0) return err(401, 'Session expired or invalid.');
      const { userId, username } = rows[0];
      return ok({ valid: true, userId, username });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { token, password } = body;
      if (!token || !password) return err(400, 'Token and password are required.');

      // Verify session
      const [sessionRows] = await conn.execute(`
        SELECT u.id, u.username, u.password_hash
        FROM   osts_sessions s
        JOIN   osts_users u ON u.id = s.user_id
        WHERE  s.token = ? AND s.expires_at > NOW()
      `, [token]);
      if (sessionRows.length === 0) return err(401, 'Session expired. Please log in again.');

      const user  = sessionRows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return err(403, 'Incorrect password.');

      // Delete sessions then user (cascade handles sessions if FK set up)
      await conn.execute('DELETE FROM osts_sessions WHERE user_id = ?', [user.id]);
      await conn.execute('DELETE FROM osts_users WHERE id = ?', [user.id]);

      return ok({ deleted: true, username: user.username });
    }

    return err(400, 'Unknown action.');

  } catch (e) {
    console.error('[auth]', e.message);
    return err(500, 'Server error: ' + e.message);
  } finally {
    conn?.end().catch(() => {});
  }
};
