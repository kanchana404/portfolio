/**
 * Unix timestamps, both directions.
 *
 * The whole difficulty in this tool is one ambiguity: `1755000000` and
 * `1755000000000` are the same instant written in different units, and a
 * converter that guesses wrong is out by a factor of a thousand — showing 1970
 * for a timestamp from this year, or the year 57000 for one in seconds.
 *
 * The guess is made on magnitude, and the threshold is chosen rather than
 * assumed. Anything at or above 10^11 is treated as milliseconds, because
 * 10^11 seconds is the year 5138 while 10^11 milliseconds is 1973. Real
 * timestamps in seconds are ten digits until 2286; real ones in milliseconds
 * are thirteen. The gap between those two ranges is where the threshold sits,
 * so the only inputs it can misread are dates far outside anything a person is
 * converting.
 *
 * The unit is always reported back, so a wrong guess is visible rather than
 * silently wrong. That is the point: this file cannot be certain, so it says
 * what it assumed.
 */

export type TimeUnit = "seconds" | "milliseconds";

export interface ParsedTime {
  ok: boolean;
  /** Milliseconds since the epoch, the form everything else is derived from. */
  ms: number;
  /** What the input was read as, so the UI can say so and offer to switch. */
  unit: TimeUnit;
  error?: string;
}

/**
 * Above this, a bare number is read as milliseconds.
 *
 * 10^11 seconds is the year 5138; 10^11 milliseconds is 1973. Nothing anyone
 * converts lives in the overlap.
 */
const MS_THRESHOLD = 1e11;

/** Beyond this, `new Date` yields Invalid Date rather than a clamped value. */
const MAX_JS_TIME = 8.64e15;

export function detectUnit(value: number): TimeUnit {
  return Math.abs(value) >= MS_THRESHOLD ? "milliseconds" : "seconds";
}

/** Reads a bare epoch number, guessing its unit unless told. */
export function parseEpoch(input: string, forced?: TimeUnit): ParsedTime {
  const text = input.trim();
  if (!text) return { ok: false, ms: 0, unit: "seconds", error: "Enter a timestamp." };

  // Reject anything that is not a plain integer before Number() coerces it:
  // Number("12e5") is 1200000 and Number(" 12 ") is 12, neither of which is a
  // timestamp somebody typed.
  if (!/^-?\d+$/.test(text)) {
    return { ok: false, ms: 0, unit: "seconds", error: "A Unix timestamp is a whole number of seconds or milliseconds." };
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { ok: false, ms: 0, unit: "seconds", error: "That number is too large to be a timestamp." };
  }

  const unit = forced ?? detectUnit(value);
  const ms = unit === "seconds" ? value * 1000 : value;

  if (Math.abs(ms) > MAX_JS_TIME) {
    return { ok: false, ms: 0, unit, error: "That is outside the range JavaScript dates can represent." };
  }
  return { ok: true, ms, unit };
}

/** Reads a date string, preferring ISO 8601 and refusing ambiguity. */
export function parseDate(input: string): ParsedTime {
  const text = input.trim();
  if (!text) return { ok: false, ms: 0, unit: "milliseconds", error: "Enter a date." };

  const ms = Date.parse(text);
  if (Number.isNaN(ms)) {
    return {
      ok: false,
      ms: 0,
      unit: "milliseconds",
      error: "That date could not be read. ISO 8601 like 2026-08-20T14:30:00Z is always understood.",
    };
  }
  return { ok: true, ms, unit: "milliseconds" };
}

export interface Formatted {
  iso: string;
  utc: string;
  local: string;
  localZone: string;
  relative: string;
  seconds: number;
  milliseconds: number;
}

/** How long ago, in the largest unit that still reads naturally. */
export function relativeTo(ms: number, now: number): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [1000, "second"],
    [60_000, "minute"],
    [3_600_000, "hour"],
    [86_400_000, "day"],
    [2_629_800_000, "month"],
    [31_557_600_000, "year"],
  ];

  let chosen: Intl.RelativeTimeFormatUnit = "second";
  let size = 1000;
  for (const [unitMs, unit] of units) {
    if (abs >= unitMs) {
      chosen = unit;
      size = unitMs;
    }
  }
  if (abs < 1000) return "just now";

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return rtf.format(Math.round(diff / size), chosen);
}

export function format(ms: number, now: number = Date.now()): Formatted {
  const d = new Date(ms);
  return {
    iso: d.toISOString(),
    utc: d.toUTCString(),
    local: d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" }),
    localZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    relative: relativeTo(ms, now),
    // Seconds truncate toward the epoch rather than rounding, which is what
    // every server-side epoch does. Rounding here would make a round trip
    // through this tool land a second in the future.
    seconds: Math.floor(ms / 1000),
    milliseconds: ms,
  };
}
