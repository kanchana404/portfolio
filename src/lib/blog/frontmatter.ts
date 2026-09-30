/**
 * Frontmatter for `content/blog/<slug>.md`, parsed with no dependency.
 *
 * The grammar is a strict subset of YAML: every file it accepts means the same
 * thing to a real YAML parser, and everything else is refused with a line
 * number. There are no anchors, block scalars, comments, indentation or type
 * coercion, so there is no YAML attack surface and nothing for an author (or an
 * agent drafting a post) to get subtly wrong. `2026-09-28` stays a string.
 *
 * ```
 * ---
 * title: "AI and dev news: week 40, 2026"
 * publishedAt: "2026-09-28"
 * tags: [ai, web-dev]
 * kind: digest
 * ---
 * ```
 *
 * Pure and import-free: the tsx CLIs load it without the `@/` alias.
 */

export class FrontmatterError extends Error {
  constructor(
    /** 1-based line in the file. */
    readonly line: number,
    message: string
  ) {
    super(message);
    this.name = "FrontmatterError";
  }
}

export type FrontmatterValue = string | string[];

/** Content lines between the two `---` fences. */
const MAX_LINES = 40;

// dotAll: without it `.` stops at U+2028, and the value check below would
// never see the line separator it exists to report.
const KEY_LINE = /^([a-z][A-Za-z0-9]{0,31}): (.*)$/s;
const EMPTY_KEY_LINE = /^[a-z][A-Za-z0-9]{0,31}:[ ]*$/;
const LIST_ITEM = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BARE = /^[A-Za-z0-9/][A-Za-z0-9._/-]*$/;

/**
 * Plain scalars a YAML 1.2 parser would read as null, a boolean or a number
 * rather than a string. Refused unquoted, so the subset promise holds.
 */
const YAML_TYPED =
  /^(?:null|Null|NULL|true|True|TRUE|false|False|FALSE|[0-9]+(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|0o[0-7]+|0x[0-9a-fA-F]+)$/;

/**
 * C0 controls, DEL and C1, plus the two Unicode line separators and a stray
 * byte-order mark. A numeric test rather than a character class, for the
 * reason given at `isControlCodePoint` in src/lib/og.ts.
 */
function isForbiddenCodePoint(code: number): boolean {
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0xfeff
  );
}

/** 1-based line of a UTF-16 index. */
function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 0x0a) line++;
  return line;
}

function parseQuoted(raw: string, line: number): string {
  if (raw.length < 2 || !raw.endsWith('"')) {
    throw new FrontmatterError(line, "a double-quoted value must end with its closing quote");
  }
  const inner = raw.slice(1, -1);
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "\\") {
      const next = inner[i + 1];
      if (next === '"' || next === "\\") {
        out += next;
        i++;
        continue;
      }
      throw new FrontmatterError(
        line,
        next === undefined
          ? "a double-quoted value must end with its closing quote"
          : `unsupported escape \\${next}; only \\" and \\\\ are allowed`
      );
    }
    if (ch === '"') {
      throw new FrontmatterError(line, 'unescaped double quote inside a value; write \\"');
    }
    const code = ch.codePointAt(0);
    if (code !== undefined && isForbiddenCodePoint(code)) {
      throw new FrontmatterError(line, "control or invisible character inside a value");
    }
    out += ch;
  }
  return out;
}

function parseList(raw: string, line: number): string[] {
  if (!raw.endsWith("]")) {
    throw new FrontmatterError(line, "a list must end with ]");
  }
  if (raw === "[]") return [];
  const items = raw.slice(1, -1).split(", ");
  for (const item of items) {
    if (!LIST_ITEM.test(item)) {
      throw new FrontmatterError(
        line,
        `list item "${item}": lowercase letters, digits and single hyphens, separated by ", "`
      );
    }
    if (YAML_TYPED.test(item)) {
      throw new FrontmatterError(line, `list item "${item}" would be read as a number by YAML`);
    }
  }
  return items;
}

function parseValue(raw: string, line: number): FrontmatterValue {
  if (raw.startsWith('"')) return parseQuoted(raw, line);
  if (raw.startsWith("'")) {
    throw new FrontmatterError(line, "use double quotes");
  }
  if (raw.startsWith("[")) return parseList(raw, line);
  if (!BARE.test(raw)) {
    throw new FrontmatterError(
      line,
      "values with spaces or punctuation must be in double quotes"
    );
  }
  if (YAML_TYPED.test(raw)) {
    throw new FrontmatterError(
      line,
      `YAML would read ${raw} as a number, boolean or null; put it in double quotes`
    );
  }
  return raw;
}

/**
 * Split a post into its frontmatter and body. Throws `FrontmatterError` at the
 * first problem. `bodyLine` is the 1-based file line where `body` starts, so
 * body checks can report file lines too.
 */
export function parseFrontmatter(source: string): {
  data: Record<string, FrontmatterValue>;
  body: string;
  bodyLine: number;
} {
  if (source.charCodeAt(0) === 0xfeff) {
    throw new FrontmatterError(1, "remove the byte-order mark at the start of the file");
  }
  const cr = source.indexOf("\r");
  if (cr !== -1) {
    throw new FrontmatterError(lineOf(source, cr), "use LF line endings");
  }
  const replacement = source.indexOf("�");
  if (replacement !== -1) {
    throw new FrontmatterError(lineOf(source, replacement), "the file is not valid UTF-8");
  }

  const lines = source.split("\n");
  if (lines[0] !== "---") {
    throw new FrontmatterError(1, "the file must start with a --- line");
  }
  const close = lines.indexOf("---", 1);
  if (close === -1) {
    throw new FrontmatterError(1, "no closing --- line after the frontmatter");
  }
  if (close > MAX_LINES + 1) {
    throw new FrontmatterError(
      MAX_LINES + 2,
      `the frontmatter is longer than ${MAX_LINES} lines`
    );
  }

  const data: Record<string, FrontmatterValue> = {};
  for (let i = 1; i < close; i++) {
    const text = lines[i];
    const line = i + 1;
    if (/^ *$/.test(text)) continue;
    if (text.includes("\t")) {
      throw new FrontmatterError(line, "tab character; use spaces");
    }
    if (text.startsWith(" ") || text.startsWith("- ")) {
      throw new FrontmatterError(line, "no indentation; write lists as tags: [a, b]");
    }
    if (EMPTY_KEY_LINE.test(text)) {
      throw new FrontmatterError(line, "empty value");
    }
    const match = KEY_LINE.exec(text);
    if (!match) {
      throw new FrontmatterError(
        line,
        'expected "key: value": a camelCase key, a colon and one space'
      );
    }
    const [, key, raw] = match;
    if (Object.hasOwn(data, key)) {
      throw new FrontmatterError(line, `duplicate key "${key}"`);
    }
    if (raw.startsWith(" ")) {
      throw new FrontmatterError(line, "exactly one space after the colon");
    }
    if (raw.endsWith(" ")) {
      throw new FrontmatterError(line, "trailing whitespace");
    }
    data[key] = parseValue(raw, line);
  }

  return {
    data,
    body: lines.slice(close + 1).join("\n"),
    bodyLine: close + 2,
  };
}
