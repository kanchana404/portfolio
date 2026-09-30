import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WebpError, readWebpInfo } from "./webp";

const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const u24 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** One chunk: fourcc, size, the data, and a pad byte when the data's length is odd. */
const chunk = (fourcc: string, payload: number[], size = payload.length) => [
  ...ascii(fourcc),
  ...u32(size),
  ...payload,
  ...(payload.length % 2 === 1 ? [0] : []),
];

/**
 * A minimal RIFF/WEBP file: one chunk, then any `more` bytes, sizes
 * consistent unless told otherwise.
 */
function webp(
  fourcc: string,
  payload: number[],
  {
    chunkSize = payload.length,
    riffDelta = 0,
    more = [],
  }: { chunkSize?: number; riffDelta?: number; more?: number[][] } = {}
): Uint8Array {
  const body = [...chunk(fourcc, payload, chunkSize), ...more.flat()];
  return Uint8Array.from([...ascii("RIFF"), ...u32(4 + body.length + riffDelta), ...ascii("WEBP"), ...body]);
}

/** A VP8 key frame header, as the image chunk of an extended file. */
const FRAME = chunk("VP8 ", [0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a, ...u16(16), ...u16(16)]);

const vp8 = (width: number, height: number, frameTag = 0x00, start = [0x9d, 0x01, 0x2a], more: number[][] = []) =>
  webp("VP8 ", [frameTag, 0x00, 0x00, ...start, ...u16(width), ...u16(height)], { more });

const vp8l = (width: number, height: number, { alpha = 0, version = 0, signature = 0x2f } = {}) =>
  webp("VP8L", [
    signature,
    ...u32(((width - 1) | ((height - 1) << 14) | (alpha << 28) | (version << 29)) >>> 0),
  ]);

const vp8x = (width: number, height: number, flags = 0, more: number[][] = [FRAME]) =>
  webp("VP8X", [flags, 0, 0, 0, ...u24(width - 1), ...u24(height - 1)], { more });

function rejects(bytes: Uint8Array, message: string) {
  expect(() => readWebpInfo(bytes)).toThrow(WebpError);
  expect(() => readWebpInfo(bytes)).toThrow(message);
}

describe("readWebpInfo", () => {
  it("reads a lossy (VP8) header", () => {
    expect(readWebpInfo(vp8(1536, 1024))).toEqual({
      format: "lossy",
      width: 1536,
      height: 1024,
      alpha: false,
      animated: false,
      exif: false,
      xmp: false,
      icc: false,
    });
  });

  it("ignores the VP8 scaling bits, as libwebp does", () => {
    expect(readWebpInfo(vp8(1536 | 0x4000, 1024 | 0x8000))).toMatchObject({ width: 1536, height: 1024 });
  });

  it("reads a lossless (VP8L) header at both extremes", () => {
    expect(readWebpInfo(vp8l(1, 1))).toMatchObject({ format: "lossless", width: 1, height: 1, alpha: false });
    expect(readWebpInfo(vp8l(16384, 16384, { alpha: 1 }))).toMatchObject({
      width: 16384,
      height: 16384,
      alpha: true,
    });
  });

  it("reads an extended (VP8X) header and every flag", () => {
    expect(readWebpInfo(vp8x(3000, 2000))).toEqual({
      format: "extended",
      width: 3000,
      height: 2000,
      alpha: false,
      animated: false,
      exif: false,
      xmp: false,
      icc: false,
    });
    expect(readWebpInfo(vp8x(3000, 2000, 0x20)).icc).toBe(true);
    expect(readWebpInfo(vp8x(3000, 2000, 0x10)).alpha).toBe(true);
    expect(readWebpInfo(vp8x(3000, 2000, 0x08)).exif).toBe(true);
    expect(readWebpInfo(vp8x(3000, 2000, 0x04)).xmp).toBe(true);
    expect(readWebpInfo(vp8x(3000, 2000, 0x02)).animated).toBe(true);
    expect(readWebpInfo(vp8x(3000, 2000, 0x3e))).toMatchObject({
      icc: true,
      alpha: true,
      exif: true,
      xmp: true,
      animated: true,
    });
  });

  it("reads metadata and animation from the chunks, not only from the flags", () => {
    // Flags cleared, chunks present: the flags only announce what is there.
    expect(readWebpInfo(vp8x(800, 600, 0, [FRAME, chunk("EXIF", [1, 2, 3])])).exif).toBe(true);
    expect(readWebpInfo(vp8x(800, 600, 0, [FRAME, chunk("XMP ", [1, 2])])).xmp).toBe(true);
    expect(readWebpInfo(vp8x(800, 600, 0, [chunk("ICCP", [1, 2]), FRAME])).icc).toBe(true);
    expect(
      readWebpInfo(vp8x(800, 600, 0, [chunk("ANIM", new Array(6).fill(0)), chunk("ANMF", new Array(16).fill(0))]))
        .animated
    ).toBe(true);
    // An extended file with alpha, as cwebp writes it (public/cortana-*.webp).
    expect(readWebpInfo(vp8x(800, 600, 0x10, [chunk("ALPH", [0, 1, 2]), FRAME]))).toMatchObject({
      alpha: true,
      exif: false,
      xmp: false,
      animated: false,
    });
  });

  it("reads through a view into a larger buffer", () => {
    const file = vp8(800, 600);
    const pool = new Uint8Array(file.length + 7);
    pool.set(file, 7);
    expect(readWebpInfo(pool.subarray(7))).toMatchObject({ width: 800, height: 600 });
  });

  it("refuses what is not a well-formed WebP", () => {
    rejects(vp8(10, 10).subarray(0, 19), "shorter");
    const notRiff = vp8(10, 10);
    notRiff.set(ascii("RIFX"), 0);
    rejects(notRiff, "RIFF/WEBP");
    const notWebp = vp8(10, 10);
    notWebp.set(ascii("WAVE"), 8);
    rejects(notWebp, "RIFF/WEBP");
    rejects(webp("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16(10), ...u16(10)], { riffDelta: -1 }), "RIFF size");
    rejects(Uint8Array.from([...vp8(10, 10), 0x00]), "RIFF size");
    rejects(webp("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16(10), ...u16(10)], { chunkSize: 11 }), "past the end");
  });

  it("refuses a first chunk it cannot size", () => {
    rejects(webp("ALPH", new Array(10).fill(0)), 'unsupported first chunk "ALPH"');
    rejects(webp("ANIM", new Array(10).fill(0)), 'unsupported first chunk "ANIM"');
  });

  it("refuses chunks a WebP should not carry, and chunks that do not add up", () => {
    rejects(vp8(800, 600, 0x00, [0x9d, 0x01, 0x2a], [chunk("EXIF", [1, 2, 3])]), "a simple WebP is one VP8 chunk");
    rejects(vp8(800, 600, 0x00, [0x9d, 0x01, 0x2a], [chunk("ZZZZ", [0x3c, 0x68, 0x31])]), "a simple WebP");
    rejects(vp8x(800, 600, 0, [FRAME, chunk("ZZZZ", [0x3c, 0x68, 0x31])]), 'unknown chunk "ZZZZ"');
    rejects(vp8x(800, 600, 0, [FRAME, chunk("VP8X", new Array(10).fill(0))]), 'unknown chunk "VP8X"');
    rejects(vp8x(800, 600, 0, []), "no image data");
    rejects(vp8x(800, 600, 0, [chunk("EXIF", [1, 2])]), "no image data");
    // A chunk that claims more than the file holds, one missing its pad
    // byte, and stray bytes too short to be a chunk header.
    rejects(vp8(800, 600, 0x00, [0x9d, 0x01, 0x2a], [[...ascii("EXIF"), ...u32(100), 1, 2]]), "EXIF chunk runs past");
    rejects(vp8x(800, 600, 0, [FRAME, [...ascii("EXIF"), ...u32(3), 1, 2, 3]]), "EXIF chunk runs past");
    rejects(vp8(800, 600, 0x00, [0x9d, 0x01, 0x2a], [[0, 0, 0, 0]]), "chunk header");
  });

  it("refuses bad VP8, VP8L and VP8X data", () => {
    rejects(vp8(10, 10, 0x01), "key frame");
    rejects(vp8(10, 10, 0x00, [0x9d, 0x01, 0x2b]), "start code");
    rejects(vp8l(10, 10, { signature: 0x2e }), "signature");
    rejects(vp8l(10, 10, { version: 1 }), "version");
    rejects(webp("VP8X", new Array(12).fill(0)), "10 bytes");
    rejects(vp8(0, 10), "zero");
    rejects(vp8(10, 0), "zero");
  });
});

describe("the repo's own WebP files", () => {
  const PUBLIC = join(process.cwd(), "public");
  const files = (readdirSync(PUBLIC, { recursive: true }) as string[]).filter((f) => f.endsWith(".webp"));

  it("all parse with real dimensions", () => {
    expect(files.length, "no .webp under public/: the smoke test is checking nothing").toBeGreaterThan(0);
    for (const file of files) {
      const info = readWebpInfo(readFileSync(join(PUBLIC, file)));
      expect(info.width, file).toBeGreaterThan(0);
      expect(info.height, file).toBeGreaterThan(0);
    }
  });
});
