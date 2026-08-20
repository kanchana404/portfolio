import { describe, expect, it } from "vitest";
import { nextRuns, parseCron } from "./cron";

const fields = (expr: string) => {
  const p = parseCron(expr);
  expect(p.ok, `${expr}: ${p.error ?? ""}`).toBe(true);
  return p.fields!;
};

describe("the day-of-month / day-of-week OR", () => {
  it("ORs them when both are restricted", () => {
    // The trap. `0 0 13 * 5` is NOT "Friday the 13th": it fires on the 13th of
    // every month AND on every Friday. Getting this wrong runs a job about five
    // times more often than intended, which is the most common cron bug there is.
    const runs = nextRuns(fields("0 0 13 * 5"), new Date(2026, 0, 1), 6);
    const days = runs.map((d) => `${d.getMonth() + 1}/${d.getDate()}`);
    expect(days).toContain("1/13"); // the 13th, a Tuesday
    expect(days).toContain("1/2");  // a Friday
  });

  it("ANDs normally when only one is restricted", () => {
    // Day-of-week wildcard, so day-of-month simply applies.
    const runs = nextRuns(fields("0 0 13 * *"), new Date(2026, 0, 1), 3);
    expect(runs.every((d) => d.getDate() === 13)).toBe(true);
  });

  it("says OR in the description, not a comma", () => {
    expect(parseCron("0 0 13 * 5").description).toMatch(/ OR /);
    expect(parseCron("0 0 13 * *").description).not.toMatch(/ OR /);
  });
});

describe("parsing fields", () => {
  it("handles steps, ranges and lists", () => {
    expect(fields("*/15 * * * *")[0].values).toEqual([0, 15, 30, 45]);
    expect(fields("0 9-17 * * *")[1].values).toEqual([9,10,11,12,13,14,15,16,17]);
    expect(fields("0 0,12 * * *")[1].values).toEqual([0, 12]);
    expect(fields("0 0 * * 1-5")[4].values).toEqual([1, 2, 3, 4, 5]);
  });

  it("accepts month and day names", () => {
    expect(fields("0 0 1 JAN *")[3].values).toEqual([1]);
    expect(fields("0 0 * * MON-FRI")[4].values).toEqual([1, 2, 3, 4, 5]);
  });

  it("treats 7 as Sunday", () => {
    // Both 0 and 7 mean Sunday. A parser that rejects 7 fails on real crontabs.
    expect(fields("0 0 * * 7")[4].values).toEqual([0]);
    expect(fields("0 0 * * 0")[4].values).toEqual([0]);
  });

  it("expands the @ shorthands", () => {
    expect(parseCron("@daily").fields![1].values).toEqual([0]);
    expect(parseCron("@hourly").fields![0].values).toEqual([0]);
    expect(parseCron("@weekly").fields![4].values).toEqual([0]);
  });

  it("applies a step across a range", () => {
    expect(fields("0 0-23/6 * * *")[1].values).toEqual([0, 6, 12, 18]);
  });
});

describe("what it refuses, and how it explains", () => {
  it("insists on five fields and says how many it got", () => {
    expect(parseCron("* * * *").error).toMatch(/5 fields.*This has 4/s);
    expect(parseCron("* * * * * *").error).toMatch(/This has 6/);
  });

  it("names the offending field and its real range", () => {
    expect(parseCron("60 * * * *").error).toMatch(/minute must be between 0 and 59/);
    expect(parseCron("* 24 * * *").error).toMatch(/hour must be between 0 and 23/);
    expect(parseCron("* * 0 * *").error).toMatch(/day of month must be between 1 and 31/);
    expect(parseCron("* * * 13 *").error).toMatch(/month must be between 1 and 12/);
  });

  it("rejects a nonsense step", () => {
    expect(parseCron("*/0 * * * *").error).toMatch(/1 or more/);
    expect(parseCron("*/abc * * * *").error).toMatch(/1 or more/);
  });

  it("rejects a backwards range", () => {
    expect(parseCron("0 17-9 * * *").ok).toBe(false);
  });

  it("rejects an empty entry in a list", () => {
    expect(parseCron("0,,5 * * * *").error).toMatch(/empty entry/);
  });
});

describe("next run times", () => {
  it("starts strictly after the given moment", () => {
    const start = new Date(2026, 7, 20, 9, 0, 0);
    const [first] = nextRuns(fields("0 * * * *"), start, 1);
    expect(first.getTime()).toBeGreaterThan(start.getTime());
    expect(first.getHours()).toBe(10);
  });

  it("returns them in order and at the right interval", () => {
    const runs = nextRuns(fields("*/15 * * * *"), new Date(2026, 7, 20, 9, 0, 0), 4);
    expect(runs.map((d) => d.getMinutes())).toEqual([15, 30, 45, 0]);
  });

  it("crosses a month boundary", () => {
    const runs = nextRuns(fields("0 0 1 * *"), new Date(2026, 0, 15), 2);
    expect(runs.map((d) => d.getMonth())).toEqual([1, 2]);
  });

  it("terminates on a schedule that can never fire", () => {
    // 30 February. A brute-force search with no cap loops forever here.
    expect(nextRuns(fields("0 0 30 2 *"), new Date(2026, 0, 1), 1)).toEqual([]);
  });
});
