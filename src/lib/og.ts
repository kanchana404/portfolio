import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Shared contract for the dynamic OG card at `/og`.
 *
 * Every caller must build its URL through `ogImageUrl()` rather than
 * hand-writing `${SITE_URL}/og?title=...`. The reason is the cache policy: the
 * route answers with `immutable, max-age=1y`, so once a crawler or Slack has
 * fetched a given URL it will never re-fetch it. If the card's *design* changes
 * the only way to invalidate is to change the URL, and "remember to update the
 * callers" is not an invalidation strategy — it is a bug with a delay on it.
 *
 * Bumping OG_VERSION changes every generated URL at once, which is the whole
 * point of routing callers through here.
 */
const OG_VERSION = 1;

export type OgKind = "blog" | "tool";

/** Longest title we will render. Bounds satori's work per request. */
export const OG_TITLE_MAX = 110;

/**
 * True for C0 controls, DEL, and the C1 range.
 *
 * Written as an explicit codepoint test rather than a regex character class on
 * purpose. A control-character class is normally written as a range between two
 * escape sequences; if either escape is corrupted in transit the class silently
 * degenerates into a range over printable ASCII punctuation and starts eating
 * real characters out of real titles. Numeric comparisons cannot fail that way.
 */
function isControlCodePoint(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

/**
 * Normalise a title for the card.
 *
 * Control characters become spaces and runs of whitespace collapse before the
 * length clamp, so `"a\n\n\n\nb"` does not spend the budget on newlines and a
 * whitespace-only title cannot reach the renderer.
 *
 * Exported because the route applies the identical transform to whatever
 * actually arrives on the wire. The URL a caller builds and the URL an attacker
 * types must collapse to the same cache key whenever they produce the same
 * visible output — otherwise the clamp bounds the cost of one render but not the
 * number of distinct renders.
 */
export function normaliseOgTitle(raw: string): string {
  let stripped = "";
  // Iterating the string (not indexing it) walks whole code points, so an emoji
  // or any astral character is never split into lone surrogates.
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    stripped += code !== undefined && isControlCodePoint(code) ? " " : ch;
  }

  const cleaned = stripped.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return SITE_NAME;

  if (cleaned.length <= OG_TITLE_MAX) return cleaned;
  // Slice by code point, not by UTF-16 unit, so the clamp cannot cut an emoji in
  // half and leave an unpaired surrogate in the cache key.
  return `${[...cleaned].slice(0, OG_TITLE_MAX).join("").trimEnd()}…`;
}

/** Absolute, cache-busted URL for a dynamic OG card. */
export function ogImageUrl(kind: OgKind, title: string): string {
  const params = new URLSearchParams({
    kind,
    title: normaliseOgTitle(title),
    v: String(OG_VERSION),
  });
  return `${SITE_URL}/og?${params.toString()}`;
}
