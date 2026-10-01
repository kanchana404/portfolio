import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GitHub Actions workflows, read as text (no YAML dependency).
 *
 * - Every action is pinned to a full commit SHA with the release named in a
 *   comment: a tag can be moved to different code, a SHA cannot.
 * - Every workflow sets its token's permissions explicitly.
 * - blog-images.yml keeps its split: the job that runs repository code cannot
 *   write, and the job that can write runs no repository code.
 */

const DIR = join(process.cwd(), ".github/workflows");
const WORKFLOWS = readdirSync(DIR)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(DIR, name), "utf8") }));

/** The lines of one job: from `  <job>:` to the next job at the same indent. */
function job(text: string, name: string): string {
  const lines = text.split("\n");
  const start = lines.indexOf(`  ${name}:`);
  if (start === -1) throw new Error(`no job ${name}`);
  const end = lines.findIndex((line, i) => i > start && /^ {2}[a-z][\w-]*:\s*$/.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

describe("workflows", () => {
  it("finds ci.yml and blog-images.yml", () => {
    expect(WORKFLOWS.map((w) => w.name)).toEqual(expect.arrayContaining(["ci.yml", "blog-images.yml"]));
  });

  it.each(WORKFLOWS.map((w) => [w.name, w.text] as const))("%s pins every action to a commit SHA", (_name, text) => {
    const uses = [...text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)];
    expect(uses.length).toBeGreaterThan(0);
    for (const [line, ref, rest] of uses) {
      expect(ref, line).toMatch(/^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/);
      expect(rest, line).toMatch(/#\s*v\d+/);
    }
  });

  it.each(WORKFLOWS.map((w) => [w.name, w.text] as const))("%s sets top-level permissions", (_name, text) => {
    expect(text).toMatch(/^permissions:/m);
  });
});

describe("blog-images.yml", () => {
  const text = WORKFLOWS.find((w) => w.name === "blog-images.yml")?.text ?? "";
  const convert = job(text, "convert");
  const commit = job(text, "commit");

  it("runs on this repository's pull requests with uploads, and grants nothing by default", () => {
    expect(text).toMatch(/^on:\n {2}pull_request:\n/m);
    expect(text).toContain('- "content/inbox/**"');
    expect(text).toMatch(/^permissions: \{\}$/m);
    expect(convert).toContain("if: github.event.pull_request.head.repo.full_name == github.repository");
    expect(commit).toContain("needs: convert");
  });

  it("gives the job that runs repository code a read-only token", () => {
    expect(convert).toMatch(/permissions:\n\s+contents: read\n/);
    expect(convert).not.toMatch(/: write/);
    expect(convert).toContain("persist-credentials: false");
    expect(convert).toContain("node scripts/check-config-integrity.mjs");
    expect(convert).toContain("pnpm test");
  });

  it("runs no repository code in the job that can write", () => {
    expect(commit).toMatch(/permissions:\n\s+contents: write\n/);
    for (const forbidden of ["pnpm", "npm ", "npx", "yarn", "corepack", "tsx", "setup-node", "node ", "scripts/", "make "]) {
      expect(commit, forbidden).not.toContain(forbidden);
    }
    expect(commit).toContain('git push origin "HEAD:refs/heads/$HEAD_REF"');
    expect(commit).not.toMatch(/push[^\n]*(?:--force|-f\b)/);
    // The branch name reaches the script only through an environment variable.
    expect(commit).not.toMatch(/run: [\s\S]*\$\{\{\s*github\.event\.pull_request\.head\.ref/);
  });
});
