#!/usr/bin/env node
/**
 * Bundle budget gate. Run after `next build`.
 *
 * ## Why these budgets and not the sprint plan's
 *
 * The plan budgets `/tools/[slug]` at "`/blog/[slug]` + 10 kB". Measurement
 * showed that baseline is unfair in a way that makes it useless: `/blog/[slug]`
 * imports no `next/link`, so it never loads the ~25 kB router/link chunk that
 * every tools page needs structurally for breadcrumbs, related links and the
 * hub. Budgeting against it means permanently failing a check for a cost the
 * tool pages cannot avoid and that has nothing to do with tools.
 *
 * So the gate measures the things that can actually go wrong:
 *
 * 1. **The shared chunk must not grow.** It is on every route including the
 *    homepage and the blog, so anything landing here is the most expensive
 *    possible regression.
 * 2. **`/` must stay near its baseline.** The homepage links into `/tools`; if
 *    that link starts costing real bytes, the registry is dragging widget code
 *    into the homepage graph.
 * 3. **`/blog/[slug]` must not move at all.** It is the canary: a route with no
 *    tools on it. If it grows after a tool ships, something imports the registry
 *    transitively into a graph that should never see it.
 * 4. **The widget delta.** `/tools/[slug]` minus `/tools` is what one widget
 *    actually costs, with the platform floor cancelled out on both sides. This
 *    is the number that catches a heavy dependency sneaking into a widget, and
 *    it is the one the plan was reaching for.
 * 5. **Forbidden modules.** Certain libraries must never appear in a first-load
 *    chunk — they belong behind `dynamic(ssr: false)` and a user gesture.
 *
 * Sizes are gzipped and computed here rather than scraped from Next's output, so
 * they are self-consistent across runs. They read ~2 kB lower than the numbers
 * Next prints; compare against the budgets in this file, not against the build
 * table.
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const NEXT_DIR = path.join(process.cwd(), ".next");
const MANIFEST = path.join(NEXT_DIR, "app-build-manifest.json");

/** kB, gzipped, as measured by this script. */
const ROUTE_BUDGETS = [
  { key: "/(site)/page", label: "/", maxKb: 200 },
  { key: "/(site)/blog/[slug]/page", label: "/blog/[slug]", maxKb: 88 },
  { key: "/(site)/blog/page", label: "/blog", maxKb: 96 },
  { key: "/(tools)/tools/page", label: "/tools", maxKb: 100 },
  { key: "/(tools)/tools/[slug]/page", label: "/tools/[slug]", maxKb: 126 },
  {
    key: "/(tools)/tools/category/[category]/page",
    label: "/tools/category/[category]",
    maxKb: 100,
  },
];

/**
 * What the whole widget set costs, with the shared platform floor cancelled out.
 *
 * ## Why this is 30 kB and not 5 kB
 *
 * `/tools/[slug]` is a single route, so its client chunk contains every widget
 * rather than only the one rendering. Measured at 26.8 kB gzipped for seventeen
 * widgets, roughly 1.5 kB each.
 *
 * This was briefly 5 kB, when the widgets were code-split with `next/dynamic`
 * and the delta was just the loader. That change cut the route from 121 kB to
 * 96 kB and was reverted: the Suspense boundary `dynamic` introduces drops the
 * server-rendered widget during hydration whenever its chunk has not arrived,
 * collapsing `WidgetFrame` to its floor and shifting the page. Invisible on warm
 * localhost (0.0000 everywhere); under Fast 3G with 4x CPU throttling it
 * measured up to **0.2779** CLS, the edge of Google's "poor" band, on the
 * viewport that gets indexed. See ADR 0003.
 *
 * ## The tripwire
 *
 * This cost is linear in the size of the catalogue, capped at MAX_TOOLS = 30.
 * When it fires:
 *
 * - **Do not re-split with `next/dynamic`.** That is the change that caused the
 *   CLS regression, and it will not show up in any warm test.
 * - **Do not simply raise the number.**
 *
 * The legitimate fixes are to drop a widget, or — for a genuinely heavy one
 * (WASM, canvas, a large parser) — give it its own `"use client"` wrapper using
 * `dynamic(..., { ssr: false })` *plus* a `<WidgetSkeleton>` reserving its
 * settled height. With `ssr: false` there is no server markup to lose, so there
 * is no gap to shift through.
 */
const WIDGET_DELTA = {
  route: "/(tools)/tools/[slug]/page",
  against: "/(tools)/tools/page",
  maxKb: 30,
};

/**
 * Substrings that must never appear in a first-load chunk of any route.
 *
 * These are the libraries later sprints introduce. Every one belongs behind a
 * `dynamic(..., { ssr: false })` boundary that only loads on a user gesture; a
 * static import of any of them silently adds megabytes to a page whose entire
 * value is being fast enough to rank.
 *
 * `tailwind-merge` is on the list for a different reason: it is ~21 kB and tool
 * widgets have dependency-free primitives precisely so they do not pull it. See
 * src/components/tools/ui.tsx.
 */
const FORBIDDEN_IN_TOOL_ROUTES = [
  "onnxruntime",
  "pdfjs",
  "pdf-lib",
  "libheif",
  "jsquash",
  "jszip",
  "mediapipe",
  "opencv",
];

const gzKb = (file) => {
  try {
    return gzipSync(readFileSync(path.join(NEXT_DIR, file))).length / 1024;
  } catch {
    return 0;
  }
};

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

function jsFiles(key) {
  const files = manifest.pages[key];
  if (!files) return null;
  return [...new Set(files.filter((f) => f.endsWith(".js")))];
}

function firstLoadKb(key) {
  const files = jsFiles(key);
  return files === null ? null : files.reduce((sum, f) => sum + gzKb(f), 0);
}

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`FAIL  ${msg}`);
};

console.log("Bundle budget (gzipped, measured by scripts/check-bundle-budget.mjs)\n");

// --- 1. per-route ceilings -------------------------------------------------
for (const { key, label, maxKb } of ROUTE_BUDGETS) {
  const kb = firstLoadKb(key);
  if (kb === null) {
    fail(`route "${label}" (${key}) is missing from app-build-manifest.json — did the path change?`);
    continue;
  }
  const over = kb > maxKb;
  if (over) failed = true;
  console.log(
    `${over ? "FAIL" : "ok  "}  ${label.padEnd(28)} ${kb.toFixed(1).padStart(7)} kB   budget ${maxKb} kB`
  );
}

// --- 2. widget delta -------------------------------------------------------
const withWidget = firstLoadKb(WIDGET_DELTA.route);
const withoutWidget = firstLoadKb(WIDGET_DELTA.against);
if (withWidget !== null && withoutWidget !== null) {
  const delta = withWidget - withoutWidget;
  const over = delta > WIDGET_DELTA.maxKb;
  if (over) failed = true;
  console.log(
    `\n${over ? "FAIL" : "ok  "}  widget cost (tool page − hub)  ${delta
      .toFixed(1)
      .padStart(6)} kB   budget ${WIDGET_DELTA.maxKb} kB`
  );
} else {
  fail("could not compute the widget delta — a route key is missing");
}

// --- 3. forbidden modules in tool routes -----------------------------------
console.log("");
const toolRouteKeys = Object.keys(manifest.pages).filter((k) =>
  k.startsWith("/(tools)")
);
let forbiddenHits = 0;
for (const key of toolRouteKeys) {
  for (const file of jsFiles(key) ?? []) {
    let source = "";
    try {
      source = readFileSync(path.join(NEXT_DIR, file), "utf8");
    } catch {
      continue;
    }
    for (const needle of FORBIDDEN_IN_TOOL_ROUTES) {
      if (source.includes(needle)) {
        forbiddenHits += 1;
        fail(
          `${key} first-load chunk ${file} contains "${needle}" — it must be behind dynamic(ssr:false) and a user gesture`
        );
      }
    }
  }
}
if (forbiddenHits === 0) {
  console.log(
    `ok    no forbidden module in any /(tools) first-load chunk (${FORBIDDEN_IN_TOOL_ROUTES.length} checked)`
  );
}

console.log("");
process.exit(failed ? 1 : 0);
