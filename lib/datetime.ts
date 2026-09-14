/**
 * Timezone-explicit date handling.
 *
 * Every conversion here pins an explicit zone instead of inheriting the
 * runtime's. Without this, the same value renders as IST in the browser but
 * UTC during server rendering, and `datetime-local` strings round-trip through
 * the server shifted by the UTC offset on every save.
 */

export const APP_TIME_ZONE = "Asia/Kolkata";

/** Wall-clock fields of an instant, as seen in `timeZone`. */
function wallPartsInZone(instantMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Some engines emit hour 24 for midnight under hour12: false.
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset in ms of `timeZone` at a given instant (zone wall clock − UTC). */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const w = wallPartsInZone(instantMs, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - instantMs;
}

/**
 * Interpret a `datetime-local` string ("YYYY-MM-DDTHH:mm") as wall-clock time
 * in APP_TIME_ZONE and return the corresponding instant.
 */
export function datetimeLocalToUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;

  const asIfUtc = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5])
  );

  let utcMs = asIfUtc - zoneOffsetMs(asIfUtc, APP_TIME_ZONE);
  // Re-check against the offset actually in force at the resolved instant,
  // which differs from the initial guess across a DST boundary.
  const settled = asIfUtc - zoneOffsetMs(utcMs, APP_TIME_ZONE);
  if (settled !== utcMs) utcMs = settled;

  return new Date(utcMs);
}

/**
 * Render an instant as a `datetime-local` input value in APP_TIME_ZONE.
 * Produces the same string on the server and in the browser.
 */
export function utcToDatetimeLocal(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const w = wallPartsInZone(d.getTime(), APP_TIME_ZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}
