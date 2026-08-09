import type { Metadata } from "next";
import Link from "next/link";
import { ogImageUrl } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";
import { HUB_URL, toolsHubJsonLd } from "@/lib/tools/jsonld";
import {
  activeCategories,
  getToolsByCategory,
  publicTools,
  toolsByRecency,
} from "@/lib/tools/registry";
import { CATEGORY_LABELS } from "@/lib/tools/types";
import { jsonLdHtml } from "@/lib/json-ld";

/**
 * The tools hub.
 *
 * The crawl entry point for every tool, and the page most likely to rank for
 * navigational "free online tools" queries from people who already know the
 * name.
 *
 * Note what this route does **not** import: `@/lib/tools/widgets`. The hub reads
 * the registry only, so no widget code is reachable from here — which is the
 * whole reason widgets live in a separate map rather than on `ToolDef`.
 */
export const dynamic = "force-static";

const HUB_TITLE = "Free Online Tools — No Signup";
const HUB_DESCRIPTION =
  "A small set of free tools I built and actually maintain: calculators, image " +
  "and PDF utilities. Most run entirely in your browser with no upload.";

export const metadata: Metadata = {
  title: HUB_TITLE,
  description: HUB_DESCRIPTION,
  alternates: { canonical: HUB_URL },
  openGraph: {
    title: HUB_TITLE,
    description: HUB_DESCRIPTION,
    url: HUB_URL,
    type: "website",
    images: [
      {
        url: ogImageUrl("tool", "Free online tools"),
        width: 1200,
        height: 630,
        alt: "Free online tools",
      },
    ],
  },
};

export default function ToolsHubPage() {
  const categories = activeCategories();
  const tools = toolsByRecency();
  const count = publicTools().length;

  /**
   * Link budget, kept under sixty by construction: 1 breadcrumb + at most 5
   * category chips + at most MAX_TOOLS cards + 1 profile link. A hub whose link
   * count grows unbounded dilutes the equity each tool receives and starts to
   * look like a directory. If this page ever needs pagination, the registry cap
   * is the thing to revisit first — not the pagination.
   */
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
          <li aria-current="page" className="text-foreground">
            Tools
          </li>
        </ol>
      </nav>

      <main id="main-content">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Free online tools
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {count === 1 ? "One tool" : `${count} tools`} I built because I needed
          them, kept online because other people did too. Most run entirely in
          your browser: no account, no upload, no watermark. I maintain these
          personally — if a number looks wrong, email me and I will fix it.
        </p>

        {categories.length > 1 ? (
          <nav aria-label="Tool categories" className="mt-6 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category}
                href={`/tools/category/${category}`}
                className="rounded-full border px-3 py-1 text-xs transition-colors hover:border-foreground/20"
              >
                {CATEGORY_LABELS[category]}{" "}
                <span className="text-muted-foreground">
                  {getToolsByCategory(category).length}
                </span>
              </Link>
            ))}
          </nav>
        ) : null}

        {tools.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {tools.map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="flex h-full flex-col rounded-lg border p-4 transition-colors hover:border-foreground/20"
                >
                  <span className="text-sm font-semibold">{tool.title}</span>
                  <span className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {tool.description}
                  </span>
                  <span className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[tool.category]}
                    {tool.compute === "browser" ? " · runs offline" : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Nothing published yet. Check back shortly.
          </p>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          Built by{" "}
          <Link href="/" className="underline underline-offset-2">
            {SITE_NAME}
          </Link>
          , software engineer in Sri Lanka.
        </p>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(toolsHubJsonLd(tools)),
        }}
      />
    </>
  );
}
