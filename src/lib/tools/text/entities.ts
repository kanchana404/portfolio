/**
 * HTML entities, both directions.
 *
 * Encoding is the security-relevant half and it is smaller than people expect:
 * five characters cover it. `&` first, always, because encoding it after the
 * others would double-encode the ampersands they just produced and turn
 * `&lt;` into `&amp;lt;`.
 *
 * The set is `& < > " '`. Some guides list only the first three, which is
 * enough for text between tags and *not* enough inside an attribute: with
 * `title='...'` a bare apostrophe closes the attribute and everything after it
 * becomes markup. Escaping all five is correct in both positions, which is why
 * there is one function here rather than two.
 *
 * Decoding accepts the named forms, plus numeric and hex references, because
 * real HTML uses all three interchangeably.
 */

const ENCODE: Array<[RegExp, string]> = [
  // Ampersand first. Reversing these two lines double-encodes everything.
  [/&/g, "&amp;"],
  [/</g, "&lt;"],
  [/>/g, "&gt;"],
  [/"/g, "&quot;"],
  [/'/g, "&#39;"],
];

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  pound: "£",
  euro: "€",
  deg: "°",
  middot: "·",
};

export function encodeEntities(text: string): string {
  let out = text;
  for (const [pattern, replacement] of ENCODE) out = out.replace(pattern, replacement);
  return out;
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|\w+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      // Surrogates and out-of-range values would throw; leaving the reference
      // untouched is better than crashing on one bad entity in a long document.
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED[body.toLowerCase()];
    return named ?? whole;
  });
}

/** Every character that must be escaped, for the reference table. */
export const REQUIRED_ESCAPES: ReadonlyArray<{ char: string; entity: string; why: string }> = [
  { char: "&", entity: "&amp;", why: "Starts every entity, so it must be escaped first." },
  { char: "<", entity: "&lt;", why: "Opens a tag." },
  { char: ">", entity: "&gt;", why: "Closes a tag." },
  { char: '"', entity: "&quot;", why: "Ends a double-quoted attribute." },
  { char: "'", entity: "&#39;", why: "Ends a single-quoted attribute." },
];
