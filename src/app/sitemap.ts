import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";
import { connectToDatabase } from "../../db";
import Blog from "../../db/models/Blog";

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
  ];

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
    // static routes rather than failing sitemap generation.
    console.error("sitemap: could not enumerate blog posts", error);
  }

  return [...staticRoutes, ...postRoutes];
}
