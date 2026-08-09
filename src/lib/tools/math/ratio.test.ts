import { describe, expect, it } from "vitest";
import { gcd, matchNamedRatio, parseRatio, simplifyRatio, solveDimension } from "./ratio";

describe("gcd", () => {
  it("computes the greatest common divisor", () => {
    expect(gcd(1920, 1080)).toBe(120);
    expect(gcd(7, 13)).toBe(1);
    expect(gcd(10, 0)).toBe(10);
  });
  it("ignores sign", () => {
    expect(gcd(-12, 18)).toBe(6);
  });
});

describe("simplifyRatio", () => {
  it("reduces common screen sizes", () => {
    expect(simplifyRatio(1920, 1080)).toEqual({ w: 16, h: 9 });
    expect(simplifyRatio(3840, 2160)).toEqual({ w: 16, h: 9 });
    expect(simplifyRatio(1024, 768)).toEqual({ w: 4, h: 3 });
    expect(simplifyRatio(1080, 1920)).toEqual({ w: 9, h: 16 });
  });
  it("returns null rather than a ratio containing zero", () => {
    expect(simplifyRatio(0, 100)).toBeNull();
    expect(simplifyRatio(100, 0)).toBeNull();
    expect(simplifyRatio(-16, 9)).toBeNull();
  });
});

describe("matchNamedRatio", () => {
  it("names an exact match", () => {
    const m = matchNamedRatio(1920, 1080);
    expect(m?.label).toBe("16:9");
    expect(m?.exact).toBe(true);
  });

  it("names a near match and says it is approximate", () => {
    // 1366×768 reduces to 683:384, which is correct and useless.
    const m = matchNamedRatio(1366, 768);
    expect(m?.label).toBe("16:9");
    expect(m?.exact).toBe(false);
  });

  it("recognises vertical video", () => {
    expect(matchNamedRatio(1080, 1920)?.label).toBe("9:16");
  });

  it("returns null when nothing is close", () => {
    expect(matchNamedRatio(1000, 137)).toBeNull();
  });
});

describe("solveDimension", () => {
  it("solves for height from width", () => {
    expect(solveDimension({ w: 16, h: 9 }, { width: 1920 })).toEqual({
      width: 1920, height: 1080, rounded: false,
    });
  });

  it("solves for width from height", () => {
    expect(solveDimension({ w: 16, h: 9 }, { height: 1080 })).toEqual({
      width: 1920, height: 1080, rounded: false,
    });
  });

  it("reports when the exact answer is not a whole pixel", () => {
    // There is no such thing as a fractional pixel, and silently rounding is
    // how a layout ends up one pixel out with no explanation.
    const r = solveDimension({ w: 16, h: 9 }, { width: 100 });
    expect(r?.height).toBe(56);
    expect(r?.rounded).toBe(true);
  });

  it("refuses degenerate input", () => {
    expect(solveDimension({ w: 0, h: 9 }, { width: 100 })).toBeNull();
    expect(solveDimension({ w: 16, h: 9 }, { width: 0 })).toBeNull();
  });
});

describe("parseRatio", () => {
  it("accepts the separators people actually type", () => {
    for (const input of ["16:9", "16/9", "16x9", "16 9", " 16 : 9 "]) {
      expect(parseRatio(input)).toEqual({ w: 16, h: 9 });
    }
  });
  it("accepts decimals", () => {
    expect(parseRatio("2.35:1")).toEqual({ w: 2.35, h: 1 });
  });
  it("rejects anything else", () => {
    for (const bad of ["", "16", "16:", ":9", "0:9", "a:b", "-16:9"]) {
      expect(parseRatio(bad), `expected null for ${JSON.stringify(bad)}`).toBeNull();
    }
  });
});
