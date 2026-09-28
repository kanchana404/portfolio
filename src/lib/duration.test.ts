import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

// Mid-month UTC, so the reference month is September in every time zone.
const SEP_2026 = new Date(Date.UTC(2026, 8, 15, 12));

describe("formatDuration", () => {
  it("counts months inclusively, as LinkedIn does", () => {
    expect(formatDuration("Aug 2025", "Sep 2026", SEP_2026)).toBe("1 yr 2 mos");
    expect(formatDuration("Jan 2025", "Jan 2026", SEP_2026)).toBe("1 yr 1 mo");
    expect(formatDuration("Oct 2024", "Mar 2025", SEP_2026)).toBe("6 mos");
    expect(formatDuration("Mar 2025", "Mar 2025", SEP_2026)).toBe("1 mo");
    expect(formatDuration("Jan 2025", "Dec 2025", SEP_2026)).toBe("1 yr");
  });

  it("measures Present against the given date", () => {
    expect(formatDuration("Aug 2025", "Present", SEP_2026)).toBe("1 yr 2 mos");
    expect(formatDuration("Aug 2025", undefined, SEP_2026)).toBe("1 yr 2 mos");
  });

  it("accepts full month names", () => {
    expect(formatDuration("January 2019", "August 2022", SEP_2026)).toBe("3 yrs 8 mos");
  });

  it("falls back to whole years when an end has no month", () => {
    expect(formatDuration("2023", "Present", SEP_2026)).toBe("3 yrs");
    expect(formatDuration("2021", "Present", SEP_2026)).toBe("5 yrs");
    expect(formatDuration("2026", "Present", SEP_2026)).toBe("Less than a year");
    expect(formatDuration("2023", "2027", SEP_2026)).toBe("4 yrs");
  });

  it("returns null for dates it cannot read or ranges that run backwards", () => {
    expect(formatDuration("sometime", "Present", SEP_2026)).toBeNull();
    expect(formatDuration("Sep 2026", "Aug 2025", SEP_2026)).toBeNull();
    expect(formatDuration("Foo 2025", "Present", SEP_2026)).toBeNull();
  });

  it("only accepts real month names", () => {
    expect(formatDuration("Mayhem 2025", "Present", SEP_2026)).toBeNull();
    expect(formatDuration("Janvier 2025", "Present", SEP_2026)).toBeNull();
    expect(formatDuration("Sept 2025", "Present", SEP_2026)).toBe("1 yr 1 mo");
  });

  it("accepts short forms and a trailing dot", () => {
    expect(formatDuration("Jun 2025", "Present", SEP_2026)).toBe("1 yr 4 mos");
    expect(formatDuration("Jul 2025", "Present", SEP_2026)).toBe("1 yr 3 mos");
    expect(formatDuration("Sept. 2025", "Present", SEP_2026)).toBe("1 yr 1 mo");
  });

  it("counts whole calendar years when only one end has a month", () => {
    expect(formatDuration("Dec 2025", "2026", SEP_2026)).toBe("1 yr");
    expect(formatDuration("2025", "Jan 2026", SEP_2026)).toBe("1 yr");
    expect(formatDuration("Mar 2026", "2026", SEP_2026)).toBe("Less than a year");
  });

  it("returns null for a start after today or a Present start", () => {
    expect(formatDuration("Oct 2026", "Present", SEP_2026)).toBeNull();
    expect(formatDuration("Present", "Present", SEP_2026)).toBeNull();
    expect(formatDuration("now", undefined, SEP_2026)).toBeNull();
  });

  it("reads Present in UTC, so server and browser agree", () => {
    // 30 Sep 23:30 UTC is already October in Sri Lanka; the count must not move.
    const lateSep = new Date(Date.UTC(2026, 8, 30, 23, 30));
    expect(formatDuration("Aug 2025", "Present", lateSep)).toBe("1 yr 2 mos");
  });
});
