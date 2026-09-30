/**
 * Post dates are `YYYY-MM-DD` strings, handled in UTC.
 *
 * Blog pages are generated once at build, so nothing here may depend on the
 * time a page is rendered: the old `formatDate` appended "(3d ago)" from
 * `new Date()`, which froze into the HTML and went stale. Pure and
 * import-free, so the tsx CLIs can load it too.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function utc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/** A real calendar date: 2026-02-30 is refused, not rolled over to March. */
export function isYmd(s: string): boolean {
  if (!YMD.test(s)) return false;
  const date = utc(s);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s;
}

/** "September 28, 2026". */
export function formatPostDate(ymd: string): string {
  return utc(ymd).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-09-28T00:00:00.000Z", for JSON-LD and Open Graph. */
export function ymdToIso(ymd: string): string {
  return utc(ymd).toISOString();
}

/** "Mon, 28 Sep 2026 00:00:00 GMT", the RFC 822 form RSS asks for. */
export function ymdToRfc822(ymd: string): string {
  return utc(ymd).toUTCString();
}

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(ymd: string, n: number): string {
  return new Date(utc(ymd).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** `ai-dev-news-2026-w40`. */
export const DIGEST_SLUG_RE = /^ai-dev-news-\d{4}-w(?:0[1-9]|[1-4]\d|5[0-3])$/;

/**
 * The weekly digest's slug for a publish date, by ISO-8601 week. The year is
 * the ISO week-year, not the calendar year, so the last days of December can
 * belong to week 1 of the next year and the first days of January to week 52
 * or 53 of the last, and two years' digests never share a slug.
 */
export function digestSlug(ymd: string): string {
  const date = utc(ymd);
  // The Thursday of this Monday-to-Sunday week decides its year.
  const weekday = date.getUTCDay() || 7;
  const thursday = new Date(date.getTime() + (4 - weekday) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const dayOfYear = (thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `ai-dev-news-${year}-w${String(week).padStart(2, "0")}`;
}
