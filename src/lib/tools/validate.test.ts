import { describe, expect, it } from "vitest";
import { MAX_TOOLS, type ToolDef } from "./types";
import {
  LIMITS,
  ToolRegistryError,
  countWords,
  isValidIsoDate,
  pageWordCount,
  trigramSimilarity,
  validateTools,
} from "./validate";

/** `n` distinct whitespace-separated words. */
const words = (n: number): string =>
  Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

/**
 * A tool that passes every rule.
 *
 * Uniqueness-sensitive fields are derived from the slug, because the validator
 * now treats an exact `metaTitle` / `description` / `title` collision across two
 * entries as an error. A fixture that hard-coded them would make every
 * multi-tool test fail for the wrong reason.
 *
 * Each test mutates exactly one field off this baseline, so a failure names the
 * rule that broke rather than "something is wrong".
 */
function validTool(overrides: Partial<ToolDef> = {}): ToolDef {
  const slug = overrides.slug ?? "sample-tool";
  return {
    slug,
    title: `Title for ${slug}`,
    metaTitle: `Meta ${slug}`,
    description:
      `A distinct description for ${slug} that is comfortably inside the ` +
      `character bounds the validator enforces for a meta description tag.`.slice(
        0,
        160
      ),
    category: "calculators",
    audience: ["developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    keywords: [`${slug} one`, `${slug} two`, `${slug} three`],
    intro: words(50),
    howItWorks: words(140),
    gotchas: words(140),
    faqs: [
      { q: "What does this tool do?", a: words(25) },
      { q: "Is it free to use?", a: words(25) },
      { q: "Does it upload my data?", a: words(25) },
    ],
    related: [],
    ...overrides,
  };
}

/** Runs the validator and returns the issue strings, or [] if it passed. */
function issuesFor(tools: ToolDef[]): string[] {
  try {
    validateTools(tools, { today: "2026-06-01" });
    return [];
  } catch (err) {
    if (err instanceof ToolRegistryError) return [...err.issues];
    throw err;
  }
}

function warningsFor(tools: ToolDef[]): string[] {
  return validateTools(tools, { today: "2026-06-01" }).warnings;
}

// ---------------------------------------------------------------- helpers

describe("countWords", () => {
  it("ignores leading, trailing and repeated whitespace", () => {
    expect(countWords("  one   two \n three  ")).toBe(3);
  });
  it("returns 0 for a blank string", () => {
    expect(countWords("   ")).toBe(0);
  });
});

describe("isValidIsoDate", () => {
  it("accepts a real calendar date", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
  });
  it("accepts a leap day in a leap year", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true);
  });
  it("rejects a date that does not exist", () => {
    // The regex alone accepts this; only the round-trip catches that Date
    // silently rolls it forward to 2 March.
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
  });
  it("rejects wrong shapes", () => {
    for (const bad of ["2026-1-1", "26-01-01", "2026/01/01", "", "today"]) {
      expect(isValidIsoDate(bad)).toBe(false);
    }
  });
});

describe("trigramSimilarity", () => {
  it("is 1 for identical strings", () => {
    expect(trigramSimilarity("hello world", "hello world")).toBe(1);
  });
  it("is near 0 for unrelated strings", () => {
    expect(trigramSimilarity("aaaaaaaa", "zzzzzzzz")).toBeLessThan(0.1);
  });
  it("is high for the same sentence with a number swapped", () => {
    const a = "Convert 100 kilograms to pounds instantly in your browser.";
    const b = "Convert 200 kilograms to pounds instantly in your browser.";
    expect(trigramSimilarity(a, b)).toBeGreaterThan(0.8);
  });
  it("is 0 when either side is shorter than a trigram", () => {
    expect(trigramSimilarity("ab", "abcdef")).toBe(0);
  });
  it("is symmetric", () => {
    const a = "the quick brown fox";
    const b = "the quick brown dog";
    expect(trigramSimilarity(a, b)).toBeCloseTo(trigramSimilarity(b, a), 10);
  });
});

describe("pageWordCount", () => {
  it("sums intro, prose, caveats and every FAQ", () => {
    const tool = validTool({
      intro: words(40),
      howItWorks: words(120),
      gotchas: words(120),
      caveats: words(10),
      faqs: [{ q: words(5), a: words(20) }],
    });
    expect(pageWordCount(tool)).toBe(40 + 120 + 120 + 10 + 5 + 20);
  });
  it("omits caveats when absent", () => {
    const tool = validTool({
      intro: words(40),
      howItWorks: words(120),
      gotchas: words(120),
      faqs: [],
      caveats: undefined,
    });
    expect(pageWordCount(tool)).toBe(280);
  });
});

// ------------------------------------------------------------- happy path

describe("validateTools — happy path", () => {
  it("accepts an empty registry", () => {
    expect(() => validateTools([])).not.toThrow();
  });
  it("accepts a fully valid tool", () => {
    expect(issuesFor([validTool()])).toEqual([]);
  });
  it("accepts related slugs that resolve in both directions", () => {
    const a = validTool({ slug: "tool-a", related: ["tool-b"] });
    const b = validTool({ slug: "tool-b", related: ["tool-a"] });
    expect(issuesFor([a, b])).toEqual([]);
  });
  it("returns no warnings for genuinely distinct copy", () => {
    expect(warningsFor([validTool()])).toEqual([]);
  });
});

// ------------------------------------------------------------------ slugs

describe("validateTools — slugs", () => {
  it.each([
    ["Has-Uppercase"],
    ["has_underscore"],
    ["-leading-hyphen"],
    ["trailing-hyphen-"],
    ["double--hyphen"],
    ["has space"],
    ["trailing.dot"],
  ])("rejects the malformed slug %s", (slug) => {
    const found = issuesFor([validTool({ slug })]);
    expect(found.some((i) => i.includes("slug"))).toBe(true);
  });

  it("rejects a slug shorter than the minimum", () => {
    const found = issuesFor([validTool({ slug: "ab" })]);
    expect(found.some((i) => i.includes("slug") && i.includes("outside"))).toBe(
      true
    );
  });

  it("rejects a duplicate slug and names both indexes", () => {
    const found = issuesFor([validTool(), validTool()]);
    expect(found.some((i) => /duplicate.*TOOLS\[0\].*TOOLS\[1\]/.test(i))).toBe(
      true
    );
  });

  it.each(["category", "spec", "api", "new", "all"])(
    "rejects the reserved slug %s",
    (slug) => {
      const found = issuesFor([validTool({ slug })]);
      expect(found.some((i) => i.includes("reserved"))).toBe(true);
    }
  );
});

// -------------------------------------------------------------- SEO fields

describe("validateTools — SEO field limits", () => {
  it("rejects a metaTitle over the maximum", () => {
    const found = issuesFor([
      validTool({ metaTitle: "x".repeat(LIMITS.metaTitleMax + 1) }),
    ]);
    expect(found.some((i) => i.includes("metaTitle"))).toBe(true);
  });

  it("accepts a metaTitle of exactly the maximum", () => {
    expect(
      issuesFor([validTool({ metaTitle: "x".repeat(LIMITS.metaTitleMax) })])
    ).toEqual([]);
  });

  it("rejects an empty metaTitle", () => {
    const found = issuesFor([validTool({ metaTitle: "   " })]);
    expect(found.some((i) => i.includes("metaTitle"))).toBe(true);
  });

  it.each([LIMITS.descriptionMin - 1, LIMITS.descriptionMax + 1])(
    "rejects a description of %i characters",
    (len) => {
      const found = issuesFor([validTool({ description: "x".repeat(len) })]);
      expect(found.some((i) => i.includes("description"))).toBe(true);
    }
  );

  it.each([LIMITS.descriptionMin, LIMITS.descriptionMax])(
    "accepts a description of %i characters",
    (len) => {
      expect(issuesFor([validTool({ description: "x".repeat(len) })])).toEqual(
        []
      );
    }
  );
});

// ------------------------------------------------- cross-registry duplicates

describe("validateTools — duplicate detection across the registry", () => {
  it("rejects two tools sharing a metaTitle", () => {
    const a = validTool({ slug: "tool-a", metaTitle: "Identical Meta Title" });
    const b = validTool({ slug: "tool-b", metaTitle: "Identical Meta Title" });
    const found = issuesFor([a, b]);
    expect(found.some((i) => i.includes("metaTitle") && i.includes("tool-a"))).toBe(
      true
    );
  });

  it("rejects two tools sharing a description", () => {
    const shared = "y".repeat(140);
    const a = validTool({ slug: "tool-a", description: shared });
    const b = validTool({ slug: "tool-b", description: shared });
    const found = issuesFor([a, b]);
    expect(found.some((i) => i.includes("description"))).toBe(true);
  });

  it("rejects two tools sharing an H1 title", () => {
    const a = validTool({ slug: "tool-a", title: "Same H1" });
    const b = validTool({ slug: "tool-b", title: "Same H1" });
    const found = issuesFor([a, b]);
    expect(found.some((i) => i.includes("title"))).toBe(true);
  });

  it("treats duplicates case-insensitively and ignoring surrounding space", () => {
    const a = validTool({ slug: "tool-a", metaTitle: "Same Title" });
    const b = validTool({ slug: "tool-b", metaTitle: "  same title  " });
    expect(issuesFor([a, b]).some((i) => i.includes("metaTitle"))).toBe(true);
  });

  it("warns — but does not fail — on templated near-duplicate descriptions", () => {
    const a = validTool({
      slug: "tool-a",
      description:
        "Convert 100 kilograms to pounds instantly in your own browser, with no upload, no signup, and no watermark anywhere on the result.",
    });
    const b = validTool({
      slug: "tool-b",
      description:
        "Convert 200 kilograms to pounds instantly in your own browser, with no upload, no signup, and no watermark anywhere on the result.",
    });
    expect(issuesFor([a, b])).toEqual([]);
    const warnings = warningsFor([a, b]);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("tool-a");
    expect(warnings[0]).toContain("tool-b");
  });
});

// ------------------------------------------------------------------- prose

describe("validateTools — prose length", () => {
  it("rejects howItWorks under the floor and reports the actual count", () => {
    const found = issuesFor([
      validTool({ howItWorks: words(LIMITS.proseWordsMin - 1) }),
    ]);
    expect(
      found.some(
        (i) =>
          i.includes("howItWorks") && i.includes(String(LIMITS.proseWordsMin - 1))
      )
    ).toBe(true);
  });

  it("accepts gotchas at exactly the floor", () => {
    // Compensate elsewhere so the page floor is not what fails.
    expect(
      issuesFor([
        validTool({
          gotchas: words(LIMITS.proseWordsMin),
          howItWorks: words(160),
        }),
      ])
    ).toEqual([]);
  });

  it.each([LIMITS.introWordsMin - 1, LIMITS.introWordsMax + 1])(
    "rejects an intro of %i words",
    (n) => {
      const found = issuesFor([validTool({ intro: words(n) })]);
      expect(found.some((i) => i.includes("intro"))).toBe(true);
    }
  );

  it("rejects a page below the total word floor", () => {
    const found = issuesFor([
      validTool({
        intro: words(40),
        howItWorks: words(120),
        gotchas: words(120),
        faqs: [
          { q: "Is this a real question?", a: words(15) },
          { q: "Is this another question?", a: words(15) },
          { q: "And a third question here?", a: words(15) },
        ],
      }),
    ]);
    expect(found.some((i) => i.includes("page") && i.includes("minimum"))).toBe(
      true
    );
  });

  it("rejects a page above the runaway ceiling", () => {
    const found = issuesFor([
      validTool({ howItWorks: words(LIMITS.pageWordsMax + 100) }),
    ]);
    expect(found.some((i) => i.includes("page") && i.includes("maximum"))).toBe(
      true
    );
  });
});

describe("validateTools — caveats are mandatory off-browser", () => {
  it.each(["vercel", "railway", "hybrid"] as const)(
    "requires caveats when compute is %s",
    (compute) => {
      const found = issuesFor([validTool({ compute })]);
      expect(found.some((i) => i.includes("caveats"))).toBe(true);
    }
  );

  it("accepts an off-browser tool that documents its limits", () => {
    expect(
      issuesFor([
        validTool({ compute: "railway", caveats: words(LIMITS.proseWordsMin) }),
      ])
    ).toEqual([]);
  });

  it("does not require caveats for a browser tool", () => {
    expect(issuesFor([validTool({ compute: "browser" })])).toEqual([]);
  });
});

// -------------------------------------------------------------------- FAQs

describe("validateTools — FAQs", () => {
  it("rejects fewer than the minimum", () => {
    const faqs = validTool().faqs.slice(0, LIMITS.faqsMin - 1);
    expect(issuesFor([validTool({ faqs })]).some((i) => i.includes("faqs"))).toBe(
      true
    );
  });

  it("rejects more than the maximum", () => {
    const faqs = Array.from({ length: LIMITS.faqsMax + 1 }, (_, i) => ({
      q: `A real sounding question number ${i}?`,
      a: words(25),
    }));
    expect(issuesFor([validTool({ faqs })]).some((i) => i.includes("faqs"))).toBe(
      true
    );
  });

  it("rejects a stub answer and names the index", () => {
    const faqs = validTool().faqs.map((f, i) =>
      i === 1 ? { ...f, a: "Yes it is." } : f
    );
    expect(
      issuesFor([validTool({ faqs })]).some((i) => i.includes("faqs[1].a"))
    ).toBe(true);
  });

  it("rejects a question that is too short to be a query", () => {
    const faqs = validTool().faqs.map((f, i) =>
      i === 0 ? { ...f, q: "Why?" } : f
    );
    expect(
      issuesFor([validTool({ faqs })]).some((i) => i.includes("faqs[0].q"))
    ).toBe(true);
  });

  it("rejects the same question asked twice", () => {
    const faqs = [
      { q: "What does this tool do?", a: words(25) },
      { q: "what does this tool do?", a: words(25) },
      { q: "Is it free to use?", a: words(25) },
    ];
    expect(
      issuesFor([validTool({ faqs })]).some((i) => i.includes("duplicate question"))
    ).toBe(true);
  });
});

// ----------------------------------------------------------------- related

describe("validateTools — related links", () => {
  it("rejects a dangling related slug", () => {
    const found = issuesFor([validTool({ related: ["does-not-exist"] })]);
    expect(found.some((i) => i.includes("does-not-exist"))).toBe(true);
  });
  it("rejects a self-referencing related slug", () => {
    const found = issuesFor([validTool({ related: ["sample-tool"] })]);
    expect(found.some((i) => i.includes("its own slug"))).toBe(true);
  });
  it("rejects duplicate related slugs", () => {
    const a = validTool({ slug: "tool-a", related: ["tool-b", "tool-b"] });
    const b = validTool({ slug: "tool-b" });
    expect(
      issuesFor([a, b]).some((i) => i.includes("duplicate slugs"))
    ).toBe(true);
  });
  it("rejects more related entries than the maximum", () => {
    const others = Array.from({ length: LIMITS.relatedMax + 1 }, (_, i) =>
      validTool({ slug: `sibling-${i}` })
    );
    const main = validTool({
      slug: "main-tool",
      related: others.map((o) => o.slug),
    });
    expect(
      issuesFor([main, ...others]).some((i) => i.includes("related"))
    ).toBe(true);
  });
});

// ------------------------------------------------------- taxonomy & dates

describe("validateTools — taxonomy", () => {
  it("rejects a category outside the closed set", () => {
    const found = issuesFor([
      validTool({ category: "nonsense" as ToolDef["category"] }),
    ]);
    expect(found.some((i) => i.includes("category"))).toBe(true);
  });
  it("rejects an empty audience", () => {
    expect(
      issuesFor([validTool({ audience: [] })]).some((i) => i.includes("audience"))
    ).toBe(true);
  });
  it("rejects an audience outside the closed set", () => {
    const found = issuesFor([
      validTool({ audience: ["astronauts" as ToolDef["audience"][number]] }),
    ]);
    expect(found.some((i) => i.includes("audience"))).toBe(true);
  });
  it("rejects duplicate keywords", () => {
    const found = issuesFor([validTool({ keywords: ["a b", "a b", "c d"] })]);
    expect(found.some((i) => i.includes("keywords"))).toBe(true);
  });
  it.each([LIMITS.keywordsMin - 1, LIMITS.keywordsMax + 1])(
    "rejects %i keywords",
    (n) => {
      const keywords = Array.from({ length: n }, (_, i) => `keyword ${i}`);
      expect(
        issuesFor([validTool({ keywords })]).some((i) => i.includes("keywords"))
      ).toBe(true);
    }
  );
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
    const found = issuesFor([
      validTool({
        sources: [
          {
            title: "Dept of Labour",
            publisher: "Government of Sri Lanka",
            url: "https://example.gov.lk",
            verifiedOn: "2026-06-02", // today is injected as 2026-06-01
          },
        ],
      }),
    ]);
    expect(found.some((i) => i.includes("sources[0].verifiedOn"))).toBe(true);
  });

  it("accepts a source verified today", () => {
    expect(
      issuesFor([
        validTool({
          sources: [
            {
              title: "Dept of Labour",
              publisher: "Government of Sri Lanka",
              url: "https://example.gov.lk",
              verifiedOn: "2026-06-01",
            },
          ],
        }),
      ])
    ).toEqual([]);
  });

  it("rejects a non-https source URL", () => {
    const found = issuesFor([
      validTool({
        sources: [
          {
            title: "X",
            publisher: "Y",
            url: "http://example.gov.lk",
            verifiedOn: "2026-01-01",
          },
        ],
      }),
    ]);
    expect(found.some((i) => i.includes("sources[0].url"))).toBe(true);
  });

  it("rejects a source with no publisher", () => {
    const found = issuesFor([
      validTool({
        sources: [
          {
            title: "X",
            publisher: "  ",
            url: "https://example.gov.lk",
            verifiedOn: "2026-01-01",
          },
        ],
      }),
    ]);
    expect(found.some((i) => i.includes("sources[0].publisher"))).toBe(true);
  });
});

// --------------------------------------------------------- the content cap

describe("validateTools — the content-farm cap", () => {
  const many = (n: number): ToolDef[] =>
    Array.from({ length: n }, (_, i) =>
      validTool({
        slug: `tool-${i}`,
        description:
          `Distinct description number ${i} written so that it clears the ` +
          `minimum length the validator enforces for meta descriptions here.`.slice(
            0,
            160
          ),
      })
    );

  it(`accepts exactly ${MAX_TOOLS} tools`, () => {
    expect(issuesFor(many(MAX_TOOLS))).toEqual([]);
  });

  it(`rejects ${MAX_TOOLS + 1} tools`, () => {
    expect(
      issuesFor(many(MAX_TOOLS + 1)).some((i) => i.includes("MAX_TOOLS"))
    ).toBe(true);
  });
});

describe("validateTools — error aggregation", () => {
  it("reports every problem in one throw, not just the first", () => {
    const found = issuesFor([
      validTool({
        slug: "Bad Slug",
        metaTitle: "x".repeat(LIMITS.metaTitleMax + 20),
        faqs: [],
      }),
    ]);
    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  it("names the offending slug and field in every message", () => {
    const found = issuesFor([validTool({ metaTitle: "x".repeat(200) })]);
    expect(found.every((i) => i.startsWith("["))).toBe(true);
    expect(found.some((i) => i.includes("[sample-tool] metaTitle:"))).toBe(true);
  });

  it("throws a ToolRegistryError whose message lists the issues", () => {
    try {
      validateTools([validTool({ slug: "Bad Slug" })], { today: "2026-06-01" });
      throw new Error("expected validateTools to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ToolRegistryError);
      expect((err as ToolRegistryError).message).toContain("registry.ts");
      expect((err as ToolRegistryError).issues.length).toBeGreaterThan(0);
    }
  });
});
