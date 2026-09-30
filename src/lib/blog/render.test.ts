import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderPostBody } from "./render";

const SRC = "/blog/static-blog/1-files.webp";
const post = {
  slug: "static-blog",
  images: { [SRC]: { src: SRC, width: 1536, height: 1024, bytes: 90_000 } },
};
const slugs = new Set(["static-blog", "other-post"]);

const html = (body: string) => renderToStaticMarkup(renderPostBody({ ...post, body }, slugs));

describe("renderPostBody", () => {
  it("turns an image on its own line into a figure with its title as the caption", () => {
    const out = html(`Intro.\n\n![Markdown files becoming pages](${SRC} "From file to page")\n\nAfter.`);
    expect(out).toContain(
      `<figure class="not-prose my-8"><img src="${SRC}" alt="Markdown files becoming pages" width="1536" height="1024" loading="lazy" decoding="async" class="h-auto w-full rounded-xl border border-border bg-muted"/>` +
        `<figcaption class="mt-3 text-sm leading-snug text-muted-foreground">From file to page</figcaption></figure>`
    );
    expect(out).not.toMatch(/<p>\s*<figure/);
    expect(out).not.toContain("title=");
  });

  it("has no figcaption when the image has no title", () => {
    const out = html(`![Markdown files becoming pages](${SRC})`);
    expect(out).toContain('<figure class="not-prose my-8"><img');
    expect(out).not.toContain("<figcaption");
    expect(out).not.toContain("<p>");
  });

  it("keeps heading levels and gives h2 and h3 ids, numbering repeats", () => {
    const out = html("## Hello world\n\n### Details\n\n## Hello world\n\n## Hello world 2");
    expect(out).toContain('<h2 id="hello-world" class="scroll-mt-24">Hello world</h2>');
    expect(out).toContain('<h3 id="details" class="scroll-mt-24">Details</h3>');
    expect(out).toContain('<h2 id="hello-world-2" class="scroll-mt-24">Hello world</h2>');
    // A heading whose own slug is already taken is numbered too, never a duplicate id.
    expect(out).toContain('<h2 id="hello-world-2-2" class="scroll-mt-24">Hello world 2</h2>');
  });

  it("never gives a heading an id the page or GFM already uses", () => {
    const out = html("## Main content\n\n## Footnote label\n\nText.[^1]\n\n[^1]: A note.");
    expect(out).toContain('<h2 id="main-content-2" class="scroll-mt-24">Main content</h2>');
    expect(out).toContain('<h2 id="footnote-label-2" class="scroll-mt-24">Footnote label</h2>');
    // GFM's hidden footnotes heading keeps its class and the id its references point at.
    expect(out).toContain('aria-describedby="footnote-label"');
    expect(out).toContain('<h2 class="sr-only scroll-mt-24" id="footnote-label">Footnotes</h2>');
  });

  it("refuses an H1 and a heading that skips a level", () => {
    expect(() => html("# Top")).toThrow(/an H1 in the body/);
    expect(() => html("### Starts at h3")).toThrow(/an h3 after an h1 skips a heading level/);
    expect(() => html("## Fine\n\n#### Skipped a level")).toThrow(/an h4 after an h2/);
    // A heading inside a list is invisible to the gate's line rules, not to this.
    expect(() => html("- # Inside a list")).toThrow(/an H1 in the body/);
    expect(() => html("## One\n\n### Two\n\n#### Three\n\n## Back up")).not.toThrow();
  });

  it("opens external links in a new tab and keeps internal ones in place", () => {
    const out = html("[a](https://example.com/x) [b](/blog/other-post) [c](#hello) [d](/blog/rss.xml)");
    expect(out).toContain('<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">a</a>');
    expect(out).toContain('<a href="/blog/other-post">b</a>');
    expect(out).toContain('<a href="#hello">c</a>');
    expect(out).toContain('<a href="/blog/rss.xml">d</a>');
  });

  it("refuses raw HTML and HTML comments, however their lines are split", () => {
    for (const body of [
      "Before <script>alert(1)</script> after.",
      '<img src="x" onerror="alert(1)">',
      "Text.\n\n<!--\nNote to self: check the numbers with Sam before this goes live\n-->",
      '<aside\n  class="note">Draft remark</aside\n>',
    ]) {
      expect(() => html(body), body).toThrow(/raw HTML or an HTML comment/);
    }
  });

  it("names the file line of what it refuses", () => {
    const render = () =>
      renderToStaticMarkup(renderPostBody({ ...post, bodyLine: 7, body: "Intro.\n\n<!--\nnote\n-->" }, slugs));
    expect(render).toThrow(/^blog prose: static-blog:9: /);
  });

  it("refuses placeholders in prose the gate's line rules could misread as code", () => {
    for (const body of [
      // A backtick in the info string: not a fence, so this is all prose.
      "``` x`\n\n{{headline}}\n\n```",
      // A fence in a list item ends with the item.
      "- Install it:\n  ```sh\n  pnpm add x\n\nRead more {{SUMMARY}}.",
      // Escaped backticks are not code.
      "The subtitle is \\`{{SUBTITLE}}\\` for now.",
      "Shipped in week NN.",
      "Intro.\n\n...\n\nOutro.",
      "| Tool | Notes |\n| - | - |\n| x | {{NOTES}} |",
    ]) {
      expect(() => html(body), body).toThrow(/blog prose: static-blog:\d+: /);
    }
    // Code keeps them.
    expect(() => html("Use `{{name}}` and `<div>`.\n\n```html\n<div>{{name}}</div>\n```")).not.toThrow();
  });

  it("throws on a link outside the policy", () => {
    expect(() => html("[x](javascript:alert(1))")).toThrow(/blog link policy/);
    expect(() => html("[x](/blog/unknown-post)")).toThrow(/blog link policy/);
    expect(() => html("[x](http://example.com)")).toThrow(/blog link policy/);
  });

  it("throws on an image that is not in the post's folder", () => {
    expect(() => html("![Some other picture](/blog/static-blog/9-missing.webp)")).toThrow(/blog image/);
    expect(() => html("![A remote picture](https://example.com/a.webp)")).toThrow(/blog image/);
    // Names every plain object has are not files.
    for (const src of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(() => html(`![A picture of nothing](${src})`), src).toThrow(/blog image/);
    }
  });

  it("makes tables and code blocks keyboard-reachable horizontal scrollers", () => {
    const table = html("| Tool | Price |\n| - | - |\n| 1 | 2 |");
    expect(table).toMatch(
      /^<div class="my-7 overflow-x-auto [^"]*focus-visible:ring-2 focus-visible:ring-ring[^"]*" role="region" aria-label="Table: Tool, Price" tabindex="0" data-lenis-prevent-horizontal="true"><table class="my-0">/
    );
    const code = html("```ts\nconst x = 1;\n```");
    expect(code).toMatch(
      /^<pre tabindex="0" class="[^"]*focus-visible:ring-2 focus-visible:ring-ring[^"]*" data-lenis-prevent-horizontal="true"><code class="language-ts">/
    );
  });
});
