/**
 * Mobile timezone helpers — mirror of /app/src/lib/timezone.ts
 *
 * The Summit Leads CRM operates entirely in Eastern Time (America/New_York).
 * All "today", day boundaries, and human-readable date/time labels in the
 * technician app must be Eastern, regardless of the device's local timezone.
 */

export const APP_TIMEZONE = "America/New_York";

/** Returns "YYYY-MM-DD" for today's Eastern calendar day. */
export function appToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Returns "YYYY-MM-DD" for a Date's Eastern calendar day. */
export function appDateFor(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Returns the UTC ISO instants that bracket a given Eastern calendar day.
 * Pass a "YYYY-MM-DD" string. Used for Supabase `.gte / .lte` queries.
 */
export function appDayBounds(isoDay: string): { start: string; end: string } {
  // Convert YYYY-MM-DD (Eastern) to UTC bounds by computing the offset at
  // that local midnight.
  const [y, m, d] = isoDay.split("-").map(Number);
  // Pick a time well clear of any DST transition (noon ET).
  const probe = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  // Format the probe in EST to detect the offset between UTC noon-17 and ET.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const match = /GMT([+-])(\d+)(?::(\d+))?/.exec(offsetPart);
  let offsetMinutes = -300; // default EST
  if (match) {
    const sign = match[1] === "+" ? 1 : -1;
    const h = parseInt(match[2], 10) || 0;
    const mm = parseInt(match[3] || "0", 10) || 0;
    offsetMinutes = sign * (h * 60 + mm);
  }
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMinutes * 60_000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    start: new Date(startUtcMs).toISOString(),
    end: new Date(endUtcMs).toISOString(),
  };
}

/** Date object for the start of today (Eastern) as a UTC instant. */
export function startOfAppToday(): Date {
  return new Date(appDayBounds(appToday()).start);
}

/** True when two date inputs fall on the same Eastern calendar day. */
export function isSameAppDay(a: Date | string, b: Date | string): boolean {
  return appDateFor(a) === appDateFor(b);
}

/** True when a date is today in Eastern Time. */
export function isToday(d: Date | string): boolean {
  return appDateFor(d) === appToday();
}

/** Generic EST formatter. Pass Intl.DateTimeFormatOptions; timeZone is forced to ET. */
export function formatInAppTz(d: Date | string, opts: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: APP_TIMEZONE }).format(date);
}

/** Short date label e.g. "Mon, Jan 5". */
export function formatAppDateShort(d: Date | string): string {
  return formatInAppTz(d, { weekday: "short", month: "short", day: "numeric" });
}

/** Long date label e.g. "Monday, January 5, 2026". */
export function formatAppDateLong(d: Date | string): string {
  return formatInAppTz(d, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** 12-hour clock time, e.g. "3:45 PM". */
export function formatAppTime(d: Date | string): string {
  return formatInAppTz(d, { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Full timestamp e.g. "Monday, January 5, 2026, 3:45 PM ET". */
export function formatAppDateTime(d: Date | string): string {
  return (
    formatInAppTz(d, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " ET"
  );
}
