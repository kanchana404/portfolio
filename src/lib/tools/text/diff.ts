/**
 * Line diff.
 *
 * The naive approach — walk both sides in lockstep and mark anything that
 * differs — produces a useless result the moment a line is inserted, because
 * every subsequent line reports as changed. What people actually want is the
 * longest common subsequence: the largest set of lines that appear in both, in
 * order, so that an insertion shows as one added line rather than a hundred
 * modified ones.
 *
 * LCS is O(n·m) in time and space, which is fine for two files a person pasted
 * and ruinous for two very large ones. Two mitigations, both standard: strip the
 * common head and tail first (usually the bulk of a real comparison), then cap
 * the remaining matrix and degrade honestly rather than freezing the tab.
 */

export type ChangeType = "equal" | "insert" | "delete";

export interface DiffLine {
  type: ChangeType;
  text: string;
  /** 1-based line number on the left, or null for an inserted line. */
  leftNumber: number | null;
  /** 1-based line number on the right, or null for a deleted line. */
  rightNumber: number | null;
}

export interface DiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
  unchanged: number;
  /** True when the inputs were too large for an exact diff. */
  truncated: boolean;
  identical: boolean;
}

export interface DiffOptions {
  ignoreCase?: boolean;
  /** Ignore leading and trailing whitespace when deciding whether lines match. */
  ignoreWhitespace?: boolean;
  /** Treat trailing blank lines as insignificant. */
  ignoreTrailingNewline?: boolean;
}

/**
 * Largest matrix we will allocate, in cells.
 *
 * Four million is roughly 2,000 × 2,000 lines after the common head and tail
 * have been removed, which is far past anything anyone pastes into a text box,
 * and still allocates in tens of megabytes rather than gigabytes.
 */
const MAX_CELLS = 4_000_000;

function normalise(line: string, options: DiffOptions): string {
  let value = line;
  if (options.ignoreWhitespace) value = value.trim();
  if (options.ignoreCase) value = value.toLowerCase();
  return value;
}

function splitLines(text: string, options: DiffOptions): string[] {
  // Normalise CRLF first: a file saved on Windows and one saved on macOS would
  // otherwise differ on every single line, which is technically true and never
  // what the reader means.
  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalised.split("\n");
  if (options.ignoreTrailingNewline) {
    while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  }
  return lines;
}

export function diffLines(
  left: string,
  right: string,
  options: DiffOptions = {}
): DiffResult {
  const a = splitLines(left, options);
  const b = splitLines(right, options);

  const keyA = a.map((l) => normalise(l, options));
  const keyB = b.map((l) => normalise(l, options));

  // Strip the common prefix and suffix. On a real comparison — two versions of
  // the same document — this removes most of the input before the expensive
  // part starts.
  let start = 0;
  while (start < keyA.length && start < keyB.length && keyA[start] === keyB[start]) {
    start += 1;
  }

  let endA = keyA.length;
  let endB = keyB.length;
  while (endA > start && endB > start && keyA[endA - 1] === keyB[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const midA = keyA.slice(start, endA);
  const midB = keyB.slice(start, endB);

  const lines: DiffLine[] = [];
  let leftNo = 1;
  let rightNo = 1;

  for (let i = 0; i < start; i++) {
    lines.push({ type: "equal", text: a[i], leftNumber: leftNo++, rightNumber: rightNo++ });
  }

  let truncated = false;

  if (midA.length * midB.length > MAX_CELLS) {
    // Too large for an exact diff. Report the middle as a wholesale replacement
    // rather than silently producing a wrong alignment or hanging the tab.
    truncated = true;
    for (let i = 0; i < midA.length; i++) {
      lines.push({
        type: "delete",
        text: a[start + i],
        leftNumber: leftNo++,
        rightNumber: null,
      });
    }
    for (let j = 0; j < midB.length; j++) {
      lines.push({
        type: "insert",
        text: b[start + j],
        leftNumber: null,
        rightNumber: rightNo++,
      });
    }
  } else {
    // Standard LCS table, then walk it backwards to recover the alignment.
    const rows = midA.length + 1;
    const cols = midB.length + 1;
    const table = new Uint32Array(rows * cols);

    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        table[i * cols + j] =
          midA[i] === midB[j]
            ? table[(i + 1) * cols + (j + 1)] + 1
            : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)]);
      }
    }

    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        lines.push({
          type: "equal",
          text: a[start + i],
          leftNumber: leftNo++,
          rightNumber: rightNo++,
        });
        i += 1;
        j += 1;
      } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
        lines.push({
          type: "delete",
          text: a[start + i],
          leftNumber: leftNo++,
          rightNumber: null,
        });
        i += 1;
      } else {
        lines.push({
          type: "insert",
          text: b[start + j],
          leftNumber: null,
          rightNumber: rightNo++,
        });
        j += 1;
      }
    }
    while (i < midA.length) {
      lines.push({
        type: "delete",
        text: a[start + i],
        leftNumber: leftNo++,
        rightNumber: null,
      });
      i += 1;
    }
    while (j < midB.length) {
      lines.push({
        type: "insert",
        text: b[start + j],
        leftNumber: null,
        rightNumber: rightNo++,
      });
      j += 1;
    }
  }

  for (let k = endA; k < keyA.length; k++) {
    lines.push({
      type: "equal",
      text: a[k],
      leftNumber: leftNo++,
      rightNumber: rightNo++,
    });
  }

  const added = lines.filter((l) => l.type === "insert").length;
  const removed = lines.filter((l) => l.type === "delete").length;
  const unchanged = lines.filter((l) => l.type === "equal").length;

  return {
    lines,
    added,
    removed,
    unchanged,
    truncated,
    identical: added === 0 && removed === 0,
  };
}
