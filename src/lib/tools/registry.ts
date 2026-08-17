import { CALCULATOR_TOOLS } from "./content/calculators";
import { DEVELOPER_TOOLS } from "./content/developer";
import { IMAGE_TOOLS } from "./content/image";
import { TEXT_TOOLS } from "./content/text";
import { TOOL_CATEGORIES, type ToolCategory, type ToolDef } from "./types";
import { validateTools } from "./validate";

/**
 * The tools registry — the whole content model.
 *
 * Adding a tool means adding an object here and a widget to `./widgets`.
 * Pages, sitemap entries, category listings, breadcrumbs, JSON-LD and internal
 * links are all derived from this array.
 *
 * Two import rules, both load-bearing:
 *
 * - **Never import a React component into this file.** Every tool page, the
 *   hub, both category pages and `sitemap.ts` import this module, so anything
 *   reachable from here is reachable from all of them. Widgets live in a
 *   separate slug-keyed map that only the tool page pulls in.
 * - **Never import from `@db`.** `minPoolSize: 5` means a single warm lambda
 *   pins five Atlas connections; statically generated pages must not touch the
 *   pool at all.
 */
export const TOOLS: readonly ToolDef[] = [
  ...CALCULATOR_TOOLS,
  ...TEXT_TOOLS,
  ...DEVELOPER_TOOLS,
  ...IMAGE_TOOLS,
];

/**
 * Module-scope validation. This is the entire enforcement mechanism: `next
 * build` imports this module while running `generateStaticParams`, so an invalid
 * entry throws before any HTML is emitted.
 *
 * Do not wrap this in a NODE_ENV check — production is exactly where it must run.
 */
const { warnings } = validateTools(TOOLS);

// Warnings are advisory (near-duplicate copy, not broken copy), so they are
// surfaced during the build rather than thrown. In CI this lands in the build
// log; locally it lands in the terminal.
if (warnings.length > 0 && process.env.NODE_ENV !== "test") {
  for (const warning of warnings) {
    console.warn(`[tools registry] ${warning}`);
  }
}

const BY_SLUG = new Map(TOOLS.map((t) => [t.slug, t]));

export function getTool(slug: string): ToolDef | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Tools that exist as a URL at all.
 *
 * `draft` is excluded from `generateStaticParams`, which combined with
 * `dynamicParams = false` means a half-finished tool 404s in production rather
 * than being crawlable at a guessable URL.
 */
export function buildableTools(): ToolDef[] {
  return TOOLS.filter((t) => t.status !== "draft");
}

/** Tools that belong in the sitemap and the hub grid. */
export function publicTools(): ToolDef[] {
  return TOOLS.filter((t) => t.status === "stable");
}

export function getToolsByCategory(category: ToolCategory): ToolDef[] {
  return publicTools().filter((t) => t.category === category);
}

/** Categories containing at least one public tool, in tuple order. */
export function activeCategories(): ToolCategory[] {
  return TOOL_CATEGORIES.filter((c) => getToolsByCategory(c).length > 0);
}

/**
 * A category page listing one or two tools is a thin page whose entire content
 * is already reachable from the hub. Below this threshold the page still renders
 * — breadcrumbs point at it — but carries `noindex, follow` and stays out of the
 * sitemap. Above it, the page earns its place in the index.
 */
export const MIN_TOOLS_FOR_INDEXABLE_CATEGORY = 3;

export function isCategoryIndexable(category: ToolCategory): boolean {
  return getToolsByCategory(category).length >= MIN_TOOLS_FOR_INDEXABLE_CATEGORY;
}

/** Newest first. Used by the hub and the homepage teaser. */
export function toolsByRecency(): ToolDef[] {
  return [...publicTools()].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
}
