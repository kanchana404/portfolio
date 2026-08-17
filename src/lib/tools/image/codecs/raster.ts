/**
 * Hand-written readers and writers for the formats a browser has no codec for.
 *
 * BMP, TGA, QOI and the PNM family are all simple enough to implement directly,
 * and doing so costs roughly a kilobyte against ~35 kB for the smallest library
 * that covers even one of them. More importantly it is *auditable*: every byte
 * written here is written on purpose.
 *
 * Everything works on RGBA — the layout `ctx.getImageData()` hands back and
 * `ctx.putImageData()` takes — so the browser stays responsible for decoding
 * and rendering, and this file only ever moves bytes. That is also why it is
 * pure and framework-free: these are exhaustively testable in Node without a
 * canvas anywhere.
 */

export interface RasterImage {
  /** RGBA, 4 bytes per pixel, row-major from the top-left. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export class RasterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RasterError";
  }
}

/* ------------------------------------------------------------------ BMP -- */

/**
 * Writes a 32-bit BMP with a BITMAPV5HEADER.
 *
 * V5 (124 bytes) rather than V4 (108) or the classic BITMAPINFOHEADER (40),
 * because only V5 carries the channel masks *and* the colour-space fields that
 * macOS ImageIO requires before it will honour alpha — a V4 file with
 * transparency is rejected outright there rather than shown opaque.
 *
 * Rows are written bottom-up, the format's original convention. Top-down is
 * legal (negative height) and simpler, but old Windows readers and a surprising
 * number of image libraries still mishandle it.
 */
export function encodeBmp(image: RasterImage): Uint8Array {
  const { data, width, height } = image;
  // Each row is padded to a 4-byte boundary. At 32bpp that is always already
  // true, but the calculation stays so the rule is visible rather than assumed.
  const rowBytes = width * 4;
  const pixelBytes = rowBytes * height;
  const headerBytes = 14 + 124;

  const out = new Uint8Array(headerBytes + pixelBytes);
  const view = new DataView(out.buffer);

  // BITMAPFILEHEADER
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  view.setUint32(2, out.length, true);
  view.setUint32(6, 0, true); // reserved
  view.setUint32(10, headerBytes, true); // pixel data offset

  // BITMAPV5HEADER
  view.setUint32(14, 124, true); // header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-up
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 32, true); // bits per pixel
  view.setUint32(30, 3, true); // BI_BITFIELDS
  view.setUint32(34, pixelBytes, true);
  view.setInt32(38, 2835, true); // 72 DPI in pixels/metre
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true); // palette entries
  view.setUint32(50, 0, true); // important colours
  view.setUint32(54, 0x00ff0000, true); // red mask
  view.setUint32(58, 0x0000ff00, true); // green mask
  view.setUint32(62, 0x000000ff, true); // blue mask
  view.setUint32(66, 0xff000000, true); // alpha mask
  view.setUint32(70, 0x73524742, true); // 'sRGB' colour space

  // Pixels: BGRA, bottom row first.
  let p = headerBytes;
  for (let y = height - 1; y >= 0; y -= 1) {
    let s = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      out[p] = data[s + 2]; // B
      out[p + 1] = data[s + 1]; // G
      out[p + 2] = data[s]; // R
      out[p + 3] = data[s + 3]; // A
      p += 4;
      s += 4;
    }
  }

  return out;
}

/** Reads the 24- and 32-bit uncompressed BMPs that make up almost all of them. */
export function decodeBmp(bytes: Uint8Array): RasterImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
    throw new RasterError("Not a BMP file.");
  }

  const dataOffset = view.getUint32(10, true);
  const headerSize = view.getUint32(14, true);
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const bpp = view.getUint16(28, true);

  // A negative height means the rows are stored top-down.
  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;

  if (bpp !== 24 && bpp !== 32) {
    throw new RasterError(
      `This BMP is ${bpp}-bit. Only 24- and 32-bit BMPs are supported.`
    );
  }
  if (headerSize < 40) throw new RasterError("Unsupported BMP header.");

  const bytesPerPixel = bpp / 8;
  // Row padding to 4 bytes applies to 24bpp, where it is nearly always present.
  const rowBytes = Math.ceil((width * bytesPerPixel) / 4) * 4;
  const out = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const srcRow = topDown ? y : height - 1 - y;
    let s = dataOffset + srcRow * rowBytes;
    let d = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      out[d] = bytes[s + 2];
      out[d + 1] = bytes[s + 1];
      out[d + 2] = bytes[s];
      out[d + 3] = bpp === 32 ? bytes[s + 3] : 255;
      s += bytesPerPixel;
      d += 4;
    }
  }

  return { data: out, width, height };
}

/* ------------------------------------------------------------------ TGA -- */

/**
 * Writes an uncompressed 32-bit TGA.
 *
 * Bit 5 of the image descriptor is set so rows run top-down, which every reader
 * handles and which saves flipping. The low nibble carries the alpha depth —
 * omitting it is the usual reason a 32-bit TGA opens fully transparent.
 */
export function encodeTga(image: RasterImage): Uint8Array {
  const { data, width, height } = image;
  const out = new Uint8Array(18 + width * height * 4);
  const view = new DataView(out.buffer);

  out[2] = 2; // uncompressed true-colour
  view.setUint16(12, width, true);
  view.setUint16(14, height, true);
  out[16] = 32; // bits per pixel
  out[17] = 0x28; // top-down (bit 5) + 8 alpha bits (low nibble)

  let p = 18;
  for (let s = 0; s < data.length; s += 4) {
    out[p] = data[s + 2]; // B
    out[p + 1] = data[s + 1]; // G
    out[p + 2] = data[s]; // R
    out[p + 3] = data[s + 3]; // A
    p += 4;
  }

  return out;
}

/** Reads uncompressed (type 2) and run-length encoded (type 10) TGAs. */
export function decodeTga(bytes: Uint8Array): RasterImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idLength = bytes[0];
  const imageType = bytes[2];
  const width = view.getUint16(12, true);
  const height = view.getUint16(14, true);
  const bpp = bytes[16];
  const descriptor = bytes[17];
  const topDown = (descriptor & 0x20) !== 0;

  if (imageType !== 2 && imageType !== 10) {
    throw new RasterError(
      "Only uncompressed and RLE true-colour TGA files are supported."
    );
  }
  if (bpp !== 24 && bpp !== 32) {
    throw new RasterError(`This TGA is ${bpp}-bit. Only 24- and 32-bit are supported.`);
  }

  const channels = bpp / 8;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let s = 18 + idLength;
  let written = 0;
  const total = width * height;

  const put = (at: number, r: number, g: number, b: number, a: number) => {
    pixels[at * 4] = r;
    pixels[at * 4 + 1] = g;
    pixels[at * 4 + 2] = b;
    pixels[at * 4 + 3] = a;
  };

  if (imageType === 2) {
    for (; written < total; written += 1) {
      put(written, bytes[s + 2], bytes[s + 1], bytes[s], channels === 4 ? bytes[s + 3] : 255);
      s += channels;
    }
  } else {
    while (written < total) {
      const packet = bytes[s];
      s += 1;
      const count = (packet & 0x7f) + 1;
      if (packet & 0x80) {
        // Run packet: one pixel repeated.
        const b = bytes[s];
        const g = bytes[s + 1];
        const r = bytes[s + 2];
        const a = channels === 4 ? bytes[s + 3] : 255;
        s += channels;
        for (let i = 0; i < count && written < total; i += 1, written += 1) {
          put(written, r, g, b, a);
        }
      } else {
        for (let i = 0; i < count && written < total; i += 1, written += 1) {
          put(written, bytes[s + 2], bytes[s + 1], bytes[s], channels === 4 ? bytes[s + 3] : 255);
          s += channels;
        }
      }
    }
  }

  if (topDown) return { data: pixels, width, height };

  // Bottom-up: flip into place.
  const flipped = new Uint8ClampedArray(pixels.length);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y += 1) {
    flipped.set(
      pixels.subarray((height - 1 - y) * rowBytes, (height - y) * rowBytes),
      y * rowBytes
    );
  }
  return { data: flipped, width, height };
}

/* ------------------------------------------------------------------ QOI -- */

const QOI_OP_INDEX = 0x00;
const QOI_OP_DIFF = 0x40;
const QOI_OP_LUMA = 0x80;
const QOI_OP_RUN = 0xc0;
const QOI_OP_RGB = 0xfe;
const QOI_OP_RGBA = 0xff;

/** The format's own hash, which both ends must compute identically. */
const qoiHash = (r: number, g: number, b: number, a: number) =>
  (r * 3 + g * 5 + b * 7 + a * 11) % 64;

/**
 * Writes QOI — the "Quite OK Image" format.
 *
 * Lossless, usually within a few percent of PNG, and encodes several times
 * faster because it is a single pass with no entropy coder. The whole
 * specification is one page, which is why implementing it costs less than
 * depending on something that does.
 */
export function encodeQoi(image: RasterImage): Uint8Array {
  const { data, width, height } = image;
  // Worst case is 5 bytes per pixel (RGBA op), plus header and end marker.
  const out = new Uint8Array(14 + width * height * 5 + 8);
  const view = new DataView(out.buffer);

  view.setUint32(0, 0x716f6966); // 'qoif', big-endian
  view.setUint32(4, width);
  view.setUint32(8, height);
  out[12] = 4; // channels
  out[13] = 0; // sRGB with linear alpha

  const seen = new Uint8Array(64 * 4);
  let pr = 0;
  let pg = 0;
  let pb = 0;
  let pa = 255;
  let run = 0;
  let p = 14;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (r === pr && g === pg && b === pb && a === pa) {
      run += 1;
      // A run is stored with a bias of -1, so 62 is the largest encodable.
      if (run === 62 || i === data.length - 4) {
        out[p++] = QOI_OP_RUN | (run - 1);
        run = 0;
      }
    } else {
      if (run > 0) {
        out[p++] = QOI_OP_RUN | (run - 1);
        run = 0;
      }

      const h = qoiHash(r, g, b, a) * 4;
      if (seen[h] === r && seen[h + 1] === g && seen[h + 2] === b && seen[h + 3] === a) {
        out[p++] = QOI_OP_INDEX | (h / 4);
      } else {
        seen[h] = r;
        seen[h + 1] = g;
        seen[h + 2] = b;
        seen[h + 3] = a;

        if (a === pa) {
          // Differences wrap modulo 256, which is what lets the small-delta
          // ops span the 0/255 boundary instead of falling back to a full RGB.
          const dr = ((r - pr + 128) & 0xff) - 128;
          const dg = ((g - pg + 128) & 0xff) - 128;
          const db = ((b - pb + 128) & 0xff) - 128;
          const dgr = dr - dg;
          const dgb = db - dg;

          if (dr > -3 && dr < 2 && dg > -3 && dg < 2 && db > -3 && db < 2) {
            out[p++] = QOI_OP_DIFF | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2);
          } else if (
            dgr > -9 && dgr < 8 &&
            dg > -33 && dg < 32 &&
            dgb > -9 && dgb < 8
          ) {
            out[p++] = QOI_OP_LUMA | (dg + 32);
            out[p++] = ((dgr + 8) << 4) | (dgb + 8);
          } else {
            out[p++] = QOI_OP_RGB;
            out[p++] = r;
            out[p++] = g;
            out[p++] = b;
          }
        } else {
          out[p++] = QOI_OP_RGBA;
          out[p++] = r;
          out[p++] = g;
          out[p++] = b;
          out[p++] = a;
        }
      }
    }

    pr = r;
    pg = g;
    pb = b;
    pa = a;
  }

  // Eight-byte end marker: seven zeroes then a one.
  for (let i = 0; i < 7; i += 1) out[p++] = 0;
  out[p++] = 1;

  return out.slice(0, p);
}

export function decodeQoi(bytes: Uint8Array): RasterImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x716f6966) throw new RasterError("Not a QOI file.");

  const width = view.getUint32(4);
  const height = view.getUint32(8);
  const out = new Uint8ClampedArray(width * height * 4);
  const seen = new Uint8Array(64 * 4);

  let r = 0;
  let g = 0;
  let b = 0;
  let a = 255;
  let p = 14;
  let d = 0;
  const end = width * height * 4;

  while (d < end) {
    const op = bytes[p++];

    if (op === QOI_OP_RGB) {
      r = bytes[p++];
      g = bytes[p++];
      b = bytes[p++];
    } else if (op === QOI_OP_RGBA) {
      r = bytes[p++];
      g = bytes[p++];
      b = bytes[p++];
      a = bytes[p++];
    } else if ((op & 0xc0) === QOI_OP_INDEX) {
      const h = (op & 0x3f) * 4;
      r = seen[h];
      g = seen[h + 1];
      b = seen[h + 2];
      a = seen[h + 3];
    } else if ((op & 0xc0) === QOI_OP_DIFF) {
      r = (r + ((op >> 4) & 0x03) - 2) & 0xff;
      g = (g + ((op >> 2) & 0x03) - 2) & 0xff;
      b = (b + (op & 0x03) - 2) & 0xff;
    } else if ((op & 0xc0) === QOI_OP_LUMA) {
      const dg = (op & 0x3f) - 32;
      const next = bytes[p++];
      r = (r + dg - 8 + ((next >> 4) & 0x0f)) & 0xff;
      g = (g + dg) & 0xff;
      b = (b + dg - 8 + (next & 0x0f)) & 0xff;
    } else if ((op & 0xc0) === QOI_OP_RUN) {
      const run = (op & 0x3f) + 1;
      for (let i = 0; i < run && d < end; i += 1) {
        out[d] = r;
        out[d + 1] = g;
        out[d + 2] = b;
        out[d + 3] = a;
        d += 4;
      }
      continue;
    }

    const h = qoiHash(r, g, b, a) * 4;
    seen[h] = r;
    seen[h + 1] = g;
    seen[h + 2] = b;
    seen[h + 3] = a;

    out[d] = r;
    out[d + 1] = g;
    out[d + 2] = b;
    out[d + 3] = a;
    d += 4;
  }

  return { data: out, width, height };
}

/* ------------------------------------------------------------------ PNM -- */

/**
 * Writes binary PPM (P6) — RGB, one byte per channel, no compression.
 *
 * Alpha is dropped because the format has none; the caller is expected to have
 * matted first, exactly as for JPEG.
 */
export function encodePpm(image: RasterImage): Uint8Array {
  const { data, width, height } = image;
  const header = new TextEncoder().encode(`P6\n${width} ${height}\n255\n`);
  const out = new Uint8Array(header.length + width * height * 3);
  out.set(header);

  let p = header.length;
  for (let s = 0; s < data.length; s += 4) {
    out[p++] = data[s];
    out[p++] = data[s + 1];
    out[p++] = data[s + 2];
  }
  return out;
}

/** Reads binary PPM (P6) and PGM (P5). */
export function decodePnm(bytes: Uint8Array): RasterImage {
  if (bytes[0] !== 0x50) throw new RasterError("Not a PNM file."); // 'P'
  const kind = bytes[1] - 0x30;
  if (kind !== 5 && kind !== 6) {
    throw new RasterError("Only binary PGM (P5) and PPM (P6) are supported.");
  }

  // Header fields are whitespace-separated and may be interrupted by comment
  // lines starting with '#', which is the part naive parsers miss.
  const fields: number[] = [];
  let p = 2;
  while (fields.length < 3) {
    while (p < bytes.length && /\s/.test(String.fromCharCode(bytes[p]))) p += 1;
    if (bytes[p] === 0x23) {
      while (p < bytes.length && bytes[p] !== 0x0a) p += 1;
      continue;
    }
    let value = 0;
    while (p < bytes.length && bytes[p] >= 0x30 && bytes[p] <= 0x39) {
      value = value * 10 + (bytes[p] - 0x30);
      p += 1;
    }
    fields.push(value);
  }
  p += 1; // exactly one whitespace byte follows the maximum value

  const [width, height, max] = fields;
  if (max !== 255) throw new RasterError("Only 8-bit PNM files are supported.");

  const out = new Uint8ClampedArray(width * height * 4);
  const channels = kind === 6 ? 3 : 1;
  for (let i = 0, d = 0; d < out.length; i += channels, d += 4) {
    out[d] = bytes[p + i];
    out[d + 1] = bytes[p + i + (channels === 3 ? 1 : 0)];
    out[d + 2] = bytes[p + i + (channels === 3 ? 2 : 0)];
    out[d + 3] = 255;
  }
  return { data: out, width, height };
}
