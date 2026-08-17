/**
 * AVIF and JPEG XL, the two formats worth a WebAssembly download.
 *
 * Everything else this project writes costs a few kilobytes because the browser
 * already owns the codec and only the container had to be written. These two
 * are the exception: nothing in any browser will *encode* them, so the encoder
 * itself has to be shipped — 822 kB for AVIF, 378 kB for JPEG XL, over the wire
 * after brotli. That is a real cost paid by a real person on a real connection,
 * so it is shown on the option before it is chosen, and it is never fetched
 * until it is.
 *
 * Both come from `@jsquash` (Apache-2.0, repackaged from Squoosh), wrapping
 * libaom and libjxl (BSD). The licence matters as much as the size here: this
 * repository is MIT under a third-party copyright, so a copyleft codec could
 * not be conveyed to a browser from it at all. That is exactly why HEIC and
 * camera RAW are not in this file — libheif and LibRaw are LGPL, so they run on
 * the server instead, where nothing is conveyed to anyone.
 *
 * Threading: `@jsquash` prefers a multi-threaded build when `SharedArrayBuffer`
 * exists, which needs COOP/COEP headers site-wide. Setting those would break
 * every third-party embed on the portfolio, so the single-threaded build is
 * what actually runs. The choice is automatic — `wasm-feature-detect` sees no
 * SharedArrayBuffer and falls back — so this stays correct either way, and
 * would quietly get faster if the headers ever went on.
 */

import type { RasterImage } from "./raster";
import type { EncodeResponse } from "./encoder.worker";

export class WasmCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WasmCodecError";
  }
}

/** Formats whose encoder is a WebAssembly module rather than the browser. */
export const WASM_ENCODED = ["avif", "jxl"] as const;

/** Formats where the browser may or may not have a decoder, so we carry one. */
export const WASM_DECODED = ["avif", "jxl"] as const;

/**
 * AVIF encoder speed.
 *
 * `speed` runs 0 (slowest, smallest) to 10; jsquash defaults to 6. Measured
 * here on a 12 MP photograph at quality 50:
 *
 *     speed 6   6.83s   1497 kB      speed 9   0.86s   1499 kB
 *     speed 7   3.81s   1499 kB      speed 10  0.84s   1499 kB
 *     speed 8   1.04s   1497 kB
 *
 * The output size is flat across the whole range — under two kilobytes in 1.5
 * megabytes separates the fastest setting from the slowest — while the time
 * varies eightfold. The default costs nearly seven seconds to produce the same
 * file, which is not a trade-off so much as a setting inherited from build
 * pipelines, where seconds are free and the output is served a million times.
 * A browser tab is the opposite case.
 *
 * 8 rather than 10 because the gain past it is 0.2s and higher speeds get
 * sloppier on content less forgiving than a photograph.
 */
const AVIF_SPEED = 8;

/**
 * JPEG XL effort.
 *
 * Not the same trade as AVIF, which is why it is not the same reasoning.
 * `effort` runs 1 to 9 and jsquash defaults to 7. Measured at quality 75:
 *
 *     0.96 MP    effort 5  0.47s /   85 kB     effort 7  0.64s /   85 kB
 *     3.8 MP     effort 5  1.74s /  332 kB     effort 7  2.61s /  332 kB
 *     12 MP      effort 5  5.54s / 1025 kB     effort 7  8.24s / 1026 kB
 *
 * Effort 5 and 7 produce the *same file* — identical to the kilobyte at every
 * size — so the default simply spends 40% more time for nothing.
 *
 * Below 5 is where it stops being free: libjxl changes coding path there, and
 * effort 4 on the 12 MP image gives 1.40s but 1799 kB — 75% larger, and larger
 * than AVIF manages on the same picture. That would be the worst outcome
 * available: a 378 kB encoder downloaded to produce a file bigger than the
 * format it was chosen over. So 5 is both the fastest setting that is not a
 * compromise and the last one before the cliff.
 */
const JXL_EFFORT = 5;

/** Maps the widget's 0–1 quality onto the 0–100 both encoders expect. */
function toPercent(quality: number | undefined, fallback: number): number {
  if (quality === undefined || Number.isNaN(quality)) return fallback;
  return Math.round(Math.min(1, Math.max(0, quality)) * 100);
}

export async function encodeAvif(
  image: ImageData,
  quality?: number
): Promise<Uint8Array> {
  const encode = (await import("@jsquash/avif/encode")).default;
  const buffer = await encode(image, {
    quality: toPercent(quality, 50),
    speed: AVIF_SPEED,
  });
  return new Uint8Array(buffer);
}

export async function encodeJxl(
  image: ImageData,
  quality?: number
): Promise<Uint8Array> {
  const encode = (await import("@jsquash/jxl/encode")).default;
  const buffer = await encode(image, {
    quality: toPercent(quality, 75),
    effort: JXL_EFFORT,
  });
  return new Uint8Array(buffer);
}

/**
 * Encodes on a worker thread, falling back to this one if that is impossible.
 *
 * The fallback is not hypothetical politeness: module workers need Safari 15+,
 * and a `new Worker` call can also fail outright under a Content-Security-Policy
 * that forbids worker sources. In either case a frozen tab for a few seconds is
 * a far better outcome than a converter that refuses to work at all, so the
 * failure is swallowed and the encode simply happens here instead.
 *
 * One worker is created per call and terminated after. Encoding is a rare,
 * one-shot action — nobody converts images in a tight loop — and a pooled
 * worker would hold libaom's several hundred megabytes of heap alive for the
 * rest of the session to save a few milliseconds of startup.
 */
export async function encodeOffThread(
  format: "avif" | "jxl",
  image: ImageData,
  quality?: number
): Promise<Uint8Array> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./encoder.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    return format === "avif"
      ? encodeAvif(image, quality)
      : encodeJxl(image, quality);
  }

  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<EncodeResponse>) => {
        const data = event.data;
        if (data.ok) resolve(new Uint8Array(data.buffer));
        else reject(new WasmCodecError(data.message));
      };
      // A worker that dies mid-encode — out of memory on a very large image is
      // the realistic cause — fires `error` and never posts back. Without this
      // the promise would simply never settle and the UI would wait forever.
      worker.onerror = () =>
        reject(
          new WasmCodecError(
            `The ${format.toUpperCase()} encoder ran out of memory on this image. Try a smaller one.`
          )
        );

      // The pixel buffer is transferred, so this costs nothing at 12 megapixels.
      const buffer = image.data.buffer.slice(0) as ArrayBuffer;
      worker.postMessage(
        { id: 1, format, buffer, width: image.width, height: image.height, quality },
        [buffer]
      );
    });
  } finally {
    worker.terminate();
  }
}

/**
 * Decodes AVIF or JPEG XL, and is only ever reached when the browser could not.
 *
 * Current Chrome, Firefox and Safari all decode AVIF natively, and Safari 17+
 * decodes JPEG XL, so `createImageBitmap` is tried first and this is skipped
 * entirely — which is why the decoders are not listed as a cost anywhere. They
 * are insurance, not a toll.
 */
export async function decodeWasm(
  format: "avif" | "jxl",
  bytes: Uint8Array
): Promise<RasterImage> {
  // `bytes` may be a view onto a larger buffer; the decoders want the exact
  // range, and handing them the whole buffer would decode trailing garbage.
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  const decoded =
    format === "avif"
      ? await (await import("@jsquash/avif/decode")).default(buffer)
      : await (await import("@jsquash/jxl/decode")).default(buffer);

  if (!decoded) {
    throw new WasmCodecError(
      `This ${format.toUpperCase()} file could not be decoded. It may be corrupt.`
    );
  }

  return {
    data: decoded.data as Uint8ClampedArray,
    width: decoded.width,
    height: decoded.height,
  };
}
