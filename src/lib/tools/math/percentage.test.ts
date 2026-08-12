import { describe, expect, it } from "vitest";
import {
  applyPercentChange,
  formatNumber,
  formatPercent,
  parseDecimal,
  percentChange,
  percentOf,
  whatPercentOf,
} from "./percentage";

const NBSP = String.fromCharCode(0x00a0);
const NARROW_NBSP = String.fromCharCode(0x202f);

describe("parseDecimal", () => {
  it("parses plain integers and decimals", () => {
    expect(parseDecimal("42")).toBe(42);
    expect(parseDecimal("3.5")).toBe(3.5);
    expect(parseDecimal("0.125")).toBe(0.125);
    expect(parseDecimal(".5")).toBe(0.5);
    expect(parseDecimal("7.")).toBe(7);
  });

  it("parses negatives", () => {
    expect(parseDecimal("-42")).toBe(-42);
    expect(parseDecimal("-0.5")).toBe(-0.5);
  });

  it("accepts a leading plus", () => {
    expect(parseDecimal("+42")).toBe(42);
  });

  it("strips thousands separators people actually type", () => {
    expect(parseDecimal("1,234.5")).toBe(1234.5);
    expect(parseDecimal("1 234")).toBe(1234);
    expect(parseDecimal(`1${NBSP}234`)).toBe(1234);
    expect(parseDecimal(`1${NARROW_NBSP}234`)).toBe(1234);
  });

  it("returns null for empty and whitespace-only input", () => {
    // The important one. Number("") is 0, so a naive parse turns an untouched
    // field into a confident answer of zero.
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
    expect(parseDecimal(NBSP)).toBeNull();
  });

  it("returns null for partial input a user is midway through typing", () => {
    expect(parseDecimal("-")).toBeNull();
    expect(parseDecimal(".")).toBeNull();
    expect(parseDecimal("-.")).toBeNull();
  });

  it("returns null for anything that is not a number", () => {
    for (const bad of [
      "abc",
      "1.2.3",
      "1e5",
      "Infinity",
      "-Infinity",
      "NaN",
      "0x10",
      "1/2",
      "12%",
      "--5",
      "5-",
    ]) {
      expect(parseDecimal(bad), `expected null for ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  it("never returns a non-finite number", () => {
    for (const input of ["1".repeat(400), "-" + "9".repeat(400)]) {
      const out = parseDecimal(input);
      expect(out === null || Number.isFinite(out)).toBe(true);
    }
  });
});

describe("percentOf", () => {
  it("computes the common cases", () => {
    expect(percentOf(10, 200)).toBe(20);
    expect(percentOf(15, 60)).toBe(9);
    expect(percentOf(100, 42)).toBe(42);
    expect(percentOf(0, 500)).toBe(0);
  });
  it("handles percentages above 100 and negatives", () => {
    expect(percentOf(150, 200)).toBe(300);
    expect(percentOf(-10, 200)).toBe(-20);
    expect(percentOf(10, -200)).toBe(-20);
  });
  it("is exact for a case naive float maths gets wrong", () => {
    // 0.1 * 3 is 0.30000000000000004; going through /100 keeps this honest.
    expect(percentOf(10, 3)).toBeCloseTo(0.3, 12);
  });
});

describe("whatPercentOf", () => {
  it("computes the common cases", () => {
    expect(whatPercentOf(20, 200)).toBe(10);
    expect(whatPercentOf(9, 60)).toBe(15);
    expect(whatPercentOf(200, 100)).toBe(200);
  });
  it("returns null when the whole is zero rather than Infinity", () => {
    expect(whatPercentOf(5, 0)).toBeNull();
    expect(whatPercentOf(0, 0)).toBeNull();
  });
  it("returns 0 when the part is zero and the whole is not", () => {
    expect(whatPercentOf(0, 50)).toBe(0);
  });
});

describe("percentChange", () => {
  it("reports increases and decreases", () => {
    expect(percentChange(100, 150)).toBe(50);
    expect(percentChange(100, 50)).toBe(-50);
    expect(percentChange(100, 100)).toBe(0);
    expect(percentChange(80, 100)).toBe(25);
  });

  it("returns null when the starting value is zero", () => {
    // Growth from nothing is undefined. Printing an infinity here is the single
    // most common bug in free percentage calculators.
    expect(percentChange(0, 100)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });

  it("uses the magnitude of the start so the sign means what a reader expects", () => {
    // -100 -> -50 is a rise. A signed denominator would report -50% here.
    expect(percentChange(-100, -50)).toBe(50);
    expect(percentChange(-50, -100)).toBe(-100);
    expect(percentChange(-100, 0)).toBe(100);
  });
});

describe("applyPercentChange", () => {
  it("applies increases and decreases", () => {
    expect(applyPercentChange(200, 10)).toBe(220);
    expect(applyPercentChange(200, -10)).toBe(180);
    expect(applyPercentChange(200, 0)).toBe(200);
  });

  it("moves a negative value by a share of its magnitude", () => {
    // Consistent with percentChange's magnitude convention: "+10%" means the
    // value moved 10% of its own size in the positive direction, so a negative
    // number gets closer to zero rather than further away.
    expect(applyPercentChange(-40, 10)).toBe(-36);
    expect(applyPercentChange(-40, -10)).toBe(-44);
  });

  it("is exact where forming a scale factor first would not be", () => {
    // 200 * (1 + 10/100) is 220.00000000000003.
    expect(applyPercentChange(200, 10)).toBe(220);
  });

  it("round-trips against percentChange", () => {
    for (const [from, to] of [
      [100, 150],
      [80, 20],
      [-40, 10],
      [7, 7],
    ] as const) {
      const change = percentChange(from, to);
      expect(change).not.toBeNull();
      expect(applyPercentChange(from, change as number)).toBeCloseTo(to, 9);
    }
  });
});

describe("formatting", () => {
  it("trims trailing zeros", () => {
    expect(formatNumber(25)).toBe("25");
    expect(formatNumber(25.5)).toBe("25.5");
  });
  it("groups thousands", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
  it("keeps meaningful precision rather than rounding to a whole number", () => {
    expect(formatNumber(1 / 3)).toBe("0.333333");
  });
  it("appends a percent sign", () => {
    expect(formatPercent(12.5)).toBe("12.5%");
    expect(formatPercent(-3)).toBe("-3%");
  });
  it("clamps an out-of-range fraction-digit request instead of throwing", () => {
    // Intl.NumberFormat throws a RangeError above 20; a calculator must not.
    expect(() => formatNumber(1.5, 99)).not.toThrow();
    expect(() => formatNumber(1.5, -5)).not.toThrow();
  });
});
