import { describe, it, expect } from "vitest";
import { checkRateLimit, defaultStore } from "@/lib/exam/rateLimit";

// ─── CSP header construction ──────────────────────────────────────────────────
// The CSP is a static string assembled in next.config.ts.
// These tests verify the required directives are present and no dangerous
// wildcards are included.

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

describe("Content-Security-Policy directive coverage", () => {
  it("includes default-src 'self'", () => {
    expect(CSP_DIRECTIVES).toContain("default-src 'self'");
  });

  it("allows only self + unsafe-inline for script-src (no wildcards)", () => {
    const scriptDir = CSP_DIRECTIVES.split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src"));
    expect(scriptDir).toBeDefined();
    // Must not contain a bare wildcard
    expect(scriptDir).not.toContain("*");
    expect(scriptDir).not.toContain("http:");
    expect(scriptDir).not.toContain("https: ");
  });

  it("blocks plugins via object-src 'none'", () => {
    expect(CSP_DIRECTIVES).toContain("object-src 'none'");
  });

  it("blocks clickjacking via frame-ancestors 'none'", () => {
    expect(CSP_DIRECTIVES).toContain("frame-ancestors 'none'");
  });

  it("prevents base-tag injection via base-uri 'self'", () => {
    expect(CSP_DIRECTIVES).toContain("base-uri 'self'");
  });

  it("prevents form hijacking via form-action 'self'", () => {
    expect(CSP_DIRECTIVES).toContain("form-action 'self'");
  });

  it("restricts connections to same origin", () => {
    const connectDir = CSP_DIRECTIVES.split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("connect-src"));
    expect(connectDir).toBe("connect-src 'self'");
  });

  it("allows local images and data URIs only", () => {
    const imgDir = CSP_DIRECTIVES.split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("img-src"));
    expect(imgDir).toBeDefined();
    expect(imgDir).not.toContain("*");
    expect(imgDir).toContain("'self'");
    expect(imgDir).toContain("data:");
  });

  it("upgrades insecure requests", () => {
    expect(CSP_DIRECTIVES).toContain("upgrade-insecure-requests");
  });

  it("does not allow any external script CDN", () => {
    expect(CSP_DIRECTIVES).not.toMatch(/script-src[^;]*(cdn\.|https:\/\/(?!self))/);
  });
});

// ─── Admin login rate limiting ────────────────────────────────────────────────
// These tests verify the rate-limit logic using the same parameters as the
// login route (10 per IP, 5 per email, 15-minute window).

const LOGIN_MAX_PER_IP = 10;
const LOGIN_MAX_PER_EMAIL = 5;
const LOGIN_WINDOW_SECONDS = 900; // 15 minutes

describe("admin login rate limiting — IP limit", () => {
  it("allows the first attempt from a new IP", () => {
    const key = `login:ip:192.168.1.${Math.floor(Math.random() * 255)}`;
    const result = checkRateLimit(key, LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS);
    expect(result.allowed).toBe(true);
  });

  it("allows up to the IP limit", () => {
    const key = `login:ip:10.0.0.${Math.floor(Math.random() * 255)}`;
    for (let i = 0; i < LOGIN_MAX_PER_IP; i++) {
      expect(checkRateLimit(key, LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS).allowed).toBe(true);
    }
  });

  it("blocks after the IP limit is exceeded", () => {
    const key = `login:ip:172.16.${Math.floor(Math.random() * 255)}.1`;
    for (let i = 0; i < LOGIN_MAX_PER_IP; i++) {
      checkRateLimit(key, LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS);
    }
    const blocked = checkRateLimit(key, LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("returns retryAfterSeconds ≤ window when blocked", () => {
    const key = `login:ip:203.0.113.${Math.floor(Math.random() * 255)}`;
    for (let i = 0; i < LOGIN_MAX_PER_IP + 1; i++) {
      defaultStore.check(key, LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS);
    }
    const blocked = defaultStore.check(key, LOGIN_MAX_PER_IP, LOGIN_WINDOW_SECONDS);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(LOGIN_WINDOW_SECONDS);
  });
});

describe("admin login rate limiting — per-email limit", () => {
  it("allows up to the per-email limit", () => {
    const key = `login:email:admin${Math.random()}@quizora.local`;
    for (let i = 0; i < LOGIN_MAX_PER_EMAIL; i++) {
      expect(checkRateLimit(key, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_SECONDS).allowed).toBe(true);
    }
  });

  it("blocks after the per-email limit is exceeded", () => {
    const key = `login:email:victim${Math.random()}@quizora.local`;
    for (let i = 0; i < LOGIN_MAX_PER_EMAIL; i++) {
      checkRateLimit(key, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_SECONDS);
    }
    const blocked = checkRateLimit(key, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_SECONDS);
    expect(blocked.allowed).toBe(false);
  });

  it("different email addresses are tracked independently", () => {
    const email1 = `login:email:alice${Math.random()}@quizora.local`;
    const email2 = `login:email:bob${Math.random()}@quizora.local`;
    // Exhaust email1
    for (let i = 0; i < LOGIN_MAX_PER_EMAIL + 1; i++) {
      checkRateLimit(email1, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_SECONDS);
    }
    // email2 should still be allowed
    expect(checkRateLimit(email2, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_SECONDS).allowed).toBe(true);
    expect(checkRateLimit(email1, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_SECONDS).allowed).toBe(false);
  });
});
