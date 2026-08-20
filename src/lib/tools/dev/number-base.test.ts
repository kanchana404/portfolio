import { describe, expect, it } from "vitest";
import { bitLength, group, parseInBase, toBase } from "./number-base";

describe("what parseInt would get wrong", () => {
  it("rejects trailing junk instead of returning the prefix", () => {
    // parseInt("12xyz", 10) is 12: a typo silently becomes a plausible answer.
    const out = parseInBase("12xyz", 10);
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/"x" is not a digit in base 10/);
  });

  it("rejects a decimal point instead of truncating", () => {
    expect(parseInBase("0.5", 10).ok).toBe(false);
  });

  it("stays exact above 2^53", () => {
    // parseInt("9007199254740993") returns ...992. BigInt does not.
    expect(parseInBase("9007199254740993", 10).value).toBe(9007199254740993n);
    const huge = "f".repeat(32);
    expect(toBase(parseInBase(huge, 16).value!, 16)).toBe(huge);
  });

  it("catches a digit that is valid in another base", () => {
    // The realistic mistake: pasting hex into the binary field.
    expect(parseInBase("1012", 2).error).toMatch(/"2" is not a digit in base 2/);
    expect(parseInBase("98", 8).error).toMatch(/"9" is not a digit in base 8/);
  });
});

describe("reading input people actually paste", () => {
  it("accepts the prefix for its own base", () => {
    expect(parseInBase("0xff", 16).value).toBe(255n);
    expect(parseInBase("0b1010", 2).value).toBe(10n);
    expect(parseInBase("0o755", 8).value).toBe(493n);
  });

  it("ignores separators used for readability", () => {
    expect(parseInBase("1111_0000", 2).value).toBe(240n);
    expect(parseInBase("dead beef", 16).value).toBe(3735928559n);
  });

  it("handles negatives and zero", () => {
    expect(parseInBase("-255", 10).value).toBe(-255n);
    expect(parseInBase("0", 10).value).toBe(0n);
    expect(parseInBase("-0xff", 16).value).toBe(-255n);
  });

  it("refuses an empty or prefix-only input", () => {
    expect(parseInBase("", 10).ok).toBe(false);
    expect(parseInBase("0x", 16).ok).toBe(false);
    expect(parseInBase("   ", 10).ok).toBe(false);
  });
});

describe("round trips", () => {
  it("survives every base pairing", () => {
    for (const n of [0n, 1n, 255n, 4096n, 123456789n, 2n ** 64n]) {
      for (const radix of [2, 8, 10, 16]) {
        expect(parseInBase(toBase(n, radix), radix).value, `${n} base ${radix}`).toBe(n);
      }
    }
  });
});

describe("presentation", () => {
  it("groups from the right, not the left", () => {
    // Grouping from the left mis-aligns every nibble on an odd-length string.
    expect(group("11110000", 4)).toBe("1111 0000");
    expect(group("111110000", 4)).toBe("1 1111 0000");
    expect(group("-ff", 2)).toBe("-ff");
  });

  it("reports the bit width a mask question is really asking", () => {
    expect(bitLength(0n)).toBe(0);
    expect(bitLength(1n)).toBe(1);
    expect(bitLength(255n)).toBe(8);
    expect(bitLength(256n)).toBe(9);
    expect(bitLength(-255n)).toBe(8);
  });
});
