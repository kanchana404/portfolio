import { TITLE_MAX, cleanText, cleanUrl, htmlToText } from "./sanitize";
import { parseAttributes, parseDate } from "./xml";

/**
 * Links and dates from a news listing page, for a source whose sitemap misses
 * posts. Anthropic's launch posts (/claude-sonnet-5-5) are top-level pages
 * that its sitemap lists with no lastmod and whose head has no
 * article:published_time, while www.anthropic.com/news shows each one as a
 * card with its date.
 *
 * A card is an `<a href>` whose content holds a `<time>`. Its date is the
 * time's `datetime` attribute, or its text ("Sep 28, 2026") read as noon UTC,
 * since the page gives no time of day. Its title is the first heading inside,
 * when there is one. A link with no date (a menu, a footer) is not a card.
 *
 * Linear on hostile input: an open tag is matched only up to the next `<`,
 * and the scan moves on past each card's `</a>`; an unclosed one ends it.
 * Pure; the tsx CLIs load it without the `@/` alias.
 */

export interface ListingCard {
  url: string;
  /** ISO 8601 in UTC. */
  date: string;
  title: string | null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Sep 28, 2026", "September 8 2026" or an ISO date or time, as ISO 8601; null otherwise or when in the future. */
export function parseCardDate(raw: string, now: Date = new Date()): string | null {
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return checkedDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), now);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return parseDate(text, now);
  const words = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(text);
  if (!words) return null;
  const month = MONTHS.indexOf(words[1].slice(0, 3).toLowerCase());
  if (month === -1) return null;
  return checkedDate(Number(words[3]), month, Number(words[2]), now);
}

function checkedDate(year: number, month: number, day: number, now: Date): string | null {
  const date = new Date(Date.UTC(year, month, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return parseDate(date.toISOString(), now);
}

/** The text of the first h1-h6 in `html`, or null. */
function firstHeading(html: string): string | null {
  const open = /<h([1-6])\b[^<>]*>/i.exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const end = html.toLowerCase().indexOf(`</h${open[1]}`, start);
  if (end === -1) return null;
  const title = cleanText(htmlToText(html.slice(start, end)), TITLE_MAX);
  return title === "" ? null : title;
}

/**
 * Up to `max` dated cards, in page order, each link once, kept only when it
 * starts with one of `include` (cleanUrl's rules).
 */
export function parseListing(
  html: string,
  baseUrl: string,
  include: readonly string[],
  max: number,
  now: Date = new Date()
): ListingCard[] {
  const cards: ListingCard[] = [];
  const seen = new Set<string>();
  const open = /<a\b([^<>]*)>/gi;
  const close = /<\/a\s*>/gi;
  let match: RegExpExecArray | null;
  while (cards.length < max && (match = open.exec(html))) {
    const start = match.index + match[0].length;
    close.lastIndex = start;
    const end = close.exec(html);
    if (!end) break;
    open.lastIndex = end.index + end[0].length;

    const inner = html.slice(start, end.index);
    const time = /<time\b([^<>]*)>([^<]{0,100})<\/time\s*>/i.exec(inner);
    if (!time) continue;
    const date = parseCardDate(parseAttributes(time[1]).datetime ?? "", now) ?? parseCardDate(time[2], now);
    const url = cleanUrl(parseAttributes(match[1]).href ?? null, baseUrl, include);
    if (!date || !url || seen.has(url)) continue;
    seen.add(url);
    cards.push({ url, date, title: firstHeading(inner) });
  }
  return cards;
}
