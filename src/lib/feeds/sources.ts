/**
 * The weekly digest's sources: the only URLs `pnpm digest:fetch` requests.
 *
 * The fetch runs inside a Codex Cloud task whose internet access is limited to
 * CODEX_ALLOWED_DOMAINS ("Custom domains only"), and the fetcher refuses any
 * host outside FEED_HOSTS on its own, redirects included, so a feed that
 * redirects elsewhere is reported instead of followed. Hard-coded rather than
 * read from a JSON file: a source change is a code change, reviewed like one,
 * and sources.test.ts checks every entry.
 *
 * Every request for a source stays on that source's own host, redirects
 * included: a page read that started at openai.com cannot end on
 * huggingface.co, where anyone can publish.
 *
 * Feed facts, checked live on 2026-10-01:
 * - Anthropic has no feed. Its launch posts are top-level pages
 *   (/claude-sonnet-5-5) that the sitemap lists with no lastmod and whose
 *   head has no publish date, so the /news listing, which shows every card
 *   with its date, comes first. The sitemap still covers /engineering/ and
 *   older /news/ pages; its lastmod is a modification time, so the page's
 *   article:published_time decides whether an item is new.
 * - Hugging Face items have no description and about a third of DeepMind's
 *   are empty, so the fetcher reads og:description from the page.
 * - vercel.com/atom is about 3.7 MB, blog and changelog mixed. Only the blog
 *   is kept: the changelog's dozen items a week pushed blog posts past the
 *   per-source cap, and many repeat other sources' launches.
 * - The GitHub changelog feed holds 10 items, about 3 days, so it is paged.
 *
 * Pure and import-free: the tsx CLIs load it without the `@/` alias.
 */

export type SourceKind = "feed" | "sitemap" | "listing";

export interface Source {
  /** `[a-z0-9-]`, unique. */
  id: string;
  /** How the post names the company: `Source: [<name>: <title>](<url>)`. */
  name: string;
  kind: SourceKind;
  url: string;
  /** An item's link must start with one of these, or it is dropped. */
  include: string[];
  /** 1-3: how much a developer usually cares about this source. */
  weight: number;
  /**
   * A listing source only: a sitemap read after the listing, for pages the
   * listing does not show, with its own prefixes. It also stands in when the
   * listing page fails or shows no dated card.
   */
  sitemap?: { url: string; include: string[] };
  /** Fetch `url?<pageParam>=2..pages` too, for a feed that holds only a few days. */
  pages?: number;
  pageParam?: string;
  /**
   * Page reads for this source per run: og:description for items the feed
   * gave no summary, and every item of a sitemap source. Sequential, 400 ms
   * apart, so a run stays polite and bounded.
   */
  maxPageReads: number;
}

export const SOURCES: readonly Source[] = [
  {
    id: "openai",
    name: "OpenAI",
    kind: "feed",
    url: "https://openai.com/news/rss.xml",
    include: ["https://openai.com/"],
    weight: 3,
    maxPageReads: 5,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "listing",
    url: "https://www.anthropic.com/news",
    // Launch posts are top-level pages; news is under /news/.
    include: ["https://www.anthropic.com/"],
    sitemap: {
      url: "https://www.anthropic.com/sitemap.xml",
      include: ["https://www.anthropic.com/news/", "https://www.anthropic.com/engineering/"],
    },
    weight: 3,
    maxPageReads: 15,
  },
  {
    id: "deepmind",
    name: "Google DeepMind",
    kind: "feed",
    url: "https://deepmind.google/blog/rss.xml",
    include: ["https://deepmind.google/"],
    weight: 3,
    maxPageReads: 10,
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    kind: "feed",
    url: "https://huggingface.co/blog/feed.xml",
    include: ["https://huggingface.co/blog/"],
    weight: 2,
    maxPageReads: 15,
  },
  {
    id: "nextjs",
    name: "Next.js",
    kind: "feed",
    url: "https://nextjs.org/feed.xml",
    include: ["https://nextjs.org/blog/"],
    weight: 3,
    maxPageReads: 5,
  },
  {
    id: "vercel",
    name: "Vercel",
    kind: "feed",
    url: "https://vercel.com/atom",
    include: ["https://vercel.com/blog/"],
    weight: 2,
    maxPageReads: 5,
  },
  {
    id: "github-changelog",
    name: "GitHub",
    kind: "feed",
    url: "https://github.blog/changelog/feed/",
    include: ["https://github.blog/changelog/"],
    weight: 2,
    pages: 4,
    pageParam: "paged",
    maxPageReads: 5,
  },
];

/** Every host the fetcher may connect to. Anything else is refused before a request is made. */
export const FEED_HOSTS: readonly string[] = [
  "openai.com",
  "www.anthropic.com",
  "deepmind.google",
  "huggingface.co",
  "nextjs.org",
  "vercel.com",
  "github.blog",
];

/**
 * The Codex Cloud environment's "Additional allowed domains", exactly as
 * docs/weekly-digest.md and AGENTS.md list them: the npm registry for
 * `pnpm install`, then the feed hosts.
 */
export const CODEX_ALLOWED_DOMAINS: readonly string[] = [
  "registry.npmjs.org",
  "openai.com",
  "deepmind.google",
  "huggingface.co",
  "nextjs.org",
  "vercel.com",
  "github.blog",
  "www.anthropic.com",
];
