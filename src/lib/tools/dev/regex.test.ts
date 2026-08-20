import { describe, expect, it } from "vitest";
import { REGEX_FLAGS, compile, runMatch } from "./regex";

describe("compiling", () => {
  it("accepts a valid pattern", () => {
    expect(compile("\\d+", "g")).toMatchObject({ ok: true });
  });

  it("reports the engine's own message for a bad one", () => {
    const out = compile("(unclosed", "");
    expect(out.ok).toBe(false);
    expect(out.error).toBeTruthy();
  });

  it("refuses an empty pattern rather than matching everything", () => {
    expect(compile("", "g").ok).toBe(false);
  });
});

describe("the backtracking warning", () => {
  it("flags nested quantifiers, the classic exponential shape", () => {
    // (a+)+ against 30 a's and a b does not take longer, it takes forever.
    for (const p of ["(a+)+$", "(\\w*)*", "(\\s+)*x"]) {
      expect(compile(p, "").warning, p).toMatch(/backtrack/i);
    }
  });

  it("stays quiet on ordinary patterns", () => {
    for (const p of ["\\d+", "^[a-z]+$", "foo|bar", "(\\d{3})-(\\d{4})"]) {
      expect(compile(p, "").warning, p).toBeUndefined();
    }
  });

  it("warns without refusing, because the pattern is still valid", () => {
    expect(compile("(a+)+$", "").ok).toBe(true);
  });
});

describe("matching", () => {
  it("returns every match with its position", () => {
    const out = runMatch("\\d+", "g", "a1 bb22 c333");
    expect(out.map((m) => m.text)).toEqual(["1", "22", "333"]);
    expect(out.map((m) => m.index)).toEqual([1, 5, 9]);
  });

  it("captures numbered and named groups", () => {
    const [m] = runMatch("(?<area>\\d{3})-(\\d{4})", "", "call 555-1234");
    expect(m.groups).toEqual(["555", "1234"]);
    expect(m.named).toEqual({ area: "555" });
  });

  it("adds the global flag when it is missing, rather than returning one match", () => {
    // Without g, exec returns the first match forever. The loop would not end.
    expect(runMatch("\\d", "", "123")).toHaveLength(3);
  });

  it("does not hang on a zero-width match", () => {
    // A zero-width match never advances lastIndex, so `^` with g loops forever
    // unless the index is nudged by hand.
    expect(runMatch("^", "gm", "a\nb").length).toBe(2);
    expect(runMatch("(?:)", "g", "abc").length).toBeLessThanOrEqual(4);
  });

  it("stops at the limit rather than collecting unboundedly", () => {
    expect(runMatch("a", "g", "a".repeat(5000), 100)).toHaveLength(100);
  });
});

describe("flags", () => {
  it("documents what each one does", () => {
    expect(REGEX_FLAGS.map((f) => f.id)).toEqual(["g", "i", "m", "s", "u"]);
    for (const f of REGEX_FLAGS) expect(f.note.length).toBeGreaterThan(10);
  });

  it("honours ignore case and multiline", () => {
    expect(runMatch("ABC", "i", "abc")).toHaveLength(1);
    expect(runMatch("^b", "m", "a\nb")).toHaveLength(1);
  });
});
