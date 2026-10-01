#!/usr/bin/env bash
# The Install script of the Codex Cloud environment for kanchana404/portfolio
# (the weekly AI and dev digest), and the setup script of the Codex Cloud
# (Legacy) environment that @codex pull request comments run in. In the
# environment settings it is one reviewable line: bash scripts/codex-setup.sh
#
# Needs no secrets and no environment variables.
# Network during setup: registry.npmjs.org (pnpm and the locked packages).
# Network during tasks: the feed hosts in src/lib/feeds/sources.ts, nothing else.
# AGENTS.md forbids agents to edit this file.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
export NEXT_TELEMETRY_DISABLED=1

# 1. Stop at once if the integrity guard trips. Poisoned config files have been
#    pushed to this repository before. Node builtins only, so it runs before
#    any install executes repository code, on whatever Node is there.
node scripts/check-config-integrity.mjs

# 2. Node 22 (package.json "engines": "22.x"). The Codex image manages Node
#    with nvm; switch to its 22 when the default is another, and make 22 the
#    default so the task's own shells get it too.
if ! node -v | grep -q '^v22\.'; then
  nvm_sh="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [ -s "$nvm_sh" ]; then
    # nvm is not written for `set -eu`.
    set +eu
    # shellcheck disable=SC1090
    . "$nvm_sh"
    nvm use 22 >/dev/null 2>&1 || nvm install 22
    nvm alias default 22 >/dev/null
    set -eu
  fi
fi
if ! node -v | grep -q '^v22\.'; then
  echo "codex-setup: found Node $(node -v); this repository needs Node 22." >&2
  echo "Codex Cloud: ask Codex to install Node 22. Legacy: Set package versions > Node.js 22." >&2
  exit 1
fi
# NODE_USE_ENV_PROXY (used by pnpm digest:fetch) reaches fetch only in newer
# Node 22 releases. Only a warning: the environment may not need a proxy.
if ! node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 21) ? 0 : 1)'; then
  echo "codex-setup: WARN Node $(node -v) may ignore NODE_USE_ENV_PROXY; if pnpm digest:fetch reaches no feed, install Node 22.21 or later." >&2
fi

# 3. pnpm at the version package.json pins ("packageManager": "pnpm@10.28.0").
corepack enable || true
corepack install >/dev/null 2>&1 || npm install -g pnpm@10.28.0
if [ "$(pnpm -v)" != "10.28.0" ]; then
  echo "codex-setup: WARN pnpm $(pnpm -v); package.json pins 10.28.0." >&2
fi

# 4. Dependencies exactly as locked. pnpm 10 runs install scripts only for the
#    packages in pnpm.onlyBuiltDependencies (esbuild, unrs-resolver).
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
pnpm install --frozen-lockfile

# 5. Offline checks. Never `pnpm build` or `pnpm dev` here: next/font/google
#    downloads Inter from fonts.googleapis.com, which is not allowed. Vercel
#    builds each pull request's preview.
pnpm test
pnpm typecheck

# 6. Confirm the feed hosts answer (GET, a few kilobytes each). A warning, not
#    a failure: a feed that is down must not break the environment.
pnpm digest:fetch --check || echo "codex-setup: WARN a feed did not answer; check 'Additional allowed domains'." >&2

echo "codex-setup: OK"
