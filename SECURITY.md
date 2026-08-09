# Security

## Reporting

Email <kanchanakavitha6@gmail.com>. This is a personal site maintained by one
person; expect a human reply rather than a triage queue.

---

## Incident record

### 1. Build-time backdoor in build configs — two infections

**Status:** payload removed from the working tree. Credential rotation
**outstanding**. Entry vector **never identified**.

An obfuscated JavaScript loader was appended to build configuration files, in
both cases hidden by padding the real export with whitespace so the payload sits
far off the right edge of an editor and does not appear in a casual diff view.

| File | Introduced | Removed | Exposure |
|---|---|---|---|
| `next.config.mjs` | `990ae18` — 2025-11-07 | `366feb1` — 2026-06-18 | **224 days** |
| `postcss.config.mjs` | `6d8414b` — 2026-06-28 | working tree, uncommitted | ~13 months to date |

The second infection landed **ten days after the first was cleaned**. That is the
most important fact in this file: it was not a single event, and remediating the
file did not remediate the cause. Whatever put it there had access again
afterwards.

Both files are evaluated by Next.js during `next build`, so the payload executed
on every Vercel production build in those windows, with the full build
environment in scope:

- `MONGODB_URI`
- `OPENAI_API_KEY`
- `GITHUB_TOKEN`
- `IDEOGRAM_API_KEY`
- `ADMIN_PASSWORD`

`366feb1`'s own commit message says *"Secrets in .env should be rotated
separately."* No rotation commit exists.

**Outstanding actions**

- [ ] Rotate all five credentials above.
- [ ] Review the blog collection for documents not authored by the owner.
- [ ] Review Vercel deployment history for builds not triggered by the owner.
- [ ] Identify the entry vector. Until this is known, assume it can recur —
      candidates worth eliminating: a compromised dependency with an install
      script, a compromised editor extension or MCP tool with write access, a
      leaked `GITHUB_TOKEN` used to push, or a machine compromise.

**Deliberately not done: rewriting git history.** All branch tips are clean, so
the payload is inert text in old commits — no checkout re-executes it. A
`filter-repo` and force-push would break every existing clone to remove
near-zero residual risk. The commits are recorded here instead.

**Detection.** `git ls-tree -r HEAD --name-only` filtered to script and config
files, scanned for `global['…']=`, `_$_` identifiers and
`createRequire(import.meta.url)` in a config that has no reason to require
anything. As of the working tree, `postcss.config.mjs` is 135 bytes and clean;
nothing else in the tree matches.

---

### 2. Unauthenticated admin API

**Status:** fixed in the working tree, **not yet deployed**.

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
  unset — commented "for development", but middleware runs in production too, so
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
- The session cookie no longer stores the password itself, only a digest derived
  from it. The old `admin-password` cookie is deleted on both login and logout.
- `/api/debug/*` and the public `/publish-blog` page are **deleted** rather than
  guarded — they were production scaffolding.
- `src/lib/auth/route-guards.test.ts` fails the build if any mutating handler
  under `/api` lacks a guard, if a hardcoded credential reappears, or if a
  fail-open pattern returns. Mutation-tested by removing a guard and confirming
  the suite goes red.

**Not verified against production.** These are code-level findings. Whether the
open endpoints were exploited can only be answered from database contents and
hosting logs — see the outstanding actions in §1.

---

### 3. Third-party analytics on pages that claimed otherwise

**Status:** fixed in the working tree.

`TrackingScript` (`app.usecortana.ai`) was mounted in the **root** layout, so it
loaded on every tool page. Tool pages print "Runs in your browser — nothing
uploaded", derived from `ToolDef.compute` so the sentence cannot drift from what
a tool does. A third-party script on those pages made the claim false in a way
any visitor could see in devtools.

The pixel now lives in `src/app/(site)/layout.tsx`, scoped to the portfolio and
blog. `/privacy` documents what loads where.
