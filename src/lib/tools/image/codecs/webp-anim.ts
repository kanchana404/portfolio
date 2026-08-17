/**
 * Animated WebP, both directions, as a container problem rather than a codec.
 *
 * Exactly the trick that makes the APNG codec small applies here: a frame
 * inside an animated WebP is the *same compressed bitstream* a still WebP
 * carries. So writing means asking the canvas for one still WebP per frame —
 * the browser runs the VP8 encoder — and re-wrapping each one's image chunk in
 * an `ANMF`. Reading is the reverse.
 *
 * Neither direction contains a VP8 implementation. This file only parses and
 * emits RIFF chunks.
 *
 * One asymmetry worth knowing: **Safari can decode animated WebP but cannot
 * encode WebP at all**, so `decodeAnimatedWebp` works everywhere while
 * `encodeAnimatedWebp` needs frames from a browser whose `toBlob` writes WebP.
 * The caller probes for that; see `canEncode` in ../pipeline.
 */

export interface WebpFrame {
  /** A complete, standalone WebP for this frame. */
  webp: Uint8Array;
  /** Display duration in milliseconds. */
  delayMs: number;
}

export class WebpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebpError";
  }
}

interface RiffChunk {
  type: string;
  data: Uint8Array;
}

const fourCC = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);

/**
 * Splits the chunks inside a RIFF/WEBP container.
 *
 * RIFF pads every odd-length chunk to an even boundary, and the padding byte is
 * not counted in the declared size — skipping that step is the classic way a
 * parser drifts one byte and reads the rest of the file as nonsense.
 */
function readRiff(bytes: Uint8Array): RiffChunk[] {
  if (bytes.length < 12 || fourCC(bytes, 0) !== "RIFF" || fourCC(bytes, 8) !== "WEBP") {
    throw new WebpError("Not a WebP file.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: RiffChunk[] = [];
  let p = 12;

  while (p + 8 <= bytes.length) {
    const type = fourCC(bytes, p);
    const size = view.getUint32(p + 4, true);
    chunks.push({ type, data: bytes.subarray(p + 8, p + 8 + size) });
    p += 8 + size + (size & 1); // pad to even
  }

  return chunks;
}

/** Serialises one RIFF chunk, with its pad byte when the payload is odd. */
function riffChunk(type: string, data: Uint8Array): Uint8Array {
  const padded = data.length + (data.length & 1);
  const out = new Uint8Array(8 + padded);
  for (let i = 0; i < 4; i += 1) out[i] = type.charCodeAt(i);
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
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

/** Wraps chunks in a RIFF/WEBP header. */
function riffFile(parts: Uint8Array[]): Uint8Array {
  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out[0] = 0x52; // R
  out[1] = 0x49; // I
  out[2] = 0x46; // F
  out[3] = 0x46; // F
  // The declared size covers everything after this field, including "WEBP".
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out[8] = 0x57; // W
  out[9] = 0x45; // E
  out[10] = 0x42; // B
  out[11] = 0x50; // P
  out.set(body, 12);
  return out;
}

const setUint24 = (view: DataView, at: number, value: number) => {
  view.setUint8(at, value & 0xff);
  view.setUint8(at + 1, (value >> 8) & 0xff);
  view.setUint8(at + 2, (value >> 16) & 0xff);
};

const getUint24 = (view: DataView, at: number) =>
  view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getUint8(at + 2) << 16);

/** The image payload of a still WebP: its bitstream, and its alpha if separate. */
function imageChunks(webp: Uint8Array): RiffChunk[] {
  const chunks = readRiff(webp);
  const wanted = chunks.filter(
    (c) => c.type === "VP8 " || c.type === "VP8L" || c.type === "ALPH"
  );
  if (wanted.length === 0) throw new WebpError("This WebP contains no image data.");
  // ALPH must precede the bitstream it applies to.
  return wanted.sort((a, b) => (a.type === "ALPH" ? -1 : b.type === "ALPH" ? 1 : 0));
}

/** Canvas dimensions, read from whichever header this WebP uses. */
function dimensionsOf(webp: Uint8Array): { width: number; height: number } {
  const chunks = readRiff(webp);

  const vp8x = chunks.find((c) => c.type === "VP8X");
  if (vp8x) {
    const view = new DataView(vp8x.data.buffer, vp8x.data.byteOffset, vp8x.data.byteLength);
    // Stored minus one, because a zero-pixel canvas is not a thing.
    return { width: getUint24(view, 4) + 1, height: getUint24(view, 7) + 1 };
  }

  const lossy = chunks.find((c) => c.type === "VP8 ");
  if (lossy) {
    const view = new DataView(lossy.data.buffer, lossy.data.byteOffset, lossy.data.byteLength);
    // Skip the 3-byte frame tag and the 3-byte start code.
    return {
      width: view.getUint16(6, true) & 0x3fff,
      height: view.getUint16(8, true) & 0x3fff,
    };
  }

  const lossless = chunks.find((c) => c.type === "VP8L");
  if (lossless) {
    const d = lossless.data;
    // 14 bits each, packed after the 1-byte signature.
    const bits = d[1] | (d[2] << 8) | (d[3] << 16) | (d[4] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }

  throw new WebpError("Could not read this WebP's dimensions.");
}

/**
 * Builds an animated WebP from one still WebP per frame.
 *
 * Frames are full-canvas, and each is marked "dispose to background, do not
 * blend" so a frame with transparency does not composite over its predecessor.
 * Blending is the right default for a hand-optimised animation and the wrong
 * one here, where every frame is already complete.
 */
export function encodeAnimatedWebp(
  frames: readonly Uint8Array[],
  delaysMs: readonly number[],
  loops = 0
): Uint8Array {
  if (frames.length === 0) throw new WebpError("An animation needs at least one frame.");

  // Called for its refusal, before the dimensions are read: a file with nothing
  // in it should be reported as empty, not as having an unreadable header,
  // which is where `dimensionsOf` alone would send the reader looking.
  imageChunks(frames[0]);

  const { width, height } = dimensionsOf(frames[0]);

  // VP8X: the extended header, required before ANIM/ANMF may appear.
  const vp8x = new Uint8Array(10);
  const vp8xView = new DataView(vp8x.buffer);
  // Bit 1 = animation, bit 4 = alpha. Alpha is declared unconditionally: a
  // false positive costs nothing, a false negative flattens transparency.
  vp8x[0] = 0x02 | 0x10;
  setUint24(vp8xView, 4, width - 1);
  setUint24(vp8xView, 7, height - 1);

  // ANIM: background colour (transparent) and loop count.
  const anim = new Uint8Array(6);
  const animView = new DataView(anim.buffer);
  animView.setUint32(0, 0x00000000, true);
  animView.setUint16(4, loops, true);

  const parts: Uint8Array[] = [riffChunk("VP8X", vp8x), riffChunk("ANIM", anim)];

  frames.forEach((frame, index) => {
    const payload = concat(imageChunks(frame).map((c) => riffChunk(c.type, c.data)));

    const header = new Uint8Array(16);
    const view = new DataView(header.buffer);
    setUint24(view, 0, 0); // x, in units of 2px
    setUint24(view, 3, 0); // y
    setUint24(view, 6, width - 1);
    setUint24(view, 9, height - 1);
    setUint24(view, 12, Math.max(0, Math.round(delaysMs[index] ?? 100)));
    // bit 1 = dispose to background, bit 0 clear = no blending
    header[15] = 0x02;

    parts.push(riffChunk("ANMF", concat([header, payload])));
  });

  return riffFile(parts);
}

/** True if this WebP carries animation chunks. */
export function isAnimatedWebp(bytes: Uint8Array): boolean {
  try {
    return readRiff(bytes).some((c) => c.type === "ANMF" || c.type === "ANIM");
  } catch {
    return false;
  }
}

/**
 * Splits an animated WebP into standalone still WebPs, one per frame.
 *
 * Each frame is re-wrapped in its own RIFF container so the caller can hand it
 * to `createImageBitmap` and let the browser decode it — which Safari can do,
 * even though it cannot encode WebP.
 */
export function decodeAnimatedWebp(bytes: Uint8Array): WebpFrame[] {
  const chunks = readRiff(bytes);
  const anmf = chunks.filter((c) => c.type === "ANMF");
  if (anmf.length === 0) throw new WebpError("This WebP is not animated.");

  return anmf.map((frame) => {
    const view = new DataView(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
    const delayMs = getUint24(view, 12);

    // Everything after the 16-byte ANMF header is ordinary RIFF chunks.
    const inner = frame.data.subarray(16);
    const parts: Uint8Array[] = [];
    let p = 0;
    let hasAlpha = false;

    while (p + 8 <= inner.length) {
      const type = fourCC(inner, p);
      const size = new DataView(inner.buffer, inner.byteOffset, inner.byteLength).getUint32(
        p + 4,
        true
      );
      if (type === "ALPH") hasAlpha = true;
      parts.push(riffChunk(type, inner.subarray(p + 8, p + 8 + size)));
      p += 8 + size + (size & 1);
    }

    if (parts.length === 0) throw new WebpError("A frame contained no image data.");

    // A frame carrying a separate alpha chunk needs the extended header to
    // declare it, or the alpha is ignored and the frame decodes opaque.
    if (hasAlpha) {
      const w = getUint24(view, 6) + 1;
      const h = getUint24(view, 9) + 1;
      const vp8x = new Uint8Array(10);
      const vp8xView = new DataView(vp8x.buffer);
      vp8x[0] = 0x10; // alpha, but no animation on a single frame
      setUint24(vp8xView, 4, w - 1);
      setUint24(vp8xView, 7, h - 1);
      parts.unshift(riffChunk("VP8X", vp8x));
    }

    return { webp: riffFile(parts), delayMs };
  });
}
