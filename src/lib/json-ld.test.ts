import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jsonLdHtml } from "./json-ld";

describe("jsonLdHtml", () => {
  it("neutralises a closing script tag", () => {
    const out = jsonLdHtml({ headline: "AI news </script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("\\u003c");
  });

  it("escapes every character the HTML tokeniser reacts to", () => {
    const out = jsonLdHtml({ v: "<>&" });
    expect(out).not.toMatch(/[<>&]/);
  });

  it("escapes the line separators that are legal in JSON but not in JS source", () => {
    const out = jsonLdHtml({ v: "a\u2028b\u2029c" });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
  });

  it("round-trips: the escaped output is still the same data", () => {
    // The whole point. `"<"` and `"<"` are the same string to any JSON
    // parser, so Google reads exactly what was intended.
    const data = {
      "@context": "https://schema.org",
      headline: "Tags & <em>markup</em> </script>",
      list: ["a < b", "c > d"],
      nested: { deep: "5 & 6" },
    };
    expect(JSON.parse(jsonLdHtml(data))).toEqual(data);
  });

  it("produces output a browser cannot mistake for the end of the block", () => {
    const payload = jsonLdHtml({ t: "</ScRiPt >" });
    // Case-insensitive, and tolerant of whitespace before ">", which is how the
    // HTML spec actually terminates a script element.
    expect(payload).not.toMatch(/<\/\s*script/i);
  });

  it("handles a plain object unchanged", () => {
    expect(jsonLdHtml({ a: 1 })).toBe('{"a":1}');
  });
});

/**
 * Structural guard: no JSON may reach `dangerouslySetInnerHTML` unescaped.
 *
 * Six sites emitted `JSON.stringify(...)` directly into a
 * `<script type="application/ld+json">`. Two of them carried Mongo-sourced blog
 * fields, which were writable by unauthenticated callers until the
 * authorisation fixes in this change — a stored XSS with ISR caching in front of
 * it.
 *
 * The other four carried registry data authored in this repo and were safe *by
 * virtue of their input*, which is exactly the kind of safety that evaporates
 * silently when someone changes where the data comes from. All six now escape.
 */
describe("no unescaped JSON reaches the DOM", () => {
  const SRC = join(process.cwd(), "src");

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  const offenders = sourceFiles(SRC).filter((file) =>
    /__html:\s*JSON\.stringify\(/.test(readFileSync(file, "utf8"))
  );

  it("finds no raw JSON.stringify inside dangerouslySetInnerHTML", () => {
    expect(
      offenders.map((f) => f.replace(process.cwd() + "/", "")),
      "use jsonLdHtml() from @/lib/json-ld instead — JSON.stringify does not escape </script>"
    ).toEqual([]);
  });

  it("every ld+json block in the app uses the escaper", () => {
    const emitting = sourceFiles(SRC).filter((file) =>
      readFileSync(file, "utf8").includes("application/ld+json")
    );
    expect(emitting.length).toBeGreaterThanOrEqual(5);

    for (const file of emitting) {
      const source = readFileSync(file, "utf8");
      expect(
        source,
        `${file.replace(process.cwd() + "/", "")} emits ld+json without jsonLdHtml`
      ).toContain("jsonLdHtml");
    }
  });
});
