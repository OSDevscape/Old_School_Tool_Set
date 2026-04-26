/**
 * OSTS — Skill Advice Proxy
 * Proxies requests to the Anthropic API to bypass CORS.
 * POST body: { skill, level, xp, xpTo99 }
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

exports.handler = async function(event) {
  const HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { skill = 'Attack', level = 1, xp = 0, xpTo99 = 13034431 } = body;

  const prompt = `You are an Old School RuneScape expert coach. A player has level ${level} ${skill} with ${Number(xp).toLocaleString()} XP. They need ${Number(xpTo99).toLocaleString()} XP to reach 99.

Respond ONLY with a JSON object, no other text, no markdown:
{
  "advice": "2-3 sentences of personal specific advice for this exact level ${level} ${skill} player. Be encouraging and reference their specific level range.",
  "methods": [
    {
      "name": "Method name",
      "minLevel": number,
      "xpRate": "~XX,XXX XP/hr",
      "description": "One sentence on why this suits level ${level}."
    }
  ]
}

Include 3-4 training methods available at level ${level} or below, sorted by XP rate descending. Be accurate to OSRS mechanics.`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: res.status, headers: HEADERS, body: JSON.stringify({ error: err }) };
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ text }) };

  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};