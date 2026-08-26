import { describe, it, expect } from "vitest";
import { computeRemainingSeconds, computeTimerState } from "@/lib/exam/timer";

const BASE_NOW = new Date("2025-06-15T10:00:00Z");

describe("computeRemainingSeconds", () => {
  it("returns correct seconds when time remains", () => {
    const expiresAt = new Date("2025-06-15T11:00:00Z"); // 1 hour later
    expect(computeRemainingSeconds(expiresAt, BASE_NOW)).toBe(3600);
  });

  it("returns 0 when already expired", () => {
    const expiresAt = new Date("2025-06-15T09:00:00Z"); // 1 hour ago
    expect(computeRemainingSeconds(expiresAt, BASE_NOW)).toBe(0);
  });

  it("returns 0 at exactly expiry time", () => {
    expect(computeRemainingSeconds(BASE_NOW, BASE_NOW)).toBe(0);
  });

  it("floors partial seconds (does not round up)", () => {
    const expiresAt = new Date(BASE_NOW.getTime() + 1500); // 1.5 seconds
    expect(computeRemainingSeconds(expiresAt, BASE_NOW)).toBe(1);
  });

  it("never returns negative values", () => {
    const expiresAt = new Date(BASE_NOW.getTime() - 999999);
    expect(computeRemainingSeconds(expiresAt, BASE_NOW)).toBeGreaterThanOrEqual(0);
  });
});

describe("computeTimerState", () => {
  it("returns isExpired=false when time remains", () => {
    const expiresAt = new Date(BASE_NOW.getTime() + 60000);
    const state = computeTimerState(expiresAt, BASE_NOW);
    expect(state.isExpired).toBe(false);
    expect(state.remainingSeconds).toBe(60);
  });

  it("returns isExpired=true when expired", () => {
    const expiresAt = new Date(BASE_NOW.getTime() - 1000);
    const state = computeTimerState(expiresAt, BASE_NOW);
    expect(state.isExpired).toBe(true);
    expect(state.remainingSeconds).toBe(0);
  });

  it("includes expiresAt in the result", () => {
    const expiresAt = new Date(BASE_NOW.getTime() + 3600000);
    const state = computeTimerState(expiresAt, BASE_NOW);
    expect(state.expiresAt).toBe(expiresAt);
  });
});
