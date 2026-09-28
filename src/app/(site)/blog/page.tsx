import { DATA } from "@/data/resume";
import { formatDate } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase } from "@db";
import Blog from "@db/models/Blog";
import { cssBlurFade } from "@/lib/css-blur-fade";
import { jsonLdHtml } from "@/lib/json-ld";
import { ogImageUrl } from "@/lib/og";

// No `revalidate` export: the page reads searchParams (?page=), so it renders
// per request and an ISR window would never apply.

const OG_TITLE = "Blog | Kavitha Kanchana";
const OG_DESCRIPTION =
  "Articles on software development, SaaS engineering, and building with Next.js & React.";
// Declaring openGraph here replaces the (site) route's inherited og:image,
// so the card image, site name and locale have to be restated, and twitter
// needs its own title or it keeps the homepage's.
const OG_IMAGE = ogImageUrl("blog", "Blog");

export const metadata: Metadata = {
  title: "Software Development & SaaS Engineering Blog",
  description:
    "Articles by Kavitha Kanchana on software development, building SaaS products, scalable architecture, full-stack development, and shipping with Next.js and React.",
  alternates: { canonical: `${DATA.url}/blog` },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: `${DATA.url}/blog`,
    type: "website",
    siteName: `${DATA.name} Portfolio`,
    locale: "en_US",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: OG_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    // Restated: a route's twitter object replaces the root layout's outright.
    creator: "@kanchana404",
    images: [{ url: OG_IMAGE, alt: OG_TITLE }],
  },
};

const BLOGS_PER_PAGE = 6;
const BLUR_FADE_DELAY = 0.04;

/**
 * The template's BlurFade entrance, done in CSS (lib/css-blur-fade.ts). The
 * motion library costs ~37 kB gzipped in this route's budgeted first load,
 * and a one-shot fade on a static list needs no JS.
 */
const fade = (delay: number) => cssBlurFade({ delay });

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
    // Only what the list shows. Without the projection every request pulled
    // the full Markdown body of every post to render titles and dates.
    const posts = await Blog.find({ isPublished: true })
      .sort({ publishedAt: -1 })
      .select("title slug excerpt featuredImage generatedImageUrl tags author publishedAt")
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
  const totalPages = Math.max(1, Math.ceil(posts.length / BLOGS_PER_PAGE));
  // Clamped at both ends: a ?page past the last one shows the last page
  // rather than "No blog posts yet" next to a non-zero post count.
  const currentPage = Math.min(
    totalPages,
    Math.max(1, parseInt(searchParams.page || "1", 10) || 1)
  );
  const start = (currentPage - 1) * BLOGS_PER_PAGE;
  const currentPosts = posts.slice(start, start + BLOGS_PER_PAGE);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${DATA.url}/blog#collection`,
        url: `${DATA.url}/blog`,
        name: "Blog | Kavitha Kanchana",
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

  // Layout after the Magic UI portfolio template's blog index: a title with a
  // post count, then a numbered list of titles and dates, then pagination.
  const pagerClass =
    "flex h-8 w-fit items-center justify-center rounded-lg border border-border px-2 text-sm";

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      <section id="blog">
        <div {...fade(BLUR_FADE_DELAY)}>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">
            {"Blog "}
            <span className="ml-1 rounded-md border border-border bg-card px-2 py-1 text-sm font-normal text-muted-foreground">
              {`${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
            </span>
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Notes on software development, building SaaS products and shipping
            with Next.js.
          </p>
        </div>

        {currentPosts.length > 0 ? (
          <>
            <ol className="flex flex-col gap-5">
              {currentPosts.map((post, id) => {
                const indexNumber = start + id + 1;
                return (
                  <li key={post.slug}>
                    <div {...fade(BLUR_FADE_DELAY * 3 + id * 0.05)}>
                      <Link
                        className="group flex cursor-pointer items-start gap-x-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        href={`/blog/${post.slug}`}
                      >
                        <span className="mt-[5px] font-mono text-xs font-medium tabular-nums" aria-hidden>
                          {String(indexNumber).padStart(2, "0")}.
                        </span>
                        <div className="flex flex-1 flex-col gap-y-2">
                          <p className="text-lg font-medium tracking-tight">
                            <span className="transition-colors group-hover:text-foreground">
                              {post.title}
                              <ChevronRight
                                className="ml-1 inline-block size-4 -translate-x-2 stroke-[3] text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                                aria-hidden
                              />
                            </span>
                          </p>
                          {post.publishedAt && (
                            <time dateTime={post.publishedAt} className="text-xs text-muted-foreground">
                              {formatDate(post.publishedAt)}
                            </time>
                          )}
                        </div>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ol>

            {totalPages > 1 && (
              <div {...fade(BLUR_FADE_DELAY * 4)}>
                <nav
                  aria-label="Blog pagination"
                  className="mt-8 flex flex-row items-center justify-between gap-3"
                >
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2 sm:justify-end">
                    {currentPage > 1 ? (
                      <Link
                        href={`/blog?page=${currentPage - 1}`}
                        className={`${pagerClass} transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                      >
                        Previous
                      </Link>
                    ) : (
                      <span className={`${pagerClass} cursor-not-allowed opacity-50`} aria-disabled>
                        Previous
                      </span>
                    )}
                    {currentPage < totalPages ? (
                      <Link
                        href={`/blog?page=${currentPage + 1}`}
                        className={`${pagerClass} transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                      >
                        Next
                      </Link>
                    ) : (
                      <span className={`${pagerClass} cursor-not-allowed opacity-50`} aria-disabled>
                        Next
                      </span>
                    )}
                  </div>
                </nav>
              </div>
            )}
          </>
        ) : (
          <div {...fade(BLUR_FADE_DELAY * 2)}>
            <div className="flex flex-col items-center justify-center rounded-xl border border-border px-4 py-12">
              <p className="text-center text-muted-foreground">
                No blog posts yet. Check back soon!
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
