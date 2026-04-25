/**
 * OSTS — Hiscores Proxy Function
 * Proxies official OSRS hiscores API to avoid CORS restrictions.
 *
 * Query params:
 *   player  — RSN (required)
 *   type    — account type: ironman | hardcore | ultimate | regular | gim | ghcim | ugim
 */

const ENDPOINTS = {
  regular:  'https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws',
  ironman:  'https://secure.runescape.com/m=hiscore_oldschool_ironman/index_lite.ws',
  hardcore: 'https://secure.runescape.com/m=hiscore_oldschool_hardcore_ironman/index_lite.ws',
  ultimate: 'https://secure.runescape.com/m=hiscore_oldschool_ultimate/index_lite.ws',
  gim:      'https://secure.runescape.com/m=hiscore_oldschool_group_ironman/index_lite.ws',
  ghcim:    'https://secure.runescape.com/m=hiscore_oldschool_group_ironman/index_lite.ws',
  ugim:     'https://secure.runescape.com/m=hiscore_oldschool_group_ironman/index_lite.ws',
};

export const handler = async (event) => {
  const { player, type = 'ironman' } = event.queryStringParameters || {};

  if (!player) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing player parameter' }) };
  }

  const rsn = player.trim();
  if (!rsn || rsn.length > 12) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid player name' }) };
  }

  const endpoint = ENDPOINTS[type] || ENDPOINTS.ironman;
  const url = `${endpoint}?player=${encodeURIComponent(rsn)}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OSTS/2.0 (osdevscape.com)' },
    });

    if (response.status === 404) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Player not found' }) };
    }

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: `Hiscores returned ${response.status}` }) };
    }

    const csv = await response.text();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
      },
      body: JSON.stringify({ csv, player: rsn, type }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Hiscores fetch failed', details: err.message }),
    };
  }
};
