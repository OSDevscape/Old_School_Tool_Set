/**
 * OSTS — Snapshot Writer
 * Called after every successful fetchPlayer() — saves today's skill
 * snapshot and latest boss KC to the database.
 *
 * POST body:
 * {
 *   rsn:        string,
 *   type:       string,
 *   skills:     { [skillId]: { level, experience, rank } },
 *   bosses:     { [bossId]:  { kills, rank, ehb } },
 *   totalLevel: number,
 *   totalXp:    number,
 * }
 */
const mysql = require('mysql2/promise');

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


exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { rsn, type = 'ironman', skills = {}, bosses = {}, totalLevel = 0, totalXp = 0 } = body;
  if (!rsn) return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing rsn' }) };

  let conn;
  try {
    conn = await getConn();

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Upsert today's skill snapshot (one row per player per day)
    const skillsJson = JSON.stringify(skills);
    await conn.execute(`
      INSERT INTO skill_snapshots (rsn, snapshot_date, total_level, total_xp, skills_json, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        total_level  = VALUES(total_level),
        total_xp     = VALUES(total_xp),
        skills_json  = VALUES(skills_json)
    `, [rsn, today, totalLevel, totalXp, skillsJson]);

    // 2. Upsert boss KC rows (one per boss)
    const bossEntries = Object.entries(bosses).filter(([, b]) => Number(b?.kills || b?.kc || 0) > 0);
    for (const [bossId, b] of bossEntries) {
      const kc      = Number(b.kills || b.kc || 0);
      const rankPos = Number(b.rank  || -1);
      const ehb     = Number(b.ehb   || 0);
      await conn.execute(`
        INSERT INTO boss_kc (rsn, boss_id, kc, rank_pos, ehb, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          kc       = VALUES(kc),
          rank_pos = VALUES(rank_pos),
          ehb      = VALUES(ehb),
          updated_at = NOW()
      `, [rsn, bossId, kc, rankPos, ehb]);
    }

    return {
      statusCode: 200,
      headers:    HEADERS,
      body:       JSON.stringify({ success: true, date: today, bossesWritten: bossEntries.length }),
    };
  } catch (err) {
    console.error('[snapshot POST]', err.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  } finally {
    conn?.end().catch(() => {});
  }
};