/**
 * Testing a regular expression without letting it hang the page.
 *
 * A regex tester has one hazard that separates it from every other text tool:
 * **catastrophic backtracking**. `(a+)+$` against thirty `a`s and a `b` does not
 * take longer, it takes effectively forever, because the engine explores an
 * exponential number of ways to split the input. JavaScript regexes cannot be
 * interrupted once started, and there is no timeout option, so a tester that
 * runs one on the main thread has handed the reader a frozen tab with no way
 * back except closing it.
 *
 * That is why matching happens in a worker that gets terminated. Terminating is
 * the only thing that actually stops a running regex, and it is why this file
 * holds the pure parts while the execution lives next door.
 *
 * The patterns that do this are not exotic. Nested quantifiers over overlapping
 * character classes, which is `(\\s+)+`, `(\\w|\\d)*$`, or an innocent-looking
 * email pattern copied off the internet.
 */

export interface RegexFlagInfo {
  id: string;
  label: string;
  note: string;
}

export const REGEX_FLAGS: readonly RegexFlagInfo[] = [
  { id: "g", label: "global", note: "Find every match, not just the first." },
  { id: "i", label: "ignore case", note: "Match regardless of capitalisation." },
  { id: "m", label: "multiline", note: "^ and $ match at each line, not just the whole string." },
  { id: "s", label: "dotall", note: "Let . match newlines too." },
  { id: "u", label: "unicode", note: "Treat the pattern as Unicode code points." },
];

export interface CompileResult {
  ok: boolean;
  error?: string;
  /** A warning when the pattern has a shape known to backtrack badly. */
  warning?: string;
}

/**
 * Checks a pattern compiles, and flags shapes that backtrack exponentially.
 *
 * The detection is deliberately crude: a quantifier applied to a group that
 * itself ends in a quantifier. That is the classic nested-quantifier shape and
 * it catches `(a+)+`, `(\\w*)*` and `(\\s+)*`. It will miss cleverer cases and
 * will occasionally warn about a pattern that is fine, which is the right way
 * round for a warning that costs nothing to ignore.
 */
export function compile(pattern: string, flags: string): CompileResult {
  if (!pattern) return { ok: false, error: "Enter a pattern." };
  try {
    new RegExp(pattern, flags);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "That pattern is not valid.",
    };
  }

  const nested = /\([^)]*[+*]\)\s*[+*]/.test(pattern);
  return nested
    ? {
        ok: true,
        warning:
          "This pattern nests one quantifier inside another, which can backtrack exponentially on input that nearly matches. Matching is time-limited, so the page will not freeze, but a real program using this pattern would.",
      }
    : { ok: true };
}

export interface Match {
  index: number;
  text: string;
  groups: Array<string | undefined>;
  named: Record<string, string | undefined>;
}

/** Runs the match. Only ever called inside a worker; see ./regex.worker. */
export function runMatch(
  pattern: string,
  flags: string,
  input: string,
  limit = 1000
): Match[] {
  const re = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
  const out: Match[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(input)) !== null) {
    out.push({
      index: m.index,
      text: m[0],
      groups: m.slice(1),
      named: { ...(m.groups ?? {}) },
    });
    // A zero-width match does not advance lastIndex, so `(?:)` or `^` with the
    // global flag loops forever without this.
    if (m[0] === "") re.lastIndex += 1;
    if (out.length >= limit) break;
  }
  return out;
}
