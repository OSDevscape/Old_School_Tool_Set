/**
 * OSTS — OSRS News Proxy
 * Fetches and parses the official Old School RuneScape news RSS feed.
 * Returns a clean JSON array of news items.
 */

const RSS_URL = 'https://secure.runescape.com/m=news/latest_news.rss?oldschool=true';

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const getAttr = (tag, attr) => {
      const m = block.match(new RegExp(`<${tag}[^>]*${attr}="([^"]+)"`));
      return m ? m[1] : '';
    };

    const title    = get('title');
    const link     = get('link');
    const pubDate  = get('pubDate');
    const desc     = get('description').replace(/<[^>]+>/g, '').trim().slice(0, 200);
    const thumb    = getAttr('enclosure', 'url') || getAttr('media:thumbnail', 'url') || '';
    const category = get('category');

    if (title) {
      items.push({
        title,
        link,
        description: desc,
        pubDate,
        thumbnail: thumb,
        category,
        timestamp: pubDate ? new Date(pubDate).getTime() : 0,
      });
    }
  }

  return items;
}

export const handler = async () => {
  try {
    const res = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'OSTS/2.0 (osdevscape.com)' },
    });

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: `RSS fetch failed: ${res.status}` }) };
    }

    const xml   = await res.text();
    const items = parseRSS(xml);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // cache 5 min
      },
      body: JSON.stringify(items),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'News fetch failed', details: err.message }),
    };
  }
};