import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";
import { TOOLS_SECTION_LIVE } from "@/lib/tools/section-flag";

export default function robots(): MetadataRoute.Robots {
  const base = DATA.url.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      // `/` alone already permits everything these name explicitly. They are
      // listed anyway so that a future `disallow` cannot silently swallow the
      // two surfaces the whole programme depends on: the tools tree, and the
      // /og image endpoint that every social preview resolves through. A
      // more-specific `allow` wins over a broader `disallow` in every major
      // crawler, so this is a guard rail rather than decoration.
      allow: TOOLS_SECTION_LIVE ? ["/", "/tools", "/og"] : ["/", "/og"],
      // Only block private/admin surfaces. Public read endpoints under /api
      // (github contributions/repos, blogs) stay crawlable so client islands
      // and structured data referencing them aren't blocked.
      //
      // `/api/debug` and `/publish-blog` were removed from this list when those
      // routes were deleted — they were unauthenticated, and naming a private
      // path here advertises it to anyone reading robots.txt. This list is
      // crawler etiquette, never an access control; `requireAdmin()` is.
      //
      // `/tools` is deliberately NOT disallowed while the section is retired,
      // even though nothing there is worth crawling. The 410 *is* the removal
      // signal, and a crawler told not to fetch the URL never sees it — the
      // pages would sit in the index as "Indexed, though blocked by robots.txt"
      // indefinitely. Blocking is the slower way to disappear. Let Google fetch
      // the 410 once and drop them.
      disallow: ["/admin", "/api/admin"],
    },
    // Both are declared. The tools segment duplicates URLs that are already in
    // the main sitemap on purpose: Search Console reports indexation per
    // sitemap, so a separate submission is the only way to measure the tools
    // cohort on its own — which is what Gate 1 asks for.
    sitemap: [`${base}/sitemap.xml`, `${base}/sitemap-tools.xml`],
    host: base,
  };
}
