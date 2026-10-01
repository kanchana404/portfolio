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
 * Three kinds of check:
 *
 * 1. FROZEN files must match a known SHA-256. This is deliberately dumb: it
 *    does not try to recognise malware, it asserts that files which should
 *    rarely change have not changed. Any edit, obfuscated or not, fails it.
 * 2. Tripwires for the known patterns anywhere in the tree: an oversized or
 *    padded config file, an auto-run editor task, a public "image" or "font"
 *    (or an upload in content/inbox) whose bytes are not that format, an SVG
 *    with script, and the loader's signature in any source file.
 * 3. Agent tripwires. Codex and Claude Code follow instruction files and load
 *    project config, so someone who can push could turn the owner's own agent
 *    against the owner. AGENTS.md, CLAUDE.md and the weekly-digest skill are
 *    FROZEN; every other file under .agents/ fails; so do an AGENTS.md or
 *    CLAUDE.md anywhere but the root, AGENTS.override.md and CLAUDE.local.md
 *    anywhere, a .codex/ folder (project config can switch the Codex sandbox
 *    off), a .mcp.json (adds MCP servers), an .agents/ or .claude/ folder
 *    below the root, .claude/settings.json, a .claude/settings.local.json
 *    that holds anything but permission rules (hooks, statusLine,
 *    apiKeyHelper and env all run commands), and project skills, commands,
 *    subagents or hooks under .claude/. These name checks cover every file
 *    git tracks or would add, in any folder, plus the scanned folders below.
 *
 * A symlink at the root or in a scanned folder fails too: the checks read
 * names and bytes, and a link would let `AGENTS.override.md` or
 * `.vscode/tasks.json` pass as something else. The repo tracks none.
 *
 * It is a tripwire, not a lock. Anyone who can push can edit this script and
 * package.json too; revoking their access is the real fix (SECURITY.md). Run
 * it from the repo root; it resolves paths against the working directory.
 */

import { execFileSync } from "node:child_process";
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
 *
 * vercel.json is not in this list: the Vercel build container rewrites it
 * before the build runs, so its bytes there never match the repo's. It gets
 * the size and padding checks below instead.
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
  // Agent instructions (see 3. above). Every edit to one of these needs its
  // new hash here in the same commit, made by the owner or at the owner's
  // explicit request, never by an agent on its own.
  "AGENTS.md":
    "88927861ff3c78c35beec8c924f188ef820c0d1580b4af8e3c1f8caa727d6d04",
  "CLAUDE.md":
    "bb69fdb134dfa93a5f110c79833dd48f0a770099484b6c1a5a7ebb7e7117dd2d",
  ".agents/skills/weekly-digest/SKILL.md":
    "2cf8b691488e031a51df03c10919fb48e4bd6fc6c8b4be9d11eb77736d13ad9c",
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

/**
 * Where the tripwires look: the repo's own top-level folders, plus every file
 * in the root. An allowlist rather than a skip list, because a build machine
 * adds folders of its own (the Vercel container held ~3,200 extra files) and
 * a cache full of third-party code is not this repo's to judge. `.vscode` is
 * included because the editor runs tasks from the root one.
 */
const SCAN_DIRS = [
  "src", "scripts", "public", "tests", "docs", "content", "image-api", ".github", ".claude", ".vscode", ".agents",
];

/** Agent instruction files: honoured only at the repo root, and never in their override forms. */
const AGENT_FILE = /^(?:AGENTS|CLAUDE)(?:\.override|\.local)?\.md$/i;
const AGENT_OVERRIDE = /^(?:AGENTS\.override|CLAUDE\.local)\.md$/i;

/**
 * What .claude/settings.local.json may hold: the permission rules Claude Code
 * writes there when the owner approves a command. Every other key is refused,
 * because so many run commands (hooks, statusLine, apiKeyHelper,
 * awsAuthRefresh, otelHeadersHelper, env with NODE_OPTIONS, plugins) that an
 * allowlist is the only list that stays complete. It is parsed, not matched
 * as text: JSON can spell `hooks` with \u escapes.
 */
const LOCAL_SETTINGS_KEYS = new Set(["$schema", "permissions"]);
const PERMISSION_KEYS = new Set(["allow", "deny", "ask", "additionalDirectories"]);

/** Generated or third-party folders, never scanned even inside SCAN_DIRS. */
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".venv", "venv", "__pycache__",
]);

let failed = false;
const fail = (file, why) => {
  console.error(`integrity  FAIL     ${file}\n           ${why}`);
  failed = true;
};
const SYMLINK =
  "a symlink. These checks read names and bytes, so a link could pass an agent file or an editor task off as " +
  "something else. The repo tracks no symlinks; replace it with a real file or delete it.";

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
    if (entry.isSymbolicLink()) fail(relative(".", path).split(sep).join("/"), SYMLINK);
    else if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

/**
 * Every file git tracks or would add (untracked and not ignored), anywhere in
 * the tree, or null where git or the repository is missing (the Vercel build
 * container). An ignored folder is skipped: nothing in it can be pushed.
 */
function gitFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
    return out.split("\0").filter((path) => path !== "");
  } catch {
    return null;
  }
}

/** Why a path is agent config the repo must not carry, from its name alone; or null. */
function agentPathProblem(file) {
  const parts = file.split("/");
  const name = parts[parts.length - 1];
  const lower = parts.map((part) => part.toLowerCase());
  if (AGENT_FILE.test(name) && (parts.length > 1 || AGENT_OVERRIDE.test(name))) {
    return "an agent instruction file outside the root, or an override: it would silently change AGENTS.md. Delete it.";
  }
  if (lower[0] === ".agents" && !Object.hasOwn(FROZEN, file)) {
    return "a file under .agents/ that is not hash-frozen: skills are agent instructions. Freeze it here or delete it.";
  }
  if (lower.includes(".codex") || lower.includes(".mcp.json")) {
    return "project-level agent config (Codex config or MCP servers). Delete it; keep it in user settings.";
  }
  if (lower.indexOf(".agents", 1) !== -1 || lower.indexOf(".claude", 1) !== -1) {
    return "an .agents/ or .claude/ folder below the root: agents load skills and settings from it. Delete it.";
  }
  if (lower[0] === ".claude" && ["skills", "commands", "agents", "hooks"].includes(lower[1] ?? "") && parts.length > 2) {
    return "project-level Claude Code skills, commands, subagents or hooks are agent instructions. Delete them.";
  }
  return null;
}

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** Why a .claude/settings*.json file must go, or null for permission rules alone. */
function claudeSettingsProblem(file, text) {
  if (file !== ".claude/settings.local.json") {
    return "shared Claude Code project settings. This repo keeps none: hooks, statusLine, apiKeyHelper and env run commands on the owner's machine. Delete it.";
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return "not valid JSON, so it cannot be checked. Delete it; Claude Code writes a new one.";
  }
  if (!isObject(data)) return "not a JSON object. Delete it.";
  for (const [key, value] of Object.entries(data)) {
    if (!LOCAL_SETTINGS_KEYS.has(key)) {
      return `sets ${JSON.stringify(key)}: only permission rules may live here (hooks, statusLine, apiKeyHelper, env and the like run commands). Move it to ~/.claude/settings.json or delete it.`;
    }
    if (key !== "permissions") continue;
    if (!isObject(value)) return "permissions is not an object. Delete the file.";
    for (const [rule, list] of Object.entries(value)) {
      if (!PERMISSION_KEYS.has(rule)) return `sets permissions.${rule}: only allow, deny, ask and additionalDirectories may live here.`;
      if (!Array.isArray(list) || !list.every((entry) => typeof entry === "string")) {
        return `permissions.${rule} is not a list of strings.`;
      }
    }
  }
  return null;
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

// vercel.json: not hashable (see FROZEN), but it must stay a small JSON file.
try {
  const body = readFileSync("vercel.json", "utf8");
  JSON.parse(body);
  if (body.length > 4096 || SUSPICIOUS_RUN.test(body)) {
    fail("vercel.json", "is oversized or padded; it should be a few hundred bytes of JSON.");
  }
} catch (error) {
  if (error && error.code !== "ENOENT") fail("vercel.json", "is not valid JSON.");
}

// Project Codex config at the root. The folder may be gitignored and is not
// in SCAN_DIRS, so it is looked up by name.
try {
  statSync(".codex");
  fail(".codex", "project Codex config can switch the sandbox or approvals off. Delete it; keep Codex settings in ~/.codex.");
} catch (error) {
  if (error && error.code !== "ENOENT") fail(".codex", `cannot be checked: ${error.code}`);
}

// 2. Tripwires across the repo's own files.
function* repoFiles() {
  for (const entry of readdirSync(".", { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.isSymbolicLink()) fail(entry.name, SYMLINK);
    else if (entry.isFile()) yield entry.name;
  }
  for (const dir of SCAN_DIRS) yield* walk(dir);
}

const scannedFiles = [...repoFiles()].map((path) => relative(".", path).split(sep).join("/"));

// 3. Agent tripwires, by name: over every file git carries, wherever it is,
// and the scanned folders (.claude/settings.local.json is usually ignored).
const tracked = gitFiles();
const agentPaths = new Set([...scannedFiles, ...(tracked ?? [])]);
for (const file of agentPaths) {
  // The root folder is reported above.
  if (file.split("/")[0] === ".codex") continue;
  const problem = agentPathProblem(file);
  if (problem) {
    fail(file, problem);
    continue;
  }
  if (/^\.claude\/settings[^/]*\.json$/i.test(file)) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (error) {
      fail(file, `cannot be checked: ${error && error.code}`);
      continue;
    }
    const settings = claudeSettingsProblem(file, text);
    if (settings) fail(file, settings);
  }
}
console.log(
  `integrity  ${failed ? "FAIL" : "ok"}       agent tripwires over ${agentPaths.size} paths` +
    (tracked ? "" : " (git unavailable: the root and scanned folders only)")
);

let scanned = 0;
for (const file of scannedFiles) {
  const name = file.split("/").pop();
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  scanned++;

  // An editor task that runs by itself is how the second vector starts.
  if (file.includes(".vscode/")) {
    const text = readFileSync(file, "utf8");
    if (/folderOpen/.test(text) || /allowAutomaticTasks/.test(text)) {
      fail(file, "an editor task that runs on folder open. Delete the .vscode folder.");
    }
    continue;
  }

  if ((file.startsWith("public/") || file.startsWith("content/inbox/")) && ext in MAGIC) {
    const head = Buffer.alloc(16);
    const bytes = readFileSync(file);
    bytes.copy(head, 0, 0, Math.min(16, bytes.length));
    if (!MAGIC[ext](head)) {
      fail(file, `its bytes are not a .${ext} file. A "font" or "image" that is really code is how the payload hides.`);
    }
    continue;
  }

  if (file.startsWith("public/") && ext === "svg") {
    const text = readFileSync(file, "utf8");
    if (/<script|\son[a-z]+\s*=|javascript:/i.test(text)) {
      fail(file, "an SVG with script in it.");
    }
    continue;
  }

  if (!["js", "mjs", "cjs", "ts", "mts", "cts", "tsx", "jsx", "json"].includes(ext)) continue;
  const size = statSync(file).size;
  if (size > 2 * 1024 * 1024) continue;
  const text = readFileSync(file, "utf8");

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
