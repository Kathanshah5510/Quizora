import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkRateLimit,
  defaultStore,
  type RateLimitStore,
  type RateLimitResult,
} from "@/lib/exam/rateLimit";

// ─── Mock clock ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useRealTimers();
});

// ─── In-process store (default) ───────────────────────────────────────────────

describe("InProcessStore (defaultStore)", () => {
  it("allows the first request", () => {
    const result = defaultStore.check(`test:${crypto.randomUUID()}`, 5, 60);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("blocks after maxRequests is exceeded", () => {
    const key = `burst:${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) defaultStore.check(key, 3, 60);
    const blocked = defaultStore.check(key, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("allows exactly maxRequests in the window", () => {
    const key = `exact:${crypto.randomUUID()}`;
    const results = Array.from({ length: 5 }, () => defaultStore.check(key, 5, 60));
    expect(results.every((r) => r.allowed)).toBe(true);
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    const key = `window:${crypto.randomUUID()}`;
    // Exhaust the window
    for (let i = 0; i < 2; i++) defaultStore.check(key, 2, 1);
    expect(defaultStore.check(key, 2, 1).allowed).toBe(false);
    // Advance past window
    vi.advanceTimersByTime(1100);
    expect(defaultStore.check(key, 2, 1).allowed).toBe(true);
    vi.useRealTimers();
  });

  it("different keys are tracked independently", () => {
    const key1 = `k1:${crypto.randomUUID()}`;
    const key2 = `k2:${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) defaultStore.check(key1, 3, 60);
    expect(defaultStore.check(key1, 3, 60).allowed).toBe(false);
    expect(defaultStore.check(key2, 3, 60).allowed).toBe(true);
  });

  it("retryAfterSeconds is positive when blocked", () => {
    const key = `retry:${crypto.randomUUID()}`;
    for (let i = 0; i < 1; i++) defaultStore.check(key, 1, 30);
    const blocked = defaultStore.check(key, 1, 30);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(30);
  });
});

// ─── checkRateLimit() passes store argument ────────────────────────────────────

describe("checkRateLimit() with custom store", () => {
  it("calls the provided store instead of the default", () => {
    const mockStore: RateLimitStore = {
      check: vi.fn().mockReturnValue({ allowed: false, retryAfterSeconds: 42 } satisfies RateLimitResult),
    };
    const result = checkRateLimit("any-key", 10, 60, mockStore);
    expect(mockStore.check).toHaveBeenCalledWith("any-key", 10, 60);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(42);
  });

  it("uses defaultStore when no store argument is given", () => {
    const key = `default:${crypto.randomUUID()}`;
    const result = checkRateLimit(key, 5, 60);
    expect(result.allowed).toBe(true);
  });
});

// ─── RateLimitStore interface: custom implementation ──────────────────────────

describe("RateLimitStore interface", () => {
  it("accepts an arbitrary implementation that always allows", () => {
    const alwaysAllow: RateLimitStore = {
      check: () => ({ allowed: true, retryAfterSeconds: 0 }),
    };
    const result = checkRateLimit("any", 1, 1, alwaysAllow);
    expect(result.allowed).toBe(true);
  });

  it("accepts an arbitrary implementation that always blocks", () => {
    const alwaysBlock: RateLimitStore = {
      check: () => ({ allowed: false, retryAfterSeconds: 999 }),
    };
    const result = checkRateLimit("any", 100, 60, alwaysBlock);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(999);
  });
});
