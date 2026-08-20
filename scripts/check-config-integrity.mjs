#!/usr/bin/env node
/**
 * Fails the build if a build-time config file has been tampered with.
 *
 * This exists because it happened. Twice. `postcss.config.mjs` was found at
 * 31,532 bytes instead of 135: the real config, then ~400 spaces of padding to
 * push the payload off the end of an editor's first screen, then obfuscated
 * JavaScript that captured `require`, pulled its command-and-control address
 * out of an Ethereum contract, and spawned `child_process`.
 *
 * The file choice is not random. Next.js loads `postcss.config.mjs` during
 * `next build`, so the payload runs on any machine that builds the project:
 * a laptop, CI, or a Vercel build container holding every production secret.
 * A config file is also the last place anyone looks, and diffs of it are
 * routinely skimmed.
 *
 * The check is deliberately dumb. It does not try to detect malware, because a
 * scanner is a game you lose to the next variant. It asserts that files which
 * should never change have not changed, which is a game with no moves for the
 * attacker: any edit, obfuscated or not, fails it.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

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
};

/** Padding this long in a config file is a hiding place, not formatting. */
const SUSPICIOUS_RUN = /[ \t]{200,}/;

let failed = false;

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
    console.error(
      `integrity  FAIL     ${file}\n` +
        `           contains a run of 200+ spaces, which is how a payload is\n` +
        `           hidden past the right edge of an editor. Open it and look.`
    );
    failed = true;
    continue;
  }

  if (actual !== expected) {
    console.error(
      `integrity  FAIL     ${file}\n` +
        `           expected sha256 ${expected}\n` +
        `           actual   sha256 ${actual}  (${body.length} bytes)\n` +
        `           If YOU changed this file, put the actual hash above into\n` +
        `           scripts/check-config-integrity.mjs in the same commit.\n` +
        `           If you did not, do not build. See SECURITY.md.`
    );
    failed = true;
    continue;
  }

  console.log(`integrity  ok       ${file}  (${body.length} bytes)`);
}

process.exit(failed ? 1 : 0);
