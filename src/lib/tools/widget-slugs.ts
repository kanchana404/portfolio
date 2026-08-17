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
