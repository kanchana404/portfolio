import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CODEX_ALLOWED_DOMAINS, FEED_HOSTS } from "./sources";

/**
 * The files agents and the owner follow for the weekly digest must agree with
 * the code: the same allowed domains everywhere, the security rules first,
 * AGENTS.md under Codex's 32 KiB project-doc limit, and a skill Codex can load.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const AGENTS = read("AGENTS.md");
const CLAUDE = read("CLAUDE.md");
const SKILL = read(".agents/skills/weekly-digest/SKILL.md");
const GUIDE = read("docs/weekly-digest.md");
const PROMPT = read("docs/digest/weekly-prompt.md");

describe("AGENTS.md", () => {
  it("stays under Codex's 32 KiB project-doc limit", () => {
    expect(Buffer.byteLength(AGENTS, "utf8")).toBeLessThan(32 * 1024);
  });

  it("puts the security rules first", () => {
    const headings = AGENTS.split("\n").filter((line) => line.startsWith("## "));
    expect(headings[0]).toMatch(/^## 1\. Security rules/);
  });

  it("has the exact '## Code Review Rules' heading Codex code review reads, last", () => {
    const headings = AGENTS.split("\n").filter((line) => line.startsWith("## "));
    expect(headings[headings.length - 1]).toBe("## Code Review Rules");
  });

  it("names every allowed domain, and every feed host in its review rules", () => {
    for (const domain of CODEX_ALLOWED_DOMAINS) expect(AGENTS).toContain(domain);
    const review = AGENTS.slice(AGENTS.indexOf("\n## Code Review Rules\n"));
    for (const host of FEED_HOSTS) expect(review).toContain(host);
  });

  it("allows the setup script and read-only inspection in Codex Cloud", () => {
    expect(AGENTS).toContain("`bash scripts/codex-setup.sh` in the environment's setup only");
    expect(AGENTS).toMatch(/read-only file commands/);
  });

  it("says never to run pnpm build in Codex Cloud, and never to write a take", () => {
    expect(AGENTS).toMatch(/Never\s+run\s+`pnpm build`\s+or\s+`pnpm dev`\s+there/);
    expect(AGENTS).toMatch(/Never write, draft, suggest,\s+reword/);
  });
});

describe("CLAUDE.md", () => {
  it("imports AGENTS.md", () => {
    expect(CLAUDE.split("\n")).toContain("@AGENTS.md");
  });
});

describe("the weekly-digest skill", () => {
  it("has name and description frontmatter Codex can load", () => {
    const match = /^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---\n/.exec(SKILL);
    expect(match?.[1]).toBe("weekly-digest");
    expect(match?.[2].length).toBeGreaterThan(40);
    expect(match?.[2].length).toBeLessThanOrEqual(1024);
  });

  it("runs the fetch and checks the draft with --allow-todo, then strictly", () => {
    expect(SKILL).toContain("pnpm digest:fetch");
    expect(SKILL).toContain("pnpm digest:check --allow-todo --scope");
    expect(SKILL).toContain("pnpm digest:check --scope` (no `--allow-todo`)");
    expect(SKILL).toContain("Never run `pnpm build` or `pnpm dev`");
  });

  it("states the pending-images exception wherever it asks for a strict pass", () => {
    for (const text of [SKILL, AGENTS, PROMPT]) {
      expect(text).toMatch(/--images-pending/);
      expect(text).toMatch(/never remove an image line/i);
    }
  });
});

describe("the owner's guide and prompt", () => {
  it("lists exactly the allowed domains for the environment", () => {
    const block = /Additional allowed domains add exactly\s+these \d+:\n\n\s+```text\n([\s\S]*?)\n\s+```/.exec(GUIDE)?.[1];
    expect(block?.split("\n").map((line) => line.trim())).toEqual([...CODEX_ALLOWED_DOMAINS]);
  });

  it("uses the skill and the install script", () => {
    expect(PROMPT).toContain("$weekly-digest");
    expect(GUIDE).toContain("bash scripts/codex-setup.sh");
    expect(existsSync(join(ROOT, "scripts/codex-setup.sh"))).toBe(true);
  });
});

describe("repository wiring", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

  it("runs the integrity check before fetching, and has the check CLI", () => {
    expect(pkg.scripts["digest:fetch"]).toMatch(/^node scripts\/check-config-integrity\.mjs && /);
    expect(pkg.scripts["digest:fetch"]).toContain("tsx scripts/digest/fetch.ts");
    expect(pkg.scripts["digest:check"]).toBe("tsx scripts/digest/check.ts");
  });

  it("never commits the fetched text, and keeps the inbox README", () => {
    expect(read(".gitignore").split("\n")).toContain("/.digest/");
    expect(existsSync(join(ROOT, "content/inbox/README.md"))).toBe(true);
  });
});
