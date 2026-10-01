import { decodeEntities } from "./xml";

/**
 * Every string that comes out of a feed or a web page is untrusted: a stranger
 * may have written it, and Codex reads it. So it is made plain before it is
 * stored: HTML removed, lengths capped, and the invisible characters that hide
 * text from a human reviewer (the Unicode tag block, bidi controls, zero-width
 * characters) deleted. Nothing here executes or fetches anything.
 *
 * Every scan moves forward, so the cost stays linear on hostile input. Pure;
 * the tsx CLIs load it without the `@/` alias.
 */

export const TITLE_MAX = 200;
export const SUMMARY_MAX = 600;
export const URL_MAX = 500;
export const ERROR_MAX = 200;

/** Elements whose content is never text a reader would see. */
const DROP_BLOCKS = ["script", "style", "noscript", "template", "svg", "iframe", "object", "form", "head"];

function dropBlocks(html: string): string {
  const open = new RegExp(`<(${DROP_BLOCKS.join("|")})(?=[\\s/>])`, "gi");
  let out = "";
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = open.exec(html))) {
    out += html.slice(i, match.index);
    const close = new RegExp(`</${match[1]}\\s*>`, "gi");
    close.lastIndex = match.index;
    const end = close.exec(html);
    if (!end) return out;
    i = end.index + end[0].length;
    open.lastIndex = i;
  }
  return out + html.slice(i);
}

/** A line break or the end of a block: a space, so the words on either side stay apart. */
const BREAK_TAG = /<br\s*\/?>|<\/(?:p|div|li|ul|ol|h[1-6]|tr|td|th|blockquote|pre|figure|figcaption|section|article)\s*>/gi;

function stripTags(html: string): string {
  return html.replace(BREAK_TAG, " ").replace(/<[^<>]*>/g, "");
}

/**
 * The elements a double-escaped feed sends as text (`&lt;p&gt;`), in lower
 * or upper case. Only these are removed once entities are decoded: anything
 * else in angle brackets was text all along, such as a command's `<flag>`
 * or a component's `<Image>`. Names a command line uses for its arguments
 * (input, output, path, source, template, title) are left out on purpose.
 */
const ESCAPED_TAG =
  /<\/?(?:a|abbr|b|blockquote|br|code|dd|del|div|dl|dt|em|figcaption|figure|h[1-6]|hr|i|img|ins|li|mark|ol|p|pre|s|section|article|small|span|strong|sub|sup|table|tbody|td|th|thead|tr|u|ul|A|ABBR|B|BLOCKQUOTE|BR|CODE|DIV|EM|H[1-6]|I|IMG|LI|OL|P|PRE|SPAN|STRONG|UL)(?:\s[^<>]*)?\/?>/g;

/**
 * Text that may still carry a layer of escaping or escaped markup (a feed
 * value once HTML is removed, or a page's attribute value) made plain: the
 * common elements removed, entities decoded, and any `<` or `>` left over
 * turned into ‹ and ›, so `<flag>` keeps its meaning and the result can never
 * be read as markup.
 */
export function plainText(text: string): string {
  return decodeEntities(text.replace(BREAK_TAG, " ").replace(ESCAPED_TAG, ""))
    .replace(/</g, "‹")
    .replace(/>/g, "›");
}

/** HTML to plain text: markup removed, entities decoded, then plainText for a double-escaped feed. */
export function htmlToText(html: string): string {
  return plainText(decodeEntities(stripTags(dropBlocks(html))));
}

/** Inline formatting a feed title sometimes carries: removed, other angle-bracket text kept. */
export function stripInlineTags(title: string): string {
  return title.replace(/<\/?(?:b|i|em|strong|code|span|a|sup|sub|mark|small)(?:\s[^<>]*)?>/gi, "");
}

/**
 * Characters that are invisible or reorder text: C0 and C1 controls, soft
 * hyphen, bidi marks and embeddings, zero-width characters, word joiners and
 * invisible operators, the byte-order mark, interlinear annotation marks, the
 * Unicode tag block, the variation-selector supplement and every private-use
 * plane. A numeric test rather than a character class, for the reason given
 * at `isControlCodePoint` in src/lib/og.ts.
 */
export function isHiddenCodePoint(code: number): boolean {
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0xad ||
    code === 0x61c ||
    code === 0x180e ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x206f) ||
    code === 0xfeff ||
    (code >= 0xfff9 && code <= 0xfffb) ||
    (code >= 0xe000 && code <= 0xf8ff) ||
    (code >= 0xe0000 && code <= 0xe007f) ||
    (code >= 0xe0100 && code <= 0xe01ef) ||
    code >= 0xf0000
  );
}

/** Whitespace a line break or tab becomes: kept as a space rather than deleted. */
const isBreak = (code: number) => code === 0x09 || code === 0x0a || code === 0x0d || code === 0x2028 || code === 0x2029;

/**
 * One line of plain text: NFC, hidden characters removed, whitespace
 * collapsed, and cut to `max` code points on a word boundary with an ellipsis.
 * Never splits a surrogate pair.
 */
export function cleanText(s: string, max: number): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0;
    if (isBreak(code)) out += " ";
    else if (!isHiddenCodePoint(code)) out += ch;
  }
  const collapsed = out.replace(/\s+/g, " ").trim();
  const points = [...collapsed];
  if (points.length <= max) return collapsed;
  const cut = points.slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

/**
 * The first sentences of a longer text, up to SUMMARY_MAX. A sentence ends at
 * `.`, `!` or `?` followed by whitespace, so "Sonnet 5.5" and "v1.2" stay
 * whole. Null when nothing is left.
 */
export function summarizeContent(text: string): string | null {
  const clean = cleanText(text, 10_000);
  if (clean === "") return null;
  if ([...clean].length <= SUMMARY_MAX) return clean;
  let out = "";
  for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
    const next = out === "" ? sentence : `${out} ${sentence}`;
    if ([...next].length > SUMMARY_MAX) break;
    out = next;
  }
  return out || cleanText(clean, SUMMARY_MAX);
}

/**
 * Site-wide or template descriptions that say nothing about the page: the
 * item is better off with no summary than with one of these.
 */
const GENERIC_DESCRIPTIONS: RegExp[] = [
  /^A Blog post by .{1,80} on Hugging Face$/i,
  /^We.re on a journey to advance and democratize artificial intelligence/i,
];

export function isGenericDescription(text: string): boolean {
  return GENERIC_DESCRIPTIONS.some((re) => re.test(text.trim()));
}

/**
 * WordPress's "The post … appeared first on …" footer, and a trailing "[…]" or
 * "Read more". Whitespace is collapsed first: `\s*` in front of a pattern
 * would rescan a long run of spaces from every position in it.
 */
export function stripBoilerplate(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s*The post .{1,300}? appeared first on .{1,120}?\.?\s*$/s, "")
    .replace(/\s*(?:\[(?:…|\.\.\.)\]|Read more\.?|Continue reading\.?)\s*$/i, "")
    .trim();
}

/** Tracking parameters removed from every link. */
const TRACKING = /^(?:utm_[a-z_]+|ref|ref_src|fbclid|gclid|mc_cid|mc_eid)$/i;

/**
 * A link a post may use: https, no user name or password, at most URL_MAX
 * characters, tracking parameters and the hash removed, and starting with one
 * of the source's `include` prefixes. Null otherwise.
 */
export function cleanUrl(raw: string | null, base: string, include: readonly string[]): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING.test(key)) url.searchParams.delete(key);
  }
  const out = url.toString();
  if (out.length > URL_MAX) return null;
  if (!include.some((prefix) => out.startsWith(prefix))) return null;
  // Characters a link must never carry into Markdown. Parentheses are
  // escaped rather than refused, so `[text](url)` stays one link.
  if (/[\s<>"`\\]/.test(out)) return null;
  return out.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

/** A key for "the same page": lowercase host without www., no trailing slash, sorted query. */
export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const params = [...u.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const query = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : "";
    return `${host}${u.pathname.replace(/\/+$/, "")}${query}`;
  } catch {
    return url;
  }
}

/** A key for "the same story" across sources: lowercase letters and digits, single spaces. */
export function normalizeTitleKey(title: string): string {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
