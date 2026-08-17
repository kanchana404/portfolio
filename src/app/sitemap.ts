import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";
import { connectToDatabase } from "@db";
import Blog from "@db/models/Blog";
import {
  activeCategories,
  isCategoryIndexable,
  publicTools,
} from "@/lib/tools/registry";
import { TOOLS_SECTION_LIVE } from "@/lib/tools/section-flag";

// Regenerate the sitemap hourly so newly published posts appear automatically.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = DATA.url.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    {
      url: `${base}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // The tools hub is listed only while the section is live. Advertising a URL
    // that answers 410 is the fastest way to earn a Search Console error.
    ...(TOOLS_SECTION_LIVE
      ? [
          {
            url: `${base}/tools`,
            lastModified: now,
            changeFrequency: "weekly" as const,
            priority: 0.9,
          },
        ]
      : []),
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  // Tools come from the registry — an in-memory array. No database round trip,
  // and no chance of a Mongo outage knocking tool URLs out of the sitemap.
  // `publicTools()` is `status === "stable"` only, so beta and deprecated tools
  // are excluded here exactly as they are excluded from the index by their
  // `robots` metadata. A sitemap listing a noindex URL is a Search Console
  // warning and burns crawl budget this site does not have.
  const toolRoutes: MetadataRoute.Sitemap = !TOOLS_SECTION_LIVE
    ? []
    : publicTools().map((tool) => ({
        url: `${base}/tools/${tool.slug}`,
        lastModified: new Date(`${tool.updatedAt}T00:00:00Z`),
        changeFrequency: "monthly",
        priority: 0.8,
      }));

  const categoryRoutes: MetadataRoute.Sitemap = !TOOLS_SECTION_LIVE
    ? []
    : activeCategories()
        .filter(isCategoryIndexable)
        .map((category) => ({
          url: `${base}/tools/category/${category}`,
          lastModified: now,
          changeFrequency: "monthly",
          priority: 0.5,
        }));

  let postRoutes: MetadataRoute.Sitemap = [];
  try {
    await connectToDatabase();
    const posts = await Blog.find({ isPublished: true })
      .select("slug updatedAt publishedAt")
      .lean();
    postRoutes = posts.map((p: any) => ({
      url: `${base}/blog/${p.slug}`,
      // publishedAt can be null in the schema — guard before using it.
      lastModified: p.updatedAt ?? p.publishedAt ?? now,
      changeFrequency: "monthly",
      priority: 0.7,
    }));
  } catch (error) {
    // Database unavailable (e.g. at build with no MONGODB_URI) — ship the
    // static and registry-derived routes rather than failing sitemap
    // generation. The tool URLs above are deliberately outside this try block
    // so they survive a database outage.
    console.error("sitemap: could not enumerate blog posts", error);
  }

  return [...staticRoutes, ...toolRoutes, ...categoryRoutes, ...postRoutes];
}
