import { describe, expect, it } from "vitest";
import { HEAD_MAX, extractMeta } from "./page-meta";

const NOW = new Date("2026-10-01T00:00:00Z");
const page = (head: string, body = "") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("extractMeta", () => {
  it("reads og tags in any attribute order and either quote style", () => {
    const meta = extractMeta(
      page(
        `<meta content="Agents &amp; tools" property="og:title"/>` +
          `<meta property='og:description' content='What &quot;shipped&quot; this week.'>` +
          `<meta property="article:published_time" content="2026-09-28T03:20:50.000Z"/>`
      ),
      NOW
    );
    expect(meta).toEqual({
      title: "Agents & tools",
      description: 'What "shipped" this week.',
      published: "2026-09-28T03:20:50.000Z",
    });
  });

  it("falls back to twitter, then name=description, then <title>", () => {
    expect(extractMeta(page('<meta name="twitter:description" content="From twitter">'), NOW).description).toBe("From twitter");
    expect(extractMeta(page('<meta name="description" content="Plain">'), NOW).description).toBe("Plain");
    expect(extractMeta(page("<title>The page \\ Site</title>"), NOW).title).toBe("The page \\ Site");
  });

  it("ignores meta tags after </head>", () => {
    const meta = extractMeta(page("<title>T</title>", '<meta property="og:description" content="In the body">'), NOW);
    expect(meta.description).toBeNull();
  });

  it("strips markup and hidden characters from values", () => {
    const meta = extractMeta(page('<meta property="og:description" content="&lt;b&gt;Bold&lt;/b&gt; text‮ here">'), NOW);
    expect(meta.description).toBe("Bold text here");
  });

  it("keeps text in angle brackets that the page escaped on purpose", () => {
    const meta = extractMeta(page('<meta property="og:description" content="Wrap it in &lt;Suspense&gt; and pass &lt;flag&gt;.">'), NOW);
    expect(meta.description).toBe("Wrap it in ‹Suspense› and pass ‹flag›.");
  });

  it("stays linear on unterminated meta and title tags", () => {
    for (const head of ["<meta ".repeat(100_000), "<title ".repeat(100_000), `<meta ${"a".repeat(400_000)}>`]) {
      const started = performance.now();
      extractMeta(page(head), NOW);
      expect(performance.now() - started).toBeLessThan(1000);
    }
  });

  it("drops a generic site-wide description", () => {
    const meta = extractMeta(page('<meta property="og:description" content="A Blog post by NVIDIA on Hugging Face">'), NOW);
    expect(meta.description).toBeNull();
  });

  it("is all null for a page with nothing", () => {
    expect(extractMeta("<html><body>hi</body></html>", NOW)).toEqual({ title: null, description: null, published: null });
  });

  it("reads no further than HEAD_MAX characters", () => {
    const meta = extractMeta(`${" ".repeat(HEAD_MAX)}<meta property="og:title" content="Too far">`, NOW);
    expect(meta.title).toBeNull();
  });
});
