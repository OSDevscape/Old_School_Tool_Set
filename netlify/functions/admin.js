/**
 * OSTS — Admin Function (Owner Only)
 *
 * Actions:
 *   login              { password }
 *   --- Users ---
 *   search             { token, query }
 *   update_username    { token, userId, newUsername }
 *   update_password    { token, userId, newPassword }
 *   delete_user        { token, userId }
 *   --- Stats ---
 *   stats              { token }
 *   --- Database ---
 *   db_health          { token }
 *   clear_expired      { token }
 *   nuke_sessions      { token }
 *   --- Players ---
 *   player_lookup      { token, rsn }
 *   clear_player_cache { token, rsn }
 *   recent_searches    { token, limit? }
 *   --- Push ---
 *   push_stats         { token }
 *   broadcast          { token, title, body, url? }
 *   --- App Controls ---
 *   get_controls       { token }
 *   set_maintenance    { token, enabled, message? }
 *   set_announcement   { token, text }
 */

const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const webpush = require('web-push');

const DB_CONFIG = {
  host:           process.env.DB_HOST     || 'sql3.freesqldatabase.com',
  port:  Number(  process.env.DB_PORT)    || 3306,
  database:       process.env.DB_NAME     || 'sql3823639',
  user:           process.env.DB_USER     || 'sql3823639',
  password:       process.env.DB_PASSWORD || 'VvNAQi7PZQ',
  connectTimeout: 8000,
};

const VAPID_PUBLIC  = 'BOvZsgow2RLFTnop_8HT3ftrpx1GvpdcH1X7smdv3X9yYXxZdu0D75TF1Gq6DKckUGY6Qj9BAX6czc9w0DVaDPg';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = 'mailto:admin@osts.app';

const HEADERS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
};

const TOKEN_TTL_MS  = 4 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

function getSecret() {
  const s = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'fallback';
  return crypto.createHash('sha256').update(s).digest();
}
function makeToken() {
  const exp     = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(String(exp)).toString('base64url');
  const sig     = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false; }
  catch { return false; }
  return Date.now() < Number(Buffer.from(payload, 'base64url').toString());
}

async function getConn() { return mysql.createConnection(DB_CONFIG); }
async function tableCount(conn, table) {
  try { const [[r]] = await conn.execute(`SELECT COUNT(*) AS n FROM ${table}`); return r.n; }
  catch { return null; }
}
function ok(body)         { return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) }; }
function err(status, msg) { return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: msg }) }; }
function validateUsername(u) {
  if (!u || typeof u !== 'string') return 'Username is required.';
  if (u.length < 3 || u.length > 20) return 'Username must be 3–20 characters.';
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Letters, numbers and underscores only.';
  return null;
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS')
    return { statusCode: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: '' };
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return err(400, 'Invalid JSON'); }

  const { action } = body;

  if (action === 'login') {
    const ap = process.env.ADMIN_PASSWORD;
    if (!ap) return err(500, 'ADMIN_PASSWORD env var not set.');
    if (!body.password) return err(400, 'Password required.');
    if (body.password !== ap) return err(401, 'Incorrect password.');
    return ok({ token: makeToken() });
  }

  if (!verifyToken(body.token)) return err(401, 'Invalid or expired session. Please log in again.');

  let conn;
  try {
    conn = await getConn();

    // ── USER MANAGEMENT ───────────────────────────────────────────────────
    if (action === 'search') {
      const q = (body.query || '').trim();
      if (!q) return err(400, 'Query required.');
      const [rows] = await conn.execute(
        `SELECT id, username, created_at FROM osts_users WHERE username LIKE ? ORDER BY username LIMIT 25`,
        [`%${q}%`]
      );
      return ok({ users: rows });
    }

    if (action === 'update_username') {
      const { userId, newUsername } = body;
      if (!userId) return err(400, 'userId required.');
      const uErr = validateUsername(newUsername);
      if (uErr) return err(400, uErr);
      const [ex] = await conn.execute('SELECT id FROM osts_users WHERE username=? AND id!=?', [newUsername, userId]);
      if (ex.length > 0) return err(409, 'Username already taken.');
      await conn.execute('UPDATE osts_users SET username=? WHERE id=?', [newUsername, userId]);
      return ok({ ok: true });
    }

    if (action === 'update_password') {
      const { userId, newPassword } = body;
      if (!userId) return err(400, 'userId required.');
      if (!newPassword || newPassword.length < 8) return err(400, 'Min 8 characters.');
      if (newPassword.length > 64) return err(400, 'Max 64 characters.');
      const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await conn.execute('UPDATE osts_users SET password_hash=? WHERE id=?', [hash, userId]);
      await conn.execute('DELETE FROM osts_sessions WHERE user_id=?', [userId]);
      return ok({ ok: true });
    }

    if (action === 'delete_user') {
      const { userId } = body;
      if (!userId) return err(400, 'userId required.');
      const [rows] = await conn.execute('SELECT username FROM osts_users WHERE id=?', [userId]);
      if (!rows.length) return err(404, 'User not found.');
      await conn.execute('DELETE FROM osts_sessions WHERE user_id=?', [userId]);
      await conn.execute('DELETE FROM osts_users WHERE id=?', [userId]);
      return ok({ ok: true, deleted: rows[0].username });
    }

    // ── STATS ─────────────────────────────────────────────────────────────
    if (action === 'stats') {
      const totalUsers = await tableCount(conn, 'osts_users');
      const pushSubs   = await tableCount(conn, 'push_subscriptions');
      const [[{ activeSessions }]] = await conn.execute(
        `SELECT COUNT(*) AS activeSessions FROM osts_sessions WHERE expires_at > NOW()`
      );
      const [signups7] = await conn.execute(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count FROM osts_users
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY DATE(created_at) ORDER BY day ASC`
      );
      const [[{ signups30 }]] = await conn.execute(
        `SELECT COUNT(*) AS signups30 FROM osts_users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      );
      const [newestUsers] = await conn.execute(
        `SELECT id, username, created_at FROM osts_users ORDER BY created_at DESC LIMIT 5`
      );
      return ok({ totalUsers, activeSessions, pushSubs, signups7, signups30, newestUsers });
    }

    // ── DB HEALTH ─────────────────────────────────────────────────────────
    if (action === 'db_health') {
      const [[{ version }]] = await conn.execute('SELECT VERSION() AS version');
      const tables = {
        osts_users:         await tableCount(conn, 'osts_users'),
        osts_sessions:      await tableCount(conn, 'osts_sessions'),
        players:            await tableCount(conn, 'players'),
        recent_searches:    await tableCount(conn, 'recent_searches'),
        skill_snapshots:    await tableCount(conn, 'skill_snapshots'),
        boss_kc:            await tableCount(conn, 'boss_kc'),
        push_subscriptions: await tableCount(conn, 'push_subscriptions'),
        osts_app_controls:  await tableCount(conn, 'osts_app_controls'),
      };
      const [[{ expiredSessions }]] = await conn.execute(
        `SELECT COUNT(*) AS expiredSessions FROM osts_sessions WHERE expires_at <= NOW()`
      );
      let oldestSnapshot = null;
      try { const [[r]] = await conn.execute(`SELECT MIN(snapshot_date) AS d FROM skill_snapshots`); oldestSnapshot = r.d; } catch {}
      return ok({ version, tables, expiredSessions, oldestSnapshot });
    }

    if (action === 'clear_expired') {
      const [r] = await conn.execute(`DELETE FROM osts_sessions WHERE expires_at <= NOW()`);
      return ok({ deleted: r.affectedRows });
    }

    if (action === 'nuke_sessions') {
      const [r] = await conn.execute(`DELETE FROM osts_sessions`);
      return ok({ deleted: r.affectedRows });
    }

    // ── PLAYER DATA ───────────────────────────────────────────────────────
    if (action === 'player_lookup') {
      const rsn = (body.rsn || '').trim();
      if (!rsn) return err(400, 'RSN required.');
      const [players] = await conn.execute(
        `SELECT rsn, display_name, account_type, combat_level, total_level, total_xp, search_count
         FROM players WHERE rsn LIKE ? LIMIT 10`,
        [`%${rsn}%`]
      );
      const results = await Promise.all(players.map(async p => {
        const [[{ snapshots }]] = await conn.execute(
          `SELECT COUNT(*) AS snapshots FROM skill_snapshots WHERE rsn=?`, [p.rsn]
        ).catch(() => [[{ snapshots: 0 }]]);
        const [[{ latestSnap }]] = await conn.execute(
          `SELECT MAX(snapshot_date) AS latestSnap FROM skill_snapshots WHERE rsn=?`, [p.rsn]
        ).catch(() => [[{ latestSnap: null }]]);
        return { ...p, snapshots, latestSnap };
      }));
      return ok({ players: results });
    }

    if (action === 'clear_player_cache') {
      const rsn = (body.rsn || '').trim();
      if (!rsn) return err(400, 'RSN required.');
      const [[{ snaps }]] = await conn.execute(`SELECT COUNT(*) AS snaps FROM skill_snapshots WHERE rsn=?`, [rsn]);
      await conn.execute(`DELETE FROM skill_snapshots WHERE rsn=?`, [rsn]);
      try { await conn.execute(`DELETE FROM boss_kc WHERE rsn=?`, [rsn]); } catch {}
      return ok({ ok: true, snapshotsDeleted: snaps });
    }

    if (action === 'recent_searches') {
      const limit = Math.min(Number(body.limit) || 20, 100);
      const [rows] = await conn.execute(`
        SELECT rs.rsn, rs.searched_at, p.display_name, p.account_type, p.total_level
        FROM recent_searches rs LEFT JOIN players p ON p.rsn = rs.rsn
        ORDER BY rs.searched_at DESC LIMIT ?`, [limit]
      );
      return ok({ searches: rows });
    }

    // ── PUSH ──────────────────────────────────────────────────────────────
    if (action === 'push_stats') {
      const total = await tableCount(conn, 'push_subscriptions');
      const [recent] = await conn.execute(
        `SELECT endpoint, rsn, created_at FROM push_subscriptions ORDER BY created_at DESC LIMIT 10`
      );
      return ok({
        total,
        recent: recent.map(r => ({ ...r, endpoint: r.endpoint.substring(0, 55) + '…' }))
      });
    }

    if (action === 'broadcast') {
      const { title, body: msgBody, url = '/' } = body;
      if (!title || !msgBody) return err(400, 'title and body are required.');
      if (!VAPID_PRIVATE)     return err(500, 'VAPID_PRIVATE_KEY env var not set.');

      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
      const [subs] = await conn.execute(`SELECT endpoint, p256dh, auth FROM push_subscriptions`);
      if (!subs.length) return ok({ sent: 0, failed: 0, cleaned: 0 });

      const payload = JSON.stringify({ title, body: msgBody, url, tag: 'broadcast' });
      let sent = 0, failed = 0;
      const stale = [];

      await Promise.allSettled(subs.map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (e) {
          failed++;
          if (e.statusCode === 410) stale.push(sub.endpoint);
        }
      }));

      for (const ep of stale) {
        await conn.execute(`DELETE FROM push_subscriptions WHERE endpoint=?`, [ep]).catch(() => {});
      }
      return ok({ sent, failed, cleaned: stale.length });
    }

    // ── APP CONTROLS ──────────────────────────────────────────────────────
    if (action === 'get_controls') {
      const [rows] = await conn.execute(
        `SELECT \`key\`, \`value\` FROM osts_app_controls`
      ).catch(() => [[]]);
      const c = {};
      rows.forEach(r => { c[r.key] = r.value; });
      return ok({
        maintenance:    c.maintenance === '1',
        maintenanceMsg: c.maintenance_msg || 'Down for maintenance. Check back soon.',
        announcement:   c.announcement   || '',
      });
    }

    if (action === 'set_maintenance') {
      const enabled = body.enabled ? '1' : '0';
      const msg     = (body.message || 'Down for maintenance. Check back soon.').substring(0, 200);
      await conn.execute(
        `INSERT INTO osts_app_controls (\`key\`,\`value\`) VALUES ('maintenance',?) ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`)`,
        [enabled]
      );
      await conn.execute(
        `INSERT INTO osts_app_controls (\`key\`,\`value\`) VALUES ('maintenance_msg',?) ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`)`,
        [msg]
      );
      return ok({ ok: true });
    }

    if (action === 'set_announcement') {
      const text = (body.text || '').substring(0, 300);
      await conn.execute(
        `INSERT INTO osts_app_controls (\`key\`,\`value\`) VALUES ('announcement',?) ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`)`,
        [text]
      );
      return ok({ ok: true });
    }

    return err(400, 'Unknown action.');

  } catch (e) {
    console.error('[admin]', e.message);
    return err(500, 'Server error: ' + e.message);
  } finally {
    conn?.end().catch(() => {});
  }
};