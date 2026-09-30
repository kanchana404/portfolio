# Kavitha Kanchana: portfolio and blog

The source of [kavithakanchana.me](https://kavithakanchana.me): a single-column
portfolio after the [Magic UI portfolio template](https://github.com/magicuidesign/portfolio),
a blog built only from files in this repository, so a post goes live by being
pushed to `main`, and a `/tools` section that is built but switched off in
production.

- **Design system:** [DESIGN.md](DESIGN.md) is binding for any UI change.
- **Security:** [SECURITY.md](SECURITY.md) records past incidents and the checks
  that exist because of them. Read it before changing a build config.
- **Project cover images:** [docs/project-covers.md](docs/project-covers.md).

## Stack

Next.js 14 (app router), React 18, TypeScript, Tailwind CSS 3 with shadcn/ui
and Magic UI components, motion, Lenis smooth scrolling, rough-notation
highlights. Deployed on Vercel from `main`.

## Getting started

Node 22 (`.nvmrc`) and pnpm 10 (pinned in `package.json` as `packageManager`;
`corepack enable` picks it up).

```bash
pnpm install
pnpm dev
```

The homepage works without any environment variables. The blog needs no
environment variables either.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | integrity check, then `next dev` |
| `pnpm build` | integrity check, tools env check, unit tests, `next build` |
| `pnpm verify` | everything CI's static and build jobs run |
| `pnpm test` / `pnpm test:browser` | Vitest unit tests / Playwright browser tests |
| `pnpm budget` | first-load JS budgets per route (after a build) |
| `pnpm integrity` | the config and payload tripwires in `scripts/check-config-integrity.mjs` |
| `pnpm lighthouse` | Lighthouse CI on `/`, `/blog`, `/privacy` (after a build) |

`scripts/check-config-integrity.mjs` runs first in every CI job and before
`dev`, `lint` and `build`. If it fails, do not run the project: see
SECURITY.md.

`pnpm test` and `pnpm build` refuse any post that still contains TODO or
template placeholders, a broken link or image, or bad frontmatter: that is the
publish gate (`src/lib/blog/validate.ts`). There are no drafts, so the gate
is what stands between a half-written post and production.

## Environment variables

Set them in Vercel as **Sensitive** and **Production** only.

| Variable | Used by |
|---|---|
| `GITHUB_TOKEN` | the homepage's GitHub contributions calendar (a fine-grained token with public-repository read access is enough) |

The tools section adds `NEXT_PUBLIC_TOOLS_LIVE`, `NEXT_PUBLIC_IMAGE_API`,
`NEXT_PUBLIC_DOWNLOADER_API`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
`TURNSTILE_SECRET`, `TICKET_SECRET` and `IP_SALT`; it answers 410 while
`TOOLS_SECTION_LIVE` is false (`src/lib/tools/section-flag.ts`). Keep
`NEXT_PUBLIC_IMAGE_API`, `NEXT_PUBLIC_DOWNLOADER_API` and
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` set in Vercel even while it is off:
`scripts/check-server-tool-env.mjs` fails a production build without them.

## Layout

```
src/app/(site)/      homepage, blog, privacy (Lenis, header grid, analytics)
src/app/(tools)/     the dark /tools section, one generated route per tool
src/app/api/         GitHub contributions and the tools download ticket
src/app/og/          OG images
src/components/      section/*, magicui/*, ui/* (shadcn), tools/*
src/data/resume.tsx  all portfolio content
src/lib/blog/        the post loader, publish gate, renderer and RSS feed
content/blog/        posts, one <slug>.md each (no drafts: whatever is on main is live)
public/blog/<slug>/  post images (WebP)
image-api/           the Python image and PDF service behind the tools section
public/              logos, skill marks, project covers (WebP)
```

`public/googledebbf391340cc4a2.html` is the Google Search Console
verification file; keep it.

## License

MIT. Based on the portfolio template by Dillion Verma (see `LICENSE`).
