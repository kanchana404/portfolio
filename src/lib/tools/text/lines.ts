/**
 * Line-wise cleanup: deduplicate, sort, trim, strip blanks.
 *
 * The operations are ordinary. What is not ordinary, and what this file exists
 * to get right, is that **the order they run in changes the answer**, and the
 * order most tools use is the one that produces surprises.
 *
 * Trimming before deduplicating means `"a"` and `"a "` collapse into one entry.
 * Deduplicating first leaves both, because as strings they differ. Almost
 * everybody wants the first, and almost every naive implementation does the
 * second, because it applies the options in the order the checkboxes appear.
 *
 * So the pipeline is fixed here rather than left to the UI: trim, then drop
 * blanks, then deduplicate, then sort. Each step feeds the next in the order
 * that makes the result match what was asked for.
 */

export interface LineOptions {
  trim: boolean;
  removeBlank: boolean;
  deduplicate: boolean;
  /** Case-insensitive comparison for dedupe and sort. */
  ignoreCase: boolean;
  sort: "none" | "asc" | "desc";
  reverse: boolean;
}

export const DEFAULT_LINE_OPTIONS: LineOptions = {
  trim: true,
  removeBlank: true,
  deduplicate: true,
  ignoreCase: false,
  sort: "none",
  reverse: false,
};

export interface LineResult {
  text: string;
  before: number;
  after: number;
  removed: number;
}

export function processLines(input: string, options: LineOptions): LineResult {
  // Split on any newline convention. A file pasted from Windows carries \r\n,
  // and a stray \r left on the end of every line makes every comparison fail.
  const lines = input.split(/\r\n|\r|\n/);
  const before = input.trim() === "" ? 0 : lines.length;

  let out = options.trim ? lines.map((l) => l.trim()) : lines;
  if (options.removeBlank) out = out.filter((l) => l.trim() !== "");

  if (options.deduplicate) {
    const seen = new Set<string>();
    out = out.filter((l) => {
      const key = options.ignoreCase ? l.toLowerCase() : l;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (options.sort !== "none") {
    // localeCompare with numeric so "item2" sorts before "item10", which is what
    // a person means by sorted and what a plain codepoint sort gets wrong.
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: options.ignoreCase ? "base" : "variant",
    });
    out = [...out].sort((a, b) =>
      options.sort === "asc" ? collator.compare(a, b) : collator.compare(b, a)
    );
  }

  // Reverse last, so it flips whatever order the previous steps produced rather
  // than fighting the sort.
  if (options.reverse) out = [...out].reverse();

  const text = out.join("\n");
  return { text, before, after: out.length, removed: Math.max(0, before - out.length) };
}
