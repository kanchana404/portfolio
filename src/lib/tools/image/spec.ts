/**
 * What each image-conversion route converts, and the rules that follow from it.
 *
 * One widget serves every slug here. The registry entry differs per route
 * because each answers a different exact-match query and needs its own copy;
 * the machinery does not differ at all, so it lives once.
 *
 * Everything in this file is pure and framework-free — no canvas, no DOM — so
 * the decisions that actually go wrong in image conversion (alpha, extensions,
 * which encoders a browser really has) are testable in Node.
 */

export const IMAGE_FORMATS = ["png", "jpg", "webp", "avif", "gif", "bmp"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

interface FormatInfo {
  label: string;
  mime: string;
  /** Extensions that mean this format, first entry being canonical. */
  extensions: readonly string[];
  /** Can this format store an alpha channel? */
  alpha: boolean;
  /**
   * Can a browser *encode* it via `canvas.toBlob`?
   *
   * Decoding is near-universal for all of these; encoding is not, and the gap
   * is where converters silently lie. Chrome returns a PNG when asked for AVIF
   * rather than failing, so a page offering "convert to AVIF" hands over a
   * mislabelled file. Only formats that browsers genuinely write are offered as
   * targets.
   */
  encodable: boolean;
}

export const FORMATS: Record<ImageFormat, FormatInfo> = {
  png: {
    label: "PNG",
    mime: "image/png",
    extensions: ["png"],
    alpha: true,
    encodable: true,
  },
  jpg: {
    label: "JPG",
    mime: "image/jpeg",
    // JFIF is JPEG — the same bytes under a different extension, not another
    // format. It is listed here so a .jfif file is recognised rather than
    // rejected as unknown.
    extensions: ["jpg", "jpeg", "jfif", "jpe"],
    alpha: false,
    encodable: true,
  },
  webp: {
    label: "WebP",
    mime: "image/webp",
    extensions: ["webp"],
    alpha: true,
    // Chrome, Firefox and Edge write WebP. Safari's ImageIO cannot, and
    // `toBlob` there falls back to PNG, so the widget probes at runtime before
    // offering it rather than trusting this flag alone.
    encodable: true,
  },
  avif: {
    label: "AVIF",
    mime: "image/avif",
    extensions: ["avif"],
    alpha: true,
    // Decode is ~95% of traffic; encode is effectively nowhere, and Chrome
    // returns a PNG instead of refusing. Never offered as a target.
    encodable: false,
  },
  gif: {
    label: "GIF",
    mime: "image/gif",
    extensions: ["gif"],
    alpha: true,
    encodable: false,
  },
  bmp: {
    label: "BMP",
    mime: "image/bmp",
    extensions: ["bmp"],
    alpha: false,
    encodable: false,
  },
};

/** Formats that can be produced, in the order a picker should list them. */
export const TARGET_FORMATS: readonly ImageFormat[] = IMAGE_FORMATS.filter(
  (f) => FORMATS[f].encodable
);

export interface ConversionSpec {
  /** `null` on the hub route, which accepts anything. */
  from: ImageFormat | null;
  to: ImageFormat;
}

/**
 * Every route served by the shared converter widget.
 *
 * Declared `as const` so the slugs form a union: `tool-widget.tsx` subtracts
 * them from its exhaustive widget map, which is what lets one component answer
 * many slugs without losing the compile-time check that every *other* tool has
 * a widget.
 */
export const CONVERSION_SLUGS = [
  "image-converter",
  "png-to-jpg",
  "avif-to-jpg",
  "avif-to-png",
] as const;

export type ConversionSlug = (typeof CONVERSION_SLUGS)[number];

/**
 * Slug → what that page converts.
 *
 * Adding a route is a line here, a slug above, and a registry entry with its
 * own copy. No component work at all.
 */
export const CONVERSIONS: Record<ConversionSlug, ConversionSpec> = {
  "image-converter": { from: null, to: "png" },
  "png-to-jpg": { from: "png", to: "jpg" },
  "avif-to-jpg": { from: "avif", to: "jpg" },
  "avif-to-png": { from: "avif", to: "png" },
};

export function conversionFor(slug: string): ConversionSpec | undefined {
  return (CONVERSIONS as Record<string, ConversionSpec>)[slug];
}

/** Format implied by a filename, or null if the extension means nothing here. */
export function formatFromName(name: string): ImageFormat | null {
  const ext = name.toLowerCase().split(".").pop();
  if (!ext) return null;
  for (const format of IMAGE_FORMATS) {
    if (FORMATS[format].extensions.includes(ext)) return format;
  }
  return null;
}

/** Format implied by a MIME type, or null. Falls back to the name in callers. */
export function formatFromMime(mime: string): ImageFormat | null {
  const clean = mime.toLowerCase().split(";")[0].trim();
  for (const format of IMAGE_FORMATS) {
    if (FORMATS[format].mime === clean) return format;
  }
  // Browsers and older tooling still emit these for JPEG.
  if (clean === "image/jpg" || clean === "image/jfif") return "jpg";
  return null;
}

/**
 * Whether a conversion needs a background painted before the image.
 *
 * The classic bug: a PNG with transparency drawn onto a canvas and encoded as
 * JPEG comes out with every transparent pixel **black**, because the canvas
 * starts transparent-black and JPEG has no alpha to preserve. Filling first is
 * the whole fix, and it only applies when alpha is being dropped.
 */
export function needsMatte(from: ImageFormat | null, to: ImageFormat): boolean {
  if (FORMATS[to].alpha) return false;
  // Unknown source: assume it might have alpha. A matte on an opaque image is
  // invisible; a missing one on a transparent image is ruinous.
  return from === null || FORMATS[from].alpha;
}

/**
 * True when the two formats are the same bytes under a different name.
 *
 * JFIF *is* JPEG — ITU-T T.871 layered on T.81. Re-encoding it would throw away
 * quality to achieve nothing, so that route re-serves the original bytes.
 */
export function isRenameOnly(from: ImageFormat | null, to: ImageFormat): boolean {
  return from !== null && from === to;
}

/** Output filename: the input's stem with the target's canonical extension. */
export function outputName(inputName: string, to: ImageFormat): string {
  const stem = inputName.replace(/\.[^./\\]*$/, "") || "image";
  return `${stem}.${FORMATS[to].extensions[0]}`;
}

/** Bytes formatted for a person, not a machine. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The largest image the tool will attempt, in megapixels.
 *
 * Canvas has per-browser dimension and area ceilings, and exceeding them does
 * not throw — it yields a blank or transparent canvas, so the tool would hand
 * back an empty file and look like it worked. Refusing above a conservative
 * area is the only honest option. Safari on iOS is the binding constraint.
 */
export const MAX_MEGAPIXELS = 40;

export function exceedsPixelBudget(width: number, height: number): boolean {
  return (width * height) / 1_000_000 > MAX_MEGAPIXELS;
}
