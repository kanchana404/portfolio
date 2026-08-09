/**
 * Aspect ratio arithmetic.
 *
 * Small, but the two things people actually want are both easy to get wrong:
 * reducing 1920×1080 to "16:9" rather than "1920:1080", and solving for a
 * missing dimension without introducing a half-pixel.
 */

export interface Ratio {
  w: number;
  h: number;
}

/** Euclid, iterative — the recursive version blows the stack on adversarial input. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/**
 * Reduce a width and height to their simplest integer ratio.
 *
 * Returns `null` for non-positive input rather than a ratio involving zero,
 * which is not a ratio.
 */
export function simplifyRatio(width: number, height: number): Ratio | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  const w = Math.round(width);
  const h = Math.round(height);
  const divisor = gcd(w, h);
  if (divisor === 0) return null;
  return { w: w / divisor, h: h / divisor };
}

/**
 * Named ratios, for recognising what a size actually is.
 *
 * 1366×768 reduces to 683:384, which is technically correct and tells nobody
 * anything. Matching against the common ratios within a tolerance and saying
 * "≈ 16:9" is the useful answer.
 */
const NAMED: ReadonlyArray<{ ratio: Ratio; label: string; note: string }> = [
  { ratio: { w: 16, h: 9 }, label: "16:9", note: "Widescreen video, most monitors and phones in landscape" },
  { ratio: { w: 9, h: 16 }, label: "9:16", note: "Vertical video — Reels, Shorts, TikTok" },
  { ratio: { w: 4, h: 3 }, label: "4:3", note: "Classic television and older displays" },
  { ratio: { w: 3, h: 2 }, label: "3:2", note: "35mm film and most DSLR sensors" },
  { ratio: { w: 1, h: 1 }, label: "1:1", note: "Square — profile pictures and feed posts" },
  { ratio: { w: 21, h: 9 }, label: "21:9", note: "Ultrawide monitors and anamorphic cinema" },
  { ratio: { w: 5, h: 4 }, label: "5:4", note: "1280×1024 displays" },
  { ratio: { w: 2, h: 3 }, label: "2:3", note: "Portrait photography" },
  { ratio: { w: 4, h: 5 }, label: "4:5", note: "Instagram portrait" },
];

export interface RatioMatch {
  label: string;
  note: string;
  exact: boolean;
}

/** Nearest well-known ratio, if the size is close enough to one to be worth naming. */
export function matchNamedRatio(
  width: number,
  height: number,
  tolerance = 0.01
): RatioMatch | null {
  if (width <= 0 || height <= 0) return null;
  const value = width / height;

  let best: { entry: (typeof NAMED)[number]; delta: number } | null = null;
  for (const entry of NAMED) {
    const delta = Math.abs(value - entry.ratio.w / entry.ratio.h);
    if (best === null || delta < best.delta) best = { entry, delta };
  }
  if (!best || best.delta > tolerance) return null;

  const simplified = simplifyRatio(width, height);
  const exact =
    simplified !== null &&
    simplified.w === best.entry.ratio.w &&
    simplified.h === best.entry.ratio.h;

  return { label: best.entry.label, note: best.entry.note, exact };
}

/**
 * Solve for the missing dimension at a fixed ratio.
 *
 * Rounds to a whole pixel, because there is no such thing as a fractional one —
 * and reports the rounding so the user knows the result is off the exact ratio
 * by a fraction rather than wondering why it will not tile perfectly.
 */
export function solveDimension(
  ratio: Ratio,
  known: { width: number } | { height: number }
): { width: number; height: number; rounded: boolean } | null {
  if (ratio.w <= 0 || ratio.h <= 0) return null;

  if ("width" in known) {
    if (!Number.isFinite(known.width) || known.width <= 0) return null;
    const exact = (known.width * ratio.h) / ratio.w;
    const height = Math.round(exact);
    return { width: Math.round(known.width), height, rounded: Math.abs(exact - height) > 1e-9 };
  }

  if (!Number.isFinite(known.height) || known.height <= 0) return null;
  const exact = (known.height * ratio.w) / ratio.h;
  const width = Math.round(exact);
  return { width, height: Math.round(known.height), rounded: Math.abs(exact - width) > 1e-9 };
}

/** Parse "16:9", "16/9" or "16 9" into a ratio. */
export function parseRatio(input: string): Ratio | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*[:/x×\s]\s*(\d+(?:\.\d+)?)\s*$/i.exec(input);
  if (!match) return null;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!(w > 0) || !(h > 0)) return null;
  return { w, h };
}
