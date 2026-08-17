import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import {
  canReadTiff,
  compressionName,
  encodeTiff,
  tiffCompression,
} from "./tiff";

function fixture(width = 6, height = 4) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = x * 20;
      data[i + 1] = y * 30;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

/** Reads the IFD back the way a TIFF reader would. */
function readFields(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const le = bytes[0] === 0x49;
  const ifd = view.getUint32(4, le);
  const count = view.getUint16(ifd, le);
  const fields: Record<number, { type: number; count: number; value: number }> = {};
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    const tag = view.getUint16(entry, le);
    const type = view.getUint16(entry + 2, le);
    const n = view.getUint32(entry + 4, le);
    const value = type === 3 ? view.getUint16(entry + 8, le) : view.getUint32(entry + 8, le);
    fields[tag] = { type, count: n, value };
  }
  return { fields, tagOrder: Object.keys(fields).map(Number) };
}

describe("writing a TIFF", () => {
  it("writes a little-endian header with magic 42", () => {
    return encodeTiff(fixture()).then((out) => {
      expect(out[0]).toBe(0x49); // 'I'
      expect(out[1]).toBe(0x49); // 'I'
      expect(new DataView(out.buffer).getUint16(2, true)).toBe(42);
    });
  });

  it("declares deflate compression with the horizontal predictor", async () => {
    const { fields } = readFields(await encodeTiff(fixture()));
    expect(fields[259].value).toBe(8); // Compression: Deflate
    expect(fields[317].value).toBe(2); // Predictor: horizontal differencing
  });

  it("declares RGBA with unassociated alpha", async () => {
    // Without ExtraSamples, readers treat the fourth channel as unknown and
    // the image comes out with its colours rotated.
    const { fields } = readFields(await encodeTiff(fixture()));
    expect(fields[277].value).toBe(4); // SamplesPerPixel
    expect(fields[338].value).toBe(2); // ExtraSamples: unassociated alpha
    expect(fields[262].value).toBe(2); // Photometric: RGB
  });

  it("writes the fields in ascending tag order", async () => {
    // Readers binary-search the IFD, so out-of-order tags are not merely untidy.
    const { tagOrder } = readFields(await encodeTiff(fixture()));
    expect(tagOrder).toEqual([...tagOrder].sort((a, b) => a - b));
  });

  it("points StripOffsets at data that inflates to the right size", async () => {
    const image = fixture(6, 4);
    const out = await encodeTiff(image);
    const { fields } = readFields(out);
    const offset = fields[273].value;
    const length = fields[279].value;

    expect(offset + length).toBe(out.length);
    // "deflate" must be zlib-wrapped (RFC 1950), not raw — readers reject raw.
    expect(out[offset]).toBe(0x78);
    const inflated = inflateSync(Buffer.from(out.subarray(offset, offset + length)));
    expect(inflated.length).toBe(6 * 4 * 4);
  });

  it("stores a predictor-differenced first pixel unchanged", async () => {
    // The predictor leaves the leftmost pixel of each row alone and stores
    // every later sample as a difference from its left neighbour.
    const image = fixture(6, 4);
    const out = await encodeTiff(image);
    const { fields } = readFields(out);
    const raw = inflateSync(
      Buffer.from(out.subarray(fields[273].value, fields[273].value + fields[279].value))
    );
    expect(raw[0]).toBe(image.data[0]);
    expect(raw[1]).toBe(image.data[1]);
    // Second pixel's red is the difference, not the value: 20 - 0.
    expect(raw[4]).toBe((image.data[4] - image.data[0]) & 0xff);
  });

  it("differences per channel, not per byte", async () => {
    // Differencing across channel boundaries scrambles rather than flattens.
    const image = fixture(6, 4);
    const out = await encodeTiff(image);
    const { fields } = readFields(out);
    const raw = inflateSync(
      Buffer.from(out.subarray(fields[273].value, fields[273].value + fields[279].value))
    );
    // Green of pixel 2 minus green of pixel 1 — not green minus red.
    expect(raw[5]).toBe((image.data[5] - image.data[1]) & 0xff);
  });
});

describe("deciding whether a TIFF is readable", () => {
  const header = (compression: number) => {
    const out = new Uint8Array(8 + 2 + 12 + 4);
    const view = new DataView(out.buffer);
    out[0] = 0x49;
    out[1] = 0x49;
    view.setUint16(2, 42, true);
    view.setUint32(4, 8, true);
    view.setUint16(8, 1, true); // one field
    view.setUint16(10, 259, true); // Compression
    view.setUint16(12, 3, true); // SHORT
    view.setUint32(14, 1, true);
    view.setUint16(18, compression, true);
    return out;
  };

  it("reads the compression tag", () => {
    expect(tiffCompression(header(5))).toBe(5);
    expect(tiffCompression(header(32773))).toBe(32773);
  });

  it("accepts the schemes that decode correctly", () => {
    for (const c of [1, 5, 6, 7, 8, 32773, 32946]) {
      expect(canReadTiff(header(c)), `compression ${c}`).toBe(true);
    }
  });

  it("refuses CCITT fax, which decodes silently wrong", () => {
    // Both JS decoders fail without throwing on these — one returned a blank
    // page, the other corrupted a quarter of the rows. Refusing beats handing
    // back a blank scan while reporting success.
    for (const c of [2, 3, 4]) {
      expect(canReadTiff(header(c)), `compression ${c}`).toBe(false);
    }
  });

  it("names what it refused, so the message can say why", () => {
    expect(compressionName(4)).toMatch(/Group 4/);
    expect(compressionName(3)).toMatch(/Group 3/);
    expect(compressionName(34712)).toMatch(/JPEG 2000/);
  });

  it("refuses BigTIFF rather than misreading it", () => {
    // BigTIFF uses magic 43 and a different field layout entirely.
    const big = header(1);
    new DataView(big.buffer).setUint16(2, 43, true);
    expect(tiffCompression(big)).toBeNull();
    expect(canReadTiff(big)).toBe(false);
  });

  it("refuses something that is not a TIFF", () => {
    expect(tiffCompression(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull();
    expect(canReadTiff(new Uint8Array(2))).toBe(false);
  });

  it("treats a missing compression tag as uncompressed", () => {
    // The specification's default, and real files do omit it.
    const noTag = new Uint8Array(8 + 2 + 12 + 4);
    const view = new DataView(noTag.buffer);
    noTag[0] = 0x49;
    noTag[1] = 0x49;
    view.setUint16(2, 42, true);
    view.setUint32(4, 8, true);
    view.setUint16(8, 1, true);
    view.setUint16(10, 256, true); // ImageWidth, not Compression
    expect(tiffCompression(noTag)).toBe(1);
  });
});
