import { describe, expect, it } from "vitest";
import { escapeXml, xmlText } from "../xml";
import { buildRssXml } from "./feed";
import type { PostMeta } from "./validate";

const meta = (slug: string, publishedAt: string, extra: Partial<PostMeta> = {}): PostMeta => ({
  slug,
  title: `Post ${slug}`,
  publishedAt,
  summary: `A summary of ${slug} that is long enough to be a real one.`,
  tags: [],
  kind: "post",
  ...extra,
});

/** The same check as tests/browser/indexability.spec.ts: an & that starts no entity. */
const BARE_AMP = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/;

describe("buildRssXml", () => {
  it("is a valid channel with no items and no lastBuildDate when the blog is empty", () => {
    const xml = buildRssXml([]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"')).toBe(true);
    expect(xml).toContain("<title>Kavitha Kanchana: Blog</title>");
    expect(xml).toContain("<link>https://kavithakanchana.me/blog</link>");
    expect(xml).toContain(
      '<atom:link href="https://kavithakanchana.me/blog/rss.xml" rel="self" type="application/rss+xml"/>'
    );
    expect(xml).not.toContain("<item>");
    expect(xml).not.toContain("<lastBuildDate>");
    expect(xml.trimEnd().endsWith("</channel>\n</rss>")).toBe(true);
  });

  it("writes one item per post, with RFC 822 dates and a category per tag", () => {
    const xml = buildRssXml([meta("second", "2026-09-28", { tags: ["ai", "web-dev"] }), meta("first", "2026-09-21")]);
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("<link>https://kavithakanchana.me/blog/second</link>");
    expect(xml).toContain('<guid isPermaLink="true">https://kavithakanchana.me/blog/second</guid>');
    expect(xml).toContain("<pubDate>Mon, 28 Sep 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<category>ai</category>\n      <category>web-dev</category>");
    expect(xml.indexOf("/blog/second<")).toBeLessThan(xml.indexOf("/blog/first<"));
  });

  it("dates the channel by its newest post or update, never the clock", () => {
    const posts = [meta("a", "2026-09-28"), meta("b", "2026-09-01", { updatedAt: "2026-09-30" })];
    expect(buildRssXml(posts)).toContain("<lastBuildDate>Wed, 30 Sep 2026 00:00:00 GMT</lastBuildDate>");
    expect(buildRssXml(posts)).toBe(buildRssXml(posts));
  });

  it("escapes markup and drops characters XML cannot carry", () => {
    const xml = buildRssXml([
      meta("tricky", "2026-09-28", {
        title: `Tom & Jerry's <script>"quoted"</script>`,
        summary: "A bell \u0007 and a form feed \u000c inside a summary, which XML 1.0 forbids.",
      }),
    ]);
    expect(xml).toContain("<title>Tom &amp; Jerry&apos;s &lt;script&gt;&quot;quoted&quot;&lt;/script&gt;</title>");
    expect(xml).not.toMatch(/[\u0007\u000c]/);
    expect(xml).not.toContain("<script>");
    expect(xml.match(BARE_AMP)).toBeNull();
  });

  it("applies the limit", () => {
    const posts = Array.from({ length: 60 }, (_, i) => meta(`post-${i}`, "2026-09-28"));
    expect(buildRssXml(posts).match(/<item>/g)).toHaveLength(50);
    expect(buildRssXml(posts, { limit: 3 }).match(/<item>/g)).toHaveLength(3);
  });
});

describe("xml helpers", () => {
  it("escapeXml escapes the five entities, & first", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
    expect(escapeXml("&amp;")).toBe("&amp;amp;");
  });

  it("xmlText keeps tab, LF, CR and astral characters, and drops the rest", () => {
    expect(xmlText("a\tb\nc\rd")).toBe("a\tb\nc\rd");
    expect(xmlText("a\u0000b\u001fc￾d￿e")).toBe("abcde");
    expect(xmlText("rocket \u{1F680}")).toBe("rocket \u{1F680}");
    expect(xmlText("lone \ud800 half")).toBe("lone  half");
    expect(xmlText("<a & b>")).toBe("&lt;a &amp; b&gt;");
  });
});
