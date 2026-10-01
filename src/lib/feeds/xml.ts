/**
 * A small reader for RSS 2.0, RSS 1.0, Atom and sitemaps, with no dependency.
 *
 * It never executes anything and never expands a DTD: comments, processing
 * instructions and the DOCTYPE (internal subset included) are dropped before
 * anything is read, so an entity-expansion bomb is just text that disappears.
 * Every scan moves forward with indexOf, so an unclosed comment, CDATA section
 * or item ends the scan instead of rescanning the rest of the input for each
 * one, and an open tag is matched only up to the next `<`, which a start tag
 * cannot contain: the cost stays linear in the input, which http.ts caps in
 * bytes. xml.test.ts times the hostile cases.
 *
 * Honest limits:
 * - It is not a conforming XML parser. Malformed entries are dropped, not
 *   repaired.
 * - Namespace prefixes are matched literally (`dc:date`, `content:encoded`),
 *   as every feed in sources.ts writes them.
 * - `xml:base` is ignored; links resolve against the feed's URL.
 * - For nested elements of the same name the first one wins (an Atom
 *   `<source><title>` before the entry's own title would be read instead).
 *
 * An entry's title, summary and content come back as HTML, for sanitize.ts
 * and collect.ts to turn into text: RSS values and Atom `type="html"` values
 * entity-decoded once (CDATA verbatim), an Atom text construct escaped as
 * HTML so its `<Suspense>` stays text, and Atom `type="xhtml"` as the markup
 * it is (a title with its tags removed). Pure; the tsx CLIs load it without
 * `@/`.
 */

export interface RawEntry {
  /** HTML; see above. */
  title: string | null;
  link: string | null;
  /** ISO 8601 in UTC, or null when missing, unparseable or in the future. */
  date: string | null;
  /** HTML; see above. */
  summary: string | null;
  /** HTML; see above. */
  content: string | null;
}

export interface SitemapUrl {
  loc: string;
  /** ISO 8601 in UTC, or null. */
  lastmod: string | null;
}

/** A date more than this far ahead of the clock is a feed bug, not a post. */
const FUTURE_SLACK_MS = 2 * 86_400_000;

const CDATA_OPEN = "";
const CDATA_CLOSE = "";

/** Private-use characters, removed from the input so the CDATA markers cannot be forged. */
function stripPrivateUse(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0xe000 && code <= 0xf8ff) continue;
    out += ch;
  }
  return out;
}

/** Bytes to text: a byte-order mark first, then the `<?xml encoding?>` label, else UTF-8. */
export function decodeXmlBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  let head = "";
  for (let i = 0; i < Math.min(bytes.length, 200); i++) head += String.fromCharCode(bytes[i]);
  const label = /^\s*<\?xml[^>]*?\bencoding\s*=\s*["']([A-Za-z0-9._-]{1,40})["']/.exec(head)?.[1];
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(label ?? "utf-8");
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  return decoder.decode(bytes);
}

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  times: "×",
  eacute: "é",
};

/** A numeric reference a document may carry: no C0 control but tab and newlines, no surrogate, no NUL. */
function allowedReference(code: number): boolean {
  if (!Number.isInteger(code) || code > 0x10ffff) return false;
  if (code >= 0xd800 && code <= 0xdfff) return false;
  if (code < 0x20) return code === 0x09 || code === 0x0a || code === 0x0d;
  return true;
}

/**
 * The five XML entities, decimal and hex references, and a small set of HTML
 * names feeds use. An invalid reference becomes U+FFFD; an unknown name is
 * left as it is.
 */
export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]{1,8}|#[0-9]{1,9}|[A-Za-z][A-Za-z0-9]{1,31});/g, (whole, ref: string) => {
    if (ref.startsWith("#")) {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return allowedReference(code) ? String.fromCodePoint(code) : "�";
    }
    return Object.hasOwn(XML_ENTITIES, ref) ? XML_ENTITIES[ref] : whole;
  });
}

/**
 * Comments, processing instructions and the DOCTYPE dropped; each CDATA
 * section swapped for a private-use marker, its raw text kept aside. One
 * forward pass: whichever construct opens first is the one handled, and an
 * unclosed one ends the document.
 */
function prepare(xml: string): { text: string; cdata: string[] } {
  const source = stripPrivateUse(xml);
  const cdata: string[] = [];
  const open = /<!--|<!\[CDATA\[|<\?|<!DOCTYPE/gi;
  let out = "";
  let i = 0;
  while (i < source.length) {
    open.lastIndex = i;
    const match = open.exec(source);
    if (!match) {
      out += source.slice(i);
      break;
    }
    out += source.slice(i, match.index);
    const token = match[0];
    if (token === "<!--") {
      const end = source.indexOf("-->", match.index + 4);
      if (end === -1) break;
      i = end + 3;
    } else if (token.startsWith("<![")) {
      const start = match.index + token.length;
      const end = source.indexOf("]]>", start);
      if (end === -1) break;
      cdata.push(source.slice(start, end));
      out += `${CDATA_OPEN}${cdata.length - 1}${CDATA_CLOSE}`;
      i = end + 3;
    } else if (token === "<?") {
      const end = source.indexOf("?>", match.index + 2);
      if (end === -1) break;
      i = end + 2;
    } else {
      // <!DOCTYPE name [ internal subset ]>: the subset may hold '>' inside
      // its declarations, so it ends at the first ']' followed by '>'.
      const gt = source.indexOf(">", match.index);
      const bracket = source.indexOf("[", match.index);
      if (gt === -1) break;
      if (bracket !== -1 && bracket < gt) {
        const close = /\]\s*>/g;
        close.lastIndex = bracket;
        const end = close.exec(source);
        if (!end) break;
        i = end.index + end[0].length;
      } else {
        i = gt + 1;
      }
    }
  }
  return { text: out, cdata };
}

/** Text content: CDATA restored verbatim, everything else entity-decoded. */
function valueOf(raw: string, cdata: string[]): string {
  return restore(raw, cdata, decodeEntities, (text) => text);
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Markup as it is, entities still escaped, and each CDATA section escaped as HTML text: XHTML content. */
function markupOf(raw: string, cdata: string[]): string {
  return restore(raw, cdata, (text) => text, escapeHtml);
}

function restore(raw: string, cdata: string[], outside: (s: string) => string, inside: (s: string) => string): string {
  const marker = new RegExp(`${CDATA_OPEN}(\\d+)${CDATA_CLOSE}`, "g");
  let out = "";
  let last = 0;
  for (const match of raw.matchAll(marker)) {
    out += outside(raw.slice(last, match.index));
    out += inside(cdata[Number(match[1])] ?? "");
    last = (match.index ?? 0) + match[0].length;
  }
  return (out + outside(raw.slice(last))).trim();
}

const escapeName = (name: string) => name.replace(/[.:-]/g, (c) => `\\${c}`);

interface Element {
  attrs: string;
  /** Null for a self-closing element. */
  inner: string | null;
}

/**
 * The first child element with exactly this qualified name: `<title` must be
 * followed by whitespace, `>` or `/`, so `<media:title>` and `<titles>` never
 * count as `<title>`.
 */
function firstElement(block: string, name: string): Element | undefined {
  const open = new RegExp(`<${escapeName(name)}(?=[\\s/>])([^<>]*)>`, "g");
  const match = open.exec(block);
  if (!match) return undefined;
  const attrs = match[1];
  if (attrs.trimEnd().endsWith("/")) return { attrs: attrs.trimEnd().slice(0, -1), inner: null };
  const start = match.index + match[0].length;
  const end = block.indexOf(`</${name}>`, start);
  if (end === -1) return undefined;
  return { attrs, inner: block.slice(start, end) };
}

/** Every element with this name, self-closing or not, in document order. */
function allElements(block: string, name: string): Element[] {
  const found: Element[] = [];
  const open = new RegExp(`<${escapeName(name)}(?=[\\s/>])([^<>]*)>`, "g");
  let match: RegExpExecArray | null;
  while ((match = open.exec(block))) {
    const attrs = match[1];
    if (attrs.trimEnd().endsWith("/")) {
      found.push({ attrs: attrs.trimEnd().slice(0, -1), inner: null });
      continue;
    }
    const start = match.index + match[0].length;
    const end = block.indexOf(`</${name}>`, start);
    if (end === -1) break;
    found.push({ attrs, inner: block.slice(start, end) });
    open.lastIndex = end;
  }
  return found;
}

/**
 * Attribute values by lowercase name, in either quote style; later duplicates
 * are ignored. A name starts only where a run of name characters starts, so a
 * long run with no `=` is scanned once, not once per character.
 */
export function parseAttributes(attrs: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(?<![-A-Za-z0-9_:.])([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of attrs.matchAll(re)) {
    const key = match[1].toLowerCase();
    if (!Object.hasOwn(out, key)) out[key] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return out;
}

function text(block: string, names: string[], cdata: string[]): string | null {
  for (const name of names) {
    const element = firstElement(block, name);
    if (element?.inner === undefined || element.inner === null) continue;
    const value = valueOf(element.inner, cdata);
    if (value !== "") return value;
  }
  return null;
}

/** Date.parse reads RFC 822 (zone names included) and ISO 8601. */
export function parseDate(raw: string | null, now: Date = new Date()): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw.trim());
  if (Number.isNaN(ms) || ms > now.getTime() + FUTURE_SLACK_MS) return null;
  return new Date(ms).toISOString();
}

function resolve(href: string, base: string): string | null {
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return null;
  }
}

/** The name of the document's first element, `rss`, `feed`, `urlset` and so on. */
function rootName(text: string): string {
  return /<([A-Za-z_][\w.:-]*)/.exec(text)?.[1] ?? "";
}

/**
 * Up to `max` blocks of `<name …>…</name>`, in order, with the open tag's
 * attributes. An unclosed one ends the scan, which keeps the cost linear on
 * hostile input.
 */
function blocks(text: string, names: string[], max: number): { attrs: string; inner: string }[] {
  const out: { attrs: string; inner: string }[] = [];
  const open = new RegExp(`<(${names.map(escapeName).join("|")})(?=[\\s>])([^<>]*)>`, "g");
  let match: RegExpExecArray | null;
  while (out.length < max && (match = open.exec(text))) {
    if (match[2].trimEnd().endsWith("/")) continue;
    const close = `</${match[1]}>`;
    const start = match.index + match[0].length;
    const end = text.indexOf(close, start);
    if (end === -1) break;
    out.push({ attrs: match[2], inner: text.slice(start, end) });
    open.lastIndex = end + close.length;
  }
  return out;
}

/**
 * An Atom text construct as HTML: `type="html"` decoded once, `type="xhtml"`
 * as its markup (with the tags removed for a title), and plain text escaped.
 * Null for a missing or empty one, or a media type that is not text.
 */
function atomText(block: string, name: string, cdata: string[], isTitle = false): string | null {
  const element = firstElement(block, name);
  if (element?.inner === undefined || element.inner === null) return null;
  const type = (parseAttributes(element.attrs).type ?? "text").toLowerCase();
  let value: string;
  if (type === "html" || type === "text/html") value = valueOf(element.inner, cdata);
  else if (type === "xhtml" || type === "application/xhtml+xml") {
    const markup = markupOf(element.inner, cdata);
    value = isTitle ? markup.replace(/<[^<>]*>/g, "").trim() : markup;
  } else if (type === "text" || type.startsWith("text/")) value = escapeHtml(valueOf(element.inner, cdata));
  else return null;
  return value === "" ? null : value;
}

function atomLink(block: string, base: string): string | null {
  let best: { href: string; rank: number } | undefined;
  for (const { attrs } of allElements(block, "link")) {
    const a = parseAttributes(attrs);
    if (!a.href) continue;
    const rel = (a.rel ?? "alternate").toLowerCase();
    if (rel !== "alternate") continue;
    const type = (a.type ?? "").toLowerCase();
    const rank = type === "text/html" ? 0 : type === "" ? 1 : 2;
    if (!best || rank < best.rank) best = { href: a.href, rank };
  }
  return best ? resolve(best.href, base) : null;
}

function rssLink(block: string, attrs: string, base: string, cdata: string[]): string | null {
  const link = text(block, ["link"], cdata);
  if (link) return resolve(link, base);
  const guid = firstElement(block, "guid");
  if (guid?.inner) {
    const permalink = (parseAttributes(guid.attrs).ispermalink ?? "true").toLowerCase() !== "false";
    const value = valueOf(guid.inner, cdata);
    if (permalink && value.startsWith("https://")) return resolve(value, base);
  }
  const about = parseAttributes(attrs)["rdf:about"];
  return about ? resolve(about, base) : null;
}

export function parseFeed(
  xml: string,
  baseUrl: string,
  maxEntries: number,
  now: Date = new Date()
): { kind: "rss" | "atom" | "unknown"; entries: RawEntry[] } {
  const { text: doc, cdata } = prepare(xml);
  const root = rootName(doc);
  const kind = root === "rss" || root === "rdf:RDF" ? "rss" : root === "feed" ? "atom" : "unknown";
  if (kind === "unknown") return { kind, entries: [] };

  const entries: RawEntry[] = [];
  for (const { attrs, inner: block } of blocks(doc, [kind === "atom" ? "entry" : "item"], maxEntries)) {
    if (kind === "atom") {
      entries.push({
        title: atomText(block, "title", cdata, true),
        link: atomLink(block, baseUrl),
        date: parseDate(text(block, ["published", "updated"], cdata), now),
        summary: atomText(block, "summary", cdata),
        content: atomText(block, "content", cdata),
      });
    } else {
      entries.push({
        title: text(block, ["title"], cdata),
        link: rssLink(block, attrs, baseUrl, cdata),
        date: parseDate(text(block, ["pubDate", "dc:date", "published", "updated"], cdata), now),
        summary: text(block, ["description", "summary"], cdata),
        content: text(block, ["content:encoded"], cdata),
      });
    }
  }
  return { kind, entries };
}

export function parseSitemap(
  xml: string,
  maxEntries: number,
  now: Date = new Date()
): { kind: "urlset" | "sitemapindex" | "unknown"; urls: SitemapUrl[] } {
  const { text: doc, cdata } = prepare(xml);
  const root = rootName(doc);
  if (root !== "urlset" && root !== "sitemapindex") return { kind: "unknown", urls: [] };
  const urls: SitemapUrl[] = [];
  for (const { inner: block } of blocks(doc, [root === "urlset" ? "url" : "sitemap"], maxEntries)) {
    const loc = text(block, ["loc"], cdata);
    if (!loc) continue;
    urls.push({ loc, lastmod: parseDate(text(block, ["lastmod"], cdata), now) });
  }
  return { kind: root, urls };
}
