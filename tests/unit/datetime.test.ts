import { describe, it, expect } from "vitest";
import { datetimeLocalToUtc, utcToDatetimeLocal, APP_TIME_ZONE } from "@/lib/datetime";

// These run under TZ=UTC (see the npm test script), which is what a deployed
// server uses. The bug being guarded against: availability times shifting by
// the IST offset on every save/reload round trip.

describe("datetimeLocalToUtc", () => {
  it("interprets the input as IST wall time, not server-local time", () => {
    // 10:00 IST is 04:30 UTC
    expect(datetimeLocalToUtc("2026-09-14T10:00")!.toISOString()).toBe(
      "2026-09-14T04:30:00.000Z"
    );
  });

  it("handles a wall time that crosses the date line in UTC", () => {
    // 02:00 IST on the 14th is 20:30 UTC on the 13th
    expect(datetimeLocalToUtc("2026-09-14T02:00")!.toISOString()).toBe(
      "2026-09-13T20:30:00.000Z"
    );
  });

  it("returns null for empty or malformed input", () => {
    expect(datetimeLocalToUtc(null)).toBeNull();
    expect(datetimeLocalToUtc("")).toBeNull();
    expect(datetimeLocalToUtc("not-a-date")).toBeNull();
  });
});

describe("utcToDatetimeLocal", () => {
  it("renders a stored instant back as IST wall time", () => {
    expect(utcToDatetimeLocal("2026-09-14T04:30:00.000Z")).toBe("2026-09-14T10:00");
  });

  it("renders midnight IST without rolling the hour to 24", () => {
    // 00:00 IST on the 14th is 18:30 UTC on the 13th
    expect(utcToDatetimeLocal("2026-09-13T18:30:00.000Z")).toBe("2026-09-14T00:00");
  });

  it("returns an empty string for empty or invalid input", () => {
    expect(utcToDatetimeLocal(null)).toBe("");
    expect(utcToDatetimeLocal("nonsense")).toBe("");
  });
});

describe("round trip", () => {
  it("is stable across repeated save/reload cycles", () => {
    const typed = "2026-09-14T09:30";
    let value = typed;
    // Each iteration is one save-then-reopen of the exam settings form.
    for (let i = 0; i < 5; i++) {
      value = utcToDatetimeLocal(datetimeLocalToUtc(value));
    }
    expect(value).toBe(typed);
  });

  it("pins the zone explicitly rather than inheriting the runtime's", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Kolkata");
    // Guard: the test process is not already in IST, so a passing round trip
    // above proves the conversion is zone-pinned and not accidentally correct.
    expect(new Date().getTimezoneOffset()).toBe(0);
  });
});
