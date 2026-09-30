import { expect, test } from "@playwright/test";

/**
 * The blog as a production build serves it: statically generated from
 * content/blog, with an RSS feed and no page that exists only at request time.
 *
 * The per-post checks walk the feed, so they cover every published post and
 * do nothing while the blog is empty.
 */

const ORIGIN = "https://kavithakanchana.me";

/** An & that starts no entity makes the whole feed unparseable. */
const BARE_AMP = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/;

test.describe("the blog", () => {
  test("the index is static and advertises the feed", async ({ page }) => {
    const res = await page.goto("/blog");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Blog");
    const feed = page.locator('link[rel="alternate"][type="application/rss+xml"]');
    await expect(feed).toHaveAttribute("href", /\/blog\/rss\.xml$/);
    // Pagination by query string would make the page dynamic.
    expect(await page.locator("a[href*='?page=']").count()).toBe(0);
  });

  test("the feed is valid RSS", async ({ request }) => {
    const res = await request.get("/blog/rss.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/rss+xml");
    const xml = await res.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml.match(BARE_AMP)).toBeNull();
  });

  test("an unknown slug is a 404", async ({ request }) => {
    const res = await request.get("/blog/does-not-exist");
    expect(res.status()).toBe(404);
  });

  test("every post in the feed is complete", async ({ page, request }) => {
    const xml = await (await request.get("/blog/rss.xml")).text();
    const links = [...xml.matchAll(/<link>([^<]+)<\/link>/g)]
      .map((m) => m[1])
      .filter((url) => url.startsWith(`${ORIGIN}/blog/`));

    for (const url of links) {
      const path = url.replace(ORIGIN, "");
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute("href", url);
      await expect(page.locator('meta[property="og:image"]').first(), path).toHaveAttribute("content", /.+/);
      const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(ld.join("\n"), path).toContain("BlogPosting");

      const images = page.locator("article img");
      for (let i = 0; i < (await images.count()); i++) {
        const img = images.nth(i);
        await expect(img, path).toHaveAttribute("width", /^\d+$/);
        await expect(img, path).toHaveAttribute("height", /^\d+$/);
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)), {
            message: `${path} image ${i + 1} did not load`,
          })
          .toBeGreaterThan(0);
      }

      expect(await page.locator("body").innerText(), path).not.toContain("TODO");
    }
  });
});
