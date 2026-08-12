/**
 * Unix timestamp conversion.
 *
 * The genuinely useful behaviour is unit detection. A timestamp arrives as
 * seconds, milliseconds, microseconds or nanoseconds depending on which system
 * produced it, they are all just integers, and interpreting the wrong one puts
 * you in 1970 or in the year 56,000. Detecting by magnitude is what stops the
 * user having to know.
 */

export type TimestampUnit = "seconds" | "milliseconds" | "microseconds" | "nanoseconds";

export interface ParsedTimestamp {
  ok: boolean;
  date?: Date;
  detectedUnit?: TimestampUnit;
  error?: string;
}

/**
 * Thresholds for magnitude detection.
 *
 * A present-day value is ~1.7e9 in seconds and ~1.7e12 in milliseconds, so the
 * boundaries sit between those bands. Chosen deliberately loose: a seconds
 * timestamp stays "seconds" from 1973 until the year 5138, which covers every
 * value anyone will paste in.
 */
const SECONDS_MAX = 1e11; // ~year 5138 in seconds
const MILLIS_MAX = 1e14; // ~year 5138 in milliseconds
const MICROS_MAX = 1e17;

export function detectUnit(value: number): TimestampUnit {
  const abs = Math.abs(value);
  if (abs < SECONDS_MAX) return "seconds";
  if (abs < MILLIS_MAX) return "milliseconds";
  if (abs < MICROS_MAX) return "microseconds";
  return "nanoseconds";
}

const TO_MILLIS: Record<TimestampUnit, (n: number) => number> = {
  seconds: (n) => n * 1000,
  milliseconds: (n) => n,
  microseconds: (n) => n / 1000,
  nanoseconds: (n) => n / 1e6,
};

export const UNIT_LABEL: Record<TimestampUnit, string> = {
  seconds: "seconds",
  milliseconds: "milliseconds",
  microseconds: "microseconds",
  nanoseconds: "nanoseconds",
};

/** Parse an epoch value. `unit: "auto"` detects by magnitude. */
export function parseTimestamp(
  raw: string,
  unit: TimestampUnit | "auto" = "auto"
): ParsedTimestamp {
  const cleaned = raw.trim().replace(/[_,\s]/g, "");
  if (cleaned.length === 0) return { ok: false };

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { ok: false, error: "Enter a whole number of seconds or milliseconds since 1 January 1970." };
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return { ok: false, error: "That number is too large to represent." };
  }

  const detectedUnit = unit === "auto" ? detectUnit(value) : unit;
  const millis = TO_MILLIS[detectedUnit](value);
  const date = new Date(millis);

  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "That value is outside the range of dates JavaScript can represent." };
  }

  return { ok: true, date, detectedUnit };
}

/** Parse a human date string into a Date, or fail cleanly. */
export function parseDateString(raw: string): ParsedTimestamp {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false };
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return {
      ok: false,
      error:
        "Could not read that date. ISO 8601 is safest — 2026-08-09T14:30:00Z — " +
        "because other formats are interpreted differently by different browsers.",
    };
  }
  return { ok: true, date };
}

export interface TimestampViews {
  seconds: string;
  milliseconds: string;
  iso: string;
  utc: string;
  local: string;
  relative: string;
  dayOfWeek: string;
  timeZone: string;
}

/** Every representation the results panel shows. */
export function describeDate(date: Date, now: Date = new Date()): TimestampViews {
  const ms = date.getTime();
  return {
    seconds: String(Math.floor(ms / 1000)),
    milliseconds: String(ms),
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "long",
    }),
    relative: formatRelative(ms - now.getTime()),
    dayOfWeek: date.toLocaleDateString(undefined, { weekday: "long" }),
    timeZone:
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "your local time zone",
  };
}

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/** "3 days ago" / "in 2 months", via Intl so it localises for free. */
export function formatRelative(deltaMs: number): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  let duration = deltaMs / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), "year");
}
