/**
 * Generates the Lighthouse CI config with its URL list taken from the registry.
 *
 * `lighthouserc.json` used to name tool URLs literally:
 *
 *     "http://127.0.0.1:3200/tools/percentage-calculator",
 *     "http://127.0.0.1:3200/tools/color-converter"
 *
 * which meant retiring either tool pointed the run at a 404 — and a 404 still
 * *has* a Lighthouse score, so it failed on `categories:seo >= 0.95` with no
 * hint that the URL was the problem. It also failed on every PR from then on,
 * because the config is checked in and nothing else references those slugs.
 *
 * Importing the registry fixes the direction of the dependency: the URL list is
 * now a consequence of what the site publishes. Importing it also re-runs
 * `validateTools()` at module scope, so an invalid registry fails here too,
 * before a browser is started.
 *
 * The site's own pages are audited always: the homepage, /blog and /privacy.
 * Tool pages are added only while the tools section is live. While it is dark
 * every /tools URL answers 410, Lighthouse cannot audit a 410, and the job used
 * to fail on every run while never measuring the homepage at all.
 *
 * Run: `tsx scripts/lighthouse-config.ts` → writes `lighthouserc.generated.json`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicTools } from "../src/lib/tools/registry";
import { TOOLS_SECTION_LIVE } from "../src/lib/tools/section-flag";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const BASE = "lighthouserc.json";
const OUT = "lighthouserc.generated.json";

/**
 * How many tool pages to audit besides the hub.
 *
 * Lighthouse runs each URL `numberOfRuns` times against a cold production
 * server, so this is the knob that decides how long the CI job takes. Two is
 * enough to catch a template-level regression — every tool page is the same
 * template — and `tests/browser/all-tools.spec.ts` already measures throttled
 * CLS on *every* tool, which is the metric that actually varies per widget.
 */
const SAMPLE = Number(process.env.LHCI_TOOL_SAMPLE ?? 2);

const origin = process.env.LHCI_ORIGIN ?? "http://127.0.0.1:3200";

const config = JSON.parse(readFileSync(join(root, BASE), "utf8")) as {
  ci: { collect: { url?: string[] } };
};

// /blog is statically generated and shows its empty state until the first post
// is committed.
const SITE_PAGES = ["/", "/blog", "/privacy"];

const tools = TOOLS_SECTION_LIVE ? publicTools() : [];

// Registry order, not recency: the list must be stable between runs or the
// numbers are not comparable across commits.
const sampled = tools.slice(0, Math.max(1, SAMPLE));

config.ci.collect.url = [
  ...SITE_PAGES.map((path) => `${origin}${path}`),
  ...(tools.length > 0
    ? [`${origin}/tools`, ...sampled.map((t) => `${origin}/tools/${t.slug}`)]
    : []),
];

writeFileSync(join(root, OUT), `${JSON.stringify(config, null, 2)}\n`, "utf8");

console.log(
  `${OUT}: auditing ${config.ci.collect.url.length} URLs: ${SITE_PAGES.join(", ")}` +
    (tools.length > 0
      ? `, /tools and ${sampled.map((t) => t.slug).join(", ")} (of ${tools.length} published).`
      : ` (tools section dark, no tool pages).`)
);
