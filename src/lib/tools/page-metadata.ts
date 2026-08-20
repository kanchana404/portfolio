import type { Metadata } from "next";
import { ogImageUrl } from "@/lib/og";
import { toolUrl } from "@/lib/tools/jsonld";
import { getTool } from "@/lib/tools/registry";

/**
 * The `<head>` for one tool page, derived entirely from its registry entry.
 *
 * Extracted from the old `[slug]` route when tool pages became one route each.
 * That split exists for a measured reason: with a single dynamic route, every
 * tool page shipped every widget, because they all resolve through one module
 * graph. One route per tool ships one widget, which took a page from 127 kB of
 * first-load JavaScript to 99.4 kB and, more importantly, stopped that number
 * growing with the catalogue.
 *
 * The cost of that split is twenty-plus near-identical route files, and the
 * mitigation is that they contain almost nothing: this function, the widget
 * import, and the shell. Everything a person would get wrong by hand lives
 * here, once. `tests/tools-routes.test.ts` asserts the files and the registry
 * cannot drift apart.
 */
export function toolMetadata(slug: string): Metadata {
  const tool = getTool(slug);
  if (!tool) return { title: "Tool not found", robots: { index: false } };

  const url = toolUrl(tool.slug);
  const image = ogImageUrl("tool", tool.title);

  // `stable` is the only indexable state. `beta` and `deprecated` are followed
  // so link equity still flows through them, but kept out of the index — and
  // out of the sitemap, which `sitemap.ts` enforces from the same field.
  const indexable = tool.status === "stable";

  return {
    // The root layout's template appends " | Kavitha Kanchana"; the validator
    // caps `metaTitle` so the rendered title survives that.
    title: tool.metaTitle,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: url },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title: tool.metaTitle,
      description: tool.description,
      url,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: tool.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: tool.metaTitle,
      description: tool.description,
      images: [image],
    },
  };
}
