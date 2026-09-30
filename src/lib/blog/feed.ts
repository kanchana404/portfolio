import { xmlText } from "../xml";
import { ymdToRfc822 } from "./dates";
import {
  BLOG_DESCRIPTION,
  BLOG_FEED_URL,
  BLOG_NAME,
  BLOG_URL,
  postUrl,
} from "./meta";
import type { PostMeta } from "./validate";

/**
 * The blog's RSS 2.0 feed, served at /blog/rss.xml.
 *
 * Items carry the summary only, not the post, so readers come to the site.
 * Nothing depends on the clock: lastBuildDate is the newest post date, so a
 * deploy with no content change serves a byte-identical feed. A channel with
 * no items is valid RSS, which is what an empty blog serves.
 *
 * `posts` arrive newest first, as getAllPosts returns them.
 */
export function buildRssXml(posts: PostMeta[], { limit = 50 }: { limit?: number } = {}): string {
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>${xmlText(BLOG_NAME)}</title>`,
    `    <link>${xmlText(BLOG_URL)}</link>`,
    `    <description>${xmlText(BLOG_DESCRIPTION)}</description>`,
    `    <language>en</language>`,
    `    <atom:link href="${xmlText(BLOG_FEED_URL)}" rel="self" type="application/rss+xml"/>`,
  ];

  const newest = posts
    .map((post) => post.updatedAt ?? post.publishedAt)
    .reduce<string | undefined>((max, date) => (max === undefined || date > max ? date : max), undefined);
  if (newest) lines.push(`    <lastBuildDate>${xmlText(ymdToRfc822(newest))}</lastBuildDate>`);

  for (const post of posts.slice(0, limit)) {
    const url = xmlText(postUrl(post.slug));
    lines.push(
      `    <item>`,
      `      <title>${xmlText(post.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${xmlText(ymdToRfc822(post.publishedAt))}</pubDate>`,
      `      <description>${xmlText(post.summary)}</description>`,
      ...post.tags.map((tag) => `      <category>${xmlText(tag)}</category>`),
      `    </item>`
    );
  }

  lines.push(`  </channel>`, `</rss>`, ``);
  return lines.join("\n");
}
