import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { MetaPill } from "@/components/meta-pill";
import { formatPostDate } from "@/lib/blog/dates";
import {
  BLOG_DESCRIPTION,
  BLOG_FEED_PATH,
  BLOG_FEED_TYPES,
  BLOG_OG_DESCRIPTION,
  BLOG_SUBTITLE,
  BLOG_TITLE,
  BLOG_URL,
} from "@/lib/blog/meta";
import { getAllPosts } from "@/lib/blog/posts";
import { blogIndexJsonLd } from "@/lib/blog/structured-data";
import { cssBlurFade } from "@/lib/css-blur-fade";
import { jsonLdHtml } from "@/lib/json-ld";
import { ogImageUrl } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

// Generated once at build from content/blog. "error" rather than
// force-static: reading the request (searchParams, headers) fails the build
// instead of quietly making the page dynamic.
export const dynamic = "error";

const OG_TITLE = `Blog | ${SITE_NAME}`;
// Declaring openGraph here replaces the (site) route's inherited og:image,
// so the card image, site name and locale have to be restated, and twitter
// needs its own title or it keeps the homepage's.
const OG_IMAGE = ogImageUrl("blog", "Blog");

export const metadata: Metadata = {
  title: BLOG_TITLE,
  description: BLOG_DESCRIPTION,
  alternates: { canonical: BLOG_URL, types: BLOG_FEED_TYPES },
  openGraph: {
    title: OG_TITLE,
    description: BLOG_OG_DESCRIPTION,
    url: BLOG_URL,
    type: "website",
    siteName: `${SITE_NAME} Portfolio`,
    locale: "en_US",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: OG_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: BLOG_OG_DESCRIPTION,
    // Restated: a route's twitter object replaces the root layout's outright.
    creator: "@kanchana404",
    images: [{ url: OG_IMAGE, alt: OG_TITLE }],
  },
};

const BLUR_FADE_DELAY = 0.04;

/**
 * The CSS entrance starts on a timer, not when a row scrolls into view
 * (lib/css-blur-fade.ts), so only the rows that can be on screen at load get
 * it. Later rows render without an entrance.
 */
const ANIMATED_ROWS = 8;

/**
 * The template's BlurFade entrance, done in CSS (lib/css-blur-fade.ts). The
 * motion library costs ~37 kB gzipped in this route's budgeted first load,
 * and a one-shot fade on a static list needs no JS.
 */
const fade = (delay: number) => cssBlurFade({ delay });

// Copied from the Contact section: underlined at rest, not only on hover,
// because link blue against the muted paragraph grey is 1.04:1 (1.14:1 dark),
// so colour alone does not mark it as a link (WCAG 1.4.1).
const LINK_CLASS =
  "rounded-sm text-link underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function BlogPage() {
  const posts = getAllPosts();

  // Layout after the Magic UI portfolio template's blog index: a title with a
  // post count, then a numbered list of titles and dates. One static list, no
  // pagination; past about 60 posts, add a static /blog/page/[n] ("page" is
  // already a reserved slug). Rows are plain <a>, not next/link, so the page
  // ships no router code and does not prefetch every post.
  return (
    <main className="flex min-h-[100dvh] flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(blogIndexJsonLd(posts)) }}
      />

      <section id="blog">
        <div {...fade(BLUR_FADE_DELAY)}>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">
            {posts.length > 0 ? "Blog " : "Blog"}
            {posts.length > 0 && (
              <span className="ml-1 rounded-md border border-border bg-card px-2 py-1 text-sm font-normal text-muted-foreground">
                {`${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
              </span>
            )}
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">{BLOG_SUBTITLE}</p>
        </div>

        {posts.length > 0 ? (
          <ol className="flex flex-col gap-5">
            {posts.map((post, index) => (
              <li key={post.slug}>
                <div {...(index < ANIMATED_ROWS ? fade(BLUR_FADE_DELAY * 3 + index * 0.05) : {})}>
                  <a
                    className="group flex cursor-pointer items-start gap-x-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    href={`/blog/${post.slug}`}
                  >
                    <span className="mt-[5px] font-mono text-xs font-medium tabular-nums" aria-hidden>
                      {String(index + 1).padStart(2, "0")}.
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
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <time dateTime={post.publishedAt} className="tabular-nums">
                          {formatPostDate(post.publishedAt)}
                        </time>
                        {post.kind === "digest" && <MetaPill>Digest</MetaPill>}
                      </p>
                    </div>
                  </a>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div {...fade(BLUR_FADE_DELAY * 2)}>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border px-4 py-12 text-center">
              <p className="text-muted-foreground">
                No posts yet. The first weekly digest is on its way.
              </p>
              <p className="text-sm text-muted-foreground">
                {"Follow along with the "}
                <a href={BLOG_FEED_PATH} className={LINK_CLASS}>
                  RSS feed
                </a>
                {"."}
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
