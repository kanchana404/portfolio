import { describe, expect, it } from "vitest";
import { jsonLdHtml } from "../json-ld";
import { ogImageUrl } from "../og";
import { PERSON_ID, WEBSITE_ID } from "../site";
import { blogIndexJsonLd, blogPostingJsonLd, postImageUrls } from "./structured-data";
import type { Post } from "./validate";

const base: Post = {
  slug: "static-blog",
  title: "Shipping a static blog from Markdown",
  publishedAt: "2026-09-20",
  summary: "How this blog moved from a database to Markdown files in git.",
  tags: ["nextjs", "markdown"],
  kind: "post",
  file: "content/blog/static-blog.md",
  body: "",
  bodyLine: 7,
  bodyImages: [],
  images: {},
};

const posting = (post: Post) => blogPostingJsonLd(post)["@graph"][0] as Record<string, unknown>;

describe("blogPostingJsonLd", () => {
  it("points author and publisher at the site's Person", () => {
    const node = posting(base);
    expect(node.author).toEqual({ "@id": PERSON_ID });
    expect(node.publisher).toEqual({ "@id": PERSON_ID });
    expect(node["@id"]).toBe("https://kavithakanchana.me/blog/static-blog#post");
    expect(node.isPartOf).toEqual({ "@id": "https://kavithakanchana.me/blog#collection" });
  });

  it("uses the /og card as the first image without a cover, and the cover with one", () => {
    expect(posting(base).image).toEqual([ogImageUrl("blog", base.title)]);
    const withImages = {
      ...base,
      cover: "/blog/static-blog/cover.webp",
      bodyImages: ["/blog/static-blog/1.webp", "/blog/static-blog/2.webp", "/blog/static-blog/3.webp", "/blog/static-blog/4.webp", "/blog/static-blog/5.webp"],
    };
    expect(postImageUrls(withImages)).toEqual([
      "https://kavithakanchana.me/blog/static-blog/cover.webp",
      "https://kavithakanchana.me/blog/static-blog/1.webp",
      "https://kavithakanchana.me/blog/static-blog/2.webp",
      "https://kavithakanchana.me/blog/static-blog/3.webp",
      "https://kavithakanchana.me/blog/static-blog/4.webp",
    ]);
  });

  it("writes ISO dates, falling back to the publish date for dateModified", () => {
    expect(posting(base)).toMatchObject({
      datePublished: "2026-09-20T00:00:00.000Z",
      dateModified: "2026-09-20T00:00:00.000Z",
    });
    expect(posting({ ...base, updatedAt: "2026-09-25" }).dateModified).toBe("2026-09-25T00:00:00.000Z");
  });

  it("adds keywords only with tags, and articleSection only for digests", () => {
    expect(posting(base).keywords).toBe("nextjs, markdown");
    expect(posting({ ...base, tags: [] })).not.toHaveProperty("keywords");
    expect(posting(base)).not.toHaveProperty("articleSection");
    expect(posting({ ...base, kind: "digest" }).articleSection).toBe("Weekly digest");
  });

  it("ends the breadcrumb at the post", () => {
    const crumbs = blogPostingJsonLd(base)["@graph"][1] as { itemListElement: Array<Record<string, unknown>> };
    expect(crumbs.itemListElement.map((c) => [c.position, c.name, c.item])).toEqual([
      [1, "Home", "https://kavithakanchana.me"],
      [2, "Blog", "https://kavithakanchana.me/blog"],
      [3, base.title, "https://kavithakanchana.me/blog/static-blog"],
    ]);
  });

  it("survives the escaper: a hostile title round-trips as data", () => {
    const data = blogPostingJsonLd({ ...base, title: "AI news </script><script>alert(1)</script>" });
    const html = jsonLdHtml(data);
    expect(html).not.toMatch(/<\/\s*script/i);
    expect(JSON.parse(html)).toEqual(data);
  });
});

describe("blogIndexJsonLd", () => {
  it("has no ItemList while the blog is empty", () => {
    const page = blogIndexJsonLd([])["@graph"][0];
    expect(page).toMatchObject({
      "@type": "CollectionPage",
      "@id": "https://kavithakanchana.me/blog#collection",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": PERSON_ID },
    });
    expect(page).not.toHaveProperty("mainEntity");
  });

  it("lists the posts in order", () => {
    const page = blogIndexJsonLd([base, { ...base, slug: "older", title: "Older" }])["@graph"][0] as {
      mainEntity: { itemListElement: Array<Record<string, unknown>> };
    };
    expect(page.mainEntity.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, url: "https://kavithakanchana.me/blog/static-blog", name: base.title },
      { "@type": "ListItem", position: 2, url: "https://kavithakanchana.me/blog/older", name: "Older" },
    ]);
    const data = blogIndexJsonLd([base]);
    expect(JSON.parse(jsonLdHtml(data))).toEqual(data);
  });
});
