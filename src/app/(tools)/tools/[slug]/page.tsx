import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolShell } from "@/components/tools/tool-shell";
import { ogImageUrl } from "@/lib/og";
import { toolUrl } from "@/lib/tools/jsonld";
import { buildableTools, getTool } from "@/lib/tools/registry";

/**
 * Only registry slugs exist. Anything else is a 404 served from the CDN with
 * zero function invocations — which is what stops a scraper walking
 * `/tools/<random>` from becoming a bill.
 */
export const dynamicParams = false;

/**
 * Belt and braces. If someone later introduces a dynamic API into this subtree —
 * a `cookies()` call, a `searchParams` read — the build fails loudly instead of
 * silently converting every tool page from a CDN file into a lambda.
 */
export const dynamic = "force-static";

export function generateStaticParams(): Array<{ slug: string }> {
  // `draft` tools are excluded, so a half-finished tool 404s in production
  // rather than being crawlable at a guessable URL.
  return buildableTools().map((tool) => ({ slug: tool.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const tool = getTool(params.slug);
  if (!tool) return { title: "Tool not found", robots: { index: false } };

  const url = toolUrl(tool.slug);
  const image = ogImageUrl("tool", tool.title);

  // `stable` is the only indexable state. `beta` and `deprecated` are followed
  // so link equity still flows through them, but kept out of the index — and out
  // of the sitemap, which `sitemap.ts` enforces from the same `status` field.
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

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = getTool(params.slug);
  // Unreachable with `dynamicParams = false`, but it is what narrows the type
  // and it is the correct behaviour if that flag ever changes.
  if (!tool) notFound();
  return <ToolShell tool={tool} />;
}
