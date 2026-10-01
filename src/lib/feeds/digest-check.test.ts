import { describe, expect, it } from "vitest";
import { MISSING_IMAGE, validateCollection, type ContentSnapshot } from "../blog/validate";
import {
  SCOPE_PREFIXES,
  TODO_TAKE,
  changedPaths,
  classifyIssues,
  offCandidateLinks,
  outsideScope,
  parseNamesZ,
  parseStatusZ,
  readCandidates,
} from "./digest-check";

const TODAY = "2026-09-28";
const url = (n: number) => `https://openai.com/index/story-${n}/`;
const NAME = "ai-dev-news-2026-w40.md";
const FILE = `content/blog/${NAME}`;

function digest(takes: string[], extraBody: string[] = []): string {
  const items = takes.flatMap((take, i) => [
    `## ${i + 1}. Headline number ${i + 1}`,
    "",
    `What happened in item ${i + 1}, in two plain sentences. It is a short summary of the source.`,
    "",
    `Source: [OpenAI: Story ${i + 1}](${url(i + 1)})`,
    "",
    take,
    "",
  ]);
  return [
    "---",
    'title: "AI and dev news: week 40, 2026"',
    'publishedAt: "2026-09-28"',
    'summary: "Five things from this week in AI and web development, with my own take on each."',
    "kind: digest",
    "---",
    "",
    "Five things from this week in AI and web development, with my take on each one.",
    "",
    ...extraBody,
    ...items,
  ].join("\n");
}

const TAKE = "**My take:** I think this matters because it changes how small teams ship every week.";
const snapshot = (source: string): ContentSnapshot => ({
  postFiles: [{ name: NAME, source }],
  otherContentEntries: [".gitkeep"],
  imageDirs: [],
  otherPublicBlogEntries: [],
  inboxEntries: ["README.md"],
});
const classify = (source: string) => {
  const s = snapshot(source);
  return classifyIssues(validateCollection(s, TODAY).issues, s);
};

describe("classifyIssues", () => {
  it("puts `**My take:** TODO` lines, and only those, with the owner's takes", () => {
    const source = digest([TODO_TAKE, TAKE, TODO_TAKE, TAKE, TAKE]);
    const { blocking, takes, pendingImages } = classify(source);
    expect(blocking).toEqual([]);
    expect(pendingImages).toEqual([]);
    const lines = source.split("\n");
    expect(takes.map((t) => lines[(t.line ?? 0) - 1])).toEqual([TODO_TAKE, TODO_TAKE]);
  });

  it("keeps any other TODO blocking", () => {
    const { blocking, takes } = classify(
      digest([TAKE, TAKE, TAKE, TAKE, "**My take:** TODO, I will write this later tonight after dinner."], ["The launch was TODO(check: date).", ""])
    );
    expect(takes).toEqual([]);
    expect(blocking.map((i) => i.rule)).toEqual(["todo", "todo"]);
  });

  it("sets aside only images a post names that are not uploaded yet", () => {
    const source = digest([TAKE, TAKE, TAKE, TAKE, TAKE], ["![A robot arm plugging in a cable](/blog/ai-dev-news-2026-w40/1-agents.webp)", ""]);
    const { blocking, pendingImages } = classify(source);
    expect(blocking).toEqual([]);
    expect(pendingImages).toHaveLength(1);
    expect(pendingImages[0].message).toBe(`public/blog/ai-dev-news-2026-w40/1-agents.webp ${MISSING_IMAGE}`);
  });

  it("keeps an image outside the post's folder blocking", () => {
    const source = digest([TAKE, TAKE, TAKE, TAKE, TAKE], ["![A robot arm plugging in a cable](/blog/other-post/1-agents.webp)", ""]);
    const { blocking, pendingImages } = classify(source);
    expect(pendingImages).toEqual([]);
    expect(blocking.map((i) => i.rule)).toEqual(["image"]);
  });

  it("keeps an upload left in content/inbox blocking", () => {
    const s = { ...snapshot(digest([TAKE, TAKE, TAKE, TAKE, TAKE])), inboxEntries: ["README.md", "1-agents.png"] };
    const { blocking } = classifyIssues(validateCollection(s, TODAY).issues, s);
    expect(blocking.map((i) => `${i.file} ${i.rule}`)).toEqual(["content/inbox/1-agents.png inbox"]);
  });

  it("passes a finished digest", () => {
    expect(classify(digest([TAKE, TAKE, TAKE, TAKE, TAKE]))).toEqual({ blocking: [], takes: [], pendingImages: [] });
  });

  it("names the file it reads the take lines from", () => {
    const { takes } = classify(digest([TODO_TAKE, TAKE, TAKE, TAKE, TAKE]));
    expect(takes[0].file).toBe(FILE);
  });
});

describe("git status parsing and scope", () => {
  it("reads porcelain -z output, renames included", () => {
    const out = [
      " M content/blog/a.md",
      "?? public/blog/a/1-x.webp",
      "R  content/blog/new.md",
      "content/blog/old.md",
      " D content/inbox/1.png",
      "",
    ].join("\0");
    expect(parseStatusZ(out)).toEqual([
      "content/blog/a.md",
      "public/blog/a/1-x.webp",
      "content/blog/new.md",
      "content/blog/old.md",
      "content/inbox/1.png",
    ]);
  });

  it("adds what the branch committed to what is not committed yet", () => {
    const committed = ["content/blog/a.md", "src/lib/zz-out-of-scope.ts", ""].join("\0");
    const status = [" M content/blog/a.md", "?? public/blog/a/1-x.webp", ""].join("\0");
    expect(parseNamesZ(committed)).toEqual(["content/blog/a.md", "src/lib/zz-out-of-scope.ts"]);
    expect(changedPaths(committed, status)).toEqual(["content/blog/a.md", "public/blog/a/1-x.webp", "src/lib/zz-out-of-scope.ts"]);
    expect(outsideScope(changedPaths(committed, status))).toEqual(["src/lib/zz-out-of-scope.ts"]);
    expect(changedPaths("", "")).toEqual([]);
  });

  it("lists paths outside content/blog, public/blog and content/inbox", () => {
    expect(SCOPE_PREFIXES).toEqual(["content/blog/", "public/blog/", "content/inbox/"]);
    expect(
      outsideScope(["content/blog/a.md", "package.json", "AGENTS.md", "public/blog/a/1.webp", "src/lib/x.ts", "package.json"])
    ).toEqual(["AGENTS.md", "package.json", "src/lib/x.ts"]);
    expect(outsideScope(["content/blogger.md"])).toEqual(["content/blogger.md"]);
  });
});

describe("the candidates check", () => {
  const posts = (source: string) => validateCollection(snapshot(source), TODAY).posts;
  const urls = new Set([1, 2, 3, 4, 5].map(url));

  it("reads what digest:fetch writes, and refuses anything else", () => {
    expect(readCandidates({ postPath: FILE, items: [{ url: url(1), title: "x" }] })).toEqual({ postPath: FILE, urls: new Set([url(1)]) });
    for (const bad of [null, [], { postPath: FILE }, { postPath: 1, items: [] }, { postPath: FILE, items: [{ url: 2 }] }]) {
      expect(typeof readCandidates(bad)).toBe("string");
    }
  });

  it("passes a digest that links only the candidates' urls, exactly", () => {
    expect(offCandidateLinks(posts(digest([TAKE, TAKE, TAKE, TAKE, TAKE])), { postPath: FILE, urls })).toEqual([]);
  });

  it("refuses a link on a source's site that no candidate has, with its line", () => {
    const other = "https://huggingface.co/blog/someuser/some-post";
    const source = digest([TAKE, TAKE, TAKE, TAKE, TAKE], [`See [this](${other}) and [that](${url(1)}x).`, ""]);
    const found = offCandidateLinks(posts(source), { postPath: FILE, urls });
    const line = source.split("\n").findIndex((l) => l.includes(other)) + 1;
    expect(found.map((i) => `${i.file}:${i.line} ${i.rule} ${i.message.split(" ")[0]}`)).toEqual([
      `${FILE}:${line} link ${other}`,
      `${FILE}:${line} link ${url(1)}x`,
    ]);
  });

  it("checks only the digest the candidates file names", () => {
    const source = digest([TAKE, TAKE, TAKE, TAKE, TAKE]);
    expect(offCandidateLinks(posts(source), { postPath: "content/blog/ai-dev-news-2026-w39.md", urls: new Set() })).toEqual([]);
  });
});
