import { expect, test } from "@playwright/test";
import { getTool } from "../../../src/lib/tools/registry";

/**
 * Behaviour of one widget: the percentage calculator.
 *
 * Widget specs live one-per-file under `tests/browser/widgets/` and are named
 * for their slug, so a tool and its browser tests are deleted together. Nothing
 * outside this file knows this tool exists — the template guarantees in
 * `../tool-page.spec.ts` take whatever the registry publishes.
 *
 * The guard below is what makes removal safe: pull the tool from the registry
 * and this suite skips itself rather than failing a build over a page that was
 * deliberately retired. Delete the file in the same commit and it never runs at
 * all; forget to, and CI stays green while telling you it skipped.
 */

const SLUG = "percentage-calculator";
const tool = getTool(SLUG);

test.skip(!tool || tool.status !== "stable", `${SLUG} is not a published tool`);

const TOOL = `/tools/${SLUG}`;

test.describe(SLUG, () => {
  test("renders a usable widget in static HTML, before any JavaScript runs", async ({
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

  test("keeps focus on the field being typed into", async ({ page }) => {
    await page.goto(TOOL);
    const percent = page.getByLabel("Percentage", { exact: true });
    await percent.focus();
    await page.keyboard.type("42");
    await expect(percent).toBeFocused();
  });
});
