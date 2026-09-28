# Security

## Reporting

Email <kanchanakavitha6@gmail.com>. This is a personal site maintained by one
person; expect a human reply rather than a triage queue.

---

## Incident record

### 1. Build-time backdoor in build configs: repeated infections

**Status (2026-09-28):** the working tree, `main` on this machine and
`origin/main` (`edfc8e3`) are clean. **Not resolved:** whoever pushes the
payload still had write access to the owner's GitHub account as of
2026-09-19, credentials have not been rotated, and `origin/master` still
carries the payload (see "Outstanding" below).

An obfuscated JavaScript loader is appended to a build configuration file,
hidden by padding the real export with a few hundred spaces so the payload
sits far off the right edge of an editor and does not appear in a casual diff
view. It captures `require`, pulls its command-and-control address from an
Ethereum contract, and spawns `child_process`.

| File | Introduced | Removed |
|---|---|---|
| `next.config.mjs` | `990ae18`, 2025-11-07 | `366feb1`, 2026-06-18 (224 days) |
| `postcss.config.mjs` | `6d8414b`, 2026-06-28 | `63cdcdb` guard 2026-08-20; clean since `8201ddd` |
| `postcss.config.mjs` | `7db9982`, `204fbdb` (Aug 2026, force-pushed over the owner's own commits) | restored in `edfc8e3` |
| `postcss.config.mjs` | `14a8d4e` (2026-09-03), `81bf464` + `25020c8` (2026-09-22), on `main` | `main` force-restored to `edfc8e3` |
| `postcss.config.mjs`, `.vscode/tasks.json`, `public/fonts/fa-solid-400.woff2` | `abf31fe` on `master`, 2026-09-01 | **still on `origin/master`** |

The config files are evaluated by `next build`, `next dev`, `next lint` and
vitest, so until the guard landed the payload ran on every Vercel production
build with the full build environment in scope. `MONGODB_URI`,
`OPENAI_API_KEY` and any values once stored for `GITHUB_TOKEN`,
`IDEOGRAM_API_KEY` and `ADMIN_PASSWORD` must be treated as exposed. Every
poisoned build after 2026-08-20 stopped at the integrity check: the Vercel
logs of `14a8d4e`, `25020c8` and `abf31fe` end in `integrity FAIL
postcss.config.mjs`.

**Fingerprints.** The attacker's commits keep the owner's author name and
timestamp but show committer `Kavitha <146015143+kanchana404@users.noreply.github.com>`
(the owner commits as "Kavitha Kanchana", +0530) with a -0700 or +0000
timezone, or committer `GitHub` (web-flow). They are pushed from another
machine with the owner's credentials; nothing on this laptop injects them.

**Second vector.** `abf31fe` adds a hidden VS Code task (`runOn: folderOpen`)
that runs `node ./public/fonts/fa-solid-400.woff2`, a 30 kB JavaScript file
disguised as a font among real Font Awesome files, plus settings that turn on
automatic tasks and hide the terminal. Opening that checkout in VS Code runs
it. See §4 for the same campaign across the owner's other repositories.

**Checks that exist because of this**

- `scripts/check-config-integrity.mjs` freezes `postcss.config.mjs`,
  `next.config.mjs`, `tailwind.config.ts`, `vitest.config.mts`,
  `playwright.config.ts`, `.eslintrc.json` and `vercel.json` by SHA-256, and
  fails on: any `*.config.*` over 8 kB or with a 200+ space run, a `.vscode`
  task that runs on folder open, a file in `public/` whose bytes do not match
  its image or font extension, an SVG with script, and the loader's signature
  or heavy `_0x` obfuscation in any source file. It runs first in every CI job
  and before `dev`, `lint` and `build`.
- The owner's global git hooks (`~/.git-hooks`): `pre-commit` refuses the
  signature and whitespace padding; `post-merge` and `post-checkout` rerun the
  integrity check after every pull and branch switch.
- These are tripwires, not locks. Anyone who can push can edit them. Revoking
  that access is the fix.

**Outstanding (owner)**

- [ ] GitHub: change the password, sign out all sessions, check 2FA, revoke
      every personal access token (including the one in the local `.env`),
      OAuth app and GitHub App grant, SSH and deploy key; review the security
      log (`git.push`, `personal_access_token.*`) for 2026-08-20 to 2026-09-19.
- [ ] GitHub: protect `main` (block force-push and deletion, require a PR with
      CI, require signed commits).
- [ ] Then delete `origin/master` (`git push origin --delete master`) and ask
      GitHub Support to purge the unreachable poisoned commits and
      `refs/pull/*` heads.
- [ ] Rotate `MONGODB_URI` (Atlas user password; check access logs and users)
      and `OPENAI_API_KEY`; treat old `GITHUB_TOKEN`, `IDEOGRAM_API_KEY` and
      `ADMIN_PASSWORD` values as burned. Re-add them in Vercel as Sensitive,
      Production only, so preview builds of other branches never receive them.
- [ ] Vercel: delete the stale second project linked to this repo; build the
      next release once without the build cache.
- [ ] Review the blog collection for documents the owner did not write.

**History.** `7db9982` (in `main`'s history) still contains a payload blob.
Checking it out runs nothing, but running `next dev` at that commit would.
Rewriting it out (`git replace 7db9982 014369e` then `git filter-repo`) is
planned for after access is revoked, together with the force-push that
branch protection will then block for everyone else. Evidence of the poisoned
refs is kept outside the repo as a git bundle.

---

### 2. Unauthenticated admin API

**Status:** fixed and deployed (`edfc8e3`).

`src/middleware.ts` guarded `pathname.startsWith('/admin')` with the matcher
`['/admin', '/admin/((?!login|api).*)']`. The admin API is served from
**`/api/admin/*`**, which does not start with `/admin`, so the middleware never
executed on any of it.

The `(?!…|api)` exclusion in the matcher suggests its author believed the API
lived at `/admin/api`. It does not. The result was that these were callable by
any anonymous request against production:

| Endpoint | Methods | Effect |
|---|---|---|
| `/api/admin/blogs` | `POST`, `GET` | create a post; list all posts including drafts |
| `/api/admin/blogs/[id]` | `GET`, `PUT`, `DELETE` | read, edit or delete any post |
| `/api/admin/generate-image` | `POST` | spend the image-generation API key |
| `/api/admin/optimize-content` | `POST` | spend the OpenAI API key |
| `/api/data` | `POST`, `GET` | create posts, trigger image generation |
| `/api/debug/publish-blog` | `POST` | publish a post |
| `/api/debug/blogs` | `GET` | enumerate all posts including unpublished drafts |

Two further fail-open defects on the same surface:

- `src/middleware.ts` returned `NextResponse.next()` when `ADMIN_PASSWORD` was
  unset, commented "for development", but middleware runs in production too, so
  a missing environment variable **unlocked** the admin area.
- `/api/admin/login` used `correctPassword || 'admin123'`, accepting a hardcoded
  password whenever `ADMIN_PASSWORD` was unset. That literal is in git history
  permanently.

**Fix**

- Authorisation moved into the route handlers (`requireAdmin()` in
  `src/lib/auth/admin.ts`), because a matcher that silently fails to match is not
  something review catches. Middleware is retained as defence in depth for page
  routes only.
- Every path fails **closed** when `ADMIN_PASSWORD` is unset.
- The hardcoded fallback password is gone.
- Password comparison is constant-time over SHA-256 digests, in Web Crypto so it
  works on both the Edge and Node runtimes.
- The session cookie no longer stores the password. Since 2026-09-28 it holds
  a signed token (HMAC over its issue time, keyed by `ADMIN_SESSION_SECRET` or
  the password) that the server rejects after seven days. The old
  `admin-password` cookie is deleted on both login and logout.
- `/api/debug/*` and the public `/publish-blog` page are **deleted** rather than
  guarded: they were production scaffolding.
- `src/lib/auth/route-guards.test.ts` fails the build if any mutating handler
  under `/api` lacks a guard, if a hardcoded credential reappears, or if a
  fail-open pattern returns. Mutation-tested by removing a guard and confirming
  the suite goes red.

**Not verified against production.** These are code-level findings. Whether the
open endpoints were exploited can only be answered from database contents and
hosting logs; see the outstanding actions in §1.

---

### 3. Third-party analytics on pages that claimed otherwise

**Status:** fixed and deployed.

`TrackingScript` (`app.usecortana.ai`) was mounted in the **root** layout, so it
loaded on every tool page. Tool pages print "Runs in your browser — nothing
uploaded", derived from `ToolDef.compute` so the sentence cannot drift from what
a tool does. A third-party script on those pages made the claim false in a way
any visitor could see in devtools.

The pixel now lives in `src/app/(site)/layout.tsx`, scoped to the portfolio and
blog. `/privacy` documents what loads where.

---

### 4. The same campaign across the owner's other repositories

**Found:** 2026-09-28, by a read-only scan of the default branch of all 88
public `kanchana404` repositories.

82 were infected, split evenly between the two vectors: 41 carry the loader
appended to a config file (`postcss.config.mjs`, `next.config.mjs`,
`tailwind.config.js`, `vite.config.js` or `eslint.config.mjs`), and 41 carry
the `.vscode` folder-open task with its fake font. They include the projects
this site links to and the owner's OpenMRS forks, so a pull request from one
of those forks could carry the payload upstream.

Until the account is secured: do not clone, open in VS Code, install or run
any of them, and do not open pull requests from the forks. After it is
secured, each repository needs the same clean-up as this one.
