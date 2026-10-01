import { SUMMARY_MAX, TITLE_MAX, cleanText, isGenericDescription, plainText } from "./sanitize";
import { parseAttributes, parseDate } from "./xml";

/**
 * Title, description and publish date from an article page's `<head>`, for
 * the items a feed gives no summary (Hugging Face, much of DeepMind) and for
 * Anthropic, which has only a sitemap. Only the head is read: the scan stops
 * at `</head>` or HEAD_MAX characters, whichever comes first, and a tag is
 * matched only up to the next `<`, so the cost stays linear.
 *
 * Pure; the tsx CLIs load it without the `@/` alias.
 */

export const HEAD_MAX = 512 * 1024;

export interface PageMeta {
  title: string | null;
  description: string | null;
  /** ISO 8601 in UTC, from `article:published_time`. */
  published: string | null;
}

/** An attribute value (already decoded once) or a `<title>`'s text, made plain. */
const clean = (raw: string | undefined, max: number): string | null => {
  if (raw === undefined) return null;
  const value = cleanText(plainText(raw), max);
  return value === "" ? null : value;
};

export function extractMeta(html: string, now: Date = new Date()): PageMeta {
  const limit = html.slice(0, HEAD_MAX);
  const end = limit.search(/<\/head\s*>/i);
  const head = end === -1 ? limit : limit.slice(0, end);

  const meta: Record<string, string> = {};
  for (const [tag] of head.matchAll(/<meta\b[^<>]*>/gi)) {
    const attrs = parseAttributes(tag.slice(5, tag.endsWith("/>") ? -2 : -1));
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key !== "" && attrs.content !== undefined && !Object.hasOwn(meta, key)) meta[key] = attrs.content;
  }
  const titleTag = /<title\b[^<>]*>([^<]{1,1000})<\/title>/i.exec(head)?.[1];

  const pick = (keys: string[]) => keys.map((k) => meta[k]).find((v) => v !== undefined && v.trim() !== "");

  const description = clean(pick(["og:description", "twitter:description", "description"]), SUMMARY_MAX);
  return {
    title: clean(pick(["og:title", "twitter:title"]) ?? titleTag, TITLE_MAX),
    description: description && !isGenericDescription(description) ? description : null,
    published: parseDate(pick(["article:published_time"]) ?? null, now),
  };
}
