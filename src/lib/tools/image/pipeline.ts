import {
  type ImageFormat,
  FORMATS,
  exceedsPixelBudget,
  needsMatte,
} from "./spec";

/**
 * Decode → orient → guard → matte → encode → verify.
 *
 * Browser-only (canvas, `createImageBitmap`), which is why it is separated from
 * `spec.ts`: the decisions are unit-tested there, and this file is the thin
 * layer that talks to the platform.
 *
 * Every step here exists because of a specific way image converters go wrong,
 * and each is noted at the point it is handled.
 */

export interface ConvertOptions {
  to: ImageFormat;
  /** Source format, if known — decides whether a matte is needed. */
  from: ImageFormat | null;
  /** 0-1, ignored by PNG. */
  quality?: number;
  /** Painted behind the image when alpha is dropped. */
  background?: string;
}

export interface ConvertResult {
  blob: Blob;
  width: number;
  height: number;
}

export class ImageConvertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageConvertError";
  }
}

/**
 * Decodes a file, honouring its EXIF orientation.
 *
 * Photos off a phone carry an orientation flag, and a naive `drawImage` ignores
 * it — portrait shots come out sideways, which is the single most reported bug
 * in browser image tools. `imageOrientation: "from-image"` is what fixes it,
 * and it is why this uses `createImageBitmap` over an `<img>`.
 */
async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageConvertError(
      "This file could not be read as an image. It may be corrupt, or in a format this browser cannot open."
    );
  }
}

/**
 * True if this browser can really encode `format`.
 *
 * `canvas.toBlob` does not reject an unsupported type — it silently produces a
 * PNG with a `image/png` blob type. Safari cannot write WebP and does exactly
 * this. Probing once with a 1×1 canvas is the only reliable answer, so the UI
 * can hide a target it cannot honour instead of handing over a mislabelled file.
 */
export async function canEncode(format: ImageFormat): Promise<boolean> {
  const mime = FORMATS[format].mime;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime)
  );
  return blob?.type === mime;
}

export async function convertImage(
  file: Blob,
  options: ConvertOptions
): Promise<ConvertResult> {
  const bitmap = await decode(file);

  try {
    // Canvas has per-browser dimension and area ceilings, and exceeding them
    // does not throw — it yields a blank surface, so the tool would hand back
    // an empty file and appear to have worked. Refuse instead.
    if (exceedsPixelBudget(bitmap.width, bitmap.height)) {
      throw new ImageConvertError(
        `That image is ${Math.round((bitmap.width * bitmap.height) / 1_000_000)} megapixels, which is past what a browser canvas can reliably handle. Nothing was uploaded — try resizing it first.`
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new ImageConvertError("This browser refused to provide a canvas.");
    }

    // The transparency trap: a canvas starts transparent-black, and JPEG has no
    // alpha, so every transparent pixel encodes as black unless something is
    // painted first.
    if (needsMatte(options.from, options.to)) {
      ctx.fillStyle = options.background ?? "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(bitmap, 0, 0);

    const mime = FORMATS[options.to].mime;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, options.quality)
    );

    if (!blob) {
      throw new ImageConvertError("The browser produced no image data.");
    }

    // Verify rather than trust. `toBlob` falls back to PNG for a type it cannot
    // write, so without this the tool would happily save a PNG named .webp.
    if (blob.type !== mime) {
      throw new ImageConvertError(
        `This browser cannot write ${FORMATS[options.to].label}. It returned ${blob.type || "an unknown format"} instead, so nothing was saved.`
      );
    }

    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}
