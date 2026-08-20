/**
 * Converting a whole number between bases.
 *
 * `parseInt` and `toString(radix)` would do this in two lines and be wrong in
 * three ways that matter here.
 *
 * 1. `parseInt("12xyz", 10)` is 12. It stops at the first character it cannot
 *    read and returns what it had, so a typo becomes a plausible answer rather
 *    than an error. Every input here is validated against its base first.
 * 2. `parseInt("0.5")` is 0, silently truncating. Refused instead.
 * 3. Above 2^53 both lose precision: `parseInt("9007199254740993")` returns
 *    ...992. Everything below goes through `BigInt`, which is exact at any
 *    width, which is the whole point when the value is a bitmask or an address.
 */

export interface BaseInfo {
  id: string;
  label: string;
  radix: number;
  prefix?: string;
}

export const BASES: readonly BaseInfo[] = [
  { id: "bin", label: "Binary", radix: 2, prefix: "0b" },
  { id: "oct", label: "Octal", radix: 8, prefix: "0o" },
  { id: "dec", label: "Decimal", radix: 10 },
  { id: "hex", label: "Hexadecimal", radix: 16, prefix: "0x" },
];

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export interface BaseParse {
  ok: boolean;
  value?: bigint;
  error?: string;
}

/** Strips a 0x/0b/0o prefix when it agrees with the base being read. */
function stripPrefix(text: string, radix: number): string {
  const lower = text.toLowerCase();
  const expected = radix === 16 ? "0x" : radix === 2 ? "0b" : radix === 8 ? "0o" : null;
  if (expected && lower.startsWith(expected)) return lower.slice(2);
  return lower;
}

export function parseInBase(input: string, radix: number): BaseParse {
  const raw = input.trim().replace(/[_\s]/g, "");
  if (!raw) return { ok: false, error: "Enter a number." };

  const negative = raw.startsWith("-");
  const body = stripPrefix(negative ? raw.slice(1) : raw, radix);
  if (!body) return { ok: false, error: "Enter a number." };

  const allowed = DIGITS.slice(0, radix);
  for (const ch of body) {
    if (!allowed.includes(ch)) {
      return {
        ok: false,
        // Naming the character and the base is the difference between a usable
        // error and "invalid input".
        error: `"${ch}" is not a digit in base ${radix}. Allowed: ${allowed}.`,
      };
    }
  }

  // BigInt has no radix parser, so fold the digits by hand. Exact at any width,
  // unlike parseInt above 2^53.
  let value = 0n;
  const big = BigInt(radix);
  for (const ch of body) value = value * big + BigInt(DIGITS.indexOf(ch));
  return { ok: true, value: negative ? -value : value };
}

export function toBase(value: bigint, radix: number): string {
  return value.toString(radix);
}

/** Groups digits so a long binary or hex string stays readable. */
export function group(text: string, size: number): string {
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const parts: string[] = [];
  for (let i = body.length; i > 0; i -= size) {
    parts.unshift(body.slice(Math.max(0, i - size), i));
  }
  return (negative ? "-" : "") + parts.join(" ");
}

/** Bit width needed to hold the magnitude, which is what a mask question asks. */
export function bitLength(value: bigint): number {
  const v = value < 0n ? -value : value;
  return v === 0n ? 0 : v.toString(2).length;
}
