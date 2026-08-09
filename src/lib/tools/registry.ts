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
  {
    slug: "percentage-calculator",
    title: "Percentage Calculator",
    metaTitle: "Percentage Calculator — Free, No Signup",
    description:
      "Work out a percentage of a number, what share one number is of another, " +
      "or the change between two values. Shows the working. Runs in your browser.",
    category: "calculators",
    audience: ["students", "small-business", "general"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-09",
    updatedAt: "2026-08-09",
    keywords: [
      "percentage calculator",
      "what is x percent of y",
      "percentage increase calculator",
      "percentage decrease calculator",
      "percentage change formula",
      "how to calculate percentage",
    ],
    intro:
      "Work out a percentage three different ways: a percentage of a number, " +
      "what share one number is of another, and the percentage change between " +
      "two values. Every calculation shows its working, so you can check the " +
      "arithmetic rather than trust it. It runs entirely in your browser — " +
      "nothing you type is sent anywhere, and it keeps working offline.",
    howItWorks:
      "Pick the question you are actually asking, because the three are not the " +
      "same calculation and mixing them up is where most percentage mistakes " +
      "come from.\n\n" +
      "\"Percentage of a number\" divides the percentage by one hundred and " +
      "multiplies. Fifteen per cent of sixty is 0.15 × 60, which is nine. This " +
      "is the one people mean when they say percentage, and it is the only one " +
      "of the three that is commutative: fifteen per cent of sixty and sixty " +
      "per cent of fifteen are both nine, which is occasionally a useful " +
      "shortcut for mental arithmetic.\n\n" +
      "\"X is what per cent of Y\" runs the same relationship backwards. It " +
      "divides the part by the whole and multiplies by one hundred, so nine out " +
      "of sixty is 0.15, or fifteen per cent. If the whole is zero there is no " +
      "answer at all — nothing is a meaningful share of nothing — and this page " +
      "says so rather than printing an infinity symbol.\n\n" +
      "\"Percentage change\" measures movement between two values. It takes the " +
      "difference, divides by the size of the starting value, and multiplies by " +
      "one hundred. Going from eighty to one hundred is a twenty-unit rise over " +
      "a starting size of eighty, which is a twenty-five per cent increase. " +
      "Note that the starting value is the denominator, not the ending one: " +
      "that asymmetry is why a fifty per cent fall needs a hundred per cent " +
      "rise to undo it.",
    gotchas:
      "A percentage change and a change in percentage points are different " +
      "things, and conflating them is the most consequential error on this " +
      "page. If an interest rate moves from four per cent to six per cent, that " +
      "is a rise of two percentage points and also a fifty per cent increase. " +
      "Both are true, they are not interchangeable, and headlines routinely " +
      "pick whichever sounds larger.\n\n" +
      "Percentage changes do not add up, and they do not cancel out. A twenty " +
      "per cent fall followed by a twenty per cent rise does not return you to " +
      "where you started: one hundred becomes eighty, and twenty per cent of " +
      "eighty is sixteen, so you end at ninety-six. The same applies to " +
      "successive discounts — thirty per cent off and then a further twenty per " +
      "cent off is not fifty per cent off, it is forty-four.\n\n" +
      "Change from zero is undefined, not infinite. If something goes from zero " +
      "sales to fifty, there is no meaningful percentage — the honest statement " +
      "is the absolute number. This calculator refuses that case deliberately.\n\n" +
      "For negative starting values, this page measures the move against the " +
      "size of the starting number rather than its signed value, so a rise from " +
      "minus one hundred to minus fifty reads as a fifty per cent increase. " +
      "That matches how people describe a shrinking loss. Some tools report " +
      "minus fifty per cent for the same pair, which is arithmetically " +
      "defensible and, in plain English, backwards.",
    faqs: [
      {
        q: "How do I calculate a percentage of a number by hand?",
        a: "Divide the percentage by one hundred, then multiply by the number. Fifteen per cent of sixty is 0.15 × 60 = 9. For a rough mental check, ten per cent is the number with the decimal point moved one place left, and you can build most percentages from that.",
      },
      {
        q: "What is the percentage increase formula?",
        a: "Subtract the old value from the new one, divide by the old value, then multiply by one hundred. From eighty to one hundred is (100 − 80) ÷ 80 × 100, which is a twenty-five per cent increase. The old value is always the denominator.",
      },
      {
        q: "Why is a 20% drop followed by a 20% rise not back to where I started?",
        a: "Because the second percentage is taken from a smaller base. One hundred falls to eighty, and twenty per cent of eighty is only sixteen, so you finish at ninety-six. Reversing a twenty per cent fall actually needs a twenty-five per cent rise.",
      },
      {
        q: "What is the difference between percent and percentage points?",
        a: "Percentage points measure the gap between two percentages, while per cent measures relative change. Four per cent rising to six per cent is two percentage points and a fifty per cent increase at the same time. Both descriptions are correct and they are not interchangeable.",
      },
      {
        q: "Does this calculator send my numbers anywhere?",
        a: "No. The page is a static file and the arithmetic runs in JavaScript inside your own browser. There is no API call and no analytics event carrying your figures. You can confirm it by opening the network tab, or by turning off your connection and using it offline.",
      },
    ],
    related: [],
  },
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
