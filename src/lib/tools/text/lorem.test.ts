import { describe, expect, it } from "vitest";
import { MAX_LOREM, countWords, generateLorem } from "./lorem";

describe("shape of the output", () => {
  it("produces the number of paragraphs asked for", () => {
    expect(generateLorem("paragraphs", 3).split("\n\n")).toHaveLength(3);
    expect(generateLorem("paragraphs", 1).split("\n\n")).toHaveLength(1);
  });

  it("produces exactly the number of words asked for", () => {
    for (const n of [1, 5, 12, 60]) {
      expect(countWords(generateLorem("words", n)), `${n} words`).toBe(n);
    }
  });

  it("produces the number of sentences asked for", () => {
    const out = generateLorem("sentences", 4);
    expect(out.match(/\./g)).toHaveLength(4);
  });

  it("clamps rather than trusting the caller", () => {
    expect(generateLorem("paragraphs", 0).split("\n\n")).toHaveLength(1);
    expect(generateLorem("paragraphs", -5).split("\n\n")).toHaveLength(1);
    expect(generateLorem("paragraphs", 9999).split("\n\n")).toHaveLength(MAX_LOREM);
  });
});

describe("the opening convention", () => {
  it("starts with the familiar words by default", () => {
    expect(generateLorem("paragraphs", 2)).toMatch(/^Lorem ipsum dolor sit amet/);
    expect(generateLorem("words", 10)).toMatch(/^Lorem ipsum dolor sit amet/);
  });

  it("can be turned off", () => {
    expect(generateLorem("paragraphs", 2, false)).not.toMatch(/^Lorem ipsum dolor sit amet/);
  });

  it("opens only the first paragraph, not every one", () => {
    const paras = generateLorem("paragraphs", 3).split("\n\n");
    expect(paras[0]).toMatch(/^Lorem ipsum/);
    expect(paras[1]).not.toMatch(/^Lorem ipsum dolor sit amet/);
  });
});

describe("determinism, which hydration depends on", () => {
  it("gives the same text for the same seed", () => {
    // The widget renders on the server and again in the browser. An unseeded
    // Math.random() here would produce different text each time and React would
    // report a hydration mismatch.
    expect(generateLorem("paragraphs", 3, true, 42)).toBe(
      generateLorem("paragraphs", 3, true, 42)
    );
  });

  it("gives different text for a different seed", () => {
    expect(generateLorem("paragraphs", 3, true, 1)).not.toBe(
      generateLorem("paragraphs", 3, true, 2)
    );
  });
});

describe("readability", () => {
  it("capitalises every sentence and ends it with a stop", () => {
    for (const s of generateLorem("sentences", 6).split(". ")) {
      expect(s[0]).toBe(s[0].toUpperCase());
    }
    expect(generateLorem("sentences", 3).endsWith(".")).toBe(true);
  });

  it("varies sentence length rather than emitting a fixed block", () => {
    // A generator that pastes the same passage fails this, and so does a layout
    // that only ever sees one shape of text.
    const lengths = generateLorem("sentences", 12, true, 7)
      .split(". ")
      .map((s) => s.split(/\s+/).length);
    expect(new Set(lengths).size).toBeGreaterThan(1);
  });
});
