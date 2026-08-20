import { buildableTools } from "./registry";

/**
 * Every slug that has a widget.
 *
 * Deliberately just strings, in a module with no React in it. Two consumers
 * need this list and neither may pull the other's dependencies in:
 *
 * - `src/components/tools/tool-widget.tsx` is a Client Component and keys its
 *   dynamic-import map off this type, so a missing entry is a compile error.
 * - This module cross-checks the list against the registry at build time, which
 *   needs the registry — and the registry must never be reachable from client
 *   code, because it carries every tool's copy. Pulling ~17 tools' prose into
 *   the browser bundle would cost far more than the widgets ever did.
 *
 * The `as const` is load-bearing: it produces the union that makes the widget
 * map exhaustive.
 */
export const WIDGET_SLUGS = [
  "percentage-calculator",
  "loan-calculator",
  "word-counter",
  "case-converter",
  "text-diff-checker",
  "json-formatter",
  "base64-encoder-decoder",
  "hash-generator",
  "url-encoder-decoder",
  "jwt-decoder",
  "password-generator",
  "csv-to-json-converter",
  "aspect-ratio-calculator",
  "srt-to-vtt",
  "uuid-generator",
  "timestamp-converter",
  "cron-explainer",
  "number-base-converter",
  "lorem-ipsum-generator",
  "line-cleaner",
  "date-difference",
  "data-size-converter",
  "qr-code-generator",
  "image-resizer",
  "pdf-to-text",
  "pdf-to-images",
  "regex-tester",
  "html-entity-converter",
  "chmod-calculator",
  // Served by the shared image-converter widget; see
  // `@/lib/tools/image/spec` for what each one converts.
  "image-converter",
] as const;

export type WidgetSlug = (typeof WIDGET_SLUGS)[number];

const REGISTERED = new Set<string>(WIDGET_SLUGS);

export function hasWidget(slug: string): slug is WidgetSlug {
  return REGISTERED.has(slug);
}

/**
 * Build-time completeness check.
 *
 * A registry entry with no widget renders a tool page with copy and an empty
 * hole where the tool should be — worse than a build failure, because it is
 * indexable. Runs at module scope so `next build` catches it while prerendering.
 */
const missing = buildableTools()
  .map((t) => t.slug)
  .filter((slug) => !REGISTERED.has(slug));

if (missing.length > 0) {
  throw new Error(
    `Tools with no widget: ${missing.join(", ")}.\nAdd each slug to ` +
      `WIDGET_SLUGS in src/lib/tools/widget-slugs.ts and its component to ` +
      `TOOL_WIDGETS in src/components/tools/tool-widget.tsx.`
  );
}

const orphaned = WIDGET_SLUGS.filter(
  (slug) => !buildableTools().some((t) => t.slug === slug)
);

if (orphaned.length > 0) {
  throw new Error(
    `Widgets registered with no matching registry entry: ${orphaned.join(", ")}.` +
      `\nEither add the tool to the registry or remove the widget — an ` +
      `unreferenced widget is dead code that still ships.`
  );
}

/**
 * Slugs whose widget is code-split behind `dynamic(..., { ssr: false })`.
 *
 * ADR 0003 permits this for one reason only — a widget carrying WASM or a large
 * parser, whose weight lands on every other tool page for nothing — and demands
 * a `<WidgetSkeleton>` reserving its settled height in exchange, because with
 * `ssr: false` there is no server markup to lose and therefore no gap to shift
 * through.
 *
 * The list exists so the browser suite can assert the *right* guarantee per
 * tool instead of one loose guarantee for all of them: a server-rendered widget
 * must put real text in the static HTML, while a lazy one must instead reserve a
 * non-zero height. Without this split the static-HTML test passes on the
 * `sr-only` heading alone, which is what it was doing.
 */
export const LAZY_WIDGET_SLUGS: readonly string[] = ["image-converter", "srt-to-vtt"];

export function isLazyWidget(slug: string): boolean {
  return LAZY_WIDGET_SLUGS.includes(slug);
}
