import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural rules for the blog that ESLint would normally hold. The frozen
 * .eslintrc.json cannot get a blog override without a hash change, so they
 * live here instead, reading the source files as text.
 *
 * - The blog is server-only: `/blog/[slug]` is the bundle budget's canary,
 *   and the loader reads the filesystem at build.
 * - Its routes are fully static, so Vercel never reads content/ at request
 *   time.
 * - The modules the tsx CLIs load use relative imports only.
 */

const ROOT = process.cwd();
const rel = (file: string) => relative(ROOT, file).split("\\").join("/");

/** Non-test .ts and .tsx files under `dir`. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Import specifiers only, in either quote style: `from "x"`, side-effect
 * `import "x"` and dynamic `import("x")`. Reading specifiers rather than
 * scanning for substrings lets a file name a forbidden module in a comment
 * explaining why it does not import it.
 */
const importsOf = (source: string): string[] =>
  [
    /\bfrom\s+"([^"]+)"/g,
    /\bfrom\s+'([^']+)'/g,
    /\bimport\s+"([^"]+)"/g,
    /\bimport\s+'([^']+)'/g,
    /\bimport\(\s*"([^"]+)"\s*\)/g,
    /\bimport\(\s*'([^']+)'\s*\)/g,
  ].flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[1]));

/** A `"use client"` directive at the start of any line (stricter than "first statement"). */
const USE_CLIENT = /^["']use client["']/m;

const FORBIDDEN = [
  "next/link",
  "next/image",
  "motion",
  "motion/react",
  "framer-motion",
  "@/components/magicui/blur-fade",
  "@db",
  "mongoose",
  "react-dom/server",
];
const isForbidden = (specifier: string) =>
  FORBIDDEN.some((f) => specifier === f || specifier.startsWith(`${f}/`));

const BLOG_FILES = [
  ...sourceFiles(join(ROOT, "src/app/(site)/blog")),
  ...sourceFiles(join(ROOT, "src/lib/blog")),
];
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("blog boundaries", () => {
  it("finds the blog's files to check", () => {
    const found = BLOG_FILES.map(rel);
    for (const file of [
      "src/app/(site)/blog/page.tsx",
      "src/app/(site)/blog/[slug]/page.tsx",
      "src/app/(site)/blog/rss.xml/route.ts",
      "src/lib/blog/posts.ts",
      "src/lib/blog/render.ts",
    ]) {
      expect(found, `${file} was not scanned: the checks below would pass vacuously`).toContain(file);
    }
  });

  it("has no client component", () => {
    const offenders = BLOG_FILES.filter((f) => USE_CLIENT.test(readFileSync(f, "utf8"))).map(rel);
    expect(offenders, "the blog renders on the server only").toEqual([]);
  });

  it("imports no router, image, motion, database or renderer-to-string code", () => {
    const offenders = BLOG_FILES.flatMap((f) =>
      importsOf(readFileSync(f, "utf8"))
        .filter(isForbidden)
        .map((s) => `${rel(f)} imports ${s}`)
    );
    expect(offenders, "/blog/[slug] is the bundle budget's canary").toEqual([]);
  });

  it("keeps the filesystem loader out of client code", () => {
    const offenders = sourceFiles(join(ROOT, "src"))
      .filter((f) => {
        const source = readFileSync(f, "utf8");
        return (
          USE_CLIENT.test(source) &&
          importsOf(source).some((s) => /(^|\/)lib\/blog\/posts$/.test(s) || s === "./posts")
        );
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("pins the routes to static generation", () => {
    const index = read("src/app/(site)/blog/page.tsx");
    const post = read("src/app/(site)/blog/[slug]/page.tsx");
    const sitemap = read("src/app/sitemap.ts");
    const rss = read("src/app/(site)/blog/rss.xml/route.ts");

    expect(index).toMatch(/^export const dynamic = "error";$/m);
    expect(post).toMatch(/^export const dynamic = "error";$/m);
    // Without it, Next renders unknown slugs on demand at request time.
    expect(post).toMatch(/^export const dynamicParams = false;$/m);
    expect(sitemap).toMatch(/^export const dynamic = "force-static";$/m);
    expect(rss).toMatch(/^export const dynamic = "force-static";$/m);
    for (const source of [index, post, sitemap, rss]) {
      expect(source).not.toMatch(/^export const revalidate\b/m);
    }
  });

  it("keeps the modules the CLIs load free of the @/ alias", () => {
    const offenders = [
      "src/lib/blog/frontmatter.ts",
      "src/lib/blog/webp.ts",
      "src/lib/blog/dates.ts",
      "src/lib/blog/validate.ts",
      "src/lib/blog/posts.ts",
      "src/lib/slug.ts",
    ].flatMap((file) =>
      importsOf(read(file))
        .filter((s) => s.startsWith("@/"))
        .map((s) => `${file} imports ${s}`)
    );
    expect(offenders, "tsx does not resolve tsconfig paths for the CLIs; use a relative import").toEqual([]);
  });

  it("actually detects what it forbids", () => {
    // Without these, a pattern that matched nothing would make every check
    // above pass vacuously.
    expect(importsOf('import Link from "next/link";')).toEqual(["next/link"]);
    expect(importsOf("import { motion } from 'motion/react';")).toEqual(["motion/react"]);
    expect(importsOf('const m = await import("next/image");')).toEqual(["next/image"]);
    expect(importsOf("import 'mongoose';")).toEqual(["mongoose"]);
    expect(importsOf('import Blog from "@db/models/Blog";').every(isForbidden)).toBe(true);
    expect(isForbidden("motion-utils")).toBe(false);
    expect(USE_CLIENT.test('// a comment\n"use client";\nimport x from "y";')).toBe(true);
    expect(USE_CLIENT.test("const note = 'no client code here';")).toBe(false);
  });
});
