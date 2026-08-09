import {
  MAX_TOOLS,
  RESERVED_SLUGS,
  TOOL_AUDIENCES,
  TOOL_CATEGORIES,
  type ToolDef,
} from "./types";

/**
 * Build-breaking validation for the tool registry.
 *
 * Content rules that live in a checklist get skipped at 11pm on the fifth tool.
 * Rules that throw during `next build` do not. This validator is the only thing
 * standing between "a useful tools section" and "thirty thin pages that drag the
 * whole domain's quality assessment down, blog and homepage included".
 *
 * It collects **every** problem and throws once. Fixing one error per build
 * cycle is miserable enough that people start bypassing the check.
 *
 * Pure and synchronous, with no imports from React, Next or the database, so it
 * runs at module scope inside `registry.ts`, inside a standalone script, and
 * inside vitest without a DOM.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const LIMITS = {
  slugMin: 3,
  slugMax: 60,

  /**
   * The root layout's title template appends " | Kavitha Kanchana" (19 chars).
   * Google truncates the rendered `<title>` around 60, so the registry value has
   * to leave room for the suffix — budgeting the full 60 here ships a title that
   * is already cut off before it reaches a SERP.
   */
  metaTitleMax: 41,

  descriptionMin: 120,
  descriptionMax: 165,

  introWordsMin: 40,
  introWordsMax: 70,

  /** Applies to howItWorks, gotchas, and caveats when present. */
  proseWordsMin: 120,

  /**
   * Total rendered body copy.
   *
   * The floor is the one that matters: thin pages are precisely what fails to
   * get indexed, and indexation is the programme's actual bottleneck.
   *
   * The ceiling is a runaway guard, not a style rule, and is deliberately far
   * above the 400–700 band the sprint plan's Definition of Done quotes. Word
   * count cannot tell depth from filler — a genuinely thorough tool page earns
   * its length, and the plan's own OCR copy is ~1,360 words. Enforcing 700 would
   * reject content the same document asks for. Filler is caught by the
   * duplicate and similarity rules below, which is where the leverage actually
   * is.
   */
  pageWordsMin: 400,
  pageWordsMax: 1800,

  faqsMin: 3,
  faqsMax: 6,
  faqQuestionMinChars: 10,
  faqAnswerWordsMin: 15,

  relatedMax: 4,
  keywordsMin: 3,
  keywordsMax: 8,

  /**
   * Jaccard similarity over character trigrams, above which two descriptions are
   * reported as templated. Duplicated meta descriptions are the canonical cause
   * of "Crawled – currently not indexed" — the exact metric Gate 1 measures — so
   * this is the highest-value rule in the file.
   */
  descriptionSimilarityWarn: 0.8,
} as const;

export class ToolRegistryError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(
      `Tool registry is invalid (${issues.length} issue${
        issues.length === 1 ? "" : "s"
      }):\n\n` +
        issues.map((i) => `  • ${i}`).join("\n") +
        `\n\nFix these in src/lib/tools/registry.ts.` +
        `\nThe rules live in src/lib/tools/validate.ts (see LIMITS).\n`
    );
    this.name = "ToolRegistryError";
    this.issues = issues;
  }
}

/** Whitespace-delimited word count. */
export function countWords(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Strict calendar-date check.
 *
 * The round-trip through `toISOString` is what rejects "2026-02-30": the regex
 * alone accepts it, and `new Date` silently rolls it forward to 2 March.
 */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Jaccard similarity over character trigrams, in [0, 1].
 *
 * Character trigrams rather than word sets because the failure mode being
 * detected is "same paragraph with the numbers swapped", which shares almost all
 * of its character structure while differing in several words.
 */
export function trigramSimilarity(a: string, b: string): number {
  const grams = (s: string): Set<string> => {
    const t = s.toLowerCase().replace(/\s+/g, " ").trim();
    const set = new Set<string>();
    for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3));
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  A.forEach((g) => {
    if (B.has(g)) intersection += 1;
  });
  return intersection / (A.size + B.size - intersection);
}

/** Body copy a visitor actually reads, in the order the shell renders it. */
export function pageWordCount(tool: ToolDef): number {
  const faqWords = tool.faqs.reduce(
    (sum, faq) => sum + countWords(faq.q) + countWords(faq.a),
    0
  );
  return (
    countWords(tool.intro) +
    countWords(tool.howItWorks) +
    countWords(tool.gotchas) +
    (tool.caveats ? countWords(tool.caveats) : 0) +
    faqWords
  );
}

export interface ValidateOptions {
  /**
   * "Today" as YYYY-MM-DD, for the not-in-the-future checks. Injectable so the
   * suite is deterministic and does not start failing at a date boundary.
   */
  today?: string;
}

export interface ValidateResult {
  /**
   * Non-fatal findings. Returned rather than logged so tests can assert on them
   * without spying on console, and so the caller decides how loud to be.
   */
  warnings: string[];
}

/**
 * Validate the whole registry. Throws `ToolRegistryError` listing every problem.
 */
export function validateTools(
  tools: readonly ToolDef[],
  options: ValidateOptions = {}
): ValidateResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  const at = (slug: string, field: string, msg: string): void => {
    issues.push(`[${slug || "<missing slug>"}] ${field}: ${msg}`);
  };

  // ---------------------------------------------------------------- registry

  if (tools.length > MAX_TOOLS) {
    issues.push(
      `registry: ${tools.length} tools exceeds MAX_TOOLS (${MAX_TOOLS}). ` +
        `This cap is deliberate — it is the difference between a tool section ` +
        `and a content farm. Raising it is a policy decision that belongs in ` +
        `its own PR with a phase gate cited, not a build fix.`
    );
  }

  const firstSeenAt = new Map<string, number>();
  tools.forEach((tool, index) => {
    const first = firstSeenAt.get(tool.slug);
    if (first !== undefined) {
      at(
        tool.slug,
        "slug",
        `duplicate — already used by TOOLS[${first}], repeated at TOOLS[${index}]. ` +
          `Slugs are URLs; two tools cannot share one.`
      );
    } else {
      firstSeenAt.set(tool.slug, index);
    }
  });
  const knownSlugs = new Set(tools.map((t) => t.slug));

  // Duplicated titles and meta descriptions are the canonical cause of
  // "Crawled – currently not indexed". Exact collisions are an error; merely
  // templated ones are a warning, because the judgement call is a human's.
  assertUnique(tools, "metaTitle", (t) => t.metaTitle, issues);
  assertUnique(tools, "description", (t) => t.description, issues);
  assertUnique(tools, "title", (t) => t.title, issues);

  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const similarity = trigramSimilarity(
        tools[i].description,
        tools[j].description
      );
      if (similarity > LIMITS.descriptionSimilarityWarn) {
        warnings.push(
          `[${tools[i].slug}] + [${tools[j].slug}] description: ${(
            similarity * 100
          ).toFixed(0)}% similar. Near-duplicate meta descriptions are the ` +
            `most common reason Google crawls a page and declines to index it. ` +
            `Rewrite one, or reconsider whether both pages should exist.`
        );
      }
    }
  }

  // ---------------------------------------------------------------- per tool

  for (const t of tools) {
    // --- slug
    if (!SLUG_RE.test(t.slug)) {
      at(
        t.slug,
        "slug",
        `"${t.slug}" is not lowercase-kebab. Allowed: a-z, 0-9, single hyphens ` +
          `between segments, no leading or trailing hyphen.`
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

    // --- titles and description
    if (t.title.trim().length === 0) {
      at(t.slug, "title", "empty. This is the H1 and the target keyword phrase.");
    }
    if (t.metaTitle.trim().length === 0) {
      at(t.slug, "metaTitle", "empty.");
    }
    if (t.metaTitle.length > LIMITS.metaTitleMax) {
      at(
        t.slug,
        "metaTitle",
        `${t.metaTitle.length} chars, max ${LIMITS.metaTitleMax}. The root ` +
          `layout appends " | Kavitha Kanchana", so anything longer is already ` +
          `truncated before Google sees it. Current value: "${t.metaTitle}"`
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
          `${LIMITS.descriptionMax} is cut mid-sentence.`
      );
    }

    // --- taxonomy
    if (!(TOOL_CATEGORIES as readonly string[]).includes(t.category)) {
      at(t.slug, "category", `"${t.category}" is not in TOOL_CATEGORIES.`);
    }
    if (t.audience.length === 0) {
      at(t.slug, "audience", "empty. Name at least one audience.");
    }
    for (const a of t.audience) {
      if (!(TOOL_AUDIENCES as readonly string[]).includes(a)) {
        at(t.slug, "audience", `"${a}" is not in TOOL_AUDIENCES.`);
      }
    }
    if (new Set(t.audience).size !== t.audience.length) {
      at(t.slug, "audience", "contains duplicates.");
    }

    // --- keywords
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
    if (new Set(t.keywords).size !== t.keywords.length) {
      at(t.slug, "keywords", "contains duplicates.");
    }

    // --- dates
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

    // --- prose
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

    // A tool that ships work to a server owes the reader an account of what it
    // does badly. Browser-only tools are exempt: their failure modes are visible
    // immediately and cost nothing to retry.
    if (t.compute !== "browser") {
      const caveatWords = t.caveats ? countWords(t.caveats) : 0;
      if (caveatWords < LIMITS.proseWordsMin) {
        at(
          t.slug,
          "caveats",
          `${caveatWords} words, minimum ${LIMITS.proseWordsMin} for a tool with ` +
            `compute: "${t.compute}". Anything that leaves the browser must ` +
            `document its limits where someone who just got a bad result will look.`
        );
      }
    }

    const totalWords = pageWordCount(t);
    if (totalWords < LIMITS.pageWordsMin) {
      at(
        t.slug,
        "page",
        `${totalWords} words of body copy, minimum ${LIMITS.pageWordsMin}. ` +
          `Thin pages are exactly what gets crawled and then not indexed.`
      );
    }
    if (totalWords > LIMITS.pageWordsMax) {
      at(
        t.slug,
        "page",
        `${totalWords} words of body copy, maximum ${LIMITS.pageWordsMax}. ` +
          `This is a runaway guard, not a style rule — at this length, check the ` +
          `copy is not repeating itself.`
      );
    }

    // --- FAQs
    if (t.faqs.length < LIMITS.faqsMin || t.faqs.length > LIMITS.faqsMax) {
      at(
        t.slug,
        "faqs",
        `${t.faqs.length} entries, must be ${LIMITS.faqsMin}-${LIMITS.faqsMax}.`
      );
    }
    const seenQuestions = new Set<string>();
    t.faqs.forEach((faq, i) => {
      if (faq.q.trim().length < LIMITS.faqQuestionMinChars) {
        at(
          t.slug,
          `faqs[${i}].q`,
          `too short: "${faq.q}". Phrase it as a real query.`
        );
      }
      const answerWords = countWords(faq.a);
      if (answerWords < LIMITS.faqAnswerWordsMin) {
        at(
          t.slug,
          `faqs[${i}].a`,
          `${answerWords} words. Under ${LIMITS.faqAnswerWordsMin} is not an ` +
            `answer, it is a stub, and Google treats the FAQPage node as low quality.`
        );
      }
      const key = faq.q.trim().toLowerCase();
      if (seenQuestions.has(key)) {
        at(t.slug, `faqs[${i}].q`, `duplicate question: "${faq.q}".`);
      }
      seenQuestions.add(key);
    });

    // --- related
    if (t.related.length > LIMITS.relatedMax) {
      at(
        t.slug,
        "related",
        `${t.related.length} entries, max ${LIMITS.relatedMax}.`
      );
    }
    for (const r of t.related) {
      if (r === t.slug) {
        at(t.slug, "related", `contains its own slug "${r}".`);
      } else if (!knownSlugs.has(r)) {
        at(
          t.slug,
          "related",
          `"${r}" does not exist in the registry. Dangling internal links leak ` +
            `crawl budget into 404s.`
        );
      }
    }
    if (new Set(t.related).size !== t.related.length) {
      at(t.slug, "related", "contains duplicate slugs.");
    }

    // --- sources
    (t.sources ?? []).forEach((s, i) => {
      if (s.title.trim().length === 0) {
        at(t.slug, `sources[${i}].title`, "empty.");
      }
      if (s.publisher.trim().length === 0) {
        at(t.slug, `sources[${i}].publisher`, "empty.");
      }
      if (!s.url.startsWith("https://")) {
        at(
          t.slug,
          `sources[${i}].url`,
          `"${s.url}" must be an absolute https URL to a primary source.`
        );
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
  }

  if (issues.length > 0) throw new ToolRegistryError(issues);
  return { warnings };
}

/** Exact-collision check across the registry for one field. */
function assertUnique(
  tools: readonly ToolDef[],
  field: string,
  pick: (t: ToolDef) => string,
  issues: string[]
): void {
  const seen = new Map<string, string>();
  for (const t of tools) {
    const value = pick(t).trim().toLowerCase();
    if (value.length === 0) continue; // emptiness is reported by its own rule
    const owner = seen.get(value);
    if (owner !== undefined && owner !== t.slug) {
      issues.push(
        `[${t.slug}] ${field}: identical to [${owner}]. Duplicate ${field} ` +
          `values are a leading cause of "Crawled – currently not indexed".`
      );
    } else {
      seen.set(value, t.slug);
    }
  }
}
