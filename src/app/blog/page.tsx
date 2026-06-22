import { DATA } from "@/data/resume";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase } from "../../../db";
import Blog from "../../../db/models/Blog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog — Software Development & SaaS Engineering",
  description:
    "Articles by Kavitha Kanchana on software development, building SaaS products, scalable architecture, full-stack development, and shipping with Next.js and React.",
  alternates: { canonical: `${DATA.url}/blog` },
  openGraph: {
    title: "Blog — Kavitha Kanchana",
    description:
      "Articles on software development, SaaS engineering, and building with Next.js & React.",
    url: `${DATA.url}/blog`,
    type: "website",
  },
};

const BLOGS_PER_PAGE = 6;

interface PostDoc {
  title: string;
  slug: string;
  excerpt: string;
  featuredImage?: string;
  generatedImageUrl?: string;
  tags?: string[];
  author?: string;
  publishedAt?: string;
}

async function getPosts(): Promise<PostDoc[]> {
  try {
    await connectToDatabase();
    const posts = await Blog.find({ isPublished: true })
      .sort({ publishedAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(posts));
  } catch (error) {
    console.error("blog index: could not load posts", error);
    return [];
  }
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const posts = await getPosts();
  const currentPage = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(posts.length / BLOGS_PER_PAGE));
  const start = (currentPage - 1) * BLOGS_PER_PAGE;
  const currentPosts = posts.slice(start, start + BLOGS_PER_PAGE);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${DATA.url}/blog#collection`,
        url: `${DATA.url}/blog`,
        name: "Blog — Kavitha Kanchana",
        description:
          "Articles on software development, SaaS engineering, and building with Next.js.",
        isPartOf: { "@id": `${DATA.url}/#website` },
        about: { "@id": `${DATA.url}/#person` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: DATA.url },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: `${DATA.url}/blog`,
          },
        ],
      },
    ],
  };

  return (
    <main className="flex flex-col min-h-[100dvh] space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section id="hero">
        <div className="mx-auto w-full max-w-2xl space-y-4 text-center">
          <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
            Blog &amp; Insights
          </div>
          <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
            Software Development &amp; SaaS Engineering
          </h1>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl">
            Exploring software development, building SaaS products, scalable
            architecture, and shipping with Next.js. Insights from my journey
            as a software engineer and founder.
          </p>
        </div>
      </section>

      <section id="blog-posts">
        <div className="space-y-8 w-full py-6 max-w-2xl mx-auto">
          {currentPosts.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <h2 className="text-xl font-semibold text-muted-foreground">
                No posts yet
              </h2>
              <p className="text-muted-foreground">
                I&apos;m working on some great content. Check back soon!
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-6">
              {currentPosts.map((post) => {
                const cover = post.generatedImageUrl || post.featuredImage;
                return (
                  <li
                    key={post.slug}
                    className="border rounded-lg p-5 hover:shadow-md transition-shadow"
                  >
                    <article className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {post.publishedAt && (
                          <time dateTime={post.publishedAt}>
                            {new Date(post.publishedAt).toLocaleDateString(
                              "en-US",
                              { year: "numeric", month: "long", day: "numeric" }
                            )}
                          </time>
                        )}
                        <span>•</span>
                        <span>{post.author || "Kavitha Kanchana"}</span>
                      </div>
                      <h2 className="text-xl font-bold leading-tight">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="hover:underline"
                        >
                          {post.title}
                        </Link>
                      </h2>
                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground">
                          {post.excerpt}
                        </p>
                      )}
                      {cover && (
                        <Link href={`/blog/${post.slug}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cover}
                            alt={`${post.title} — article cover`}
                            className="w-full h-48 object-cover rounded-md"
                            loading="lazy"
                          />
                        </Link>
                      )}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {post.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Link
                        href={`/blog/${post.slug}`}
                        className="text-sm text-blue-500 hover:underline"
                      >
                        Read full article →
                      </Link>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Blog pagination"
              className="flex justify-center items-center gap-2 pt-4"
            >
              {currentPage > 1 && (
                <Link
                  href={`/blog?page=${currentPage - 1}`}
                  className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                >
                  Previous
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages && (
                <Link
                  href={`/blog?page=${currentPage + 1}`}
                  className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
      </section>

      <section id="contact" className="max-w-2xl mx-auto text-center">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to portfolio
        </Link>
      </section>
    </main>
  );
}
