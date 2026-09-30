import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MetaPill } from "@/components/meta-pill";
import { formatPostDate, ymdToIso } from "@/lib/blog/dates";
import { BLOG_FEED_TYPES, OG_USES_COVER, postUrl } from "@/lib/blog/meta";
import { getNeighbours, getPost, getPostSlugs } from "@/lib/blog/posts";
import { POST_MAIN_ID, renderPostBody } from "@/lib/blog/render";
import { blogPostingJsonLd } from "@/lib/blog/structured-data";
import { jsonLdHtml } from "@/lib/json-ld";
import { ogImageUrl } from "@/lib/og";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Every post is generated at build from content/blog, and nothing else is
// served: an unknown slug is a 404 without rendering (dynamicParams = false),
// and reading the request fails the build (dynamic = "error"). No revalidate:
// publishing is a deploy. An empty blog builds with no params.
export const dynamic = "error";
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return getPostSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = getPost(params.slug);
  if (!post) {
    return { title: "Post not found", robots: { index: false } };
  }
  const url = postUrl(post.slug);
  const cover = post.cover ? post.images[post.cover] : undefined;
  // The /og PNG card unless OG_USES_COVER says a WebP cover has been checked
  // on the networks that matter (src/lib/blog/meta.ts).
  const og =
    OG_USES_COVER && cover
      ? {
          url: `${SITE_URL}${cover.src}`,
          width: cover.width,
          height: cover.height,
          alt: post.coverAlt ?? post.title,
          type: "image/webp",
        }
      : { url: ogImageUrl("blog", post.title), width: 1200, height: 630, alt: post.title };

  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: url, types: BLOG_FEED_TYPES },
    // Both objects replace the root layout's outright rather than merging, so
    // the site name, locale and creator are restated, as /blog does.
    openGraph: {
      title: post.title,
      description: post.summary,
      url,
      type: "article",
      siteName: `${SITE_NAME} Portfolio`,
      locale: "en_US",
      publishedTime: ymdToIso(post.publishedAt),
      modifiedTime: ymdToIso(post.updatedAt ?? post.publishedAt),
      authors: [SITE_NAME],
      tags: post.tags,
      images: [og],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
      creator: "@kanchana404",
      images: [{ url: og.url, alt: og.alt }],
    },
  };
}

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPost(params.slug);
  if (!post) notFound();
  const { previous, next } = getNeighbours(post.slug);
  const knownSlugs = new Set(getPostSlugs());
  const cover = post.cover ? post.images[post.cover] : undefined;

  // The one landmark the post sits in; the heading ids stay clear of its id.
  return (
    <main id={POST_MAIN_ID}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(blogPostingJsonLd(post)) }}
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
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <time dateTime={post.publishedAt} className="tabular-nums">
            {formatPostDate(post.publishedAt)}
          </time>
          {post.updatedAt && (
            <span className="tabular-nums">
              {"· Updated "}
              <time dateTime={post.updatedAt}>{formatPostDate(post.updatedAt)}</time>
            </span>
          )}
          {post.kind === "digest" && <MetaPill>Weekly digest</MetaPill>}
        </p>
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

      {cover && (
        // A plain <img>: next/image would add its client runtime to this
        // budgeted route. The file's own width and height reserve the box,
        // and it is the likely LCP element, so it loads eagerly.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover.src}
          alt={post.coverAlt ?? ""}
          width={cover.width}
          height={cover.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="mb-8 h-auto w-full rounded-xl border border-border bg-muted"
        />
      )}

      <article className="prose max-w-full text-pretty font-sans leading-relaxed text-muted-foreground dark:prose-invert">
        {renderPostBody(post, knownSlugs)}
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
    </main>
  );
}
