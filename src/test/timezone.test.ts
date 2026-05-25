/**
 * Unit tests for src/lib/timezone.ts
 *
 * Covers:
 *  - Winter (EST = UTC-5) and summer (EDT = UTC-4) display
 *  - DST transition boundaries (spring-forward March, fall-back November)
 *  - Round-trip: Eastern wall-clock input → UTC stored → Eastern displayed
 *  - Eastern "today" boundary: 11 PM Eastern = next UTC day
 *  - appDayBounds: correct UTC range for an Eastern calendar day
 *  - fromAppTzToUtc / toAppTz inverse relationship
 */

import { describe, it, expect } from "vitest";
import {
  APP_TIMEZONE,
  appToday,
  appDayBounds,
  appTodayBounds,
  fromAppTzToUtc,
  toAppTz,
  formatEST,
  formatESTDate,
  formatESTTime,
  appTzLabel,
} from "@/lib/timezone";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a UTC ISO string from explicit components. */
function utc(year: number, month: number, day: number, hour = 0, min = 0, sec = 0): string {
  return new Date(Date.UTC(year, month - 1, day, hour, min, sec)).toISOString();
}

// ─── APP_TIMEZONE constant ───────────────────────────────────────────────────

describe("APP_TIMEZONE", () => {
  it('is "America/New_York"', () => {
    expect(APP_TIMEZONE).toBe("America/New_York");
  });
});

// ─── formatEST — display layer ───────────────────────────────────────────────

describe("formatEST — winter (EST = UTC-5)", () => {
  const winterUtc = utc(2026, 1, 15, 18, 30, 0); // 2026-01-15 18:30 UTC = 1:30 PM EST

  it("renders 1:30 PM on Jan 15", () => {
    const result = formatEST(winterUtc, { hour: "numeric", minute: "2-digit", hour12: true });
    expect(result).toMatch(/1:30\s*PM/i);
  });

  it("renders Jan 15 (not Jan 16 UTC)", () => {
    const result = formatESTDate(winterUtc);
    expect(result).toMatch(/Jan(uary)? 15/i);
  });

  it("appTzLabel is EST in winter", () => {
    expect(appTzLabel(winterUtc)).toBe("EST");
  });
});

describe("formatEST — summer (EDT = UTC-4)", () => {
  const summerUtc = utc(2026, 7, 4, 18, 0, 0); // 2026-07-04 18:00 UTC = 2:00 PM EDT

  it("renders 2:00 PM on Jul 4", () => {
    const result = formatEST(summerUtc, { hour: "numeric", minute: "2-digit", hour12: true });
    expect(result).toMatch(/2:00\s*PM/i);
  });

  it("renders Jul 4 (not Jul 5 UTC)", () => {
    const result = formatESTDate(summerUtc);
    expect(result).toMatch(/Jul(y)? 4/i);
  });

  it("appTzLabel is EDT in summer", () => {
    expect(appTzLabel(summerUtc)).toBe("EDT");
  });
});

// ─── DST transitions ─────────────────────────────────────────────────────────

describe("DST spring-forward (second Sunday in March 2026 = Mar 8)", () => {
  // At 2026-03-08 07:00 UTC, Eastern clocks spring from 1:59 AM → 3:00 AM (gap 2–3 AM)
  // 07:00 UTC = 2:00 AM EST — the last minute before spring-forward
  const justBeforeSpring = utc(2026, 3, 8, 6, 59, 0); // 1:59 AM EST
  // 07:00 UTC = 3:00 AM EDT — immediately after
  const justAfterSpring = utc(2026, 3, 8, 7, 0, 0); // 3:00 AM EDT

  it("1:59 AM EST before spring-forward", () => {
    const r = formatEST(justBeforeSpring, { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(r).toMatch(/01:59/);
  });

  it("3:00 AM EDT after spring-forward (2 AM skipped)", () => {
    const r = formatEST(justAfterSpring, { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(r).toMatch(/03:00/);
  });
});

describe("DST fall-back (first Sunday in November 2026 = Nov 1)", () => {
  // At 2026-11-01 05:59 UTC = 1:59 AM EDT (still summer)
  // At 2026-11-01 06:00 UTC = 1:00 AM EST (clocks fall back)
  const justBeforeFall = utc(2026, 11, 1, 5, 59, 0);
  const justAfterFall  = utc(2026, 11, 1, 6, 0, 0);

  it("1:59 AM before fall-back (EDT)", () => {
    const r = formatEST(justBeforeFall, { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(r).toMatch(/01:59/);
    expect(appTzLabel(justBeforeFall)).toBe("EDT");
  });

  it("1:00 AM after fall-back (EST)", () => {
    const r = formatEST(justAfterFall, { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(r).toMatch(/01:00/);
    expect(appTzLabel(justAfterFall)).toBe("EST");
  });
});

// ─── toAppTz ─────────────────────────────────────────────────────────────────

describe("toAppTz", () => {
  it("converts UTC summer noon to correct ET wall-clock", () => {
    const utcDate = new Date(utc(2026, 7, 4, 18, 0, 0)); // 18:00 UTC = 14:00 EDT
    const et = toAppTz(utcDate);
    expect(et.getHours()).toBe(14);
    expect(et.getMinutes()).toBe(0);
    expect(et.getDate()).toBe(4);
    expect(et.getMonth()).toBe(6); // July = 6 (0-indexed)
  });

  it("converts UTC winter midnight to previous ET day", () => {
    // 2026-03-01 03:00 UTC = 2026-02-28 22:00 EST
    const utcDate = new Date(utc(2026, 3, 1, 3, 0, 0));
    const et = toAppTz(utcDate);
    expect(et.getHours()).toBe(22);
    expect(et.getDate()).toBe(28);
    expect(et.getMonth()).toBe(1); // February = 1 (0-indexed)
  });

  it("handles invalid date gracefully", () => {
    const bad = toAppTz("not-a-date");
    expect(isNaN(bad.getTime())).toBe(true);
  });
});

// ─── fromAppTzToUtc — input layer ────────────────────────────────────────────

describe("fromAppTzToUtc", () => {
  it("converts 2:00 PM Eastern summer (EDT = UTC-4) to 18:00 UTC", () => {
    const utcIso = fromAppTzToUtc("2026-07-04", "14:00");
    expect(utcIso).toMatch(/^2026-07-04T18:00:00/);
  });

  it("converts 2:00 PM Eastern winter (EST = UTC-5) to 19:00 UTC", () => {
    const utcIso = fromAppTzToUtc("2026-01-15", "14:00");
    expect(utcIso).toMatch(/^2026-01-15T19:00:00/);
  });

  it("handles HH:MM:SS input", () => {
    const utcIso = fromAppTzToUtc("2026-07-04", "14:30:00");
    expect(utcIso).toMatch(/^2026-07-04T18:30:00/);
  });
});

// ─── Round-trip ───────────────────────────────────────────────────────────────

describe("Round-trip: Eastern input → UTC → Eastern display", () => {
  it("winter: 3:00 PM EST entered, stored UTC, displayed back as 3:00 PM", () => {
    const stored = fromAppTzToUtc("2026-01-15", "15:00");
    const displayed = formatEST(stored, { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(displayed).toMatch(/15:00/);
  });

  it("summer: 9:30 AM EDT entered, stored UTC, displayed back as 9:30 AM", () => {
    const stored = fromAppTzToUtc("2026-07-04", "09:30");
    const displayed = formatEST(stored, { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(displayed).toMatch(/09:30/);
  });

  it("toAppTz round-trip recovers original wall-clock", () => {
    const stored = fromAppTzToUtc("2026-08-20", "17:45");
    const et = toAppTz(stored);
    expect(et.getHours()).toBe(17);
    expect(et.getMinutes()).toBe(45);
  });
});

// ─── appToday — Eastern calendar day ─────────────────────────────────────────

describe("appToday", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(appToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches Intl formatting of current ET date", () => {
    const expected = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    expect(appToday()).toBe(expected);
  });
});

// ─── appDayBounds — daily queue bucketing ────────────────────────────────────

describe("appDayBounds", () => {
  it("summer: Jul 4 ET midnight = Jul 4 04:00 UTC", () => {
    const { start } = appDayBounds("2026-07-04");
    expect(start).toMatch(/^2026-07-04T04:00:00/);
  });

  it("summer: Jul 4 ET end = Jul 5 04:00 UTC", () => {
    const { end } = appDayBounds("2026-07-04");
    expect(end).toMatch(/^2026-07-05T04:00:00/);
  });

  it("winter: Jan 15 ET midnight = Jan 15 05:00 UTC", () => {
    const { start } = appDayBounds("2026-01-15");
    expect(start).toMatch(/^2026-01-15T05:00:00/);
  });

  it("winter: Jan 15 ET end = Jan 16 05:00 UTC", () => {
    const { end } = appDayBounds("2026-01-15");
    expect(end).toMatch(/^2026-01-16T05:00:00/);
  });

  it("A UTC timestamp at 11 PM ET is inside that ET day", () => {
    // 2026-07-04 23:30 EDT = 2026-07-05 03:30 UTC
    const utcTs = utc(2026, 7, 5, 3, 30, 0);
    const { start, end } = appDayBounds("2026-07-04");
    expect(utcTs >= start).toBe(true);
    expect(utcTs < end).toBe(true);
  });

  it("A UTC timestamp at 11 PM ET is NOT in the next ET day", () => {
    const utcTs = utc(2026, 7, 5, 3, 30, 0); // 11:30 PM EDT on Jul 4
    const { start } = appDayBounds("2026-07-05");
    expect(utcTs < start).toBe(true);
  });

  it("DST fall-back day (Nov 1 2026) spans 25 hours in UTC", () => {
    // Nov 1 2026: clocks fall back — day starts at UTC-4 (EDT) and ends at UTC-5 (EST)
    // so the ET day is 25 hours long: starts 2026-11-01T04:00Z, ends 2026-11-02T05:00Z
    const { start, end } = appDayBounds("2026-11-01");
    const startMs = new Date(start).getTime();
    const endMs   = new Date(end).getTime();
    const hoursSpanned = (endMs - startMs) / (1000 * 60 * 60);
    expect(hoursSpanned).toBe(25);
  });

  it("DST spring-forward day (Mar 8 2026) spans 23 hours in UTC", () => {
    const { start, end } = appDayBounds("2026-03-08");
    const hoursSpanned = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
    expect(hoursSpanned).toBe(23);
  });
});

// ─── appTodayBounds ───────────────────────────────────────────────────────────

describe("appTodayBounds", () => {
  it("is equivalent to appDayBounds(appToday())", () => {
    const fromConvenience = appTodayBounds();
    const fromExplicit    = appDayBounds(appToday());
    expect(fromConvenience.start).toBe(fromExplicit.start);
    expect(fromConvenience.end).toBe(fromExplicit.end);
  });
});
