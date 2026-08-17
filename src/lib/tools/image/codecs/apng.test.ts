import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { ApngError, decodeApng, encodeApng, isAnimatedPng } from "./apng";

/**
 * Builds a minimal but genuinely valid PNG.
 *
 * Real bytes rather than a stub, because the whole point of this codec is that
 * it moves a browser's PNG output around without recompressing it — a fake
 * would test nothing. `deflateSync` stands in for what `canvas.toBlob` does.
 */
function makePng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (b: Uint8Array) => {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i += 1) c = table[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
    return out;
  };

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour

  // Each scanline is prefixed with its filter byte (0 = none).
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      raw[row + 1 + x * 3] = rgb[0];
      raw[row + 2 + x * 3] = rgb[1];
      raw[row + 3 + x * 3] = rgb[2];
    }
  }

  const parts = [
    new Uint8Array(SIGNATURE),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const chunkTypes = (png: Uint8Array): string[] => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const types: string[] = [];
  let p = 8;
  while (p < png.length) {
    const length = view.getUint32(p);
    const type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
    types.push(type);
    p += 12 + length;
    if (type === "IEND") break;
  }
  return types;
};

const RED = makePng(4, 3, [255, 0, 0]);
const GREEN = makePng(4, 3, [0, 255, 0]);
const BLUE = makePng(4, 3, [0, 0, 255]);

describe("writing an APNG", () => {
  it("emits the chunks in the order readers require", () => {
    // acTL must come before the first IDAT; after it, a reader treats the file
    // as a still PNG and shows only frame one.
    const types = chunkTypes(encodeApng([RED, GREEN, BLUE], [100, 100, 100]));
    expect(types[0]).toBe("IHDR");
    expect(types[1]).toBe("acTL");
    expect(types.indexOf("acTL")).toBeLessThan(types.indexOf("IDAT"));
    expect(types.at(-1)).toBe("IEND");
  });

  it("stores frame one as IDAT and the rest as fdAT", () => {
    // Frame one being ordinary IDAT is what makes an APNG still display as a
    // static image in software that does not understand animation.
    const types = chunkTypes(encodeApng([RED, GREEN, BLUE], [100, 100, 100]));
    expect(types.filter((t) => t === "IDAT")).toHaveLength(1);
    expect(types.filter((t) => t === "fdAT")).toHaveLength(2);
    expect(types.filter((t) => t === "fcTL")).toHaveLength(3);
  });

  it("records the frame count and loop count in acTL", () => {
    const png = encodeApng([RED, GREEN], [50, 50], 7);
    const view = new DataView(png.buffer);
    let p = 8;
    while (String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]) !== "acTL") {
      p += 12 + view.getUint32(p);
    }
    expect(view.getUint32(p + 8)).toBe(2); // frames
    expect(view.getUint32(p + 12)).toBe(7); // loops
  });

  it("numbers the sequence continuously across fcTL and fdAT", () => {
    // A gap or repeat in this counter makes the whole file invalid, and it is
    // shared between the two chunk types rather than kept per-type.
    const png = encodeApng([RED, GREEN, BLUE], [100, 100, 100]);
    const view = new DataView(png.buffer);
    const seen: number[] = [];
    let p = 8;
    while (p < png.length) {
      const length = view.getUint32(p);
      const type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
      if (type === "fcTL" || type === "fdAT") seen.push(view.getUint32(p + 8));
      p += 12 + length;
      if (type === "IEND") break;
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen[0]).toBe(0);
  });

  it("refuses to build an APNG with no frames", () => {
    expect(() => encodeApng([], [])).toThrow(ApngError);
  });

  it("refuses a frame that carries no image data", () => {
    const empty = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    expect(() => encodeApng([RED, empty], [100, 100])).toThrow(/image data/);
  });
});

describe("reading an APNG", () => {
  it("recovers every frame as a standalone PNG", () => {
    const frames = decodeApng(encodeApng([RED, GREEN, BLUE], [40, 50, 60]));
    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      const types = chunkTypes(frame.png);
      expect(types[0]).toBe("IHDR");
      expect(types).toContain("IDAT");
      expect(types).not.toContain("fdAT"); // rebuilt as a plain PNG
      expect(types.at(-1)).toBe("IEND");
    }
  });

  it("round-trips the pixel data byte for byte", () => {
    // The claim this codec rests on: frame data is moved, never recompressed.
    const frames = decodeApng(encodeApng([RED, GREEN, BLUE], [40, 50, 60]));
    const idatOf = (png: Uint8Array) => {
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
      let p = 8;
      while (p < png.length) {
        const length = view.getUint32(p);
        const type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
        if (type === "IDAT") return Array.from(png.subarray(p + 8, p + 8 + length));
        p += 12 + length;
      }
      return [];
    };
    expect(idatOf(frames[0].png)).toEqual(idatOf(RED));
    expect(idatOf(frames[1].png)).toEqual(idatOf(GREEN));
    expect(idatOf(frames[2].png)).toEqual(idatOf(BLUE));
  });

  it("recovers the delays in milliseconds", () => {
    // Written as num/1000 so a millisecond survives exactly. The common 1/100
    // denominator silently rounds every delay to the nearest 10 ms.
    const frames = decodeApng(encodeApng([RED, GREEN], [33, 250]));
    expect(frames[0].delayMs).toBe(33);
    expect(frames[1].delayMs).toBe(250);
  });

  it("survives a full re-encode of what it decoded", () => {
    const once = encodeApng([RED, GREEN, BLUE], [40, 50, 60]);
    const frames = decodeApng(once);
    const twice = encodeApng(
      frames.map((f) => f.png),
      frames.map((f) => f.delayMs)
    );
    const reread = decodeApng(twice);
    expect(reread).toHaveLength(3);
    expect(reread.map((f) => f.delayMs)).toEqual([40, 50, 60]);
  });

  it("refuses a still PNG rather than returning one frame", () => {
    expect(() => decodeApng(RED)).toThrow(/not animated/);
  });

  it("refuses something that is not a PNG at all", () => {
    expect(() => decodeApng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(
      /Not a PNG/
    );
  });
});

describe("detecting animation", () => {
  it("tells an APNG from a still PNG", () => {
    expect(isAnimatedPng(encodeApng([RED, GREEN], [100, 100]))).toBe(true);
    expect(isAnimatedPng(RED)).toBe(false);
  });

  it("says no rather than throwing on rubbish", () => {
    expect(isAnimatedPng(new Uint8Array([0, 1, 2]))).toBe(false);
  });
});
