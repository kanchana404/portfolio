import { SITE_NAME, SITE_URL } from "../site";

/**
 * The blog's names, copy and URLs, said once. The index metadata, its JSON-LD,
 * the RSS channel and the empty state all read from here. JSX-free and fs-free
 * for the same reason as src/lib/site.ts, so the root layout can import it.
 */

export const BLOG_PATH = "/blog";
export const BLOG_URL = `${SITE_URL}${BLOG_PATH}`;

export const BLOG_FEED_PATH = "/blog/rss.xml";
export const BLOG_FEED_URL = `${SITE_URL}${BLOG_FEED_PATH}`;

export const BLOG_NAME = `${SITE_NAME}: Blog`;

/** Rendered as "AI and Web Development Blog | Kavitha Kanchana" by the root layout's title template. */
export const BLOG_TITLE = "AI and Web Development Blog";

export const BLOG_DESCRIPTION =
  "A weekly digest of AI and developer news, with my own take on each item, plus notes from what I build with Next.js and React.";

export const BLOG_OG_DESCRIPTION =
  "A weekly AI and developer news digest with my own take on each item, plus notes from what I build.";

export const BLOG_SUBTITLE =
  "A weekly digest of AI and developer news, with my take on each item. Plus notes from what I build.";

/**
 * For `Metadata.alternates.types`. A route's `alternates` replaces the root
 * layout's outright, so every page that declares a canonical restates this.
 */
export const BLOG_FEED_TYPES = {
  "application/rss+xml": [{ url: BLOG_FEED_PATH, title: BLOG_NAME }],
};

/**
 * The one switch for a post's og:image. While false, a post shares the proven
 * `/og` PNG card even when it has a WebP cover; JSON-LD lists the cover either
 * way. Flip it only after a WebP og:image has been checked on LinkedIn (Post
 * Inspector) and X.
 */
export const OG_USES_COVER: boolean = false;

/** Absolute URL of a post. */
export function postUrl(slug: string): string {
  return `${BLOG_URL}/${slug}`;
}
