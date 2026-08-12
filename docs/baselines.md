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
| `/tools/[slug]` | ≤ **100 kB** | Shared chunk + shell + the dynamic-import loader. Widgets are code-split one chunk each and are not counted here — see ADR 0003. |
| widget delta (`/tools/[slug]` − `/tools`) | ≤ **5 kB** | Tripwire on a widget being statically imported back into the client boundary. Measured 1.4 kB at 17 tools. |
| shared by all | ≤ **87.2 kB** (no regression) | Anything that grows the shared chunk grows *every* route including the homepage. |

## Measured after Sprint 1, 17 tools shipped

Recorded 2026-08-09 with `scripts/check-bundle-budget.mjs`, which gzips and reads
~2 kB lower than Next's own build table. Compare against the budgets above, not
against the build output.

| Route | Measured | Budget |
|---|---|---|
| `/` | 194.5 kB | 200 kB |
| `/blog/[slug]` | 85.9 kB | 88 kB |
| `/blog` | 94.4 kB | 96 kB |
| `/tools` | 94.4 kB | 100 kB |
| `/tools/[slug]` | 95.8 kB | 100 kB |
| `/tools/category/[category]` | 94.4 kB | 100 kB |
| widget delta | 1.4 kB | 5 kB |

`/blog/[slug]` at 85.9 kB against its 87.4 kB baseline is the canary holding: no
tool code has leaked into the blog graph.

The widget delta was 27.5 kB before ADR 0003 moved the map behind a client
boundary. It is now roughly constant rather than linear in the number of tools.

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
