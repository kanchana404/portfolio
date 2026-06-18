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
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
