# Blog admin

A password-protected area at `/admin` for writing, editing, publishing and
deleting blog posts, with optional AI cover images (Ideogram) and content
optimisation (OpenAI).

## Configuration

```env
MONGODB_URI=...            # required
ADMIN_PASSWORD=...         # required; a long random string
ADMIN_SESSION_SECRET=...   # recommended; a separate random string
IDEOGRAM_API_KEY=...       # optional, for "Generate image"
OPENAI_API_KEY=...         # optional, for the optimise buttons
```

Locally, put them in `.env.local`. In Vercel, add them as Sensitive,
Production-only variables. Without `ADMIN_PASSWORD` every login is refused
(503): the area fails closed.

Before enabling it in production, add a Vercel firewall rate-limit rule for
`POST /api/admin/login` (for example 5 requests a minute per IP).

## How access works

- `POST /api/admin/login` checks the password in constant time and sets an
  httpOnly, SameSite=Strict cookie holding a signed token that the server
  rejects after seven days. Changing `ADMIN_PASSWORD` or
  `ADMIN_SESSION_SECRET` signs every session out.
- Every privileged route handler calls `requireAdmin()` from
  `src/lib/auth/admin.ts`; that is the authorisation boundary.
  `src/middleware.ts` only redirects page requests, as defence in depth.
  `src/lib/auth/route-guards.test.ts` fails the build if a mutating handler
  loses its guard.
- In production the admin pages send a strict Content-Security-Policy
  (`next.config.mjs`).

## Using it

1. Go to `/admin/login` and sign in.
2. Create, edit, publish, unpublish or delete posts from the dashboard. A post
   needs a title, an excerpt (300 characters at most), content and a cover
   image (generated or a URL).
3. Saving refreshes the affected blog pages and the sitemap at once.

`POST /api/data` (admin session required) ingests a finished post from an
automation: `{ title, link, content, date, publish? }`. It generates one cover
image when `IDEOGRAM_API_KEY` is set and otherwise uses the post's generated
OG card.

## Development

```bash
pnpm install
pnpm dev
```
