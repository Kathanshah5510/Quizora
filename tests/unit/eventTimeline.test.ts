import { describe, it, expect } from "vitest";

// ─── Event timeline display logic ─────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; icon: string }> = {
  STARTED:            { label: "Exam Started",       icon: "▶"  },
  RECONNECTED:        { label: "Reconnected",        icon: "↺"  },
  DEVICE_CHANGED:     { label: "Device Changed",     icon: "⚠"  },
  TAB_SWITCHED:       { label: "Tab Switched",       icon: "⚑"  },
  VISIBILITY_CHANGED: { label: "Visibility Changed", icon: "◉"  },
  FULLSCREEN_EXITED:  { label: "Exited Full Screen", icon: "⊡"  },
  REFRESHED:          { label: "Page Refreshed",     icon: "⟳"  },
  HEARTBEAT_MISSED:   { label: "Heartbeat Missed",   icon: "✕"  },
  AUTO_SUBMITTED:     { label: "Auto-Submitted",     icon: "⚡" },
  MANUALLY_SUBMITTED: { label: "Manually Submitted", icon: "✓"  },
  TIMER_EXPIRED:      { label: "Timer Expired",      icon: "⏱"  },
  WARNING_ISSUED:     { label: "Warning Issued",     icon: "⚠"  },
};

describe("event config completeness", () => {
  const ALL_TYPES = [
    "STARTED", "RECONNECTED", "DEVICE_CHANGED", "TAB_SWITCHED",
    "VISIBILITY_CHANGED", "FULLSCREEN_EXITED", "REFRESHED",
    "HEARTBEAT_MISSED", "AUTO_SUBMITTED", "MANUALLY_SUBMITTED",
    "TIMER_EXPIRED", "WARNING_ISSUED",
  ];

  it("has a config entry for every event type", () => {
    for (const t of ALL_TYPES) {
      expect(EVENT_CONFIG[t], `Missing config for ${t}`).toBeDefined();
      expect(EVENT_CONFIG[t].label).toBeTruthy();
      expect(EVENT_CONFIG[t].icon).toBeTruthy();
    }
  });

  it("falls back gracefully for unknown event type", () => {
    const cfg = EVENT_CONFIG["UNKNOWN_TYPE"] ?? { label: "UNKNOWN_TYPE", icon: "•" };
    expect(cfg.label).toBe("UNKNOWN_TYPE");
  });
});

// ─── Elapsed time from attempt start ─────────────────────────────────────────

function elapsed(startedAt: Date, eventAt: Date): string {
  const ms = eventAt.getTime() - startedAt.getTime();
  if (ms < 0) return "before start";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `+${m}m ${sec}s` : `+${sec}s`;
}

describe("elapsed time calculation", () => {
  const start = new Date("2025-01-01T10:00:00Z");

  it("shows seconds for < 1 minute", () => {
    const event = new Date("2025-01-01T10:00:45Z");
    expect(elapsed(start, event)).toBe("+45s");
  });

  it("shows minutes and seconds for >= 1 minute", () => {
    const event = new Date("2025-01-01T10:05:30Z");
    expect(elapsed(start, event)).toBe("+5m 30s");
  });

  it("shows before start for negative elapsed", () => {
    const event = new Date("2025-01-01T09:59:59Z");
    expect(elapsed(start, event)).toBe("before start");
  });

  it("shows +0s for same timestamp", () => {
    expect(elapsed(start, start)).toBe("+0s");
  });

  it("shows +1m 0s for exactly 60 seconds", () => {
    const event = new Date("2025-01-01T10:01:00Z");
    expect(elapsed(start, event)).toBe("+1m 0s");
  });
});

// ─── Event metadata rendering ─────────────────────────────────────────────────

describe("event metadata", () => {
  it("null metadata has no entries", () => {
    const meta: Record<string, unknown> | null = null;
    expect(meta == null || Object.keys(meta).length === 0).toBe(true);
  });

  it("object metadata can be iterated", () => {
    const meta: Record<string, unknown> = { violation: 1, reason: "tab focus lost" };
    const entries = Object.entries(meta);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(["violation", 1]);
  });

  it("empty object metadata shows no detail rows", () => {
    const meta: Record<string, unknown> = {};
    expect(Object.keys(meta).length).toBe(0);
  });
});

// ─── Event chronological ordering ─────────────────────────────────────────────

describe("event ordering", () => {
  interface Event {
    id: string;
    eventType: string;
    recordedAt: string;
  }

  it("events sorted ascending produce chronological timeline", () => {
    const events: Event[] = [
      { id: "e1", eventType: "STARTED",        recordedAt: "2025-01-01T10:00:00Z" },
      { id: "e2", eventType: "TAB_SWITCHED",   recordedAt: "2025-01-01T10:05:00Z" },
      { id: "e3", eventType: "WARNING_ISSUED", recordedAt: "2025-01-01T10:05:01Z" },
      { id: "e4", eventType: "AUTO_SUBMITTED", recordedAt: "2025-01-01T10:10:00Z" },
    ];

    const sorted = [...events].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    expect(sorted.map((e) => e.id)).toEqual(["e1", "e2", "e3", "e4"]);
  });

  it("first event is always STARTED in a normal exam", () => {
    const events: Event[] = [
      { id: "e1", eventType: "STARTED",        recordedAt: "2025-01-01T10:00:00Z" },
      { id: "e2", eventType: "MANUALLY_SUBMITTED", recordedAt: "2025-01-01T10:30:00Z" },
    ];
    expect(events[0].eventType).toBe("STARTED");
  });
});

// ─── Tab violation counting ───────────────────────────────────────────────────

describe("tab violation counting from events", () => {
  type EventType = "TAB_SWITCHED" | "VISIBILITY_CHANGED" | "WARNING_ISSUED" | "STARTED" | "MANUALLY_SUBMITTED";

  interface SimpleEvent {
    eventType: EventType;
  }

  function countIntegrityEvents(events: SimpleEvent[]): number {
    return events.filter((e) =>
      ["TAB_SWITCHED", "VISIBILITY_CHANGED"].includes(e.eventType)
    ).length;
  }

  it("counts tab switches correctly", () => {
    const events: SimpleEvent[] = [
      { eventType: "STARTED" },
      { eventType: "TAB_SWITCHED" },
      { eventType: "VISIBILITY_CHANGED" },
      { eventType: "TAB_SWITCHED" },
      { eventType: "MANUALLY_SUBMITTED" },
    ];
    expect(countIntegrityEvents(events)).toBe(3);
  });

  it("returns 0 when no integrity events", () => {
    const events: SimpleEvent[] = [
      { eventType: "STARTED" },
      { eventType: "MANUALLY_SUBMITTED" },
    ];
    expect(countIntegrityEvents(events)).toBe(0);
  });
});
