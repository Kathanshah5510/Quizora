/**
 * Sliding-window rate limiter with an adapter interface.
 *
 * DOCUMENTED LIMITATIONS:
 * The default implementation (InProcessStore) is process-local:
 *   - State is lost on server restart.
 *   - State is NOT shared across multiple instances (Vercel multi-region,
 *     horizontal scaling, or serverless cold starts).
 *   - A client can exceed the per-key limit by hitting different instances.
 *
 * SUITABLE FOR: single-instance deployments and local development
 * (~200 concurrent students on one process is well within this model).
 *
 * TO SCALE BEYOND SINGLE INSTANCE:
 * Implement RateLimitStore backed by Redis, Upstash, or another shared store
 * and pass it to checkRateLimit() as the optional `store` argument, or replace
 * the `defaultStore` export. The checkRateLimit() call signature is unchanged.
 */

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Implement this interface to swap in Redis, Upstash, or any shared store.
 * The interface is intentionally minimal — key/max/window in, result out.
 */
export interface RateLimitStore {
  check(key: string, maxRequests: number, windowSeconds: number): RateLimitResult;
}

// ─── In-process implementation ────────────────────────────────────────────────

interface WindowEntry {
  count: number;
  resetAt: number; // ms epoch
}

class InProcessStore implements RateLimitStore {
  private readonly map = new Map<string, WindowEntry>();

  constructor() {
    if (typeof setInterval !== "undefined") {
      // Periodic cleanup of expired windows to prevent unbounded Map growth
      setInterval(() => {
        const now = Date.now();
        for (const [key, w] of this.map.entries()) {
          if (w.resetAt < now) this.map.delete(key);
        }
      }, 5 * 60 * 1000);
    }
  }

  check(key: string, maxRequests: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    let w = this.map.get(key);

    if (!w || w.resetAt < now) {
      w = { count: 0, resetAt: now + windowSeconds * 1000 };
      this.map.set(key, w);
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
}

// ─── Singleton — swap here to change the global store ─────────────────────────

export const defaultStore: RateLimitStore = new InProcessStore();

/**
 * Check a rate limit.
 *
 * @param key         Rate-limit key (e.g. `"start:${ip}:${slug}"` or `"event:${attemptId}"`)
 * @param maxRequests Maximum requests allowed in the window
 * @param windowSeconds Window length in seconds
 * @param store       Optional store override (defaults to InProcessStore singleton)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
  store: RateLimitStore = defaultStore
): RateLimitResult {
  return store.check(key, maxRequests, windowSeconds);
}
