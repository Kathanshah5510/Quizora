/**
 * Simple in-process sliding-window rate limiter for exam endpoints.
 * NOT a substitute for a proper reverse-proxy or Redis-backed rate limiter in production.
 * Suitable for ~200 concurrent students on a single instance.
 *
 * Key: typically IP or studentId. Window: seconds. Max: requests per window.
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

// Clean up stale entries periodically (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, w] of store.entries()) {
        if (w.resetAt < now) store.delete(key);
      }
    },
    5 * 60 * 1000
  );
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  let w = store.get(key);

  if (!w || w.resetAt < now) {
    w = { count: 0, resetAt: now + windowSeconds * 1000 };
    store.set(key, w);
  }

  w.count += 1;

  if (w.count > maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((w.resetAt - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
