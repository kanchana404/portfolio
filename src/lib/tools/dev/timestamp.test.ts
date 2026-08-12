import { describe, expect, it } from "vitest";
import {
  describeDate,
  detectUnit,
  formatRelative,
  parseDateString,
  parseTimestamp,
} from "./timestamp";

describe("detectUnit", () => {
  it("distinguishes the four bands by magnitude", () => {
    expect(detectUnit(1_700_000_000)).toBe("seconds");
    expect(detectUnit(1_700_000_000_000)).toBe("milliseconds");
    expect(detectUnit(1_700_000_000_000_000)).toBe("microseconds");
    expect(detectUnit(1_700_000_000_000_000_000)).toBe("nanoseconds");
  });

  it("treats small and zero values as seconds", () => {
    expect(detectUnit(0)).toBe("seconds");
    expect(detectUnit(1)).toBe("seconds");
  });

  it("treats negative pre-1970 values by magnitude too", () => {
    expect(detectUnit(-100_000)).toBe("seconds");
  });
});

describe("parseTimestamp", () => {
  it("reads a seconds timestamp", () => {
    const r = parseTimestamp("1700000000");
    expect(r.ok).toBe(true);
    expect(r.detectedUnit).toBe("seconds");
    expect(r.date?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  it("reads a milliseconds timestamp as the same instant", () => {
    const a = parseTimestamp("1700000000");
    const b = parseTimestamp("1700000000000");
    expect(a.date?.getTime()).toBe(b.date?.getTime());
    expect(b.detectedUnit).toBe("milliseconds");
  });

  it("honours an explicit unit over detection", () => {
    // 1700000000 looks like seconds, but the user may know it is millis.
    const r = parseTimestamp("1700000000", "milliseconds");
    expect(r.detectedUnit).toBe("milliseconds");
    expect(r.date?.getUTCFullYear()).toBe(1970);
  });

  it("handles epoch zero and negative (pre-1970) values", () => {
    expect(parseTimestamp("0").date?.toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(parseTimestamp("-86400").date?.toISOString()).toBe(
      "1969-12-31T00:00:00.000Z"
    );
  });

  it("strips separators people paste in", () => {
    expect(parseTimestamp("1,700,000,000").date?.getTime()).toBe(1_700_000_000_000);
    expect(parseTimestamp("1_700_000_000").date?.getTime()).toBe(1_700_000_000_000);
  });

  it("stays quiet on empty input and explains anything else", () => {
    expect(parseTimestamp("")).toEqual({ ok: false });
    const bad = parseTimestamp("yesterday");
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("1970");
  });
});

describe("parseDateString", () => {
  it("reads ISO 8601", () => {
    const r = parseDateString("2026-08-09T14:30:00Z");
    expect(r.ok).toBe(true);
    expect(r.date?.toISOString()).toBe("2026-08-09T14:30:00.000Z");
  });

  it("recommends ISO when it cannot read the input", () => {
    const r = parseDateString("not a date");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ISO 8601");
  });
});

describe("describeDate", () => {
  it("produces every representation the panel shows", () => {
    const date = new Date("2023-11-14T22:13:20.000Z");
    const views = describeDate(date, new Date("2023-11-15T22:13:20.000Z"));
    expect(views.seconds).toBe("1700000000");
    expect(views.milliseconds).toBe("1700000000000");
    expect(views.iso).toBe("2023-11-14T22:13:20.000Z");
    expect(views.utc).toContain("Tue, 14 Nov 2023");
    // dayOfWeek is derived in the *viewer's* zone, so asserting a fixed name
    // would only pass in UTC. 22:13Z on a Tuesday is already Wednesday in
    // Asia/Colombo, and both answers are correct for their reader.
    expect(
      ["Tuesday", "Wednesday"].includes(views.dayOfWeek),
      `unexpected weekday ${views.dayOfWeek}`
    ).toBe(true);
    expect(views.relative).toContain("yesterday");
    expect(views.timeZone.length).toBeGreaterThan(0);
  });
});

describe("formatRelative", () => {
  it("describes both directions in time", () => {
    expect(formatRelative(-3 * 60 * 60 * 1000)).toContain("hours ago");
    expect(formatRelative(3 * 24 * 60 * 60 * 1000)).toContain("in 3 days");
  });
  it("scales up to years", () => {
    expect(formatRelative(-3 * 365 * 24 * 60 * 60 * 1000)).toContain("years ago");
  });
});
