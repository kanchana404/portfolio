import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = DATA.url.replace(/\/$/, "");
  const now = new Date();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${base}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
