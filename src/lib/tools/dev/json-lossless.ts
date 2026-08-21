/**
 * Re-emitting JSON without going through JavaScript numbers.
 *
 * `JSON.parse` is the wrong tool for a *formatter*. It produces JS values, and
 * a JS number is a float64:
 *
 *     JSON.parse('{"id":12345678901234567890}')  ->  12345678901234568000
 *     JSON.parse('1e400')                        ->  Infinity -> null on stringify
 *
 * Anything past 2^53 comes back altered, and it comes back looking perfectly
 * fine — no error, no warning, just different digits. Snowflake ids, database
 * bigints and Stripe identifiers all live in that range, so "pretty-print my
 * API response" quietly returned corrupted data.
 *
 * A formatter's job is to re-arrange text, not to evaluate it. This walks the
 * source and copies every number through **verbatim**, so the output differs
 * from the input only in whitespace and key order.
 *
 * `JSON.parse` is still used for validation in json-format.ts, because its error
 * messages are the product there. This module is only reached once the source is
 * known to be valid, which is why its own errors are terse: they should be
 * unreachable, and if one ever fires it is a bug here, not bad input.
 */

export type JsonNode =
  | { kind: "raw"; text: string }
  | { kind: "string"; text: string }
  | { kind: "array"; items: JsonNode[] }
  | { kind: "object"; entries: Array<{ key: string; value: JsonNode }> };

class Reader {
  index = 0;
  constructor(readonly src: string) {}

  ws(): void {
    while (this.index < this.src.length && /[\s]/.test(this.src[this.index]!)) this.index++;
  }
  peek(): string {
    return this.src[this.index] ?? "";
  }
  take(expected: string): void {
    if (this.src[this.index] !== expected) {
      throw new Error(`expected ${expected} at ${this.index}`);
    }
    this.index++;
  }
}

/** A JSON string token, copied verbatim including its quotes and escapes. */
function readString(r: Reader): string {
  const start = r.index;
  r.take('"');
  while (r.index < r.src.length) {
    const ch = r.src[r.index]!;
    if (ch === "\\") {
      // Skip the escape and whatever it escapes, so a \" does not end the string.
      r.index += 2;
      continue;
    }
    r.index++;
    if (ch === '"') return r.src.slice(start, r.index);
  }
  throw new Error("unterminated string");
}

function readValue(r: Reader): JsonNode {
  r.ws();
  const ch = r.peek();

  if (ch === "{") {
    r.take("{");
    const entries: Array<{ key: string; value: JsonNode }> = [];
    r.ws();
    if (r.peek() === "}") {
      r.take("}");
      return { kind: "object", entries };
    }
    for (;;) {
      r.ws();
      const key = readString(r);
      r.ws();
      r.take(":");
      entries.push({ key, value: readValue(r) });
      r.ws();
      if (r.peek() === ",") {
        r.take(",");
        continue;
      }
      r.take("}");
      return { kind: "object", entries };
    }
  }

  if (ch === "[") {
    r.take("[");
    const items: JsonNode[] = [];
    r.ws();
    if (r.peek() === "]") {
      r.take("]");
      return { kind: "array", items };
    }
    for (;;) {
      items.push(readValue(r));
      r.ws();
      if (r.peek() === ",") {
        r.take(",");
        continue;
      }
      r.take("]");
      return { kind: "array", items };
    }
  }

  if (ch === '"') return { kind: "string", text: readString(r) };

  // Numbers, true, false, null — all copied through untouched. This is the
  // whole point of the module: the bytes that came in are the bytes that go out.
  const start = r.index;
  while (r.index < r.src.length && !/[\s,\]}]/.test(r.src[r.index]!)) r.index++;
  const text = r.src.slice(start, r.index);
  if (!text) throw new Error(`empty value at ${start}`);
  return { kind: "raw", text };
}

export function parseLossless(source: string): JsonNode {
  const r = new Reader(source);
  const node = readValue(r);
  r.ws();
  if (r.index !== source.length) throw new Error(`trailing input at ${r.index}`);
  return node;
}

function sortEntries(node: JsonNode): JsonNode {
  if (node.kind === "object") {
    return {
      kind: "object",
      entries: [...node.entries]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((e) => ({ key: e.key, value: sortEntries(e.value) })),
    };
  }
  if (node.kind === "array") {
    return { kind: "array", items: node.items.map(sortEntries) };
  }
  return node;
}

/** `indent` of "" means minified. */
export function emit(node: JsonNode, indent: string, depth = 0): string {
  const nl = indent ? "\n" : "";
  const pad = indent ? indent.repeat(depth + 1) : "";
  const closePad = indent ? indent.repeat(depth) : "";
  const colon = indent ? ": " : ":";

  if (node.kind === "object") {
    if (node.entries.length === 0) return "{}";
    const body = node.entries
      .map((e) => `${pad}${e.key}${colon}${emit(e.value, indent, depth + 1)}`)
      .join(`,${nl}`);
    return `{${nl}${body}${nl}${closePad}}`;
  }
  if (node.kind === "array") {
    if (node.items.length === 0) return "[]";
    const body = node.items
      .map((item) => `${pad}${emit(item, indent, depth + 1)}`)
      .join(`,${nl}`);
    return `[${nl}${body}${nl}${closePad}]`;
  }
  return node.text;
}

export function reformat(source: string, indent: string, sortKeys = false): string {
  const tree = parseLossless(source);
  return emit(sortKeys ? sortEntries(tree) : tree, indent);
}
