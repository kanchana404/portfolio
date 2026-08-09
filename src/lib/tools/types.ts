/**
 * The tool registry's type surface.
 *
 * Every downstream file — validator, registry, JSON-LD builder, shell, three
 * page files, both sitemaps — is a function of this one module. Getting the
 * field set right is cheap now and a six-file rewrite later, so a few choices
 * are deliberate and load-bearing:
 *
 * - **No React in here.** `ToolDef` is serialisable data. The widget lives in a
 *   separate slug-keyed map (`./widgets`). Putting a `ComponentType` on the
 *   registry type would mean that importing `TOOLS` imports every widget — into
 *   the hub, into `/tools/category/*`, into `sitemap.ts`, into the validator's
 *   own tests. With WASM-backed widgets arriving in later sprints that is a
 *   megabyte of pdf-lib and MediaPipe resolvable from routes that render none of
 *   it, which blows the script budget on every tool page at once.
 * - **Closed tuples, not free strings.** Categories and audiences are `as const`
 *   so `generateStaticParams` is derivable and a typo is a compile error rather
 *   than a live 404.
 * - **Four-state status, not two.** `draft` is never built, `deprecated` needs a
 *   410 path. A boolean-ish `live | beta` cannot express either.
 */

/**
 * Categories are a closed set. Two reasons: `/tools/category/[category]` derives
 * its static params from this tuple, and editing it forces the content-strategy
 * question ("is this really a new category?") to be answered deliberately.
 *
 * Appending is cheap. Renaming or removing is a URL change — treat it as one.
 */
export const TOOL_CATEGORIES = [
  "calculators",
  "image",
  "pdf",
  "text",
  "developer",
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/**
 * Human labels for headings, breadcrumbs and `<title>`.
 *
 * Typed as a total Record so adding a category to the tuple without a label is a
 * compile error, not a page rendering the raw slug.
 */
export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  calculators: "Calculators",
  image: "Image tools",
  pdf: "PDF tools",
  text: "Text tools",
  developer: "Developer tools",
};

/**
 * Who the tool is for. Not rendered prominently — this exists so that at twenty
 * entries "am I building for one audience or six?" is answerable without reading
 * every description.
 */
export const TOOL_AUDIENCES = [
  "developers",
  "designers",
  "students",
  "sri-lanka",
  "small-business",
  "job-seekers",
  "general",
] as const;
export type ToolAudience = (typeof TOOL_AUDIENCES)[number];

/**
 * Where the work actually happens.
 *
 * Not decoration: `<ToolShell>` derives the privacy line in the meta row from
 * it, and claiming "nothing uploaded" on a tool that POSTs to a server is a lie
 * a visitor can catch with devtools open.
 *
 * `vercel` exists separately from `railway` because a tool backed by a Next
 * route handler (a stateful tracker writing to Mongo) is neither pure-browser
 * nor heavy Python, and collapsing the two would make it unrepresentable.
 */
export type ToolCompute = "browser" | "vercel" | "railway" | "hybrid";

/**
 * Publication state. Drives `generateStaticParams`, robots, sitemap inclusion
 * and the hub grid:
 *
 * | status       | built | robots            | sitemap | hub |
 * |--------------|-------|-------------------|---------|-----|
 * | `draft`      | no    | n/a (404s)        | no      | no  |
 * | `beta`       | yes   | noindex, follow   | no      | no  |
 * | `stable`     | yes   | index, follow     | yes     | yes |
 * | `deprecated` | yes   | noindex, follow   | no      | no  |
 *
 * Choose `beta` *before* a tool's first deploy and promote to `stable` exactly
 * once. Flip-flopping a URL between indexable and not teaches Google the URL is
 * unstable and costs weeks of re-earning a page you could have simply held back.
 */
export type ToolStatus = "draft" | "beta" | "stable" | "deprecated";

export interface ToolFaq {
  /** Phrased as a real user query, not a marketing prompt. */
  q: string;
  /** Answered in the first sentence. Everything after is elaboration. */
  a: string;
}

/**
 * A dated citation.
 *
 * Required in spirit for anything whose correctness depends on a rule someone
 * else controls — tax rates, statutory contributions, filing deadlines, passport
 * photo dimensions.
 *
 * `verifiedOn` is the date a human opened the URL and read it, not the date the
 * document was published. `archivePath` points at a local copy under
 * `docs/sources/`, because link rot on government sites is a certainty over a
 * multi-month programme and a citation that 404s is not a citation.
 */
export interface Citation {
  /** Document name as printed on the document itself. */
  title: string;
  /** The body that published it. */
  publisher: string;
  /** Gazette number, Act number, circular number, or handbook edition. */
  reference?: string;
  /** Absolute https URL to a primary source. Not a blog post about the rule. */
  url: string;
  /** ISO calendar date, YYYY-MM-DD. */
  verifiedOn: string;
  /** Repo-relative path to an archived copy, e.g. `docs/sources/foo.pdf`. */
  archivePath?: string;
}

export interface ToolDef {
  /** URL segment. Lowercase kebab. Immutable once published — this is a URL. */
  slug: string;
  /** The H1. The exact target keyword phrase, not a clever variant. */
  title: string;
  /** `<title>`. Kept short because the root layout appends " | Kavitha Kanchana". */
  metaTitle: string;
  /** `<meta name="description">`. */
  description: string;
  category: ToolCategory;
  audience: ToolAudience[];
  compute: ToolCompute;
  status: ToolStatus;
  /** ISO calendar date. Never changes after first deploy. */
  publishedAt: string;
  /** ISO calendar date. Bump when the prose or the maths changes. */
  updatedAt: string;
  /** 3–8 phrases. Used as a brief far more than as a meta tag. */
  keywords: string[];
  /** Sits between the H1 and the widget. Long enough to establish relevance, short enough not to push the widget below the fold. */
  intro: string;
  /** The real mechanism, not "simply upload your file". */
  howItWorks: string;
  /** The cases where this tool is the wrong answer. */
  gotchas: string;
  /**
   * Honest limits, rendered directly under the widget.
   *
   * Required for anything that does not run purely in the browser: a tool that
   * ships work to a server owes the reader an account of what it does badly,
   * in the place someone who just got a mediocre result will actually look.
   */
  caveats?: string;
  /** Fewer than three looks thin; more than six reads as padding and dilutes the FAQPage node. */
  faqs: ToolFaq[];
  /** Slugs of sibling tools. Must all exist, must not include self. */
  related: string[];
  /** Primary sources. Required in spirit for anything with a regulated number in it. */
  sources?: Citation[];
}

/**
 * Slugs that can never be a tool because they collide with a route segment.
 *
 * `category` is the load-bearing one: `/tools/category/[category]` would
 * otherwise be ambiguous with `/tools/[slug]`. `spec` is reserved ahead of the
 * upload-spec pages so the segment is not claimed by a tool first.
 */
export const RESERVED_SLUGS: readonly string[] = [
  "category",
  "spec",
  "api",
  "new",
  "all",
];

/**
 * Anti-content-farm cap.
 *
 * This is a policy, not a technical limit. Ideas are free and live in the
 * backlog; slots are scarce and live in the registry. Tool #31 does not exist
 * until tool #7 is deleted, or until a PR that raises this number explains why
 * in its title and cites a green phase gate.
 */
export const MAX_TOOLS = 30;
