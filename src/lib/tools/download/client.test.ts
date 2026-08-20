import { describe, expect, it } from "vitest";
import { formatDuration, formatSize } from "./client";

describe("format sizes", () => {
  it("uses decimal units, which is what platforms report", () => {
    expect(formatSize(1000)).toBe("1.0 kB");
    expect(formatSize(1_500_000)).toBe("1.5 MB");
    expect(formatSize(2_000_000_000)).toBe("2.0 GB");
  });

  it("says nothing when the platform did not", () => {
    // A missing filesize is common and normal. Printing "0 B" would look like
    // an empty file rather than an unknown one.
    for (const v of [null, 0, -1]) expect(formatSize(v as number | null)).toBe("");
  });

  it("does not put a decimal on raw bytes", () => {
    expect(formatSize(512)).toBe("512 B");
  });
});

describe("durations", () => {
  it("formats as minutes and padded seconds", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
    expect(formatDuration(9)).toBe("0:09");
  });

  it("says nothing for a live stream or an unknown length", () => {
    for (const v of [null, 0]) expect(formatDuration(v as number | null)).toBe("");
  });
});
