/**
 * Data sizes, in both of the two systems that share the same abbreviations.
 *
 * There are two, they disagree, and almost every confusion about storage comes
 * from software using one while the label on the box used the other.
 *
 *   SI / decimal  : 1 kB  = 1000 bytes, powers of 1000
 *   IEC / binary  : 1 KiB = 1024 bytes, powers of 1024
 *
 * A drive sold as "500 GB" holds 500,000,000,000 bytes, which is exactly what
 * was advertised. Windows then divides by 1024 three times, prints 465, and
 * calls the unit "GB" anyway. Nothing is missing and nobody lied; two systems
 * were used with one abbreviation. The gap widens with scale: 2.3% at kilo,
 * 6.9% at giga, 9.1% at tera.
 *
 * macOS and most storage vendors report decimal. Windows, Linux `ls -l` by
 * default, and RAM everywhere report binary. RAM is genuinely binary because
 * address lines are, which is why it is the one case where 1024 is not a
 * convention but a consequence.
 */

export type SizeSystem = "decimal" | "binary";

export interface SizeUnit {
  id: string;
  /** What this system calls it. */
  label: string;
  /** Bytes per unit. */
  bytes: number;
}

const DECIMAL_NAMES = ["B", "kB", "MB", "GB", "TB", "PB"];
const BINARY_NAMES = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];

export function unitsFor(system: SizeSystem): SizeUnit[] {
  const base = system === "decimal" ? 1000 : 1024;
  const names = system === "decimal" ? DECIMAL_NAMES : BINARY_NAMES;
  return names.map((label, i) => ({ id: `${system}-${i}`, label, bytes: base ** i }));
}

export interface SizeParse {
  ok: boolean;
  bytes?: number;
  error?: string;
}

export function toBytes(value: string, unitBytes: number): SizeParse {
  const text = value.trim();
  if (!text) return { ok: false, error: "Enter a size." };
  if (!/^\d*\.?\d+$/.test(text)) {
    return { ok: false, error: "Enter a positive number, for example 500 or 1.5." };
  }
  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, error: "That number is too large." };
  const bytes = n * unitBytes;
  if (bytes > Number.MAX_SAFE_INTEGER) {
    return { ok: false, error: "That is past the largest size this can represent exactly." };
  }
  return { ok: true, bytes };
}

/** Formats a byte count in one system, choosing a sensible unit. */
export function humanise(bytes: number, system: SizeSystem): string {
  const base = system === "decimal" ? 1000 : 1024;
  const names = system === "decimal" ? DECIMAL_NAMES : BINARY_NAMES;
  if (bytes === 0) return `0 ${names[0]}`;

  let i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(base));
  i = Math.max(0, Math.min(names.length - 1, i));
  const value = bytes / base ** i;
  // Whole bytes never get a decimal point; larger units get two, then trailing
  // zeros are trimmed so 1.50 MB reads as 1.5 MB.
  const text = i === 0 ? String(Math.round(value)) : value.toFixed(2).replace(/\.?0+$/, "");
  return `${text} ${names[i]}`;
}

/**
 * How far apart the two systems are at a given magnitude.
 *
 * This is the number that explains the missing space on a drive, so it is
 * computed rather than described: at exponent 3 it is 6.87%, which is exactly
 * the 500 to 465.66 drop above.
 */
export function systemGapPercent(exponent: number): number {
  if (exponent <= 0) return 0;
  return (1 - 1000 ** exponent / 1024 ** exponent) * 100;
}
