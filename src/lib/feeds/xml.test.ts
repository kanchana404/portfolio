import { describe, expect, it } from "vitest";
import { decodeEntities, decodeXmlBytes, parseDate, parseFeed, parseSitemap } from "./xml";

/** Inline fixtures only: the suite never touches the network. */

const NOW = new Date("2026-10-01T00:00:00Z");
const BASE = "https://example.com/feed.xml";

const rss = (items: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Feed</title>${items}</channel></rss>`;

describe("parseFeed: RSS", () => {
  it("reads title, link, date, description and content, CDATA included", () => {
    const { kind, entries } = parseFeed(
      rss(`<item>
        <title><![CDATA[Next.js 16 & friends]]></title>
        <link>https://example.com/a</link>
        <pubDate>Wed, 30 Sep 2026 18:00:00 GMT</pubDate>
        <description><![CDATA[<p>The <b>release</b> is out.</p>]]></description>
        <content:encoded><![CDATA[<p>Full text.</p>]]></content:encoded>
      </item>`),
      BASE,
      10,
      NOW
    );
    expect(kind).toBe("rss");
    expect(entries).toEqual([
      {
        title: "Next.js 16 & friends",
        link: "https://example.com/a",
        date: "2026-09-30T18:00:00.000Z",
        summary: "<p>The <b>release</b> is out.</p>",
        content: "<p>Full text.</p>",
      },
    ]);
  });

  it("reads an RFC 822 date with a zone name, and falls back to dc:date", () => {
    const { entries } = parseFeed(
      rss(
        "<item><title>A</title><link>https://example.com/a</link><pubDate>Tue, 29 Sep 2026 10:00:00 PDT</pubDate></item>" +
          "<item><title>B</title><link>https://example.com/b</link><dc:date>2026-09-28T08:00:00Z</dc:date></item>"
      ),
      BASE,
      10,
      NOW
    );
    expect(entries.map((e) => e.date)).toEqual(["2026-09-29T17:00:00.000Z", "2026-09-28T08:00:00.000Z"]);
  });

  it("falls back to a permalink guid, and ignores one marked isPermaLink=false", () => {
    const { entries } = parseFeed(
      rss(
        '<item><title>A</title><guid isPermaLink="true">https://example.com/a</guid></item>' +
          '<item><title>B</title><guid isPermaLink="false">https://example.com/b</guid></item>'
      ),
      BASE,
      10,
      NOW
    );
    expect(entries.map((e) => e.link)).toEqual(["https://example.com/a", null]);
  });

  it("does not take <media:title> for <title>", () => {
    const { entries } = parseFeed(
      rss("<item><media:title>Wrong</media:title><title>Right</title><link>https://example.com/a</link></item>"),
      BASE,
      10,
      NOW
    );
    expect(entries[0].title).toBe("Right");
  });

  it("ignores items inside comments, and CDATA that looks like markup", () => {
    const { entries } = parseFeed(
      rss(
        "<!-- <item><title>Hidden</title></item> -->" +
          "<item><title><![CDATA[Uses <item> and --> in text]]></title><link>https://example.com/a</link></item>"
      ),
      BASE,
      10,
      NOW
    );
    expect(entries.map((e) => e.title)).toEqual(["Uses <item> and --> in text"]);
  });

  it("resolves a relative link against the feed URL", () => {
    const { entries } = parseFeed(rss("<item><title>A</title><link>/blog/a</link></item>"), BASE, 10, NOW);
    expect(entries[0].link).toBe("https://example.com/blog/a");
  });

  it("reads RSS 1.0 (RDF)", () => {
    const { kind, entries } = parseFeed(
      '<rdf:RDF xmlns:rdf="x"><item rdf:about="https://example.com/a"><title>A</title><dc:date>2026-09-30T00:00:00Z</dc:date></item></rdf:RDF>',
      BASE,
      10,
      NOW
    );
    expect(kind).toBe("rss");
    expect(entries[0]).toMatchObject({ title: "A", link: "https://example.com/a" });
  });

  it("honours maxEntries", () => {
    const items = Array.from({ length: 20 }, (_, i) => `<item><title>${i}</title></item>`).join("");
    expect(parseFeed(rss(items), BASE, 5, NOW).entries).toHaveLength(5);
  });
});

describe("parseFeed: Atom", () => {
  const atom = (entries: string) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${entries}</feed>`;

  it("prefers the alternate link over self, and resolves relative hrefs", () => {
    const { kind, entries } = parseFeed(
      atom(`<entry>
        <title type="html">A &lt;b&gt;bold&lt;/b&gt; title</title>
        <link rel="self" href="https://example.com/self"/>
        <link rel="alternate" type="text/html" href="/posts/a"/>
        <published>2026-09-30T10:00:00Z</published>
        <updated>2026-09-30T12:00:00Z</updated>
        <summary>Short</summary>
        <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Full <code>x</code></p></div></content>
      </entry>`),
      "https://example.com/atom",
      10,
      NOW
    );
    expect(kind).toBe("atom");
    expect(entries[0]).toEqual({
      title: "A <b>bold</b> title",
      link: "https://example.com/posts/a",
      date: "2026-09-30T10:00:00.000Z",
      summary: "Short",
      content: '<div xmlns="http://www.w3.org/1999/xhtml"><p>Full <code>x</code></p></div>',
    });
  });

  it("hands every text construct over as HTML: text escaped, xhtml as markup, other media types dropped", () => {
    const { entries } = parseFeed(
      atom(`<entry>
        <title type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">Hello <b>world</b> &amp; more</div></title>
        <link href="https://example.com/a"/>
        <updated>2026-09-29T00:00:00Z</updated>
        <summary>Use &lt;Suspense&gt; &amp; <![CDATA[<Image>]]> today</summary>
        <content type="image/png">iVBORw0KGgo=</content>
      </entry>`),
      BASE,
      10,
      NOW
    );
    expect(entries[0]).toMatchObject({
      title: "Hello world &amp; more",
      summary: "Use &lt;Suspense&gt; &amp; &lt;Image&gt; today",
      content: null,
    });
  });

  it("uses updated when there is no published date, and a link with no rel", () => {
    const { entries } = parseFeed(
      atom('<entry><title>A</title><link href="https://example.com/a"/><updated>2026-09-29T00:00:00Z</updated></entry>'),
      BASE,
      10,
      NOW
    );
    expect(entries[0]).toMatchObject({ link: "https://example.com/a", date: "2026-09-29T00:00:00.000Z" });
  });
});

describe("parseFeed: hostile input", () => {
  it("never expands a DTD: a billion-laughs DOCTYPE stays inert and fast", () => {
    const bomb =
      '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">' +
      '<!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">]>' +
      "<rss><channel><item><title>&lol3;</title><link>https://example.com/a</link></item></channel></rss>";
    const started = performance.now();
    const { entries } = parseFeed(bomb, BASE, 10, NOW);
    expect(performance.now() - started).toBeLessThan(50);
    expect(entries[0].title).toBe("&lol3;");
  });

  it("stays linear on 1,000 unclosed items", () => {
    const input = rss("<item><title>x</title>".repeat(1000) + "a".repeat(200_000));
    const started = performance.now();
    parseFeed(input, BASE, 2000, NOW);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("stays linear on thousands of unclosed comments and CDATA sections", () => {
    const input = rss("<!-- x ".repeat(5000) + "<![CDATA[ y ".repeat(5000));
    const started = performance.now();
    expect(parseFeed(input, BASE, 10, NOW).entries).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("stays linear on unterminated open tags and a long attribute name", () => {
    for (const input of [
      rss("<item ".repeat(100_000)),
      rss(`<item>${"<title ".repeat(100_000)}</item>`),
      `<feed><entry>${"<link ".repeat(100_000)}</entry></feed>`,
      `<feed><entry><link ${"a".repeat(500_000)}/></entry></feed>`,
    ]) {
      const started = performance.now();
      parseFeed(input, BASE, 10, NOW);
      expect(performance.now() - started).toBeLessThan(1000);
    }
  });

  it("cannot forge the CDATA markers with private-use characters", () => {
    const { entries } = parseFeed(
      rss("<item><title>0 real</title><link>https://example.com/a</link></item>"),
      BASE,
      10,
      NOW
    );
    expect(entries[0].title).toBe("0 real");
  });

  it("returns nothing for a document that is not a feed", () => {
    expect(parseFeed("<html><body><item>x</item></body></html>", BASE, 10, NOW)).toEqual({ kind: "unknown", entries: [] });
  });
});

describe("parseSitemap", () => {
  it("reads a urlset with and without lastmod", () => {
    const { kind, urls } = parseSitemap(
      '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        "<url><loc>https://example.com/news/a</loc><lastmod>2026-09-28T03:20:50.000Z</lastmod></url>" +
        "<url><loc>https://example.com/about</loc></url></urlset>",
      100,
      NOW
    );
    expect(kind).toBe("urlset");
    expect(urls).toEqual([
      { loc: "https://example.com/news/a", lastmod: "2026-09-28T03:20:50.000Z" },
      { loc: "https://example.com/about", lastmod: null },
    ]);
  });

  it("reads a sitemap index", () => {
    const { kind, urls } = parseSitemap(
      "<sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap></sitemapindex>",
      100,
      NOW
    );
    expect(kind).toBe("sitemapindex");
    expect(urls).toEqual([{ loc: "https://example.com/s1.xml", lastmod: null }]);
  });
});

describe("decodeEntities and decodeXmlBytes", () => {
  it("decodes the XML five, numeric references and a few HTML names", () => {
    expect(decodeEntities("&amp;&lt;&gt;&quot;&apos; &#8217;&#x2019; &nbsp;&hellip;&mdash;")).toBe(
      "&<>\"' ’’  …—"
    );
  });

  it("turns an invalid reference into U+FFFD and leaves unknown names alone", () => {
    expect(decodeEntities("&#0;&#xD800;&#x110000;&#27;")).toBe("����");
    expect(decodeEntities("&unknown; &amp")).toBe("&unknown; &amp");
  });

  it("decodes one level only: double escaping is sanitize.ts's job", () => {
    expect(decodeEntities("&amp;lt;p&amp;gt;")).toBe("&lt;p&gt;");
  });

  it("honours a UTF-8 BOM and an ISO-8859-1 declaration", () => {
    expect(decodeXmlBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x61, 0x3e]))).toBe("<a>");
    const latin1 = new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><t>');
    const bytes = new Uint8Array([...latin1, 0xe9, 0x3c, 0x2f, 0x74, 0x3e]);
    expect(decodeXmlBytes(bytes)).toContain("<t>é</t>");
  });

  it("falls back to UTF-8 for an unknown label", () => {
    const bytes = new TextEncoder().encode('<?xml version="1.0" encoding="x-nonsense"?><t>é</t>');
    expect(decodeXmlBytes(bytes)).toContain("<t>é</t>");
  });
});

describe("parseDate", () => {
  it("drops unparseable dates and dates more than two days ahead", () => {
    expect(parseDate("not a date", NOW)).toBeNull();
    expect(parseDate("2026-10-05T00:00:00Z", NOW)).toBeNull();
    expect(parseDate("2026-10-02T00:00:00Z", NOW)).toBe("2026-10-02T00:00:00.000Z");
    expect(parseDate(null, NOW)).toBeNull();
  });
});
