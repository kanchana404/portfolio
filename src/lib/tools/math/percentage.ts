/**
 * Percentage arithmetic.
 *
 * Deliberately UI-free so it can be unit tested without a DOM. Every function
 * returns `null` rather than `NaN` or `Infinity` for an input it cannot answer,
 * because `null` is representable in the UI as "we need more from you" while
 * `NaN` leaks into the DOM as the word "NaN" and reads as a broken tool.
 *
 * There is no rounding in here. Rounding is a presentation decision and belongs
 * next to the thing doing the presenting; a calculator that rounds internally
 * and then rounds again on display accumulates error nobody can trace.
 */

/**
 * Parse a user-typed number.
 *
 * Tolerates the separators people actually type — thousands commas, spaces,
 * narrow no-break spaces pasted out of spreadsheets — and a leading `+`.
 * Rejects anything else outright rather than letting `Number()`'s surprising
 * coercions through: `Number("")` is 0 and `Number("  ")` is 0, which would turn
 * an empty field into a confident answer of zero.
 */
export function parseDecimal(raw: string): number | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/^\+/, "");

  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") {
    return null;
  }
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** `percent`% of `value`. */
export function percentOf(percent: number, value: number): number | null {
  if (!Number.isFinite(percent) || !Number.isFinite(value)) return null;
  const result = (percent / 100) * value;
  return Number.isFinite(result) ? result : null;
}

/**
 * `part` is what percent of `whole`.
 *
 * `null` when `whole` is zero: nothing is a meaningful percentage of nothing,
 * and the honest answer is a prompt, not `Infinity`.
 */
export function whatPercentOf(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole)) return null;
  if (whole === 0) return null;
  const result = (part / whole) * 100;
  return Number.isFinite(result) ? result : null;
}

/**
 * Percentage change from `from` to `to`.
 *
 * The denominator is `|from|`, not `from`. With a signed denominator a move from
 * −100 to −50 reports −50%, which reads as a decrease when the value actually
 * rose. Using the magnitude makes the sign of the result mean what a reader
 * expects: positive is "went up".
 *
 * `null` when `from` is zero — percentage change from nothing is undefined, and
 * every tool that prints "∞%" there is wrong rather than clever.
 */
export function percentChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (from === 0) return null;
  const result = ((to - from) / Math.abs(from)) * 100;
  return Number.isFinite(result) ? result : null;
}

/**
 * Apply a percentage increase (or, with a negative `percent`, a decrease).
 *
 * This is the exact inverse of `percentChange`, and that constraint drives two
 * details that look like fussiness and are not:
 *
 * 1. **The step is `|value| * percent / 100`, not `value * percent / 100`.**
 *    `percentChange` divides by the magnitude of its starting value, so this has
 *    to multiply by the magnitude too. With a signed multiplier the pair stops
 *    being inverses the moment a negative number is involved: `percentChange(-40,
 *    10)` is +125%, and applying +125% to −40 the signed way lands on −90 rather
 *    than back on 10.
 * 2. **It adds a step rather than scaling by `1 + percent/100`.** Forming the
 *    scale factor first rounds twice: `200 * (1 + 10/100)` is 220.00000000000003,
 *    while `200 + 200 * 10 / 100` is exactly 220.
 */
export function applyPercentChange(
  value: number,
  percent: number
): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(percent)) return null;
  const result = value + (Math.abs(value) * percent) / 100;
  return Number.isFinite(result) ? result : null;
}

/**
 * Format a computed number for display.
 *
 * Trims trailing zeros so "25" does not render as "25.00", but keeps enough
 * precision that a third of something is not silently reported as a whole
 * number. `maximumFractionDigits` is capped at 20 by `Intl.NumberFormat`.
 */
export function formatNumber(value: number, maxFractionDigits = 6): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.min(20, Math.max(0, maxFractionDigits)),
  }).format(value);
}

/** Same as `formatNumber`, with a trailing percent sign. */
export function formatPercent(value: number, maxFractionDigits = 4): string {
  return `${formatNumber(value, maxFractionDigits)}%`;
}
