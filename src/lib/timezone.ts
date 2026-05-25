/**
 * ═══════════════════════════════════════════════════════════════════════════
 * src/lib/timezone.ts  —  Single source of truth for timezone logic
 *
 * Canonical zone: US Eastern Time (Maryland / America/New_York)
 * - Observes DST: EST (UTC-5) in winter, EDT (UTC-4) in summer.
 * - Storage rule: Postgres stores all timestamps as UTC (timestamptz).
 *   This module handles DISPLAY and BUSINESS-LOGIC conversion only.
 * - To switch to fixed offset (UTC-5 year-round), change APP_TIMEZONE to
 *   "Etc/GMT+5" — but do NOT do this unless explicitly instructed.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** IANA identifier for the canonical application timezone. */
export const APP_TIMEZONE = "America/New_York";

/**
 * Human-readable label shown next to displayed times.
 * Uses the live abbreviation ("EST" / "EDT") from Intl.
 */
export function appTzLabel(date?: Date | string): string {
  const d = date ? (typeof date === "string" ? new Date(date) : date) : new Date();
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIMEZONE,
      timeZoneName: "short",
    })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? "ET"
  );
}

// ─── Internal helper ────────────────────────────────────────────────────────

/**
 * Convert a Date (or ISO string) into a **fake-local** Date whose
 * `.getFullYear()` / `.getMonth()` / `.getDate()` / `.getHours()` etc.
 * reflect the America/New_York wall-clock time at that instant.
 *
 * Used to bridge the gap between the Intl API and date-fns `format()`,
 * which reads local-time components. No external library required.
 *
 * Example (EDT = UTC-4):
 *   toAppTz("2026-07-04T18:00:00Z")  →  Date representing 2:00 PM July 4
 *   format(toAppTz("2026-07-04T18:00:00Z"), "h:mm a")  →  "2:00 PM"
 */
export function toAppTz(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return d;

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  return new Date(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
}

/** @deprecated Use toAppTz — kept for backwards-compat with existing call sites. */
export const toESTDate = toAppTz;

// ─── Display formatters ──────────────────────────────────────────────────────

/**
 * Primary display formatter. Mirrors the date-fns `format()` signature
 * but forces output in APP_TIMEZONE.
 *
 * Accepts the same `format` tokens recognised by date-fns because it
 * routes through `toAppTz()` first, making local-time reads correct.
 *
 * Usage: formatInAppTz(row.created_at, "MMM d, h:mm a")
 */
export function formatInAppTz(
  date: Date | string,
  formatStr: string,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  // Delegate to Intl for all known token subsets to stay library-free.
  // For full date-fns token support, call: format(toAppTz(date), formatStr)
  return formatEST(d, _tokenToIntlOpts(formatStr));
}

/** Full date + time: "May 23, 2026, 2:30 PM" */
export function formatEST(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  },
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { ...opts, timeZone: APP_TIMEZONE });
}

/** Date only: "May 23, 2026" */
export function formatESTDate(
  date: Date | string,
  fmt?: Intl.DateTimeFormatOptions,
): string {
  return formatEST(date, fmt ?? { year: "numeric", month: "short", day: "numeric" });
}

/** Time only: "2:30 PM" */
export function formatESTTime(date: Date | string): string {
  return formatEST(date, { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Time with seconds: "2:30:05 PM" */
export function formatESTTimeWithSeconds(date: Date | string): string {
  return formatEST(date, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/** Short date+time for tables: "May 23, 2:30 PM" */
export function formatESTShort(date: Date | string): string {
  return formatEST(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Business-day boundaries ────────────────────────────────────────────────

/**
 * Returns the current Eastern calendar date as a YYYY-MM-DD string.
 * Use this wherever "today" must be an Eastern calendar day.
 *
 * Example at 11:30 PM UTC = 7:30 PM Eastern (summer):
 *   new Date().toISOString().slice(0,10)  → "2026-07-05"  (UTC — WRONG)
 *   appToday()                            → "2026-07-04"  (Eastern — correct)
 */
export function appToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Returns { start, end } as UTC ISO strings bounding a given Eastern calendar day.
 * Both are inclusive-start / exclusive-end (i.e., [start, end)).
 *
 * Example for "2026-11-06" (standard time switchover night, clocks fall back):
 *   start = "2026-11-06T04:00:00.000Z"   (midnight ET = UTC-5 = 05:00 the day before,
 *                                          but this night DST ends so midnight = UTC-5)
 *   end   = "2026-11-07T05:00:00.000Z"
 *
 * @param dateStr YYYY-MM-DD in Eastern calendar. Defaults to appToday().
 */
export function appDayBounds(dateStr?: string): { start: string; end: string } {
  const d = dateStr ?? appToday();
  // Construct midnight and next-midnight as if they are local Eastern wall-clock times,
  // then find the equivalent UTC instant.
  const start = _easternWallClockToUtc(d, "00:00:00");
  const end   = _easternWallClockToUtc(nextDay(d), "00:00:00");
  return { start, end };
}

/**
 * Convenience: returns the UTC ISO boundaries for today in Eastern time.
 * Equivalent to appDayBounds(appToday()).
 */
export function appTodayBounds(): { start: string; end: string } {
  return appDayBounds(appToday());
}

/**
 * Convert a user-entered Eastern wall-clock datetime (the value from a
 * date/time <input> or picker) to a UTC ISO string for DB storage.
 *
 * @param dateStr   YYYY-MM-DD  (as the user typed, interpreted as Eastern)
 * @param timeStr   HH:MM or HH:MM:SS  (as the user typed, interpreted as Eastern)
 * @returns UTC ISO string, e.g. "2026-07-04T18:00:00.000Z"
 *
 * Saves storing naive local timestamps — the result is always UTC.
 */
export function fromAppTzToUtc(dateStr: string, timeStr: string): string {
  const seconds = timeStr.length === 5 ? "00" : timeStr.slice(6, 8);
  const hm = timeStr.slice(0, 5);
  return _easternWallClockToUtc(dateStr, `${hm}:${seconds}`);
}

/**
 * Get the current time as a UTC ISO string.
 * NOTE: Storage always in UTC — convert to ET for display.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

// ─── Internal utilities ──────────────────────────────────────────────────────

/** Increment a YYYY-MM-DD string by one calendar day. */
function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

/**
 * Decompose a UTC-millisecond timestamp into Eastern Time calendar components.
 * Works entirely in UTC arithmetic via Intl — never reads system-local Date fields.
 */
function _utcMsToETComponents(utcMs: number): {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
} {
  const d = new Date(utcMs);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  const h = get("hour");
  return {
    year: get("year"), month: get("month"), day: get("day"),
    hour: h === 24 ? 0 : h, minute: get("minute"), second: get("second"),
  };
}

/**
 * Convert a wall-clock time in Eastern time (dateStr + timeStr) to a UTC ISO string.
 * Works entirely in UTC millisecond arithmetic — never reads system-local Date components,
 * so it produces the same result regardless of the runtime's local timezone.
 *
 * Algorithm:
 *  1. Treat the ET wall-clock digits as if they were UTC (naiveUtcMs).
 *  2. Ask Intl what Eastern wall-clock that instant renders to.
 *  3. Compute the offset between the desired ET time and what Intl returned.
 *  4. Add that offset to naiveUtcMs for a first-order corrected UTC instant.
 *  5. Verify once and apply a residual correction to handle DST gap/fold edge cases.
 */
function _easternWallClockToUtc(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute, second] = timeStr.split(":").map(Number);

  // Step 1: treat the ET digits as UTC
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second ?? 0);

  // Step 2: find what Eastern wall-clock renders at naiveUtcMs
  const et1 = _utcMsToETComponents(naiveUtcMs);
  const et1Ms = Date.UTC(et1.year, et1.month - 1, et1.day, et1.hour, et1.minute, et1.second);

  // Step 3+4: offset = how much naiveUtcMs differs from the desired ET wall-clock
  const wantMs = naiveUtcMs; // the desired ET time expressed as "UTC" digits
  const deltaMs = wantMs - et1Ms;
  const correctedMs = naiveUtcMs + deltaMs;

  // Step 5: verify and apply residual (handles DST transitions)
  const et2 = _utcMsToETComponents(correctedMs);
  const et2Ms = Date.UTC(et2.year, et2.month - 1, et2.day, et2.hour, et2.minute, et2.second);
  const residualMs = wantMs - et2Ms;

  return new Date(correctedMs + residualMs).toISOString();
}

/**
 * Map a small subset of date-fns format tokens to Intl options.
 * This avoids a full date-fns-tz dependency for simple display tokens.
 * For complex tokens call: format(toAppTz(date), formatStr)
 */
function _tokenToIntlOpts(fmt: string): Intl.DateTimeFormatOptions {
  const has = (t: string) => fmt.includes(t);
  const opts: Intl.DateTimeFormatOptions = {};
  if (has("yyyy") || has("YYYY")) opts.year = "numeric";
  if (has("MMM")) opts.month = "short";
  else if (has("MM") || has("M")) opts.month = "2-digit";
  if (has("dd") || has("d") || has("D")) opts.day = "numeric";
  if (has("h") || has("H")) { opts.hour = "numeric"; opts.hour12 = has("a") || has("h"); }
  if (has("mm") || has(":mm")) opts.minute = "2-digit";
  if (has("ss")) opts.second = "2-digit";
  if (has("EEE")) opts.weekday = "short";
  return opts;
}
