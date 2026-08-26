import { describe, it, expect } from "vitest";

// Pure violation threshold logic — extracted for testability
const MAX_TAB_VIOLATIONS = 2;
const TAB_VIOLATION_EVENTS = ["TAB_SWITCHED", "VISIBILITY_CHANGED"] as const;

function shouldAutoSubmit(eventType: string, currentViolations: number): boolean {
  const isViolation = (TAB_VIOLATION_EVENTS as readonly string[]).includes(eventType);
  if (!isViolation) return false;
  return currentViolations + 1 >= MAX_TAB_VIOLATIONS;
}

function newViolationCount(eventType: string, currentViolations: number): number {
  const isViolation = (TAB_VIOLATION_EVENTS as readonly string[]).includes(eventType);
  return isViolation ? currentViolations + 1 : currentViolations;
}

describe("tab violation logic", () => {
  it("TAB_SWITCHED is a violation event", () => {
    expect(newViolationCount("TAB_SWITCHED", 0)).toBe(1);
  });

  it("VISIBILITY_CHANGED is a violation event", () => {
    expect(newViolationCount("VISIBILITY_CHANGED", 0)).toBe(1);
  });

  it("FULLSCREEN_EXITED is NOT a violation event", () => {
    expect(newViolationCount("FULLSCREEN_EXITED", 0)).toBe(0);
    expect(shouldAutoSubmit("FULLSCREEN_EXITED", 1)).toBe(false);
  });

  it("does not auto-submit on first violation", () => {
    expect(shouldAutoSubmit("TAB_SWITCHED", 0)).toBe(false);
  });

  it("auto-submits on second violation (MAX_TAB_VIOLATIONS reached)", () => {
    expect(shouldAutoSubmit("TAB_SWITCHED", 1)).toBe(true);
  });

  it("auto-submits on any violation at or above threshold", () => {
    expect(shouldAutoSubmit("VISIBILITY_CHANGED", 2)).toBe(true);
    expect(shouldAutoSubmit("TAB_SWITCHED", 5)).toBe(true);
  });

  it("violation count increments correctly across events", () => {
    let count = 0;
    count = newViolationCount("TAB_SWITCHED", count);
    expect(count).toBe(1);
    count = newViolationCount("VISIBILITY_CHANGED", count);
    expect(count).toBe(2);
  });
});
