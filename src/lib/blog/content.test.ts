import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { todayUtc } from "./dates";
import { readContentSnapshot } from "./posts";
import { renderPostBody } from "./render";
import { classifyHref, formatIssue, validateCollection, type ContentSnapshot } from "./validate";

/**
 * THE PUBLISH GATE over the real content/blog and public/blog.
 *
 * It runs in `pnpm test` (CI) and inside `pnpm build` on Vercel, so a post
 * with a TODO, a template placeholder, a broken link or image, or bad
 * frontmatter fails the deploy and the last good one stays live. The
 * build-time loader applies the same rules again for `pnpm build:only`.
 *
 * Every test here always registers, so an empty blog passes: vitest.config.mts
 * sets passWithNoTests to false, and vitest fails a suite with no tests.
 */

let snapshot: ContentSnapshot | undefined;
let readError: unknown;
try {
  snapshot = readContentSnapshot(process.cwd());
} catch (error) {
  readError = error;
}
const { posts, issues } = snapshot
  ? validateCollection(snapshot, todayUtc())
  : { posts: [], issues: [] };
const slugs = new Set(posts.map((post) => post.slug));

/** Attribute values come out of renderToStaticMarkup with & escaped. */
const decode = (value: string) => value.replace(/&amp;/g, "&");

describe("content/blog: the publish gate", () => {
  it("content/blog exists and holds only .md posts", () => {
    expect(readError, String(readError)).toBeUndefined();
    expect(
      snapshot?.otherContentEntries.filter((entry) => entry !== ".gitkeep"),
      "content/blog holds <slug>.md posts and its .gitkeep, nothing else"
    ).toEqual([]);
  });

  it("every post, image and file passes the content rules", () => {
    expect(issues.map(formatIssue), "nothing ships while any of these remain").toEqual([]);
  });

  it("every post renders, and every link and image in the output is allowed", () => {
    const problems: string[] = [];

    for (const post of posts) {
      let html: string;
      try {
        html = renderToStaticMarkup(renderPostBody(post, slugs));
      } catch (error) {
        problems.push(`${post.file}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      for (const [, raw] of html.matchAll(/<a\s[^>]*?href="([^"]*)"/g)) {
        const link = classifyHref(decode(raw), slugs);
        if (link.kind === "invalid") problems.push(`${post.file}: link ${raw}: ${link.reason}`);
      }

      for (const [tag] of html.matchAll(/<img\s[^>]*>/g)) {
        const src = decode(/\ssrc="([^"]*)"/.exec(tag)?.[1] ?? "");
        if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) {
          problems.push(`${post.file}: ${src} has no width or height`);
        }
        if (!Object.hasOwn(post.images, src)) problems.push(`${post.file}: ${src} is not in public/blog/${post.slug}/`);
      }

      for (const paragraph of html.split("<p>").slice(1)) {
        const end = paragraph.indexOf("</p>");
        if (paragraph.slice(0, end === -1 ? undefined : end).includes("<figure")) {
          problems.push(`${post.file}: a <figure> inside a <p>`);
        }
      }
    }

    expect(problems, "the rendered posts break the link or image policy").toEqual([]);
  });
});
