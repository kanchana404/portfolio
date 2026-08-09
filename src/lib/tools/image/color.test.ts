import { describe, expect, it } from "vitest";
import {
  buildScale,
  checkContrast,
  contrastRatio,
  formatAll,
  hslToRgb,
  oklchToRgb,
  parseColor,
  parseHex,
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
  rgbToOklch,
} from "./color";

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const RED = { r: 255, g: 0, b: 0, a: 1 };

describe("parseHex", () => {
  it("reads six digits", () => {
    expect(parseHex("#ff8800")).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });

  it("expands three digits", () => {
    expect(parseHex("#f80")).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });

  it("reads eight digits as RGBA", () => {
    expect(parseHex("#ff880080")).toMatchObject({ r: 255, g: 136, b: 0 });
    expect(parseHex("#ff880080")?.a).toBeCloseTo(0.502, 2);
  });

  it("expands four digits", () => {
    expect(parseHex("#f80f")).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });

  it("is case insensitive", () => {
    expect(parseHex("#FF8800")).toEqual(parseHex("#ff8800"));
  });

  it("rejects a wrong length", () => {
    // 3, 4, 6 and 8 are the legal lengths — 4 is RGBA, covered above.
    expect(parseHex("#ff")).toBeNull();
    expect(parseHex("#ff888")).toBeNull();
    expect(parseHex("#fffffff")).toBeNull();
    expect(parseHex("#fffffffff")).toBeNull();
  });

  it("rejects non-hex characters", () => {
    expect(parseHex("#gggggg")).toBeNull();
  });
});

describe("parseColor", () => {
  it("accepts hex with and without the hash", () => {
    expect(parseColor("#ff0000")).toEqual(RED);
    expect(parseColor("ff0000")).toEqual(RED);
  });

  it("accepts CSS colour names", () => {
    expect(parseColor("red")).toEqual(RED);
    expect(parseColor("REBECCAPURPLE")).toEqual({ r: 102, g: 51, b: 153, a: 1 });
    expect(parseColor("tomato")).toEqual({ r: 255, g: 99, b: 71, a: 1 });
  });

  it("knows both spellings of grey", () => {
    expect(parseColor("gray")).toEqual(parseColor("grey"));
    expect(parseColor("darkslategray")).toEqual(parseColor("darkslategrey"));
  });

  it("accepts transparent", () => {
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("accepts legacy comma rgb syntax", () => {
    expect(parseColor("rgb(255, 0, 0)")).toEqual(RED);
    expect(parseColor("rgba(255, 0, 0, 0.5)")).toEqual({ ...RED, a: 0.5 });
  });

  it("accepts modern space rgb syntax with a slash alpha", () => {
    expect(parseColor("rgb(255 0 0)")).toEqual(RED);
    expect(parseColor("rgb(255 0 0 / 0.5)")).toEqual({ ...RED, a: 0.5 });
    expect(parseColor("rgb(255 0 0 / 50%)")).toEqual({ ...RED, a: 0.5 });
  });

  it("accepts percentage channels", () => {
    expect(parseColor("rgb(100%, 0%, 0%)")).toEqual(RED);
  });

  it("accepts hsl in both syntaxes", () => {
    expect(parseColor("hsl(0, 100%, 50%)")).toEqual(RED);
    expect(parseColor("hsl(0deg 100% 50%)")).toEqual(RED);
    expect(parseColor("hsla(0, 100%, 50%, 0.25)")).toEqual({ ...RED, a: 0.25 });
  });

  it("accepts oklch", () => {
    const parsed = parseColor("oklch(62.8% 0.2577 29.23)");
    expect(parsed?.r).toBeCloseTo(255, -1);
    expect(parsed?.g).toBeLessThan(10);
    expect(parsed?.b).toBeLessThan(10);
  });

  it("clamps out-of-range channels rather than producing nonsense", () => {
    expect(parseColor("rgb(300, -20, 0)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it("wraps hue", () => {
    expect(parseColor("hsl(360 100% 50%)")).toEqual(parseColor("hsl(0 100% 50%)"));
    expect(parseColor("hsl(-120 100% 50%)")).toEqual(parseColor("hsl(240 100% 50%)"));
  });

  it("returns null for junk instead of defaulting to black", () => {
    // Falling back to black would make a typo look like a successful conversion.
    for (const junk of ["", "   ", "not a colour", "#", "rgb(1,2)", "hsl()", "#12345"]) {
      expect(parseColor(junk), `expected null for ${JSON.stringify(junk)}`).toBeNull();
    }
  });

  it("ignores surrounding whitespace and case", () => {
    expect(parseColor("  #FF0000  ")).toEqual(RED);
    expect(parseColor("  RGB(255 0 0)  ")).toEqual(RED);
  });
});

describe("rgbToHex", () => {
  it("writes lowercase six-digit hex", () => {
    expect(rgbToHex({ r: 255, g: 136, b: 0, a: 1 })).toBe("#ff8800");
  });

  it("pads single digits", () => {
    expect(rgbToHex({ r: 1, g: 2, b: 3, a: 1 })).toBe("#010203");
  });

  it("appends alpha only when it matters", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0, a: 1 })).toBe("#ff0000");
    expect(rgbToHex({ r: 255, g: 0, b: 0, a: 0.5 })).toBe("#ff000080");
    expect(rgbToHex({ r: 255, g: 0, b: 0, a: 1 }, true)).toBe("#ff0000ff");
  });
});

describe("HSL", () => {
  it("converts primaries", () => {
    expect(rgbToHsl(RED)).toMatchObject({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 255, b: 0, a: 1 })).toMatchObject({ h: 120, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255, a: 1 })).toMatchObject({ h: 240, s: 100, l: 50 });
  });

  it("reports greys with zero saturation and zero hue", () => {
    expect(rgbToHsl(WHITE)).toMatchObject({ h: 0, s: 0, l: 100 });
    expect(rgbToHsl(BLACK)).toMatchObject({ h: 0, s: 0, l: 0 });
    expect(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 })).toMatchObject({ h: 0, s: 0 });
  });

  it("round-trips every channel within one unit", () => {
    for (const rgb of [
      { r: 12, g: 200, b: 87, a: 1 },
      { r: 255, g: 136, b: 0, a: 1 },
      { r: 33, g: 33, b: 34, a: 1 },
      { r: 250, g: 250, b: 249, a: 1 },
    ]) {
      const back = hslToRgb(rgbToHsl(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });

  it("preserves alpha through the round trip", () => {
    expect(hslToRgb(rgbToHsl({ r: 10, g: 20, b: 30, a: 0.4 })).a).toBe(0.4);
  });
});

describe("OKLCH", () => {
  it("puts white at lightness 1 with no chroma", () => {
    const white = rgbToOklch(WHITE);
    expect(white.l).toBeCloseTo(1, 3);
    expect(white.c).toBeCloseTo(0, 3);
  });

  it("puts black at lightness 0", () => {
    expect(rgbToOklch(BLACK).l).toBeCloseTo(0, 3);
  });

  it("matches the published values for sRGB red", () => {
    const red = rgbToOklch(RED);
    expect(red.l).toBeCloseTo(0.6279, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.2, 1);
  });

  it("reports hue as zero for an achromatic colour instead of atan2 noise", () => {
    expect(rgbToOklch({ r: 128, g: 128, b: 128, a: 1 }).h).toBe(0);
  });

  it("round-trips within one unit per channel", () => {
    for (const rgb of [
      RED,
      { r: 0, g: 128, b: 255, a: 1 },
      { r: 102, g: 51, b: 153, a: 1 },
      { r: 17, g: 17, b: 17, a: 1 },
      { r: 240, g: 230, b: 140, a: 1 },
    ]) {
      const back = oklchToRgb(rgbToOklch(rgb));
      expect(Math.abs(back.r - rgb.r), `r for ${rgbToHex(rgb)}`).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g), `g for ${rgbToHex(rgb)}`).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b), `b for ${rgbToHex(rgb)}`).toBeLessThanOrEqual(1);
    }
  });

  it("separates two colours that HSL calls equally light", () => {
    // hsl(60 100% 50%) and hsl(240 100% 50%) have identical HSL lightness and
    // wildly different perceived brightness. This is the whole argument for OKLCH.
    const yellow = rgbToOklch(hslToRgb({ h: 60, s: 100, l: 50, a: 1 }));
    const blue = rgbToOklch(hslToRgb({ h: 240, s: 100, l: 50, a: 1 }));
    expect(yellow.l - blue.l).toBeGreaterThan(0.4);
  });
});

describe("relativeLuminance", () => {
  it("is 1 for white and 0 for black", () => {
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 6);
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 6);
  });

  it("weights green far above blue", () => {
    expect(relativeLuminance({ r: 0, g: 255, b: 0, a: 1 })).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance({ r: 0, g: 0, b: 255, a: 1 })).toBeCloseTo(0.0722, 4);
  });

  it("applies gamma expansion, not a raw channel average", () => {
    // Mid-grey is 0.5 in the encoded value and about 0.216 in light. A tool that
    // skips linearisation reports ~0.5 here and gets every contrast wrong.
    expect(relativeLuminance({ r: 128, g: 128, b: 128, a: 1 })).toBeCloseTo(0.2159, 3);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio(BLACK, WHITE)).toBe(21);
  });

  it("is 1 for a colour against itself", () => {
    expect(contrastRatio(RED, RED)).toBe(1);
  });

  it("is symmetric", () => {
    expect(contrastRatio(BLACK, WHITE)).toBe(contrastRatio(WHITE, BLACK));
  });

  it("agrees with the well-known grey-on-white boundary", () => {
    // #767676 is the lightest grey that passes AA on white; #777777 is the
    // first one that does not. Any error in the gamma maths moves this line.
    expect(contrastRatio(parseHex("#767676")!, WHITE)).toBeCloseTo(4.54, 2);
    expect(contrastRatio(parseHex("#777777")!, WHITE)).toBeCloseTo(4.48, 2);
  });
});

describe("checkContrast", () => {
  it("passes everything for black on white", () => {
    const verdict = checkContrast(BLACK, WHITE);
    expect(verdict).toMatchObject({
      aaNormal: true,
      aaLarge: true,
      aaaNormal: true,
      uiComponents: true,
    });
    expect(verdict.summary).toContain("AAA");
  });

  it("holds the AA boundary at exactly 4.5", () => {
    expect(checkContrast(parseHex("#767676")!, WHITE).aaNormal).toBe(true);
    expect(checkContrast(parseHex("#777777")!, WHITE).aaNormal).toBe(false);
  });

  it("distinguishes large-text-only from failing outright", () => {
    const largeOnly = checkContrast(parseHex("#949494")!, WHITE);
    expect(largeOnly.aaNormal).toBe(false);
    expect(largeOnly.aaLarge).toBe(true);
    expect(largeOnly.summary).toContain("large text");

    const failing = checkContrast(parseHex("#cccccc")!, WHITE);
    expect(failing.aaLarge).toBe(false);
    expect(failing.summary).toContain("not accessible");
  });

  it("holds the AAA boundary at exactly 7", () => {
    expect(checkContrast(parseHex("#595959")!, WHITE).aaaNormal).toBe(true);
    expect(checkContrast(parseHex("#5a5a5a")!, WHITE).aaaNormal).toBe(false);
  });
});

describe("formatAll", () => {
  it("emits every format for an opaque colour", () => {
    const formats = formatAll(RED);
    expect(formats.hex).toBe("#ff0000");
    expect(formats.rgb).toBe("rgb(255 0 0)");
    expect(formats.hsl).toBe("hsl(0 100% 50%)");
    expect(formats.oklch).toMatch(/^oklch\(62\.\d+% 0\.25\d* 29\.\d+\)$/);
  });

  it("carries alpha into every format when it is not fully opaque", () => {
    const formats = formatAll({ ...RED, a: 0.5 });
    expect(formats.rgb).toContain("/ 0.5");
    expect(formats.hsl).toContain("/ 0.5");
    expect(formats.oklch).toContain("/ 0.5");
    expect(formats.hexAlpha).toBe("#ff000080");
  });

  it("produces output that parses back to the same colour", () => {
    for (const source of ["#3b82f6", "#facc15", "#0f172a"]) {
      const rgb = parseHex(source)!;
      const formats = formatAll(rgb);
      expect(parseColor(formats.hex)).toEqual(rgb);
      expect(parseColor(formats.rgb)).toEqual(rgb);

      const viaHsl = parseColor(formats.hsl)!;
      expect(Math.abs(viaHsl.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(viaHsl.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(viaHsl.b - rgb.b)).toBeLessThanOrEqual(1);

      const viaOklch = parseColor(formats.oklch)!;
      expect(Math.abs(viaOklch.r - rgb.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(viaOklch.g - rgb.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(viaOklch.b - rgb.b)).toBeLessThanOrEqual(2);
    }
  });
});

describe("buildScale", () => {
  it("returns the requested number of steps", () => {
    expect(buildScale(RED)).toHaveLength(9);
    expect(buildScale(RED, 5)).toHaveLength(5);
  });

  it("labels steps in hundreds", () => {
    expect(buildScale(RED, 3).map((s) => s.step)).toEqual([100, 200, 300]);
  });

  it("runs from light to dark", () => {
    const scale = buildScale(parseHex("#3b82f6")!);
    const luminances = scale.map((s) => relativeLuminance(parseHex(s.hex)!));
    for (let i = 1; i < luminances.length; i++) {
      expect(luminances[i]).toBeLessThan(luminances[i - 1]);
    }
  });

  it("emits valid hex at every step", () => {
    for (const step of buildScale(parseHex("#00ffcc")!)) {
      expect(step.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
