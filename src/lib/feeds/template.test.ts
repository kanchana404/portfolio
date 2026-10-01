import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { digestSlug } from "../blog/dates";
import { validateCollection, type ContentSnapshot } from "../blog/validate";
import { TODO_TAKE, classifyIssues } from "./digest-check";

/**
 * The digest template lives in the weekly-digest skill, which Codex copies.
 * These tests hold it to the publish gate: as it stands it can never ship,
 * filled in it leaves only the owner's takes, and with the takes it passes.
 */

const SKILL = readFileSync(join(process.cwd(), ".agents/skills/weekly-digest/SKILL.md"), "utf8");
const TODAY = "2026-09-28";
const SLUG = digestSlug(TODAY);
const NAME = `${SLUG}.md`;

/** The fenced block under "## Template". */
function template(): string {
  const start = SKILL.indexOf("## Template");
  const open = SKILL.indexOf("```markdown\n", start);
  const close = SKILL.indexOf("\n```", open + 12);
  if (start === -1 || open === -1 || close === -1) throw new Error("SKILL.md has no ## Template block");
  return `${SKILL.slice(open + "```markdown\n".length, close)}\n`;
}

const snapshot = (source: string): ContentSnapshot => ({
  postFiles: [{ name: NAME, source }],
  otherContentEntries: [".gitkeep"],
  imageDirs: [],
  otherPublicBlogEntries: [],
  inboxEntries: ["README.md"],
});

const SAMPLE: Record<string, string> = {
  WW: SLUG.slice(-2),
  YYYY: SLUG.slice("ai-dev-news-".length, "ai-dev-news-".length + 4),
  PUBLISHED_AT: TODAY,
  SUMMARY: "A new SDK, a framework security release and cheaper model calls, with my take on each.",
  INTRO: "This week brought changes to the tools developers use to build with AI and the web.",
};
for (let n = 1; n <= 5; n++) {
  SAMPLE[`HEADLINE_${n}`] = `Headline number ${n} says what changed`;
  SAMPLE[`BODY_${n}`] = `The company shipped change number ${n}. It is available today. Developers can use it now.`;
  SAMPLE[`SOURCE_${n}`] = "Next.js";
  SAMPLE[`SOURCE_TITLE_${n}`] = `Post ${n}`;
  SAMPLE[`URL_${n}`] = `https://nextjs.org/blog/post-${n}`;
}

const fill = (source: string) => source.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => SAMPLE[key] ?? `{{${key}}}`);

describe("the digest template in the weekly-digest skill", () => {
  const raw = template();

  it("is found, and has the shape the skill describes", () => {
    const lines = raw.split("\n");
    expect(lines[0]).toBe("---");
    expect(lines.filter((line) => line === TODO_TAKE)).toHaveLength(5);
    expect(lines.filter((line) => /^## \d+\. \{\{HEADLINE_\d+\}\}$/.test(line))).toHaveLength(5);
    for (const token of raw.match(/\{\{[^}]*\}\}/g) ?? []) expect(token).toMatch(/^\{\{[A-Z0-9_]+\}\}$/);
    expect(raw).not.toContain("<!--");
    expect(raw).toContain("kind: digest");
    const body = lines.slice(lines.indexOf("---", 1) + 1);
    expect(body).not.toContain("---");
  });

  it("can never ship as it is", () => {
    const { issues } = validateCollection(snapshot(raw), TODAY);
    const rules = new Set(issues.map((i) => i.rule));
    expect(rules.has("placeholder")).toBe(true);
    expect(rules.has("todo")).toBe(true);
  });

  it("filled in, leaves only the owner's five takes (digest:check --allow-todo passes)", () => {
    const source = fill(raw);
    expect(source).not.toMatch(/\{\{/);
    const s = snapshot(source);
    const { issues } = validateCollection(s, TODAY);
    const { blocking, takes, pendingImages } = classifyIssues(issues, s);
    expect(blocking).toEqual([]);
    expect(pendingImages).toEqual([]);
    expect(takes).toHaveLength(5);
  });

  it("with the takes written, passes the gate", () => {
    const source = fill(raw).replaceAll(
      TODO_TAKE,
      "**My take:** This matters to me because it changes how I ship small projects every week."
    );
    expect(validateCollection(snapshot(source), TODAY).issues).toEqual([]);
  });
});
