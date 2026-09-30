import { describe, expect, it } from "vitest";
import { OG_TITLE_MAX } from "../og";
import {
  TITLE_MAX,
  classifyHref,
  formatIssue,
  validateCollection,
  type ContentSnapshot,
  type Issue,
} from "./validate";

/**
 * The publish gate's rules, on made-up folder contents. `today` is fixed, so
 * the date rules do not depend on when the suite runs.
 */

const TODAY = "2026-09-28";

const PARA =
  "The blog used to live in a database behind an admin page. Now every post is a Markdown file in the " +
  "repository, reviewed like code and deployed with the site. A pure validator reads the folder at build " +
  "time and refuses anything unfinished, so a half-written post can never reach production by accident. " +
  "Links must be https, images must be WebP files in the post's own folder, and every image needs alt text.";

const BODY = ["## Why files", "", PARA, "", "## What the gate checks", "", PARA].join("\n");

const BASE_FM: Record<string, string> = {
  title: '"Shipping a static blog from Markdown"',
  publishedAt: '"2026-09-20"',
  summary:
    '"How this blog moved from a database to Markdown files in git, with a gate that refuses unfinished posts."',
  tags: "[nextjs, markdown]",
};

/** A post: BASE_FM with overrides (undefined drops a key), then the body. */
function post(fm: Record<string, string | undefined> = {}, body = BODY): string {
  const lines = Object.entries({ ...BASE_FM, ...fm })
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${key}: ${value}`);
  return ["---", ...lines, "---", "", body, ""].join("\n");
}

const TAKE = "I think this matters because it changes how small teams ship every single week.";

function item(n: number, { take = TAKE, source = true } = {}): string {
  return [
    `## ${n}. Headline number ${n}`,
    "",
    `What happened in item ${n}, in two plain sentences. It is a short summary of the source.`,
    "",
    ...(source ? [`Source: [Example: Story ${n}](https://example.com/${n})`, ""] : []),
    `**My take:** ${take}`,
  ].join("\n");
}

const DIGEST_FM: Record<string, string | undefined> = {
  title: '"AI and dev news: week 40, 2026"',
  publishedAt: '"2026-09-28"',
  summary: '"Five things from this week in AI and web development, with my own take on each."',
  tags: undefined,
  kind: "digest",
};

function digest(items: string[] = [1, 2, 3, 4, 5].map((n) => item(n))): string {
  return post(
    DIGEST_FM,
    ["Five things from this week in AI and web development, with my take on each one.", "", ...items.join("\n\n").split("\n")].join("\n")
  );
}

/** A lossy WebP header of the given size, padded to `length` bytes. */
function lossy(width: number, height: number, length = 30): Uint8Array {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  view.setUint32(4, length - 8, true);
  bytes.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20], 8); // WEBPVP8_
  view.setUint32(16, length - 20, true);
  bytes.set([0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a], 20);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return bytes;
}

/** An extended WebP: a VP8X header with the given flags, then its image (a lossy header of the same size). */
function extended(width: number, height: number, flags: number): Uint8Array {
  const image = lossy(width, height).subarray(12);
  const bytes = new Uint8Array(30 + image.length);
  const view = new DataView(bytes.buffer);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, bytes.length - 8, true);
  bytes.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 8); // WEBPVP8X
  view.setUint32(16, 10, true);
  bytes[20] = flags;
  bytes.set([(width - 1) & 0xff, ((width - 1) >> 8) & 0xff, 0, (height - 1) & 0xff, ((height - 1) >> 8) & 0xff, 0], 24);
  bytes.set(image, 30);
  return bytes;
}

/** `file` with one more chunk inside its RIFF data: EXIF holding a location, as a phone camera writes it. */
function withExifChunk(file: Uint8Array): Uint8Array {
  const exif = [0x45, 0x58, 0x49, 0x46, 4, 0, 0, 0, 0x47, 0x50, 0x53, 0x20]; // "EXIF", 4, "GPS "
  const bytes = new Uint8Array([...file, ...exif]);
  new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
  return bytes;
}

function snapshot(
  posts: Record<string, string>,
  extra: Partial<ContentSnapshot> = {}
): ContentSnapshot {
  return {
    postFiles: Object.entries(posts).map(([name, source]) => ({ name, source })),
    otherContentEntries: [".gitkeep"],
    imageDirs: [],
    otherPublicBlogEntries: [],
    ...extra,
  };
}

const check = (s: ContentSnapshot) => validateCollection(s, TODAY);

/** `file:line rule` for each issue, to compare against. */
const where = (issues: Issue[]) =>
  issues.map((i) => `${i.file}${i.line === undefined ? "" : `:${i.line}`} ${i.rule}`);

/** The 1-based line of the first line of `source` containing `needle`. */
function lineOf(source: string, needle: string): number {
  const index = source.split("\n").findIndex((line) => line.includes(needle));
  if (index === -1) throw new Error(`"${needle}" is not in the source`);
  return index + 1;
}

/** The issues for one post file with a body `with` BODY replaced. */
function issuesFor(source: string, name = "static-blog.md", extra: Partial<ContentSnapshot> = {}) {
  return check(snapshot({ [name]: source }, extra)).issues;
}

const FILE = "content/blog/static-blog.md";

describe("validateCollection: what passes", () => {
  it("an empty blog", () => {
    expect(check(snapshot({}))).toEqual({ posts: [], issues: [] });
    expect(check({ postFiles: [], otherContentEntries: [], imageDirs: [], otherPublicBlogEntries: [] }).issues).toEqual(
      []
    );
  });

  it("a minimal post", () => {
    const { posts, issues } = check(snapshot({ "static-blog.md": post() }));
    expect(issues).toEqual([]);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      slug: "static-blog",
      file: FILE,
      title: "Shipping a static blog from Markdown",
      publishedAt: "2026-09-20",
      tags: ["nextjs", "markdown"],
      kind: "post",
      bodyLine: 7,
      bodyImages: [],
      images: {},
    });
  });

  it("a five-item digest", () => {
    const { posts, issues } = check(snapshot({ "ai-dev-news-2026-w40.md": digest() }));
    expect(issues).toEqual([]);
    expect(posts[0]).toMatchObject({ slug: "ai-dev-news-2026-w40", kind: "digest", tags: [] });
  });

  it("a post published tomorrow (UTC), for authors ahead of UTC", () => {
    expect(issuesFor(post({ publishedAt: '"2026-09-29"' }))).toEqual([]);
  });

  it("prose with angle brackets and TODO-like words inside code", () => {
    const body = [
      BODY,
      "",
      "Type it as `Array<string>` and compare with a < b.",
      "",
      "```ts",
      "const list: Array<string> = [];",
      "# not a heading",
      "```",
      "",
      "My todo app and Mastodon are fine; only the uppercase marker is not.",
    ].join("\n");
    expect(issuesFor(post({}, body))).toEqual([]);
  });

  it("images on their own lines, with and without a caption, and a cover", () => {
    const body = [
      "## Why files",
      "",
      '![A stack of Markdown files becoming web pages](/blog/static-blog/1-files.webp "From file to page")',
      "",
      PARA,
      "",
      "![The build refusing a post that still has a gap in it](/blog/static-blog/2-gate.webp)",
    ].join("\n");
    const source = post(
      { cover: "/blog/static-blog/cover.webp", coverAlt: '"A desk with a laptop showing Markdown"' },
      body
    );
    const { posts, issues } = check(
      snapshot(
        { "static-blog.md": source },
        {
          imageDirs: [
            {
              slug: "static-blog",
              files: [
                { name: "1-files.webp", bytes: lossy(1344, 896) },
                { name: "2-gate.webp", bytes: lossy(1344, 756) },
                { name: "cover.webp", bytes: lossy(1600, 900) },
              ],
              others: [],
            },
          ],
        }
      )
    );
    expect(issues).toEqual([]);
    expect(posts[0].bodyImages).toEqual(["/blog/static-blog/1-files.webp", "/blog/static-blog/2-gate.webp"]);
    expect(posts[0].images["/blog/static-blog/1-files.webp"]).toEqual({
      src: "/blog/static-blog/1-files.webp",
      width: 1344,
      height: 896,
      bytes: 30,
    });
    expect(posts[0].cover).toBe("/blog/static-blog/cover.webp");
  });
});

describe("validateCollection: todo", () => {
  it.each([
    ["a TODO take", "**My take:** TODO"],
    ["TODOs", "Two TODOs remain in this paragraph."],
    ["FIXME", "FIXME: check the numbers."],
    ["a verification marker", "The launch was on Tuesday TODO(check: date)."],
  ])("%s", (_name, line) => {
    const source = post({}, [BODY, "", line].join("\n"));
    expect(where(issuesFor(source))).toContain(`${FILE}:${lineOf(source, line)} todo`);
  });

  it("a TODO inside a code fence still fails: the rule reads the raw file", () => {
    const source = post({}, [BODY, "", "```", "// TODO remove", "```"].join("\n"));
    expect(where(issuesFor(source))).toEqual([`${FILE}:${lineOf(source, "// TODO")} todo`]);
  });

  it("a TODO in the frontmatter fails", () => {
    const source = post({ title: '"TODO title for this post"' });
    expect(where(issuesFor(source))).toContain(`${FILE}:2 todo`);
  });
});

describe("validateCollection: placeholder", () => {
  it.each([
    ["{{…}} in the body", "Intro: {{INTRO}}"],
    ["an angle-bracket headline", "## <headline>"],
    ["an angle-bracket link", "Source: [<company>](<url>)"],
    ["a YYYY-MM-DD date", "Released on YYYY-MM-DD."],
    ["a week NN reference", "This is week NN of the digest."],
    ["a line that is only ...", "..."],
    ["a line that is only …", "…"],
    ["lorem ipsum", "Lorem ipsum dolor sit amet."],
    ["an empty link target", "See [the post]() for more."],
    ["raw HTML", "<div>hello</div>"],
  ])("%s", (_name, line) => {
    const source = post({}, [BODY, "", line].join("\n"));
    expect(where(issuesFor(source))).toContain(`${FILE}:${lineOf(source, line)} placeholder`);
  });

  it.each([
    ["an HTML comment", ["<!--", "Note to self: check the numbers with Sam before this goes live", "-->"]],
    ["a tag with its attributes below it", ["<aside", '  class="note">Draft remark</aside', ">"]],
  ])("%s split over lines, at its first line", (_name, lines) => {
    const source = post({}, [BODY, "", ...lines].join("\n"));
    expect(where(issuesFor(source))).toContain(`${FILE}:${lineOf(source, lines[0])} placeholder`);
  });

  it("placeholders in frontmatter values point at the key", () => {
    const source = post({ summary: '"{{SUMMARY}}"', title: '"AI and dev news: week NN"' });
    const found = where(issuesFor(source));
    expect(found).toContain(`${FILE}:${lineOf(source, "summary:")} placeholder`);
    expect(found).toContain(`${FILE}:${lineOf(source, "title:")} placeholder`);
  });

  it("NN alone is a placeholder in the title only", () => {
    const source = post({ title: '"The NN best tools of the year"' });
    expect(where(issuesFor(source))).toContain(`${FILE}:2 placeholder`);
    expect(issuesFor(post({}, [BODY, "", "An NN model is a neural network."].join("\n")))).toEqual([]);
  });

  it("a placeholder date in publishedAt fails as a placeholder and as a date", () => {
    const source = post({ publishedAt: '"YYYY-MM-DD"' });
    const found = where(issuesFor(source));
    expect(found).toContain(`${FILE}:3 placeholder`);
    expect(found).toContain(`${FILE}:3 field`);
  });
});

describe("validateCollection: take", () => {
  const NAME = "ai-dev-news-2026-w40.md";
  const DIGEST = `content/blog/${NAME}`;
  const items = (third: string) => [item(1), item(2), third, item(4), item(5)];

  it("a TODO take is reported only as a todo, which digest:check leaves to the owner", () => {
    const source = digest(items(item(3, { take: "TODO" })));
    expect(where(issuesFor(source, NAME))).toEqual([`${DIGEST}:${lineOf(source, "**My take:** TODO")} todo`]);
  });

  it("an empty take", () => {
    const source = digest(items(item(3, { take: "" }).trimEnd()));
    const line = source.split("\n").indexOf("**My take:**") + 1;
    expect(line).toBeGreaterThan(0);
    expect(where(issuesFor(source, NAME))).toEqual([`${DIGEST}:${line} take`]);
  });

  it("a take under 40 characters", () => {
    const source = digest(items(item(3, { take: "Big if true." })));
    expect(where(issuesFor(source, NAME))).toEqual([`${DIGEST}:${lineOf(source, "Big if true.")} take`]);
  });

  it("an item with no take line", () => {
    const source = digest(items(item(3).replace(/\*\*My take:\*\* .*/, "My thoughts: soon.")));
    expect(where(issuesFor(source, NAME))).toEqual([`${DIGEST}:${lineOf(source, "## 3.")} take`]);
  });

  it("an item with no https source link", () => {
    const source = digest(items(item(3, { source: false })));
    expect(where(issuesFor(source, NAME))).toEqual([`${DIGEST}:${lineOf(source, "## 3.")} take`]);
  });

  it("a digest with no numbered items", () => {
    const source = post(DIGEST_FM, BODY);
    expect(where(issuesFor(source, NAME))).toEqual([`${DIGEST}:7 take`]);
  });

  it("an empty take in an ordinary post", () => {
    const source = post({}, [BODY, "", "**My take:**"].join("\n"));
    expect(where(issuesFor(source))).toEqual([`${FILE}:${lineOf(source, "**My take:**")} take`]);
  });
});

describe("validateCollection: heading and link", () => {
  it("a # heading", () => {
    const source = post({}, ["# A second title", "", BODY].join("\n"));
    expect(where(issuesFor(source))).toEqual([`${FILE}:8 heading`]);
  });

  it("a first heading below ##, and a heading that skips a level", () => {
    const first = post({}, ["### Starts at h3", "", BODY].join("\n"));
    expect(where(issuesFor(first))).toEqual([`${FILE}:8 heading`]);
    const skipped = post({}, [BODY, "", "#### Skipped a level", "", PARA].join("\n"));
    expect(where(issuesFor(skipped))).toEqual([`${FILE}:${lineOf(skipped, "#### Skipped")} heading`]);
    // Down one level at a time, and back up by any number.
    const nested = [BODY, "", "### Details", "", "#### Finer", "", "## Back up", "", PARA].join("\n");
    expect(issuesFor(post({}, nested))).toEqual([]);
  });

  it("a setext underline directly under text", () => {
    const source = post({}, [BODY, "Closing thoughts", "---"].join("\n"));
    expect(where(issuesFor(source))).toEqual([`${FILE}:${lineOf(source, "Closing thoughts") + 1} heading`]);
    // With a blank line above, --- is a thematic break.
    expect(issuesFor(post({}, [BODY, "", "---", "", PARA].join("\n")))).toEqual([]);
  });

  it("an http:// link", () => {
    const source = post({}, [BODY, "", "See [the docs](http://example.com/docs)."].join("\n"));
    expect(where(issuesFor(source))).toEqual([`${FILE}:${lineOf(source, "http://")} link`]);
  });

  it("bare www. text, which GFM would turn into an http link", () => {
    const source = post({}, [BODY, "", "More at www.example.com today."].join("\n"));
    expect(where(issuesFor(source))).toEqual([`${FILE}:${lineOf(source, "www.")} link`]);
    expect(issuesFor(post({}, [BODY, "", "More at [the site](https://www.example.com)."].join("\n")))).toEqual([]);
  });
});

describe("validateCollection: code", () => {
  // Text the gate wrongly treats as code ships unchecked, so each of these
  // reads a line as prose exactly where CommonMark does.
  it("an escaped backtick does not open a code span", () => {
    const line = "The subtitle is \\`{{SUBTITLE}}\\` for now.";
    const source = post({}, [BODY, "", line].join("\n"));
    expect(where(issuesFor(source))).toEqual([`${FILE}:${lineOf(source, line)} placeholder`]);
    // An escaped backslash does not escape the backtick after it.
    expect(issuesFor(post({}, [BODY, "", "A path ends in \\\\`{{kept}}` here."].join("\n")))).toEqual([]);
  });

  it("a backtick fence with a backtick in its info string is not a fence", () => {
    const source = post({}, [BODY, "", "``` x`", "", "{{headline}}", "", "# Second H1", ""].join("\n"));
    expect(where(issuesFor(source))).toEqual([
      `${FILE}:${lineOf(source, "{{headline}}")} placeholder`,
      `${FILE}:${lineOf(source, "# Second H1")} heading`,
    ]);
  });

  it("a fence in a list item ends with the item", () => {
    const line = "Read more in <headline> and {{SUMMARY}} on week NN.";
    const source = post({}, [BODY, "", "- Install it:", "  ```sh", "  pnpm add x", "", line].join("\n"));
    expect(where(issuesFor(source))).toEqual([`${FILE}:${lineOf(source, line)} placeholder`]);
  });

  it("a fence that is never closed", () => {
    const source = post({}, [BODY, "", "```sh", "pnpm add x", "", "{{SUMMARY}}"].join("\n"));
    expect(where(issuesFor(source))).toEqual([`${FILE}:${lineOf(source, "```sh")} code`]);
    // The list-item fence above ends with its item, so a fence at the margin
    // after it opens a new block, which is never closed.
    const listed = post(
      {},
      [BODY, "", "- item", "  ```", "  code", "", "{{headline}}", "", "![A picture](constructor)", "", "```"].join("\n")
    );
    expect(where(issuesFor(listed))).toEqual([
      `${FILE}:${lineOf(listed, "{{headline}}")} placeholder`,
      `${FILE}:${lineOf(listed, "constructor")} image`,
      `${FILE}:${lineOf(listed, "(constructor)") + 2} code`,
    ]);
  });

  it("code in a list item stays code", () => {
    const body = [BODY, "", "1. Install:", "", "   ```sh", "   # add the package", "   pnpm add <name>", "   ```", "", "2. Run it."];
    expect(issuesFor(post({}, body.join("\n")))).toEqual([]);
  });
});

describe("validateCollection: image", () => {
  const DIR = "public/blog/static-blog";
  const withImages = (
    files: Array<[string, Uint8Array]>,
    others: string[] = []
  ): Partial<ContentSnapshot> => ({
    imageDirs: [{ slug: "static-blog", files: files.map(([name, bytes]) => ({ name, bytes })), others }],
  });
  const good = (): Array<[string, Uint8Array]> => [["1-files.webp", lossy(1344, 896)]];
  const figure = '![A stack of Markdown files becoming web pages](/blog/static-blog/1-files.webp "From file to page")';
  const bodyWith = (line: string) => ["## Why files", "", line, "", PARA].join("\n");

  it.each([
    ["an inline image", "Here it is: ![A stack of files](/blog/static-blog/1-files.webp) inline."],
    ["an external image", "![A picture from elsewhere](https://example.com/a.webp)"],
    ["a .png", "![A diagram of the build](/blog/static-blog/1-files.png)"],
    ["another post's folder", "![A diagram of the build](/blog/other-post/1-files.webp)"],
    ["a missing file", "![A diagram of the build](/blog/static-blog/9-missing.webp)"],
    ["the file name as alt text", "![1-files](/blog/static-blog/1-files.webp)"],
    ["alt text too short", "![Pic](/blog/static-blog/1-files.webp)"],
    ["a single-quoted caption", "![A stack of files on a desk](/blog/static-blog/1-files.webp 'Caption')"],
  ])("%s", (_name, line) => {
    const source = post({}, bodyWith(line));
    expect(where(issuesFor(source, "static-blog.md", withImages(good())))).toContain(
      `${FILE}:${lineOf(source, line)} image`
    );
  });

  it("an image with no blank line around it", () => {
    const source = post({}, ["## Why files", figure, "", PARA].join("\n"));
    expect(where(issuesFor(source, "static-blog.md", withImages(good())))).toEqual([
      `${FILE}:${lineOf(source, figure)} image`,
    ]);
  });

  it("an unused image, and a folder with no post", () => {
    const found = where(
      check(
        snapshot(
          { "static-blog.md": post({}, bodyWith(figure)) },
          {
            imageDirs: [
              ...withImages([...good(), ["2-unused.webp", lossy(800, 600)]]).imageDirs!,
              { slug: "deleted-post", files: [{ name: "1-a.webp", bytes: lossy(800, 600) }], others: [] },
            ],
          }
        )
      ).issues
    );
    expect(found).toEqual([`public/blog/deleted-post/ orphan`, `${DIR}/2-unused.webp orphan`]);
  });

  it.each([
    ["an animated WebP", extended(800, 600, 0x02), "animated"],
    ["a WebP with EXIF", extended(800, 600, 0x08), "EXIF or XMP"],
    ["a WebP with XMP", extended(800, 600, 0x04), "EXIF or XMP"],
    ["an EXIF chunk its header does not announce", withExifChunk(extended(800, 600, 0)), "EXIF or XMP"],
    ["a lossy WebP with a chunk after its image", withExifChunk(lossy(800, 600)), "not a valid WebP"],
    ["a 401 KiB file", lossy(1344, 896, 401 * 1024), "401 KiB"],
    ["an image narrower than 320 px", lossy(300, 200), "300x200"],
    ["an image wider than 2400 px", lossy(3000, 2000), "3000x2000"],
    ["a file that is not a WebP", new TextEncoder().encode("console.log('not an image')"), "not a valid WebP"],
  ])("%s", (_name, bytes, message) => {
    const issues = issuesFor(post({}, bodyWith(figure)), "static-blog.md", withImages([["1-files.webp", bytes]]));
    expect(where(issues)).toContain(`${DIR}/1-files.webp image`);
    expect(issues.map((i) => i.message).join("\n")).toContain(message);
  });

  it("a badly named file, a nested folder and a symlink", () => {
    const found = where(
      issuesFor(
        post({}, bodyWith(figure)),
        "static-blog.md",
        withImages([...good(), ["Photo 1.WEBP", lossy(800, 600)]], ["raw/", "link.webp@"])
      )
    );
    expect(found).toEqual([`${DIR}/Photo 1.WEBP image`, `${DIR}/link.webp@ image`, `${DIR}/raw/ image`]);
  });

  it("a stray file at the top of public/blog", () => {
    const found = where(issuesFor(post(), "static-blog.md", { otherPublicBlogEntries: ["notes.txt"] }));
    expect(found).toEqual(["public/blog/notes.txt image"]);
  });

  describe("cover", () => {
    const cover = { cover: "/blog/static-blog/cover.webp", coverAlt: '"A desk with a laptop showing Markdown"' };

    it("narrower than 1200 px", () => {
      const source = post(cover);
      const found = where(issuesFor(source, "static-blog.md", withImages([["cover.webp", lossy(1000, 600)]])));
      expect(found).toEqual([`${FILE}:${lineOf(source, "cover:")} image`]);
    });

    it("repeated in the body", () => {
      const source = post(cover, bodyWith("![A desk with a laptop on it](/blog/static-blog/cover.webp)"));
      const found = where(issuesFor(source, "static-blog.md", withImages([["cover.webp", lossy(1600, 900)]])));
      expect(found).toEqual([`${FILE}:${lineOf(source, "cover:")} image`]);
    });

    it("missing, or outside the post's folder", () => {
      const missing = post(cover);
      expect(where(issuesFor(missing))).toEqual([`${FILE}:${lineOf(missing, "cover:")} image`]);
      const elsewhere = post({ ...cover, cover: "/images/cover.webp" });
      expect(where(issuesFor(elsewhere))).toEqual([`${FILE}:${lineOf(elsewhere, "cover:")} field`]);
    });

    it("without coverAlt, and coverAlt without a cover", () => {
      const noAlt = post({ cover: cover.cover });
      expect(where(issuesFor(noAlt, "static-blog.md", withImages([["cover.webp", lossy(1600, 900)]])))).toEqual([
        `${FILE}:${lineOf(noAlt, "cover:")} field`,
      ]);
      const noCover = post({ coverAlt: cover.coverAlt });
      expect(where(issuesFor(noCover))).toEqual([`${FILE}:${lineOf(noCover, "coverAlt:")} field`]);
    });
  });
});

describe("validateCollection: slug and duplicate", () => {
  it.each([
    ["Hello.md", "uppercase"],
    ["a.md", "too short"],
    ["page.md", "reserved"],
    ["x--y.md", "a double hyphen"],
    [`${"a".repeat(81)}.md`, "too long"],
  ])("%s (%s)", (name) => {
    expect(where(issuesFor(post(), name))).toContain(`content/blog/${name} slug`);
  });

  it("a digest whose name does not match its week", () => {
    const found = where(issuesFor(digest(), "ai-dev-news-2026-w39.md"));
    expect(found).toEqual(["content/blog/ai-dev-news-2026-w39.md slug"]);
  });

  it("an ordinary post using the digest prefix", () => {
    expect(where(issuesFor(post(), "ai-dev-news-notes.md"))).toEqual(["content/blog/ai-dev-news-notes.md slug"]);
  });

  it("slugs that differ only in case", () => {
    const found = where(
      check(snapshot({ "hello-world.md": post(), "Hello-World.md": post({ title: '"Another title here"' }) })).issues
    );
    expect(found).toContain("content/blog/Hello-World.md duplicate");
    expect(found).toContain("content/blog/Hello-World.md slug");
  });

  it("the same title twice, ignoring case", () => {
    const found = where(
      check(
        snapshot({
          "first-post.md": post(),
          "second-post.md": post({ title: '"shipping a STATIC blog from markdown"' }),
        })
      ).issues
    );
    expect(found).toEqual(["content/blog/second-post.md duplicate"]);
  });
});

describe("validateCollection: field", () => {
  const fieldAt = (fm: Record<string, string | undefined>, key: string) => {
    const source = post(fm);
    expect(where(issuesFor(source))).toEqual([`${FILE}:${lineOf(source, `${key}:`)} field`]);
  };

  it("draft, with the no-draft message, even when its value does not parse", () => {
    const quoted = post({ draft: '"true"' });
    const issues = issuesFor(quoted);
    expect(where(issues)).toEqual([`${FILE}:${lineOf(quoted, "draft:")} field`]);
    expect(issues[0].message).toContain("there is no draft state");

    const bare = post({ draft: "true" });
    expect(where(issuesFor(bare))).toEqual([
      `${FILE}:${lineOf(bare, "draft:")} frontmatter`,
      `${FILE}:${lineOf(bare, "draft:")} field`,
    ]);
  });

  it("an unknown key", () => fieldAt({ author: '"Kavitha"' }, "author"));
  it("a 49-character summary", () => fieldAt({ summary: `"${"s".repeat(49)}"` }, "summary"));
  it("a 161-character summary", () => fieldAt({ summary: `"${"s".repeat(161)}"` }, "summary"));
  it("a summary equal to the title", () => {
    const same = '"How this blog moved from a database to Markdown files in git"';
    fieldAt({ title: same, summary: same }, "summary");
  });
  it("a title too short", () => fieldAt({ title: '"Hi"' }, "title"));
  it("a title too long", () => fieldAt({ title: `"${"t".repeat(TITLE_MAX + 1)}"` }, "title"));
  it("a title with a trailing space", () => fieldAt({ title: '"Shipping a static blog "' }, "title"));
  it("publishedAt 2026-02-30", () => fieldAt({ publishedAt: '"2026-02-30"' }, "publishedAt"));
  it("publishedAt the day after tomorrow", () => fieldAt({ publishedAt: '"2026-09-30"' }, "publishedAt"));
  it("publishedAt before 2020", () => fieldAt({ publishedAt: '"2019-12-31"' }, "publishedAt"));
  it("updatedAt before publishedAt", () => fieldAt({ updatedAt: '"2026-09-19"' }, "updatedAt"));
  it("updatedAt in the future", () => fieldAt({ updatedAt: '"2026-10-01"' }, "updatedAt"));
  it("tags as a single value", () => fieldAt({ tags: "nextjs" }, "tags"));
  it("seven tags", () => fieldAt({ tags: "[a1, b2, c3, d4, e5, f6, g7]" }, "tags"));
  it("a one-character tag", () => fieldAt({ tags: "[a, nextjs]" }, "tags"));
  it("a repeated tag", () => fieldAt({ tags: "[ai, ai]" }, "tags"));
  it("an unknown kind", () => fieldAt({ kind: "essay" }, "kind"));

  it("a missing required field", () => {
    expect(where(issuesFor(post({ summary: undefined })))).toEqual([`${FILE} field`]);
  });

  it("a body under 300 characters", () => {
    expect(where(issuesFor(post({}, "## Short\n\nToo short to be a post.")))).toEqual([`${FILE}:7 field`]);
  });

  it("frontmatter that does not parse stops the rest of the checks", () => {
    const source = post({ title: "'Single quoted'" });
    expect(where(issuesFor(source))).toEqual([`${FILE}:2 frontmatter`]);
  });
});

describe("validateCollection: file", () => {
  it("allows only .md posts and .gitkeep in content/blog", () => {
    const found = where(
      check(
        snapshot(
          { "README.md": post() },
          { otherContentEntries: [".gitkeep", ".DS_Store", "linked.md@", "notes.mdx", "old/", "POST.MD"] }
        )
      ).issues
    );
    expect(found).toEqual([
      "content/blog/.DS_Store file",
      "content/blog/POST.MD file",
      "content/blog/README.md slug",
      "content/blog/linked.md@ file",
      "content/blog/notes.mdx file",
      "content/blog/old/ file",
    ]);
  });
});

describe("validateCollection: order", () => {
  it("newest first, then by slug", () => {
    const { posts, issues } = check(
      snapshot({
        "older-post.md": post({ title: '"An older post from the summer"', publishedAt: '"2026-06-01"' }),
        "b-same-day.md": post({ title: '"The second post of the day"', publishedAt: '"2026-09-20"' }),
        "a-same-day.md": post({ title: '"The first post of the day"', publishedAt: '"2026-09-20"' }),
        "newest-post.md": post({ title: '"The newest post of them all"', publishedAt: '"2026-09-27"' }),
      })
    );
    expect(issues).toEqual([]);
    expect(posts.map((p) => p.slug)).toEqual(["newest-post", "a-same-day", "b-same-day", "older-post"]);
  });
});

describe("classifyHref", () => {
  const known = new Set(["known"]);

  it.each([
    ["", "invalid"],
    [undefined, "invalid"],
    ["#x", "anchor"],
    ["/", "internal"],
    ["/privacy", "internal"],
    ["/blog", "internal"],
    ["/blog/known", "internal"],
    ["/blog/known#section", "internal"],
    ["/blog/unknown", "invalid"],
    ["/blog/rss.xml", "internal"],
    ["//evil.example", "invalid"],
    ["/\\evil.example", "invalid"],
    ["http://x.com", "invalid"],
    ["https://example.com/a?b=1", "external"],
    ["https://u:p@x.com", "invalid"],
    ["https://localhost", "invalid"],
    ["https://", "invalid"],
    ["mailto:a@b.com", "invalid"],
    ["javascript:alert(1)", "invalid"],
    ["relative/path", "invalid"],
  ])("%s is %s", (href, kind) => {
    expect(classifyHref(href, known).kind).toBe(kind);
  });
});

describe("the gate's constants and output", () => {
  it("keeps TITLE_MAX equal to the OG card's limit", () => {
    expect(TITLE_MAX).toBe(OG_TITLE_MAX);
  });

  it("formats an issue as file:line, rule, message", () => {
    expect(formatIssue({ file: FILE, line: 12, rule: "todo", message: "TODO left in" })).toBe(
      `${FILE}:12  todo  TODO left in`
    );
    expect(formatIssue({ file: "public/blog/x/", rule: "orphan", message: "no post" })).toBe(
      "public/blog/x/  orphan  no post"
    );
  });
});
