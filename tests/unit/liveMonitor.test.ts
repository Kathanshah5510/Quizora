import { describe, it, expect } from "vitest";

// ─── Monitor stats computation ────────────────────────────────────────────────

interface AttemptRow {
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED" | "ABANDONED";
  tabViolations: number;
}

function computeMonitorStats(enrolled: number, attempts: AttemptRow[]) {
  return {
    enrolled,
    totalAttempts: attempts.length,
    inProgress: attempts.filter((a) => a.status === "IN_PROGRESS").length,
    submitted: attempts.filter((a) => a.status === "SUBMITTED").length,
    expired: attempts.filter((a) => a.status === "EXPIRED").length,
    abandoned: attempts.filter((a) => a.status === "ABANDONED").length,
    flagged: attempts.filter((a) => a.tabViolations > 0).length,
    notStarted: Math.max(0, enrolled - attempts.length),
  };
}

describe("monitor stats computation", () => {
  it("counts in-progress attempts correctly", () => {
    const attempts: AttemptRow[] = [
      { status: "IN_PROGRESS", tabViolations: 0 },
      { status: "IN_PROGRESS", tabViolations: 1 },
      { status: "SUBMITTED", tabViolations: 0 },
    ];
    const s = computeMonitorStats(10, attempts);
    expect(s.inProgress).toBe(2);
    expect(s.submitted).toBe(1);
  });

  it("counts flagged attempts (tabViolations > 0)", () => {
    const attempts: AttemptRow[] = [
      { status: "IN_PROGRESS", tabViolations: 0 },
      { status: "SUBMITTED", tabViolations: 2 },
      { status: "EXPIRED", tabViolations: 1 },
    ];
    const s = computeMonitorStats(5, attempts);
    expect(s.flagged).toBe(2);
  });

  it("computes notStarted as enrolled minus total attempts", () => {
    const attempts: AttemptRow[] = [
      { status: "SUBMITTED", tabViolations: 0 },
      { status: "SUBMITTED", tabViolations: 0 },
    ];
    const s = computeMonitorStats(10, attempts);
    expect(s.notStarted).toBe(8);
  });

  it("notStarted never goes negative", () => {
    const attempts: AttemptRow[] = new Array(15).fill({ status: "SUBMITTED", tabViolations: 0 });
    const s = computeMonitorStats(10, attempts);
    expect(s.notStarted).toBe(0);
  });

  it("handles zero attempts", () => {
    const s = computeMonitorStats(30, []);
    expect(s.totalAttempts).toBe(0);
    expect(s.inProgress).toBe(0);
    expect(s.notStarted).toBe(30);
    expect(s.flagged).toBe(0);
  });

  it("counts expired and abandoned separately", () => {
    const attempts: AttemptRow[] = [
      { status: "EXPIRED", tabViolations: 0 },
      { status: "ABANDONED", tabViolations: 0 },
      { status: "ABANDONED", tabViolations: 0 },
    ];
    const s = computeMonitorStats(10, attempts);
    expect(s.expired).toBe(1);
    expect(s.abandoned).toBe(2);
  });

  it("flagged includes IN_PROGRESS violations", () => {
    const attempts: AttemptRow[] = [
      { status: "IN_PROGRESS", tabViolations: 1 },
    ];
    const s = computeMonitorStats(5, attempts);
    expect(s.flagged).toBe(1);
    expect(s.inProgress).toBe(1);
  });
});

// ─── Event display labels ─────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  STARTED: "Started",
  RECONNECTED: "Reconnected",
  DEVICE_CHANGED: "Device Changed",
  TAB_SWITCHED: "Tab Switched",
  VISIBILITY_CHANGED: "Visibility Changed",
  FULLSCREEN_EXITED: "Exited Full Screen",
  REFRESHED: "Refreshed Page",
  HEARTBEAT_MISSED: "Heartbeat Missed",
  AUTO_SUBMITTED: "Auto-Submitted",
  MANUALLY_SUBMITTED: "Submitted",
  TIMER_EXPIRED: "Timer Expired",
  WARNING_ISSUED: "Warning Issued",
};

const INTEGRITY_EVENTS = new Set([
  "TAB_SWITCHED",
  "VISIBILITY_CHANGED",
  "FULLSCREEN_EXITED",
  "DEVICE_CHANGED",
  "AUTO_SUBMITTED",
  "WARNING_ISSUED",
  "HEARTBEAT_MISSED",
]);

describe("event labels", () => {
  it("all event types have a label", () => {
    const types = [
      "STARTED", "RECONNECTED", "DEVICE_CHANGED", "TAB_SWITCHED",
      "VISIBILITY_CHANGED", "FULLSCREEN_EXITED", "REFRESHED",
      "HEARTBEAT_MISSED", "AUTO_SUBMITTED", "MANUALLY_SUBMITTED",
      "TIMER_EXPIRED", "WARNING_ISSUED",
    ];
    for (const t of types) {
      expect(EVENT_LABELS[t]).toBeTruthy();
    }
  });

  it("integrity events are correctly classified", () => {
    expect(INTEGRITY_EVENTS.has("TAB_SWITCHED")).toBe(true);
    expect(INTEGRITY_EVENTS.has("AUTO_SUBMITTED")).toBe(true);
    expect(INTEGRITY_EVENTS.has("WARNING_ISSUED")).toBe(true);
    expect(INTEGRITY_EVENTS.has("STARTED")).toBe(false);
    expect(INTEGRITY_EVENTS.has("MANUALLY_SUBMITTED")).toBe(false);
    expect(INTEGRITY_EVENTS.has("RECONNECTED")).toBe(false);
  });
});

// ─── Time formatting ──────────────────────────────────────────────────────────

function timeSince(isoString: string, nowMs: number): string {
  const diff = Math.floor((nowMs - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

describe("timeSince", () => {
  const base = new Date("2025-01-01T12:00:00Z").getTime();

  it("shows seconds for < 1 minute", () => {
    const t = new Date(base - 30_000).toISOString();
    expect(timeSince(t, base)).toBe("30s ago");
  });

  it("shows minutes for < 1 hour", () => {
    const t = new Date(base - 5 * 60_000).toISOString();
    expect(timeSince(t, base)).toBe("5m ago");
  });

  it("shows hours for >= 1 hour", () => {
    const t = new Date(base - 2 * 3_600_000).toISOString();
    expect(timeSince(t, base)).toBe("2h ago");
  });

  it("shows 0s for same timestamp", () => {
    const t = new Date(base).toISOString();
    expect(timeSince(t, base)).toBe("0s ago");
  });
});
