// netlify/functions/check-live.js
// Checks Twitch live status for all configured creators with a Twitch login
// Env vars required: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const TWITCH_LOGINS = ["chymistry", "10boottv"];

async function getTwitchToken(clientId, clientSecret) {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    "client_credentials",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

exports.handler = async () => {
  const clientId     = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({}) };
  }

  try {
    const token  = await getTwitchToken(clientId, clientSecret);
    const query  = TWITCH_LOGINS.map(l => `user_login=${l}`).join("&");
    const res    = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
      headers: { "Client-ID": clientId, "Authorization": `Bearer ${token}` },
    });
    const data   = await res.json();
    const result = {};

    for (const stream of (data.data || [])) {
      result[stream.user_login.toLowerCase()] = {
        title:     stream.title,
        viewers:   stream.viewer_count,
        startedAt: stream.started_at,
        game:      stream.game_name,
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({}) };
  }
};
