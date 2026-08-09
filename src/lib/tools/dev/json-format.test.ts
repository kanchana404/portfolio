import { describe, expect, it } from "vitest";
import {
  describeJson,
  formatJson,
  minifyJson,
  sortJsonKeys,
} from "./json-format";

describe("formatJson", () => {
  it("indents with two spaces by default", () => {
    const result = formatJson('{"a":1}');
    expect(result.ok && result.value).toBe('{\n  "a": 1\n}');
  });

  it("honours four spaces and tabs", () => {
    // Held in a variable rather than called twice inline: `.ok` on one call
    // cannot narrow the discriminated union returned by a second, separate call.
    const four = formatJson('{"a":1}', 4);
    expect(four.ok && four.value).toBe('{\n    "a": 1\n}');

    const tabbed = formatJson('{"a":1}', "tab");
    expect(tabbed.ok && tabbed.value).toBe('{\n\t"a": 1\n}');
  });

  it("treats blank input as valid and empty", () => {
    expect(formatJson("   ")).toEqual({ ok: true, value: "", bytesIn: 0, bytesOut: 0 });
  });

  it("reports byte sizes in UTF-8, not UTF-16 units", () => {
    const result = formatJson('{"a":"🚀"}');
    // The rocket is four UTF-8 bytes; a .length-based count would say two.
    expect(result.ok && result.bytesIn).toBe(12);
  });

  it("locates an error by line and column, not by character offset", () => {
    const broken = '{\n  "a": 1,\n  "b": ,\n  "c": 3\n}';
    const result = formatJson(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBe(3);
      expect(result.error.column).toBeGreaterThan(1);
      expect(result.error.excerpt).toContain('"b"');
      // The engine's own "at position N" is stripped — it refers to an offset
      // the reader cannot see, and showing both invites trusting the wrong one.
      expect(result.error.message).not.toContain("at position");
    }
  });

  it("reports a trailing comma, the single most common JSON mistake", () => {
    const result = formatJson('{"a": 1,}');
    expect(result.ok).toBe(false);
  });

  it("rejects single quotes, which JSON does not allow", () => {
    expect(formatJson("{'a': 1}").ok).toBe(false);
  });

  it("accepts top-level arrays and scalars", () => {
    expect(formatJson("[1,2,3]").ok).toBe(true);
    expect(formatJson('"just a string"').ok).toBe(true);
    expect(formatJson("null").ok).toBe(true);
  });
});

describe("minifyJson", () => {
  it("strips all insignificant whitespace", () => {
    const result = minifyJson('{\n  "a": 1,\n  "b": [1, 2]\n}');
    expect(result.ok && result.value).toBe('{"a":1,"b":[1,2]}');
  });

  it("reports the size it saved", () => {
    const result = minifyJson('{\n  "a": 1\n}');
    expect(result.ok && result.bytesOut < result.bytesIn).toBe(true);
  });
});

describe("sortJsonKeys", () => {
  it("sorts object keys recursively", () => {
    const result = sortJsonKeys('{"b":1,"a":{"d":2,"c":3}}');
    expect(result.ok && result.value).toBe(
      '{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}'
    );
  });

  it("leaves array order alone, because reordering an array changes meaning", () => {
    const result = sortJsonKeys('[3,1,2]');
    expect(result.ok && result.value).toBe("[\n  3,\n  1,\n  2\n]");
  });

  it("does not choke on null, which is typeof object", () => {
    expect(sortJsonKeys('{"a":null}').ok).toBe(true);
  });
});

describe("describeJson", () => {
  it("names the top-level shape", () => {
    expect(describeJson('{"a":1,"b":2}')).toBe("object with 2 keys");
    expect(describeJson("[1,2,3]")).toBe("array of 3 items");
    expect(describeJson('{"a":1}')).toBe("object with 1 key");
    expect(describeJson("[1]")).toBe("array of 1 item");
    expect(describeJson("null")).toBe("null");
    expect(describeJson("42")).toBe("number");
  });
  it("returns null for invalid JSON", () => {
    expect(describeJson("{")).toBeNull();
  });
});
