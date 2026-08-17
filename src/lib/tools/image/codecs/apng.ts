/**
 * APNG, both directions, with no compression code and no dependency.
 *
 * The trick that makes this ~1 kB instead of ~25 kB: **an APNG frame is an
 * ordinary PNG image stream**. Each frame's pixel data is its own complete
 * zlib stream, and `fdAT` is byte-identical to `IDAT` apart from a four-byte
 * sequence number in front.
 *
 * So to *write* an APNG we ask the canvas for one PNG per frame — the browser
 * does all the deflating — and move each one's `IDAT` payload into an `fdAT`.
 * To *read* one we do the reverse: lift each frame's data back into a
 * standalone PNG and hand it to `createImageBitmap`, so the browser's own PNG
 * decoder does the work.
 *
 * Neither direction contains an inflate or deflate implementation. The browser
 * already has both; it just does not expose them for this format.
 */

export interface AnimationFrame {
  /** A complete, standalone PNG for this frame, ready for `createImageBitmap`. */
  png: Uint8Array;
  /** Display duration in milliseconds. */
  delayMs: number;
}

export class ApngError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApngError";
  }
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** CRC-32, which every PNG chunk carries and readers do check. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface Chunk {
  type: string;
  /** Payload only, without length, type or CRC. */
  data: Uint8Array;
}

/** Splits a PNG into its chunks. */
function readChunks(png: Uint8Array): Chunk[] {
  for (let i = 0; i < 8; i += 1) {
    if (png[i] !== SIGNATURE[i]) throw new ApngError("Not a PNG file.");
  }

  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Chunk[] = [];
  let p = 8;

  while (p < png.length) {
    const length = view.getUint32(p);
    const type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
    chunks.push({ type, data: png.subarray(p + 8, p + 8 + length) });
    p += 12 + length; // length + type + payload + CRC
    if (type === "IEND") break;
  }

  return chunks;
}

/** Serialises one chunk, length and CRC included. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  // The CRC covers the type and the payload, but not the length.
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * Builds an APNG from one PNG per frame.
 *
 * Every frame must already be the same size — they are full-canvas frames, not
 * the partial regions APNG also permits. That keeps the writer simple and costs
 * nothing here, because the frames come from a canvas of fixed size anyway.
 *
 * `delaysMs` are converted to the format's numerator/denominator pair using a
 * fixed denominator of 1000, so a millisecond value is exact rather than
 * rounded into hundredths the way most writers do it.
 */
export function encodeApng(
  framePngs: readonly Uint8Array[],
  delaysMs: readonly number[],
  loops = 0
): Uint8Array {
  if (framePngs.length === 0) throw new ApngError("An APNG needs at least one frame.");

  const first = readChunks(framePngs[0]);
  const ihdr = first.find((c) => c.type === "IHDR");
  if (!ihdr) throw new ApngError("The first frame has no IHDR.");

  const width = new DataView(ihdr.data.buffer, ihdr.data.byteOffset).getUint32(0);
  const height = new DataView(ihdr.data.buffer, ihdr.data.byteOffset).getUint32(4);

  const parts: Uint8Array[] = [new Uint8Array(SIGNATURE), chunk("IHDR", ihdr.data)];

  // acTL must precede the first IDAT, or readers treat the file as a still PNG.
  const actl = new Uint8Array(8);
  const actlView = new DataView(actl.buffer);
  actlView.setUint32(0, framePngs.length);
  actlView.setUint32(4, loops);
  parts.push(chunk("acTL", actl));

  let sequence = 0;

  const fctl = (delayMs: number) => {
    const data = new Uint8Array(26);
    const view = new DataView(data.buffer);
    view.setUint32(0, sequence++);
    view.setUint32(4, width);
    view.setUint32(8, height);
    view.setUint32(12, 0); // x offset
    view.setUint32(16, 0); // y offset
    // Delay as a fraction. 1/1000 keeps milliseconds exact; the more common
    // 1/100 silently rounds every value to the nearest 10 ms.
    view.setUint16(20, Math.max(0, Math.round(delayMs)));
    view.setUint16(22, 1000);
    data[24] = 0; // dispose: none
    data[25] = 0; // blend: source — frames are full-canvas and opaque-complete
    return data;
  };

  framePngs.forEach((png, index) => {
    const chunks = readChunks(png);
    const idats = chunks.filter((c) => c.type === "IDAT");
    if (idats.length === 0) throw new ApngError(`Frame ${index + 1} has no image data.`);

    parts.push(chunk("fcTL", fctl(delaysMs[index] ?? 100)));

    if (index === 0) {
      // The first frame is stored as ordinary IDAT, which is what makes an
      // APNG display as a still image in a reader that does not understand it.
      for (const idat of idats) parts.push(chunk("IDAT", idat.data));
    } else {
      for (const idat of idats) {
        // fdAT is IDAT with a sequence number in front. No re-compression.
        const data = new Uint8Array(4 + idat.data.length);
        new DataView(data.buffer).setUint32(0, sequence++);
        data.set(idat.data, 4);
        parts.push(chunk("fdAT", data));
      }
    }
  });

  parts.push(chunk("IEND", new Uint8Array(0)));
  return concat(parts);
}

/** True if this PNG carries animation control chunks. */
export function isAnimatedPng(png: Uint8Array): boolean {
  try {
    return readChunks(png).some((c) => c.type === "acTL");
  } catch {
    return false;
  }
}

/**
 * Splits an APNG into standalone PNGs, one per frame.
 *
 * Each frame is rebuilt as its own minimal PNG — signature, the shared IHDR,
 * any palette chunks, that frame's data as IDAT, IEND — so the caller can hand
 * it straight to `createImageBitmap` and let the browser decode it.
 *
 * Frames that are smaller than the canvas (APNG allows a frame to update only
 * a region) are returned at their own size with their offset applied by the
 * caller; here the IHDR is rewritten to the frame's dimensions so the PNG is
 * self-consistent.
 */
export function decodeApng(png: Uint8Array): AnimationFrame[] {
  const chunks = readChunks(png);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new ApngError("This PNG has no IHDR.");
  if (!chunks.some((c) => c.type === "acTL")) {
    throw new ApngError("This PNG is not animated.");
  }

  // Palette and transparency chunks are shared by every frame and must be
  // copied into each rebuilt PNG, or a palettised APNG decodes as garbage.
  const shared = chunks.filter((c) => c.type === "PLTE" || c.type === "tRNS");

  const frames: AnimationFrame[] = [];
  let current: { width: number; height: number; delayMs: number; parts: Uint8Array[] } | null =
    null;

  const flush = () => {
    if (!current) return;
    const header = new Uint8Array(ihdr.data);
    const view = new DataView(header.buffer);
    view.setUint32(0, current.width);
    view.setUint32(4, current.height);

    frames.push({
      png: concat([
        new Uint8Array(SIGNATURE),
        chunk("IHDR", header),
        ...shared.map((c) => chunk(c.type, c.data)),
        ...current.parts.map((d) => chunk("IDAT", d)),
        chunk("IEND", new Uint8Array(0)),
      ]),
      delayMs: current.delayMs,
    });
    current = null;
  };

  for (const c of chunks) {
    if (c.type === "fcTL") {
      flush();
      const view = new DataView(c.data.buffer, c.data.byteOffset, c.data.byteLength);
      const num = view.getUint16(20);
      const den = view.getUint16(22) || 100; // 0 means 100, per the spec
      current = {
        width: view.getUint32(4),
        height: view.getUint32(8),
        delayMs: (num / den) * 1000,
        parts: [],
      };
    } else if (c.type === "IDAT" && current) {
      current.parts.push(c.data);
    } else if (c.type === "fdAT" && current) {
      // Drop the four-byte sequence number to recover the IDAT payload.
      current.parts.push(c.data.subarray(4));
    }
  }
  flush();

  if (frames.length === 0) throw new ApngError("No frames found in this APNG.");
  return frames;
}
