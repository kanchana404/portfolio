import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readContentSnapshot } from "./posts";
import { validateCollection } from "./validate";

/**
 * readContentSnapshot over a real folder tree, for what a made-up snapshot in
 * validate.test.ts cannot show: how the disk is listed.
 */

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function tree(files: string[], folders: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "blog-"));
  roots.push(root);
  for (const file of ["content/blog/.gitkeep", "content/inbox/README.md", ...files]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), "x");
  }
  for (const folder of folders) mkdirSync(join(root, folder), { recursive: true });
  return root;
}

describe("readContentSnapshot: content/inbox", () => {
  it("leaves out the empty folder the blog-images Action leaves behind, which git cannot carry", () => {
    const root = tree([], ["content/inbox/ai-dev-news-2026-w40", "content/inbox/a/b"]);
    const snapshot = readContentSnapshot(root);
    expect(snapshot.inboxEntries).toEqual(["README.md"]);
    expect(validateCollection(snapshot, "2026-10-01").issues).toEqual([]);
  });

  it("lists every upload, a folder deeper than three levels, and a symlink", () => {
    const root = tree(["content/inbox/ai-dev-news-2026-w40/1-agents.png", "content/inbox/2.png"], ["content/inbox/a/b/c/d"]);
    symlinkSync("README.md", join(root, "content/inbox/linked"));
    const snapshot = readContentSnapshot(root);
    expect(snapshot.inboxEntries).toEqual(["2.png", "README.md", "a/b/c/d/", "ai-dev-news-2026-w40/1-agents.png", "linked@"]);
    expect(validateCollection(snapshot, "2026-10-01").issues.map((i) => i.rule)).toEqual(["inbox", "inbox", "inbox", "inbox"]);
  });

  it("treats a missing content/inbox as empty", () => {
    const root = tree([]);
    rmSync(join(root, "content/inbox"), { recursive: true });
    expect(readContentSnapshot(root).inboxEntries).toEqual([]);
  });
});
