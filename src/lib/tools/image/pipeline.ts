import {
  type ImageFormat,
  FORMATS,
  ICO_SIZES,
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

/**
 * Packs PNGs into an .ico, at every size a favicon is asked for.
 *
 * No encoder involved: since Windows Vista an ICO directory entry may point at
 * PNG bytes directly instead of the old BMP structure, and every browser and OS
 * in use reads that. So the whole format is a 6-byte header, one 16-byte entry
 * per image, and PNGs the canvas already gives us.
 *
 * Width and height are single bytes, which is why 256 is written as 0 — the
 * format's own convention for "256", and the bug behind most hand-rolled ICO
 * writers producing a file Windows shows as blank.
 */
async function encodeIco(bitmap: ImageBitmap): Promise<Blob> {
  const sizes = ICO_SIZES.filter((s) => s <= 256);
  const pngs: ArrayBuffer[] = [];

  for (const size of sizes) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageConvertError("This browser refused to provide a canvas.");
    // Square, and letterboxed rather than stretched: an icon squashed out of
    // proportion is worse than one with a little transparent margin.
    const scale = Math.min(size / bitmap.width, size / bitmap.height);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) throw new ImageConvertError("The browser produced no image data.");
    pngs.push(await blob.arrayBuffer());
  }

  const headerSize = 6 + 16 * sizes.length;
  const total = headerSize + pngs.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // 1 = icon
  view.setUint16(4, sizes.length, true);

  let offset = headerSize;
  sizes.forEach((size, i) => {
    const entry = 6 + i * 16;
    bytes[entry] = size >= 256 ? 0 : size; // 0 means 256
    bytes[entry + 1] = size >= 256 ? 0 : size;
    bytes[entry + 2] = 0; // palette
    bytes[entry + 3] = 0; // reserved
    view.setUint16(entry + 4, 1, true); // colour planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, pngs[i].byteLength, true);
    view.setUint32(entry + 12, offset, true);
    bytes.set(new Uint8Array(pngs[i]), offset);
    offset += pngs[i].byteLength;
  });

  return new Blob([out], { type: "image/x-icon" });
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

    // ICO is built from PNGs rather than encoded, so it skips the single-canvas
    // path entirely.
    if (options.to === "ico") {
      const blob = await encodeIco(bitmap);
      return { blob, width: 256, height: 256 };
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
