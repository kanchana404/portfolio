import { describe, expect, it } from "vitest";
import { parseCardDate, parseListing } from "./listing";

/** Shaped like www.anthropic.com/news on 2026-10-01: featured cards with a heading, list rows without. */

const NOW = new Date("2026-10-01T00:00:00Z");
const BASE = "https://www.anthropic.com/news";
const INCLUDE = ["https://www.anthropic.com/"];

const PAGE = `<!doctype html><html><head><title>Newsroom</title></head><body>
<nav><a href="/company">Company</a><a href="/news">News</a></nav>
<a href="/claude-sonnet-5-5" class="FeaturedGrid__content"><h2 class="headline-4">Introducing Claude Sonnet 5.5</h2>
  <div><div class="meta"><span class="caption bold">Announcements</span><time class="date">Sep 28, 2026</time></div>
  <p class="body-3">A clear upgrade that runs faster.</p></div></a>
<a href="https://www.anthropic.com/features/ebola-response"><div class="meta"><time>Sep 22, 2026</time></div><h4>The Situation Report</h4></a>
<ul><li><a href="/news/claude-discovers-novel-enzyme-system" class="listItem"><div class="meta"><time class="date">Sep 23, 2026</time>
  <span class="subject">Science</span></div><span class="title"> Claude discovers a novel enzyme system</span></a></li>
<li><a href="/news/accenture-embedded-evaluation?utm_source=x#top"><time datetime="2026-09-18">Sep 18, 2026</time></a></li>
<li><a href="/claude-sonnet-5-5"><time>Sep 28, 2026</time></a></li>
<li><a href="https://evil.example/news/x"><time>Sep 27, 2026</time></a></li>
<li><a href="javascript:alert(1)"><time>Sep 27, 2026</time></a></li>
<li><a href="/news/undated"><span>No date</span></a></li>
<li><a href="/news/future"><time>Dec 25, 2026</time></a></li></ul>
<footer><a href="/legal">Legal</a></footer></body></html>`;

describe("parseListing", () => {
  it("reads each dated card once, with its heading when it has one, on the source's site only", () => {
    expect(parseListing(PAGE, BASE, INCLUDE, 100, NOW)).toEqual([
      { url: "https://www.anthropic.com/claude-sonnet-5-5", date: "2026-09-28T12:00:00.000Z", title: "Introducing Claude Sonnet 5.5" },
      { url: "https://www.anthropic.com/features/ebola-response", date: "2026-09-22T12:00:00.000Z", title: "The Situation Report" },
      { url: "https://www.anthropic.com/news/claude-discovers-novel-enzyme-system", date: "2026-09-23T12:00:00.000Z", title: null },
      { url: "https://www.anthropic.com/news/accenture-embedded-evaluation", date: "2026-09-18T12:00:00.000Z", title: null },
    ]);
  });

  it("honours max and the include prefixes", () => {
    expect(parseListing(PAGE, BASE, INCLUDE, 1, NOW)).toHaveLength(1);
    expect(parseListing(PAGE, BASE, ["https://www.anthropic.com/news/"], 100, NOW).map((c) => c.url)).toEqual([
      "https://www.anthropic.com/news/claude-discovers-novel-enzyme-system",
      "https://www.anthropic.com/news/accenture-embedded-evaluation",
    ]);
  });

  it("finds nothing on a page with no dated cards", () => {
    expect(parseListing("<html><body><a href='/a'>A</a></body></html>", BASE, INCLUDE, 100, NOW)).toEqual([]);
  });

  it("stays linear on unclosed links, times and headings", () => {
    for (const input of ["<a ".repeat(100_000), `<a href="/x">${"<time ".repeat(100_000)}</a>`, `<a href="/x"><time>Sep 1, 2026</time>${"<h2 ".repeat(100_000)}</a>`]) {
      const started = performance.now();
      parseListing(input, BASE, INCLUDE, 100, NOW);
      expect(performance.now() - started).toBeLessThan(1000);
    }
  });
});

describe("parseCardDate", () => {
  it("reads the listing's dates as noon UTC", () => {
    expect(parseCardDate("Sep 28, 2026", NOW)).toBe("2026-09-28T12:00:00.000Z");
    expect(parseCardDate("September 8 2026", NOW)).toBe("2026-09-08T12:00:00.000Z");
    expect(parseCardDate("Apr 08, 2026", NOW)).toBe("2026-04-08T12:00:00.000Z");
    expect(parseCardDate("2026-09-18", NOW)).toBe("2026-09-18T12:00:00.000Z");
    expect(parseCardDate("2026-09-18T03:00:00Z", NOW)).toBe("2026-09-18T03:00:00.000Z");
  });

  it("refuses what is not a real, past date", () => {
    for (const raw of ["Sep 31, 2026", "Foo 1, 2026", "Dec 25, 2026", "yesterday", ""]) {
      expect(parseCardDate(raw, NOW), raw).toBeNull();
    }
  });
});
