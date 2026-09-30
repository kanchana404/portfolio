/**
 * Width, height and feature flags from a WebP file's header (RFC 9649).
 *
 * Blog images are plain `<img>` elements with the file's own width and height,
 * so nothing shifts while they load: `next/image` is banned on the budgeted
 * `/blog/[slug]` route, and no image dependency is allowed. The header gives
 * the dimensions in 30 bytes; the rest of the file is walked chunk by chunk,
 * so metadata, animation or stray data cannot hide behind a header that does
 * not announce it.
 *
 * Pure: works on a Uint8Array through a DataView, no Buffer, no fs. Policy
 * (size limits, no metadata, no animation) lives in validate.ts.
 */

export class WebpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebpError";
  }
}

export interface WebpInfo {
  format: "lossy" | "lossless" | "extended";
  width: number;
  height: number;
  alpha: boolean;
  animated: boolean;
  exif: boolean;
  xmp: boolean;
  icc: boolean;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** What an extended (VP8X) file may hold after its header (RFC 9649, 2.7). */
const EXTENDED_CHUNKS = new Set(["ICCP", "ANIM", "ANMF", "ALPH", "VP8 ", "VP8L", "EXIF", "XMP "]);

/**
 * Every chunk's fourcc, first to last. Each chunk is a fourcc, a u32le size
 * and the data, padded to an even length, and the last one must end exactly
 * at the end of the file.
 */
function chunkList(bytes: Uint8Array, view: DataView): string[] {
  const found: string[] = [];
  let offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new WebpError("a chunk header runs past the end of the file");
    const fourcc = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size + (size & 1);
    if (end > bytes.length) throw new WebpError(`the ${fourcc.trim()} chunk runs past the end of the file`);
    found.push(fourcc);
    offset = end;
  }
  return found;
}

export function readWebpInfo(bytes: Uint8Array): WebpInfo {
  if (bytes.length < 20) throw new WebpError("shorter than a WebP header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u24 = (offset: number) =>
    bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);

  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    throw new WebpError("not a RIFF/WEBP file");
  }
  // Exact, not "at least": a short file is truncated, and bytes after the
  // RIFF data are how one file is made to be two formats at once.
  if (view.getUint32(4, true) + 8 !== bytes.length) {
    throw new WebpError("the RIFF size does not match the file length");
  }

  const fourcc = ascii(bytes, 12, 4);
  const size = view.getUint32(16, true);
  if (20 + size > bytes.length) {
    throw new WebpError(`the ${fourcc.trim()} chunk runs past the end of the file`);
  }

  let info: WebpInfo;
  const plain = { alpha: false, animated: false, exif: false, xmp: false, icc: false };

  if (fourcc === "VP8 ") {
    if (size < 10 || bytes.length < 30) throw new WebpError("VP8 chunk too short");
    if ((bytes[20] & 1) !== 0) throw new WebpError("VP8 data does not start with a key frame");
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      throw new WebpError("bad VP8 start code");
    }
    info = {
      format: "lossy",
      // The top two bits are the upscaling hint, ignored as libwebp does.
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
      ...plain,
    };
  } else if (fourcc === "VP8L") {
    if (size < 5 || bytes.length < 25) throw new WebpError("VP8L chunk too short");
    if (bytes[20] !== 0x2f) throw new WebpError("bad VP8L signature");
    const bits = view.getUint32(21, true);
    if (((bits >>> 29) & 7) !== 0) throw new WebpError("unknown VP8L version");
    info = {
      format: "lossless",
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      ...plain,
      alpha: ((bits >>> 28) & 1) === 1,
    };
  } else if (fourcc === "VP8X") {
    if (size !== 10) throw new WebpError("VP8X chunk must be 10 bytes");
    const flags = bytes[20];
    info = {
      format: "extended",
      width: 1 + u24(24),
      height: 1 + u24(27),
      icc: (flags & 0x20) !== 0,
      alpha: (flags & 0x10) !== 0,
      exif: (flags & 0x08) !== 0,
      xmp: (flags & 0x04) !== 0,
      animated: (flags & 0x02) !== 0,
    };
    if (info.width * info.height > 0xffffffff) {
      throw new WebpError("canvas larger than the format allows");
    }
  } else {
    throw new WebpError(`unsupported first chunk "${fourcc}"`);
  }

  if (info.width === 0 || info.height === 0) throw new WebpError("zero width or height");

  // The VP8X flags only announce what the file carries, and the RIFF size
  // check alone lets any chunk ride inside it. So every chunk is read: a
  // simple file is its one image chunk, an extended one holds only chunks
  // the format defines, and metadata or animation counts as present when
  // either its flag or its chunk is.
  const chunks = chunkList(bytes, view);
  if (info.format !== "extended") {
    if (chunks.length !== 1) {
      const extra = chunks.slice(1).map((chunk) => chunk.trim());
      throw new WebpError(
        `a simple WebP is one ${fourcc.trim()} chunk; this one also has ${extra.join(", ")}`
      );
    }
    return info;
  }
  const unknown = chunks.slice(1).filter((chunk) => !EXTENDED_CHUNKS.has(chunk));
  if (unknown.length > 0) throw new WebpError(`unknown chunk "${unknown[0]}"`);
  if (!chunks.some((chunk) => chunk === "VP8 " || chunk === "VP8L" || chunk === "ANMF")) {
    throw new WebpError("an extended WebP with no image data");
  }
  info.exif ||= chunks.includes("EXIF");
  info.xmp ||= chunks.includes("XMP ");
  info.animated ||= chunks.includes("ANIM") || chunks.includes("ANMF");
  info.icc ||= chunks.includes("ICCP");
  return info;
}
