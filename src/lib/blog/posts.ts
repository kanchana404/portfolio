import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { todayUtc } from "./dates";
import {
  formatIssue,
  validateCollection,
  type ContentSnapshot,
  type Issue,
  type Post,
} from "./validate";

/**
 * The blog's only filesystem access: posts are `content/blog/<slug>.md` and
 * their images `public/blog/<slug>/*.webp`, read when the build runs, as
 * src/app/(site)/opengraph-image.tsx reads the headshot.
 *
 * Call it only from build-time paths: generateStaticParams and
 * generateMetadata on routes with `dynamicParams = false`, static page bodies,
 * and the force-static sitemap and RSS. Then Vercel never reads content/ at
 * request time, which would need `outputFileTracingIncludes` in the frozen
 * next.config.mjs. src/lib/blog/boundaries.test.ts keeps it out of client code.
 */

/** A non-regular entry named the way `ls -F` shows it. */
function describe(entry: Dirent): string {
  if (entry.isDirectory()) return `${entry.name}/`;
  if (entry.isSymbolicLink()) return `${entry.name}@`;
  return entry.isFile() ? entry.name : `${entry.name}?`;
}

function sortedEntries(dir: string): Dirent[] {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
}

export function readContentSnapshot(root: string = process.cwd()): ContentSnapshot {
  const contentDir = join(root, "content/blog");
  let contentEntries: Dirent[];
  try {
    contentEntries = sortedEntries(contentDir);
  } catch (error) {
    throw new Error(
      `blog: cannot read ${contentDir}. The folder must exist, even with no posts (it keeps a .gitkeep).`,
      { cause: error }
    );
  }

  const snapshot: ContentSnapshot = {
    postFiles: [],
    otherContentEntries: [],
    imageDirs: [],
    otherPublicBlogEntries: [],
  };

  for (const entry of contentEntries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      snapshot.postFiles.push({
        name: entry.name,
        source: readFileSync(join(contentDir, entry.name), "utf8"),
      });
    } else {
      snapshot.otherContentEntries.push(describe(entry));
    }
  }

  // public/blog appears with the first post that has images.
  const publicDir = join(root, "public/blog");
  let publicEntries: Dirent[] = [];
  try {
    publicEntries = sortedEntries(publicDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  for (const entry of publicEntries) {
    if (!entry.isDirectory()) {
      snapshot.otherPublicBlogEntries.push(describe(entry));
      continue;
    }
    const dir = join(publicDir, entry.name);
    const files: ContentSnapshot["imageDirs"][number]["files"] = [];
    const others: string[] = [];
    for (const file of sortedEntries(dir)) {
      if (file.isFile()) files.push({ name: file.name, bytes: readFileSync(join(dir, file.name)) });
      else others.push(describe(file));
    }
    snapshot.imageDirs.push({ slug: entry.name, files, others });
  }

  return snapshot;
}

export class BlogContentError extends Error {
  constructor(readonly issues: Issue[]) {
    super(issues.map(formatIssue).join("\n"));
    this.name = "BlogContentError";
  }
}

let memo: Post[] | undefined;

/**
 * Every post, newest first. In a production build (and anywhere but
 * `next dev`) a single issue throws, so a post with a TODO or a missing image
 * fails the build instead of shipping. `next dev` only warns, so the owner can
 * preview a draft.
 *
 * Memoised only in production: in dev, .md edits are not part of webpack's
 * module graph, and a reload must read them again.
 */
export function getAllPosts(): Post[] {
  if (memo) return memo;
  const { posts, issues } = validateCollection(readContentSnapshot(), todayUtc());
  if (issues.length > 0) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `blog: ${issues.length} issue(s) would fail the build:\n${issues.map(formatIssue).join("\n")}`
      );
    } else {
      throw new BlogContentError(issues);
    }
  }
  if (process.env.NODE_ENV === "production") memo = posts;
  return posts;
}

export function getPost(slug: string): Post | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

export function getPostSlugs(): string[] {
  return getAllPosts().map((post) => post.slug);
}

type Neighbour = Pick<Post, "slug" | "title">;

/**
 * The posts either side of this one in the index's order: `previous` is the
 * newer post, `next` the older one.
 */
export function getNeighbours(slug: string): { previous: Neighbour | null; next: Neighbour | null } {
  const posts = getAllPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return { previous: null, next: null };
  const pick = (post: Post | undefined): Neighbour | null =>
    post ? { slug: post.slug, title: post.title } : null;
  return { previous: pick(posts[index - 1]), next: pick(posts[index + 1]) };
}
