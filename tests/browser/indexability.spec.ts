import { expect, test } from "@playwright/test";
import { publicTools, TOOLS } from "../../src/lib/tools/registry";
import { TOOLS_SECTION_LIVE } from "../../src/lib/tools/section-flag";

/**
 * The indexation surface: robots.txt and both sitemaps.
 *
 * This is the part of the platform with no visible failure mode. A tool page
 * can be perfect and earn nothing because it is absent from the sitemap, or
 * because a `disallow` swallowed it, and nobody notices until a Search Console
 * report weeks later. Everything here is cheap to assert and expensive to
 * discover by other means.
 */

const ORIGIN = "https://kavithakanchana.me";

test.describe("robots.txt", () => {
  test("allows the surfaces the programme depends on", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Allow: /");
    // Social previews all resolve through /og. A disallow here silently breaks
    // every share card without breaking a single page.
    expect(body).toContain("Allow: /og");

    if (TOOLS_SECTION_LIVE) {
      expect(body).toContain("Allow: /tools");
    } else {
      // The retired section must NOT be disallowed. The 410 is the removal
      // signal, and a crawler told not to fetch the URL never sees it — the
      // pages would sit as "Indexed, though blocked by robots.txt" instead of
      // dropping out. Blocking is the slower way to disappear.
      expect(body).not.toContain("Disallow: /tools");
    }
  });

  test("blocks the private surfaces and only those", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /api/admin");

    // Deleted routes must not be advertised. Naming a private path in
    // robots.txt tells anyone reading it exactly where to look.
    expect(body).not.toContain("/api/debug");
    expect(body).not.toContain("/publish-blog");
  });

  test("declares both sitemaps", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain(`${ORIGIN}/sitemap.xml`);
    // Separate submission is the only way Search Console will report indexation
    // for the tools cohort on its own, which is what Gate 1 measures.
    expect(body).toContain(`${ORIGIN}/sitemap-tools.xml`);
  });

  test("does not disallow any tool URL", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    const disallowed = [...body.matchAll(/^Disallow:\s*(.+)$/gm)].map((m) =>
      m[1].trim()
    );
    for (const tool of publicTools()) {
      for (const rule of disallowed) {
        expect(
          `/tools/${tool.slug}`.startsWith(rule),
          `robots.txt disallows /tools/${tool.slug} via "${rule}"`
        ).toBe(false);
      }
    }
  });
});

test.describe("sitemaps", () => {
  test("the tools sitemap lists every public tool exactly once", async ({
    request,
  }) => {
    test.skip(!TOOLS_SECTION_LIVE, "the /tools section is retired");
    const xml = await (await request.get("/sitemap-tools.xml")).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    for (const tool of publicTools()) {
      const expected = `${ORIGIN}/tools/${tool.slug}`;
      expect(
        urls.filter((u) => u === expected).length,
        `${expected} should appear exactly once`
      ).toBe(1);
    }
  });

  test("no draft, beta or deprecated tool leaks into a sitemap", async ({
    request,
  }) => {
    // A sitemap listing a noindex URL is a Search Console warning and burns
    // crawl budget this domain does not have.
    const xml =
      (await (await request.get("/sitemap.xml")).text()) +
      (await (await request.get("/sitemap-tools.xml")).text());

    const nonPublic = TOOLS.filter((t) => t.status !== "stable");
    for (const tool of nonPublic) {
      expect(xml, `${tool.slug} is ${tool.status} but appears in a sitemap`).not.toContain(
        `/tools/${tool.slug}<`
      );
    }
  });

  test("the main sitemap carries the hub and the privacy page", async ({
    request,
  }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain(`${ORIGIN}/privacy</loc>`);
    if (TOOLS_SECTION_LIVE) {
      expect(xml).toContain(`${ORIGIN}/tools</loc>`);
    } else {
      // Advertising a URL that answers 410 is the fastest way to earn a Search
      // Console error.
      expect(xml).not.toContain(`${ORIGIN}/tools`);
    }
  });

  test("both sitemaps are well-formed XML with escaped entities", async ({
    request,
  }) => {
    for (const path of ["/sitemap.xml", "/sitemap-tools.xml"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const xml = await res.text();
      expect(xml, path).toContain("<urlset");
      // A bare & would make the document invalid and the whole sitemap unreadable.
      expect(xml.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/), path).toBeNull();
    }
  });

  test("every URL in the tools sitemap actually resolves", async ({ request }) => {
    test.skip(!TOOLS_SECTION_LIVE, "the /tools section is retired");
    const xml = await (await request.get("/sitemap-tools.xml")).text();
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
      m[1].replace(ORIGIN, "")
    );
    expect(paths.length).toBeGreaterThan(0);

    for (const path of paths) {
      const res = await request.get(path);
      expect(res.status(), `${path} is in the sitemap but returns ${res.status()}`).toBe(
        200
      );
    }
  });
});

// /privacy is a site page in its own right — it is linked from the footer and
// referenced by the blog. It is asserted outside the tools block so retiring
// the section cannot take its coverage with it.
test("the privacy page is reachable and indexable", async ({ page }) => {
  const res = await page.goto("/privacy");
  expect(res?.status()).toBe(200);
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots ?? "index").toContain("index");
  await expect(page.locator("h1")).toHaveText("Privacy");
});

test.describe("the tools hub", () => {
  test.skip(!TOOLS_SECTION_LIVE, "the /tools section is retired");

  test("states the availability and privacy terms", async ({ page }) => {
    await page.goto("/tools");
    const main = await page.locator("main").innerText();
    expect(main).toContain("as-is");
    expect(main).toContain("no guarantee");
    await expect(page.locator('a[href="/privacy"]').first()).toBeVisible();
  });

  test("every tool page links to the privacy page", async ({ page }) => {
    // The meta row claims "nothing uploaded". That claim should be one click
    // from the document that states it in full.
    for (const tool of publicTools().slice(0, 4)) {
      await page.goto(`/tools/${tool.slug}`);
      await expect(
        page.locator('a[href="/privacy"]').first(),
        `${tool.slug} does not link to /privacy`
      ).toBeVisible();
    }
  });
});

/**
 * The retirement itself, asserted rather than assumed.
 *
 * Switching a section off is the kind of change that looks done and silently
 * is not — a matcher that misses a path, a page that still renders, a link left
 * in the homepage HTML. These run only while the flag is off, and they are what
 * proves the section is actually gone from production.
 */
test.describe("the retired /tools section", () => {
  test.skip(TOOLS_SECTION_LIVE, "the /tools section is live");

  test("the hub, a tool page and a category page all answer 410", async ({
    request,
  }) => {
    const paths = ["/tools", "/tools/percentage-calculator", "/tools/category/text"];
    for (const path of paths) {
      const res = await request.get(path);
      expect(res.status(), `${path} should be 410 Gone`).toBe(410);
    }
  });

  test("the 410 page is not indexable", async ({ page }) => {
    const res = await page.goto("/tools");
    expect(res?.status()).toBe(410);
    expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("the homepage no longer links into the section", async ({ page }) => {
    // `hidden` would not be enough: the markup would still ship and a crawler
    // would still follow the links. The section must not render at all.
    await page.goto("/");
    expect(await page.locator("a[href^='/tools']").count()).toBe(0);
    expect(await page.locator("#tools").count()).toBe(0);
  });

  test("the tools sitemap is empty but still valid", async ({ request }) => {
    // Kept rather than deleted: it stays submitted and parseable in Search
    // Console, so the cohort's history survives. 404ing a submitted sitemap
    // would not.
    const res = await request.get("/sitemap-tools.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<loc>");
  });
});
