/**
 * Types for `gifenc`, which ships none of its own.
 *
 * Written against the package's real surface rather than declared `any`: the
 * whole reason this project quantises and writes GIF frames by hand is to
 * control the palette, and an untyped `writeFrame` would let a wrong palette
 * format through to produce a GIF of the right size in the wrong colours.
 *
 * Only what this project calls is declared. `nearestColor`, `prequantize` and
 * friends exist too; they can be added when something needs them.
 */
declare module "gifenc" {
  /** A palette as RGB (or RGBA) triples, at most 256 entries for GIF. */
  export type Palette = number[][];

  export type PaletteFormat = "rgb565" | "rgb444" | "rgba4444";

  export interface WriteFrameOptions {
    palette?: Palette;
    /** Hundredths of a second. 0 means "as fast as possible" and stutters. */
    delay?: number;
    /** Palette index rendered transparent. */
    transparent?: boolean;
    transparentIndex?: number;
    /** 0 none, 1 keep, 2 restore background, 3 restore previous. */
    dispose?: number;
    repeat?: number;
    first?: boolean;
  }

  export interface GifEncoderInstance {
    /** `index` is one palette index per pixel, from `applyPalette`. */
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: WriteFrameOptions
    ): void;
    writeHeader(): void;
    /** Writes the trailer. The bytes are incomplete until this is called. */
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    buffer: ArrayBuffer;
    reset(): void;
  }

  export function GIFEncoder(options?: {
    auto?: boolean;
    initialCapacity?: number;
  }): GifEncoderInstance;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: PaletteFormat; oneBitAlpha?: boolean; clearAlpha?: boolean }
  ): Palette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: PaletteFormat
  ): Uint8Array;
}
