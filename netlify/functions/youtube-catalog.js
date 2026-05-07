// netlify/functions/youtube-catalog.js
// Returns up to 200 most recent videos for a given channelId via YouTube Data API v3
// Query: /.netlify/functions/youtube-catalog?channelId=UCxxxxxx&maxResults=50
// Env var required: YOUTUBE_API_KEY

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const { channelId, maxResults = "50", pageToken = "" } = event.queryStringParameters || {};

  if (!channelId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "channelId required" }) };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "YOUTUBE_API_KEY not set" }) };
  }

  // Use playlistItems on the channel's uploads playlist (UC -> UU prefix swap)
  // This is cheaper (1 unit) than search.list (100 units) and returns all uploads
  const uploadsPlaylistId = "UU" + channelId.slice(2);

  const params = new URLSearchParams({
    part:        "snippet,contentDetails",
    playlistId:  uploadsPlaylistId,
    maxResults:  String(Math.min(Number(maxResults), 50)),
    key:         apiKey,
    ...(pageToken ? { pageToken } : {}),
  });

  const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, headers: CORS, body: JSON.stringify({ error: data.error?.message || "YouTube API error" }) };
    }

    const videos = (data.items || []).map(item => ({
      videoId:     item.contentDetails?.videoId || "",
      title:       item.snippet?.title          || "",
      description: (item.snippet?.description   || "").slice(0, 160),
      published:   item.snippet?.publishedAt    || "",
      thumbnail:   item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || "",
    }));

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
      body: JSON.stringify({
        videos,
        nextPageToken:  data.nextPageToken  || null,
        prevPageToken:  data.prevPageToken  || null,
        totalResults:   data.pageInfo?.totalResults || 0,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
