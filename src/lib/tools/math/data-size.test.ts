import { describe, expect, it } from "vitest";
import { humanise, systemGapPercent, toBytes, unitsFor } from "./data-size";

describe("the two systems", () => {
  it("uses 1000 for decimal and 1024 for binary", () => {
    expect(unitsFor("decimal")[1].bytes).toBe(1000);
    expect(unitsFor("binary")[1].bytes).toBe(1024);
    expect(unitsFor("decimal")[3].bytes).toBe(1e9);
    expect(unitsFor("binary")[3].bytes).toBe(1024 ** 3);
  });

  it("names them differently, which is the part everyone drops", () => {
    expect(unitsFor("decimal").map((u) => u.label)).toEqual(["B","kB","MB","GB","TB","PB"]);
    expect(unitsFor("binary").map((u) => u.label)).toEqual(["B","KiB","MiB","GiB","TiB","PiB"]);
  });

  it("explains the missing space on a 500 GB drive", () => {
    // The advertised size is honest: 500 GB really is 5e11 bytes. Windows then
    // divides by 1024 three times and still writes "GB".
    const drive = toBytes("500", unitsFor("decimal")[3].bytes);
    expect(drive.bytes).toBe(5e11);
    expect(humanise(drive.bytes!, "binary")).toBe("465.66 GiB");
  });

  it("computes the gap rather than describing it", () => {
    expect(systemGapPercent(1)).toBeCloseTo(2.34, 1);
    expect(systemGapPercent(3)).toBeCloseTo(6.87, 1);
    expect(systemGapPercent(4)).toBeCloseTo(9.05, 1);
    expect(systemGapPercent(0)).toBe(0);
  });
});

describe("parsing", () => {
  it("accepts whole and fractional sizes", () => {
    expect(toBytes("1.5", 1e6).bytes).toBe(1.5e6);
    expect(toBytes("500", 1000).bytes).toBe(500_000);
    expect(toBytes(".5", 1000).bytes).toBe(500);
  });

  it("refuses what is not a size", () => {
    for (const bad of ["", "abc", "-5", "1,000", "1e6"]) {
      expect(toBytes(bad, 1000).ok, bad).toBe(false);
    }
  });

  it("refuses sizes past exact integer range", () => {
    expect(toBytes("999999", 1024 ** 5).ok).toBe(false);
  });
});

describe("formatting", () => {
  it("picks a sensible unit", () => {
    expect(humanise(999, "decimal")).toBe("999 B");
    expect(humanise(1000, "decimal")).toBe("1 kB");
    expect(humanise(1024, "binary")).toBe("1 KiB");
    expect(humanise(1023, "binary")).toBe("1023 B");
  });

  it("trims trailing zeros", () => {
    expect(humanise(1_500_000, "decimal")).toBe("1.5 MB");
    expect(humanise(2_000_000, "decimal")).toBe("2 MB");
  });

  it("handles zero and stays inside the unit table", () => {
    expect(humanise(0, "decimal")).toBe("0 B");
    // Beyond petabytes it clamps rather than indexing off the end.
    expect(humanise(1e21, "decimal")).toMatch(/PB$/);
  });

  it("round-trips a value through both systems", () => {
    const bytes = 3 * 1024 ** 3;
    expect(humanise(bytes, "binary")).toBe("3 GiB");
    expect(humanise(bytes, "decimal")).toBe("3.22 GB");
  });
});
