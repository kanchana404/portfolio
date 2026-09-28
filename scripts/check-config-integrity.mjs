#!/usr/bin/env node
/**
 * Fails the build if a build-time config file has been tampered with, or if
 * the repo carries one of the payloads this project has already been hit by.
 *
 * This exists because it happened, repeatedly. `postcss.config.mjs` was found
 * at 31,532 bytes instead of 135: the real config, then ~400 spaces of padding
 * to push the payload off the end of an editor's first screen, then obfuscated
 * JavaScript that captured `require`, pulled its command-and-control address
 * out of an Ethereum contract, and spawned `child_process`. Earlier it was
 * `next.config.mjs`. In September 2026 the same campaign moved to other
 * configs (`next.config.mjs`, `tailwind.config.js`, `vite.config.js`,
 * `eslint.config.mjs`) and to a second vector: a hidden `.vscode/tasks.json`
 * task that runs on folder open and executes a "font" in `public/fonts/` that
 * is really JavaScript.
 *
 * The config files are chosen because the tools load them: `next build`,
 * `next dev`, `next lint` and vitest all execute them, on a laptop, in CI, or
 * in a Vercel build container holding every production secret.
 *
 * Two kinds of check:
 *
 * 1. FROZEN files must match a known SHA-256. This is deliberately dumb: it
 *    does not try to recognise malware, it asserts that files which should
 *    rarely change have not changed. Any edit, obfuscated or not, fails it.
 * 2. Tripwires for the known patterns anywhere in the tree: an oversized or
 *    padded config file, an auto-run editor task, a public "image" or "font"
 *    whose bytes are not that format, an SVG with script, and the loader's
 *    signature in any source file.
 *
 * It is a tripwire, not a lock. Anyone who can push can edit this script and
 * package.json too; revoking their access is the real fix (SECURITY.md). Run
 * it from the repo root; it resolves paths against the working directory.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";

/**
 * Files that are effectively frozen, with the SHA-256 of their known-good
 * contents.
 *
 * If you legitimately change one of these, the build will fail and tell you the
 * new hash. Paste it in *in the same commit as the change*, so the update is
 * reviewable rather than a mystery.
 */
const FROZEN = {
  "postcss.config.mjs":
    "ac31e2a95ef64fe27ceb4124e101675273107aae2e33bc490b01d919e7f03646",
  "next.config.mjs":
    "39cf94c7a7baf752314a7fe14fd1b30cb65ed1158057f470df9708bc54dd81d5",
  "tailwind.config.ts":
    "ae73f1d40f4415530891796fe62fdc7d435eb0e81cf97a659e585476207cc5af",
  "vitest.config.mts":
    "d2995dd937ee595b0ce92f4d3a1bf177cc32854886f0a8b0775e57b5a432fafb",
  "playwright.config.ts":
    "18ff40896778b2b94cb3b6614bca37be5add9293c787d7c12777cba0c5b55d68",
  ".eslintrc.json":
    "2cae87531b8fa38f9f9edafd3387c5ae2c98ce6e312eb97e9aa7fa033f5595c2",
  "vercel.json":
    "870cad2a53961ef2ace09e2d5b03404b8e413f4191901de260f820dd3cadfb97",
};

/** Padding this long in a config file is a hiding place, not formatting. */
const SUSPICIOUS_RUN = /[ \t]{200,}/;

/** No config in this repo comes close; every payload so far was 26-33 kB. */
const CONFIG_MAX_BYTES = 8 * 1024;
const CONFIG_FILE = /(^|[\\/])[^\\/]+\.config\.(c|m)?(j|t)s$|(^|[\\/])\.eslintrc(\.[a-z]+)?$/;

/** The loader's fingerprints, as seen in every infected file so far. */
const LOADER_SIGNATURES = [
  /global\.i\s*=\s*["']A\d+-/,
  /global\[\s*["'][rmi]["']\s*\]\s*=/,
  /global\.[rm]\s*=\s*(require|module)\b/,
];
const OBFUSCATED_IDENT = /_0x[0-9a-f]{4,}/g;

/** Magic bytes for the binary formats public/ may hold. */
const MAGIC = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8,
  jfif: (b) => b[0] === 0xff && b[1] === 0xd8,
  webp: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  gif: (b) => b.subarray(0, 4).toString("latin1") === "GIF8",
  avif: (b) => b.subarray(4, 8).toString("latin1") === "ftyp",
  ico: (b) => b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0,
  woff: (b) => b.subarray(0, 4).toString("latin1") === "wOFF",
  woff2: (b) => b.subarray(0, 4).toString("latin1") === "wOF2",
  ttf: (b) => b.readUInt32BE(0) === 0x00010000 || b.subarray(0, 4).toString("latin1") === "true",
  otf: (b) => b.subarray(0, 4).toString("latin1") === "OTTO",
};

/** Not part of this repo, or generated. */
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".vercel", "downloader-api", "design-md",
  ".venv", "venv", "__pycache__", "test-results", "playwright-report",
  "blob-report", ".lighthouseci", "coverage", "out", "build",
]);

let failed = false;
const fail = (file, why) => {
  console.error(`integrity  FAIL     ${file}\n           ${why}`);
  failed = true;
};

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

// 1. Frozen files.
for (const [file, expected] of Object.entries(FROZEN)) {
  let body;
  try {
    body = readFileSync(file);
  } catch {
    console.error(`integrity  MISSING  ${file}`);
    failed = true;
    continue;
  }

  const actual = createHash("sha256").update(body).digest("hex");
  const text = body.toString("utf8");

  if (SUSPICIOUS_RUN.test(text)) {
    fail(
      file,
      "contains a run of 200+ spaces, which is how a payload is\n" +
        "           hidden past the right edge of an editor. Open it and look."
    );
    continue;
  }

  if (actual !== expected) {
    fail(
      file,
      `expected sha256 ${expected}\n` +
        `           actual   sha256 ${actual}  (${body.length} bytes)\n` +
        `           If YOU changed this file, put the actual hash above into\n` +
        `           scripts/check-config-integrity.mjs in the same commit.\n` +
        `           If you did not, do not build. See SECURITY.md.`
    );
    continue;
  }

  console.log(`integrity  ok       ${file}  (${body.length} bytes)`);
}

// 2. Tripwires across the tree.
let scanned = 0;
for (const path of walk(".")) {
  const file = relative(".", path).split(sep).join("/");
  const name = file.split("/").pop();
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  scanned++;

  // An editor task that runs by itself is how the second vector starts.
  if (file.includes(".vscode/")) {
    const text = readFileSync(path, "utf8");
    if (/folderOpen/.test(text) || /allowAutomaticTasks/.test(text)) {
      fail(file, "an editor task that runs on folder open. Delete the .vscode folder.");
    }
    continue;
  }

  if (file.startsWith("public/") && ext in MAGIC) {
    const head = Buffer.alloc(16);
    const bytes = readFileSync(path);
    bytes.copy(head, 0, 0, Math.min(16, bytes.length));
    if (!MAGIC[ext](head)) {
      fail(file, `its bytes are not a .${ext} file. A "font" or "image" that is really code is how the payload hides.`);
    }
    continue;
  }

  if (file.startsWith("public/") && ext === "svg") {
    const text = readFileSync(path, "utf8");
    if (/<script|\son[a-z]+\s*=|javascript:/i.test(text)) {
      fail(file, "an SVG with script in it.");
    }
    continue;
  }

  if (!["js", "mjs", "cjs", "ts", "mts", "cts", "tsx", "jsx", "json"].includes(ext)) continue;
  const size = statSync(path).size;
  if (size > 2 * 1024 * 1024) continue;
  const text = readFileSync(path, "utf8");

  if (CONFIG_FILE.test(file)) {
    if (size > CONFIG_MAX_BYTES) {
      fail(file, `a config file of ${size} bytes. Every payload so far was 26-33 kB appended to a small config.`);
      continue;
    }
    if (SUSPICIOUS_RUN.test(text)) {
      fail(file, "a config file with a run of 200+ spaces (code hidden off-screen?).");
      continue;
    }
  }

  if (ext === "json") continue;
  if (LOADER_SIGNATURES.some((re) => re.test(text))) {
    fail(file, "contains the obfuscated loader's signature.");
    continue;
  }
  const obfuscated = text.match(OBFUSCATED_IDENT);
  if (obfuscated && obfuscated.length > 50) {
    fail(file, `${obfuscated.length} _0x identifiers: obfuscated code.`);
  }
}

console.log(`integrity  ${failed ? "FAIL" : "ok"}       tripwires over ${scanned} files`);
process.exit(failed ? 1 : 0);
