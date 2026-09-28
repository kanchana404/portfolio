/**
 * How long a role lasted, in LinkedIn's words: "1 yr 2 mos", "8 mos", "3 yrs".
 *
 * Dates come from the resume data as "Aug 2025", "August 2025", "2023" or
 * "Present". When both ends have a month the count is inclusive, the way
 * LinkedIn counts it: Aug 2025 to Sep 2026 is 14 months, "1 yr 2 mos". When
 * either end is only a year there is no month to count from, so the result is
 * whole years ("2023 - Present" in 2026 is "3 yrs") rather than a month
 * figure that would look precise and be invented. That holds whichever end
 * has the month: "Dec 2025 - 2026" is "1 yr" too, a calendar-year difference.
 * The resume never mixes a month with a bare year except against Present.
 *
 * "Present" is only an end; as a start it returns null.
 */

// Full English names and their usual short forms ("Sept" included); anything
// else is not a month, so "Mayhem 2025" is rejected rather than read as May.
const MONTH_PATTERNS = [
  /^jan(uary)?$/, /^feb(ruary)?$/, /^mar(ch)?$/, /^apr(il)?$/, /^may$/, /^june?$/,
  /^july?$/, /^aug(ust)?$/, /^sep(t|tember)?$/, /^oct(ober)?$/, /^nov(ember)?$/, /^dec(ember)?$/,
];

interface Point {
  year: number;
  /** 0-11, or null when the data gives only a year. */
  month: number | null;
}

const PRESENT = /^(present|now|current)$/i;

function parsePoint(value: string, now: Date): Point | null {
  const text = value.trim().toLowerCase();
  if (PRESENT.test(text)) {
    // UTC, not local time: the page is prerendered on a UTC server and
    // hydrated wherever the visitor is, and both passes must agree on the
    // month or React throws a hydration error at month boundaries.
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  }
  const match = text.match(/^(?:([a-z]+)\.?\s+)?(\d{4})$/);
  if (!match) return null;
  const [, monthName, year] = match;
  if (!monthName) return { year: Number(year), month: null };
  const month = MONTH_PATTERNS.findIndex((pattern) => pattern.test(monthName));
  return month === -1 ? null : { year: Number(year), month };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatDuration(
  start: string,
  end: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (PRESENT.test(start.trim())) return null;
  const from = parsePoint(start, now);
  const to = parsePoint(end ?? "Present", now);
  if (!from || !to) return null;

  if (from.month === null || to.month === null) {
    const years = to.year - from.year;
    if (years < 0) return null;
    return years === 0 ? "Less than a year" : plural(years, "yr", "yrs");
  }

  const months = (to.year - from.year) * 12 + (to.month - from.month) + 1;
  if (months <= 0) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years && plural(years, "yr", "yrs"), rest && plural(rest, "mo", "mos")]
    .filter(Boolean)
    .join(" ");
}
