import { expect, test } from "@playwright/test";
import {
  MIN_TOOLS_FOR_INDEXABLE_CATEGORY,
  activeCategories,
  getToolsByCategory,
  publicTools,
} from "../../src/lib/tools/registry";

/**
 * Template-level guarantees: the things that must hold for a tool page
 * *whatever tool is on it*.
 *
 * These assert what unit tests structurally cannot — what a real engine paints,
 * what it fetches, and whether the page moves under the reader while it loads.
 * Everything here runs against a production build.
 *
 * **Nothing in this file names a slug.** It used to open
 * `/tools/percentage-calculator` and assert that widget's own labels and
 * answers, which quietly made one ordinary tool undeletable: removing it meant
 * rewriting eight tests that were never really about percentages. The reference
 * page is now taken from the registry, so the suite follows the catalogue
 * instead of pinning it.
 *
 * Assertions about a *specific* widget's behaviour belong in
 * `tests/browser/widgets/<slug>.spec.ts`, which is deleted along with the tool.
 */

const [reference] = publicTools();

test.skip(!reference, "the registry publishes no stable tools");

const TOOL = `/tools/${reference?.slug}`;

test.describe("the tool page template", () => {
  test("exposes one h1, and it is the tool's own title", async ({ page }) => {
    await page.goto(TOOL);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(reference.title);
  });

  test("puts the widget above the copy about the widget", async ({ page }) => {
    await page.goto(TOOL);

    const order = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h1, h2, #tool-widget")).map((el) =>
        el.id === "tool-widget"
          ? "WIDGET"
          : `${el.tagName}:${el.textContent?.trim().slice(0, 28)}`
      )
    );

    const widgetIndex = order.indexOf("WIDGET");
    const guideIndex = order.findIndex((o) => o.startsWith("H2:How to use it"));
    const faqIndex = order.findIndex((o) => o.startsWith("H2:Frequently asked"));

    expect(widgetIndex, "no #tool-widget on the page").toBeGreaterThan(-1);
    expect(guideIndex, 'no "How to use it" heading').toBeGreaterThan(-1);

    // The rule the whole template exists to enforce: the tool comes before any
    // copy about the tool. Someone who searched for a calculator did not arrive
    // wanting to read first.
    expect(guideIndex).toBeGreaterThan(widgetIndex);
    expect(faqIndex).toBeGreaterThan(guideIndex);
  });

  test("is operable by keyboard alone", async ({ page }) => {
    await page.goto(TOOL);

    // First tab stop is the skip link, which must reach the widget.
    await page.keyboard.press("Tab");
    await expect(page.locator("a:focus")).toHaveText(/Skip to the tool/i);
  });

  test("sends nothing at all, to anyone, ever", async ({ page }) => {
    // The meta row claims "Runs in your browser — nothing uploaded", and this is
    // that claim made falsifiable.
    //
    // This test used to be weaker. It asserted only that the *typed values*
    // never left, and explicitly tolerated the analytics pixel — which was
    // mounted in the root layout and therefore fired interaction events on tool
    // pages while the user typed. The values were never in those events, so the
    // claim was true about data and uncomfortable in spirit: a visitor with
    // devtools open watched requests fire as they typed on a page that said
    // nothing was uploaded.
    //
    // The pixel has since been scoped to `(site)`, so tool pages now make zero
    // network requests of any kind and the test asserts exactly that. Anything
    // reappearing here — analytics, a font, an avatar CDN — fails the build.
    await page.goto(TOOL, { waitUntil: "load" });
    await page.waitForTimeout(1500); // let anything late settle before counting

    const afterLoad: string[] = [];
    const sentinelSeen: string[] = [];
    const SENTINEL = "31337";

    page.on("request", (r) => {
      afterLoad.push(r.url());
      const body = r.postData() ?? "";
      if (r.url().includes(SENTINEL) || body.includes(SENTINEL)) {
        sentinelSeen.push(r.url());
      }
    });

    // Whatever this widget's first text field happens to be. Typing into it is
    // the generic version of "the user put data into the tool" — which is the
    // only part of the interaction this test is actually about.
    const field = page.locator("#tool-widget input, #tool-widget textarea").first();
    await expect(field, "the widget exposes no text field to type into").toBeVisible();
    await field.fill(SENTINEL);
    await page.waitForTimeout(1000);

    // 1. The load-bearing one: what was typed never leaves the device, in a URL,
    //    a query string, or a POST body.
    expect(
      sentinelSeen,
      `the user's input left the device: ${sentinelSeen.join(", ")}`
    ).toEqual([]);

    // 2. No same-origin traffic either — the computation is not a server call
    //    dressed up as a widget.
    const sameOrigin = afterLoad.filter((u) => {
      const h = new URL(u).hostname;
      return h === "127.0.0.1" || h === "localhost";
    });
    expect(
      sameOrigin,
      `the widget called the server: ${sameOrigin.join(", ")}`
    ).toEqual([]);

    // 3. Whatever third-party traffic does occur must come only from the known
    //    analytics pixel mounted site-wide in the root layout.
    //
    //    This assertion exists so that a *new* third party appearing on a tool
    //    page fails the build. Now that the pixel is scoped out of /tools/*,
    //    this list is empty and the test still passes.
    const KNOWN_THIRD_PARTY = "app.usecortana.ai";
    const unexpected = afterLoad.filter(
      (u) => new URL(u).hostname !== KNOWN_THIRD_PARTY && !sameOrigin.includes(u)
    );
    expect(
      unexpected,
      `an unrecognised third party is loaded on tool pages: ${unexpected.join(", ")}`
    ).toEqual([]);
  });
});

test.describe("routing and indexability", () => {
  test("an unknown tool slug 404s", async ({ page }) => {
    const response = await page.goto("/tools/not-a-real-tool");
    expect(response?.status()).toBe(404);
  });

  test("the homepage links into the tools section from body copy", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#tools a[href='/tools']").first()).toBeVisible();
  });

  // Derived, not named. A category is "thin" because of how many tools it holds
  // today, and that changes every time one is added or removed — so the suite
  // asks the registry which category is thin rather than being told.
  //
  // When every active category clears the threshold there is nothing to assert
  // and this skips, which is the correct outcome rather than a failure.
  const thin = activeCategories().find(
    (c) => getToolsByCategory(c).length < MIN_TOOLS_FOR_INDEXABLE_CATEGORY
  );

  test("a category with too few tools is rendered but not indexable", async ({
    page,
  }) => {
    test.skip(
      !thin,
      `no active category holds fewer than ${MIN_TOOLS_FOR_INDEXABLE_CATEGORY} tools`
    );

    const response = await page.goto(`/tools/category/${thin}`);
    // Reachable for humans and breadcrumbs...
    expect(response?.status(), `/tools/category/${thin} should render`).toBe(200);

    // ...while being kept out of the index.
    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute("content");
    expect(robots, `/tools/category/${thin} robots meta`).toContain("noindex");
    expect(robots, `/tools/category/${thin} robots meta`).toContain("follow");
  });
});
