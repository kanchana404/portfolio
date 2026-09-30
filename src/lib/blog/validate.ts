import { slugify } from "../slug";
import { DIGEST_SLUG_RE, addDays, digestSlug, isYmd } from "./dates";
import { FrontmatterError, parseFrontmatter, type FrontmatterValue } from "./frontmatter";
import { WebpError, readWebpInfo } from "./webp";

/**
 * THE PUBLISH GATE.
 *
 * There is no draft state: whatever is in content/blog on `main` ships on the
 * next deploy. So this one pure function decides whether the blog may build,
 * and it runs twice: in the vitest suite (src/lib/blog/content.test.ts, part of
 * `pnpm test` and of `pnpm build`) and in the build-time loader
 * (src/lib/blog/posts.ts), so `pnpm build:only` refuses a bad post too.
 *
 * It takes a snapshot of the folders rather than reading them, so every rule
 * can be tested with made-up contents, including ones a real filesystem cannot
 * produce. Relative imports only: the tsx CLIs import this file and do not
 * resolve the `@/` alias.
 *
 * Every regex here is linear (no nested quantifiers).
 */

export type PostKind = "digest" | "post";

export interface PostImage {
  /** Public path, `/blog/<slug>/<name>.webp`. */
  src: string;
  width: number;
  height: number;
  bytes: number;
}

export interface PostMeta {
  slug: string;
  title: string;
  publishedAt: string;
  updatedAt?: string;
  summary: string;
  tags: string[];
  kind: PostKind;
  cover?: string;
  coverAlt?: string;
}

export interface Post extends PostMeta {
  /** Repo-relative, `content/blog/<slug>.md`. */
  file: string;
  body: string;
  /** 1-based file line where `body` starts. */
  bodyLine: number;
  /** Image paths in the order the body shows them. */
  bodyImages: string[];
  /** Every valid WebP in `public/blog/<slug>/`, by public path. */
  images: Record<string, PostImage>;
}

export interface Issue {
  /** Repo-relative path of the file (or folder) at fault. */
  file: string;
  line?: number;
  rule:
    | "file"
    | "frontmatter"
    | "slug"
    | "duplicate"
    | "field"
    | "todo"
    | "placeholder"
    | "take"
    | "heading"
    | "code"
    | "image"
    | "link"
    | "orphan";
  message: string;
}

/**
 * What the loader read. Entries that are not regular files are named the way
 * `ls -F` shows them: `name/` for a folder, `name@` for a symlink.
 */
export interface ContentSnapshot {
  /** Regular `*.md` files in content/blog. */
  postFiles: { name: string; source: string }[];
  /** Everything else in content/blog, `.gitkeep` included. */
  otherContentEntries: string[];
  /** One per folder in public/blog. */
  imageDirs: {
    slug: string;
    /** Regular files. */
    files: { name: string; bytes: Uint8Array }[];
    /** Anything else: nested folders, symlinks. */
    others: string[];
  }[];
  /** Entries in public/blog that are not folders. */
  otherPublicBlogEntries: string[];
}

const CONTENT_DIR = "content/blog";
const PUBLIC_DIR = "public/blog";

/** Equal to OG_TITLE_MAX in src/lib/og.ts (a test holds them together), and Google's headline limit. */
export const TITLE_MAX = 110;
export const TITLE_MIN = 5;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 80;
/** `page` keeps room for a static /blog/page/[n] later. */
export const RESERVED_SLUGS = ["page", "rss", "feed", "tag", "tags", "category", "archive"];
export const DIGEST_PREFIX = "ai-dev-news-";
export const SUMMARY_MIN = 50;
export const SUMMARY_MAX = 160;
export const TAGS_MAX = 6;
export const TAG_MIN = 2;
export const TAG_MAX = 24;
export const ALT_MIN = 5;
export const ALT_MAX = 200;
export const CAPTION_MAX = 200;
export const TAKE_MIN = 40;
export const BODY_MIN = 300;
export const EARLIEST_DATE = "2020-01-01";
export const IMAGE_FILE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/;
export const IMAGE_MAX_BYTES = 400 * 1024;
export const IMAGE_MIN_WIDTH = 320;
export const IMAGE_MAX_DIM = 2400;
export const COVER_MIN_WIDTH = 1200;

const ALLOWED_KEYS = [
  "title",
  "publishedAt",
  "updatedAt",
  "summary",
  "tags",
  "cover",
  "coverAlt",
  "kind",
];

const NO_DRAFT = "there is no draft state; anything in content/blog ships on the next deploy";

const TODO = /\bTODO/;
const FIXME = /\bFIXME\b/;

/** Checked on frontmatter values and on every line of the code-stripped body. */
const PLACEHOLDERS: Array<[RegExp, string]> = [
  [/\{\{[^{}\n]*\}\}/, "template placeholder {{…}} left in"],
  [
    /<[^\s<>][^<>\n]*>/,
    "text in angle brackets: a template placeholder, raw HTML or an autolink. Put code in backticks and write links as [text](https://…)",
  ],
  // The opening line of a tag or comment that closes on a later line, which
  // the rule above cannot see: `<!--` on its own line, or `<aside` with its
  // attributes below it.
  [
    /<[A-Za-z/?!]/,
    "the start of an HTML tag or comment (<tag, </tag, <!--), which the page would print as text. Delete it, or put code in backticks",
  ],
  [/\bYYYY-MM-DD\b/, "placeholder date YYYY-MM-DD"],
  [/\bweek NN\b/i, "placeholder week NN"],
  [/\blorem ipsum\b/i, "lorem ipsum filler"],
  [/\]\(\s*\)/, "a link with an empty target"],
];
const TITLE_NN = /\bNN\b/;
const ELLIPSIS_LINE = /^[ \t]*(?:\.\.\.|…)[ \t]*$/;
const ELLIPSIS = "a line that is only an ellipsis (a gap in the template)";

const TAKE_PREFIX = "**My take:**";
const EMPTY_TAKE = /^\*\*My take:\*\*[ \t]*$/;
const DIGEST_ITEM = /^## \d+\. /;
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
const SETEXT_UNDERLINE = /^ {0,3}(?:-+|=+)[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const IMAGE_LINE = /^!\[([^\]\n]*)\]\((\/[^\s)]+)(?:[ \t]+"([^"\n]*)")?\)[ \t]*$/;
const HTTP_LINK = /\bhttp:\/\//;
const BARE_WWW = /(^|[\s(\[])www\./;

type Report = (file: string, rule: Issue["rule"], message: string, line?: number) => void;

const codePoints = (s: string) => [...s].length;

/** Inline code spans on one line replaced by spaces. Spans across lines are left alone. */
function blankCodeSpans(line: string): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (line[i] !== "`") {
      out += line[i];
      i++;
      continue;
    }
    // A backtick after an odd number of backslashes is escaped: literal text,
    // not the start of a span. The rest of its run can still open one.
    let slashes = 0;
    while (slashes < i && line[i - 1 - slashes] === "\\") slashes++;
    if (slashes % 2 === 1) {
      out += line[i];
      i++;
      continue;
    }
    let j = i;
    while (j < line.length && line[j] === "`") j++;
    const run = j - i;
    // The span closes at the next run of exactly as many backticks.
    let close = -1;
    let k = j;
    while (k < line.length) {
      if (line[k] !== "`") {
        k++;
        continue;
      }
      let end = k;
      while (end < line.length && line[end] === "`") end++;
      if (end - k === run) {
        close = end;
        break;
      }
      k = end;
    }
    if (close === -1) {
      out += line.slice(i, j);
      i = j;
    } else {
      out += " ".repeat(close - i);
      i = close;
    }
  }
  return out;
}

/** Leading whitespace in columns, a tab reaching the next multiple of 4, as in CommonMark. */
function indentOf(line: string): number {
  let column = 0;
  for (const char of line) {
    if (char === " ") column++;
    else if (char === "\t") column += 4 - (column % 4);
    else break;
  }
  return column;
}

/**
 * The body with fenced code blocks and inline code blanked out, line for line,
 * so rules about prose do not fire on code samples. Where it reads Markdown
 * differently from the renderer, it must err towards checking too much:
 * prose it blanked by mistake would ship unchecked.
 *
 * - A fence closes on the same character at least as long.
 * - A backtick fence whose info string holds a backtick is not a fence.
 * - An indented fence, as in a list item, also ends at the first non-blank
 *   line indented less than itself: that line ends the list item, and the
 *   code block with it.
 * - A fence still open at the end comes back as `unclosed`, to be reported
 *   rather than trusted: CommonMark would show the rest of the post as code.
 *
 * It reads one line at a time, so a code span that wraps onto a second line
 * is not blanked. The renderer re-checks the prose it actually outputs
 * (rehype-blog.ts), so anything this misreads still fails the build.
 */
function stripCode(lines: string[]): { stripped: string[]; unclosed?: number } {
  const stripped: string[] = [];
  let fence: { char: string; length: number; indent: number; line: number } | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence && line.trim() !== "" && indentOf(line) < fence.indent) fence = undefined;
    const match = FENCE.exec(line);
    const info = match ? line.slice(match[0].length) : "";
    if (fence) {
      if (match && match[1][0] === fence.char && match[1].length >= fence.length && info.trim() === "") {
        fence = undefined;
      }
      stripped.push("");
    } else if (match && !(match[1][0] === "`" && info.includes("`"))) {
      fence = { char: match[1][0], length: match[1].length, indent: indentOf(line), line: i };
      stripped.push("");
    } else {
      stripped.push(blankCodeSpans(line));
    }
  }
  return { stripped, unclosed: fence?.line };
}

function placeholderIn(text: string, isTitle: boolean): string | undefined {
  for (const [pattern, message] of PLACEHOLDERS) {
    if (pattern.test(text)) return message;
  }
  if (isTitle && TITLE_NN.test(text)) return "placeholder NN in the title";
  return undefined;
}

/**
 * The placeholder rules for one line of body text, or for the text of one
 * rendered block: rehype-blog.ts runs them again on the prose the page
 * actually shows, so a line this file wrongly treated as code cannot ship a
 * placeholder. Undefined when the text is clean.
 */
export function proseProblem(text: string): string | undefined {
  return placeholderIn(text, false) ?? (ELLIPSIS_LINE.test(text.trim()) ? ELLIPSIS : undefined);
}

function checkSlug(file: string, slug: string, report: Report): void {
  if (!SLUG_RE.test(slug)) {
    report(file, "slug", "the file name must be lowercase letters, digits and single hyphens, ending in .md");
  } else if (slugify(slug) !== slug) {
    report(file, "slug", "the file name is not a clean slug");
  }
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    report(file, "slug", `the slug is ${slug.length} characters; it must be ${SLUG_MIN}-${SLUG_MAX}`);
  }
  if (RESERVED_SLUGS.includes(slug)) {
    report(file, "slug", `"${slug}" is reserved for a future blog route`);
  }
}

/** Validate one post file. Returns the post when its frontmatter parsed, issues or not. */
function checkPost(
  name: string,
  source: string,
  images: Record<string, PostImage>,
  today: string,
  report: Report
): Post | undefined {
  const file = `${CONTENT_DIR}/${name}`;
  const slug = name.slice(0, -".md".length);
  checkSlug(file, slug, report);

  const lines = source.split("\n");

  // Over the whole raw file, frontmatter and code included: a TODO anywhere
  // means the owner has not finished.
  lines.forEach((text, i) => {
    if (TODO.test(text) || FIXME.test(text)) {
      report(file, "todo", "TODO or FIXME left in; nothing ships until it is resolved", i + 1);
    }
  });

  let parsed: ReturnType<typeof parseFrontmatter>;
  try {
    parsed = parseFrontmatter(source);
  } catch (error) {
    if (error instanceof FrontmatterError) {
      report(file, "frontmatter", error.message, error.line);
      // `draft: true` fails to parse (a bare boolean), but the answer the
      // author needs is that drafts do not exist, not how to quote it.
      const draft = lines.findIndex((text, i) => i > 0 && text.startsWith("draft:"));
      if (draft !== -1 && lines.indexOf("---", 1) > draft) report(file, "field", NO_DRAFT, draft + 1);
      return undefined;
    }
    throw error;
  }
  const { data, body, bodyLine } = parsed;

  const keyLine = (key: string): number | undefined => {
    const index = lines.findIndex((text, i) => i > 0 && i < bodyLine - 2 && text.startsWith(`${key}: `));
    return index === -1 ? undefined : index + 1;
  };
  const field = (message: string, key?: string) =>
    report(file, "field", message, key === undefined ? undefined : keyLine(key));

  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.includes(key)) {
      field(key === "draft" ? NO_DRAFT : `unknown key "${key}"; allowed: ${ALLOWED_KEYS.join(", ")}`, key);
    }
  }

  const text = (key: string, required = false): string | undefined => {
    const value: FrontmatterValue | undefined = data[key];
    if (value === undefined) {
      if (required) field(`${key} is required`);
      return undefined;
    }
    if (typeof value !== "string") {
      field(`${key} is a single value, not a list`, key);
      return undefined;
    }
    return value;
  };

  const title = text("title", true);
  const publishedAt = text("publishedAt", true);
  const updatedAt = text("updatedAt");
  const summary = text("summary", true);
  const cover = text("cover");
  const coverAlt = text("coverAlt");
  const rawKind = text("kind");

  if (title !== undefined) {
    const length = codePoints(title);
    if (length < TITLE_MIN || length > TITLE_MAX) {
      field(`the title is ${length} characters; it must be ${TITLE_MIN}-${TITLE_MAX}`, "title");
    }
    if (title !== title.trim()) field("the title starts or ends with a space", "title");
  }

  const latest = addDays(today, 1);
  const published = publishedAt !== undefined && isYmd(publishedAt) ? publishedAt : undefined;
  if (publishedAt !== undefined) {
    if (published === undefined) {
      field("publishedAt must be a real date, written YYYY-MM-DD", "publishedAt");
    } else if (publishedAt < EARLIEST_DATE) {
      field(`publishedAt is before ${EARLIEST_DATE}`, "publishedAt");
    } else if (publishedAt > latest) {
      field(
        `publishedAt ${publishedAt} is in the future; there is no scheduling, so it must be ${latest} or earlier`,
        "publishedAt"
      );
    }
  }
  if (updatedAt !== undefined) {
    if (!isYmd(updatedAt)) {
      field("updatedAt must be a real date, written YYYY-MM-DD", "updatedAt");
    } else if (published !== undefined && updatedAt < published) {
      field("updatedAt is before publishedAt", "updatedAt");
    } else if (updatedAt > latest) {
      field(`updatedAt ${updatedAt} is in the future; it must be ${latest} or earlier`, "updatedAt");
    }
  }

  if (summary !== undefined) {
    const length = codePoints(summary);
    if (length < SUMMARY_MIN || length > SUMMARY_MAX) {
      field(`the summary is ${length} characters; it must be ${SUMMARY_MIN}-${SUMMARY_MAX}`, "summary");
    }
    if (title !== undefined && summary.trim().toLowerCase() === title.trim().toLowerCase()) {
      field("the summary repeats the title; say what the post is about", "summary");
    }
  }

  let tags: string[] = [];
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      field("tags is a list: tags: [ai, web-dev]", "tags");
    } else {
      tags = data.tags;
      if (tags.length > TAGS_MAX) field(`${tags.length} tags; at most ${TAGS_MAX}`, "tags");
      for (const tag of tags) {
        if (tag.length < TAG_MIN || tag.length > TAG_MAX) {
          field(`tag "${tag}" must be ${TAG_MIN}-${TAG_MAX} characters`, "tags");
        }
      }
      if (new Set(tags).size !== tags.length) field("a tag is listed twice", "tags");
    }
  }

  let kind: PostKind = "post";
  if (rawKind !== undefined) {
    if (rawKind === "digest" || rawKind === "post") kind = rawKind;
    else field('kind is "digest" or "post"', "kind");
  }

  if (kind === "digest") {
    if (published !== undefined) {
      const expected = digestSlug(published);
      if (slug !== expected) {
        report(file, "slug", `a digest published on ${published} is named ${expected}.md`);
      }
    } else if (!DIGEST_SLUG_RE.test(slug)) {
      report(file, "slug", `a digest is named ${DIGEST_PREFIX}YYYY-wWW.md`);
    }
  } else if (slug.startsWith(DIGEST_PREFIX)) {
    report(file, "slug", `the ${DIGEST_PREFIX} prefix is for digests; add kind: digest or rename the file`);
  }

  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string") continue;
    const found = placeholderIn(value, key === "title");
    if (found) report(file, "placeholder", `${key}: ${found}`, keyLine(key));
  }

  // The body, line by line. File line = bodyLine + index.
  const bodyLines = body.split("\n");
  const { stripped, unclosed } = stripCode(bodyLines);
  const at = (i: number) => bodyLine + i;
  const bodyImages: string[] = [];
  const folder = `/blog/${slug}/`;
  // The title is the H1, so the first heading is ##.
  let headingLevel = 1;

  if (unclosed !== undefined) {
    const fence = FENCE.exec(bodyLines[unclosed])?.[1] ?? "```";
    report(
      file,
      "code",
      `this ${fence} fence is never closed, so everything below it would show as code; close it with ${fence}`,
      at(unclosed)
    );
  }

  stripped.forEach((line, i) => {
    const found = proseProblem(line);
    if (found) report(file, "placeholder", found, at(i));

    if (EMPTY_TAKE.test(line)) {
      report(file, "take", `an empty take; write at least ${TAKE_MIN} characters after ${TAKE_PREFIX}`, at(i));
    }

    const heading = ATX_HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) {
        report(file, "heading", "the title is the H1; start at ##", at(i));
      } else if (level > headingLevel + 1) {
        const after = headingLevel === 1 ? "the title" : "#".repeat(headingLevel);
        report(
          file,
          "heading",
          `${heading[1]} after ${after} skips a level; headings start at ## and go down one level at a time`,
          at(i)
        );
      }
      headingLevel = level;
    } else if (i > 0 && SETEXT_UNDERLINE.test(line) && stripped[i - 1].trim() !== "") {
      report(file, "heading", "setext heading; add a blank line above", at(i));
    }

    if (HTTP_LINK.test(line)) report(file, "link", "use https:// links", at(i));
    if (BARE_WWW.test(line)) {
      report(file, "link", "bare www. text becomes an http:// link; write [text](https://www.…)", at(i));
    }

    if (!line.includes("![")) return;
    const image = IMAGE_LINE.exec(line);
    if (!image) {
      report(
        file,
        "image",
        `an image goes on a line of its own: ![Alt text](${folder}<name>.webp "Optional caption")`,
        at(i)
      );
      return;
    }
    const [, alt, src, caption] = image;
    bodyImages.push(src);
    const above = i === 0 ? "" : stripped[i - 1];
    const below = stripped[i + 1] ?? "";
    if (above.trim() !== "" || below.trim() !== "") {
      report(file, "image", "put a blank line above and below the image", at(i));
    }
    if (!src.startsWith(folder) || !IMAGE_FILE_RE.test(src.slice(folder.length))) {
      report(file, "image", `images come from public${folder} as lowercase .webp files`, at(i));
    } else if (!Object.hasOwn(images, src)) {
      report(file, "image", `public${src} is missing or not a valid WebP`, at(i));
    }
    const name = src.slice(src.lastIndexOf("/") + 1);
    const altText = alt.trim();
    const altLength = codePoints(altText);
    if (altLength < ALT_MIN || altLength > ALT_MAX) {
      report(file, "image", `the alt text is ${altLength} characters; describe the image in ${ALT_MIN}-${ALT_MAX}`, at(i));
    } else if ([name, name.replace(/\.webp$/, "")].includes(altText.toLowerCase())) {
      report(file, "image", "the alt text is the file name; describe the image", at(i));
    }
    if (caption !== undefined && codePoints(caption) > CAPTION_MAX) {
      report(file, "image", `the caption is longer than ${CAPTION_MAX} characters`, at(i));
    }
  });

  if (kind === "digest") {
    const starts = stripped.flatMap((line, i) => (DIGEST_ITEM.test(line) ? [i] : []));
    if (starts.length === 0) {
      report(file, "take", "a digest needs numbered items: ## 1. Headline", bodyLine);
    }
    starts.forEach((start, n) => {
      const section = stripped.slice(start, starts[n + 1] ?? stripped.length);
      const takeIndex = section.findIndex((line) => line.startsWith(TAKE_PREFIX));
      if (takeIndex === -1) {
        report(file, "take", `every digest item needs a ${TAKE_PREFIX} line`, at(start));
      } else {
        const take = section[takeIndex].slice(TAKE_PREFIX.length).trim();
        // An empty take is reported above, and a TODO take only by the todo
        // rule: digest:check counts those lines as the owner's to write.
        if (take !== "" && take !== "TODO" && codePoints(take) < TAKE_MIN) {
          report(
            file,
            "take",
            `the take is ${codePoints(take)} characters; write at least ${TAKE_MIN}`,
            at(start + takeIndex)
          );
        }
      }
      if (!section.some((line) => line.includes("](https://"))) {
        report(file, "take", "every digest item needs a source link: [Source](https://…)", at(start));
      }
    });
  }

  const bodyChars = body.replace(/\s/g, "").length;
  if (bodyChars < BODY_MIN) {
    report(file, "field", `the body has ${bodyChars} characters; a post needs at least ${BODY_MIN}`, bodyLine);
  }

  if (cover !== undefined) {
    if (!cover.startsWith(folder) || !IMAGE_FILE_RE.test(cover.slice(folder.length))) {
      field(`cover is a file in public${folder}, written ${folder}<name>.webp`, "cover");
    } else if (!Object.hasOwn(images, cover)) {
      report(file, "image", `public${cover} is missing or not a valid WebP`, keyLine("cover"));
    } else if (images[cover].width < COVER_MIN_WIDTH) {
      report(
        file,
        "image",
        `the cover is ${images[cover].width} px wide; it needs at least ${COVER_MIN_WIDTH}`,
        keyLine("cover")
      );
    }
    if (bodyImages.includes(cover)) {
      report(file, "image", "the cover is shown above the post; do not repeat it in the body", keyLine("cover"));
    }
  }
  if (data.cover !== undefined && data.coverAlt === undefined) field("a cover needs coverAlt", "cover");
  if (data.cover === undefined && data.coverAlt !== undefined) field("coverAlt without a cover", "coverAlt");
  if (coverAlt !== undefined) {
    const length = codePoints(coverAlt.trim());
    if (length < ALT_MIN || length > ALT_MAX) {
      field(`coverAlt is ${length} characters; it must be ${ALT_MIN}-${ALT_MAX}`, "coverAlt");
    }
  }

  return {
    slug,
    title: title ?? "",
    publishedAt: publishedAt ?? "",
    updatedAt,
    summary: summary ?? "",
    tags,
    kind,
    cover,
    coverAlt,
    file,
    body,
    bodyLine,
    bodyImages,
    images,
  };
}

/** Check one folder of public/blog and collect its valid images. */
function checkImages(
  dir: ContentSnapshot["imageDirs"][number],
  report: Report
): Record<string, PostImage> {
  const images: Record<string, PostImage> = {};
  for (const other of dir.others) {
    report(`${PUBLIC_DIR}/${dir.slug}/${other}`, "image", "a post's image folder holds only .webp files");
  }
  for (const { name, bytes } of dir.files) {
    const file = `${PUBLIC_DIR}/${dir.slug}/${name}`;
    if (!IMAGE_FILE_RE.test(name)) {
      report(file, "image", "image files are lowercase words and hyphens ending in .webp");
      continue;
    }
    let info: ReturnType<typeof readWebpInfo>;
    try {
      info = readWebpInfo(bytes);
    } catch (error) {
      if (!(error instanceof WebpError)) throw error;
      report(file, "image", `not a valid WebP: ${error.message}`);
      continue;
    }
    if (info.animated) report(file, "image", "animated WebP is not allowed");
    if (info.exif || info.xmp) {
      report(file, "image", "carries EXIF or XMP metadata; re-encode with cwebp -metadata none");
    }
    if (info.width < IMAGE_MIN_WIDTH || info.width > IMAGE_MAX_DIM || info.height > IMAGE_MAX_DIM) {
      report(
        file,
        "image",
        `${info.width}x${info.height}; the width must be ${IMAGE_MIN_WIDTH}-${IMAGE_MAX_DIM} px and the height at most ${IMAGE_MAX_DIM}`
      );
    }
    if (bytes.length > IMAGE_MAX_BYTES) {
      report(file, "image", `${Math.ceil(bytes.length / 1024)} KiB; at most ${IMAGE_MAX_BYTES / 1024} KiB`);
    }
    const src = `/blog/${dir.slug}/${name}`;
    images[src] = { src, width: info.width, height: info.height, bytes: bytes.length };
  }
  return images;
}

/**
 * Check everything in content/blog and public/blog. `today` is YYYY-MM-DD in
 * UTC. Posts come back newest first (then by slug), including posts that have
 * issues, so they can still be rendered and checked; the caller decides
 * whether any issue blocks.
 */
export function validateCollection(
  s: ContentSnapshot,
  today: string
): { posts: Post[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const report: Report = (file, rule, message, line) =>
    issues.push(line === undefined ? { file, rule, message } : { file, line, rule, message });

  for (const entry of s.otherContentEntries) {
    if (entry === ".gitkeep") continue;
    report(`${CONTENT_DIR}/${entry}`, "file", "content/blog holds only <slug>.md posts; move or delete this");
  }

  const imagesBySlug = new Map<string, Record<string, PostImage>>();
  for (const dir of s.imageDirs) imagesBySlug.set(dir.slug, checkImages(dir, report));

  const posts: Post[] = [];
  for (const { name, source } of s.postFiles) {
    const slug = name.slice(0, -".md".length);
    const post = checkPost(name, source, imagesBySlug.get(slug) ?? {}, today, report);
    if (post) posts.push(post);
  }

  const slugOwners = new Map<string, string>();
  for (const { name } of s.postFiles) {
    const key = name.slice(0, -".md".length).toLowerCase();
    const owner = slugOwners.get(key);
    if (owner) report(`${CONTENT_DIR}/${name}`, "duplicate", `the same slug as ${CONTENT_DIR}/${owner}, ignoring case`);
    else slugOwners.set(key, name);
  }
  const titleOwners = new Map<string, string>();
  for (const post of posts) {
    const key = post.title.trim().toLowerCase();
    if (key === "") continue;
    const owner = titleOwners.get(key);
    if (owner) report(post.file, "duplicate", `the same title as ${owner}, ignoring case`);
    else titleOwners.set(key, post.file);
  }

  const postSlugs = new Set(s.postFiles.map(({ name }) => name.slice(0, -".md".length)));
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
  for (const dir of s.imageDirs) {
    if (!postSlugs.has(dir.slug)) {
      report(`${PUBLIC_DIR}/${dir.slug}/`, "orphan", `no post ${CONTENT_DIR}/${dir.slug}.md uses this folder`);
      continue;
    }
    const post = postsBySlug.get(dir.slug);
    if (!post) continue;
    for (const src of Object.keys(post.images)) {
      if (!post.bodyImages.includes(src) && post.cover !== src) {
        report(`public${src}`, "orphan", "not used by the post's body or cover; reference it or delete it");
      }
    }
  }
  for (const entry of s.otherPublicBlogEntries) {
    report(`${PUBLIC_DIR}/${entry}`, "image", "public/blog holds only one folder per post, named after its slug");
  }

  posts.sort((a, b) =>
    a.publishedAt !== b.publishedAt
      ? a.publishedAt < b.publishedAt
        ? 1
        : -1
      : a.slug < b.slug
        ? -1
        : a.slug > b.slug
          ? 1
          : 0
  );
  // Grouped by file and in line order, so the gate's output reads top down.
  issues.sort((a, b) =>
    a.file !== b.file ? (a.file < b.file ? -1 : 1) : (a.line ?? 0) - (b.line ?? 0)
  );

  return { posts, issues };
}

export type HrefClass =
  | { kind: "external" | "internal" | "anchor" }
  | { kind: "invalid"; reason: string };

/**
 * The link policy for rendered posts. `href` is what react-markdown hands the
 * `a` component, after its URL transform has blanked unsafe protocols such as
 * `javascript:` to an empty string.
 */
export function classifyHref(href: string | undefined, knownSlugs: ReadonlySet<string>): HrefClass {
  if (!href) {
    return { kind: "invalid", reason: "empty link target (unsafe protocols such as javascript: are blanked)" };
  }
  if (href.startsWith("#")) return { kind: "anchor" };
  // Browsers read `/\host` as `//host`.
  if (href.startsWith("//") || href.startsWith("/\\")) {
    return { kind: "invalid", reason: "protocol-relative link; write https://" };
  }
  if (href.startsWith("/")) {
    const post = /^\/blog\/([^/#?]+)/.exec(href);
    if (post && post[1] !== "rss.xml" && !knownSlugs.has(post[1])) {
      return { kind: "invalid", reason: `/blog/${post[1]} is not a post` };
    }
    return { kind: "internal" };
  }
  if (href.startsWith("https://")) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return { kind: "invalid", reason: "not a valid URL" };
    }
    if (url.username || url.password) return { kind: "invalid", reason: "a URL with credentials" };
    if (!url.hostname.includes(".")) return { kind: "invalid", reason: "not a public host name" };
    return { kind: "external" };
  }
  return { kind: "invalid", reason: "only https://, /path and #anchor links are allowed" };
}

/** `content/blog/x.md:12  todo  TODO or FIXME left in; …` */
export function formatIssue(issue: Issue): string {
  const where = issue.line === undefined ? issue.file : `${issue.file}:${issue.line}`;
  return `${where}  ${issue.rule}  ${issue.message}`;
}
