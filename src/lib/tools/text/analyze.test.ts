import { describe, expect, it } from "vitest";
import { analyzeText, formatDuration, splitWords } from "./analyze";

describe("splitWords", () => {
  it("counts ordinary English words", () => {
    expect(splitWords("the quick brown fox")).toHaveLength(4);
  });

  it("counts Chinese, which has no spaces between words", () => {
    // The reason this uses Intl.Segmenter rather than a whitespace split: the
    // naive version reports this whole string as one word.
    const count = splitWords("我喜欢编程").length;
    expect(count).toBeGreaterThan(1);
  });

  it("counts Sinhala words", () => {
    expect(splitWords("මම ගෙදර යනවා").length).toBeGreaterThanOrEqual(3);
  });

  it("does not count punctuation or emoji as words", () => {
    expect(splitWords("hello, world! 🚀")).toHaveLength(2);
  });

  it("returns nothing for blank input", () => {
    expect(splitWords("")).toEqual([]);
    expect(splitWords("   \n  ")).toEqual([]);
  });
});

describe("analyzeText", () => {
  it("reports zero for everything on empty input", () => {
    const s = analyzeText("");
    expect(s.characters).toBe(0);
    expect(s.words).toBe(0);
    expect(s.sentences).toBe(0);
    expect(s.paragraphs).toBe(0);
    expect(s.longestWord).toBe("");
  });

  it("counts characters with and without spaces", () => {
    const s = analyzeText("ab cd");
    expect(s.characters).toBe(5);
    expect(s.charactersNoSpaces).toBe(4);
  });

  it("counts an emoji as one character, not two", () => {
    // A rocket is two UTF-16 units. Someone counting against a form limit means
    // what they can see.
    expect(analyzeText("🚀").characters).toBe(1);
  });

  it("counts sentences and collapses stacked terminators", () => {
    expect(analyzeText("One. Two! Three?").sentences).toBe(3);
    expect(analyzeText("Wait?! Really.").sentences).toBe(2);
  });

  it("counts paragraphs split by blank lines", () => {
    expect(analyzeText("one\n\ntwo\n\n\nthree").paragraphs).toBe(3);
    expect(analyzeText("single line").paragraphs).toBe(1);
  });

  it("counts lines including single-newline breaks", () => {
    expect(analyzeText("a\nb\nc").lines).toBe(3);
  });

  it("finds the longest word by code points", () => {
    expect(analyzeText("a bb ccc").longestWord).toBe("ccc");
  });

  it("derives reading and speaking time from the word count", () => {
    const words = Array.from({ length: 238 }, (_, i) => `w${i}`).join(" ");
    const s = analyzeText(words);
    expect(s.words).toBe(238);
    expect(s.readingMinutes).toBeCloseTo(1, 5);
    // Speaking is slower than reading, always.
    expect(s.speakingMinutes).toBeGreaterThan(s.readingMinutes);
  });
});

describe("formatDuration", () => {
  it("uses seconds below a minute", () => {
    expect(formatDuration(0.5)).toBe("30 sec");
    expect(formatDuration(0)).toBe("0 sec");
  });
  it("uses minutes, with seconds only when there are some", () => {
    expect(formatDuration(2)).toBe("2 min");
    expect(formatDuration(2.5)).toBe("2 min 30 sec");
  });
  it("rolls over into hours", () => {
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(90)).toBe("1 hr 30 min");
  });
  it("never returns NaN for degenerate input", () => {
    expect(formatDuration(Number.NaN)).toBe("0 sec");
    expect(formatDuration(-5)).toBe("0 sec");
  });
});
