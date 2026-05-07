// netlify/functions/youtube-rss.js
// Proxies YouTube RSS feeds to avoid CORS. No API key needed.

exports.handler = async (event) => {
  const CHANNELS = {
    chymistry: "UCluRk8Wb6woVZVhUroqmcrQ",
    "10boot":   "UCKsNr9yx9iMZQFt0VG3u4eA",
  };

  const name = (event.queryStringParameters?.channel || "").toLowerCase();
  const channelId = CHANNELS[name];

  if (!channelId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Unknown channel. Use ?channel=chymistry or ?channel=10boot" }),
    };
  }

  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube RSS returned ${res.status}`);
    const xml = await res.text();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",   // cache 1 hr on CDN
      },
      body: xml,
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
