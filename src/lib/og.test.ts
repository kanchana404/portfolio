import { describe, expect, it } from "vitest";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { OG_TITLE_MAX, normaliseOgTitle, ogImageUrl } from "./og";

describe("normaliseOgTitle", () => {
  it("leaves an ordinary title untouched", () => {
    expect(normaliseOgTitle("Percentage Calculator")).toBe(
      "Percentage Calculator"
    );
  });

  it("preserves ASCII punctuation", () => {
    // Regression guard. An earlier draft used a control-character class that
    // degenerated into the range space-to-hyphen and silently ate every one of
    // these characters. If this test fails, that bug is back.
    const punctuation = `!"#$%&'()*+,-./:;<=>?@[]^_{|}~`;
    expect(normaliseOgTitle(punctuation)).toBe(punctuation);
  });

  it("collapses runs of whitespace to a single space", () => {
    expect(normaliseOgTitle("a   \t  b")).toBe("a b");
  });

  it("replaces control characters with a space and collapses the result", () => {
    const NUL = String.fromCharCode(0x00);
    const DEL = String.fromCharCode(0x7f);
    const C1 = String.fromCharCode(0x9f);
    const VT = String.fromCharCode(0x0b);

    expect(normaliseOgTitle(`a${NUL}b`)).toBe("a b");
    expect(normaliseOgTitle(`a${DEL}b`)).toBe("a b");
    expect(normaliseOgTitle(`a${C1}b`)).toBe("a b");
    expect(normaliseOgTitle(`a${VT}b`)).toBe("a b");
    expect(normaliseOgTitle("a\n\n\n\nb")).toBe("a b");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normaliseOgTitle("  spaced  ")).toBe("spaced");
  });

  it("falls back to the site owner's name for an empty or blank title", () => {
    expect(normaliseOgTitle("")).toBe(SITE_NAME);
    expect(normaliseOgTitle("     ")).toBe(SITE_NAME);
    expect(normaliseOgTitle("\n\t\r")).toBe(SITE_NAME);
  });

  it("accepts a title of exactly the maximum length unchanged", () => {
    const exact = "x".repeat(OG_TITLE_MAX);
    expect(normaliseOgTitle(exact)).toBe(exact);
  });

  it("clamps an over-long title and appends a single ellipsis", () => {
    const long = "y".repeat(OG_TITLE_MAX + 50);
    const out = normaliseOgTitle(long);
    expect(out.endsWith("…")).toBe(true);
    expect([...out].length).toBe(OG_TITLE_MAX + 1);
  });

  it("does not split an astral character when clamping", () => {
    // Each rocket is two UTF-16 units. Slicing by unit would leave a lone
    // surrogate, which renders as a replacement glyph and — worse — makes two
    // visually identical titles produce different cache keys.
    const rockets = "🚀".repeat(OG_TITLE_MAX + 10);
    const out = normaliseOgTitle(rockets);
    expect(out).not.toContain("�");
    for (const ch of out) {
      expect(ch === "🚀" || ch === "…").toBe(true);
    }
  });

  it("is idempotent", () => {
    // The route re-normalises whatever arrives on the wire. If normalising a
    // normalised title changed it, a caller-built URL and the route's own view
    // of that URL would disagree and the cache key would be unstable.
    for (const input of ["a\n\nb", "  x  ", "z".repeat(200), "🚀".repeat(200)]) {
      const once = normaliseOgTitle(input);
      expect(normaliseOgTitle(once)).toBe(once);
    }
  });
});

describe("ogImageUrl", () => {
  it("builds an absolute URL on the site origin", () => {
    const url = new URL(ogImageUrl("tool", "Percentage Calculator"));
    expect(url.origin).toBe(new URL(SITE_URL).origin);
    expect(url.pathname).toBe("/og");
  });

  it("carries kind, normalised title and a version", () => {
    const url = new URL(ogImageUrl("blog", "  Hello   world  "));
    expect(url.searchParams.get("kind")).toBe("blog");
    expect(url.searchParams.get("title")).toBe("Hello world");
    expect(url.searchParams.get("v")).toBeTruthy();
  });

  it("percent-encodes characters that would otherwise break the query string", () => {
    const url = ogImageUrl("tool", "A&B=C?D#E");
    expect(url).not.toContain("A&B=C?D#E");
    expect(new URL(url).searchParams.get("title")).toBe("A&B=C?D#E");
  });

  it("produces a stable URL for the same input", () => {
    expect(ogImageUrl("tool", "Stable")).toBe(ogImageUrl("tool", "Stable"));
  });

  it("produces different URLs for different kinds", () => {
    expect(ogImageUrl("tool", "Same")).not.toBe(ogImageUrl("blog", "Same"));
  });
});
