/**
 * CSV ⇄ JSON.
 *
 * The parser is a character scanner rather than `text.split("\n").map(l =>
 * l.split(","))`, and that is the whole difference between a converter that
 * works and one that quietly corrupts data.
 *
 * A quoted CSV field may contain the delimiter, a double quote (escaped by
 * doubling it), **and a literal newline**. Splitting on newlines first destroys
 * any row with an address or a description in it, and the damage is silent —
 * you get plausible-looking rows with the wrong number of columns.
 */

export type Delimiter = "," | ";" | "\t" | "|";

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  /** Rows whose column count disagrees with the header. */
  warnings: string[];
  delimiter: Delimiter;
  error: string | null;
}

/**
 * Guess the delimiter from the first few lines.
 *
 * Counting occurrences is not enough on its own — prose full of commas would
 * win. Consistency across lines is the better signal: a real delimiter appears
 * the same number of times in every row.
 */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 5);
  if (sample.length === 0) return ",";

  const candidates: Delimiter[] = [",", ";", "\t", "|"];
  let best: { delimiter: Delimiter; score: number } = { delimiter: ",", score: -1 };

  for (const delimiter of candidates) {
    const counts = sample.map((line) => line.split(delimiter).length - 1);
    const total = counts.reduce((s, n) => s + n, 0);
    if (total === 0) continue;
    const first = counts[0];
    const consistent = counts.every((c) => c === first) && first > 0;
    // Consistency dominates raw frequency.
    const score = (consistent ? 1000 : 0) + total;
    if (score > best.score) best = { delimiter, score };
  }

  return best.delimiter;
}

/** Full scan honouring quotes, escaped quotes and embedded newlines. */
export function parseCsv(text: string, forced?: Delimiter): CsvParseResult {
  const clean = text.replace(/^﻿/, ""); // strip a BOM Excel loves to add
  if (clean.trim().length === 0) {
    return { headers: [], rows: [], warnings: [], delimiter: forced ?? ",", error: null };
  }

  const delimiter = forced ?? detectDelimiter(clean);
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'; // an escaped quote
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch; // newlines inside quotes are data, not row breaks
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Consume CRLF as one break.
      if (ch === "\r" && clean[i + 1] === "\n") i += 1;
      record.push(field);
      field = "";
      records.push(record);
      record = [];
    } else {
      field += ch;
    }
  }

  record.push(field);
  if (record.length > 1 || record[0] !== "") records.push(record);

  if (inQuotes) {
    return {
      headers: [],
      rows: [],
      warnings: [],
      delimiter,
      error:
        "A quoted field is never closed — there is an odd number of double " +
        "quotes. Check for a stray quote, and remember a literal quote inside a " +
        'field is written by doubling it ("").',
    };
  }

  if (records.length === 0) {
    return { headers: [], rows: [], warnings: [], delimiter, error: null };
  }

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1);
  const warnings: string[] = [];

  rows.forEach((r, index) => {
    if (r.length !== headers.length) {
      warnings.push(
        `Row ${index + 2} has ${r.length} field${r.length === 1 ? "" : "s"} but the ` +
          `header has ${headers.length}. Missing values are filled with empty strings.`
      );
    }
  });

  const duplicates = headers.filter((h, i) => headers.indexOf(h) !== i);
  if (duplicates.length > 0) {
    warnings.push(
      `Duplicate column name${duplicates.length === 1 ? "" : "s"}: ${[
        ...new Set(duplicates),
      ].join(", ")}. In the JSON output the last one wins.`
    );
  }

  return { headers, rows, warnings, delimiter, error: null };
}

export interface ToJsonOptions {
  /** Turn "42" into 42 and "true" into true. */
  inferTypes: boolean;
}

/**
 * Coerce a cell.
 *
 * Deliberately conservative. A leading zero is preserved as a string, because
 * "007" and "01792" are phone numbers and postcodes far more often than they are
 * integers — and turning them into 7 and 1792 is the classic spreadsheet
 * data-loss bug.
 */
function coerce(value: string, inferTypes: boolean): string | number | boolean | null {
  if (!inferTypes) return value;
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+$/.test(trimmed) && !/^-?0\d/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isSafeInteger(n) ? n : value;
  }
  if (/^-?\d*\.\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

export function csvToJson(parsed: CsvParseResult, options: ToJsonOptions): string {
  const objects = parsed.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    parsed.headers.forEach((header, i) => {
      obj[header] = coerce(row[i] ?? "", options.inferTypes);
    });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

export type JsonToCsvResult =
  | { ok: true; csv: string; rows: number; columns: number }
  | { ok: false; error: string };

/** Escape a value for CSV output, quoting only when necessary. */
function escapeField(value: unknown, delimiter: string): string {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  const mustQuote =
    text.includes(delimiter) ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r") ||
    text !== text.trim();

  return mustQuote ? `"${text.replace(/"/g, '""')}"` : text;
}

export function jsonToCsv(source: string, delimiter: Delimiter = ","): JsonToCsvResult {
  if (source.trim().length === 0) {
    return { ok: true, csv: "", rows: 0, columns: 0 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "That is not valid JSON.",
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error:
        "CSV is a table, so the JSON needs to be an array of objects — one " +
        "object per row. A single object or a bare value has no rows to write.",
    };
  }

  if (parsed.length === 0) return { ok: true, csv: "", rows: 0, columns: 0 };

  // Union of keys across every row, in first-seen order, so a row that omits an
  // optional field still lines up under the right column.
  const headers: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return {
        ok: false,
        error: "Every item in the array must be an object — one row each.",
      };
    }
    for (const key of Object.keys(item)) {
      if (!headers.includes(key)) headers.push(key);
    }
  }

  const lines = [headers.map((h) => escapeField(h, delimiter)).join(delimiter)];
  for (const item of parsed as Array<Record<string, unknown>>) {
    lines.push(headers.map((h) => escapeField(item[h], delimiter)).join(delimiter));
  }

  return {
    ok: true,
    csv: lines.join("\n"),
    rows: parsed.length,
    columns: headers.length,
  };
}
