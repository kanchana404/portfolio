import { buildRssXml } from "@/lib/blog/feed";
import { getAllPosts } from "@/lib/blog/posts";

/**
 * The blog's RSS feed, generated once at build from content/blog.
 *
 * At /blog/rss.xml because it covers only the blog. A static folder wins over
 * the sibling [slug], and a slug can never contain a dot, so no post can take
 * this path. Layouts do not wrap route handlers, and the middleware matcher
 * covers /tools only. The Node runtime (the default) is required: the loader
 * reads files at build.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildRssXml(getAllPosts()), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // The same cadence as the tools sitemap. A new post is a new deploy,
      // which replaces this response anyway.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
