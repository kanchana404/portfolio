/**
 * Escape the five XML predefined entities.
 *
 * Slugs are kebab-case so today nothing in a sitemap URL needs escaping, which
 * is exactly why it would be forgotten on the day a URL first contains an
 * ampersand and the whole sitemap becomes unparseable. The RSS feed carries
 * post titles and summaries, where it matters every week.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * True for code points XML 1.0 forbids even when escaped: C0 controls other
 * than tab, LF and CR, lone surrogates, U+FFFE and U+FFFF. One of them makes
 * the whole document unparseable. A numeric test rather than a character
 * class, for the reason given at `isControlCodePoint` in src/lib/og.ts.
 */
function isForbiddenInXml(code: number): boolean {
  return (
    (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
    (code >= 0xd800 && code <= 0xdfff) ||
    code === 0xfffe ||
    code === 0xffff
  );
}

/** Text for an XML element or attribute: forbidden code points dropped, then escaped. */
export function xmlText(value: string): string {
  let kept = "";
  // Iterating the string walks whole code points, so a valid surrogate pair
  // arrives as one astral code point and only a lone half is dropped.
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code !== undefined && !isForbiddenInXml(code)) kept += ch;
  }
  return escapeXml(kept);
}
