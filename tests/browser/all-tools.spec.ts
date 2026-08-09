import { expect, test } from "@playwright/test";
import { publicTools } from "../../src/lib/tools/registry";

/**
 * Guarantees that must hold for **every** tool, driven off the registry itself.
 *
 * Importing the registry rather than hardcoding a list is deliberate: a new tool
 * cannot be added without these running against it, and there is no separate
 * list to forget to update.
 */

const tools = publicTools();

test("the registry has tools to check", () => {
  expect(tools.length).toBeGreaterThan(0);
});

for (const tool of tools) {
  test.describe(tool.slug, () => {
    test("renders its H1 and widget in static HTML, before any JavaScript", async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      const response = await page.goto(`/tools/${tool.slug}`);

      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(tool.title);

      // The widget's own container, not merely the surrounding prose. If this
      // is empty the page is a article with a hole in it — and an indexable one.
      const widget = page.locator("#tool-widget");
      await expect(widget).toBeVisible();
      expect((await widget.innerText()).trim().length).toBeGreaterThan(0);

      await context.close();
    });

    test("carries correct canonical, robots and structured data", async ({ page }) => {
      await page.goto(`/tools/${tool.slug}`);

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://kavithakanchana.me/tools/${tool.slug}`
      );

      const robots = await page
        .locator('meta[name="robots"]')
        .getAttribute("content");
      expect(robots).toContain("index");
      expect(robots).not.toContain("noindex");

      // Every `@id` the page references must resolve, either inside its own
      // graph or against the Person/WebSite nodes the root layout publishes.
      // A dangling reference silently detaches the tool from the brand entity.
      const dangling = await page.evaluate(() => {
        const blocks = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]')
        ).map((el) => JSON.parse(el.textContent ?? "{}"));

        const defined = new Set<string>();
        const referenced: string[] = [];
        const walk = (value: unknown): void => {
          if (Array.isArray(value)) return value.forEach(walk);
          if (value && typeof value === "object") {
            const obj = value as Record<string, unknown>;
            const keys = Object.keys(obj);
            if (keys.length === 1 && keys[0] === "@id") {
              referenced.push(obj["@id"] as string);
              return;
            }
            for (const k of keys) if (k !== "@id") walk(obj[k]);
          }
        };
        for (const doc of blocks) {
          for (const node of doc["@graph"] ?? []) {
            if (node["@id"]) defined.add(node["@id"]);
          }
        }
        for (const doc of blocks) walk(doc["@graph"]);
        return [...new Set(referenced)].filter((r) => !defined.has(r));
      });

      expect(dangling, `dangling @id references: ${dangling.join(", ")}`).toEqual([]);
    });

    test("does not shift layout while loading", async ({ page }) => {
      await page.goto(`/tools/${tool.slug}`, { waitUntil: "load" });
      const cls = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
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
            }, 2000);
          })
      );
      expect(cls).toBeLessThanOrEqual(0.05);
    });

    test("leaks no computed-value garbage into the widget", async ({ page }) => {
      // Scoped to #tool-widget rather than the whole page, and matched on whole
      // tokens. An earlier version scanned the article and failed on the
      // percentage calculator, whose *copy* legitimately reads "percentage
      // change from zero is undefined" — authored English, not a leaked value.
      //
      // "undefined" is deliberately not checked for that reason: it is an
      // ordinary English word here. The unit suites carry that burden instead,
      // where every compute function is asserted to return null rather than NaN.
      await page.goto(`/tools/${tool.slug}`);
      const widget = await page.locator("#tool-widget").innerText();
      expect(widget, `${tool.slug} widget rendered NaN`).not.toMatch(/\bNaN\b/);
      expect(widget, `${tool.slug} widget rendered Infinity`).not.toMatch(/\bInfinity\b/);
      expect(widget, `${tool.slug} widget rendered a raw object`).not.toContain(
        "[object Object]"
      );
    });

    test("has no console errors on load", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`/tools/${tool.slug}`, { waitUntil: "load" });
      await page.waitForTimeout(600);
      // Third-party analytics can log its own noise; only our own code counts.
      const ours = errors.filter((e) => !e.includes("usecortana"));
      expect(ours, `console errors: ${ours.join(" | ")}`).toEqual([]);
    });
  });
}

test.describe("the hub and categories", () => {
  test("the hub links to every public tool", async ({ page }) => {
    await page.goto("/tools");
    for (const tool of tools) {
      await expect(
        page.locator(`a[href="/tools/${tool.slug}"]`).first(),
        `hub is missing a link to ${tool.slug}`
      ).toBeVisible();
    }
  });

  test("the hub stays inside its outbound link budget", async ({ page }) => {
    await page.goto("/tools");
    expect(await page.locator("a[href]").count()).toBeLessThan(60);
  });

  test("a category with enough tools is indexable", async ({ page }) => {
    await page.goto("/tools/category/developer");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    // Six developer tools is above the thin-page threshold of three.
    expect(robots).toContain("index");
    expect(robots).not.toContain("noindex");
  });

  test("a category below the threshold is not indexable", async ({ page }) => {
    await page.goto("/tools/category/image");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("noindex");
    expect(robots).toContain("follow");
  });
});
