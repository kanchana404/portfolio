import type { ComponentType } from "react";
import PercentageCalculator from "@/components/tools/widgets/percentage-calculator";
import { buildableTools } from "./registry";

/**
 * Slug → widget.
 *
 * This map is the reason `ToolDef` carries no `Widget` field. The registry is
 * imported by the hub, both category routes, `sitemap.ts` and the validator's
 * own tests; if a React component reference lived on the registry type, every
 * one of those graphs would pull in every widget. With WASM-backed widgets
 * arriving in later sprints that is megabytes of pdf-lib and MediaPipe
 * resolvable from routes that render none of it, which blows the script budget
 * on all tool pages simultaneously.
 *
 * Only `/tools/[slug]` imports this module, so only that route pays for widgets.
 *
 * ## Adding a widget
 *
 * **Light widgets** (pure arithmetic, no WASM, no browser-only API) are imported
 * directly, as below. They render during static generation, so their markup is
 * in the HTML a crawler receives and there is no hydration layout shift.
 *
 * **Heavy widgets** must not be imported here directly. Give them a thin
 * `"use client"` wrapper module that performs its own
 * `dynamic(() => import("./thing"), { ssr: false, loading: … })`, and import
 * that wrapper. The indirection is not stylistic: `next/dynamic` with
 * `ssr: false` throws when it is evaluated inside a Server Component module, and
 * this map is imported by one. The wrapper's `loading` element must reserve the
 * final height — see `<WidgetFrame>` — or the 0.05 CLS budget fails.
 */
export const TOOL_WIDGETS: Record<string, ComponentType> = {
  "percentage-calculator": PercentageCalculator,
};

/**
 * Build-time completeness check.
 *
 * A registry entry with no widget renders a tool page with prose and an empty
 * hole where the tool should be — which is worse than a build failure, because
 * it is indexable. Runs at module scope so `next build` catches it while
 * prerendering.
 */
const missing = buildableTools()
  .map((t) => t.slug)
  .filter((slug) => !(slug in TOOL_WIDGETS));

if (missing.length > 0) {
  throw new Error(
    `Tools with no widget registered in src/lib/tools/widgets.ts: ${missing.join(
      ", "
    )}.\nEvery non-draft registry entry needs a matching entry in TOOL_WIDGETS.`
  );
}

const orphaned = Object.keys(TOOL_WIDGETS).filter(
  (slug) => !buildableTools().some((t) => t.slug === slug)
);

if (orphaned.length > 0) {
  throw new Error(
    `Widgets registered with no matching registry entry: ${orphaned.join(", ")}.` +
      `\nEither add the tool to src/lib/tools/registry.ts or remove the widget ` +
      `— an unreferenced widget is dead code that still ships.`
  );
}

export function getToolWidget(slug: string): ComponentType | undefined {
  return TOOL_WIDGETS[slug];
}
