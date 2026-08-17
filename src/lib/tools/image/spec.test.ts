import { describe, expect, it } from "vitest";
import {
  CONVERSIONS,
  FORMATS,
  TARGET_FORMATS,
  conversionFor,
  exceedsPixelBudget,
  formatBytes,
  formatFromMime,
  formatFromName,
  isRenameOnly,
  needsMatte,
  outputName,
} from "./spec";

describe("recognising a format", () => {
  it("reads the extension, case-insensitively", () => {
    expect(formatFromName("holiday.PNG")).toBe("png");
    expect(formatFromName("shot.webp")).toBe("webp");
  });

  it("treats every JPEG spelling as one format", () => {
    // JFIF is JPEG — the same bytes under another extension, not another
    // format. Rejecting it as unknown is the common bug.
    for (const name of ["a.jpg", "a.jpeg", "a.jfif", "a.jpe"]) {
      expect(formatFromName(name)).toBe("jpg");
    }
  });

  it("returns null for something it does not handle", () => {
    expect(formatFromName("notes.txt")).toBeNull();
    expect(formatFromName("noextension")).toBeNull();
  });

  it("reads MIME types, including the non-standard JPEG ones", () => {
    expect(formatFromMime("image/png")).toBe("png");
    expect(formatFromMime("image/jpeg")).toBe("jpg");
    expect(formatFromMime("image/jpg")).toBe("jpg");
    expect(formatFromMime("image/webp;charset=binary")).toBe("webp");
    expect(formatFromMime("application/pdf")).toBeNull();
  });
});

describe("what may be produced", () => {
  it("offers only formats browsers genuinely encode", () => {
    expect([...TARGET_FORMATS]).toEqual(["png", "jpg", "webp"]);
  });

  it("never offers AVIF as a target", () => {
    // Chrome returns a PNG when asked for AVIF rather than failing, so
    // offering it would hand over a mislabelled file.
    expect(FORMATS.avif.encodable).toBe(false);
    expect(TARGET_FORMATS).not.toContain("avif");
  });

  it("keeps GIF and BMP as input-only", () => {
    expect(TARGET_FORMATS).not.toContain("gif");
    expect(TARGET_FORMATS).not.toContain("bmp");
  });
});

describe("the transparency trap", () => {
  it("mattes when alpha is being dropped", () => {
    // PNG -> JPG without a fill renders every transparent pixel black.
    expect(needsMatte("png", "jpg")).toBe(true);
    expect(needsMatte("webp", "jpg")).toBe(true);
  });

  it("does not matte when the target keeps alpha", () => {
    expect(needsMatte("png", "png")).toBe(false);
    expect(needsMatte("png", "webp")).toBe(false);
  });

  it("does not matte when the source cannot have had alpha", () => {
    expect(needsMatte("jpg", "jpg")).toBe(false);
  });

  it("mattes for an unknown source", () => {
    // Invisible on an opaque image; ruinous if omitted on a transparent one.
    expect(needsMatte(null, "jpg")).toBe(true);
  });
});

describe("same-format routes", () => {
  it("is a rename, not a re-encode", () => {
    // .jfif -> .jpg is a rename: re-encoding would discard quality for nothing.
    expect(isRenameOnly("jpg", "jpg")).toBe(true);
  });

  it("is not a rename across formats, or from an unknown source", () => {
    expect(isRenameOnly("png", "jpg")).toBe(false);
    expect(isRenameOnly(null, "png")).toBe(false);
  });
});

describe("naming the output", () => {
  it("swaps the extension and keeps the stem", () => {
    expect(outputName("holiday photo.png", "jpg")).toBe("holiday photo.jpg");
  });

  it("uses the canonical extension, not the one it was given", () => {
    expect(outputName("a.jfif", "jpg")).toBe("a.jpg");
  });

  it("handles a name with dots in it", () => {
    expect(outputName("shot.2026.01.png", "webp")).toBe("shot.2026.01.webp");
  });

  it("handles a name with no extension", () => {
    expect(outputName("screenshot", "png")).toBe("screenshot.png");
  });

  it("falls back rather than producing a dotfile", () => {
    expect(outputName(".png", "jpg")).toBe("image.jpg");
  });
});

describe("the pixel budget", () => {
  it("passes an ordinary photo", () => {
    expect(exceedsPixelBudget(6000, 4000)).toBe(false); // 24 MP
  });

  it("refuses something past the canvas ceiling", () => {
    // Canvas does not throw when exceeded — it yields a blank surface, so the
    // tool would hand back an empty file and look like it worked.
    expect(exceedsPixelBudget(12000, 8000)).toBe(true); // 96 MP
  });
});

describe("the route table", () => {
  it("resolves a known slug and rejects an unknown one", () => {
    expect(conversionFor("png-to-jpg")).toEqual({ from: "png", to: "jpg" });
    expect(conversionFor("png-to-tiff")).toBeUndefined();
  });

  it("only ever targets an encodable format", () => {
    for (const [slug, spec] of Object.entries(CONVERSIONS)) {
      expect(FORMATS[spec.to].encodable, `${slug} targets ${spec.to}`).toBe(true);
    }
  });

  it("names every slug after what it does", () => {
    for (const [slug, spec] of Object.entries(CONVERSIONS)) {
      if (spec.from === null) continue;
      expect(slug, `${slug} should read "<from>-to-<to>"`).toBe(
        `${spec.from}-to-${spec.to}`
      );
    }
  });
});

describe("formatBytes", () => {
  it("scales the unit to the size", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 kB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
