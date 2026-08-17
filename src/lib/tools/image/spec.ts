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

export const IMAGE_FORMATS = [
  "png",
  "jpg",
  "webp",
  "ico",
  "bmp",
  "tga",
  "qoi",
  "ppm",
  "tiff",
  "avif",
  "jxl",
  "gif",
] as const;
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
    // No browser writes AVIF — `toBlob` returns a PNG rather than refusing —
    // so this is encoded by libaom in ./codecs/wasm. Decoding stays native:
    // Chrome 85+, Firefox 93+ and Safari 16.4+ all read AVIF, so the 261 kB
    // decoder is carried only as a fallback and almost never fetched.
    encodable: true,
  },
  jxl: {
    label: "JPEG XL",
    mime: "image/jxl",
    extensions: ["jxl"],
    alpha: true,
    // Encoded by libjxl in ./codecs/wasm. Decoding is native on Safari 17+ and
    // nowhere else — Chrome removed its implementation in 110 — so unlike AVIF
    // the fallback decoder here is the usual path rather than the rare one.
    encodable: true,
  },
  gif: {
    label: "GIF",
    mime: "image/gif",
    extensions: ["gif"],
    alpha: true,
    // `toBlob("image/gif")` returns a PNG, so GIF is written by `gifenc` (MIT,
    // 3.5 kB) in ./animation — which also means a GIF written here keeps its
    // animation rather than collapsing to frame one.
    encodable: true,
  },
  bmp: {
    label: "BMP",
    mime: "image/bmp",
    extensions: ["bmp", "dib"],
    alpha: true,
    // Hand-written BITMAPV5HEADER writer in ./codecs/raster — `toBlob` cannot
    // write BMP, but the format is simple enough that implementing it costs
    // less than depending on something that has.
    encodable: true,
  },
  tga: {
    label: "TGA",
    mime: "image/x-tga",
    extensions: ["tga", "targa", "icb", "vda", "vst"],
    alpha: true,
    encodable: true,
  },
  qoi: {
    label: "QOI",
    mime: "image/qoi",
    extensions: ["qoi"],
    alpha: true,
    encodable: true,
  },
  ppm: {
    label: "PPM",
    mime: "image/x-portable-pixmap",
    extensions: ["ppm", "pgm", "pnm"],
    // The PNM family has no alpha channel at all, so a matte is required.
    alpha: false,
    encodable: true,
  },
  tiff: {
    label: "TIFF",
    mime: "image/tiff",
    extensions: ["tiff", "tif"],
    alpha: true,
    // Written by hand in ./codecs/tiff — the compressor is the browser's own
    // `CompressionStream("deflate")`, which emits exactly TIFF Compression=8.
    // Reading needs utif2 (MIT), loaded on demand.
    encodable: true,
  },
  ico: {
    label: "ICO",
    mime: "image/x-icon",
    extensions: ["ico"],
    alpha: true,
    // `canvas.toBlob("image/x-icon")` returns a PNG, like every other type the
    // browser cannot write. But ICO is the one format that does not need an
    // encoder: since Vista an .ico may hold PNG data verbatim, so the file is a
    // 6-byte header, a 16-byte directory entry per size, and PNGs the browser
    // already produces. `encodeIco` in ./pipeline builds it in ~30 lines.
    encodable: true,
  },
};

/**
 * Formats that can be produced, in the order a picker should list them.
 *
 * A browser encodes exactly three of these itself through `canvas.toBlob` —
 * PNG, JPEG and WebP — and *silently returns a PNG* for anything else rather
 * than refusing, which is how converters end up handing over mislabelled files.
 * Every other entry here had to be written or fetched:
 *
 * - ICO, BMP, TGA, QOI, PPM and TIFF are written by hand, cheaply, because the
 *   browser already owns the hard part. ICO holds PNGs verbatim; TIFF's
 *   compressor is `CompressionStream("deflate")`. Container work, not codecs.
 * - GIF costs 3.5 kB of `gifenc`, and keeps animation rather than collapsing to
 *   frame one.
 * - AVIF and JPEG XL are the only real downloads, because no browser will write
 *   them at any price. Their cost is declared in `CODEC_BYTES` and shown on the
 *   option, so the choice is made with the number visible.
 */
export const TARGET_FORMATS: readonly ImageFormat[] = IMAGE_FORMATS.filter(
  (f) => FORMATS[f].encodable
);

/**
 * Formats a browser cannot decode, which this project reads itself.
 *
 * `createImageBitmap` refuses these, so the pipeline runs its own reader first
 * and hands the resulting pixels to a canvas. Without this list the tool would
 * report "this file could not be read as an image" for files it can in fact
 * read perfectly well.
 */
export const SELF_DECODED: readonly ImageFormat[] = ["tga", "qoi", "ppm", "tiff"];

/**
 * What a format costs the visitor to use, in bytes fetched on demand.
 *
 * Surfaced on the format option itself, so the price is visible *before* the
 * choice rather than discovered as a stalled progress bar. Zero means the
 * browser already has everything needed.
 *
 * These are measured wire sizes, not estimates. A number here that drifts from
 * reality is worse than no number, because it is quoted to the reader.
 */
export const CODEC_BYTES: Partial<Record<ImageFormat, number>> = {
  tiff: 35_000, // utif2 + pako, decode only; writing is free
  // Brotli-compressed sizes of the single-threaded builds, which are the ones
  // that actually run — the multi-threaded variants need SharedArrayBuffer, and
  // the COOP/COEP headers that requires would break the site's embeds.
  avif: 822_000, // libaom encoder
  jxl: 378_000, // libjxl encoder
};

/**
 * Formats encoded by WebAssembly rather than by the browser.
 *
 * The distinction is what makes these the only two targets that stall before
 * producing anything: a megabyte has to arrive before the first byte is
 * written. The pipeline uses this to report "fetching the encoder" separately
 * from "encoding", so a slow connection looks like a download rather than a
 * hang.
 */
export const WASM_ENCODED: readonly ImageFormat[] = ["avif", "jxl"];

/** Human-readable download cost, or null when there is nothing to fetch. */
export function codecCost(format: ImageFormat): string | null {
  const bytes = CODEC_BYTES[format];
  if (!bytes) return null;
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB once`
    : `${Math.round(bytes / 1000)} kB once`;
}

/** Sizes packed into a generated .ico, which is what a favicon wants. */
export const ICO_SIZES = [16, 32, 48, 256] as const;

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
export const CONVERSION_SLUGS = ["image-converter"] as const;

export type ConversionSlug = (typeof CONVERSION_SLUGS)[number];

/**
 * Slug → what that page converts.
 *
 * Adding a route is a line here, a slug above, and a registry entry with its
 * own copy. No component work at all.
 */
export const CONVERSIONS: Record<ConversionSlug, ConversionSpec> = {
  "image-converter": { from: null, to: "png" },
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
 * area is the only honest option.
 *
 * **16, not 40.** iOS Safari's real ceiling is 16,777,216 pixels (2^24), and 40
 * was 2.4× past it — so a perfectly ordinary 24 MP photo cleared this guard and
 * handed an iPhone user a blank file. The file need not even be large: a 24 MP
 * AVIF is around 380 kB, so no size check would have caught it either.
 *
 * Desktop browsers allow more, and this costs them some headroom. That is the
 * right way round: the failure mode here is silent and produces a plausible
 * empty file, so the cap tracks the *strictest* engine rather than the average.
 */
export const MAX_MEGAPIXELS = 16;

export function exceedsPixelBudget(width: number, height: number): boolean {
  return (width * height) / 1_000_000 > MAX_MEGAPIXELS;
}
