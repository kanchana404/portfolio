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
  MAX_MEGAPIXELS,
  needsMatte,
  outputName,
  SELF_DECODED,
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
  it("offers only what can actually be produced", () => {
    // Three of these are what `canvas.toBlob` writes. The rest are written by
    // this project — ICO assembles PNGs into its container, and BMP/TGA/QOI/PPM
    // have hand-written encoders in ./codecs/raster — so `toBlob` returning a
    // PNG for them is irrelevant: it is never asked.
    expect([...TARGET_FORMATS]).toEqual([
      "png", "jpg", "webp", "ico", "bmp", "tga", "qoi", "ppm",
    ]);
  });

  it("never offers AVIF as a target", () => {
    // Chrome returns a PNG when asked for AVIF rather than failing, so
    // offering it would hand over a mislabelled file.
    expect(FORMATS.avif.encodable).toBe(false);
    expect(TARGET_FORMATS).not.toContain("avif");
  });

  it("keeps AVIF and GIF as input-only", () => {
    // Both would need a WASM encoder shipped to the visitor: ~1 MB for AVIF,
    // and GIF's value is animation, which a single-frame path cannot deliver.
    expect(TARGET_FORMATS).not.toContain("avif");
    expect(TARGET_FORMATS).not.toContain("gif");
  });

  it("declares which formats it decodes itself", () => {
    // `createImageBitmap` rejects these outright, so the pipeline reads them
    // before touching a canvas. A format missing here is reported to the user
    // as unreadable despite being perfectly readable.
    expect([...SELF_DECODED]).toEqual(["tga", "qoi", "ppm"]);
    for (const f of SELF_DECODED) expect(FORMATS[f].encodable).toBe(true);
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
  it("passes an ordinary phone or camera shot", () => {
    expect(exceedsPixelBudget(4032, 3024)).toBe(false); // 12.2 MP, iPhone
    expect(exceedsPixelBudget(4000, 3000)).toBe(false); // 12 MP
  });

  it("refuses a 24 MP photo, which iOS Safari cannot hold", () => {
    // The regression this pins: the cap was 40 MP, iOS Safari's real canvas
    // ceiling is 16,777,216 px, and a canvas past it does not throw — it goes
    // blank. So a 24 MP shot cleared the guard and produced an empty file that
    // looked like a successful conversion. Size is no defence either: a 24 MP
    // AVIF is only ~380 kB.
    expect(exceedsPixelBudget(6000, 4000)).toBe(true); // 24 MP
  });

  it("refuses something far past the ceiling", () => {
    expect(exceedsPixelBudget(12000, 8000)).toBe(true); // 96 MP
  });

  it("sits at or under the 2^24 pixel iOS ceiling", () => {
    expect(MAX_MEGAPIXELS * 1_000_000).toBeLessThanOrEqual(16_777_216);
  });
});

describe("the route table", () => {
  it("resolves the converter route and rejects anything else", () => {
    // One page now. Both formats are chosen in the UI rather than encoded in
    // the URL, so there is a single route rather than a slug per pair.
    expect(conversionFor("image-converter")).toEqual({ from: null, to: "png" });
    expect(conversionFor("png-to-jpg")).toBeUndefined();
  });

  it("only ever targets an encodable format", () => {
    for (const [slug, spec] of Object.entries(CONVERSIONS)) {
      expect(FORMATS[spec.to].encodable, `${slug} targets ${spec.to}`).toBe(true);
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
