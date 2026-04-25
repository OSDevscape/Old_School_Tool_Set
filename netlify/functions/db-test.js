/**
 * OSTS — Database Connection Test
 * GET /netlify/functions/db-test
 * Returns connection status, server info, and table row counts.
 * REMOVE THIS FILE before going to production.
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


export const handler = async () => {
  let conn;
  try {
    conn = await getConn();

    const [[{ version }]]   = await conn.execute('SELECT VERSION() AS version');
    const [[{ players }]]   = await conn.execute('SELECT COUNT(*) AS players FROM players');
    const [[{ searches }]]  = await conn.execute('SELECT COUNT(*) AS searches FROM recent_searches');
    const [[{ snapshots }]] = await conn.execute('SELECT COUNT(*) AS snapshots FROM skill_snapshots');
    const [[{ bosses }]]    = await conn.execute('SELECT COUNT(*) AS bosses FROM boss_kc');
    const [[{ pushes }]]    = await conn.execute('SELECT COUNT(*) AS pushes FROM push_subscriptions');

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        status:  'connected',
        version,
        tables: { players, searches, snapshots, bosses, pushes },
      }, null, 2),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        status:  'error',
        message: err.message,
        code:    err.code,
        hint:    err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED'
          ? 'FreeSQLDatabase may be blocking Netlify IPs. Log into freesqldatabase.com and check if remote access / IP whitelist is required.'
          : 'Check DB_HOST, DB_NAME, DB_USER, DB_PASSWORD env vars in Netlify dashboard.',
      }, null, 2),
    };
  } finally {
    conn?.end().catch(() => {});
  }
};