import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The feed code handles text from strangers, so it stays small and inert:
 *
 * - The site never imports it: network code and third-party text stay out of
 *   every page bundle.
 * - It imports no framework and no child_process, evaluates nothing, and uses
 *   relative imports only (the tsx CLIs do not resolve `@/`).
 * - The CLIs in scripts/digest/ import only src/lib and Node builtins.
 */

const ROOT = process.cwd();
const rel = (file: string) => relative(ROOT, file).split("\\").join("/");

function files(dir: string, test: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...files(full, test));
    else if (test(entry)) out.push(full);
  }
  return out;
}

const importsOf = (source: string): string[] =>
  [
    /\bfrom\s+"([^"]+)"/g,
    /\bfrom\s+'([^']+)'/g,
    /\bimport\s+"([^"]+)"/g,
    /\bimport\s+'([^']+)'/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ].flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[1]));

const EVAL = /\beval\s*\(|\bnew\s+Function\s*\(/;

const FEEDS = files(join(ROOT, "src/lib/feeds"), (n) => n.endsWith(".ts") && !n.endsWith(".test.ts"));
const CLIS = files(join(ROOT, "scripts/digest"), (n) => n.endsWith(".ts"));
const SITE = [
  ...files(join(ROOT, "src/app"), (n) => /\.tsx?$/.test(n)),
  ...files(join(ROOT, "src/components"), (n) => /\.tsx?$/.test(n)),
];

describe("feed code boundaries", () => {
  it("finds the files it checks", () => {
    expect(FEEDS.map(rel)).toEqual(
      expect.arrayContaining(["src/lib/feeds/xml.ts", "src/lib/feeds/http.ts", "src/lib/feeds/collect.ts"])
    );
    expect(CLIS.map(rel)).toEqual(expect.arrayContaining(["scripts/digest/fetch.ts", "scripts/digest/check.ts"]));
    expect(SITE.length).toBeGreaterThan(20);
  });

  it("is never imported by the site", () => {
    const offenders = SITE.filter((f) => importsOf(readFileSync(f, "utf8")).some((s) => /(^|\/)lib\/feeds(\/|$)/.test(s)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("imports only relative modules and a few Node builtins", () => {
    const allowed = new Set(["node:zlib"]);
    const offenders = FEEDS.flatMap((f) =>
      importsOf(readFileSync(f, "utf8"))
        .filter((s) => !s.startsWith("./") && !s.startsWith("../") && !allowed.has(s))
        .map((s) => `${rel(f)} imports ${s}`)
    );
    expect(offenders).toEqual([]);
  });

  it("the CLIs import src/lib by relative path and Node builtins only; only check.ts runs git", () => {
    const offenders = CLIS.flatMap((f) =>
      importsOf(readFileSync(f, "utf8"))
        .filter((s) => !s.startsWith("../../src/lib/") && !s.startsWith("node:"))
        .map((s) => `${rel(f)} imports ${s}`)
    );
    expect(offenders).toEqual([]);
    const childProcess = CLIS.filter((f) => importsOf(readFileSync(f, "utf8")).includes("node:child_process")).map(rel);
    expect(childProcess).toEqual(["scripts/digest/check.ts"]);
  });

  it("keeps every request of the fetch CLI on its source's own host", () => {
    const fetchCli = readFileSync(join(ROOT, "scripts/digest/fetch.ts"), "utf8");
    const calls = [...fetchCli.matchAll(/\bgetBytes\(([^;]*?)\);/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const args of calls) expect(args, args).toMatch(/allowedHosts: hostOf\(source\)|, hosts$/);
    expect(fetchCli).not.toMatch(/allowedHosts:\s*FEED_HOSTS/);
  });

  it("evaluates no code", () => {
    const offenders = [...FEEDS, ...CLIS].filter((f) => EVAL.test(readFileSync(f, "utf8"))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("actually detects what it forbids", () => {
    expect(importsOf('import { x } from "@/lib/feeds/xml";')).toEqual(["@/lib/feeds/xml"]);
    expect(importsOf("const cp = require('child_process');")).toEqual(["child_process"]);
    expect(importsOf('await import("next/server")')).toEqual(["next/server"]);
    expect(EVAL.test("const f = new Function('return 1');")).toBe(true);
    expect(EVAL.test("eval (code)")).toBe(true);
    expect(EVAL.test("medieval(times)")).toBe(false);
  });
});
