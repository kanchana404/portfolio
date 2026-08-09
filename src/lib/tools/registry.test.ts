import { describe, expect, it } from "vitest";
import { SITE_NAME } from "@/lib/site";
import {
  MIN_TOOLS_FOR_INDEXABLE_CATEGORY,
  TOOLS,
  activeCategories,
  buildableTools,
  getTool,
  getToolsByCategory,
  isCategoryIndexable,
  publicTools,
  toolsByRecency,
} from "./registry";
import { MAX_TOOLS, RESERVED_SLUGS, TOOL_CATEGORIES } from "./types";
import { pageWordCount, validateTools } from "./validate";

/**
 * These run against the real registry, not a fixture.
 *
 * `registry.ts` already calls `validateTools` at module scope, so importing it
 * would throw before a single assertion ran — which is the point. Asserting it
 * again here makes the failure legible in the test output instead of as an
 * import-time stack trace, and lets the remaining tests pin properties the
 * validator deliberately does not enforce.
 */

describe("the shipped registry", () => {
  it("passes the validator", () => {
    expect(() => validateTools(TOOLS)).not.toThrow();
  });

  it("produces no advisory warnings", () => {
    // Near-duplicate copy is a warning rather than an error, so it would not
    // fail the build. It should still never reach main.
    expect(validateTools(TOOLS).warnings).toEqual([]);
  });

  it("is within the content-farm cap", () => {
    expect(TOOLS.length).toBeLessThanOrEqual(MAX_TOOLS);
  });

  it("has at least one tool", () => {
    expect(TOOLS.length).toBeGreaterThan(0);
  });
});

describe("rendered <title> length", () => {
  // The root layout's template appends " | Kavitha Kanchana". The validator caps
  // the registry string; this checks the thing Google actually receives.
  const SUFFIX = ` | ${SITE_NAME}`;

  it.each(TOOLS.map((t) => [t.slug, t.metaTitle] as const))(
    "%s renders a <title> under 60 characters",
    (_slug, metaTitle) => {
      expect((metaTitle + SUFFIX).length).toBeLessThanOrEqual(60);
    }
  );
});

describe("registry invariants the validator does not cover", () => {
  it("has no slug that collides with a reserved route segment", () => {
    for (const tool of TOOLS) {
      expect(RESERVED_SLUGS).not.toContain(tool.slug);
    }
  });

  it("carries enough body copy on every page to be worth indexing", () => {
    for (const tool of TOOLS) {
      expect(pageWordCount(tool), `${tool.slug} body copy`).toBeGreaterThanOrEqual(
        400
      );
    }
  });

  it("declares caveats for anything that leaves the browser", () => {
    for (const tool of TOOLS) {
      if (tool.compute !== "browser") {
        expect(tool.caveats, `${tool.slug} caveats`).toBeTruthy();
      }
    }
  });

  it("cites a primary source for anything carrying a regulated number", () => {
    // Not enforceable by type — this is the reminder that a finance or
    // statutory tool without a citation is a liability, not a feature.
    for (const tool of TOOLS) {
      if (tool.audience.includes("sri-lanka") && tool.category === "calculators") {
        expect(
          tool.sources?.length ?? 0,
          `${tool.slug} should cite its rates`
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("selectors", () => {
  it("getTool resolves a known slug and rejects an unknown one", () => {
    expect(getTool(TOOLS[0].slug)?.slug).toBe(TOOLS[0].slug);
    expect(getTool("definitely-not-a-tool")).toBeUndefined();
  });

  it("buildableTools excludes drafts", () => {
    expect(buildableTools().every((t) => t.status !== "draft")).toBe(true);
  });

  it("publicTools contains only stable tools", () => {
    expect(publicTools().every((t) => t.status === "stable")).toBe(true);
  });

  it("publicTools is a subset of buildableTools", () => {
    const buildable = new Set(buildableTools().map((t) => t.slug));
    for (const tool of publicTools()) {
      expect(buildable.has(tool.slug)).toBe(true);
    }
  });

  it("activeCategories returns only categories with public tools, in tuple order", () => {
    const active = activeCategories();
    for (const category of active) {
      expect(getToolsByCategory(category).length).toBeGreaterThan(0);
    }
    const order = TOOL_CATEGORIES.filter((c) => active.includes(c));
    expect(active).toEqual(order);
  });

  it("isCategoryIndexable matches the documented threshold", () => {
    for (const category of TOOL_CATEGORIES) {
      const count = getToolsByCategory(category).length;
      expect(isCategoryIndexable(category)).toBe(
        count >= MIN_TOOLS_FOR_INDEXABLE_CATEGORY
      );
    }
  });

  it("toolsByRecency is sorted newest first and does not mutate TOOLS", () => {
    const before = TOOLS.map((t) => t.slug);
    const sorted = toolsByRecency();
    for (let i = 1; i < sorted.length; i++) {
      expect(
        sorted[i - 1].publishedAt >= sorted[i].publishedAt,
        `${sorted[i - 1].slug} should not predate ${sorted[i].slug}`
      ).toBe(true);
    }
    expect(TOOLS.map((t) => t.slug)).toEqual(before);
  });
});
