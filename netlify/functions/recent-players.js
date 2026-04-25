/**
 * OSTS — Recent Players
 * GET  → last 5 rows from recent_searches JOIN players
 * POST → upsert into players, insert into recent_searches
 */
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host:           process.env.DB_HOST     || 'sql3.freesqldatabase.com',
  port:  Number(  process.env.DB_PORT)    || 3306,
  database:       process.env.DB_NAME     || 'sql3823639',
  user:           process.env.DB_USER     || 'sql3823639',
  password:       process.env.DB_PASSWORD || 'VvNAQi7PZQ',
  ssl:            { rejectUnauthorized: false },
  connectTimeout: 8000,
};

async function getConn() {
  return mysql.createConnection(DB_CONFIG);
}

const HEADERS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
};


const MAX_RECENT = 5;

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, body: '' };

  // ── GET ──────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    let conn;
    try {
      conn = await getConn();
      const [rows] = await conn.execute(`
        SELECT p.rsn, p.display_name, p.account_type AS type,
               p.combat_level, p.total_level, p.total_xp,
               p.search_count, rs.searched_at
        FROM   recent_searches rs
        JOIN   players p ON p.rsn = rs.rsn
        ORDER  BY rs.searched_at DESC
        LIMIT  ?
      `, [MAX_RECENT]);

      const list = rows.map(r => ({
        rsn:         r.rsn,
        displayName: r.display_name,
        type:        r.type,
        combatLevel: r.combat_level,
        totalLevel:  r.total_level,
        totalXp:     r.total_xp,
        searchCount: r.search_count,
        searchedAt:  r.searched_at instanceof Date
          ? r.searched_at.toISOString()
          : String(r.searched_at),
      }));

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(list) };
    } catch (err) {
      console.error('[recent-players GET]', err.message);
      return { statusCode: 200, headers: HEADERS, body: '[]' };
    } finally {
      conn?.end().catch(() => {});
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { rsn, type = 'ironman', displayName, combatLevel = 3, totalLevel = 0, totalXp = 0 } = body;
    const name = (displayName || rsn || '').trim().slice(0, 12);
    if (!name) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid RSN' }) };

    let conn;
    try {
      conn = await getConn();

      // 1. Upsert into players — create or update stats + last_seen + search_count
      await conn.execute(`
        INSERT INTO players (rsn, display_name, account_type, combat_level, total_level, total_xp, first_seen, last_seen, search_count)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 1)
        ON DUPLICATE KEY UPDATE
          display_name  = VALUES(display_name),
          account_type  = VALUES(account_type),
          combat_level  = VALUES(combat_level),
          total_level   = VALUES(total_level),
          total_xp      = VALUES(total_xp),
          last_seen     = NOW(),
          search_count  = search_count + 1
      `, [name, name, type, combatLevel, totalLevel, totalXp]);

      // 2. Insert into recent_searches
      await conn.execute(`
        INSERT INTO recent_searches (rsn, searched_at) VALUES (?, NOW())
      `, [name]);

      // 3. Prune recent_searches to last 100 rows globally
      await conn.execute(`
        DELETE FROM recent_searches
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id FROM recent_searches ORDER BY searched_at DESC LIMIT 100
          ) AS keep
        )
      `);

      // 4. Return updated list for the home page
      const [rows] = await conn.execute(`
        SELECT p.rsn, p.display_name, p.account_type AS type,
               p.combat_level, p.total_level, p.total_xp,
               p.search_count, rs.searched_at
        FROM   recent_searches rs
        JOIN   players p ON p.rsn = rs.rsn
        ORDER  BY rs.searched_at DESC
        LIMIT  ?
      `, [5]);

      const list = rows.map(r => ({
        rsn:         r.rsn,
        displayName: r.display_name,
        type:        r.type,
        combatLevel: r.combat_level,
        totalLevel:  r.total_level,
        searchCount: r.search_count,
        searchedAt:  r.searched_at instanceof Date
          ? r.searched_at.toISOString()
          : String(r.searched_at),
      }));

      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true, list }) };
    } catch (err) {
      console.error('[recent-players POST]', err.message);
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
    } finally {
      conn?.end().catch(() => {});
    }
  }

  return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
};