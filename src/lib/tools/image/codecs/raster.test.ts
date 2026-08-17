import { describe, expect, it } from "vitest";
import {
  type RasterImage,
  RasterError,
  decodeBmp,
  decodePnm,
  decodeQoi,
  decodeTga,
  encodeBmp,
  encodePpm,
  encodeQoi,
  encodeTga,
} from "./raster";

/** A small image with opaque, transparent and gradient regions. */
function fixture(width = 7, height = 5): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = (x * 37) % 256;
      data[i + 1] = (y * 53) % 256;
      data[i + 2] = (x * y * 11) % 256;
      data[i + 3] = x === 0 ? 0 : 255; // first column fully transparent
    }
  }
  return { data, width, height };
}

/** A flat block, which is what exercises run-length paths. */
function flat(width = 8, height = 4, rgba = [10, 200, 30, 255]): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { data, width, height };
}

const same = (a: RasterImage, b: RasterImage) => {
  expect(b.width).toBe(a.width);
  expect(b.height).toBe(a.height);
  expect(Array.from(b.data)).toEqual(Array.from(a.data));
};

describe("BMP", () => {
  it("round-trips pixels and alpha exactly", () => {
    same(fixture(), decodeBmp(encodeBmp(fixture())));
  });

  it("writes the BM signature and a V5 header", () => {
    const out = encodeBmp(fixture());
    expect(out[0]).toBe(0x42);
    expect(out[1]).toBe(0x4d);
    // 124 = BITMAPV5HEADER. V4 (108) is rejected outright by macOS ImageIO
    // when alpha is present, which is why the larger header is not optional.
    expect(new DataView(out.buffer).getUint32(14, true)).toBe(124);
  });

  it("declares BI_BITFIELDS with an alpha mask", () => {
    const view = new DataView(encodeBmp(fixture()).buffer);
    expect(view.getUint32(30, true)).toBe(3); // BI_BITFIELDS
    expect(view.getUint32(66, true)).toBe(0xff000000); // alpha mask
  });

  it("declares a byte length matching the buffer", () => {
    const out = encodeBmp(fixture());
    expect(new DataView(out.buffer).getUint32(2, true)).toBe(out.length);
  });

  it("reads a top-down BMP (negative height)", () => {
    const source = fixture(4, 3);
    const out = encodeBmp(source);
    const view = new DataView(out.buffer);
    // Flip the rows and negate the height: the same picture, stored the other
    // way up. A reader that ignores the sign returns it upside down.
    const rowBytes = 4 * 4;
    const pixels = out.slice(138);
    const flipped = new Uint8Array(pixels.length);
    for (let y = 0; y < 3; y += 1) {
      flipped.set(pixels.subarray((2 - y) * rowBytes, (3 - y) * rowBytes), y * rowBytes);
    }
    out.set(flipped, 138);
    view.setInt32(22, -3, true);
    same(source, decodeBmp(out));
  });

  it("refuses a file that is not a BMP", () => {
    expect(() => decodeBmp(new Uint8Array([1, 2, 3, 4]))).toThrow(RasterError);
  });
});

describe("TGA", () => {
  it("round-trips pixels and alpha exactly", () => {
    same(fixture(), decodeTga(encodeTga(fixture())));
  });

  it("marks the image top-down with 8 alpha bits", () => {
    // Omitting the alpha depth in the low nibble is the usual reason a 32-bit
    // TGA opens fully transparent.
    const out = encodeTga(fixture());
    expect(out[2]).toBe(2); // uncompressed true-colour
    expect(out[16]).toBe(32); // bits per pixel
    expect(out[17]).toBe(0x28); // top-down + alpha depth 8
  });

  it("reads a bottom-up TGA the right way up", () => {
    const source = fixture(4, 3);
    const out = encodeTga(source);
    const rowBytes = 4 * 4;
    const pixels = out.slice(18);
    const flipped = new Uint8Array(pixels.length);
    for (let y = 0; y < 3; y += 1) {
      flipped.set(pixels.subarray((2 - y) * rowBytes, (3 - y) * rowBytes), y * rowBytes);
    }
    out.set(flipped, 18);
    out[17] = 0x08; // clear the top-down bit, keep the alpha depth
    same(source, decodeTga(out));
  });

  it("reads a run-length encoded TGA", () => {
    // Type 10, one run packet of 4 identical pixels: 0x80 | (4-1).
    const rle = new Uint8Array(18 + 1 + 4);
    const view = new DataView(rle.buffer);
    rle[2] = 10;
    view.setUint16(12, 2, true);
    view.setUint16(14, 2, true);
    rle[16] = 32;
    rle[17] = 0x28;
    rle[18] = 0x83;
    rle[19] = 30; // B
    rle[20] = 20; // G
    rle[21] = 10; // R
    rle[22] = 255; // A
    const decoded = decodeTga(rle);
    expect(decoded.width).toBe(2);
    expect(Array.from(decoded.data.slice(0, 4))).toEqual([10, 20, 30, 255]);
    expect(Array.from(decoded.data.slice(12, 16))).toEqual([10, 20, 30, 255]);
  });

  it("refuses a palettised TGA rather than guessing", () => {
    const bad = new Uint8Array(18);
    bad[2] = 1; // colour-mapped
    bad[16] = 8;
    expect(() => decodeTga(bad)).toThrow(RasterError);
  });
});

describe("QOI", () => {
  it("round-trips a detailed image exactly", () => {
    same(fixture(), decodeQoi(encodeQoi(fixture())));
  });

  it("round-trips a flat image, exercising the run op", () => {
    same(flat(), decodeQoi(encodeQoi(flat())));
  });

  it("round-trips a single pixel", () => {
    const one: RasterImage = {
      data: new Uint8ClampedArray([1, 2, 3, 4]),
      width: 1,
      height: 1,
    };
    same(one, decodeQoi(encodeQoi(one)));
  });

  it("round-trips varying alpha, which forces the RGBA op", () => {
    const data = new Uint8ClampedArray(4 * 4);
    for (let i = 0; i < 4; i += 1) {
      data[i * 4] = 100;
      data[i * 4 + 1] = 100;
      data[i * 4 + 2] = 100;
      data[i * 4 + 3] = i * 60;
    }
    same({ data, width: 4, height: 1 }, decodeQoi(encodeQoi({ data, width: 4, height: 1 })));
  });

  it("writes the qoif magic, dimensions and end marker", () => {
    const out = encodeQoi(fixture(7, 5));
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    expect(view.getUint32(0)).toBe(0x716f6966); // 'qoif', big-endian
    expect(view.getUint32(4)).toBe(7);
    expect(view.getUint32(8)).toBe(5);
    expect(Array.from(out.slice(-8))).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("compresses a flat image far below raw RGBA", () => {
    // 8x4 flat = 128 bytes raw. The run op should collapse it to a handful.
    expect(encodeQoi(flat()).length).toBeLessThan(40);
  });

  it("refuses a file that is not QOI", () => {
    expect(() => decodeQoi(new Uint8Array(20))).toThrow(RasterError);
  });
});

describe("PNM", () => {
  it("round-trips RGB (alpha is dropped, as the format has none)", () => {
    const source = fixture(5, 4);
    const decoded = decodePnm(encodePpm(source));
    expect(decoded.width).toBe(5);
    expect(decoded.height).toBe(4);
    for (let i = 0; i < decoded.data.length; i += 4) {
      expect(decoded.data[i]).toBe(source.data[i]);
      expect(decoded.data[i + 1]).toBe(source.data[i + 1]);
      expect(decoded.data[i + 2]).toBe(source.data[i + 2]);
      expect(decoded.data[i + 3]).toBe(255);
    }
  });

  it("writes the P6 header", () => {
    const out = encodePpm(fixture(3, 2));
    expect(new TextDecoder().decode(out.slice(0, 11))).toBe("P6\n3 2\n255\n");
  });

  it("skips comment lines in the header", () => {
    // Comments may appear between any two header fields, which is the part
    // naive parsers miss and then read pixel data as a dimension.
    const withComment = new TextEncoder().encode("P6\n# made by something\n2 1\n255\n");
    const body = new Uint8Array([10, 20, 30, 40, 50, 60]);
    const file = new Uint8Array(withComment.length + body.length);
    file.set(withComment);
    file.set(body, withComment.length);

    const decoded = decodePnm(file);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(1);
    expect(Array.from(decoded.data.slice(0, 4))).toEqual([10, 20, 30, 255]);
  });

  it("reads greyscale P5 by expanding one channel to three", () => {
    const header = new TextEncoder().encode("P5\n2 1\n255\n");
    const file = new Uint8Array(header.length + 2);
    file.set(header);
    file[header.length] = 90;
    file[header.length + 1] = 200;
    const decoded = decodePnm(file);
    expect(Array.from(decoded.data.slice(0, 4))).toEqual([90, 90, 90, 255]);
    expect(Array.from(decoded.data.slice(4, 8))).toEqual([200, 200, 200, 255]);
  });

  it("refuses 16-bit PNM rather than reading it as 8-bit", () => {
    const file = new TextEncoder().encode("P6\n1 1\n65535\n");
    expect(() => decodePnm(file)).toThrow(/8-bit/);
  });
});
