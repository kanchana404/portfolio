import { describe, expect, it } from "vitest";
import { MAX_DIMENSION, reduction, targetSize } from "./resize";

const req = (o: Partial<Parameters<typeof targetSize>[2]> = {}) => ({
  mode: "width" as const, value: 100, allowUpscale: false, ...o,
});

describe("one dimension is given, the other is derived", () => {
  it("keeps the ratio when width is set", () => {
    expect(targetSize(1600, 900, req({ mode: "width", value: 800 })))
      .toMatchObject({ width: 800, height: 450 });
  });

  it("keeps the ratio when height is set", () => {
    expect(targetSize(1600, 900, req({ mode: "height", value: 450 })))
      .toMatchObject({ width: 800, height: 450 });
  });

  it("picks the correct axis for longest side, on both orientations", () => {
    expect(targetSize(1600, 900, req({ mode: "longest", value: 800 })))
      .toMatchObject({ width: 800, height: 450 });
    expect(targetSize(900, 1600, req({ mode: "longest", value: 800 })))
      .toMatchObject({ width: 450, height: 800 });
  });

  it("scales both axes by percent", () => {
    expect(targetSize(1000, 500, req({ mode: "percent", value: 50 })))
      .toMatchObject({ width: 500, height: 250 });
  });
});

describe("upscaling", () => {
  it("clamps to the original instead of enlarging", () => {
    // Asking 4000 from a 500px source cannot invent detail. Capping is the
    // useful reading of "no bigger than this"; enlarging is the worse failure.
    const out = targetSize(500, 250, req({ mode: "width", value: 4000 }));
    expect(out).toMatchObject({ width: 500, height: 250, clamped: true });
  });

  it("allows it when explicitly asked", () => {
    const out = targetSize(500, 250, req({ mode: "width", value: 1000, allowUpscale: true }));
    expect(out).toMatchObject({ width: 1000, height: 500, clamped: false });
  });
});

describe("rounding", () => {
  it("rounds rather than truncating", () => {
    // 1000x667 to width 333: height is 222.111. Flooring both axes drifts the
    // ratio on each, which shows on a thin logo.
    expect(targetSize(1000, 667, req({ mode: "width", value: 333 })).height).toBe(222);
    expect(targetSize(1000, 667, req({ mode: "width", value: 334 })).height).toBe(223);
  });

  it("never rounds a dimension to zero", () => {
    expect(targetSize(1000, 10, req({ mode: "percent", value: 1 })))
      .toMatchObject({ width: 10, height: 1 });
  });
});

describe("what it refuses", () => {
  it("rejects a non-positive size", () => {
    for (const v of [0, -5, NaN]) {
      expect(targetSize(100, 100, req({ value: v })).ok, String(v)).toBe(false);
    }
  });

  it("rejects a source with no dimensions", () => {
    expect(targetSize(0, 100, req()).ok).toBe(false);
  });

  it("refuses past the canvas limit and says the number", () => {
    const out = targetSize(100, 100, req({ value: MAX_DIMENSION + 1, allowUpscale: true }));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(String(MAX_DIMENSION));
  });
});

describe("reduction", () => {
  it("reports the saving as a percentage", () => {
    expect(reduction(1000, 250)).toBe(75);
    expect(reduction(1000, 1000)).toBe(0);
    expect(reduction(1000, 1200)).toBe(0);
    expect(reduction(0, 100)).toBe(0);
  });
});
