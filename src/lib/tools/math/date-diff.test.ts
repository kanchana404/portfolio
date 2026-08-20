import { describe, expect, it } from "vitest";
import { addMonths, diffDates, parseDateOnly } from "./date-diff";

const d = (s: string) => diffDates(s.split("|")[0], s.split("|")[1]);

describe("parsing", () => {
  it("reads a date as UTC, not local", () => {
    // Parsing "2026-01-01" with new Date() is UTC, but constructing from parts
    // is local, and west of Greenwich that lands on 31 December.
    expect(parseDateOnly("2026-01-01")).toBe(Date.UTC(2026, 0, 1));
  });

  it("rejects dates that do not exist", () => {
    // Date.UTC rolls 31 February into March rather than failing, so the only
    // way to catch it is to check the round trip.
    expect(parseDateOnly("2026-02-31")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("2025-02-29")).toBeNull(); // 2025 is not a leap year
    expect(parseDateOnly("2024-02-29")).not.toBeNull(); // 2024 is
  });

  it("rejects the wrong shape rather than guessing", () => {
    for (const bad of ["01/01/2026", "2026-1-1", "", "tomorrow"]) {
      expect(parseDateOnly(bad), bad).toBeNull();
    }
  });
});

describe("the daylight-saving trap", () => {
  it("counts whole days across a DST boundary", () => {
    // In most of Europe the clocks go forward on 29 March 2026. Subtracting
    // local timestamps and dividing by 86.4 million gives 0.958 days here,
    // which floors to 0. UTC midnights cannot drift, so this is 1.
    expect(d("2026-03-29|2026-03-30").totalDays).toBe(1);
    expect(d("2026-10-24|2026-10-26").totalDays).toBe(2);
  });
});

describe("the month-length trap", () => {
  it("uses the clamping convention, and says so", () => {
    // Two answers are defensible for 31 January to 28 February. Strict counting
    // says zero months and 28 days, because the 31st never came round.
    // Clamping says exactly one month, because 31 January plus one month *is*
    // 28 February, which is also how a subscription billed on the 31st behaves.
    //
    // This picks clamping, for one concrete reason: it is reversible. Adding
    // the reported parts back to the start date returns the end date. Strict
    // counting does not round-trip, and a duration you cannot add back is a
    // duration that will eventually disagree with whatever produced it.
    expect(d("2026-01-31|2026-02-28").parts).toEqual({ years: 0, months: 1, days: 0 });
    // The day count is unaffected by the convention and is always exact.
    expect(d("2026-01-31|2026-02-28").totalDays).toBe(28);
  });

  it("counts whole calendar months, then the remainder", () => {
    expect(d("2026-01-15|2026-03-18").parts).toEqual({ years: 0, months: 2, days: 3 });
    // 62 days, which days/30 would call "2 months 2 days".
    expect(d("2026-01-15|2026-03-18").totalDays).toBe(62);
  });

  it("borrows the real length of the preceding month", () => {
    // 31 March to 1 May: one month and one day, borrowing April's 30.
    expect(d("2026-03-31|2026-05-01").parts).toEqual({ years: 0, months: 1, days: 1 });
  });

  it("handles a full year and a leap day", () => {
    expect(d("2024-01-01|2025-01-01")).toMatchObject({
      parts: { years: 1, months: 0, days: 0 },
      totalDays: 366,
    });
  });
});

describe("inclusive versus exclusive", () => {
  it("reports both, because both are asked", () => {
    // Monday to Friday is 4 days apart and 5 days inclusive. Guessing one of
    // these is how a booking is out by a day.
    const out = d("2026-08-17|2026-08-21");
    expect(out.totalDays).toBe(4);
    expect(out.inclusiveDays).toBe(5);
  });

  it("calls the same date zero, not one", () => {
    expect(d("2026-08-20|2026-08-20")).toMatchObject({
      totalDays: 0,
      inclusiveDays: 1,
      direction: "same",
    });
  });
});

describe("weekdays and direction", () => {
  it("excludes weekends", () => {
    // Mon 17 Aug 2026 to Mon 24 Aug: 7 days, 5 of them weekdays.
    expect(d("2026-08-17|2026-08-24")).toMatchObject({ totalDays: 7, weekdays: 5 });
  });

  it("reports a backwards range without going negative", () => {
    const out = d("2026-08-24|2026-08-17");
    expect(out.direction).toBe("backward");
    expect(out.totalDays).toBe(7);
  });
});

describe("adding months", () => {
  it("clamps to the end of a short month", () => {
    // 31 January plus one month is 28 February, not 3 March.
    expect(addMonths(Date.UTC(2026, 0, 31), 1)).toBe(Date.UTC(2026, 1, 28));
    expect(addMonths(Date.UTC(2024, 0, 31), 1)).toBe(Date.UTC(2024, 1, 29));
  });

  it("crosses year boundaries in both directions", () => {
    expect(addMonths(Date.UTC(2026, 11, 15), 1)).toBe(Date.UTC(2027, 0, 15));
    expect(addMonths(Date.UTC(2026, 0, 15), -1)).toBe(Date.UTC(2025, 11, 15));
  });
});
