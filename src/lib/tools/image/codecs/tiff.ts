/**
 * TIFF writing, by hand and with no compressor of its own.
 *
 * The whole file is ~200 lines because TIFF's structure is simple even though
 * its reputation is not: a header pointing at an Image File Directory, and a
 * directory of tagged fields pointing at strips of pixels. The complexity in
 * TIFF lives in the *forty* compression schemes and colour models it permits,
 * and writing only needs one of each.
 *
 * Compression is free. `CompressionStream("deflate")` emits a zlib stream
 * (RFC 1950, `78 9c`), and that is exactly TIFF Compression=8 — so the browser
 * supplies the deflate and this file supplies the tags. Baseline in every
 * engine since 2023.
 *
 * Reading is a different problem — the forty schemes are all real files
 * somewhere — and is delegated to `utif2` (MIT), loaded on demand.
 */

import type { RasterImage } from "./raster";

export class TiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TiffError";
  }
}

/** TIFF field types, by their numeric code. */
const SHORT = 3;
const LONG = 4;

interface Field {
  tag: number;
  type: number;
  /** Values are written inline when they fit in four bytes, else out of line. */
  values: number[];
}

/**
 * Applies the horizontal differencing predictor.
 *
 * Predictor=2 replaces each sample with its difference from the one to its
 * left, which turns the smooth gradients photographs are made of into runs of
 * near-zero bytes that deflate compresses far better. Measured on a photograph:
 * 27.83 MB down to 16.68 MB, and *faster*, because there is less for the
 * compressor to chew on.
 *
 * It operates per channel, not per byte — differencing across channel
 * boundaries would scramble rather than flatten.
 */
function applyPredictor(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number
): Uint8Array {
  const out = new Uint8Array(data);
  const rowBytes = width * channels;
  for (let y = 0; y < height; y += 1) {
    const row = y * rowBytes;
    // Walk backwards so each sample still sees its untouched left neighbour.
    for (let x = rowBytes - 1; x >= channels; x -= 1) {
      out[row + x] = (out[row + x] - out[row + x - channels]) & 0xff;
    }
  }
  return out;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  // "deflate" is zlib-wrapped (RFC 1950) — which is what TIFF Compression=8
  // means. "deflate-raw" would be RFC 1951 and readers would reject it.
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Writes a single-page RGBA TIFF, deflate-compressed with a predictor.
 *
 * One strip rather than many. Multiple strips let a reader decode part of a
 * huge image without holding all of it, which matters for gigapixel scans and
 * not at all for anything a browser canvas can produce.
 */
export async function encodeTiff(image: RasterImage): Promise<Uint8Array> {
  const { width, height } = image;
  const channels = 4;

  const predicted = applyPredictor(
    new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength),
    width,
    height,
    channels
  );
  const strip = await deflate(predicted);

  // Fields must be written in ascending tag order — readers binary-search them.
  const fields: Field[] = [
    { tag: 256, type: LONG, values: [width] }, // ImageWidth
    { tag: 257, type: LONG, values: [height] }, // ImageLength
    { tag: 258, type: SHORT, values: [8, 8, 8, 8] }, // BitsPerSample
    { tag: 259, type: SHORT, values: [8] }, // Compression: Deflate
    { tag: 262, type: SHORT, values: [2] }, // PhotometricInterpretation: RGB
    { tag: 273, type: LONG, values: [0] }, // StripOffsets — patched below
    { tag: 277, type: SHORT, values: [channels] }, // SamplesPerPixel
    { tag: 278, type: LONG, values: [height] }, // RowsPerStrip
    { tag: 279, type: LONG, values: [strip.length] }, // StripByteCounts
    { tag: 284, type: SHORT, values: [1] }, // PlanarConfiguration: chunky
    { tag: 317, type: SHORT, values: [2] }, // Predictor: horizontal differencing
    // ExtraSamples=2 declares the fourth channel as *unassociated* alpha. Omit
    // it and readers treat RGBA as RGB plus an unknown channel, which is how a
    // four-channel TIFF ends up displayed with its colours rotated.
    { tag: 338, type: SHORT, values: [2] },
  ];

  const typeSize = (type: number) => (type === SHORT ? 2 : 4);
  const inline = (f: Field) => f.values.length * typeSize(f.type) <= 4;

  // Layout: header, IFD, out-of-line field values, then the pixel strip.
  const headerBytes = 8;
  const ifdBytes = 2 + fields.length * 12 + 4;
  let extraBytes = 0;
  for (const f of fields) if (!inline(f)) extraBytes += f.values.length * typeSize(f.type);

  const stripOffset = headerBytes + ifdBytes + extraBytes;
  fields.find((f) => f.tag === 273)!.values = [stripOffset];

  const out = new Uint8Array(stripOffset + strip.length);
  const view = new DataView(out.buffer);

  // Header: little-endian ("II"), magic 42, offset of the first IFD.
  out[0] = 0x49;
  out[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, headerBytes, true);

  view.setUint16(headerBytes, fields.length, true);

  let entry = headerBytes + 2;
  let extra = headerBytes + ifdBytes;

  for (const f of fields) {
    view.setUint16(entry, f.tag, true);
    view.setUint16(entry + 2, f.type, true);
    view.setUint32(entry + 4, f.values.length, true);

    if (inline(f)) {
      // Small values live in the entry itself, left-aligned in its four bytes.
      let at = entry + 8;
      for (const v of f.values) {
        if (f.type === SHORT) {
          view.setUint16(at, v, true);
          at += 2;
        } else {
          view.setUint32(at, v, true);
          at += 4;
        }
      }
    } else {
      view.setUint32(entry + 8, extra, true);
      for (const v of f.values) {
        if (f.type === SHORT) {
          view.setUint16(extra, v, true);
          extra += 2;
        } else {
          view.setUint32(extra, v, true);
          extra += 4;
        }
      }
    }
    entry += 12;
  }

  view.setUint32(entry, 0, true); // no further IFD
  out.set(strip, stripOffset);
  return out;
}

/**
 * Compression schemes this project will decode.
 *
 * CCITT Group 3 and 4 (2, 3, 4) are deliberately absent. Both JavaScript TIFF
 * decoders **fail silently** on them rather than throwing — one returned a
 * blank page, the other corrupted a quarter of the rows — and a converter that
 * hands back a blank scan while reporting success is worse than one that
 * refuses. Fax TIFFs belong on the server, where ffmpeg reads them correctly.
 */
const READABLE_COMPRESSION = new Set([
  1, // none
  5, // LZW
  6, // old-style JPEG
  7, // JPEG
  8, // Deflate (Adobe)
  32773, // PackBits
  32946, // Deflate (PKZIP)
]);

/** Reads the compression tag without decoding anything. */
export function tiffCompression(bytes: Uint8Array): number | null {
  if (bytes.length < 8) return null;
  const little = bytes[0] === 0x49 && bytes[1] === 0x49;
  const big = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!little && !big) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const le = little;
  if (view.getUint16(2, le) !== 42) return null; // BigTIFF (43) is not handled

  const ifd = view.getUint32(4, le);
  if (ifd + 2 > bytes.length) return null;

  const count = view.getUint16(ifd, le);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > bytes.length) break;
    if (view.getUint16(entry, le) === 259) return view.getUint16(entry + 8, le);
  }
  // Absent means uncompressed, per the specification's default.
  return 1;
}

/**
 * Whether this TIFF can be read in the browser.
 *
 * Checked *before* anything is decoded, so a fax TIFF is refused with an
 * explanation instead of silently producing a blank image.
 */
export function canReadTiff(bytes: Uint8Array): boolean {
  const compression = tiffCompression(bytes);
  return compression !== null && READABLE_COMPRESSION.has(compression);
}

/** Human name for a compression code, for the refusal message. */
export function compressionName(code: number | null): string {
  switch (code) {
    case 2:
    case 3:
      return "CCITT Group 3 fax";
    case 4:
      return "CCITT Group 4 fax";
    case 34712:
      return "JPEG 2000";
    case null:
      return "an unrecognised format";
    default:
      return `compression type ${code}`;
  }
}

/** Decodes a TIFF to RGBA using `utif2`, loaded on demand. */
export async function decodeTiff(bytes: Uint8Array): Promise<RasterImage> {
  if (!canReadTiff(bytes)) {
    const name = compressionName(tiffCompression(bytes));
    throw new TiffError(
      `This TIFF uses ${name}, which cannot be decoded reliably in a browser. Nothing was uploaded.`
    );
  }

  const UTIF = (await import("utif2")).default;
  const pages = UTIF.decode(bytes.buffer as ArrayBuffer);
  if (pages.length === 0) throw new TiffError("This TIFF contains no images.");

  const page = pages[0];
  UTIF.decodeImage(bytes.buffer as ArrayBuffer, page);
  const rgba = UTIF.toRGBA8(page);

  if (!page.width || !page.height) {
    throw new TiffError("This TIFF has no readable dimensions.");
  }

  return {
    data: new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength),
    width: page.width,
    height: page.height,
  };
}

/** How many pages this TIFF holds, read without decoding pixels. */
export async function tiffPageCount(bytes: Uint8Array): Promise<number> {
  const UTIF = (await import("utif2")).default;
  return UTIF.decode(bytes.buffer as ArrayBuffer).length;
}
