import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";

export default function robots(): MetadataRoute.Robots {
  const base = DATA.url.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/publish-blog"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
