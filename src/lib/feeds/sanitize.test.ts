import { describe, expect, it } from "vitest";
import {
  cleanText,
  cleanUrl,
  htmlToText,
  isGenericDescription,
  isHiddenCodePoint,
  normalizeTitleKey,
  normalizeUrlKey,
  plainText,
  stripBoilerplate,
  stripInlineTags,
  summarizeContent,
} from "./sanitize";

describe("htmlToText", () => {
  it("drops script, style and similar blocks with their content", () => {
    expect(
      htmlToText('<p>Hi</p><script>alert("x")</script><style>p{}</style><SVG><text>no</text></SVG><p>there</p>').trim()
    ).toBe("Hi there");
  });

  it("drops everything after an unclosed script", () => {
    expect(htmlToText("<p>Kept</p><script>never closed <p>gone</p>")).toBe("Kept ");
  });

  it("strips tags and decodes entities, twice for double escaping", () => {
    expect(htmlToText("<p>A &amp; B</p>").trim()).toBe("A & B");
    // What a double-escaped feed hands over once the XML reader has decoded it.
    expect(cleanText(htmlToText("&lt;p&gt;Hello&lt;/p&gt; &amp;amp;"), 100)).toBe("Hello &");
  });

  it("never leaves an angle bracket behind", () => {
    expect(htmlToText("a < b > c &lt;script&gt;")).not.toMatch(/[<>]/);
  });

  it("keeps angle-bracket text the feed escaped on purpose, as ‹ and ›", () => {
    expect(cleanText(htmlToText("<p>Run <code>vercel flags versions &lt;flag&gt;</code> to print.</p>"), 200)).toBe(
      "Run vercel flags versions ‹flag› to print."
    );
    expect(cleanText(htmlToText("<p>AT&amp;T ships &lt;Image&gt; and R&amp;D.</p>"), 200)).toBe("AT&T ships ‹Image› and R&D.");
    expect(cleanText(htmlToText("<p>Pass &lt;input&gt; and &lt;path&gt;, then &lt;B&gt;bold&lt;/B&gt;</p>"), 200)).toBe(
      "Pass ‹input› and ‹path›, then bold"
    );
  });
});

describe("plainText", () => {
  it("makes an attribute value or a title plain without losing bracketed words", () => {
    expect(plainText("Use <Suspense> with <b>care</b> &amp; &lt;flag&gt;")).toBe("Use ‹Suspense› with care & ‹flag›");
  });
});

describe("stripInlineTags", () => {
  it("removes formatting tags and keeps other bracketed text", () => {
    expect(stripInlineTags("<em>Using</em> <code>Suspense</code> in <Suspense>")).toBe("Using Suspense in <Suspense>");
  });
});

describe("cleanText", () => {
  it("removes tag characters, bidi controls and zero-width characters", () => {
    const hidden = "Safe\u{E0049}\u{E0047}\u{E004E} text‮​﻿⁦here­";
    expect(cleanText(hidden, 100)).toBe("Safe texthere");
  });

  it("turns line breaks into spaces and collapses whitespace", () => {
    expect(cleanText("  a\n\n\tb c  ", 100)).toBe("a b c");
  });

  it("cuts on a word boundary with an ellipsis, never splitting a surrogate pair", () => {
    const out = cleanText("one two three four five six seven", 16);
    expect(out).toBe("one two three…");
    const emoji = cleanText("\u{1F600}".repeat(10), 5);
    expect([...emoji]).toHaveLength(5);
    expect(emoji.endsWith("…")).toBe(true);
    expect(emoji).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("normalises to NFC", () => {
    expect(cleanText("é", 10)).toBe("é");
  });

  it("classifies hidden code points numerically", () => {
    for (const code of [0x00, 0x1b, 0x7f, 0x9f, 0x200b, 0x202e, 0x2066, 0xfeff, 0xe0041, 0xe000, 0xf0000]) {
      expect(isHiddenCodePoint(code), code.toString(16)).toBe(true);
    }
    for (const code of [0x20, 0x41, 0xe9, 0x2019, 0x1f600]) {
      expect(isHiddenCodePoint(code), code.toString(16)).toBe(false);
    }
  });
});

describe("summarizeContent", () => {
  it("keeps whole sentences, and does not split inside version numbers", () => {
    const text = `Claude Sonnet 5.5 is now available in v1.2 of the SDK. ${"More words follow here. ".repeat(40)}`;
    const out = summarizeContent(text) ?? "";
    expect(out.startsWith("Claude Sonnet 5.5 is now available in v1.2 of the SDK.")).toBe(true);
    expect([...out].length).toBeLessThanOrEqual(600);
    expect(out.endsWith(".")).toBe(true);
  });

  it("returns short text as it is, and null for nothing", () => {
    expect(summarizeContent("Short. Text.")).toBe("Short. Text.");
    expect(summarizeContent("   ")).toBeNull();
  });
});

describe("stripBoilerplate and isGenericDescription", () => {
  it("stays linear on a long run of whitespace", () => {
    const started = performance.now();
    expect(stripBoilerplate(`${" ".repeat(200_000)}It shipped. […]`)).toBe("It shipped.");
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("removes WordPress's footer and a trailing read-more", () => {
    expect(stripBoilerplate("Trials are open. The post Trials appeared first on The GitHub Blog.")).toBe("Trials are open.");
    expect(stripBoilerplate("It shipped. […]")).toBe("It shipped.");
  });

  it("recognises descriptions that say nothing about the page", () => {
    expect(isGenericDescription("A Blog post by NVIDIA on Hugging Face")).toBe(true);
    expect(isGenericDescription("We’re on a journey to advance and democratize artificial intelligence through open source.")).toBe(true);
    expect(isGenericDescription("A new leaderboard for text to speech.")).toBe(false);
  });
});

describe("cleanUrl", () => {
  const include = ["https://vercel.com/blog/"];
  it("accepts an https link under an include prefix, without tracking or hash", () => {
    expect(cleanUrl("https://vercel.com/blog/x?utm_source=rss&ref=feed&id=2#top", "https://vercel.com/atom", include)).toBe(
      "https://vercel.com/blog/x?id=2"
    );
    expect(cleanUrl("/blog/y", "https://vercel.com/atom", include)).toBe("https://vercel.com/blog/y");
  });

  it.each([
    ["javascript:alert(1)"],
    ["data:text/html,hi"],
    ["http://vercel.com/blog/x"],
    ["https://user:pass@vercel.com/blog/x"],
    ["https://vercel.com:8443/blog/x"],
    ["https://vercel.com.evil.example/blog/x"],
    ["https://vercel.com/changelog/x"],
    [`https://vercel.com/blog/${"a".repeat(600)}`],
  ])("refuses %s", (raw) => {
    expect(cleanUrl(raw, "https://vercel.com/atom", include)).toBeNull();
  });

  it("escapes parentheses so a Markdown link stays one link", () => {
    expect(cleanUrl("https://vercel.com/blog/a_(b)", "https://vercel.com/atom", include)).toBe(
      "https://vercel.com/blog/a_%28b%29"
    );
  });
});

describe("normalizeUrlKey and normalizeTitleKey", () => {
  it("treats www, a trailing slash and query order as the same page", () => {
    expect(normalizeUrlKey("https://www.Example.com/a/?b=2&a=1")).toBe(normalizeUrlKey("https://example.com/a?a=1&b=2"));
    expect(normalizeUrlKey("https://example.com/a")).not.toBe(normalizeUrlKey("https://example.com/b"));
  });

  it("keeps letters and digits only", () => {
    expect(normalizeTitleKey("GPT-6.1 Sol: now on AI Gateway!")).toBe("gpt 6 1 sol now on ai gateway");
    expect(normalizeTitleKey("Café")).toBe("cafe");
  });
});
