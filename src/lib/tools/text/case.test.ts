import { describe, expect, it } from "vitest";
import { CASES, convertCase, slugify, splitTokens } from "./case";

describe("splitTokens", () => {
  it("splits every common convention", () => {
    expect(splitTokens("helloWorld")).toEqual(["hello", "World"]);
    expect(splitTokens("HelloWorld")).toEqual(["Hello", "World"]);
    expect(splitTokens("hello_world")).toEqual(["hello", "world"]);
    expect(splitTokens("hello-world")).toEqual(["hello", "world"]);
    expect(splitTokens("hello.world")).toEqual(["hello", "world"]);
    expect(splitTokens("hello world")).toEqual(["hello", "world"]);
  });

  it("keeps an acronym run together", () => {
    // The rule most implementations miss: without it this splits as
    // ["parse", "H", "T", "T", "P", "Response"] or ["parse", "HTTPR", "esponse"].
    expect(splitTokens("parseHTTPResponse")).toEqual(["parse", "HTTP", "Response"]);
    expect(splitTokens("XMLHttpRequest")).toEqual(["XML", "Http", "Request"]);
  });

  it("splits digits from letters sensibly", () => {
    expect(splitTokens("user2Name")).toEqual(["user2", "Name"]);
  });

  it("returns nothing for blank input", () => {
    expect(splitTokens("")).toEqual([]);
    expect(splitTokens("___")).toEqual([]);
  });
});

describe("convertCase", () => {
  const input = "hello world example";

  it.each([
    ["lower", "hello world example"],
    ["upper", "HELLO WORLD EXAMPLE"],
    ["camel", "helloWorldExample"],
    ["pascal", "HelloWorldExample"],
    ["snake", "hello_world_example"],
    ["constant", "HELLO_WORLD_EXAMPLE"],
    ["kebab", "hello-world-example"],
    ["dot", "hello.world.example"],
  ] as const)("converts to %s", (target, expected) => {
    expect(convertCase(input, target)).toBe(expected);
  });

  it("round-trips an identifier between conventions", () => {
    const camel = convertCase("parse_http_response", "camel");
    expect(camel).toBe("parseHttpResponse");
    expect(convertCase(camel, "snake")).toBe("parse_http_response");
  });

  it("keeps minor words lowercase in a title, except at the edges", () => {
    expect(convertCase("the lord of the rings", "title")).toBe(
      "The Lord of the Rings"
    );
    // "of" is last here, so it is capitalised.
    expect(convertCase("something to think of", "title")).toBe(
      "Something to Think Of"
    );
  });

  it("capitalises each sentence without destroying the rest", () => {
    expect(convertCase("hello there. how are you? fine!", "sentence")).toBe(
      "Hello there. How are you? Fine!"
    );
  });

  it("alternates over letters only, so spacing does not break the pattern", () => {
    expect(convertCase("hello world", "alternating")).toBe("hElLo WoRlD");
  });

  it("inverts existing case", () => {
    expect(convertCase("Hello World", "inverse")).toBe("hELLO wORLD");
  });

  it("returns an empty string for empty input in every mode", () => {
    for (const { id } of CASES) {
      expect(convertCase("", id)).toBe("");
    }
  });

  it("exposes an example for every case it supports", () => {
    // Guards against adding a CaseId to the union and forgetting the picker.
    expect(CASES).toHaveLength(12);
    for (const entry of CASES) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.example.length).toBeGreaterThan(0);
    }
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips diacritics rather than percent-encoding them later", () => {
    expect(slugify("Café Münster")).toBe("cafe-munster");
    expect(slugify("Crème brûlée")).toBe("creme-brulee");
  });

  it("collapses runs of separators and trims the ends", () => {
    expect(slugify("  --Hello---World--  ")).toBe("hello-world");
  });

  it("drops characters that have no ASCII equivalent", () => {
    expect(slugify("hello 世界 world")).toBe("hello-world");
  });

  it("returns an empty string when nothing survives", () => {
    expect(slugify("世界")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});
