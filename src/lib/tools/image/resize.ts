/**
 * Working out the target size, which is where resizers actually go wrong.
 *
 * The scaling itself is one `drawImage` call. What is worth getting right is
 * everything around it:
 *
 * - **Never set both dimensions from user input.** One is given, the other is
 *   derived. A resizer that accepts both stretches faces, and stretched faces
 *   are the one distortion everybody notices instantly.
 * - **Never upscale by default.** Asking for 4000px from a 500px source cannot
 *   invent detail; it produces a soft, larger file that is worse in every way.
 *   Allowed only when explicitly asked for.
 * - **Round, do not truncate.** `Math.floor` on both axes drifts the aspect
 *   ratio by up to a pixel each way, which is visible on a thin logo.
 */

export type ResizeMode = "width" | "height" | "longest" | "percent";

export interface ResizeRequest {
  mode: ResizeMode;
  value: number;
  allowUpscale: boolean;
}

export interface ResizeResult {
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
  /** True when the request was clamped because it would have upscaled. */
  clamped?: boolean;
}

export const MAX_DIMENSION = 8000;

export function targetSize(
  sourceWidth: number,
  sourceHeight: number,
  request: ResizeRequest
): ResizeResult {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { ok: false, error: "That image has no dimensions." };
  }
  if (!Number.isFinite(request.value) || request.value <= 0) {
    return { ok: false, error: "Enter a size greater than zero." };
  }

  const ratio = sourceWidth / sourceHeight;
  let width: number;
  let height: number;

  switch (request.mode) {
    case "width":
      width = request.value;
      height = width / ratio;
      break;
    case "height":
      height = request.value;
      width = height * ratio;
      break;
    case "longest":
      if (sourceWidth >= sourceHeight) {
        width = request.value;
        height = width / ratio;
      } else {
        height = request.value;
        width = height * ratio;
      }
      break;
    case "percent":
      width = (sourceWidth * request.value) / 100;
      height = (sourceHeight * request.value) / 100;
      break;
  }

  let clamped = false;
  if (!request.allowUpscale && (width > sourceWidth || height > sourceHeight)) {
    // Cap at the original rather than refusing: the intent is usually "no
    // bigger than this", and silently enlarging is the worse failure.
    width = sourceWidth;
    height = sourceHeight;
    clamped = true;
  }

  // Round rather than floor. Flooring both axes drifts the ratio by up to a
  // pixel on each, which shows on a thin logo.
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return {
      ok: false,
      error: `That would be ${width}x${height}. The limit is ${MAX_DIMENSION}px on a side.`,
    };
  }

  return { ok: true, width, height, clamped };
}

/** Percentage saved, for the line under the result. */
export function reduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.max(0, Math.round((1 - after / before) * 100));
}
