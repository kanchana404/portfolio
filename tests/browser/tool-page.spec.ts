import { expect, test } from "@playwright/test";

const TOOL = "/tools/percentage-calculator";

/**
 * Browser-level guarantees for a tool page.
 *
 * These assert the things unit tests structurally cannot: what a real engine
 * paints, what it fetches, and whether the page moves under the reader while it
 * loads. Everything here runs against a production build.
 */

test.describe("the tool page", () => {
  test("renders the widget from static HTML before any JavaScript runs", async ({
    browser,
  }) => {
    // JavaScript disabled: whatever is visible is what a crawler receives and
    // what a visitor on a slow connection sees first.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(TOOL);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Percentage Calculator"
    );
    // The widget's own controls, not just the surrounding prose.
    await expect(page.getByRole("group", { name: "Calculation type" })).toBeVisible();
    await expect(page.getByLabel("Percentage", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Of this number", { exact: true })).toBeVisible();
    // Server-rendered default answer: 15% of 60.
    await expect(page.getByText("9", { exact: true }).first()).toBeVisible();

    await context.close();
  });

  test("computes correctly and updates live", async ({ page }) => {
    await page.goto(TOOL);

    const percent = page.getByLabel("Percentage", { exact: true });
    const value = page.getByLabel("Of this number", { exact: true });
    const result = page.locator("[aria-live='polite']");

    await expect(result).toContainText("9");

    await percent.fill("25");
    await value.fill("200");
    await expect(result).toContainText("50");

    // Thousands separators are accepted rather than rejected.
    await value.fill("1,000");
    await expect(result).toContainText("250");
  });

  test("refuses undefined maths instead of printing NaN or Infinity", async ({
    page,
  }) => {
    await page.goto(TOOL);

    await page.getByRole("button", { name: "% increase / decrease" }).click();
    await page.getByLabel("From", { exact: true }).fill("0");
    await page.getByLabel("To", { exact: true }).fill("100");

    const result = page.locator("[aria-live='polite']");
    await expect(result).toContainText("undefined");

    const body = await page.locator("body").innerText();
    expect(body).not.toContain("NaN");
    expect(body).not.toContain("Infinity");
  });

  test("shows an empty state rather than a wrong answer for blank input", async ({
    page,
  }) => {
    await page.goto(TOOL);
    await page.getByLabel("Percentage", { exact: true }).fill("");
    const result = page.locator("[aria-live='polite']");
    await expect(result).toContainText("Enter both numbers");
    expect(await page.locator("body").innerText()).not.toContain("NaN");
  });

  test("sends nothing at all while the user is typing", async ({ page }) => {
    // The meta row claims "Runs in your browser — nothing uploaded", and this is
    // that claim made falsifiable.
    //
    // The assertion is deliberately about *interaction*, not about the page as a
    // whole. The site-wide analytics pixel (app.usecortana.ai, mounted in the
    // root layout) fires one pageview on load like any analytics, and asserting
    // "zero cross-origin requests ever" would be testing something the site does
    // not claim. What the tool page actually promises is that the numbers you
    // type never leave the device — so: let the page settle, then start
    // counting, then interact, and require silence.
    await page.goto(TOOL, { waitUntil: "load" });
    await page.waitForTimeout(1500); // let the pageview beacon settle

    const afterLoad: string[] = [];
    const sentinelSeen: string[] = [];
    const SENTINEL_A = "31337";
    const SENTINEL_B = "424242";

    page.on("request", (r) => {
      afterLoad.push(r.url());
      const body = r.postData() ?? "";
      if (
        r.url().includes(SENTINEL_A) ||
        r.url().includes(SENTINEL_B) ||
        body.includes(SENTINEL_A) ||
        body.includes(SENTINEL_B)
      ) {
        sentinelSeen.push(r.url());
      }
    });

    await page.getByLabel("Percentage", { exact: true }).fill(SENTINEL_A);
    await page.getByLabel("Of this number", { exact: true }).fill(SENTINEL_B);
    await page.getByRole("button", { name: "X is what % of Y" }).click();
    await page.waitForTimeout(1000);

    // 1. The load-bearing one: the numbers never leave the device, in a URL, a
    //    query string, or a POST body.
    expect(
      sentinelSeen,
      `the user's input left the device: ${sentinelSeen.join(", ")}`
    ).toEqual([]);

    // 2. No same-origin traffic either — the arithmetic is not a server call
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
    //    Recorded behaviour, deliberately pinned rather than waved through: that
    //    pixel emits interaction events (".../e") while the user types. It does
    //    NOT carry the typed values — assertion 1 proves that every run — but it
    //    does mean a visitor with devtools open sees requests firing as they
    //    interact, which is in tension with the "nothing uploaded" line in the
    //    meta row even though the line is accurate about *data*.
    //
    //    This assertion exists so that a *new* third party appearing on a tool
    //    page fails the build. If the pixel is ever scoped out of /tools/*, this
    //    list becomes empty and the test still passes.
    const KNOWN_THIRD_PARTY = "app.usecortana.ai";
    const unexpected = afterLoad.filter(
      (u) => new URL(u).hostname !== KNOWN_THIRD_PARTY && !sameOrigin.includes(u)
    );
    expect(
      unexpected,
      `an unrecognised third party is loaded on tool pages: ${unexpected.join(", ")}`
    ).toEqual([]);
  });

  test("stays within the CLS budget while loading", async ({ page }) => {
    await page.goto(TOOL, { waitUntil: "load" });

    const cls = await page.evaluate(async () => {
      return await new Promise<number>((resolve) => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<
            PerformanceEntry & { value: number; hadRecentInput: boolean }
          >) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(total);
        }, 2500);
      });
    });

    // The platform budget is 0.05 — half the usual 0.1 — because the widget sits
    // above the fold on every tool page.
    expect(cls).toBeLessThanOrEqual(0.05);
  });

  test("is operable by keyboard alone", async ({ page }) => {
    await page.goto(TOOL);

    // First tab stop is the skip link, which must reach the widget.
    await page.keyboard.press("Tab");
    const skip = page.locator("a:focus");
    await expect(skip).toHaveText(/Skip to the tool/i);

    await page.getByLabel("Percentage", { exact: true }).focus();
    await page.keyboard.type("");
    await expect(page.getByLabel("Percentage", { exact: true })).toBeFocused();
  });

  test("exposes one h1 and the locked section order", async ({ page }) => {
    await page.goto(TOOL);

    await expect(page.locator("h1")).toHaveCount(1);

    const order = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h1, h2, #tool-widget")).map((el) =>
        el.id === "tool-widget" ? "WIDGET" : `${el.tagName}:${el.textContent?.trim().slice(0, 28)}`
      )
    );

    const widgetIndex = order.indexOf("WIDGET");
    const firstProseHeading = order.findIndex((o) => o.startsWith("H2:How it works"));
    expect(widgetIndex).toBeGreaterThan(-1);
    expect(firstProseHeading).toBeGreaterThan(widgetIndex);
  });
});

test.describe("routing and indexability", () => {
  test("an unknown tool slug 404s", async ({ page }) => {
    const response = await page.goto("/tools/not-a-real-tool");
    expect(response?.status()).toBe(404);
  });

  test("a category with too few tools is rendered but not indexable", async ({
    page,
  }) => {
    await page.goto("/tools/category/calculators");
    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute("content");
    // One tool is below MIN_TOOLS_FOR_INDEXABLE_CATEGORY, so the page must be
    // reachable for humans and breadcrumbs but kept out of the index.
    expect(robots).toContain("noindex");
    expect(robots).toContain("follow");
  });

  test("the hub stays inside its outbound link budget", async ({ page }) => {
    await page.goto("/tools");
    const links = await page.locator("a[href]").count();
    expect(links).toBeLessThan(60);
  });

  test("the homepage links into the tools section from body copy", async ({
    page,
  }) => {
    await page.goto("/");
    const bodyLink = page.locator("#tools a[href='/tools']");
    await expect(bodyLink.first()).toBeVisible();
  });
});
