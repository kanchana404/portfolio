import { describe, expect, it } from "vitest";
import {
  WebpError,
  decodeAnimatedWebp,
  encodeAnimatedWebp,
  isAnimatedWebp,
} from "./webp-anim";

/**
 * Builds a still WebP with a synthetic bitstream.
 *
 * The payload is deliberately not real VP8. This codec never decodes a
 * bitstream — it moves the chunk around intact — so opaque bytes exercise
 * exactly the code under test, and a byte-for-byte comparison afterwards is a
 * stronger assertion than "it still decodes". Real VP8 data is verified in a
 * browser and with ffmpeg instead.
 */
function stillWebp(
  width: number,
  height: number,
  payload: number[],
  opts: { lossless?: boolean; alpha?: number[] } = {}
): Uint8Array {
  const chunks: Uint8Array[] = [];

  const chunk = (type: string, data: Uint8Array) => {
    const padded = data.length + (data.length & 1);
    const out = new Uint8Array(8 + padded);
    for (let i = 0; i < 4; i += 1) out[i] = type.charCodeAt(i);
    new DataView(out.buffer).setUint32(4, data.length, true);
    out.set(data, 8);
    return out;
  };

  if (opts.alpha) {
    // With separate alpha, a real encoder emits VP8X + ALPH + VP8.
    const vp8x = new Uint8Array(10);
    const view = new DataView(vp8x.buffer);
    vp8x[0] = 0x10;
    const put24 = (at: number, v: number) => {
      view.setUint8(at, v & 0xff);
      view.setUint8(at + 1, (v >> 8) & 0xff);
      view.setUint8(at + 2, (v >> 16) & 0xff);
    };
    put24(4, width - 1);
    put24(7, height - 1);
    chunks.push(chunk("VP8X", vp8x));
    chunks.push(chunk("ALPH", new Uint8Array(opts.alpha)));
  }

  if (opts.lossless) {
    // VP8L packs both dimensions, minus one, into 28 bits after a signature.
    const data = new Uint8Array(5 + payload.length);
    data[0] = 0x2f;
    const bits = (width - 1) | ((height - 1) << 14);
    data[1] = bits & 0xff;
    data[2] = (bits >> 8) & 0xff;
    data[3] = (bits >> 16) & 0xff;
    data[4] = (bits >> 24) & 0xff;
    data.set(payload, 5);
    chunks.push(chunk("VP8L", data));
  } else if (!opts.alpha || payload.length) {
    // Lossy: a 3-byte frame tag, a 3-byte start code, then 14-bit dimensions.
    const data = new Uint8Array(10 + payload.length);
    data[3] = 0x9d;
    data[4] = 0x01;
    data[5] = 0x2a;
    new DataView(data.buffer).setUint16(6, width, true);
    new DataView(data.buffer).setUint16(8, height, true);
    data.set(payload, 10);
    chunks.push(chunk("VP8 ", data));
  }

  const body = chunks.reduce<number[]>((acc, c) => acc.concat(Array.from(c)), []);
  const out = new Uint8Array(12 + body.length);
  out.set([0x52, 0x49, 0x46, 0x46]); // RIFF
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  out.set(body, 12);
  return out;
}

const chunkTypes = (bytes: Uint8Array): string[] => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const types: string[] = [];
  let p = 12;
  while (p + 8 <= bytes.length) {
    const type = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
    const size = view.getUint32(p + 4, true);
    types.push(type);
    p += 8 + size + (size & 1);
  }
  return types;
};

const A = stillWebp(16, 12, [1, 2, 3, 4, 5]);
const B = stillWebp(16, 12, [9, 8, 7, 6, 5]);
const C = stillWebp(16, 12, [4, 4, 4]); // odd length, forcing RIFF padding

describe("writing an animated WebP", () => {
  it("emits VP8X and ANIM before the frames", () => {
    // ANMF is only legal inside an extended-format file, so VP8X must lead.
    const types = chunkTypes(encodeAnimatedWebp([A, B], [100, 100]));
    expect(types[0]).toBe("VP8X");
    expect(types[1]).toBe("ANIM");
    expect(types.filter((t) => t === "ANMF")).toHaveLength(2);
  });

  it("sets the animation flag in VP8X", () => {
    const out = encodeAnimatedWebp([A, B], [100, 100]);
    expect(out[20] & 0x02).toBe(0x02); // first payload byte of VP8X
  });

  it("declares a RIFF size matching the file", () => {
    const out = encodeAnimatedWebp([A, B], [100, 100]);
    // The field counts everything after itself, "WEBP" included.
    expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8);
  });

  it("records the loop count", () => {
    const out = encodeAnimatedWebp([A, B], [50, 50], 3);
    // VP8X payload is 10 bytes at offset 20, so ANIM's payload starts at 38.
    expect(new DataView(out.buffer).getUint16(38 + 4, true)).toBe(3);
  });

  it("refuses an animation with no frames", () => {
    expect(() => encodeAnimatedWebp([], [])).toThrow(WebpError);
  });

  it("refuses a frame with no image data", () => {
    const empty = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(() => encodeAnimatedWebp([empty], [100])).toThrow(/no image data/);
  });
});

describe("reading an animated WebP", () => {
  it("recovers each frame as a standalone still WebP", () => {
    const frames = decodeAnimatedWebp(encodeAnimatedWebp([A, B], [40, 60]));
    expect(frames).toHaveLength(2);
    for (const frame of frames) {
      expect(chunkTypes(frame.webp)).not.toContain("ANMF");
      expect(chunkTypes(frame.webp)).toContain("VP8 ");
    }
  });

  it("moves the bitstream through untouched", () => {
    // The claim the whole codec rests on: frame data is re-wrapped, never
    // re-encoded. If these bytes differ, something decoded and re-compressed.
    const frames = decodeAnimatedWebp(encodeAnimatedWebp([A, B], [40, 60]));
    const bitstream = (w: Uint8Array) => {
      const view = new DataView(w.buffer, w.byteOffset, w.byteLength);
      let p = 12;
      while (p + 8 <= w.length) {
        const type = String.fromCharCode(w[p], w[p + 1], w[p + 2], w[p + 3]);
        const size = view.getUint32(p + 4, true);
        if (type === "VP8 ") return Array.from(w.subarray(p + 8, p + 8 + size));
        p += 8 + size + (size & 1);
      }
      return [];
    };
    expect(bitstream(frames[0].webp)).toEqual(bitstream(A));
    expect(bitstream(frames[1].webp)).toEqual(bitstream(B));
  });

  it("recovers the delays", () => {
    const frames = decodeAnimatedWebp(encodeAnimatedWebp([A, B], [33, 250]));
    expect(frames.map((f) => f.delayMs)).toEqual([33, 250]);
  });

  it("handles an odd-length chunk without drifting", () => {
    // RIFF pads odd payloads to an even boundary and does not count the pad in
    // the size. A parser that forgets reads the rest of the file as nonsense.
    const frames = decodeAnimatedWebp(encodeAnimatedWebp([C, A], [10, 20]));
    expect(frames).toHaveLength(2);
    expect(frames.map((f) => f.delayMs)).toEqual([10, 20]);
  });

  it("keeps a separate alpha chunk and re-declares it", () => {
    // A frame with ALPH needs VP8X on the way back out, or the alpha is
    // ignored and the frame decodes fully opaque.
    const withAlpha = stillWebp(16, 12, [1, 2, 3], { alpha: [7, 7, 7] });
    const frames = decodeAnimatedWebp(encodeAnimatedWebp([withAlpha], [100]));
    const types = chunkTypes(frames[0].webp);
    expect(types).toContain("ALPH");
    expect(types[0]).toBe("VP8X");
  });

  it("carries a lossless frame through unchanged", () => {
    const lossless = stillWebp(16, 12, [5, 5, 5, 5], { lossless: true });
    const frames = decodeAnimatedWebp(encodeAnimatedWebp([lossless], [100]));
    expect(chunkTypes(frames[0].webp)).toContain("VP8L");
  });

  it("survives a re-encode of what it decoded", () => {
    const once = encodeAnimatedWebp([A, B, C], [40, 50, 60]);
    const frames = decodeAnimatedWebp(once);
    const twice = encodeAnimatedWebp(
      frames.map((f) => f.webp),
      frames.map((f) => f.delayMs)
    );
    expect(decodeAnimatedWebp(twice).map((f) => f.delayMs)).toEqual([40, 50, 60]);
  });

  it("refuses a still WebP rather than returning one frame", () => {
    expect(() => decodeAnimatedWebp(A)).toThrow(/not animated/);
  });

  it("refuses something that is not a WebP", () => {
    expect(() => decodeAnimatedWebp(new Uint8Array([1, 2, 3, 4]))).toThrow(/Not a WebP/);
  });
});

describe("detecting animation", () => {
  it("tells an animated WebP from a still one", () => {
    expect(isAnimatedWebp(encodeAnimatedWebp([A, B], [100, 100]))).toBe(true);
    expect(isAnimatedWebp(A)).toBe(false);
  });

  it("says no rather than throwing on rubbish", () => {
    expect(isAnimatedWebp(new Uint8Array([0, 1, 2]))).toBe(false);
  });
});
