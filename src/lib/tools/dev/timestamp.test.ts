import { describe, expect, it } from "vitest";
import { detectUnit, format, parseDate, parseEpoch, relativeTo } from "./timestamp";

describe("the seconds-or-milliseconds guess", () => {
  it("reads a ten-digit epoch as seconds and a thirteen-digit one as milliseconds", () => {
    // The same instant, written both ways. Getting this wrong is the entire
    // failure mode of a timestamp converter: 1970 for a current timestamp, or
    // the year 57000 for one in seconds.
    expect(parseEpoch("1755000000").unit).toBe("seconds");
    expect(parseEpoch("1755000000000").unit).toBe("milliseconds");
    expect(parseEpoch("1755000000").ms).toBe(parseEpoch("1755000000000").ms);
  });

  it("puts the threshold between the two real ranges", () => {
    // 1e11 seconds is the year 5138, 1e11 milliseconds is 1973. Nothing anyone
    // converts falls in the gap, which is why the guess is safe.
    expect(detectUnit(99_999_999_999)).toBe("seconds");
    expect(detectUnit(100_000_000_000)).toBe("milliseconds");
  });

  it("handles the epoch and negative timestamps", () => {
    expect(parseEpoch("0")).toMatchObject({ ok: true, ms: 0, unit: "seconds" });
    // Pre-1970 dates are ordinary negative epochs, not errors.
    const moon = parseEpoch("-14182940");
    expect(moon.ok).toBe(true);
    expect(new Date(moon.ms).getUTCFullYear()).toBe(1969);
  });

  it("can be told the unit rather than guessing", () => {
    // A small number really can be milliseconds; the override exists so the
    // reader can say so when the guess is wrong.
    expect(parseEpoch("5000", "milliseconds").ms).toBe(5000);
    expect(parseEpoch("5000", "seconds").ms).toBe(5_000_000);
  });
});

describe("what it refuses", () => {
  it("rejects things Number() would silently accept", () => {
    // Number("12e5") is 1200000 and Number("0x10") is 16. Neither is something
    // a person typed as a timestamp, and both would convert to a plausible date.
    for (const bad of ["12e5", "0x10", "1.5", " ", "twelve", "17550000000000000000000"]) {
      expect(parseEpoch(bad).ok, bad).toBe(false);
    }
  });

  it("refuses times JavaScript cannot represent", () => {
    const out = parseEpoch("99999999999999999");
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/range/i);
  });

  it("explains itself rather than returning a bare failure", () => {
    expect(parseEpoch("").error).toBeTruthy();
    expect(parseEpoch("abc").error).toMatch(/whole number/i);
    expect(parseDate("last tuesday").error).toMatch(/ISO 8601/);
  });
});

describe("reading a date", () => {
  it("understands ISO 8601 with a zone", () => {
    expect(parseDate("2026-08-20T14:30:00Z").ms).toBe(Date.UTC(2026, 7, 20, 14, 30, 0));
  });

  it("round-trips through format without drifting", () => {
    const ms = Date.UTC(2026, 7, 20, 14, 30, 45);
    expect(parseDate(format(ms).iso).ms).toBe(ms);
  });
});

describe("formatting", () => {
  it("truncates seconds toward the epoch rather than rounding", () => {
    // Every server-side epoch floors. Rounding here would send a value back a
    // second into the future on a round trip.
    expect(format(1_755_000_000_999).seconds).toBe(1_755_000_000);
    expect(format(-1_500).seconds).toBe(-2);
  });

  it("keeps milliseconds exactly", () => {
    expect(format(1_755_000_000_999).milliseconds).toBe(1_755_000_000_999);
  });

  it("emits a valid ISO string", () => {
    expect(format(Date.UTC(2026, 0, 1))).toMatchObject({
      iso: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("relative time", () => {
  const now = Date.UTC(2026, 7, 20, 12, 0, 0);

  it("picks the largest unit that still reads naturally", () => {
    expect(relativeTo(now - 30_000, now)).toMatch(/30 seconds ago/);
    expect(relativeTo(now - 7_200_000, now)).toMatch(/2 hours ago/);
    expect(relativeTo(now - 3 * 86_400_000, now)).toMatch(/3 days ago/);
  });

  it("handles the future", () => {
    expect(relativeTo(now + 3_600_000, now)).toMatch(/in 1 hour/);
  });

  it("does not say '0 seconds ago'", () => {
    expect(relativeTo(now, now)).toBe("just now");
    expect(relativeTo(now - 400, now)).toBe("just now");
  });
});
