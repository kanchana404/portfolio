import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The admin API was open to the internet because the middleware matcher never
 * matched `/api/admin/*`, so its guard never ran there (SECURITY.md, §2). There
 * are no sessions any more, so nothing may accept a write unless it is listed
 * here with a written reason.
 */

const APP = join(process.cwd(), "src/app");

/** Every route handler under src/app. Adding or removing one fails test (1). */
const EXPECTED_ROUTES = [
  "(site)/blog/rss.xml/route.ts",
  "api/github-contributions/route.ts",
  "api/tools/download-ticket/route.ts",
  "og/route.tsx",
  "sitemap-tools.xml/route.ts",
];

/**
 * Other places Next serves routes from. It looks for `app` and `pages` in the
 * project root before `src/` (next/dist/lib/find-pages-dir.js), so a root
 * `app` would replace src/app and either `pages` would add a second router.
 */
const OTHER_ROUTERS = ["app", "pages", "src/pages"];

/** Handlers that may accept a write, with the reason each one is safe. */
const MUTATING_ALLOWLIST: Record<string, string> = {
  "api/tools/download-ticket/route.ts":
    "Minting a download ticket is a public action by definition: it is what a visitor does before they have any credential at all, so requiring one is circular. It is not unguarded. The route verifies a Turnstile token server-side and refuses without one, refuses outright when TURNSTILE_SECRET is unset in production, and mints nothing at all if TICKET_SECRET or IP_SALT is missing. What it issues is deliberately weak: 120 seconds, single use, bound to the caller's own address, and useless against any endpoint but the downloader's. It mutates no state here, and the quota it feeds lives in the downloader's Redis rather than ours.",
};

const METHODS = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"];
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"];

/** Paths that were deleted with the admin area and must not come back. */
const REMOVED_PATHS = [
  "src/app/admin",
  "src/app/api/admin",
  "src/app/api/data",
  "db",
  "src/lib/auth",
  "src/lib/ideogram.ts",
  "src/lib/revalidate-blog.ts",
  "ADMIN_SETUP.md",
];

/** Everything Next or a script can load; `allowJs` is on in tsconfig.json. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

/** The bare name, so bracket access and destructuring count as a read too. */
const REMOVED_SECRET =
  /\b(ADMIN_PASSWORD|ADMIN_SESSION_SECRET|MONGODB_URI|IDEOGRAM_API_KEY|OPENAI_API_KEY)\b/;
/** `from`, side-effect `import`, dynamic `import()` and `require()`. */
const DATABASE_IMPORT =
  /\b(?:from|import|require)\s*\(?\s*['"](?:mongoose|mongodb|@db(?:\/[^'"]*)?)['"]/;

/** Route modules, by Next's default pageExtensions (next.config.mjs sets none). */
function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (/^route\.(?:ts|tsx|js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every non-test source file under `dir` with one of the given extensions. */
function sourceFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full, extensions));
    else if (
      extensions.some((ext) => entry.endsWith(ext)) &&
      !entry.endsWith(".test.ts")
    )
      out.push(full);
  }
  return out;
}

/**
 * Comments removed, so a file is never punished for *documenting* the hole it
 * fixed.
 *
 * Block comments go first, then whole-line `//` and `*` continuations. Inline
 * `//` is deliberately left alone so a URL in a string literal is not truncated;
 * that can only cause a missed detection, never a false accusation.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("//") && !t.startsWith("*");
    })
    .join("\n");
}

/** Every name a destructuring pattern binds, e.g. `{ a: POST, b: [PUT] }`. */
function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : boundNames(el.name)));
}

/**
 * The HTTP method handlers a route module exports, from its syntax tree rather
 * than a pattern. Next serves any named export whose name is a method, however
 * it was made: a declaration, a destructuring, a multi-declarator `const`, or
 * an export list with or without `as` and `from`. The earlier regexes missed
 * `export { POST }` and every re-export.
 *
 * `hidden` is set when names cannot be read statically: `export * from`,
 * `export =` and CommonJS `exports`. Test (3) treats that as a write.
 */
function exportsOf(fileName: string, source: string): { handlers: string[]; hidden: boolean } {
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest);
  const names = new Set<string>();
  let hidden = false;

  const isExported = (node: ts.Node) =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  for (const statement of tree.statements) {
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const decl of statement.declarationList.declarations) {
        boundNames(decl.name).forEach((n) => names.add(n));
      }
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      isExported(statement) &&
      statement.name
    ) {
      names.add(statement.name.text);
    } else if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      if (!clause) hidden = true;
      else if (ts.isNamespaceExport(clause)) names.add(clause.name.text);
      else clause.elements.forEach((el) => names.add(el.name.text));
    } else if (ts.isExportAssignment(statement) && statement.isExportEquals) {
      hidden = true;
    }
  }

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === "exports") hidden = true;
    ts.forEachChild(node, visit);
  };
  visit(tree);

  return { handlers: [...names].filter((n) => METHODS.includes(n)), hidden };
}

const files = routeFiles(APP).map((f) => {
  const raw = readFileSync(f, "utf8");
  return {
    rel: relative(APP, f).split("\\").join("/"),
    ...exportsOf(f, raw),
    /** Comment-free, for checks that would otherwise flag documentation. */
    code: stripComments(raw),
  };
});

describe("route surface", () => {
  it("has exactly the expected route handlers", () => {
    const found = files.map((f) => f.rel).sort();
    expect(
      found,
      "a route handler was added or removed; update EXPECTED_ROUTES in the same commit and say why"
    ).toEqual(EXPECTED_ROUTES);

    const routers = OTHER_ROUTERS.filter((p) => existsSync(join(process.cwd(), p)));
    expect(
      routers,
      `a second router would serve routes this test never sees: ${routers.join(", ")}`
    ).toEqual([]);
  });

  it("finds at least one exported handler in every route", () => {
    const offenders = files.filter((f) => f.handlers.length === 0).map((f) => f.rel);
    expect(
      offenders,
      `routes with no handler the scanner can see: ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("has no mutating handler unless it is allowlisted with a reason", () => {
    // Every form Next would serve. Without these, a parser regression would let
    // the scan below pass vacuously.
    const planted = [
      "export async function POST(request: Request) {}",
      "export const POST: Handler = handler;",
      "export const config = {}, POST = handler;",
      "export const { post: POST } = handlers;",
      "const POST = handler; export { POST };",
      "export { read as GET, write as POST, read as HEAD };",
      'export { write as "POST" };',
      'export { GET, POST } from "./impl";',
    ];
    for (const code of planted) {
      expect(exportsOf("route.ts", code).handlers, code).toContain("POST");
    }
    expect(exportsOf("route.js", "export async function POST() {}").handlers).toContain("POST");
    for (const code of ['export * from "./impl";', "exports.POST = handler;", "module.exports = { POST };"]) {
      expect(exportsOf("route.js", code).hidden, code).toBe(true);
    }
    expect(exportsOf("route.ts", "// export async function POST() {}").handlers).toEqual([]);

    const offenders: string[] = [];

    for (const file of files) {
      if (file.rel in MUTATING_ALLOWLIST) continue;
      const mutators = file.handlers.filter((h) => MUTATING.includes(h));
      if (file.hidden) mutators.push("export * or CommonJS exports");
      if (mutators.length > 0) offenders.push(`${file.rel} (${mutators.join(", ")})`);
    }
    for (const [rel, reason] of Object.entries(MUTATING_ALLOWLIST)) {
      if (reason.trim().length <= 40) offenders.push(`${rel} (reason too short)`);
    }

    expect(
      offenders,
      `mutating handlers without a written reason: ${offenders.join("; ")}. ` +
        `There is no session to check, so remove the handler or add an entry to MUTATING_ALLOWLIST explaining why it is safe.`
    ).toEqual([]);
  });

  it("has no stale allowlist entry", () => {
    const offenders: string[] = [];

    for (const rel of Object.keys(MUTATING_ALLOWLIST)) {
      const file = files.find((f) => f.rel === rel);
      if (!EXPECTED_ROUTES.includes(rel) || !file) {
        offenders.push(`${rel} (no such route)`);
        continue;
      }
      if (!file.handlers.some((h) => MUTATING.includes(h))) {
        offenders.push(`${rel} (no longer exports a mutating handler)`);
      }
    }

    expect(offenders, `stale MUTATING_ALLOWLIST entries: ${offenders.join("; ")}`).toEqual([]);
  });

  it("has no Server Actions", () => {
    // A Server Action is a POST endpoint without a route file, and there is no
    // auth left to put in front of one. The directive is matched anywhere, not
    // only at a line start, so a one-line function body counts too.
    const offenders = sourceFiles(join(process.cwd(), "src"), SOURCE_EXTENSIONS)
      .filter((f) => /['"]use server['"]/.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => relative(process.cwd(), f));

    expect(offenders, `'use server' found in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("has no hardcoded credential in a route or the middleware", () => {
    // `const expectedPassword = correctPassword || 'admin123'` shipped for
    // months. The literal is in git history forever; make sure it is not in the
    // working tree.
    const middleware = stripComments(
      readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8")
    );
    const offenders = [
      ...files.map((f) => ({ rel: f.rel, code: f.code })),
      { rel: "src/middleware.ts", code: middleware },
    ]
      .filter(({ code }) => /admin123|['"]password['"]\s*===\s*['"][^'"]+['"]/.test(code))
      .map(({ rel }) => rel);

    expect(offenders, `hardcoded credentials in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("keeps the removed surfaces removed", () => {
    const offenders = REMOVED_PATHS.filter((p) => existsSync(join(process.cwd(), p)));
    expect(
      offenders,
      `deleted with the admin area and back again: ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("has no code that reads the removed secrets or imports the database", () => {
    // Without the planted strings, a regex that matched nothing would make the
    // scan below pass vacuously.
    for (const planted of [
      'import Blog from "@db/models/Blog";',
      'import "mongodb";',
      'const db = await import("mongoose");',
      'const db = require("mongoose");',
    ]) {
      expect(planted).toMatch(DATABASE_IMPORT);
    }
    for (const planted of [
      "process.env.MONGODB_URI",
      'process.env["OPENAI_API_KEY"]',
      "const { ADMIN_PASSWORD } = process.env;",
    ]) {
      expect(planted).toMatch(REMOVED_SECRET);
    }

    const offenders: string[] = [];

    for (const dir of ["src", "scripts"]) {
      for (const f of sourceFiles(join(process.cwd(), dir), SOURCE_EXTENSIONS)) {
        const source = readFileSync(f, "utf8");
        // Secret names are matched bare, so comments are stripped first: a
        // note that a secret was removed is not a read.
        if (DATABASE_IMPORT.test(source) || REMOVED_SECRET.test(stripComments(source))) {
          offenders.push(relative(process.cwd(), f));
        }
      }
    }

    expect(
      offenders,
      `removed secrets or database imports in: ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("has no database driver in package.json", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const declared = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    const offenders = declared.filter((name) =>
      ["mongoose", "mongodb", "bson"].includes(name)
    );

    expect(offenders, `database packages declared: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("middleware", () => {
  const raw = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
  const source = stripComments(raw);

  it("matches the retired /tools section and nothing else", () => {
    const matcher = raw.slice(raw.indexOf("matcher:"));
    const paths = [...matcher.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(paths).toEqual(["/tools", "/tools/:path*"]);
  });

  it("keeps the 410 branch and no trace of the admin gate", () => {
    expect(source).toContain("TOOLS_SECTION_LIVE");
    expect(source).toMatch(/status:\s*410/);

    const leftovers = ["isAdminRequest", "cookies", "/admin"].filter((s) =>
      source.includes(s)
    );
    expect(leftovers, `admin gate leftovers: ${leftovers.join(", ")}`).toEqual([]);
  });
});
