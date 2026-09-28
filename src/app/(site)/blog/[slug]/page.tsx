import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DATA } from "@/data/resume";
import { ogImageUrl } from "@/lib/og";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { connectToDatabase } from "@db";
import Blog from "@db/models/Blog";
import { jsonLdHtml } from "@/lib/json-ld";
import { isDeadImageUrl } from "@/lib/ideogram";
import { cache } from "react";

// ISR: prebuild known posts, render new ones on demand, refresh hourly.
export const revalidate = 3600;
export const dynamicParams = true;

interface PostDoc {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  generatedImageUrl?: string;
  tags?: string[];
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}

/**
 * The post, or null when no published post has this slug.
 *
 * A connection or query error is thrown, not turned into null. With ISR, null
 * becomes notFound(), and Next stores that 404 in the cache for the whole
 * revalidate window, so a passing database blip replaced live posts with
 * cached 404s. A thrown error keeps the last good page instead.
 *
 * Wrapped in cache() so the page and its metadata share one query.
 */
const getPost = cache(async (slug: string): Promise<PostDoc | null> => {
  await connectToDatabase();
  const post = await Blog.findOne({ slug, isPublished: true }).lean();
  return post ? JSON.parse(JSON.stringify(post)) : null;
});

/** The stored cover, unless it is missing or on a host that no longer answers. */
function storedImage(post: PostDoc): string | undefined {
  const img = post.generatedImageUrl || post.featuredImage;
  return isDeadImageUrl(img) ? undefined : img;
}

interface Neighbour {
  slug: string;
  title: string;
}

/**
 * The posts either side of this one in the index's order (newest first), for
 * the template's Previous / Next cards. A failed lookup only hides the cards.
 */
async function getNeighbours(
  slug: string
): Promise<{ previous: Neighbour | null; next: Neighbour | null }> {
  try {
    await connectToDatabase();
    const posts: Neighbour[] = JSON.parse(
      JSON.stringify(
        await Blog.find({ isPublished: true })
          .sort({ publishedAt: -1 })
          .select("slug title")
          .lean()
      )
    );
    const index = posts.findIndex((p) => p.slug === slug);
    if (index === -1) return { previous: null, next: null };
    return {
      previous: index > 0 ? posts[index - 1] : null,
      next: index < posts.length - 1 ? posts[index + 1] : null,
    };
  } catch (error) {
    console.error("getNeighbours error", error);
    return { previous: null, next: null };
  }
}

export async function generateStaticParams() {
  try {
    await connectToDatabase();
    const posts = await Blog.find({ isPublished: true }).select("slug").lean();
    return posts.map((p: any) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

function resolveImage(post: PostDoc): string {
  const img = storedImage(post);
  if (img) return img.startsWith("http") ? img : `${DATA.url}${img}`;
  // Built through the shared helper, never hand-assembled: `/og` now answers
  // with a one-year immutable cache, so the URL is the only invalidation
  // mechanism the card has. See `@/lib/og`.
  return ogImageUrl("blog", post.title);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) {
    return { title: "Blog Post Not Found", robots: { index: false } };
  }
  const url = `${DATA.url}/blog/${post.slug}`;
  const ogImage = resolveImage(post);
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    // Both objects replace the root layout's outright rather than merging, so
    // the site name, locale and creator are restated, as /blog does.
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      type: "article",
      siteName: `${DATA.name} Portfolio`,
      locale: "en_US",
      publishedTime: post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : undefined,
      modifiedTime: post.updatedAt
        ? new Date(post.updatedAt).toISOString()
        : undefined,
      authors: [DATA.name],
      images: [{ url: ogImage, alt: post.title }],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      creator: "@kanchana404",
      images: [{ url: ogImage, alt: post.title }],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPost(params.slug);
  if (!post) notFound();
  const { previous, next } = await getNeighbours(post.slug);

  const url = `${DATA.url}/blog/${post.slug}`;
  const imageUrl = storedImage(post);
  const absImage = resolveImage(post);
  const published = post.publishedAt
    ? new Date(post.publishedAt).toISOString()
    : undefined;
  const modified = post.updatedAt
    ? new Date(post.updatedAt).toISOString()
    : published;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#post`,
        headline: post.title,
        description: post.excerpt,
        image: absImage,
        url,
        mainEntityOfPage: url,
        datePublished: published,
        dateModified: modified,
        author: { "@id": `${DATA.url}/#person` },
        publisher: { "@id": `${DATA.url}/#person` },
        keywords: post.tags?.join(", "),
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
          {
            "@type": "ListItem",
            position: 3,
            name: post.title,
            item: url,
          },
        ],
      },
    ],
  };

  return (
    <section id="blog">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      {/*
        Header after the Magic UI portfolio template's post page. Plain <a>
        rather than next/link, on purpose: this route is the bundle budget's
        canary and imports no router code (scripts/check-bundle-budget.mjs).
      */}
      <div className="flex items-center justify-start gap-4">
        <a
          href="/blog"
          className="group mb-6 inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3 transition-transform group-hover:-translate-x-px" aria-hidden />
          Back to Blog
        </a>
      </div>
      <div className="flex flex-col gap-4">
        <h1 className="title text-3xl font-semibold leading-tight tracking-tighter md:text-4xl">
          {post.title}
        </h1>
        {post.publishedAt && (
          <p className="text-sm text-muted-foreground">
            <time dateTime={published}>{formatDate(post.publishedAt)}</time>
          </p>
        )}
      </div>
      <div className="my-6 flex w-full items-center" aria-hidden>
        <div
          className="h-px flex-1 bg-border"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
          }}
        />
      </div>

      {imageUrl && (
        <div className="relative mb-8 h-64 overflow-hidden rounded-xl border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${post.title}, article cover`}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <article className="prose max-w-full text-pretty font-sans leading-relaxed text-muted-foreground dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ node, ...props }) => {
              const isFeaturedImage =
                props.alt?.includes("Featured Image") ||
                props.src === imageUrl ||
                props.src === post.featuredImage ||
                props.src === post.generatedImageUrl;
              // Old posts carry via.placeholder.com images, which no longer load.
              if (isFeaturedImage || isDeadImageUrl(props.src)) {
                return null;
              }
              return (
                // Markdown supplies alt through props, which the rule cannot see.
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img {...props} className="my-8 h-auto w-full rounded-xl border" loading="lazy" />
              );
            },
            // Keep exactly one <h1> on the page (the post title above). Markdown
            // '#' headings are demoted one level so they never emit extra H1s.
            h1: ({ node, ...props }) => <h2 {...props} />,
            h2: ({ node, ...props }) => <h3 {...props} />,
            h3: ({ node, ...props }) => <h4 {...props} />,
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ),
            // Code blocks scroll sideways; keep Lenis off horizontal gestures there.
            pre: ({ node, ...props }) => <pre data-lenis-prevent-horizontal {...props} />,
          }}
        >
          {post.content}
        </ReactMarkdown>
      </article>

      {(previous || next) && (
        <nav aria-label="More posts" className="mt-12 max-w-2xl pt-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            {previous ? (
              <a
                href={`/blog/${previous.slug}`}
                className="group flex flex-1 flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:bg-accent/50"
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ChevronLeft className="size-3" aria-hidden />
                  Previous
                </span>
                <span className="whitespace-normal break-words text-sm font-medium transition-colors group-hover:text-foreground">
                  {previous.title}
                </span>
              </a>
            ) : (
              <div className="hidden flex-1 sm:block" />
            )}
            {next ? (
              <a
                href={`/blog/${next.slug}`}
                className="group flex flex-1 flex-col gap-1 rounded-lg border border-border p-4 text-right transition-colors hover:bg-accent/50"
              >
                <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  Next
                  <ChevronRight className="size-3" aria-hidden />
                </span>
                <span className="whitespace-normal break-words text-sm font-medium transition-colors group-hover:text-foreground">
                  {next.title}
                </span>
              </a>
            ) : (
              <div className="hidden flex-1 sm:block" />
            )}
          </div>
        </nav>
      )}
    </section>
  );
}
