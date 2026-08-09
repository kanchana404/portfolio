import { describe, expect, it } from "vitest";
import { diffLines } from "./diff";

const render = (left: string, right: string, options = {}): string[] =>
  diffLines(left, right, options).lines.map(
    (l) => `${l.type === "equal" ? " " : l.type === "insert" ? "+" : "-"}${l.text}`
  );

describe("diffLines", () => {
  it("reports identical input as unchanged", () => {
    const result = diffLines("a\nb\nc", "a\nb\nc");
    expect(result.identical).toBe(true);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.unchanged).toBe(3);
  });

  it("marks a single insertion without disturbing the lines after it", () => {
    // The whole reason for LCS. A lockstep comparison would report every line
    // from the insertion onwards as changed.
    expect(render("a\nb\nc", "a\nx\nb\nc")).toEqual([" a", "+x", " b", " c"]);
  });

  it("marks a single deletion", () => {
    expect(render("a\nb\nc", "a\nc")).toEqual([" a", "-b", " c"]);
  });

  it("represents a replacement as a delete plus an insert", () => {
    const result = diffLines("a\nb\nc", "a\nB\nc");
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.unchanged).toBe(2);
  });

  it("handles a wholly different pair", () => {
    const result = diffLines("a\nb", "x\ny");
    expect(result.added).toBe(2);
    expect(result.removed).toBe(2);
    expect(result.unchanged).toBe(0);
  });

  it("handles one side being empty", () => {
    const added = diffLines("", "a\nb");
    expect(added.added).toBe(2);
    // The empty document is one empty line, which pairs with nothing.
    expect(added.removed).toBe(1);

    const removed = diffLines("a\nb", "");
    expect(removed.removed).toBe(2);
    expect(removed.added).toBe(1);
  });

  it("numbers lines independently on each side", () => {
    const result = diffLines("a\nb\nc", "a\nx\nc");
    const byText = new Map(result.lines.map((l) => [`${l.type}:${l.text}`, l]));

    expect(byText.get("equal:a")).toMatchObject({ leftNumber: 1, rightNumber: 1 });
    expect(byText.get("delete:b")).toMatchObject({ leftNumber: 2, rightNumber: null });
    expect(byText.get("insert:x")).toMatchObject({ leftNumber: null, rightNumber: 2 });
    expect(byText.get("equal:c")).toMatchObject({ leftNumber: 3, rightNumber: 3 });
  });

  it("keeps numbering correct through the common-prefix fast path", () => {
    const left = ["a", "b", "c", "d", "e"].join("\n");
    const right = ["a", "b", "X", "d", "e"].join("\n");
    const result = diffLines(left, right);

    const tail = result.lines[result.lines.length - 1];
    expect(tail).toMatchObject({ text: "e", leftNumber: 5, rightNumber: 5 });
    expect(result.lines.find((l) => l.type === "delete")).toMatchObject({
      text: "c",
      leftNumber: 3,
    });
    expect(result.lines.find((l) => l.type === "insert")).toMatchObject({
      text: "X",
      rightNumber: 3,
    });
  });

  it("treats CRLF and LF as the same line ending", () => {
    expect(diffLines("a\r\nb\r\nc", "a\nb\nc").identical).toBe(true);
  });

  it("treats a lone CR as a line break too", () => {
    expect(diffLines("a\rb", "a\nb").identical).toBe(true);
  });

  it("can ignore case", () => {
    expect(diffLines("Hello\nWorld", "hello\nworld").identical).toBe(false);
    expect(
      diffLines("Hello\nWorld", "hello\nworld", { ignoreCase: true }).identical
    ).toBe(true);
  });

  it("can ignore surrounding whitespace", () => {
    expect(diffLines("  a", "a").identical).toBe(false);
    expect(diffLines("  a  ", "a", { ignoreWhitespace: true }).identical).toBe(true);
  });

  it("still shows the original text when whitespace is ignored", () => {
    // Ignoring whitespace changes what *matches*, not what is displayed —
    // otherwise the tool silently rewrites the user's input.
    const result = diffLines("  a", "a", { ignoreWhitespace: true });
    expect(result.lines[0].text).toBe("  a");
  });

  it("can ignore a trailing newline", () => {
    expect(diffLines("a\nb\n", "a\nb").identical).toBe(false);
    expect(
      diffLines("a\nb\n", "a\nb", { ignoreTrailingNewline: true }).identical
    ).toBe(true);
  });

  it("finds the longest common subsequence, not the first alignment it can", () => {
    // "b c d" is common. A greedy first-match walk pairs the first "b" with the
    // first "b" and then loses the run.
    const result = diffLines("a\nb\nc\nd\ne", "z\nb\nc\nd\nf");
    expect(result.unchanged).toBe(3);
    expect(result.lines.filter((l) => l.type === "equal").map((l) => l.text)).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("degrades to a wholesale replacement rather than allocating an enormous matrix", () => {
    const left = Array.from({ length: 2100 }, (_, i) => `left ${i}`).join("\n");
    const right = Array.from({ length: 2100 }, (_, i) => `right ${i}`).join("\n");
    const result = diffLines(left, right);

    expect(result.truncated).toBe(true);
    expect(result.removed).toBe(2100);
    expect(result.added).toBe(2100);
  });

  it("stays exact when a large input shares most of its lines", () => {
    // The prefix/suffix trim is what keeps this off the truncation path: 5,000
    // lines each side, but only one differs.
    const lines = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
    const changed = [...lines];
    changed[2500] = "line 2500 changed";

    const result = diffLines(lines.join("\n"), changed.join("\n"));
    expect(result.truncated).toBe(false);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.unchanged).toBe(4999);
  });

  it("every output line carries a number on the side it belongs to", () => {
    const result = diffLines("a\nb\nc\nd", "a\nx\nd\ny");
    for (const line of result.lines) {
      if (line.type === "insert") {
        expect(line.leftNumber).toBeNull();
        expect(line.rightNumber).toBeGreaterThan(0);
      } else if (line.type === "delete") {
        expect(line.rightNumber).toBeNull();
        expect(line.leftNumber).toBeGreaterThan(0);
      } else {
        expect(line.leftNumber).toBeGreaterThan(0);
        expect(line.rightNumber).toBeGreaterThan(0);
      }
    }
  });

  it("line numbers increase by exactly one on each side", () => {
    const result = diffLines("a\nb\nc\nd\ne", "a\nx\nc\ne\nf");
    let left = 0;
    let right = 0;
    for (const line of result.lines) {
      if (line.leftNumber !== null) expect(line.leftNumber).toBe(++left);
      if (line.rightNumber !== null) expect(line.rightNumber).toBe(++right);
    }
    expect(left).toBe(5);
    expect(right).toBe(5);
  });

  it("reconstructs both documents from the output", () => {
    // The strongest invariant available: keeping equal+delete gives the left
    // document back, equal+insert gives the right one.
    const left = "alpha\nbeta\ngamma\ndelta\nepsilon";
    const right = "alpha\ngamma\nGAMMA\ndelta\nzeta\nepsilon";
    const result = diffLines(left, right);

    expect(
      result.lines.filter((l) => l.type !== "insert").map((l) => l.text).join("\n")
    ).toBe(left);
    expect(
      result.lines.filter((l) => l.type !== "delete").map((l) => l.text).join("\n")
    ).toBe(right);
  });
});
