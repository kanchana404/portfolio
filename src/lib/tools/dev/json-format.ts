/**
 * JSON formatting and validation.
 *
 * The product here is the *error message*, not the pretty-printing. `JSON.parse`
 * throws a message that varies by engine and, in V8, reports a character offset
 * — "Unexpected token } in JSON at position 4172" — which is useless against a
 * 4,000-character single line. Turning that offset into a line and column, and
 * showing the offending line, is the entire difference between a tool that finds
 * the bug and a tool that confirms one exists.
 */

import { reformat } from "./json-lossless";

export interface JsonError {
  message: string;
  line: number;
  column: number;
  /** The offending source line, for display. */
  excerpt: string;
}

export type JsonResult =
  | { ok: true; value: string; bytesIn: number; bytesOut: number }
  | { ok: false; error: JsonError };

function locate(source: string, offset: number): { line: number; column: number; excerpt: string } {
  const upto = source.slice(0, Math.max(0, Math.min(offset, source.length)));
  const lines = upto.split(/\r\n|\r|\n/);
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  const allLines = source.split(/\r\n|\r|\n/);
  const excerpt = (allLines[line - 1] ?? "").slice(0, 200);
  return { line, column, excerpt };
}

/**
 * Work out where the parse failed.
 *
 * Engines disagree, and V8 alone emits two shapes depending on the error:
 *
 *   Expected double-quoted property name in JSON at position 8 (line 1 column 9)
 *   Unexpected token ',', ..."1, "b": , "c": 3"... is not valid JSON
 *
 * The second carries **no offset at all**, which is how a naive
 * `/at position (\d+)/` silently reports every such error as line 1 — the exact
 * failure this tool exists to prevent. Firefox uses "at line N column M" and
 * Safari something else again.
 *
 * Strategies are tried most-precise first, and each falls through cleanly.
 */
function locateError(
  source: string,
  message: string
): { line: number; column: number; excerpt: string } {
  // 1. The engine already did the work.
  const lineCol = /line (\d+) column (\d+)/i.exec(message);
  if (lineCol) {
    const line = Number(lineCol[1]);
    const allLines = source.split(/\r\n|\r|\n/);
    return {
      line,
      column: Number(lineCol[2]),
      excerpt: (allLines[line - 1] ?? "").slice(0, 200),
    };
  }

  // 2. A character offset we can convert.
  const position = /at position (\d+)/.exec(message);
  if (position) return locate(source, Number(position[1]));

  // 3. V8's snippet form. The excerpt between `..."` and `"...` is lifted
  //    verbatim from the source, so finding it recovers an offset the message
  //    declined to give. V8 centres the window on the offending token, so the
  //    midpoint is a far better guess than the start of the file.
  const snippet = /\.\.\."([\s\S]+?)"\.\.\./.exec(message);
  if (snippet) {
    const index = source.indexOf(snippet[1]);
    if (index !== -1) {
      return locate(source, index + Math.floor(snippet[1].length / 2));
    }
  }

  // 4. Nothing usable. Report the first line and let the engine's own message
  //    carry the detail rather than inventing a location.
  return {
    line: 1,
    column: 1,
    excerpt: source.split(/\r\n|\r|\n/)[0]?.slice(0, 200) ?? "",
  };
}

function toJsonError(source: string, err: unknown): JsonError {
  const raw = err instanceof Error ? err.message : String(err);
  const { line, column, excerpt } = locateError(source, raw);

  // Strip the engine's own position and line/column suffixes — they are about to
  // be replaced, and showing both invites the reader to trust the wrong one.
  const message = raw
    .replace(/\s*at position \d+\s*\(line \d+ column \d+\)/, "")
    .replace(/\s*at position \d+/, "")
    .replace(/\s*\(line \d+ column \d+\)/, "")
    .replace(/^JSON\.parse:\s*/, "");

  return { message, line, column, excerpt };
}

export type IndentStyle = 2 | 4 | "tab";

/** The emitter works in literal padding rather than JSON.stringify's number. */
function indentText(style: IndentStyle): string {
  return style === "tab" ? "\t" : " ".repeat(style);
}

/** Parse, then re-serialise with indentation. */
export function formatJson(source: string, indent: IndentStyle = 2): JsonResult {
  if (source.trim().length === 0) {
    return { ok: true, value: "", bytesIn: 0, bytesOut: 0 };
  }
  try {
    // Validate with JSON.parse — its error messages are this module's product —
    // but never serialise from the value it returns. A JS number is a float64,
    // so `{"id":12345678901234567890}` came back as ...567000 with no error at
    // all. `reformat` copies every number through from the source text.
    JSON.parse(source);
    const value = reformat(source, indentText(indent));
    return {
      ok: true,
      value,
      bytesIn: new TextEncoder().encode(source).length,
      bytesOut: new TextEncoder().encode(value).length,
    };
  } catch (err) {
    return { ok: false, error: toJsonError(source, err) };
  }
}

/** Parse, then re-serialise with no whitespace at all. */
export function minifyJson(source: string): JsonResult {
  if (source.trim().length === 0) {
    return { ok: true, value: "", bytesIn: 0, bytesOut: 0 };
  }
  try {
    JSON.parse(source);
    const value = reformat(source, "");
    return {
      ok: true,
      value,
      bytesIn: new TextEncoder().encode(source).length,
      bytesOut: new TextEncoder().encode(value).length,
    };
  } catch (err) {
    return { ok: false, error: toJsonError(source, err) };
  }
}

/**
 * Sort object keys recursively, then format.
 *
 * Useful for diffing two API responses that agree on content but not on key
 * order. Array order is preserved — reordering an array changes meaning.
 */
export function sortJsonKeys(source: string, indent: IndentStyle = 2): JsonResult {
  if (source.trim().length === 0) {
    return { ok: true, value: "", bytesIn: 0, bytesOut: 0 };
  }
  try {
    JSON.parse(source);
    const value = reformat(source, indentText(indent), true);
    return {
      ok: true,
      value,
      bytesIn: new TextEncoder().encode(source).length,
      bytesOut: new TextEncoder().encode(value).length,
    };
  } catch (err) {
    return { ok: false, error: toJsonError(source, err) };
  }
}

/** A one-line description of the parsed shape, for the results panel. */
export function describeJson(source: string): string | null {
  try {
    const parsed: unknown = JSON.parse(source);
    if (Array.isArray(parsed)) {
      return `array of ${parsed.length} item${parsed.length === 1 ? "" : "s"}`;
    }
    if (parsed === null) return "null";
    if (typeof parsed === "object") {
      const keys = Object.keys(parsed as object).length;
      return `object with ${keys} key${keys === 1 ? "" : "s"}`;
    }
    return typeof parsed;
  } catch {
    return null;
  }
}
