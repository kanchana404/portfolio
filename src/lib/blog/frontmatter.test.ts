import { describe, expect, it } from "vitest";
import { FrontmatterError, parseFrontmatter } from "./frontmatter";

const post = (...frontmatter: string[]) => ["---", ...frontmatter, "---", "", "Body."].join("\n");

/** The line and message of the error parseFrontmatter throws. */
function failure(source: string): { line: number; message: string } {
  try {
    parseFrontmatter(source);
  } catch (error) {
    if (error instanceof FrontmatterError) return { line: error.line, message: error.message };
    throw error;
  }
  throw new Error("expected a FrontmatterError");
}

describe("parseFrontmatter accepts", () => {
  it("the digest template's shape", () => {
    const { data, body, bodyLine } = parseFrontmatter(
      post(
        'title: "AI and dev news: week 40, 2026"',
        'publishedAt: "2026-09-28"',
        'summary: "Five things from this week, with my take on each."',
        "kind: digest"
      )
    );
    expect(data).toEqual({
      title: "AI and dev news: week 40, 2026",
      publishedAt: "2026-09-28",
      summary: "Five things from this week, with my take on each.",
      kind: "digest",
    });
    expect(body).toBe("\nBody.");
    // Line 1 is ---, four keys, the closing --- on line 6: the body starts on 7.
    expect(bodyLine).toBe(7);
  });

  it("the two escapes, lists, bare paths and blank lines", () => {
    const { data, bodyLine } = parseFrontmatter(
      post(
        'title: "She said \\"ship it\\" \\\\ twice"',
        "",
        "tags: []",
        "   ",
        "cover: /blog/my-post/cover.webp",
        "publishedAt: 2026-09-28"
      )
    );
    expect(data.title).toBe('She said "ship it" \\ twice');
    expect(data.tags).toEqual([]);
    expect(data.cover).toBe("/blog/my-post/cover.webp");
    // No coercion: a bare date stays a string.
    expect(data.publishedAt).toBe("2026-09-28");
    expect(bodyLine).toBe(9);

    expect(parseFrontmatter(post("tags: [ai, web-dev, gpt-5]")).data.tags).toEqual([
      "ai",
      "web-dev",
      "gpt-5",
    ]);
  });

  it("an empty quoted string, which the field rules then judge", () => {
    expect(parseFrontmatter(post('summary: ""')).data.summary).toBe("");
  });
});

describe("parseFrontmatter refuses, with the line", () => {
  it.each([
    ["a byte-order mark", "﻿" + post("kind: post"), 1, "byte-order mark"],
    ["CRLF line endings", "---\r\nkind: post\r\n---\r\n", 1, "LF line endings"],
    ["a replacement character", post('title: "caf�"'), 2, "not valid UTF-8"],
    ["a missing opening ---", "kind: post\n---\n", 1, "start with a --- line"],
    ["a missing closing ---", "---\nkind: post\n", 1, "no closing"],
    ["a tab", post("kind:\tpost"), 2, "tab"],
    ["indentation", post("  kind: post"), 2, "no indentation"],
    ["a block list", post("tags:", "- ai"), 2, "empty value"],
    ["a block list item", post("- ai"), 2, "no indentation"],
    ["single quotes", post("title: 'Hello there'"), 2, "use double quotes"],
    ["the \\n escape", post('title: "a\\nb"'), 2, "unsupported escape"],
    ["a unicode escape", post('title: "a\\u2014b"'), 2, "unsupported escape"],
    ["an unescaped quote", post('title: "say "hi" now"'), 2, "unescaped double quote"],
    ["an unterminated quote", post('title: "open'), 2, "closing quote"],
    ["a bare value with a space", post("title: Hello world"), 2, "double quotes"],
    ["a bare value with a colon", post("title: Note:x"), 2, "double quotes"],
    ["key: with no value", post("title:"), 2, "empty value"],
    ["key: and a space", post("title: "), 2, "empty value"],
    ["a duplicate key", post("kind: post", "kind: digest"), 3, "duplicate key"],
    ["trailing whitespace", post("kind: post "), 2, "trailing whitespace"],
    ["two spaces after the colon", post("kind:  post"), 2, "one space"],
    ["an uppercase key", post("Title: x"), 2, "camelCase key"],
    ["an uppercase list item", post("tags: [AI, web]"), 2, "list item"],
    ["a list without the space", post("tags: [ai,web]"), 2, "list item"],
    ["a list item YAML reads as a number", post("tags: [ai, 2026]"), 2, "number"],
    ["a bare value YAML reads as a boolean", post("kind: true"), 2, "boolean"],
    ["a bare number", post("kind: 12"), 2, "number"],
    ["a control character", post('title: "a\u0007b"'), 2, "control"],
    ["a C1 control character", post('title: "a\u0085b"'), 2, "control"],
    ["a line separator", post('title: "a b"'), 2, "invisible"],
  ])("%s", (_name, source, line, message) => {
    const error = failure(source);
    expect(error.line).toBe(line);
    expect(error.message).toContain(message);
  });

  it("frontmatter longer than 40 lines", () => {
    const keys = Array.from({ length: 41 }, (_, i) => `key${i}: x`);
    const error = failure(post(...keys));
    expect(error.message).toContain("longer than 40 lines");
    expect(error.line).toBe(42);
    // Forty is fine.
    expect(() => parseFrontmatter(post(...keys.slice(0, 40)))).not.toThrow();
  });

  it("reports a CR on the line where it appears", () => {
    expect(failure("---\nkind: post\ntitle: x\r\n---\n").line).toBe(3);
  });
});
