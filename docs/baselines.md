# Performance baselines

Recorded **before** Sprint 1 touched anything, on `feat/sprint1-tools-platform`
branched from `tools-platform-phase0`. Every budget in the tools platform is
expressed as a delta against these numbers, so do not "refresh" them casually —
a baseline you move whenever it is inconvenient is not a baseline.

Re-record only when a change to the **shared** chunk is deliberate and reviewed
(a framework upgrade, a dependency removal), and note why in this file.

## Bundle — `pnpm build`, clean `.next`

| Route | Page size | First Load JS |
|---|---|---|
| `/` | 20.3 kB | **198 kB** |
| `/blog` | 178 B | 96.1 kB |
| `/blog/[slug]` | 152 B | **87.4 kB** |
| `/admin` | 3.27 kB | 107 kB |
| shared by all | — | **87.2 kB** |
| middleware | — | 26.4 kB |

Shared chunk composition at baseline:

- `chunks/2200cc46-*.js` — 53.7 kB (React + Next runtime)
- `chunks/945-*.js` — 31.7 kB
- other shared — 1.88 kB

## Budgets derived from the baseline

These are enforced by `scripts/check-bundle-budget.mjs` and fail the build.

| Route | Budget | Why this number |
|---|---|---|
| `/` | ≤ **204 kB** (baseline + 6 kB) | The homepage links into `/tools`. If adding that link costs more than 6 kB, the registry is dragging widget code into the homepage graph — see the `Widget`-on-`ToolDef` note in `docs/sprint-plan/SPRINT-PLAN.md` Part II. |
| `/blog/[slug]` | ≤ **87.4 kB** (no regression) | A route with no tools on it. If this grows after a tool ships, something imports `TOOLS` transitively into the blog graph. This is the canary. |
| `/tools/[slug]` | ≤ **97.4 kB** (`/blog/[slug]` + 10 kB) | Shared chunk + shell + one lazily-mounted widget frame. Widgets themselves are `dynamic(ssr:false)` and are not counted here. |
| shared by all | ≤ **87.2 kB** (no regression) | Anything that grows the shared chunk grows *every* route including the homepage. |

## Route runtime at baseline

`/og` was `ƒ (Dynamic)` — Node.js serverless, **no `runtime` export and no
`Cache-Control`**. Every crawler hit, Slack unfurl and LinkedIn re-scrape ran a
full satori layout + resvg-wasm rasterisation as a fresh function invocation, on
a public unauthenticated URL. Fixed in this sprint; see `docs/adr/0001-og-edge-runtime.md`.

## `/og` response headers at baseline

```
$ curl -sI 'https://kavithakanchana.me/og?title=test'
# (no cache-control header present — CDN stores nothing, every hit is an invocation)
```

Re-run that command after deploy and confirm `cache-control: public,
max-age=31536000, s-maxage=31536000, immutable` plus `x-vercel-cache: HIT` on the
second request.
