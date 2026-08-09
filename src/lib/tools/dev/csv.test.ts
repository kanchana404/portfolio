import { describe, expect, it } from "vitest";
import { csvToJson, detectDelimiter, jsonToCsv, parseCsv } from "./csv";

const toJson = (csv: string, inferTypes = true): unknown =>
  JSON.parse(csvToJson(parseCsv(csv), { inferTypes }));

describe("detectDelimiter", () => {
  it("finds commas", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
  });

  it("finds semicolons, as exported by European Excel", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
  });

  it("finds tabs", () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("finds pipes", () => {
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|");
  });

  it("prefers the consistent candidate over the frequent one", () => {
    // Commas appear more often, but only the semicolon appears the same number
    // of times on every line — which is what a delimiter does.
    const csv = "name;note\nAda;maths, computing, and engines\nAlan;logic, and machines";
    expect(detectDelimiter(csv)).toBe(";");
  });

  it("defaults to a comma for a single column", () => {
    expect(detectDelimiter("name\nAda\nAlan")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("reads a plain table", () => {
    const result = parseCsv("name,age\nAda,36\nAlan,41");
    expect(result.headers).toEqual(["name", "age"]);
    expect(result.rows).toEqual([
      ["Ada", "36"],
      ["Alan", "41"],
    ]);
    expect(result.error).toBeNull();
  });

  it("keeps a delimiter that sits inside a quoted field", () => {
    const result = parseCsv('name,role\n"Lovelace, Ada",mathematician');
    expect(result.rows[0]).toEqual(["Lovelace, Ada", "mathematician"]);
  });

  it("keeps a newline that sits inside a quoted field", () => {
    // The failure mode that makes naive line-splitting parsers corrupt data.
    const result = parseCsv('name,address\n"Ada","12 Bell Street\nLondon"');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][1]).toBe("12 Bell Street\nLondon");
  });

  it("unescapes doubled quotes", () => {
    const result = parseCsv('quote\n"She said ""hello"" twice"');
    expect(result.rows[0][0]).toBe('She said "hello" twice');
  });

  it("handles a field that is only a quoted empty string", () => {
    const result = parseCsv('a,b\n"",x');
    expect(result.rows[0]).toEqual(["", "x"]);
  });

  it("strips a UTF-8 BOM", () => {
    const result = parseCsv("﻿name,age\nAda,36");
    expect(result.headers[0]).toBe("name");
  });

  it("accepts CRLF line endings", () => {
    const result = parseCsv("name,age\r\nAda,36\r\nAlan,41");
    expect(result.rows).toEqual([
      ["Ada", "36"],
      ["Alan", "41"],
    ]);
  });

  it("ignores a trailing newline instead of inventing a blank row", () => {
    expect(parseCsv("a,b\n1,2\n").rows).toHaveLength(1);
  });

  it("warns about a row with the wrong number of fields", () => {
    const result = parseCsv("a,b,c\n1,2");
    expect(result.warnings.join(" ")).toContain("Row 2");
    expect(result.warnings.join(" ")).toContain("2 fields");
  });

  it("warns about duplicate column names", () => {
    const result = parseCsv("id,name,id\n1,Ada,2");
    expect(result.warnings.join(" ")).toContain("Duplicate column");
    expect(result.warnings.join(" ")).toContain("id");
  });

  it("reports an unterminated quote rather than guessing", () => {
    const result = parseCsv('name\n"Ada');
    expect(result.error).toContain("never closed");
    expect(result.rows).toEqual([]);
  });

  it("returns an empty result for empty input", () => {
    const result = parseCsv("   ");
    expect(result.headers).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("honours a forced delimiter over detection", () => {
    const result = parseCsv("a;b\n1;2", ",");
    expect(result.headers).toEqual(["a;b"]);
  });
});

describe("csvToJson", () => {
  it("maps rows onto header keys", () => {
    expect(toJson("name,age\nAda,36", false)).toEqual([{ name: "Ada", age: "36" }]);
  });

  it("fills missing fields rather than producing undefined", () => {
    expect(toJson("a,b,c\n1,2", false)).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("infers numbers and booleans when asked", () => {
    expect(toJson("n,flag,nothing\n42,true,null")).toEqual([
      { n: 42, flag: true, nothing: null },
    ]);
  });

  it("infers decimals and negatives", () => {
    expect(toJson("a,b\n-3.5,0.25")).toEqual([{ a: -3.5, b: 0.25 }]);
  });

  it("preserves leading zeros as text", () => {
    // The classic spreadsheet data-loss bug: "007" and "01792" are identifiers,
    // not integers, and turning them into 7 and 1792 destroys them.
    expect(toJson("code,phone\n007,01792")).toEqual([
      { code: "007", phone: "01792" },
    ]);
  });

  it("preserves an integer too large to represent exactly", () => {
    const big = "9007199254740993"; // 2^53 + 1
    expect(toJson(`id\n${big}`)).toEqual([{ id: big }]);
  });

  it("leaves values alone when inference is off", () => {
    expect(toJson("n,flag\n42,true", false)).toEqual([{ n: "42", flag: "true" }]);
  });

  it("does not treat a version string as a number", () => {
    expect(toJson("v\n1.2.3")).toEqual([{ v: "1.2.3" }]);
  });
});

describe("jsonToCsv", () => {
  it("writes a header row and one row per object", () => {
    const result = jsonToCsv('[{"name":"Ada","age":36},{"name":"Alan","age":41}]');
    expect(result).toMatchObject({ ok: true, rows: 2, columns: 2 });
    if (result.ok) expect(result.csv).toBe("name,age\nAda,36\nAlan,41");
  });

  it("unions keys across rows so optional fields line up", () => {
    const result = jsonToCsv('[{"a":1},{"b":2}]');
    if (!result.ok) throw new Error(result.error);
    expect(result.csv).toBe("a,b\n1,\n,2");
  });

  it("quotes a value containing the delimiter", () => {
    const result = jsonToCsv('[{"name":"Lovelace, Ada"}]');
    if (!result.ok) throw new Error(result.error);
    expect(result.csv).toBe('name\n"Lovelace, Ada"');
  });

  it("doubles an embedded quote", () => {
    const result = jsonToCsv('[{"q":"say \\"hi\\""}]');
    if (!result.ok) throw new Error(result.error);
    expect(result.csv).toBe('q\n"say ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    const result = jsonToCsv('[{"a":"one\\ntwo"}]');
    if (!result.ok) throw new Error(result.error);
    expect(result.csv).toBe('a\n"one\ntwo"');
  });

  it("quotes a value with significant surrounding whitespace", () => {
    const result = jsonToCsv('[{"a":" padded "}]');
    if (!result.ok) throw new Error(result.error);
    expect(result.csv).toBe('a\n" padded "');
  });

  it("writes null and missing keys as empty", () => {
    const result = jsonToCsv('[{"a":null,"b":1}]');
    if (!result.ok) throw new Error(result.error);
    expect(result.csv).toBe("a,b\n,1");
  });

  it("serialises a nested object rather than writing [object Object]", () => {
    const result = jsonToCsv('[{"meta":{"x":1}}]');
    if (!result.ok) throw new Error(result.error);
    expect(result.csv).toContain('{""x"":1}');
    expect(result.csv).not.toContain("[object Object]");
  });

  it("explains why a bare object cannot become CSV", () => {
    const result = jsonToCsv('{"a":1}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("array of objects");
  });

  it("rejects an array of primitives", () => {
    const result = jsonToCsv("[1,2,3]");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("must be an object");
  });

  it("reports invalid JSON with the parser's own message", () => {
    const result = jsonToCsv("{not json}");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it("treats an empty array as an empty file, not an error", () => {
    expect(jsonToCsv("[]")).toEqual({ ok: true, csv: "", rows: 0, columns: 0 });
  });

  it("honours a non-comma delimiter", () => {
    const result = jsonToCsv('[{"a":1,"b":2}]', ";");
    if (!result.ok) throw new Error(result.error);
    expect(result.csv).toBe("a;b\n1;2");
  });
});

describe("round trip", () => {
  it("survives quotes, delimiters and newlines intact", () => {
    const original = [
      { name: "Lovelace, Ada", note: 'said "hello"', address: "12 Bell Street\nLondon" },
      { name: "Turing, Alan", note: "", address: "Wilmslow" },
    ];

    const written = jsonToCsv(JSON.stringify(original));
    if (!written.ok) throw new Error(written.error);

    const readBack = JSON.parse(
      csvToJson(parseCsv(written.csv), { inferTypes: false })
    );
    expect(readBack).toEqual(original);
  });

  it("survives every delimiter it can detect", () => {
    for (const delimiter of [",", ";", "\t", "|"] as const) {
      const original = [
        { a: "one", b: "two" },
        { a: "three", b: "four" },
      ];
      const written = jsonToCsv(JSON.stringify(original), delimiter);
      if (!written.ok) throw new Error(written.error);
      const readBack = JSON.parse(
        csvToJson(parseCsv(written.csv, delimiter), { inferTypes: false })
      );
      expect(readBack, `round trip failed for ${JSON.stringify(delimiter)}`).toEqual(
        original
      );
    }
  });
});
