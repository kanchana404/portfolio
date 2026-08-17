/**
 * The AVIF and JPEG XL encoders, moved off the main thread.
 *
 * Only these two need it, and only because of how long they take. Measured on a
 * 12 MP photograph: AVIF 1.04s, JPEG XL 5.54s. Every other format this project
 * writes finishes in milliseconds, so they stay on the main thread where they
 * are simpler to reason about.
 *
 * Five seconds of synchronous WebAssembly does not merely feel slow. It blocks
 * the event loop completely: the spinner stops spinning, the button does not
 * depress, and nothing can be cancelled — a page that has visibly died rather
 * than one that is working. Moving just the encode fixes all of that, and the
 * rest of the pipeline is left alone precisely because it does not have the
 * problem.
 *
 * Pixels arrive as a transferred buffer rather than a copy, so handing over a
 * 12 MP image costs nothing regardless of its size.
 */

import { encodeAvif, encodeJxl } from "./wasm";

export interface EncodeRequest {
  id: number;
  format: "avif" | "jxl";
  /** Transferred, not copied — the caller must not touch it afterwards. */
  buffer: ArrayBuffer;
  width: number;
  height: number;
  quality?: number;
}

export type EncodeResponse =
  | { id: number; ok: true; buffer: ArrayBuffer }
  | { id: number; ok: false; message: string };

/**
 * The one piece of worker scope this file needs.
 *
 * Declared here rather than by adding `"webworker"` to tsconfig's `lib`: that
 * is a project-wide switch, and it would merge worker globals into every DOM
 * file — where `self`, `postMessage` and `location` mean different things and
 * would start type-checking in components that have no business seeing them.
 */
const post = self.postMessage as (
  message: EncodeResponse,
  transfer?: Transferable[]
) => void;

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const { id, format, buffer, width, height, quality } = event.data;
  try {
    const image = new ImageData(new Uint8ClampedArray(buffer), width, height);
    const bytes = format === "avif"
      ? await encodeAvif(image, quality)
      : await encodeJxl(image, quality);

    // `bytes` may be a view onto a larger WASM heap; slice so the transfer
    // moves exactly the encoded file and not the encoder's memory with it.
    const out = bytes.slice().buffer as ArrayBuffer;
    post({ id, ok: true, buffer: out }, [out]);
  } catch (error) {
    post({
      id,
      ok: false,
      message: error instanceof Error ? error.message : "The encoder failed.",
    });
  }
};
