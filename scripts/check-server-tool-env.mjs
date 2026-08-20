#!/usr/bin/env node
/**
 * Refuses to build a server-backed tool whose public keys are missing.
 *
 * Every other tool on this site is pure browser: if it builds, it works. The
 * downloader is not. It needs `NEXT_PUBLIC_DOWNLOADER_API` to know where the
 * service is and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to raise the challenge, and
 * both are inlined at build time — so a build that runs without them produces a
 * page that renders perfectly, passes every test, and cannot complete a single
 * download.
 *
 * The failure is silent in the worst way. `turnstileConfigured()` returns false,
 * the widget sends no token, and the ticket route answers 403 challenge_required
 * to every visitor. Nothing logs an error; the tool simply never works, and the
 * evidence points at the challenge rather than at a missing build variable.
 *
 * So the build fails instead, with the variable named.
 *
 * Only on a real deployment. A local `pnpm build` and a preview build have no
 * business holding production keys, and making them fail would mean every
 * contributor needs a Cloudflare account to run `pnpm verify`.
 *
 * ## What each tool needs is read out of the code, not declared here
 *
 * The first version keyed off `compute: "railway"` and immediately flagged
 * pdf-to-text and pdf-to-images — two tools that are live, working, and talk to
 * a different service entirely (NEXT_PUBLIC_IMAGE_API). A hand-written list of
 * which tool needs which variable would have had the same bug a month later,
 * quietly, once somebody added a third service.
 *
 * So the widget's own import graph is walked instead and every
 * `process.env.NEXT_PUBLIC_*` it can reach is collected. A tool that stops using
 * a variable stops requiring it on the same commit, with nothing to remember.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CONTENT_DIR = "src/lib/tools/content";

/**
 * Gates the section as a whole rather than any one tool, and is checked by the
 * routes it guards. Requiring it here would make this script fail for reasons
 * that have nothing to do with the tool being examined.
 */
const SECTION_FLAGS = new Set(["NEXT_PUBLIC_TOOLS_LIVE"]);

/** Resolves an `@/`-prefixed import to a file, trying the usual extensions. */
function resolveLocal(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = join(fromFile, "..", spec);
  else return null; // a package, not ours

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      try {
        if (readFileSync(candidate).length >= 0) return candidate;
      } catch {
        /* a directory; fall through */
      }
    }
  }
  return null;
}

/** Every NEXT_PUBLIC_* name reachable from a module, following local imports. */
function publicEnvNamesReachableFrom(entry) {
  const seen = new Set();
  const found = new Set();
  const queue = [entry];

  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);

    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    for (const m of source.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
      if (!SECTION_FLAGS.has(m[1])) found.add(m[1]);
    }
    for (const m of source.matchAll(/from\s+"([^"]+)"/g)) {
      const next = resolveLocal(m[1], file);
      if (next) queue.push(next);
    }
  }
  return found;
}

// slug -> widget entry file, from the same map the route generator uses.
const widgetSource = readFileSync("scripts/widget-components.ts", "utf8");
const WIDGET_ENTRY = new Map();
for (const m of widgetSource.matchAll(
  /"([a-z0-9-]+)":\s*\{[^}]*?"from":\s*"([^"]+)"/gs
)) {
  const file = resolveLocal(m[2], "scripts/x.ts");
  if (file) WIDGET_ENTRY.set(m[1], file);
}

const isRealDeployment =
  process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

if (!isRealDeployment) {
  console.log(
    "server tools  skipped   not a Vercel production build; public keys are not expected here"
  );
  process.exit(0);
}

// Read the content files as text rather than importing them: this script runs
// before the TypeScript build, and a .ts import would need a loader.
const failures = [];
let checked = 0;

for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".ts"))) {
  const source = readFileSync(join(CONTENT_DIR, file), "utf8");

  // Each tool is an object literal with slug/status/compute somewhere inside.
  // Splitting on `slug:` gives one chunk per tool, which is enough to pair a
  // slug with the status and compute that follow it.
  const chunks = source.split(/\n\s*\{\s*\n\s*slug:/).slice(1);
  for (const chunk of chunks) {
    const slug = chunk.match(/^\s*"([^"]+)"/)?.[1];
    const status = chunk.match(/status:\s*"([^"]+)"/)?.[1];
    const compute = chunk.match(/compute:\s*"([^"]+)"/)?.[1];
    if (!slug || status === "draft") continue;
    // A browser tool cannot need a server variable, and saying so here keeps the
    // graph walk off 30 widgets that could never fail this check.
    if (compute === "browser") continue;

    const entry = WIDGET_ENTRY.get(slug);
    if (!entry) continue;

    const required = [...publicEnvNamesReachableFrom(entry)].sort();
    if (!required.length) continue;

    checked += 1;
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) failures.push({ slug, compute, missing });
  }
}

if (failures.length) {
  console.error("\nServer-backed tool is missing the variables it needs:\n");
  for (const { slug, compute, missing } of failures) {
    console.error(`  ${slug}  (compute: ${compute})`);
    for (const name of missing) console.error(`    missing  ${name}`);
  }
  console.error(
    "\nThese are inlined at build time, so adding them after this build will not\n" +
      "fix the deployed page — set them in the Vercel project and redeploy.\n" +
      "Set the tool back to status: \"draft\" if it is not meant to ship yet.\n"
  );
  process.exit(1);
}

console.log(
  `server tools  ok        ${checked} server-backed tool${checked === 1 ? "" : "s"} ` +
    `${checked ? "have every public variable" : "to check"}`
);
