"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { WidgetSlug } from "@/lib/tools/widget-slugs";

// Nothing from `./widget-frame` is imported here on purpose: it uses `cn()`,
// which is clsx + tailwind-merge, and tailwind-merge alone is ~21 kB of client
// JavaScript. It stays on the server side of the boundary, in `ToolShell`.

/**
 * Slug → widget, one code-split chunk each.
 *
 * ## Why this is a Client Component
 *
 * `/tools/[slug]` is a single dynamic route, so its module graph is identical
 * for all seventeen tools. When the map lived in a Server Component, every
 * widget referenced from it landed in that route's client chunk regardless of
 * which tool was rendering — a visitor to the percentage calculator downloaded
 * the JWT decoder, the colour converter and fifteen others.
 *
 * That was tolerable at twelve small widgets (15.1 kB) and stopped being
 * tolerable at seventeen (27.5 kB), which broke the bundle budget exactly as its
 * tripwire predicted. The cost grows linearly with the catalogue and the
 * catalogue is capped at thirty.
 *
 * `next/dynamic` does nothing useful inside a Server Component — RSC resolves
 * client references eagerly, so it measured marginally *worse* for the wrapper
 * it added. Inside a Client Component it does what it says: webpack emits one
 * async chunk per widget and the browser fetches only the one it needs.
 *
 * ## Why the widget is still in the server-rendered HTML
 *
 * `ssr` is left at its default of `true`, so each widget still renders to static
 * HTML during prerender and a crawler — or anyone with JavaScript off — sees the
 * real tool rather than a spinner. That is non-negotiable on a platform whose
 * bottleneck is getting indexed, and `tests/browser/all-tools.spec.ts` asserts
 * it with JavaScript disabled for every tool in the registry.
 *
 * `ssr: false` would break that, and would also throw here if this file were
 * ever imported by a Server Component.
 *
 * ## Adding a widget
 *
 * Add the slug to `WIDGET_SLUGS` and the component here. The `Record` is typed
 * over the slug union, so doing one without the other is a compile error, and
 * `widget-slugs.ts` separately cross-checks the list against the registry at
 * build time.
 */
const TOOL_WIDGETS: Record<WidgetSlug, ComponentType> = {
  // calculators
  "percentage-calculator": dynamic(
    () => import("./widgets/percentage-calculator")
  ),
  "loan-calculator": dynamic(() => import("./widgets/loan-calculator")),
  "compound-interest-calculator": dynamic(
    () => import("./widgets/compound-interest-calculator")
  ),
  // text
  "word-counter": dynamic(() => import("./widgets/word-counter")),
  "case-converter": dynamic(() => import("./widgets/case-converter")),
  "text-diff-checker": dynamic(() => import("./widgets/text-diff")),
  // developer
  "json-formatter": dynamic(() => import("./widgets/json-formatter")),
  "base64-encoder-decoder": dynamic(() => import("./widgets/base64-converter")),
  "uuid-generator": dynamic(() => import("./widgets/uuid-generator")),
  "hash-generator": dynamic(() => import("./widgets/hash-generator")),
  "url-encoder-decoder": dynamic(() => import("./widgets/url-encoder")),
  "unix-timestamp-converter": dynamic(
    () => import("./widgets/timestamp-converter")
  ),
  "jwt-decoder": dynamic(() => import("./widgets/jwt-decoder")),
  "password-generator": dynamic(() => import("./widgets/password-generator")),
  "csv-to-json-converter": dynamic(() => import("./widgets/csv-json-converter")),
  // image
  "aspect-ratio-calculator": dynamic(
    () => import("./widgets/aspect-ratio-calculator")
  ),
  "color-converter": dynamic(() => import("./widgets/color-converter")),
};

export default function ToolWidget({ slug }: { slug: string }) {
  const Widget = TOOL_WIDGETS[slug as WidgetSlug];

  // Unreachable: widget-slugs.ts throws at module scope if a buildable tool has
  // no widget, so the build fails before this can render. Kept because an
  // indexable page with a silent hole in it is worse than an obvious one.
  if (!Widget) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        This tool is being rebuilt and will be back shortly.
      </p>
    );
  }

  return <Widget />;
}
