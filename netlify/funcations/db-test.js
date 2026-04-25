/**
 * OSTS — Database Connection Test
 * GET /netlify/functions/db-test
 * Returns connection status, server info, and table row counts.
 * REMOVE THIS FILE before going to production.
 */
import { getConnection, HEADERS } from './db.js';

export const handler = async () => {
  let conn;
  try {
    conn = await getConnection();

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