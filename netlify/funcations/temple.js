/**
 * OSTS — TempleOSRS Proxy
 * Proxies TempleOSRS API to bypass CORS restrictions.
 *
 * Query params:
 *   player   — RSN (required)
 *   endpoint — 'stats' | 'achievements' | 'gains' (default: stats)
 *   time     — period in days for gains (default: 7)
 */

const BASE = 'https://templeosrs.com/api';

const PATHS = {
  stats:        (p)    => `${BASE}/player_stats.php?player=${p}&format=json`,
  achievements: (p)    => `${BASE}/player_achievements.php?player=${p}&format=json`,
  gains:        (p, t) => `${BASE}/player_gains.php?player=${p}&time=${t}&format=json`,
};

export const handler = async (event) => {
  const { player, endpoint = 'stats', time = '7' } = event.queryStringParameters || {};

  if (!player) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing player parameter' }) };
  }

  const rsn = player.trim();
  if (!rsn || rsn.length > 12) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid player name' }) };
  }

  const pathFn = PATHS[endpoint] || PATHS.stats;
  const url    = pathFn(encodeURIComponent(rsn), time);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OSTS/2.0 (osdevscape.com)' },
    });

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: `TempleOSRS returned ${response.status}` }) };
    }

    const body = await response.text();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=120',
      },
      body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'TempleOSRS fetch failed', details: err.message }),
    };
  }
};