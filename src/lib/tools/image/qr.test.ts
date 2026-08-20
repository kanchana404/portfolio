import { describe, expect, it } from "vitest";
import { CORRECTION_LEVELS, MAX_QR_CHARS, checkInput, looksLikeUrl } from "./qr";

describe("the four correction levels", () => {
  it("offers exactly L, M, Q and H", () => {
    expect(CORRECTION_LEVELS.map((l) => l.id)).toEqual(["L", "M", "Q", "H"]);
  });

  it("states what each recovers, since that is what the level means", () => {
    // "High" sounds like better quality. It is not: it is more redundancy, and
    // therefore a denser grid. Saying the percentage is what makes that legible.
    for (const l of CORRECTION_LEVELS) {
      expect(l.recovers).toMatch(/%$/);
      expect(l.note.length).toBeGreaterThan(10);
    }
  });
});

describe("what it refuses and what it warns about", () => {
  it("refuses empty input", () => {
    expect(checkInput("", "M").ok).toBe(false);
    expect(checkInput("   ", "M").ok).toBe(false);
  });

  it("refuses input too long to scan", () => {
    const out = checkInput("x".repeat(MAX_QR_CHARS + 1), "M");
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/too fine|characters/);
  });

  it("warns rather than refuses when high correction meets long input", () => {
    // This is the trap: it produces a valid code that scans badly, so refusing
    // would be wrong and saying nothing would be worse.
    const out = checkInput("x".repeat(400), "H");
    expect(out.ok).toBe(true);
    expect(out.hint).toMatch(/dense/);
  });

  it("stays quiet when the combination is fine", () => {
    expect(checkInput("https://example.com", "H").hint).toBeUndefined();
    expect(checkInput("x".repeat(400), "M").hint).toBeUndefined();
  });
});

describe("recognising a URL", () => {
  it("accepts http and https only", () => {
    expect(looksLikeUrl("https://kavithakanchana.me")).toBe(true);
    expect(looksLikeUrl("http://example.com/a?b=c")).toBe(true);
    expect(looksLikeUrl("kavithakanchana.me")).toBe(false);
    expect(looksLikeUrl("javascript:alert(1)")).toBe(false);
    expect(looksLikeUrl("hello world")).toBe(false);
  });
});
