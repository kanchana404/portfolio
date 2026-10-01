import {
  SUMMARY_MAX,
  TITLE_MAX,
  cleanText,
  cleanUrl,
  htmlToText,
  isGenericDescription,
  normalizeTitleKey,
  normalizeUrlKey,
  stripBoilerplate,
  stripInlineTags,
  summarizeContent,
} from "./sanitize";
import type { Source } from "./sources";
import { decodeEntities, type RawEntry } from "./xml";

/**
 * From parsed feed entries to the candidate list Codex picks from: clean each
 * entry into an Item, keep the last few days, drop what an earlier digest
 * already linked, score and cap. No network and no filesystem, so all of it
 * is tested offline; scripts/digest/fetch.ts does the I/O.
 *
 * Pure; the tsx CLIs load it without the `@/` alias.
 */

export interface Item {
  sourceId: string;
  /** The company, as the post names it. */
  source: string;
  title: string;
  url: string;
  /** ISO 8601 in UTC. */
  date: string;
  /** Where the date came from: the feed, the page's article:published_time, a listing card, or a sitemap lastmod. */
  dateSource: "feed" | "page" | "listing" | "lastmod";
  summary: string | null;
  summarySource: "feed" | "content" | "page" | null;
  weight: number;
  /** Warnings for Codex and the owner, such as text that reads like instructions. */
  flags: string[];
}

export interface Candidate extends Item {
  rank: number;
  score: number;
}

const DAY_MS = 86_400_000;

/** Phrases that address an AI or ask for actions: data that looks like instructions. */
const INSTRUCTION_PATTERNS: RegExp[] = [
  /\bignore (?:all |any |the )?(?:previous|prior|above|earlier) (?:instructions|prompts?|rules)\b/i,
  /\bdisregard (?:all |any |the )?(?:previous|prior|above|earlier)\b/i,
  /\b(?:system|developer) prompt\b/i,
  /\byou are (?:now )?(?:an? )?(?:ai|assistant|language model|llm|codex|claude|chatgpt)\b/i,
  /\b(?:dear|attention|note to|hey) (?:ai|assistant|agent|codex|claude|chatgpt|llm)s?\b/i,
  /\b(?:AGENTS|CLAUDE)\.md\b/i,
  /\b(?:run|execute) (?:the following|this) (?:command|script|code)\b/i,
  // Install commands are normal in a changelog; piping a download into a
  // shell, pushing, or sudo are not.
  /\b(?:curl|wget)\b[^\n|]{0,200}\|\s*(?:sh|bash|zsh)\b/i,
  /\bgit push\b|\bsudo\s/i,
  /\bnew instructions\b/i,
];

export function instructionFlags(text: string): string[] {
  return INSTRUCTION_PATTERNS.some((re) => re.test(text)) ? ["reads-like-instructions"] : [];
}

/** The feed's summary as text, or the start of its full content, with the source recorded. */
function summaryOf(entry: RawEntry): { summary: string | null; summarySource: Item["summarySource"] } {
  const cleaned = entry.summary ? cleanText(stripBoilerplate(htmlToText(entry.summary)), SUMMARY_MAX) : "";
  const fromSummary = isGenericDescription(cleaned) ? "" : cleaned;
  const truncated = /(?:…|\.\.\.|\[…\])$/.test(fromSummary);
  if (fromSummary !== "" && !(truncated && entry.content)) return { summary: fromSummary, summarySource: "feed" };
  const fromContent = entry.content ? summarizeContent(stripBoilerplate(htmlToText(entry.content))) : null;
  if (fromContent) return { summary: fromContent, summarySource: "content" };
  return fromSummary !== "" ? { summary: fromSummary, summarySource: "feed" } : { summary: null, summarySource: null };
}

/** One feed entry as an Item, or null when it has no usable title, link or date. */
export function entryToItem(entry: RawEntry, source: Source, feedUrl: string): Item | null {
  // xml.ts hands the title over as HTML (CDATA, an Atom html title, a text
  // one escaped). Only inline formatting tags are removed before entities are
  // decoded, so `Using &lt;Suspense&gt; in Next.js` keeps its brackets.
  const title = entry.title ? cleanText(decodeEntities(stripInlineTags(entry.title)), TITLE_MAX) : "";
  const url = cleanUrl(entry.link, feedUrl, source.include);
  if (title === "" || !url || !entry.date) return null;
  const { summary, summarySource } = summaryOf(entry);
  return {
    sourceId: source.id,
    source: source.name,
    title,
    url,
    date: entry.date,
    dateSource: "feed",
    summary,
    summarySource,
    weight: source.weight,
    flags: instructionFlags(`${title} ${summary ?? ""}`),
  };
}

/** The time window a run keeps: the last `days` days up to `now`. */
export function windowFor(now: Date, days: number): { from: Date; to: Date } {
  return { from: new Date(now.getTime() - days * DAY_MS), to: now };
}

export function inWindow(iso: string, window: { from: Date; to: Date }): boolean {
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t >= window.from.getTime() && t <= window.to.getTime() + 2 * DAY_MS;
}

/** Keyword weights, matched as whole words in lowercase; a title match counts double. */
const BOOST: Record<string, number> = {
  api: 3,
  sdk: 3,
  cli: 2,
  "open source": 2,
  "open-source": 2,
  "open weight": 3,
  "open-weight": 3,
  agent: 3,
  agents: 3,
  mcp: 4,
  "model context protocol": 4,
  "tool use": 2,
  "function calling": 2,
  "structured output": 2,
  "structured outputs": 2,
  embedding: 2,
  embeddings: 2,
  "fine-tuning": 2,
  rag: 2,
  evals: 2,
  realtime: 2,
  "context window": 2,
  "rate limit": 3,
  "rate limits": 3,
  pricing: 2,
  "now available": 2,
  "generally available": 3,
  "public preview": 2,
  "public beta": 2,
  release: 1,
  released: 1,
  deprecated: 3,
  deprecation: 3,
  "breaking change": 4,
  "breaking changes": 4,
  migration: 2,
  security: 3,
  vulnerability: 3,
  cve: 4,
  "next.js": 4,
  react: 3,
  typescript: 3,
  "node.js": 2,
  turbopack: 3,
  "ai sdk": 4,
  codex: 3,
  claude: 3,
  gpt: 2,
  gemini: 2,
  copilot: 2,
  "github actions": 2,
  transformers: 2,
};

const PENALTY: Record<string, number> = {
  funding: -8,
  raises: -6,
  "series a": -8,
  "series b": -8,
  "series c": -8,
  "series d": -8,
  "series e": -8,
  "series f": -8,
  valuation: -8,
  hires: -6,
  hiring: -6,
  appoints: -6,
  appointed: -6,
  joins: -3,
  partnership: -3,
  "partners with": -3,
  podcast: -5,
  webinar: -5,
  event: -3,
  conference: -3,
  recap: -3,
  "customer story": -5,
  "case study": -4,
  opinion: -4,
};

const MAX_BOOST = 15;
const MAX_PENALTY = -20;

function termRegExp(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
}

const TERMS = [...Object.entries(BOOST), ...Object.entries(PENALTY)].map(([term, w]) => ({
  term,
  w,
  re: termRegExp(term),
}));

/**
 * weight × 5, plus recency (10 halving every 3 days), plus keywords (boosts
 * capped at 15, penalties at −20), minus 2 when there is no summary for Codex
 * to work from. A hint for ordering the list, not a verdict.
 */
export function scoreItem(item: Item, now: Date): { score: number; matched: string[] } {
  const ageDays = Math.max(0, (now.getTime() - Date.parse(item.date)) / DAY_MS);
  const recency = Math.round(10 * 0.5 ** (ageDays / 3) * 10) / 10;
  let boost = 0;
  let penalty = 0;
  const matched: string[] = [];
  for (const { term, w, re } of TERMS) {
    const points = re.test(item.title) ? 2 * w : item.summary && re.test(item.summary) ? w : 0;
    if (points === 0) continue;
    matched.push(term);
    if (points > 0) boost += points;
    else penalty += points;
  }
  const keywords = Math.min(boost, MAX_BOOST) + Math.max(penalty, MAX_PENALTY);
  const score = item.weight * 5 + recency + keywords + (item.summary === null ? -2 : 0);
  return { score: Math.round(score * 10) / 10, matched };
}

/** The https targets of every Markdown link: `[text](https://…)`. */
export function linksInMarkdown(markdown: string): string[] {
  return [...markdown.matchAll(/\]\((https:\/\/[^\s)]+)\)/g)].map((m) => m[1]);
}

export interface SelectOptions {
  now: Date;
  /** URLs an earlier post already links, by normalizeUrlKey. */
  excludeUrlKeys: ReadonlySet<string>;
  perSource: number;
  max: number;
}

/**
 * Dedupe by page and by title across sources (the higher score wins), drop
 * pages an earlier post already linked, sort by score, then date, then URL,
 * and cap per source and in total.
 */
export function selectCandidates(items: Item[], o: SelectOptions): Candidate[] {
  const scored = items
    .filter((item) => !o.excludeUrlKeys.has(normalizeUrlKey(item.url)))
    .map((item) => ({ ...item, score: scoreItem(item, o.now).score }));
  scored.sort((a, b) =>
    a.score !== b.score ? b.score - a.score : a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.url < b.url ? -1 : 1
  );

  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const perSource = new Map<string, number>();
  const out: Candidate[] = [];
  for (const item of scored) {
    const urlKey = normalizeUrlKey(item.url);
    const titleKey = normalizeTitleKey(item.title);
    if (seenUrls.has(urlKey) || (titleKey !== "" && seenTitles.has(titleKey))) continue;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    const count = perSource.get(item.sourceId) ?? 0;
    if (count >= o.perSource) continue;
    perSource.set(item.sourceId, count + 1);
    out.push({ ...item, rank: out.length + 1 });
    if (out.length >= o.max) break;
  }
  return out;
}

/** `YYYY-MM-DD` of an instant in a time zone, e.g. the owner's Asia/Colombo (UTC+05:30). */
export function ymdInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
