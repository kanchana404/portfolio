import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";

export default function robots(): MetadataRoute.Robots {
  const base = DATA.url.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Only block private/admin surfaces. Public read endpoints under /api
      // (github contributions/repos, blogs) stay crawlable so client islands
      // and structured data referencing them aren't blocked.
      disallow: ["/admin", "/api/admin", "/api/debug", "/publish-blog"],
    },
    // Both are declared. The tools segment duplicates URLs that are already in
    // the main sitemap on purpose: Search Console reports indexation per
    // sitemap, so a separate submission is the only way to measure the tools
    // cohort on its own — which is what Gate 1 asks for.
    sitemap: [`${base}/sitemap.xml`, `${base}/sitemap-tools.xml`],
    host: base,
  };
}
