import { describe, expect, it } from "vitest";
import { DEFAULT_LINE_OPTIONS, type LineOptions, processLines } from "./lines";

const opts = (o: Partial<LineOptions> = {}): LineOptions => ({
  ...DEFAULT_LINE_OPTIONS,
  removeBlank: false,
  deduplicate: false,
  trim: false,
  ...o,
});

describe("the order the steps run in", () => {
  it("trims before deduplicating, so 'a' and 'a ' collapse", () => {
    // The whole reason the pipeline is fixed. Deduplicating first leaves both,
    // because as strings they differ, and that is what a naive implementation
    // applying options in checkbox order does.
    const out = processLines("a\na \n a", opts({ trim: true, deduplicate: true }));
    expect(out.text).toBe("a");
    expect(out.removed).toBe(2);
  });

  it("keeps them apart when trim is off", () => {
    expect(processLines("a\na ", opts({ deduplicate: true })).text).toBe("a\na ");
  });

  it("reverses after sorting rather than instead of it", () => {
    const out = processLines("b\na\nc", opts({ sort: "asc", reverse: true }));
    expect(out.text).toBe("c\nb\na");
  });
});

describe("line endings", () => {
  it("handles CRLF without leaving a stray carriage return", () => {
    // A file pasted from Windows carries \r\n. Splitting on \n alone leaves \r
    // on every line, and then no two lines ever compare equal.
    const out = processLines("a\r\nb\r\na", opts({ deduplicate: true }));
    expect(out.text).toBe("a\nb");
    expect(out.text).not.toContain("\r");
  });

  it("handles old Mac CR endings too", () => {
    expect(processLines("a\rb", opts()).text).toBe("a\nb");
  });
});

describe("deduplicating", () => {
  it("keeps the first occurrence, not the last", () => {
    expect(processLines("b\na\nb", opts({ deduplicate: true })).text).toBe("b\na");
  });

  it("can ignore case", () => {
    expect(processLines("Apple\napple", opts({ deduplicate: true })).text).toBe("Apple\napple");
    expect(
      processLines("Apple\napple", opts({ deduplicate: true, ignoreCase: true })).text
    ).toBe("Apple");
  });
});

describe("sorting", () => {
  it("sorts numbers the way a person means", () => {
    // A codepoint sort puts item10 before item2. Nobody wants that.
    const out = processLines("item10\nitem2\nitem1", opts({ sort: "asc" }));
    expect(out.text).toBe("item1\nitem2\nitem10");
  });

  it("sorts descending", () => {
    expect(processLines("a\nc\nb", opts({ sort: "desc" })).text).toBe("c\nb\na");
  });
});

describe("counts", () => {
  it("reports what was removed", () => {
    const out = processLines("a\na\nb\n\nc", opts({ deduplicate: true, removeBlank: true }));
    expect(out).toMatchObject({ before: 5, after: 3, removed: 2 });
  });

  it("counts nothing for empty input", () => {
    expect(processLines("", opts())).toMatchObject({ before: 0, after: 1, removed: 0 });
    expect(processLines("   ", opts({ removeBlank: true }))).toMatchObject({ before: 0 });
  });
});
