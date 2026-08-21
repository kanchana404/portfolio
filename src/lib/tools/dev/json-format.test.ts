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

describe("numbers survive the round trip", () => {
  // Reported 2026-08-21 by an external test pass: `{"id":12345678901234567890}`
  // came back as 12345678901234567000. No error, no warning, just different
  // digits — the worst shape a bug can take in a tool whose whole promise is
  // "here is your data, tidied". `JSON.parse` produces float64, so every
  // integer past 2^53 was altered, and Snowflake ids, database bigints and
  // payment identifiers all live in that range.
  const exact = (source: string) => {
    const formatted = formatJson(source, 2);
    const minified = minifyJson(source);
    expect(formatted.ok && minified.ok).toBe(true);
    return { formatted, minified };
  };

  it("keeps an integer larger than Number.MAX_SAFE_INTEGER exactly", () => {
    const source = '{"id":12345678901234567890}';
    const { formatted, minified } = exact(source);
    expect(formatted.ok && formatted.value).toContain("12345678901234567890");
    // Minifying JSON that has no whitespace must return it unchanged.
    expect(minified.ok && minified.value).toBe(source);
  });

  it("does not turn an out-of-range exponent into null", () => {
    // JSON.parse('1e400') is Infinity, and JSON.stringify(Infinity) is null —
    // so this silently replaced a number with nothing.
    const { minified } = exact('{"n":1e400}');
    expect(minified.ok && minified.value).toBe('{"n":1e400}');
  });

  it("keeps more decimal places than a float64 can hold", () => {
    const { minified } = exact('{"n":0.1234567890123456789}');
    expect(minified.ok && minified.value).toBe('{"n":0.1234567890123456789}');
  });

  it("keeps big numbers when sorting keys too", () => {
    const sorted = sortJsonKeys('{"b":1,"a":12345678901234567890}', 2);
    expect(sorted.ok && sorted.value).toContain("12345678901234567890");
  });

  it("still reports a syntax error rather than reformatting invalid input", () => {
    // The lossless emitter must never be reached for bad input; JSON.parse is
    // still the validator, and its message is the product.
    const result = formatJson('{"a":1,}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.line).toBe(1);
  });

  it("leaves strings containing number-like text alone", () => {
    const source = '{"s":"12345678901234567890"}';
    const { minified } = exact(source);
    expect(minified.ok && minified.value).toBe(source);
  });
});
