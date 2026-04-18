const WINDOW_MS = 60 * 1000;     // 1 minute
const MAX_REQUESTS = 100;        // per IP per window
let bucket = {};                 // in-memory { ip: { count, resetAt } }

export default async (event, context) => {
  const ip =
    event.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    event.headers["client-ip"] ||
    "unknown";

  const now = Date.now();
  let entry = bucket[ip];

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
  }

  entry.count += 1;
  bucket[ip] = entry;

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      statusCode: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
      body: JSON.stringify({
        error: "Too Many Requests",
        message: `Rate limit is ${MAX_REQUESTS} requests per minute. Try again in ${retryAfter} seconds.`,
      }),
    };
  }

  // Under limit: redirect to actual static API file
  const targetPath = event.path.replace(
    "/.netlify/functions/api-gateway",
    ""
  );

  return {
    statusCode: 302,
    headers: {
      Location: targetPath,
    },
  };
};