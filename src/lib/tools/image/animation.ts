import {
  type ImageFormat,
  FORMATS,
  exceedsPixelBudget,
  needsMatte,
} from "./spec";

/**
 * Animated conversion: frames in, frames out.
 *
 * Separate from `./pipeline` because the shapes genuinely differ — a still
 * conversion is one bitmap to one blob, an animated one is N bitmaps to one
 * blob with timing attached — and folding the second into the first produced a
 * function whose every branch was an exception to the others.
 *
 * The common thread is that **the browser owns every codec**. GIF is the sole
 * exception, needing a real encoder and decoder, and both are MIT and small.
 * APNG and animated WebP are containers around bitstreams the canvas already
 * produces, so they cost about 1.5 kB each rather than hundreds.
 */

export interface Frame {
  bitmap: ImageBitmap;
  delayMs: number;
}

export interface AnimatedResult {
  blob: Blob;
  frameCount: number;
  width: number;
  height: number;
  /** Total run time, for showing the reader what they got. */
  durationMs: number;
}

export class AnimationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnimationError";
  }
}

/** Formats that can hold more than one frame. */
export const ANIMATED_FORMATS: readonly ImageFormat[] = ["gif", "png", "webp"];

/**
 * How many frames this tool will handle.
 *
 * Each frame is decoded to RGBA and held while the next is encoded, so memory
 * grows with frame count as well as canvas area. A 500-frame GIF at 800x600 is
 * roughly 960 MB of pixel data if held at once — past what a tab survives, and
 * the failure is a crash rather than an error.
 */
export const MAX_FRAMES = 300;

const codecs = {
  apng: () => import("./codecs/apng"),
  webp: () => import("./codecs/webp-anim"),
  gifDecode: () => import("gifuct-js"),
  gifEncode: () => import("gifenc"),
};

/** Reads the first bytes of a file, for sniffing what it actually is. */
async function head(file: Blob, length = 64): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, length).arrayBuffer());
}

/**
 * Whether a file holds an animation, decided by its bytes rather than its name.
 *
 * A `.png` may or may not be an APNG and a `.webp` may or may not animate, so
 * the extension cannot answer this. Getting it wrong in either direction is
 * visible: treat an animation as a still and it silently loses every frame but
 * one; treat a still as an animation and the encoder produces a one-frame file
 * larger than the input.
 */
export async function detectAnimation(
  file: Blob,
  format: ImageFormat | null
): Promise<boolean> {
  const bytes = await head(file, 4096);

  if (format === "gif") {
    // A GIF animates if it has more than one image descriptor (0x2C). Reading
    // the header alone cannot tell — the count is spread through the file — so
    // this defers to the decoder, which is cheap for GIF.
    return true;
  }
  if (format === "png") {
    const { isAnimatedPng } = await codecs.apng();
    return isAnimatedPng(new Uint8Array(await file.arrayBuffer()));
  }
  if (format === "webp") {
    const { isAnimatedWebp } = await codecs.webp();
    return isAnimatedWebp(bytes);
  }
  return false;
}

/** Decodes an animated file into frames the browser can draw. */
export async function decodeAnimation(
  file: Blob,
  format: ImageFormat
): Promise<Frame[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (format === "png") {
    const { decodeApng } = await codecs.apng();
    const parsed = decodeApng(bytes);
    return Promise.all(
      parsed.slice(0, MAX_FRAMES).map(async (f) => ({
        bitmap: await createImageBitmap(new Blob([f.png], { type: "image/png" })),
        delayMs: f.delayMs,
      }))
    );
  }

  if (format === "webp") {
    const { decodeAnimatedWebp } = await codecs.webp();
    const parsed = decodeAnimatedWebp(bytes);
    return Promise.all(
      parsed.slice(0, MAX_FRAMES).map(async (f) => ({
        bitmap: await createImageBitmap(new Blob([f.webp], { type: "image/webp" })),
        delayMs: f.delayMs,
      }))
    );
  }

  if (format === "gif") {
    const { parseGIF, decompressFrames } = await codecs.gifDecode();
    const gif = parseGIF(bytes.buffer as ArrayBuffer);
    const parsed = decompressFrames(gif, true).slice(0, MAX_FRAMES);
    if (parsed.length === 0) throw new AnimationError("No frames found in this GIF.");

    const width = gif.lsd.width;
    const height = gif.lsd.height;

    // GIF frames are patches, not full pictures: each may cover only part of
    // the canvas and may ask for the previous frame to be restored first.
    // Composing them here is what stops an animation coming out as a stack of
    // fragments on a transparent background.
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new AnimationError("This browser refused to provide a canvas.");

    const frames: Frame[] = [];
    for (const frame of parsed) {
      const { dims, disposalType } = frame;
      const before =
        disposalType === 3 ? ctx.getImageData(0, 0, width, height) : null;

      const patch = new ImageData(
        new Uint8ClampedArray(frame.patch),
        dims.width,
        dims.height
      );
      // Drawn through a scratch canvas so the patch composites over what is
      // already there rather than replacing that region wholesale, which is
      // what `putImageData` would do.
      const scratch = document.createElement("canvas");
      scratch.width = dims.width;
      scratch.height = dims.height;
      scratch.getContext("2d")?.putImageData(patch, 0, 0);
      ctx.drawImage(scratch, dims.left, dims.top);

      frames.push({
        bitmap: await createImageBitmap(canvas),
        // GIF stores hundredths of a second, and 0 means "as fast as possible",
        // which every browser silently treats as 100 ms.
        delayMs: frame.delay || 100,
      });

      if (disposalType === 2) {
        ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
      } else if (disposalType === 3 && before) {
        ctx.putImageData(before, 0, 0);
      }
    }
    return frames;
  }

  throw new AnimationError(`${FORMATS[format].label} does not hold animation.`);
}

/** Draws a frame to a canvas, matting first when the target has no alpha. */
function drawFrame(
  bitmap: ImageBitmap,
  to: ImageFormat,
  from: ImageFormat | null,
  background: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AnimationError("This browser refused to provide a canvas.");
  if (needsMatte(from, to)) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

async function canvasBytes(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number
): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality)
  );
  if (!blob) throw new AnimationError("The browser produced no image data.");
  if (blob.type !== mime) {
    throw new AnimationError(
      `This browser cannot write ${mime}, so the animation was not saved.`
    );
  }
  return new Uint8Array(await blob.arrayBuffer());
}

/** Encodes frames into an animated file. */
export async function encodeAnimation(
  frames: readonly Frame[],
  options: {
    to: ImageFormat;
    from: ImageFormat | null;
    quality?: number;
    background?: string;
  }
): Promise<AnimatedResult> {
  if (frames.length === 0) throw new AnimationError("There are no frames to write.");

  const { width, height } = frames[0].bitmap;
  if (exceedsPixelBudget(width, height)) {
    throw new AnimationError(
      "These frames are larger than a browser canvas can reliably hold. Nothing was uploaded."
    );
  }

  const background = options.background ?? "#ffffff";
  const delays = frames.map((f) => f.delayMs);
  const durationMs = delays.reduce((a, b) => a + b, 0);
  const common = { frameCount: frames.length, width, height, durationMs };

  if (options.to === "png") {
    const { encodeApng } = await codecs.apng();
    const pngs: Uint8Array[] = [];
    for (const frame of frames) {
      pngs.push(
        await canvasBytes(drawFrame(frame.bitmap, "png", options.from, background), "image/png")
      );
    }
    return { blob: new Blob([encodeApng(pngs, delays)], { type: "image/png" }), ...common };
  }

  if (options.to === "webp") {
    const { encodeAnimatedWebp } = await codecs.webp();
    const webps: Uint8Array[] = [];
    for (const frame of frames) {
      webps.push(
        await canvasBytes(
          drawFrame(frame.bitmap, "webp", options.from, background),
          "image/webp",
          options.quality
        )
      );
    }
    return {
      blob: new Blob([encodeAnimatedWebp(webps, delays)], { type: "image/webp" }),
      ...common,
    };
  }

  if (options.to === "gif") {
    const { GIFEncoder, quantize, applyPalette } = await codecs.gifEncode();
    const encoder = GIFEncoder();

    for (const frame of frames) {
      const canvas = drawFrame(frame.bitmap, "gif", options.from, background);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new AnimationError("This browser refused to provide a canvas.");
      const { data } = ctx.getImageData(0, 0, width, height);

      // GIF is limited to 256 colours per frame, so every frame is quantised
      // independently. A shared palette would be smaller but would smear
      // colour across scene changes.
      const palette = quantize(data, 256, { format: "rgb444" });
      const index = applyPalette(data, palette, "rgb444");
      encoder.writeFrame(index, width, height, {
        palette,
        // GIF stores delay in hundredths of a second, so anything faster than
        // 10 ms cannot be represented and is rounded up rather than to zero —
        // zero means "as fast as possible" and stutters.
        delay: Math.max(20, Math.round(frame.delayMs / 10) * 10),
      });
    }

    encoder.finish();
    return {
      blob: new Blob([encoder.bytes()], { type: "image/gif" }),
      ...common,
    };
  }

  throw new AnimationError(
    `${FORMATS[options.to].label} cannot hold animation. Choose GIF, PNG or WebP to keep it moving.`
  );
}

/** Releases the decoded frames. Skipping this leaks a bitmap per frame. */
export function releaseFrames(frames: readonly Frame[]): void {
  for (const frame of frames) frame.bitmap.close();
}
