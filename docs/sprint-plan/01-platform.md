> Part of [SPRINT-PLAN.md](SPRINT-PLAN.md). **Part II (Amendments) overrides anything below it.**

## Sprint 1 — Tool platform foundation

**Sprint goal** — Ship the typed registry, the build-breaking validator, `<ToolShell>`, the `/tools` hub and category pages, full SEO plumbing, and one genuinely useful client-side tool that proves the whole template end to end in production.

**Duration** — 2 weeks (36h planned against a 30–40h budget). **Depends on** — Sprint 0 only (route groups, `@db` alias, build-fails-on-type-errors). Sprint 0 is done and verified on `tools-platform-phase0`.

---

### Definition of Ready

- [ ] Branch `tools-platform-phase0` is merged to `main`, or Sprint 1 branches from it (`tools-platform-phase1`).
- [ ] `pnpm build` passes on the base branch with 0 tsc errors and `next.config.mjs` still has **no** `ignoreBuildErrors` / `ignoreDuringBuilds`.
- [ ] `src/app/(tools)/layout.tsx` exists and renders `max-w-5xl … pb-28`. Confirmed by rendering a throwaway `(tools)/tools/page.tsx` returning `<div>ok</div>` and measuring 1024px at ≥1280 viewport.
- [ ] Baseline recorded: run `pnpm build` and write down the **First Load JS** for `/` and `/blog/[slug]` from the route table. Sprint 1's perf budget is expressed as a delta against these numbers.
- [ ] Baseline recorded: `curl -sI 'https://kavithakanchana.me/og?title=test'` output saved, so the caching change in PLAT-12 is provably a change.
- [ ] Google Search Console access confirmed (needed for PLAT-15 — URL inspection + sitemap ping).
- [ ] **EPF/ETF statutory rates confirmed by hand** against the Sri Lanka Department of Labour and Central Bank pages, with the URLs and the date of checking written down. PLAT-04 hardcodes these; do not start it from memory.
- [ ] Decision confirmed with yourself: the reserved slug list starts as `["category", "api", "new", "all"]`. Adding to it later is a breaking URL change.

---

### Tickets

---

### [PLAT-01] `ToolDef` — the type that everything else is a function of

**Estimate:** 2h · **Depends on:** — · **Files:** `src/lib/tools/types.ts` (new)

**Why** — Every downstream file (validator, registry, JSON-LD builder, shell, three page files, sitemap) reads from this one interface. Getting the field set right now costs 2h; getting it wrong costs a rewrite of six files in Sprint 2. Categories and audiences are `as const` tuples rather than free strings so that `generateStaticParams` for `/tools/category/[category]` is derivable and a typo in a registry entry is a compile error, not a 404.

**Implementation**

```ts
// src/lib/tools/types.ts
import type { ComponentType } from "react";

/**
 * Categories are a closed set, not free text. Two reasons:
 *  1. `/tools/category/[category]` derives its static params from this tuple,
 *     so a typo in a registry entry becomes a tsc error rather than a live 404.
 *  2. It forces a decision. "Should this be a new category or does it belong in
 *     an existing one?" is a content-strategy question, and editing this tuple
 *     is the moment you have to answer it.
 */
export const TOOL_CATEGORIES = [
  "image",
  "pdf",
  "text",
  "calculators",
  "developer",
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/** Human-readable labels for headings, breadcrumbs and <title>. */
export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  image: "Image tools",
  pdf: "PDF tools",
  text: "Text tools",
  calculators: "Calculators",
  developer: "Developer tools",
};

/**
 * Who the tool is for. Not rendered prominently — this exists so that when the
 * registry has 20 entries you can answer "am I building for one audience or
 * five?" without reading every description.
 */
export const TOOL_AUDIENCES = [
  "developers",
  "designers",
  "students",
  "sri-lanka",
  "small-business",
  "job-seekers",
] as const;
export type ToolAudience = (typeof TOOL_AUDIENCES)[number];

/**
 * Where the work happens. This is not decoration: <ToolShell> derives the
 * privacy line in the meta row from it, and claiming "nothing uploaded" on a
 * tool that POSTs to Railway is a lie that a user can catch in devtools.
 */
export type ToolRuntime = "browser" | "railway" | "hybrid";

export type ToolStatus = "live" | "beta";

export interface ToolFaq {
  /** Phrased as a real user query, not a marketing prompt. */
  q: string;
  /** Answered in the first sentence. Everything after is elaboration. */
  a: string;
}

/**
 * A dated citation. Required for anything whose correctness depends on a rule
 * someone else controls — tax rates, statutory contributions, filing deadlines,
 * passport photo dimensions. `verifiedOn` is the date a human opened the URL
 * and read it, not the date the page was published.
 */
export interface ToolSource {
  label: string;
  /** Absolute https URL to a primary source. Not a blog post about the rule. */
  url: string;
  /** ISO calendar date, YYYY-MM-DD. */
  verifiedOn: string;
}

/**
 * Widgets take no props. Everything a tool needs lives in its own client state.
 * Passing config in from the registry would mean the registry has to know how
 * each tool works, which is exactly the coupling this design avoids.
 */
export type ToolWidget = ComponentType;

export interface ToolDef {
  /** URL segment. Lowercase kebab. Immutable once published — this is a URL. */
  slug: string;
  /** The H1. Must be the exact target keyword phrase, not a clever variant. */
  title: string;
  /** <title>. <= 60 chars or Google truncates it. */
  metaTitle: string;
  /** <meta name="description">. 120-165 chars. */
  description: string;
  category: ToolCategory;
  audience: ToolAudience[];
  runsOn: ToolRuntime;
  status: ToolStatus;
  /** ISO calendar date, YYYY-MM-DD. Never changes after first deploy. */
  publishedAt: string;
  /** ISO calendar date. Bump when the prose or the maths changes. */
  updatedAt: string;
  /**
   * How stale this page is allowed to get before a human re-reads it.
   * 90 for anything with a statutory rate in it, 365 for pure maths.
   * Consumed by the review script (deferred to Sprint 2); validated here.
   */
  reviewEveryDays: number;
  /** 3-8 phrases. Used in <meta keywords> and, more usefully, as a brief. */
  keywords: string[];
  /** 40-70 words, above the widget. Says what it does and what it costs (nothing). */
  intro: string;
  /** >= 120 words. Real mechanism, not "simply upload your file". */
  howItWorks: string;
  /** >= 120 words. The cases where this tool is the wrong answer. */
  gotchas: string;
  /** 3-6. Fewer looks thin; more reads as padding and dilutes the FAQPage node. */
  faqs: ToolFaq[];
  /** Slugs of 0-4 sibling tools. Must all exist. Must not include self. */
  related: string[];
  /** Required in spirit for regulatory tools; optional in the type. */
  sources?: ToolSource[];
  /**
   * The interactive part. See registry.ts for the import rules — getting this
   * wrong is how you accidentally bundle every widget into every tool page.
   */
  Widget: ToolWidget;
}

/**
 * Slugs that can never be a tool, because they collide with a route segment or
 * a reserved path. "category" is the load-bearing one: /tools/category/[category]
 * would otherwise be ambiguous with /tools/[slug].
 */
export const RESERVED_SLUGS: readonly string[] = ["category", "api", "new", "all"];

/** Anti-content-farm cap. Raising this must be a conscious policy edit. */
export const MAX_TOOLS = 30;
```

**Acceptance criteria**

- [ ] `pnpm exec tsc --noEmit` passes with the new file present.
- [ ] `ToolCategory` is a union of exactly 5 string literals — verify with a deliberate `const c: ToolCategory = "nope"` and confirm it errors, then delete.
- [ ] No import from `@db`, `mongoose`, or `next/dynamic` appears in `types.ts`.
- [ ] `CATEGORY_LABELS` is `Record<ToolCategory, string>`, so adding a category to the tuple without a label is a compile error. Verify by adding a 6th category temporarily and confirming the error, then revert.

---

### [PLAT-02] The validator that fails the build

**Estimate:** 3h · **Depends on:** PLAT-01 · **Files:** `src/lib/tools/validate.ts` (new)

**Why** — Content quality rules that live in a checklist get skipped at 11pm on the fifth tool. Rules that throw at module scope during `next build` do not. The validator is the only thing standing between "30 useful pages" and "30 thin pages that trigger a Helpful Content demotion across the whole domain, including the blog and the homepage". It collects **all** errors and throws once, because fixing one error per build cycle is miserable.

**Implementation**

```ts
// src/lib/tools/validate.ts
import {
  MAX_TOOLS,
  RESERVED_SLUGS,
  TOOL_AUDIENCES,
  TOOL_CATEGORIES,
  type ToolDef,
} from "./types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const LIMITS = {
  slugMin: 3,
  slugMax: 60,
  metaTitleMax: 60,
  descriptionMin: 120,
  descriptionMax: 165,
  introWordsMin: 40,
  introWordsMax: 70,
  proseWordsMin: 120,
  faqsMin: 3,
  faqsMax: 6,
  relatedMax: 4,
  keywordsMin: 3,
  keywordsMax: 8,
  reviewDaysMin: 30,
  reviewDaysMax: 730,
} as const;

export class ToolRegistryError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(
      `Tool registry is invalid (${issues.length} issue${
        issues.length === 1 ? "" : "s"
      }):\n\n` +
        issues.map((i) => `  • ${i}`).join("\n") +
        `\n\nFix these in src/lib/tools/registry.ts. ` +
        `The rules live in src/lib/tools/validate.ts (LIMITS).\n`
    );
    this.name = "ToolRegistryError";
    this.issues = issues;
  }
}

/** Whitespace-delimited word count. Em dashes surrounded by spaces count as a
 *  word; that is fine, the thresholds have margin. */
export function countWords(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Validates the whole registry. Throws ToolRegistryError listing every problem.
 * Pure and synchronous so it can run at module scope and inside vitest.
 */
export function validateTools(tools: readonly ToolDef[]): void {
  const issues: string[] = [];
  const at = (slug: string, field: string, msg: string) =>
    issues.push(`[${slug || "<missing slug>"}] ${field}: ${msg}`);

  // --- Registry-wide rules -------------------------------------------------
  if (tools.length > MAX_TOOLS) {
    issues.push(
      `registry: ${tools.length} tools exceeds MAX_TOOLS (${MAX_TOOLS}). ` +
        `This cap is deliberate — it is the difference between a tool section ` +
        `and a content farm. If you genuinely need more, raise MAX_TOOLS in ` +
        `src/lib/tools/types.ts as an explicit policy decision and say why in ` +
        `the commit message.`
    );
  }

  const seen = new Map<string, number>();
  tools.forEach((tool, index) => {
    const first = seen.get(tool.slug);
    if (first !== undefined) {
      at(
        tool.slug,
        "slug",
        `duplicate — already used by TOOLS[${first}], repeated at TOOLS[${index}]. ` +
          `Slugs are URLs; two tools cannot share one.`
      );
    } else {
      seen.set(tool.slug, index);
    }
  });
  const known = new Set(tools.map((t) => t.slug));

  // --- Per-tool rules ------------------------------------------------------
  for (const t of tools) {
    // slug
    if (!SLUG_RE.test(t.slug)) {
      at(
        t.slug,
        "slug",
        `"${t.slug}" is not lowercase-kebab. Allowed: a-z, 0-9, single hyphens ` +
          `between segments, no leading/trailing hyphen.`
      );
    }
    if (t.slug.length < LIMITS.slugMin || t.slug.length > LIMITS.slugMax) {
      at(
        t.slug,
        "slug",
        `length ${t.slug.length} outside ${LIMITS.slugMin}-${LIMITS.slugMax}.`
      );
    }
    if (RESERVED_SLUGS.includes(t.slug)) {
      at(
        t.slug,
        "slug",
        `"${t.slug}" is reserved — it collides with a route segment under /tools.`
      );
    }

    // title / metaTitle / description
    if (t.title.trim().length === 0) {
      at(t.slug, "title", "empty. This is the H1 and the target keyword phrase.");
    }
    if (t.metaTitle.length > LIMITS.metaTitleMax) {
      at(
        t.slug,
        "metaTitle",
        `${t.metaTitle.length} chars, max ${LIMITS.metaTitleMax}. ` +
          `Google truncates past ~60. Current value: "${t.metaTitle}"`
      );
    }
    if (
      t.description.length < LIMITS.descriptionMin ||
      t.description.length > LIMITS.descriptionMax
    ) {
      at(
        t.slug,
        "description",
        `${t.description.length} chars, must be ${LIMITS.descriptionMin}-${LIMITS.descriptionMax}. ` +
          `Under ${LIMITS.descriptionMin} wastes the SERP snippet; over ` +
          `${LIMITS.descriptionMax} gets cut mid-sentence.`
      );
    }

    // taxonomy
    if (!TOOL_CATEGORIES.includes(t.category)) {
      at(t.slug, "category", `"${t.category}" is not in TOOL_CATEGORIES.`);
    }
    if (t.audience.length === 0) {
      at(t.slug, "audience", "empty. Name at least one audience.");
    }
    for (const a of t.audience) {
      if (!TOOL_AUDIENCES.includes(a)) {
        at(t.slug, "audience", `"${a}" is not in TOOL_AUDIENCES.`);
      }
    }

    // keywords
    if (
      t.keywords.length < LIMITS.keywordsMin ||
      t.keywords.length > LIMITS.keywordsMax
    ) {
      at(
        t.slug,
        "keywords",
        `${t.keywords.length} entries, must be ${LIMITS.keywordsMin}-${LIMITS.keywordsMax}.`
      );
    }

    // dates
    if (!isValidIsoDate(t.publishedAt)) {
      at(t.slug, "publishedAt", `"${t.publishedAt}" is not a valid YYYY-MM-DD date.`);
    }
    if (!isValidIsoDate(t.updatedAt)) {
      at(t.slug, "updatedAt", `"${t.updatedAt}" is not a valid YYYY-MM-DD date.`);
    }
    if (
      isValidIsoDate(t.publishedAt) &&
      isValidIsoDate(t.updatedAt) &&
      t.updatedAt < t.publishedAt
    ) {
      at(
        t.slug,
        "updatedAt",
        `${t.updatedAt} is before publishedAt ${t.publishedAt}.`
      );
    }
    if (
      !Number.isInteger(t.reviewEveryDays) ||
      t.reviewEveryDays < LIMITS.reviewDaysMin ||
      t.reviewEveryDays > LIMITS.reviewDaysMax
    ) {
      at(
        t.slug,
        "reviewEveryDays",
        `${t.reviewEveryDays} must be an integer in ` +
          `${LIMITS.reviewDaysMin}-${LIMITS.reviewDaysMax}. Use 90 for anything ` +
          `containing a statutory rate, 365 for pure arithmetic.`
      );
    }

    // prose
    const introWords = countWords(t.intro);
    if (introWords < LIMITS.introWordsMin || introWords > LIMITS.introWordsMax) {
      at(
        t.slug,
        "intro",
        `${introWords} words, must be ${LIMITS.introWordsMin}-${LIMITS.introWordsMax}. ` +
          `This sits between the H1 and the widget — long enough to establish ` +
          `relevance, short enough not to push the widget below the fold.`
      );
    }
    for (const field of ["howItWorks", "gotchas"] as const) {
      const words = countWords(t[field]);
      if (words < LIMITS.proseWordsMin) {
        at(
          t.slug,
          field,
          `${words} words, minimum ${LIMITS.proseWordsMin}. A section this short ` +
            `is a heading with filler under it and will not earn the H2.`
        );
      }
    }

    // faqs
    if (t.faqs.length < LIMITS.faqsMin || t.faqs.length > LIMITS.faqsMax) {
      at(
        t.slug,
        "faqs",
        `${t.faqs.length} entries, must be ${LIMITS.faqsMin}-${LIMITS.faqsMax}.`
      );
    }
    t.faqs.forEach((faq, i) => {
      if (faq.q.trim().length < 10) {
        at(t.slug, `faqs[${i}].q`, `too short: "${faq.q}". Phrase it as a real query.`);
      }
      if (countWords(faq.a) < 15) {
        at(
          t.slug,
          `faqs[${i}].a`,
          `${countWords(faq.a)} words. Under 15 words is not an answer, it is a ` +
            `stub, and Google will treat the FAQPage node as low quality.`
        );
      }
    });

    // related
    if (t.related.length > LIMITS.relatedMax) {
      at(t.slug, "related", `${t.related.length} entries, max ${LIMITS.relatedMax}.`);
    }
    for (const r of t.related) {
      if (r === t.slug) {
        at(t.slug, "related", `contains its own slug "${r}".`);
      } else if (!known.has(r)) {
        at(
          t.slug,
          "related",
          `"${r}" does not exist in the registry. Dangling internal links are ` +
            `the fastest way to leak crawl budget into 404s.`
        );
      }
    }
    if (new Set(t.related).size !== t.related.length) {
      at(t.slug, "related", `contains duplicate slugs.`);
    }

    // sources
    const today = new Date().toISOString().slice(0, 10);
    (t.sources ?? []).forEach((s, i) => {
      if (s.label.trim().length === 0) {
        at(t.slug, `sources[${i}].label`, "empty.");
      }
      if (!s.url.startsWith("https://")) {
        at(t.slug, `sources[${i}].url`, `"${s.url}" must be an absolute https URL.`);
      }
      if (!isValidIsoDate(s.verifiedOn)) {
        at(
          t.slug,
          `sources[${i}].verifiedOn`,
          `"${s.verifiedOn}" is not a valid YYYY-MM-DD date.`
        );
      } else if (s.verifiedOn > today) {
        at(
          t.slug,
          `sources[${i}].verifiedOn`,
          `${s.verifiedOn} is in the future. This field records the day a human ` +
            `actually opened the URL.`
        );
      }
    });

    // widget
    if (typeof t.Widget !== "function" && typeof t.Widget !== "object") {
      at(t.slug, "Widget", "is not a React component reference.");
    }
  }

  if (issues.length > 0) throw new ToolRegistryError(issues);
}
```

**Acceptance criteria**

- [ ] `validateTools([])` does not throw.
- [ ] Every rule from decision #5 has a code path: slug format, slug uniqueness, `metaTitle <= 60`, `description` 120–165, FAQs 3–6, `howItWorks`/`gotchas` >= 120 words, dangling `related`, `TOOLS.length > 30`.
- [ ] Every thrown message contains the offending slug in `[brackets]` and the field name.
- [ ] The error message is *one* throw containing *all* issues, not the first one.
- [ ] `validate.ts` imports nothing from `react`, `next`, or `@db`.

---

### [PLAT-03] Vitest + validator test suite

**Estimate:** 3h · **Depends on:** PLAT-02 · **Files:** `vitest.config.ts` (new), `package.json`, `src/lib/tools/validate.test.ts` (new)

**Why** — Vitest over Jest: the repo is TS 5.8 + ESM + Next 14, and vitest runs `.ts` through esbuild with no transform config, no `next/jest`, no `moduleNameMapper` duplicating the `@/` and `@db` aliases from `tsconfig.json` (`vite-tsconfig-paths` reads them directly). Two devDeps, one config file, ~400ms cold. Jest here would mean SWC config plus alias duplication for the same result. We are testing the *rules*, not React — `environment: "node"`, no jsdom, no testing-library.

The validator is the one file where a bug is silent: a broken rule doesn't crash, it just stops catching bad content, and you find out three months later in Search Console.

**Implementation**

```bash
pnpm add -D vitest@^2 vite-tsconfig-paths@^5
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Reads `paths` from tsconfig.json, so "@/..." and "@db/..." resolve in tests
  // exactly as they do in the Next build. No second source of truth.
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next", "dist"],
    passWithNoTests: false,
  },
});
```

```jsonc
// package.json — scripts block only
{
  "scripts": {
    "dev": "next dev",
    // Tests gate the build. These are pure, synchronous, dependency-free unit
    // tests — there is no flake budget to worry about, and a registry that
    // fails validation must never reach Vercel's CDN.
    "build": "vitest run && next build",
    "build:only": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

```ts
// src/lib/tools/validate.test.ts
import { describe, expect, it } from "vitest";
import { ToolRegistryError, countWords, validateTools } from "./validate";
import { MAX_TOOLS, type ToolDef } from "./types";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

/** A tool that passes every rule. Every test mutates exactly one field off it,
 *  so a failure names the rule that broke rather than "something is wrong". */
function validTool(overrides: Partial<ToolDef> = {}): ToolDef {
  return {
    slug: "sample-tool",
    title: "Sample Tool",
    metaTitle: "Sample Tool — Free, Runs In Your Browser",
    description:
      "A sample tool used only in tests. It is exactly long enough to satisfy " +
      "the meta description length rule without being padded out with filler.",
    category: "calculators",
    audience: ["developers"],
    runsOn: "browser",
    status: "live",
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    reviewEveryDays: 365,
    keywords: ["sample", "test tool", "fixture"],
    intro: words(50),
    howItWorks: words(140),
    gotchas: words(140),
    faqs: [
      { q: "What does this do?", a: words(25) },
      { q: "Is it free to use?", a: words(25) },
      { q: "Does it upload my data?", a: words(25) },
    ],
    related: [],
    Widget: () => null,
    ...overrides,
  };
}

/** Runs the validator and returns the issue strings, or [] if it passed. */
function issuesFor(tools: ToolDef[]): string[] {
  try {
    validateTools(tools);
    return [];
  } catch (err) {
    if (err instanceof ToolRegistryError) return [...err.issues];
    throw err;
  }
}

describe("countWords", () => {
  it("ignores leading, trailing and repeated whitespace", () => {
    expect(countWords("  one   two \n three  ")).toBe(3);
  });
  it("returns 0 for an empty string", () => {
    expect(countWords("   ")).toBe(0);
  });
});

describe("validateTools — happy path", () => {
  it("accepts an empty registry", () => {
    expect(() => validateTools([])).not.toThrow();
  });
  it("accepts a fully valid tool", () => {
    expect(issuesFor([validTool()])).toEqual([]);
  });
  it("accepts related slugs that resolve", () => {
    const a = validTool({ slug: "tool-a", related: ["tool-b"] });
    const b = validTool({ slug: "tool-b", related: ["tool-a"] });
    expect(issuesFor([a, b])).toEqual([]);
  });
});

describe("validateTools — slugs", () => {
  it.each([
    ["Has-Uppercase"],
    ["has_underscore"],
    ["-leading-hyphen"],
    ["trailing-hyphen-"],
    ["double--hyphen"],
    ["has space"],
  ])("rejects the malformed slug %s", (slug) => {
    const found = issuesFor([validTool({ slug })]);
    expect(found.some((i) => i.includes("slug"))).toBe(true);
  });

  it("rejects a duplicate slug and names both indexes", () => {
    const found = issuesFor([validTool(), validTool()]);
    expect(found.some((i) => /duplicate.*TOOLS\[0\].*TOOLS\[1\]/.test(i))).toBe(true);
  });

  it("rejects the reserved slug 'category' because it collides with the route", () => {
    const found = issuesFor([validTool({ slug: "category" })]);
    expect(found.some((i) => i.includes("reserved"))).toBe(true);
  });
});

describe("validateTools — SEO field limits", () => {
  it("rejects a metaTitle over 60 characters", () => {
    const found = issuesFor([validTool({ metaTitle: "x".repeat(61) })]);
    expect(found.some((i) => i.includes("metaTitle"))).toBe(true);
  });

  it("accepts a metaTitle of exactly 60 characters", () => {
    expect(issuesFor([validTool({ metaTitle: "x".repeat(60) })])).toEqual([]);
  });

  it.each([119, 166])("rejects a description of %i characters", (len) => {
    const found = issuesFor([validTool({ description: "x".repeat(len) })]);
    expect(found.some((i) => i.includes("description"))).toBe(true);
  });

  it.each([120, 165])("accepts a description of %i characters", (len) => {
    expect(issuesFor([validTool({ description: "x".repeat(len) })])).toEqual([]);
  });
});

describe("validateTools — prose length", () => {
  it("rejects howItWorks under 120 words and reports the actual count", () => {
    const found = issuesFor([validTool({ howItWorks: words(119) })]);
    expect(found.some((i) => i.includes("howItWorks") && i.includes("119"))).toBe(true);
  });

  it("accepts gotchas at exactly 120 words", () => {
    expect(issuesFor([validTool({ gotchas: words(120) })])).toEqual([]);
  });

  it.each([39, 71])("rejects an intro of %i words", (n) => {
    const found = issuesFor([validTool({ intro: words(n) })]);
    expect(found.some((i) => i.includes("intro"))).toBe(true);
  });
});

describe("validateTools — FAQs", () => {
  it("rejects fewer than 3 FAQs", () => {
    const faqs = validTool().faqs.slice(0, 2);
    const found = issuesFor([validTool({ faqs })]);
    expect(found.some((i) => i.includes("faqs"))).toBe(true);
  });

  it("rejects more than 6 FAQs", () => {
    const faqs = Array.from({ length: 7 }, (_, i) => ({
      q: `A real sounding question number ${i}?`,
      a: words(25),
    }));
    const found = issuesFor([validTool({ faqs })]);
    expect(found.some((i) => i.includes("faqs"))).toBe(true);
  });

  it("rejects a stub answer and names the index", () => {
    const faqs = validTool().faqs.map((f, i) =>
      i === 1 ? { ...f, a: "Yes it is." } : f
    );
    const found = issuesFor([validTool({ faqs })]);
    expect(found.some((i) => i.includes("faqs[1].a"))).toBe(true);
  });
});

describe("validateTools — related links", () => {
  it("rejects a dangling related slug", () => {
    const found = issuesFor([validTool({ related: ["does-not-exist"] })]);
    expect(found.some((i) => i.includes("does-not-exist"))).toBe(true);
  });
  it("rejects a self-referencing related slug", () => {
    const found = issuesFor([validTool({ related: ["sample-tool"] })]);
    expect(found.some((i) => i.includes("its own slug"))).toBe(true);
  });
});

describe("validateTools — dates and sources", () => {
  it("rejects updatedAt before publishedAt", () => {
    const found = issuesFor([
      validTool({ publishedAt: "2026-05-01", updatedAt: "2026-04-30" }),
    ]);
    expect(found.some((i) => i.includes("updatedAt"))).toBe(true);
  });

  it("rejects a non-calendar date like 2026-02-30", () => {
    const found = issuesFor([validTool({ publishedAt: "2026-02-30" })]);
    expect(found.some((i) => i.includes("publishedAt"))).toBe(true);
  });

  it("rejects a source verifiedOn in the future", () => {
    const future = new Date(Date.now() + 86_400_000 * 3).toISOString().slice(0, 10);
    const found = issuesFor([
      validTool({
        sources: [{ label: "Dept of Labour", url: "https://example.gov.lk", verifiedOn: future }],
      }),
    ]);
    expect(found.some((i) => i.includes("sources[0].verifiedOn"))).toBe(true);
  });

  it("rejects a non-https source URL", () => {
    const found = issuesFor([
      validTool({
        sources: [{ label: "X", url: "http://example.gov.lk", verifiedOn: "2026-01-01" }],
      }),
    ]);
    expect(found.some((i) => i.includes("sources[0].url"))).toBe(true);
  });
});

describe("validateTools — the content-farm cap", () => {
  it(`accepts exactly ${MAX_TOOLS} tools`, () => {
    const tools = Array.from({ length: MAX_TOOLS }, (_, i) =>
      validTool({ slug: `tool-${i}` })
    );
    expect(issuesFor(tools)).toEqual([]);
  });

  it(`rejects ${MAX_TOOLS + 1} tools`, () => {
    const tools = Array.from({ length: MAX_TOOLS + 1 }, (_, i) =>
      validTool({ slug: `tool-${i}` })
    );
    const found = issuesFor(tools);
    expect(found.some((i) => i.includes("MAX_TOOLS"))).toBe(true);
  });
});

describe("validateTools — error aggregation", () => {
  it("reports every problem in one throw, not just the first", () => {
    const found = issuesFor([
      validTool({ slug: "Bad Slug", metaTitle: "x".repeat(70), faqs: [] }),
    ]);
    expect(found.length).toBeGreaterThanOrEqual(3);
  });
});
```

**Acceptance criteria**

- [ ] `pnpm test` runs and every test passes.
- [ ] `pnpm build` runs vitest first; deliberately breaking one test makes `pnpm build` exit non-zero **before** Next compiles anything.
- [ ] Test count ≥ 30 (the `it.each` expansions count).
- [ ] Deliberately deleting the `MAX_TOOLS` check from `validate.ts` turns the cap test red. Restore.
- [ ] `pnpm exec tsc --noEmit` still passes with the `.test.ts` file in the project.

---

### [PLAT-04] The proving tool — Sri Lanka EPF & ETF calculator widget

**Estimate:** 4h · **Depends on:** — · **Files:** `src/components/tools/widgets/epf-etf-calculator.tsx` (new)

**Why** — This is the cheapest possible tool that is genuinely useful: three multiplications, zero new dependencies, zero bytes of WASM, zero server invocations. It proves the template end to end *and* it exercises `sources[]`, which would otherwise be dead code shipped untested. It is also the right first tool commercially — "EPF ETF calculator Sri Lanka" is a low-competition query where a personal site with a real Sri Lankan entity behind it can rank, unlike "word counter".

Because it has no WASM, it is a **plain `"use client"` component imported statically by the registry**, not a `next/dynamic(ssr:false)` widget. That matters: it renders during SSG, so the widget's markup is in the static HTML the crawler receives, and there is no layout shift. Reserve `dynamic(ssr:false)` for the tools that actually need it.

**Implementation**

```tsx
// src/components/tools/widgets/epf-etf-calculator.tsx
"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Statutory contribution rates, Sri Lanka.
 *
 * VERIFY BEFORE EVERY `updatedAt` BUMP. These are someone else's rules and they
 * change. The registry entry carries `sources[]` with the URLs and the date a
 * human last read them; keep the two in sync or the citation is a lie.
 */
const RATES = {
  /** EPF — deducted from the employee's earnings. */
  epfEmployee: 0.08,
  /** EPF — paid by the employer on top of earnings. */
  epfEmployer: 0.12,
  /** ETF — paid entirely by the employer. No employee share. */
  etfEmployer: 0.03,
} as const;

const lkr = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 2,
});

interface Breakdown {
  gross: number;
  epfEmployee: number;
  epfEmployer: number;
  epfTotal: number;
  etfEmployer: number;
  takeHome: number;
  employerCost: number;
}

function compute(gross: number): Breakdown {
  const epfEmployee = gross * RATES.epfEmployee;
  const epfEmployer = gross * RATES.epfEmployer;
  const etfEmployer = gross * RATES.etfEmployer;
  return {
    gross,
    epfEmployee,
    epfEmployer,
    epfTotal: epfEmployee + epfEmployer,
    etfEmployer,
    takeHome: gross - epfEmployee,
    employerCost: gross + epfEmployer + etfEmployer,
  };
}

function Row({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2.5",
        emphasis && "font-semibold"
      )}
    >
      <div className="min-w-0">
        <span className="text-sm">{label}</span>
        {note ? (
          <span className="ml-2 text-xs text-muted-foreground">{note}</span>
        ) : null}
      </div>
      <span className="shrink-0 tabular-nums text-sm">{value}</span>
    </div>
  );
}

export default function EpfEtfCalculator() {
  // Kept as a string so the field can be genuinely empty rather than showing 0.
  const [raw, setRaw] = useState("100000");

  const parsed = useMemo(() => {
    const cleaned = raw.replace(/[,\s]/g, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }, [raw]);

  const result = useMemo(
    () => (parsed === null ? null : compute(parsed)),
    [parsed]
  );

  return (
    <div className="rounded-lg border">
      <div className="border-b p-4 sm:p-6">
        <Label htmlFor="epf-gross" className="text-sm font-medium">
          Monthly gross earnings (LKR)
        </Label>
        <Input
          id="epf-gross"
          // `inputMode` gives mobile the numeric keypad; type="text" keeps the
          // spinner off and lets us accept "100,000" without fighting the browser.
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="100000"
          aria-describedby="epf-gross-help"
          className="mt-2 text-base tabular-nums"
        />
        <p id="epf-gross-help" className="mt-2 text-xs text-muted-foreground">
          Total earnings for the month, before any deduction. Commas are fine.
        </p>
      </div>

      <div className="p-4 sm:p-6" aria-live="polite">
        {result === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Enter a monthly gross amount to see the breakdown.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Employee
              </h3>
              <div className="divide-y">
                <Row label="Gross earnings" value={lkr.format(result.gross)} />
                <Row
                  label="EPF deduction"
                  note="8%"
                  value={`− ${lkr.format(result.epfEmployee)}`}
                />
                <Row
                  label="Take-home before tax"
                  value={lkr.format(result.takeHome)}
                  emphasis
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                APIT (income tax) is not included — it depends on the employee&apos;s
                annual position, not this month&apos;s figure.
              </p>
            </div>

            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Employer
              </h3>
              <div className="divide-y">
                <Row
                  label="EPF contribution"
                  note="12%"
                  value={lkr.format(result.epfEmployer)}
                />
                <Row
                  label="ETF contribution"
                  note="3%"
                  value={lkr.format(result.etfEmployer)}
                />
                <Row
                  label="Total cost of employment"
                  value={lkr.format(result.employerCost)}
                  emphasis
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Total credited to the EPF account:{" "}
                <strong className="tabular-nums">
                  {lkr.format(result.epfTotal)}
                </strong>{" "}
                (20% of gross).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Acceptance criteria**

- [ ] `RATES` values verified against the Department of Labour / Central Bank pages **on the day of merge**, and the same URLs + date go into the registry entry's `sources[]`.
- [ ] Entering `100000` shows employee EPF 8,000, employer EPF 12,000, ETF 3,000, take-home 92,000, employer cost 115,000.
- [ ] Clearing the field shows the empty-state sentence, not `NaN` or `Rs 0.00`.
- [ ] Entering `abc`, `-5`, or `1e400` shows the empty state and never throws (check the console).
- [ ] Entering `100,000` with a comma produces the same result as `100000`.
- [ ] Imports only from `react`, `@/components/ui/input`, `@/components/ui/label`, `@/lib/utils`. `pnpm-lock.yaml` is unchanged by this ticket.
- [ ] Keyboard only: Tab reaches the input, typing updates results, no focus trap.
- [ ] The results markup is present in `curl` output of the built page (it must SSG, since this component is not behind `ssr:false`).

---

### [PLAT-05] `registry.ts` — the single source of truth, with the first entry filled in

**Estimate:** 2h · **Depends on:** PLAT-01, PLAT-02, PLAT-04 · **Files:** `src/lib/tools/registry.ts` (new)

**Why** — One typed array, validated at module scope, is the whole content model. No DB, no CMS, no MDX pipeline. The module-scope `validateTools(TOOLS)` call is the mechanism that turns decision #5 from documentation into enforcement: `next build` imports this module during `generateStaticParams`, so a bad entry throws before a single page is emitted.

**The import rule that matters:** this file may statically import **only** `"use client"` widget modules, never a heavy implementation. Every tool page imports the whole registry (it needs `getTool` and `related` titles), so anything reachable from here lands in every tool page's module graph. Light widgets (like PLAT-04) are imported directly and get SSG'd. Heavy widgets get a 10-line `"use client"` stub that does the `dynamic(ssr:false)` internally — the stub is what the registry imports, and the heavy chunk stays lazily loaded. This indirection also sidesteps a hard Next 14 constraint: `dynamic(..., { ssr: false })` throws if it is evaluated in a Server Component module, and `registry.ts` is imported by server components.

**Implementation**

```ts
// src/lib/tools/registry.ts
import EpfEtfCalculator from "@/components/tools/widgets/epf-etf-calculator";
import { TOOL_CATEGORIES, type ToolCategory, type ToolDef } from "./types";
import { validateTools } from "./validate";

/**
 * The tools registry. Adding a tool means adding an object here — nothing else.
 * Pages, sitemap entries, category listings, breadcrumbs, JSON-LD and internal
 * links are all derived.
 *
 * IMPORT RULE: only `"use client"` widget modules may be imported into this
 * file, and only ever the thin wrapper — never the heavy implementation.
 * Every tool page pulls in this module, so a stray `import "pdfjs-dist"` here
 * ships that library on all 30 pages.
 *
 * NEVER import from `@db` here. `minPoolSize: 5` means one warm lambda pins
 * five Atlas connections; static pages must not touch the pool at all.
 */
export const TOOLS: readonly ToolDef[] = [
  {
    slug: "epf-etf-calculator-sri-lanka",
    title: "EPF and ETF Calculator Sri Lanka",
    metaTitle: "EPF & ETF Calculator Sri Lanka (Free, No Signup)",
    description:
      "Work out Sri Lankan EPF and ETF contributions from a monthly gross salary. " +
      "Shows the 8% employee share, 12% employer share and 3% ETF, instantly.",
    category: "calculators",
    audience: ["sri-lanka", "small-business"],
    runsOn: "browser",
    status: "live",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    // Statutory rates. 90 days, not 365 — someone else controls these numbers.
    reviewEveryDays: 90,
    keywords: [
      "epf etf calculator sri lanka",
      "epf calculator sri lanka",
      "etf calculation sri lanka",
      "epf 8 12 percent",
      "employer epf contribution sri lanka",
    ],
    intro:
      "Enter a monthly gross salary and this calculator splits out the three " +
      "statutory contributions Sri Lankan employers deal with every payroll run: " +
      "the 8% employee EPF deduction, the 12% employer EPF contribution, and the " +
      "3% employer ETF contribution. It also totals the employer's real cost per " +
      "employee. Everything runs in your browser — no salary figure leaves this page.",
    howItWorks:
      "The calculator takes one number: total monthly earnings before any " +
      "deduction. From that it applies three fixed percentages. Eight per cent " +
      "comes out of the employee's earnings as their EPF contribution, which is " +
      "why take-home pay shown here is ninety-two per cent of gross before income " +
      "tax. Twelve per cent is added by the employer on top of the salary, and " +
      "both amounts are remitted to the same Employees' Provident Fund account, " +
      "so twenty per cent of gross earnings is credited each month. Three per cent " +
      "goes to the Employees' Trust Fund and is paid entirely by the employer — " +
      "there is no employee share of ETF, which is the single detail people most " +
      "often get wrong.\n\n" +
      "The employer column adds the twelve and the three to the gross figure to " +
      "give the true monthly cost of employing that person, which is the number " +
      "you want when you are pricing a hire rather than reading a payslip. Nothing " +
      "is sent anywhere: the arithmetic runs in JavaScript in your own browser, " +
      "there is no request to a server, and closing the tab discards everything.",
    gotchas:
      "The number you enter must be total earnings, not basic salary. In Sri " +
      "Lankan practice EPF and ETF are calculated on total earnings, which " +
      "typically sweeps in fixed allowances that people mentally file as separate " +
      "from salary. Feeding in basic-only will under-state every figure on this " +
      "page.\n\n" +
      "This is not a payslip. Income tax under APIT is deliberately excluded, " +
      "because APIT depends on the employee's cumulative annual position and their " +
      "declared reliefs, not on this month's gross in isolation — any tool that " +
      "shows you a single-month tax figure from one input is guessing. Stamp duty, " +
      "loan recoveries, and no-pay adjustments are likewise not modelled.\n\n" +
      "Rates are statutory and can be changed by legislation. The figures used " +
      "here were read from the sources listed below on the dates shown; if you are " +
      "computing something with money or legal consequences attached, check those " +
      "sources yourself rather than trusting a calculator on a personal website. " +
      "Finally, this assumes a single standard employment relationship — it does " +
      "not model exempted approved provident funds, which have their own rules.",
    faqs: [
      {
        q: "Is ETF deducted from the employee's salary?",
        a: "No. ETF is a three per cent contribution paid entirely by the employer on top of earnings. Nothing is deducted from the employee for ETF, which is why the employee column on this page shows only the eight per cent EPF deduction.",
      },
      {
        q: "What is the total EPF contribution per month?",
        a: "Twenty per cent of total monthly earnings: eight per cent deducted from the employee plus twelve per cent added by the employer. Both are remitted to the same EPF member account, so the account grows by a fifth of gross earnings each month.",
      },
      {
        q: "Should I use basic salary or total earnings?",
        a: "Total earnings. EPF and ETF are calculated on total monthly earnings rather than basic salary alone, so fixed allowances that form part of earnings should be included in the figure you type in.",
      },
      {
        q: "Does this calculator send my salary anywhere?",
        a: "No. The page is a static file and the calculation runs in JavaScript inside your own browser. There is no API call, no analytics event carrying the amount, and nothing is stored. You can verify this with the network tab open.",
      },
    ],
    related: [],
    sources: [
      {
        label: "Department of Labour, Sri Lanka — EPF contribution rates",
        url: "https://www.labourdept.gov.lk/",
        // VERIFY ON MERGE DAY and set this to that date.
        verifiedOn: "2026-08-18",
      },
      {
        label: "Central Bank of Sri Lanka — Employees' Provident Fund",
        url: "https://www.cbsl.gov.lk/en/epf",
        verifiedOn: "2026-08-18",
      },
    ],
    Widget: EpfEtfCalculator,
  },
];

/**
 * Module-scope validation. This is the whole enforcement mechanism: `next build`
 * imports this module while running generateStaticParams, so an invalid entry
 * throws before any HTML is emitted. Do not wrap this in a NODE_ENV check —
 * production is exactly where it must run.
 */
validateTools(TOOLS);

const BY_SLUG = new Map(TOOLS.map((t) => [t.slug, t]));

export function getTool(slug: string): ToolDef | undefined {
  return BY_SLUG.get(slug);
}

export function getToolsByCategory(category: ToolCategory): ToolDef[] {
  return TOOLS.filter((t) => t.category === category);
}

/** Categories that actually contain at least one tool, in tuple order. */
export function activeCategories(): ToolCategory[] {
  return TOOL_CATEGORIES.filter((c) => getToolsByCategory(c).length > 0);
}

/**
 * A category page with one or two tools is a thin page that links to content
 * already reachable from the hub. Below this threshold the page still renders
 * (people arrive via breadcrumbs) but carries `noindex, follow` and is kept out
 * of the sitemap. Above it, the page earns its place in the index.
 */
export const MIN_TOOLS_FOR_INDEXABLE_CATEGORY = 3;

export function isCategoryIndexable(category: ToolCategory): boolean {
  return getToolsByCategory(category).length >= MIN_TOOLS_FOR_INDEXABLE_CATEGORY;
}

/** Newest first. Used by the hub and by the homepage teaser. */
export function toolsByRecency(): ToolDef[] {
  return [...TOOLS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
```

**Acceptance criteria**

- [ ] `pnpm build` succeeds with exactly one tool in the registry.
- [ ] Temporarily setting `metaTitle` to 70 characters makes `pnpm build` fail with a message naming `[epf-etf-calculator-sri-lanka] metaTitle`. Revert.
- [ ] Temporarily adding `related: ["nope"]` makes the build fail. Revert.
- [ ] `grep -rn "@db" src/lib/tools/` returns nothing.
- [ ] `grep -n "import" src/lib/tools/registry.ts` shows imports only from `@/components/tools/widgets/*`, `./types`, `./validate`.
- [ ] `sources[].verifiedOn` on both entries equals the actual date the URLs were opened.

---

### [PLAT-06] JSON-LD `@graph` builder

**Estimate:** 2h · **Depends on:** PLAT-01, PLAT-05 · **Files:** `src/lib/tools/jsonld.ts` (new)

**Why** — The root layout already publishes `#person` and `#website` nodes. If tool pages emit standalone `SoftwareApplication` nodes with no `@id` references, Google resolves them as unrelated entities and the tools do nothing for the personal brand — which is the entire strategic point of hosting them on this domain rather than a separate one. Every node here either *is* referenced by `@id` or references the existing ones.

Note what is deliberately absent: `aggregateRating`. There are no reviews. Inventing them is a structured-data manual action, and a manual action on `kavithakanchana.me` would take the blog and homepage down with it.

**Implementation**

```ts
// src/lib/tools/jsonld.ts
import { DATA } from "@/data/resume";
import { CATEGORY_LABELS, type ToolCategory, type ToolDef } from "./types";

const BASE = DATA.url.replace(/\/$/, "");
const PERSON = `${BASE}/#person`;
const WEBSITE = `${BASE}/#website`;

/** Crawlers want a timestamp, the registry stores a calendar date. */
function toIso(date: string): string {
  return `${date}T00:00:00+05:30`;
}

function breadcrumb(
  id: string,
  trail: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * One @graph per tool page: SoftwareApplication + FAQPage + BreadcrumbList,
 * glued by a WebPage node so the tool inherits the site's existing entity
 * rather than floating free.
 */
export function toolJsonLd(tool: ToolDef): Record<string, unknown> {
  const url = `${BASE}/tools/${tool.slug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: tool.metaTitle,
        description: tool.description,
        inLanguage: "en-US",
        isPartOf: { "@id": WEBSITE },
        about: { "@id": `${url}#app` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${BASE}/og?kind=tool&title=${encodeURIComponent(tool.title)}`,
        },
        datePublished: toIso(tool.publishedAt),
        dateModified: toIso(tool.updatedAt),
        breadcrumb: { "@id": `${url}#breadcrumb` },
        // Author/publisher point at the SAME @id the root layout emits, so the
        // tool reinforces one Person entity instead of minting a new one.
        author: { "@id": PERSON },
        publisher: { "@id": PERSON },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#app`,
        name: tool.title,
        url,
        description: tool.description,
        applicationCategory: "UtilitiesApplication",
        applicationSubCategory: CATEGORY_LABELS[tool.category],
        operatingSystem: "Any — runs in a web browser",
        browserRequirements: "Requires JavaScript enabled.",
        datePublished: toIso(tool.publishedAt),
        dateModified: toIso(tool.updatedAt),
        isAccessibleForFree: true,
        // Free, and explicitly so — omitting `offers` makes Search Console
        // complain, and a zero-price Offer is the honest way to say it.
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        author: { "@id": PERSON },
        publisher: { "@id": PERSON },
        isPartOf: { "@id": WEBSITE },
        keywords: tool.keywords.join(", "),
        // NOTE: no aggregateRating. There are no reviews. Fabricating one is a
        // structured-data manual action that would hit the whole domain.
        ...(tool.sources?.length
          ? {
              citation: tool.sources.map((s) => ({
                "@type": "CreativeWork",
                name: s.label,
                url: s.url,
              })),
            }
          : {}),
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        isPartOf: { "@id": `${url}#webpage` },
        mainEntity: tool.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
      breadcrumb(`${url}#breadcrumb`, [
        { name: "Home", url: `${BASE}/` },
        { name: "Tools", url: `${BASE}/tools` },
        {
          name: CATEGORY_LABELS[tool.category],
          url: `${BASE}/tools/category/${tool.category}`,
        },
        { name: tool.title, url },
      ]),
    ],
  };
}

/** Hub: CollectionPage + ItemList + BreadcrumbList. */
export function toolsHubJsonLd(tools: readonly ToolDef[]): Record<string, unknown> {
  const url = `${BASE}/tools`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name: "Free online tools",
        description:
          "Free browser-based tools built and maintained by Kavitha Kanchana.",
        inLanguage: "en-US",
        isPartOf: { "@id": WEBSITE },
        author: { "@id": PERSON },
        publisher: { "@id": PERSON },
        mainEntity: { "@id": `${url}#list` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        itemListOrder: "https://schema.org/ItemListUnordered",
        numberOfItems: tools.length,
        itemListElement: tools.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.title,
          url: `${BASE}/tools/${t.slug}`,
        })),
      },
      breadcrumb(`${url}#breadcrumb`, [
        { name: "Home", url: `${BASE}/` },
        { name: "Tools", url },
      ]),
    ],
  };
}

/** Category page: same shape as the hub, scoped to one category. */
export function toolCategoryJsonLd(
  category: ToolCategory,
  tools: readonly ToolDef[]
): Record<string, unknown> {
  const url = `${BASE}/tools/category/${category}`;
  const label = CATEGORY_LABELS[category];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name: label,
        inLanguage: "en-US",
        isPartOf: { "@id": WEBSITE },
        author: { "@id": PERSON },
        publisher: { "@id": PERSON },
        mainEntity: { "@id": `${url}#list` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        numberOfItems: tools.length,
        itemListElement: tools.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.title,
          url: `${BASE}/tools/${t.slug}`,
        })),
      },
      breadcrumb(`${url}#breadcrumb`, [
        { name: "Home", url: `${BASE}/` },
        { name: "Tools", url: `${BASE}/tools` },
        { name: label, url },
      ]),
    ],
  };
}
```

**Acceptance criteria**

- [ ] Every `@id` in the tool graph is either self-defined or one of `${DATA.url}/#person` / `${DATA.url}/#website`.
- [ ] The built HTML for the tool page passes validator.schema.org with 0 errors.
- [ ] Google Rich Results Test reports FAQ and Breadcrumb as eligible for the tool page.
- [ ] No `aggregateRating`, `review`, or `ratingValue` appears anywhere: `grep -rin "rating" src/lib/tools/` returns nothing.
- [ ] The `#person` `@id` string is byte-identical to the one in `src/app/layout.tsx` (compare with `grep -o '#person' -B2` on both build outputs, or diff the two literal expressions).

---

### [PLAT-07] `<ToolShell>` — the page template

**Estimate:** 5h · **Depends on:** PLAT-01, PLAT-06 · **Files:** `src/components/tools/tool-shell.tsx` (new), `src/components/tools/prose.tsx` (new)

**Why** — Section order is load-bearing and this is the only place it exists. Every tool built after this one inherits it for free, and the order stops being a thing anyone has to remember. The widget must sit above the fold: a visitor arriving from a query wants the tool, and time-to-first-interaction on that widget is the behavioural signal that decides whether the page keeps its ranking.

Two details worth flagging. First, the privacy line in the meta row is **derived from `runsOn`** — hardcoding "nothing uploaded" would put a false claim on every future Railway-backed tool. Second, prose is stored as plain strings with `\n\n` breaks and split here; adding a markdown renderer for two fields would ship a parser to every tool page for no benefit.

**Implementation**

```tsx
// src/components/tools/prose.tsx
/**
 * Registry prose is plain text with blank-line paragraph breaks. Splitting here
 * avoids shipping react-markdown (and its unified/remark tail) to every tool
 * page to render two fields that contain no markup.
 */
export function Prose({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
          {p}
        </p>
      ))}
    </div>
  );
}
```

```tsx
// src/components/tools/tool-shell.tsx
// Server component. No "use client" — the only interactive part is tool.Widget,
// which carries its own client boundary.
import Image from "next/image";
import Link from "next/link";
import { DATA } from "@/data/resume";
import { toolJsonLd } from "@/lib/tools/jsonld";
import { getTool } from "@/lib/tools/registry";
import { CATEGORY_LABELS, type ToolDef, type ToolRuntime } from "@/lib/tools/types";
import { Prose } from "./prose";

/**
 * The privacy claim is derived, never hardcoded. "Nothing uploaded" on a tool
 * that POSTs to Railway is a claim a user can disprove with devtools open, and
 * it is the kind of thing that turns into a Hacker News comment.
 */
function privacyLine(runsOn: ToolRuntime): string {
  switch (runsOn) {
    case "browser":
      return "Runs in your browser — nothing uploaded";
    case "railway":
      return "Processed on my server, deleted within 60 minutes";
    case "hybrid":
      return "Runs in your browser where it can; large files go to my server and are deleted within 60 minutes";
  }
}

function formatUpdated(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ToolShell({ tool }: { tool: ToolDef }) {
  const categoryHref = `/tools/category/${tool.category}`;
  const related = tool.related
    .map(getTool)
    .filter((t): t is ToolDef => Boolean(t));

  return (
    <>
      <a
        href="#tool-widget"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
      >
        Skip to the tool
      </a>

      {/* 1 — Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <li><Link href="/" className="hover:text-foreground">Home</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/tools" className="hover:text-foreground">Tools</Link></li>
          <li aria-hidden>/</li>
          <li>
            <Link href={categoryHref} className="hover:text-foreground">
              {CATEGORY_LABELS[tool.category]}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-foreground">{tool.title}</li>
        </ol>
      </nav>

      <main id="main-content">
        {/* 2 — H1, the exact target keyword */}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tool.title}
        </h1>

        {/* 3 — meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Link href={categoryHref} className="hover:text-foreground">
            {CATEGORY_LABELS[tool.category]}
          </Link>
          <span aria-hidden>·</span>
          <span>{privacyLine(tool.runsOn)}</span>
          <span aria-hidden>·</span>
          <span>
            Updated{" "}
            <time dateTime={tool.updatedAt}>{formatUpdated(tool.updatedAt)}</time>
          </span>
          {tool.status === "beta" ? (
            <>
              <span aria-hidden>·</span>
              <span className="rounded border px-1.5 py-0.5 font-medium">Beta</span>
            </>
          ) : null}
        </div>

        {/* 4 — intro, 40-70 words */}
        <p className="mt-4 text-sm leading-relaxed">{tool.intro}</p>

        {/* 5 — THE WIDGET. Above the fold. Nothing goes between 4 and 5. */}
        <section id="tool-widget" className="mt-6 scroll-mt-6">
          <h2 className="sr-only">{tool.title}</h2>
          <tool.Widget />
        </section>

        {/* 6 — How it works */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
          <div className="mt-3">
            <Prose text={tool.howItWorks} />
          </div>
        </section>

        {/* 7 — Edge cases and gotchas (+ dated sources, if any) */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">
            Edge cases and gotchas
          </h2>
          <div className="mt-3">
            <Prose text={tool.gotchas} />
          </div>

          {tool.sources?.length ? (
            <div className="mt-5 rounded-lg border p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sources
              </h3>
              <ul className="mt-2 space-y-1.5">
                {tool.sources.map((s) => (
                  <li key={s.url} className="text-xs text-muted-foreground">
                    <a
                      href={s.url}
                      className="underline underline-offset-2 hover:text-foreground"
                      rel="noopener nofollow"
                      target="_blank"
                    >
                      {s.label}
                    </a>{" "}
                    — checked{" "}
                    <time dateTime={s.verifiedOn}>{formatUpdated(s.verifiedOn)}</time>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* 8 — FAQ. Plain headings, not <details>: no JS, guaranteed in the DOM,
             and it matches the FAQPage node byte for byte. */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <dl className="mt-3 space-y-4">
            {tool.faqs.map((faq) => (
              <div key={faq.q}>
                <dt className="text-sm font-medium">{faq.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 9 — Related tools */}
        {related.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Related tools</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/tools/${r.slug}`}
                    className="block rounded-lg border p-3 transition-colors hover:border-foreground/20"
                  >
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {r.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 10 — Author card. The E-E-A-T signal, and a link back into the site. */}
        <section className="mt-10 flex items-start gap-4 rounded-lg border p-4">
          <Image
            src={DATA.avatarUrl}
            alt={DATA.name}
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-medium">
              Built and maintained by{" "}
              <Link href="/" className="underline underline-offset-2">
                {DATA.name}
              </Link>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Software engineer at Cortana AI and co-founder of Ryzera
              Technologies, based in Sri Lanka. Found a bug or a wrong number?{" "}
              <a
                href={`mailto:${DATA.contact.email}?subject=${encodeURIComponent(
                  `Feedback: ${tool.title}`
                )}`}
                className="underline underline-offset-2"
              >
                Email me
              </a>
              .
            </p>
          </div>
        </section>
      </main>

      {/* 11 — JSON-LD, last so it never delays first paint */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd(tool)) }}
      />
    </>
  );
}
```

**Acceptance criteria**

- [ ] Rendered DOM order matches decision #7 exactly. Verify with `curl -s <url> | grep -o '<h1\|<h2\|id="tool-widget"' | head -20` and read the sequence.
- [ ] Nothing renders between the intro `<p>` and `#tool-widget`.
- [ ] On a 390×844 viewport, the widget's input field is visible without scrolling (measure in devtools device mode).
- [ ] `runsOn: "railway"` on a scratch entry renders the server-processing sentence, not "nothing uploaded". Revert.
- [ ] Exactly one `<h1>` on the page.
- [ ] Every FAQ `q`/`a` string appears both in visible DOM text and in the JSON-LD `FAQPage` node.
- [ ] `related: []` renders no "Related tools" heading (no empty section).
- [ ] `tool-shell.tsx` has no `"use client"` directive and does not import `useState`/`useEffect`.
- [ ] Skip link works: Tab from page load focuses "Skip to the tool", Enter jumps to the widget.

---

### [PLAT-08] `/tools/[slug]` — statically generated tool pages

**Estimate:** 3h · **Depends on:** PLAT-05, PLAT-07 · **Files:** `src/app/(tools)/tools/[slug]/page.tsx` (new)

**Why** — `dynamicParams = false` plus `generateStaticParams` is the difference between 30 CDN-served HTML files and 30 lambda invocations per crawl. It also means an unknown slug 404s at the edge instead of booting a function to discover it does not exist, which is what turns a scraper hitting `/tools/<random>` into a bill.

**Implementation**

```tsx
// src/app/(tools)/tools/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolShell } from "@/components/tools/tool-shell";
import { DATA } from "@/data/resume";
import { TOOLS, getTool } from "@/lib/tools/registry";

// Only registry slugs exist. Anything else is a 404 served from the CDN with
// zero function invocations.
export const dynamicParams = false;
// Belt and braces: if someone later introduces a dynamic API (cookies(), a
// searchParams read) into this subtree, the build fails instead of silently
// converting 30 static files into 30 lambdas.
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ slug: string }> {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const tool = getTool(params.slug);
  if (!tool) return { title: "Tool not found", robots: { index: false } };

  const url = `${DATA.url}/tools/${tool.slug}`;
  const ogImage = `${DATA.url}/og?kind=tool&title=${encodeURIComponent(tool.title)}`;

  return {
    // The root layout's template appends " | Kavitha Kanchana", which is why
    // metaTitle is capped at 60 before the suffix — check the rendered <title>,
    // not just the registry string.
    title: tool.metaTitle,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: url },
    // Beta tools are followed but not indexed until the maths is trusted.
    robots:
      tool.status === "beta"
        ? { index: false, follow: true }
        : { index: true, follow: true },
    openGraph: {
      title: tool.metaTitle,
      description: tool.description,
      url,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: tool.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: tool.metaTitle,
      description: tool.description,
      images: [ogImage],
    },
  };
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = getTool(params.slug);
  // Unreachable with dynamicParams=false, but it is what narrows the type and
  // it is the correct behaviour if that flag ever changes.
  if (!tool) notFound();
  return <ToolShell tool={tool} />;
}
```

**Acceptance criteria**

- [ ] `pnpm build` route table shows `/tools/[slug]` as `●  (SSG)` with the correct page count, not `ƒ (Dynamic)`.
- [ ] `.next/server/app/tools/epf-etf-calculator-sri-lanka.html` exists after build.
- [ ] `/tools/not-a-real-tool` returns HTTP 404 in prod.
- [ ] Rendered `<title>` is `EPF & ETF Calculator Sri Lanka (Free, No Signup) | Kavitha Kanchana` and the pre-suffix portion is ≤ 60 chars.
- [ ] `<link rel="canonical">` is the absolute `https://kavithakanchana.me/tools/...` URL.
- [ ] Setting `status: "beta"` emits `<meta name="robots" content="noindex, follow">`. Revert.
- [ ] Vercel function logs show **zero** invocations after loading the page 10 times.

---

### [PLAT-09] `/tools` hub

**Estimate:** 3h · **Depends on:** PLAT-05, PLAT-06 · **Files:** `src/app/(tools)/tools/page.tsx` (new)

**Why** — The hub is the crawl entry point for every tool and the page most likely to rank for "free online tools" style navigational queries from people who already know the name. The under-60-links rule is not superstition: a hub whose link count grows unbounded dilutes the equity each tool receives and starts to look like a directory. With `MAX_TOOLS = 30` plus five categories plus a handful of chrome links, the ceiling is structurally around 40.

**Implementation**

```tsx
// src/app/(tools)/tools/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { DATA } from "@/data/resume";
import { toolsHubJsonLd } from "@/lib/tools/jsonld";
import {
  TOOLS,
  activeCategories,
  getToolsByCategory,
  toolsByRecency,
} from "@/lib/tools/registry";
import { CATEGORY_LABELS } from "@/lib/tools/types";

export const dynamic = "force-static";

const HUB_TITLE = "Free Online Tools — No Signup, No Upload";
const HUB_DESCRIPTION =
  "A small set of free tools I built and actually maintain: calculators, " +
  "image and PDF utilities. Most run entirely in your browser with no upload.";

export const metadata: Metadata = {
  title: HUB_TITLE,
  description: HUB_DESCRIPTION,
  alternates: { canonical: `${DATA.url}/tools` },
  openGraph: {
    title: HUB_TITLE,
    description: HUB_DESCRIPTION,
    url: `${DATA.url}/tools`,
    type: "website",
    images: [
      {
        url: `${DATA.url}/og?kind=tool&title=${encodeURIComponent("Free online tools")}`,
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function ToolsHubPage() {
  const categories = activeCategories();
  const recent = toolsByRecency();

  /**
   * Link budget for this page, kept under 60 by construction:
   *   1 breadcrumb (Home) + N category chips (<= 5) + M tool cards (<= 30)
   *   + 1 profile link. With MAX_TOOLS = 30 the ceiling is 37.
   * If this page ever needs pagination, the registry cap is the thing to
   * revisit first — not the pagination.
   */
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <li><Link href="/" className="hover:text-foreground">Home</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-foreground">Tools</li>
        </ol>
      </nav>

      <main id="main-content">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Free online tools
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {TOOLS.length === 1 ? "One tool" : `${TOOLS.length} tools`} I built
          because I needed them, kept online because other people did too. Most
          run entirely in your browser: no account, no upload, no watermark. I
          maintain these personally — if a number looks wrong, email me and I
          will fix it.
        </p>

        {categories.length > 1 ? (
          <nav aria-label="Tool categories" className="mt-6 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c}
                href={`/tools/category/${c}`}
                className="rounded-full border px-3 py-1 text-xs transition-colors hover:border-foreground/20"
              >
                {CATEGORY_LABELS[c]}{" "}
                <span className="text-muted-foreground">
                  {getToolsByCategory(c).length}
                </span>
              </Link>
            ))}
          </nav>
        ) : null}

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {recent.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={`/tools/${tool.slug}`}
                className="flex h-full flex-col rounded-lg border p-4 transition-colors hover:border-foreground/20"
              >
                <span className="text-sm font-semibold">{tool.title}</span>
                <span className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {tool.description}
                </span>
                <span className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[tool.category]}
                  {tool.runsOn === "browser" ? " · runs offline" : null}
                  {tool.status === "beta" ? " · beta" : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-xs text-muted-foreground">
          Built by{" "}
          <Link href="/" className="underline underline-offset-2">
            {DATA.name}
          </Link>
          , software engineer in Sri Lanka.
        </p>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolsHubJsonLd(recent)) }}
      />
    </>
  );
}
```

**Acceptance criteria**

- [ ] `/tools` builds as `●  (SSG)`.
- [ ] `curl -s https://kavithakanchana.me/tools | grep -o '<a ' | wc -l` returns a number < 60.
- [ ] Every registry tool appears exactly once in the grid.
- [ ] The category chip nav is hidden when only one category is active (verify with the single-tool registry — it should not render).
- [ ] JSON-LD `ItemList.numberOfItems` equals `TOOLS.length`.
- [ ] Cards are keyboard-focusable and show a visible focus ring.

---

### [PLAT-10] `/tools/category/[category]` with a thin-page guard

**Estimate:** 2h · **Depends on:** PLAT-05, PLAT-06, PLAT-09 · **Files:** `src/app/(tools)/tools/category/[category]/page.tsx` (new)

**Why** — The literal `category` segment is what avoids a `[slug]` / `[category]` collision (decision #6), and `"category"` being a reserved slug is what keeps it that way. The non-obvious part is the thin-page guard: in Sprint 1 there is one tool, so `/tools/category/calculators` would be a page whose entire content is one link that also appears on the hub. Indexing that is how a site accumulates the low-value pages that drag a whole domain's Helpful Content assessment down. It renders (breadcrumbs point at it) but carries `noindex, follow` and stays out of the sitemap until the category has three tools.

**Implementation**

```tsx
// src/app/(tools)/tools/category/[category]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DATA } from "@/data/resume";
import { toolCategoryJsonLd } from "@/lib/tools/jsonld";
import {
  activeCategories,
  getToolsByCategory,
  isCategoryIndexable,
} from "@/lib/tools/registry";
import {
  CATEGORY_LABELS,
  TOOL_CATEGORIES,
  type ToolCategory,
} from "@/lib/tools/types";

export const dynamicParams = false;
export const dynamic = "force-static";

function parseCategory(value: string): ToolCategory | undefined {
  return (TOOL_CATEGORIES as readonly string[]).includes(value)
    ? (value as ToolCategory)
    : undefined;
}

/** Only categories that actually contain tools get a page at all. */
export function generateStaticParams(): Array<{ category: string }> {
  return activeCategories().map((category) => ({ category }));
}

export function generateMetadata({
  params,
}: {
  params: { category: string };
}): Metadata {
  const category = parseCategory(params.category);
  if (!category) return { title: "Category not found", robots: { index: false } };

  const label = CATEGORY_LABELS[category];
  const url = `${DATA.url}/tools/category/${category}`;
  const count = getToolsByCategory(category).length;

  return {
    title: `${label} — Free and Browser-Based`,
    description:
      `${count} free ${label.toLowerCase()} built and maintained by ` +
      `${DATA.name}. No signup, no watermark, and most of them never upload ` +
      `your file anywhere.`,
    alternates: { canonical: url },
    // Thin until proven otherwise. `follow` so link equity still flows through
    // to the tools themselves.
    robots: isCategoryIndexable(category)
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default function ToolCategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const category = parseCategory(params.category);
  if (!category) notFound();

  const tools = getToolsByCategory(category);
  if (tools.length === 0) notFound();
  const label = CATEGORY_LABELS[category];

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <li><Link href="/" className="hover:text-foreground">Home</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/tools" className="hover:text-foreground">Tools</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-foreground">{label}</li>
        </ol>
      </nav>

      <main id="main-content">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{label}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {tools.length} {tools.length === 1 ? "tool" : "tools"} in this category.
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={`/tools/${tool.slug}`}
                className="flex h-full flex-col rounded-lg border p-4 transition-colors hover:border-foreground/20"
              >
                <span className="text-sm font-semibold">{tool.title}</span>
                <span className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {tool.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs">
          <Link href="/tools" className="underline underline-offset-2">
            ← All tools
          </Link>
        </p>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(toolCategoryJsonLd(category, tools)),
        }}
      />
    </>
  );
}
```

**Acceptance criteria**

- [ ] `/tools/category/calculators` renders and lists the EPF tool.
- [ ] With one tool in the category, the page emits `<meta name="robots" content="noindex, follow">`.
- [ ] `/tools/category/image` (no tools) returns 404 — it is not in `generateStaticParams`.
- [ ] `/tools/category/nonsense` returns 404.
- [ ] `/tools/category` (no trailing segment) returns 404, and does **not** resolve as `/tools/[slug]` with `slug="category"`.
- [ ] Adding a scratch tool with `slug: "category"` fails the build with the reserved-slug error. Revert.

---

### [PLAT-11] Sitemap extension + robots hardening

**Estimate:** 1.5h · **Depends on:** PLAT-05, PLAT-09, PLAT-10 · **Files:** `src/app/sitemap.ts`, `src/app/robots.ts`

**Why** — Indexation, not ranking, is the bottleneck (decision #12). A page not in the sitemap on a site with 9 clicks per 28 days may wait weeks for discovery. The critical constraint: the tool routes come from the registry, an in-memory array, so this adds **zero** database calls to a route that already has a fragile try/catch around Mongo. Non-indexable category pages are excluded, because a sitemap containing `noindex` URLs is a Search Console warning and a wasted crawl.

**Implementation**

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";
import { connectToDatabase } from "@db";
import Blog from "@db/models/Blog";
import { TOOLS, activeCategories, isCategoryIndexable } from "@/lib/tools/registry";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = DATA.url.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/tools`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
  ];

  // Tools come from the registry — an in-memory array. No DB round trip, and
  // no chance of a Mongo failure knocking tool URLs out of the sitemap.
  const toolRoutes: MetadataRoute.Sitemap = TOOLS.filter(
    (t) => t.status === "live"
  ).map((tool) => ({
    url: `${base}/tools/${tool.slug}`,
    lastModified: new Date(`${tool.updatedAt}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // Only categories that carry meta robots `index`. Listing a noindex URL here
  // is a Search Console warning and burns crawl budget we do not have.
  const categoryRoutes: MetadataRoute.Sitemap = activeCategories()
    .filter(isCategoryIndexable)
    .map((category) => ({
      url: `${base}/tools/category/${category}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    }));

  let postRoutes: MetadataRoute.Sitemap = [];
  try {
    await connectToDatabase();
    const posts = await Blog.find({ isPublished: true })
      .select("slug updatedAt publishedAt")
      .lean();
    postRoutes = posts.map((p: any) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt ?? p.publishedAt ?? now,
      changeFrequency: "monthly",
      priority: 0.7,
    }));
  } catch (error) {
    console.error("sitemap: could not enumerate blog posts", error);
  }

  return [...staticRoutes, ...toolRoutes, ...categoryRoutes, ...postRoutes];
}
```

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";

export default function robots(): MetadataRoute.Robots {
  const base = DATA.url.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      // /og is listed explicitly and deliberately. Twitterbot, Slackbot and
      // LinkedInBot all respect robots.txt; disallowing /og would silently kill
      // every OG card on the site. Do not "tidy" this away.
      allow: ["/", "/tools", "/og"],
      disallow: ["/admin", "/api/admin", "/api/debug", "/publish-blog"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
```

Thin category pages are handled by **meta robots**, not `robots.txt`: a `Disallow` would block the crawl entirely, the `noindex` would never be read, and the URL could still surface as a bare listing.

**Acceptance criteria**

- [ ] `curl -s https://kavithakanchana.me/sitemap.xml` contains `/tools` and `/tools/epf-etf-calculator-sri-lanka`.
- [ ] The tool entry's `<lastmod>` matches `updatedAt` from the registry.
- [ ] `/tools/category/calculators` is **absent** from the sitemap (below the indexable threshold).
- [ ] With `MONGODB_URI` unset locally, `sitemap.xml` still contains all tool routes and the three static routes.
- [ ] `grep -c "connectToDatabase" src/app/sitemap.ts` returns 1 — no new DB calls were added.
- [ ] `curl -s https://kavithakanchana.me/robots.txt` shows `Allow: /og`.

---

### [PLAT-12] `/og` — add `?kind=tool`, move to edge, cache immutably

**Estimate:** 2.5h · **Depends on:** — · **Files:** `src/app/og/route.tsx`

**Why — this is urgent and independent of the tools work.** `src/app/og/route.tsx` today has **no `runtime` export and no cache headers**. Every single hit therefore runs on the Node.js serverless runtime and executes a full satori layout pass plus a resvg-wasm rasterisation to produce a 1200×630 PNG — hundreds of milliseconds and tens of MB of memory, per request. Because the response carries no `Cache-Control`, Vercel's CDN will not hold it, so *every* hit is a fresh invocation: every Googlebot pass, every Slack unfurl, every LinkedIn re-scrape, every Twitter card refresh, every time someone hovers a link in Discord. The URL is public and unauthenticated, so a single person looping `curl '/og?title=$RANDOM'` is an uncapped compute bill.

Three changes fix it: `runtime = "edge"` (satori and resvg in `next/og` are built for it — far cheaper per invocation and no cold-start penalty; safe here because the route uses `fontFamily: "sans-serif"` and reads no filesystem), an immutable `s-maxage` so the CDN answers repeat requests without touching a function at all, and a hard clamp on the input so the cache key space is bounded.

**Implementation**

```tsx
// src/app/og/route.tsx
import { ImageResponse } from "next/og";

/**
 * Edge runtime. `next/og` is satori (layout) + resvg-wasm (raster); both are
 * built for the edge and cost a fraction of a Node lambda per invocation.
 * Safe here only because this route uses a generic system font stack and
 * touches no filesystem — do not add `fs`, `sharp`, or a local font file
 * without moving back to nodejs and re-reading the cost note above.
 */
export const runtime = "edge";

/**
 * One year, immutable. The output is a pure function of (kind, title), so a
 * repeat request never needs to re-render. Without this header the CDN stores
 * nothing and every crawler hit is a fresh satori+resvg run.
 * Change the image design => bump CACHE_BUSTER and update the callers.
 */
const CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable, no-transform";

const KINDS = { blog: "blog", tool: "tools" } as const;
type Kind = keyof typeof KINDS;

function parseKind(value: string | null): Kind {
  return value === "tool" ? "tool" : "blog";
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = parseKind(searchParams.get("kind"));

  // Clamping is not cosmetic: it bounds the cache key space and stops an
  // attacker minting unbounded distinct edge renders with long random titles.
  const rawTitle = searchParams.get("title") || "Kavitha Kanchana";
  const title =
    rawTitle.length > 110 ? `${rawTitle.slice(0, 110)}\u2026` : rawTitle;

  const eyebrow = `kavithakanchana.me/${KINDS[kind]}`;
  const footer =
    kind === "tool"
      ? "Free \u00b7 No signup \u00b7 Runs in your browser"
      : "Kavitha Kanchana \u00b7 Software Engineer at Cortana AI";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            kind === "tool"
              ? "radial-gradient(circle at 80% 15%, #14532d 0%, #0a0a0a 60%)"
              : "radial-gradient(circle at 20% 20%, #1e293b 0%, #0a0a0a 60%)",
          padding: "80px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: kind === "tool" ? "#86efac" : "#7dd3fc",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#94a3b8" }}>
          {footer}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": CACHE_CONTROL },
    }
  );
}
```

**Acceptance criteria**

- [ ] `curl -sI 'https://kavithakanchana.me/og?title=hello'` returns `cache-control: public, max-age=31536000, s-maxage=31536000, immutable, no-transform`.
- [ ] The second identical request returns `x-vercel-cache: HIT`.
- [ ] The build route table lists `/og` under the Edge runtime, not Node.
- [ ] `?kind=tool` renders the green gradient and the "Free · No signup" footer; omitting `kind` renders the original blue blog card unchanged.
- [ ] `?kind=garbage` falls back to `blog` and does not error.
- [ ] A 400-character `title` renders truncated with an ellipsis, no overflow.
- [ ] Existing blog OG URLs (no `kind` param) still render — check one live post's card in the Twitter card validator.
- [ ] Vercel function-invocation count for `/og` over 24h after deploy is materially lower than the 24h before. Record both numbers.

---

### [PLAT-13] Navbar entry + homepage body link

**Estimate:** 1h · **Depends on:** PLAT-09 · **Files:** `src/data/resume.tsx`, `src/app/(site)/page.tsx`

**Why** — The Dock is a real `<Link>` and does pass equity, but it is a fixed-position element rendered after `{children}` in the root layout, and it looks like site chrome. A body link inside the main content flow, in a section with surrounding topical text, is the crawl path that actually matters — and it is the one a human reading the portfolio will notice. Do both; they cost 1h combined.

**Implementation**

```tsx
// src/data/resume.tsx — imports and navbar only
import { Icons } from "@/components/icons";
import { HomeIcon, NotebookIcon, WrenchIcon } from "lucide-react";
// ...
  navbar: [
    { href: "/", icon: HomeIcon, label: "Home" },
    { href: "/blog", icon: NotebookIcon, label: "Blog" },
    { href: "/tools", icon: WrenchIcon, label: "Tools" },
  ],
```

> If `WrenchIcon` is not exported by `lucide-react@0.395`, use `Wrench` — the `*Icon` aliases were added partway through the 0.3xx line. `pnpm exec tsc --noEmit` will tell you immediately.

```tsx
// src/app/(site)/page.tsx — new imports
import { toolsByRecency } from "@/lib/tools/registry";
```

```tsx
// src/app/(site)/page.tsx — insert directly after the closing </section> of
// id="what-i-build" and before id="open-source".
{/* Tools — the crawl path into /tools. Body link, not just the Dock. */}
<section id="tools" className="scroll-mt-24">
  <div className="flex flex-col gap-y-4">
    <BlurFade delay={BLUR_FADE_DELAY * 12}>
      <SectionHeading>Tools</SectionHeading>
    </BlurFade>
    <BlurFade delay={BLUR_FADE_DELAY * 13}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Small free utilities I built for my own use and kept online. Most of
        them run entirely in your browser — nothing is uploaded, nothing needs
        an account.{" "}
        <Link
          href="/tools"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Browse all tools
        </Link>
        .
      </p>
    </BlurFade>
    <BlurFade delay={BLUR_FADE_DELAY * 14}>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {toolsByRecency()
          .slice(0, 3)
          .map((tool) => (
            <li key={tool.slug}>
              <Link
                href={`/tools/${tool.slug}`}
                className="flex h-full flex-col rounded-lg border p-4 transition-colors duration-150 hover:border-foreground/20"
              >
                <span className="text-sm font-medium">{tool.title}</span>
                <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {tool.description}
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </BlurFade>
  </div>
</section>
```

**Acceptance criteria**

- [ ] The Dock shows a wrench icon linking to `/tools`, with a working tooltip and `aria-label="Tools"`.
- [ ] `curl -s https://kavithakanchana.me/ | grep -c 'href="/tools'` returns ≥ 2 (body link + Dock).
- [ ] The Tools section renders between "What I Build" and "Open Source".
- [ ] **Bundle check:** homepage First Load JS increases by **≤ 6 kB** versus the baseline recorded in Definition of Ready. If it exceeds that, `ToolDef.Widget` is pulling widget stubs into the homepage graph — see the Risks table for the split-registry fallback.
- [ ] Dock still fits on a 375px viewport with the extra icon (no horizontal overflow, no wrapped row).

---

### [PLAT-14] `vercel.json` with maxDuration caps + perf budget

**Estimate:** 1h · **Depends on:** PLAT-08, PLAT-09, PLAT-10 · **Files:** `vercel.json` (new)

**Why** — Right now every serverless function inherits the plan default. `src/middleware.ts` runs on every request and the API routes open Mongo connections with `minPoolSize: 5`; a hung Atlas handshake with no cap burns wall-clock on an invocation that will never return anything useful. Capping is cheap insurance, and the tools routes are exactly the surfaces where an uncapped default becomes a bill later.

**Implementation**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "functions": {
    "src/app/api/**/*.ts": { "maxDuration": 15 },
    "src/app/sitemap.ts": { "maxDuration": 20 }
  }
}
```

Notes that belong in the commit message, not the JSON (it has no comments):

- Globs are **non-overlapping on purpose**. Vercel does not define a precedence when two patterns match the same source file; keep them disjoint rather than relying on "most specific wins".
- `/og` is **not** listed. It is now an Edge Function (PLAT-12), and Edge Functions have their own platform-imposed limit that `functions.maxDuration` does not apply to.
- Tool pages under `src/app/(tools)/` are **not** listed, and must never need to be: they are `force-static` + `dynamicParams: false`, so no function is produced for them. If a `vercel.json` entry ever becomes necessary for a tool route, that is the signal that decision #3 has been broken — fix the route, do not add the entry.
- `sitemap.ts` gets 20s because it is the one route that both revalidates on a timer and talks to Mongo.

**Perf budget for the tool page** (verified in PLAT-15, recorded here as the target):

| Metric | Budget |
|---|---|
| Lighthouse mobile Performance | ≥ 95 |
| LCP (Lighthouse mobile, simulated throttling) | ≤ 2.0s |
| CLS | ≤ 0.02 |
| TBT | ≤ 150ms |
| First Load JS for `/tools/[slug]` | ≤ First Load JS for `/blog/[slug]` + 10 kB |
| Vercel function invocations from loading a tool page | 0 |

**Acceptance criteria**

- [ ] `vercel.json` is valid JSON and the next deploy succeeds (an invalid `functions` glob fails the deploy loudly — that is the test).
- [ ] The Vercel dashboard shows `maxDuration: 15` on an `/api/*` function after deploy.
- [ ] No `(tools)` path appears anywhere in `vercel.json`.
- [ ] The build route table confirms no function was emitted for `/tools`, `/tools/[slug]`, or `/tools/category/[category]`.

---

### [PLAT-15] Deploy, verify in production, request indexing

**Estimate:** 2h · **Depends on:** all of the above · **Files:** — (verification only)

**Why** — The gate between phases is measured in *indexed pages*, not tools shipped (decision #12). A tool page that exists but is not in the index has produced exactly zero value, and on a site with 268 impressions per 28 days, organic discovery is slow enough that manual submission is worth the twenty minutes. This ticket also catches the class of bug that only appears in production: real cache headers, real CDN behaviour, real `x-vercel-cache` values.

**Implementation** — no code. Run this sequence.

```bash
# 1. Clean build from the branch, exactly as Vercel will
rm -rf .next && pnpm build

# 2. Confirm the tool routes are static, not functions
#    Look for ●  /tools, ●  /tools/[slug], ●  /tools/category/[category]
#    Any ƒ on those lines is a fail — stop and fix before deploying.

# 3. Confirm the static HTML actually exists on disk
ls -la .next/server/app/tools/
test -f .next/server/app/tools/epf-etf-calculator-sri-lanka.html && echo OK

# 4. Confirm the widget markup is in the pre-rendered HTML (SSG, not ssr:false)
grep -c 'Monthly gross earnings' .next/server/app/tools/epf-etf-calculator-sri-lanka.html
```

Then: merge to `main`, let Vercel deploy, and verify in prod.

```bash
BASE=https://kavithakanchana.me

# Cache headers on the OG endpoint
curl -sI "$BASE/og?kind=tool&title=EPF" | grep -iE 'cache-control|x-vercel-cache'
curl -sI "$BASE/og?kind=tool&title=EPF" | grep -i 'x-vercel-cache'   # expect HIT

# Tool page is served from the CDN, not a function
curl -sI "$BASE/tools/epf-etf-calculator-sri-lanka" | grep -iE 'x-vercel-cache|x-matched-path'

# Link budget on the hub
curl -s "$BASE/tools" | grep -o '<a ' | wc -l   # expect < 60

# Sitemap contains the new routes and excludes the thin category
curl -s "$BASE/sitemap.xml" | grep -E 'tools'

# Unknown slug 404s
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/tools/does-not-exist"   # expect 404
```

Then, in the browser:

1. Rich Results Test on `https://kavithakanchana.me/tools/epf-etf-calculator-sri-lanka` — expect FAQ + Breadcrumb eligible, 0 errors.
2. validator.schema.org on the same URL — 0 errors, and confirm `author` resolves to `https://kavithakanchana.me/#person`.
3. Lighthouse mobile on the tool page — check against the PLAT-14 budget table.
4. Search Console → URL Inspection on `/tools` and `/tools/epf-etf-calculator-sri-lanka` → "Request Indexing" for both.
5. Search Console → Sitemaps → resubmit `sitemap.xml`.
6. Vercel → Observability → confirm the tool page produced 0 function invocations, and record the `/og` invocation count as the new baseline.

**Acceptance criteria**

- [ ] Production `/tools` and `/tools/epf-etf-calculator-sri-lanka` both return 200 and `x-vercel-cache: HIT` on second request.
- [ ] Rich Results Test: 0 errors, FAQ + Breadcrumb detected.
- [ ] Lighthouse mobile Performance ≥ 95 and CLS ≤ 0.02 on the tool page.
- [ ] Both URLs submitted for indexing; the submission timestamp is recorded.
- [ ] Zero function invocations attributable to the tool page over 30 minutes of manual traffic.
- [ ] `/blog` and `/` still render at exactly 672px (Sprint 0's guarantee is not regressed by the new route group sibling).
- [ ] A blog post's OG card still renders correctly in the Twitter card validator after the `/og` edge migration.

---

### Deferred from this sprint

Cut to hold the 36h budget. Each is a Sprint 2 candidate, not a forgotten item.

| Cut | Why it can wait |
|---|---|
| `reviewEveryDays` consumer (a `pnpm tools:review` script listing overdue tools) | The field is stored and validated now, so no data migration later. A build-time check would spontaneously fail a build months later with no code change, which is worse than not having it. |
| Second and third tools | The sprint goal is a proven template, not volume. Adding tools before the template is verified in prod means fixing the same bug N times. |
| Search / filter on the hub | Pointless below ~10 tools and it would add a client boundary to a currently zero-JS page. |
| Per-tool OG images with the widget rendered in them | `?kind=tool` gets a distinct card; bespoke per-tool art is a nice-to-have with no measurable indexation effect. |
| `<ToolShell>` "last verified" freshness banner | Needs the review script to exist first. |
| Railway ticket-minting route handler, Turnstile, quotas (decisions #9–#11) | Nothing in this sprint touches Railway. Building auth for a backend that has no callers is speculative work. |
| Playwright / RTL component tests for the widget | Vitest covers the validator, which is the file where bugs are silent. Widget correctness is verified by the explicit numeric cases in PLAT-04's acceptance criteria. |

---

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `ToolDef.Widget` pulls every widget stub into the homepage and every tool page's client bundle | Medium | Medium | PLAT-13 has a hard measurable gate: homepage First Load JS +≤6 kB. If breached, split into `ToolDef` (data only) plus a `"use client"` `TOOL_WIDGETS` record keyed by slug in `src/components/tools/tool-widget.tsx`, and have `<ToolShell>` render `<ToolWidget slug={tool.slug} />`. Each `dynamic()` in that map is its own chunk, so only the matched one is fetched. This is a 45-minute change, isolated to two files. |
| `dynamic(..., { ssr: false })` throws "not allowed in Server Components" when the first WASM tool lands | High (Sprint 2) | Medium | The pattern is already decided and documented in PLAT-05's header comment: the registry imports a thin `"use client"` stub that performs the dynamic import internally. Write the stub template now as a comment in `registry.ts` so Sprint 2 does not rediscover this. |
| EPF/ETF rates are wrong or become wrong | Medium | High — a wrong statutory number on a page with a real name on it is a reputation problem, not a bug | Rates are constants in one `RATES` object with a `VERIFY BEFORE EVERY updatedAt BUMP` comment; `sources[]` carries primary-source URLs and `verifiedOn` dates rendered on the page; `reviewEveryDays: 90`; the gotchas section explicitly tells anyone with money at stake to check the source themselves; the author card carries a direct mailto with the tool name pre-filled in the subject. |
| `pnpm build` now runs vitest, so a broken test blocks a production deploy | Low | Medium | These are pure synchronous unit tests over in-memory fixtures — no network, no filesystem, no timers, no flake surface. `pnpm build:only` exists as the documented escape hatch for a genuine emergency deploy. |
| `runtime = "edge"` breaks OG rendering for existing blog posts | Low | Medium | The route uses `fontFamily: "sans-serif"` and reads no files, which is the only thing that makes edge unsafe. PLAT-12 acceptance explicitly re-validates a live blog post's card in the Twitter validator before the ticket closes. If it regresses, deleting one line (`export const runtime = "edge"`) reverts it while keeping the cache headers, which are the bigger win anyway. |
| Category pages get indexed while thin and drag the domain's quality assessment | Low | High | `MIN_TOOLS_FOR_INDEXABLE_CATEGORY = 3` gates both `<meta robots>` and sitemap inclusion, and it is enforced in code from day one rather than being a thing to remember at tool number four. |
| `/tools/category` collides with `/tools/[slug]` | Low | High | Two independent defences: `"category"` is in `RESERVED_SLUGS` (build fails), and Next resolves the literal segment before the dynamic one. PLAT-10 acceptance tests the collision explicitly. |
| Google never indexes the pages — the actual Sprint 1 failure mode | Medium | High | Sitemap + hub + homepage body link + Dock link + breadcrumbs all point at the tool. Manual URL Inspection submission in PLAT-15. The **real gate on starting Sprint 2 is indexation, not shipping**: if `/tools/epf-etf-calculator-sri-lanka` is not indexed 14 days after deploy, the next sprint is an indexation investigation, not more tools. |

---

### Definition of Done

- [ ] `pnpm exec tsc --noEmit` — 0 errors.
- [ ] `pnpm test` — all validator tests pass; ≥ 30 assertions.
- [ ] `pnpm build` — clean, and its route table shows `/tools`, `/tools/[slug]`, `/tools/category/[category]` as `●  (SSG)`.
- [ ] `pnpm lint` — no new warnings versus the base branch.
- [ ] Deliberately corrupting a registry field fails the build with a message naming the slug and the field. Reverted.
- [ ] `grep -rn "@db\|mongoose" src/lib/tools/ src/components/tools/ "src/app/(tools)/"` returns nothing.
- [ ] Lighthouse mobile on `/tools/epf-etf-calculator-sri-lanka`: Performance ≥ 95, Accessibility 100, CLS ≤ 0.02, TBT ≤ 150ms.
- [ ] First Load JS: `/tools/[slug]` ≤ `/blog/[slug]` + 10 kB; `/` ≤ baseline + 6 kB.
- [ ] Merged to `main` and deployed to Vercel.
- [ ] Production verified: both tool URLs return 200 with `x-vercel-cache: HIT`, `/tools/nonsense` returns 404, `/og` returns immutable `Cache-Control`.
- [ ] Rich Results Test: 0 errors, FAQ + Breadcrumb eligible.
- [ ] `sitemap.xml` in production contains the tool and hub URLs and excludes the non-indexable category.
- [ ] Sprint 0's guarantees are intact: `/` and `/blog` still render at exactly 672px.
- [ ] Both new URLs submitted for indexing in Search Console; submission date recorded.
- [ ] A calendar reminder exists for **14 days out**: check whether the tool page is indexed. That result, not this checklist, decides what Sprint 2 is.

---

### Demo script

1. `rm -rf .next && pnpm build` — watch vitest pass, then read the route table and confirm `●  /tools`, `●  /tools/[slug]`, `●  /tools/category/[category]`. No `ƒ` on any of those lines.
2. Break it on purpose: change `metaTitle` in `registry.ts` to 70 characters and run `pnpm build`. It fails with `[epf-etf-calculator-sri-lanka] metaTitle: 70 chars, max 60`. Revert. Then set `related: ["nope"]` and run again — it fails naming the dangling slug. Revert.
3. `pnpm dev`, open `http://localhost:3000/tools`. Confirm the hub renders one card, the category chip nav is hidden (only one category), and the "Built by Kavitha Kanchana" line links home.
4. Click into the tool. On a 390px-wide viewport, confirm the input field is visible without scrolling. Type `100000` and check: 8,000 / 12,000 / 3,000 / 92,000 / 115,000. Clear the field — empty state, no `NaN`.
5. Scroll the tool page and read the section order out loud: breadcrumb, H1, meta row with "Runs in your browser — nothing uploaded", intro, widget, How it works, Edge cases and gotchas (with the dated Sources box), FAQ, author card. Confirm nothing sits between the intro and the widget.
6. Open devtools → Network, retype a salary figure, and confirm **zero** requests fire. That is the "nothing uploaded" claim being true rather than asserted.
7. `curl -s localhost:3000/tools | grep -o '<a ' | wc -l` — under 60. `curl -s localhost:3000/sitemap.xml | grep tools` — hub and tool present, category absent.
8. Deploy. Then `curl -sI 'https://kavithakanchana.me/og?kind=tool&title=EPF'` twice and confirm the second returns `x-vercel-cache: HIT` with the immutable `Cache-Control`. Paste the tool URL into the Rich Results Test and confirm FAQ + Breadcrumb, 0 errors. Finally, open Vercel Observability and confirm the tool page generated zero function invocations.