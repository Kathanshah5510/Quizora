import { describe, it, expect } from "vitest";

// Pure reconnect logic extracted for unit testing
// Mirrors the logic in app/api/exam/[slug]/start/route.ts

const RECONNECT_GRACE_SECONDS = 30;

interface ReconnectCheck {
  secondsSinceActive: number;
  resumeToken: string | undefined;
  storedSessionToken: string | null;
}

type ReconnectDecision = "ALLOWED" | "DEVICE_LOCKED";

function decideReconnect(check: ReconnectCheck): ReconnectDecision {
  const { secondsSinceActive, resumeToken, storedSessionToken } = check;

  // Same browser session: caller presents the current session token
  const isSameBrowserSession =
    resumeToken != null &&
    storedSessionToken != null &&
    resumeToken === storedSessionToken;

  if (!isSameBrowserSession && secondsSinceActive < RECONNECT_GRACE_SECONDS) {
    return "DEVICE_LOCKED";
  }

  return "ALLOWED";
}

function retryAfterSeconds(secondsSinceActive: number): number {
  return Math.ceil(RECONNECT_GRACE_SECONDS - secondsSinceActive);
}

describe("reconnect decision logic", () => {
  const TOKEN = "test-session-token-abc123";

  describe("same-browser reconnect (resumeToken present and matches)", () => {
    it("allows immediately regardless of lastActiveAt recency", () => {
      expect(
        decideReconnect({
          secondsSinceActive: 2, // very recent — would normally block
          resumeToken: TOKEN,
          storedSessionToken: TOKEN,
        })
      ).toBe("ALLOWED");
    });

    it("allows when lastActiveAt is brand new (same-tab refresh)", () => {
      expect(
        decideReconnect({
          secondsSinceActive: 0,
          resumeToken: TOKEN,
          storedSessionToken: TOKEN,
        })
      ).toBe("ALLOWED");
    });

    it("allows after grace period as well", () => {
      expect(
        decideReconnect({
          secondsSinceActive: 60,
          resumeToken: TOKEN,
          storedSessionToken: TOKEN,
        })
      ).toBe("ALLOWED");
    });
  });

  describe("different device (no resumeToken)", () => {
    it("blocks within grace period", () => {
      expect(
        decideReconnect({
          secondsSinceActive: 10,
          resumeToken: undefined,
          storedSessionToken: TOKEN,
        })
      ).toBe("DEVICE_LOCKED");
    });

    it("blocks at grace period boundary (exclusive)", () => {
      expect(
        decideReconnect({
          secondsSinceActive: 29,
          resumeToken: undefined,
          storedSessionToken: TOKEN,
        })
      ).toBe("DEVICE_LOCKED");
    });

    it("allows after grace period has elapsed", () => {
      expect(
        decideReconnect({
          secondsSinceActive: 30,
          resumeToken: undefined,
          storedSessionToken: TOKEN,
        })
      ).toBe("ALLOWED");
    });

    it("allows well after grace period", () => {
      expect(
        decideReconnect({
          secondsSinceActive: 120,
          resumeToken: undefined,
          storedSessionToken: TOKEN,
        })
      ).toBe("ALLOWED");
    });
  });

  describe("wrong resumeToken (stolen/stale token)", () => {
    it("blocks within grace period if token doesn't match", () => {
      expect(
        decideReconnect({
          secondsSinceActive: 5,
          resumeToken: "wrong-token",
          storedSessionToken: TOKEN,
        })
      ).toBe("DEVICE_LOCKED");
    });

    it("allows after grace period even if token doesn't match", () => {
      // Token mismatch means it's treated as a different device,
      // but grace period elapsed → reconnect allowed
      expect(
        decideReconnect({
          secondsSinceActive: 45,
          resumeToken: "wrong-token",
          storedSessionToken: TOKEN,
        })
      ).toBe("ALLOWED");
    });
  });

  describe("no stored session token (first attempt, no previous session)", () => {
    it("blocks within grace period — treated as new device", () => {
      expect(
        decideReconnect({
          secondsSinceActive: 10,
          resumeToken: TOKEN,
          storedSessionToken: null, // DB has no session token yet
        })
      ).toBe("DEVICE_LOCKED");
    });
  });

  describe("retryAfterSeconds calculation", () => {
    it("returns correct remaining seconds", () => {
      expect(retryAfterSeconds(10)).toBe(20);
      expect(retryAfterSeconds(25)).toBe(5);
      expect(retryAfterSeconds(29.5)).toBe(1);
    });
  });
});
