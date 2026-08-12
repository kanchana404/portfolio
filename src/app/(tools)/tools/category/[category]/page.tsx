import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME } from "@/lib/site";
import { categoryUrl, toolCategoryJsonLd } from "@/lib/tools/jsonld";
import {
  activeCategories,
  getToolsByCategory,
  isCategoryIndexable,
} from "@/lib/tools/registry";
import {
  CATEGORY_LABELS,
  TOOL_CATEGORIES,
  type ToolCategory,
} from "@/lib/tools/types";
import { jsonLdHtml } from "@/lib/json-ld";

/**
 * Category listings.
 *
 * The literal `category` segment is what avoids a `[slug]` / `[category]`
 * collision, and `"category"` being a reserved slug is what keeps it that way —
 * two independent defences, one of which fails the build.
 *
 * The non-obvious part is the thin-page guard. With one tool in a category this
 * page's entire content is a single link that also appears on the hub. Indexing
 * that is how a site accumulates the low-value pages that drag a whole domain's
 * quality assessment down. So it renders — breadcrumbs point at it — but carries
 * `noindex, follow` and stays out of the sitemap until the category has three
 * tools. `follow` matters: equity still flows through to the tools themselves.
 */
export const dynamicParams = false;
export const dynamic = "force-static";

function parseCategory(value: string): ToolCategory | undefined {
  return (TOOL_CATEGORIES as readonly string[]).includes(value)
    ? (value as ToolCategory)
    : undefined;
}

/** Only categories that actually contain a public tool get a page at all. */
export function generateStaticParams(): Array<{ category: string }> {
  return activeCategories().map((category) => ({ category }));
}

export function generateMetadata({
  params,
}: {
  params: { category: string };
}): Metadata {
  const category = parseCategory(params.category);
  if (!category) return { title: "Category not found", robots: { index: false } };

  const label = CATEGORY_LABELS[category];
  const url = categoryUrl(category);
  const count = getToolsByCategory(category).length;

  return {
    title: `${label} — Free and Browser-Based`,
    description:
      `${count} free ${label.toLowerCase()} built and maintained by ` +
      `${SITE_NAME}. No signup, no watermark, and most of them never upload ` +
      `your file anywhere.`,
    alternates: { canonical: url },
    robots: isCategoryIndexable(category)
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default function ToolCategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const category = parseCategory(params.category);
  if (!category) notFound();

  const tools = getToolsByCategory(category);
  if (tools.length === 0) notFound();

  const label = CATEGORY_LABELS[category];

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/tools" className="hover:text-foreground">
              Tools
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-foreground">
            {label}
          </li>
        </ol>
      </nav>

      <main id="main-content">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{label}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {tools.length} {tools.length === 1 ? "tool" : "tools"} in this category.
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={`/tools/${tool.slug}`}
                className="flex h-full flex-col rounded-lg border p-4 transition-colors hover:border-foreground/20"
              >
                <span className="text-sm font-semibold">{tool.title}</span>
                <span className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {tool.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs">
          <Link href="/tools" className="underline underline-offset-2">
            ← All tools
          </Link>
        </p>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(toolCategoryJsonLd(category, tools)),
        }}
      />
    </>
  );
}
