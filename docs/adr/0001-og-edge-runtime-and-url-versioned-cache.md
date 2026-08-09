# ADR 0001 — `/og` runs on the edge, and its cache is invalidated by URL

**Status:** accepted · **Date:** 2026-08-09 · **Sprint:** 1 (Phase A)

## Context

`src/app/og/route.tsx` renders a 1200×630 social card with satori (layout) plus
resvg-wasm (rasterisation). As shipped it had **no `runtime` export and no
`Cache-Control` header**.

Both omissions compound:

- No `runtime` meant the Node.js serverless runtime, which is the most expensive
  way to run this workload.
- No `Cache-Control` meant Vercel's CDN stored nothing, so *every* hit was a
  fresh render — every Googlebot pass, every Slack unfurl, every LinkedIn
  re-scrape, every Twitter card refresh, every Discord link hover.

The URL is public and unauthenticated, so a single person looping
`curl '/og?title=$RANDOM'` was an uncapped compute bill against a portfolio site.

## Decision

1. **`export const runtime = "edge"`.** satori and resvg-wasm in `next/og` are
   built for it, cost a fraction of a Node lambda per invocation, and have no
   cold-start penalty. Verified in `.next/server/middleware-manifest.json`, which
   now lists `/og/route` under `functions`.

2. **`Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable,
   no-transform`.** The output is a pure function of `(kind, title)`, so a repeat
   request never needs to re-render.

3. **Invalidation is by URL, not by header.** `immutable` for a year means a
   fetched card is never re-fetched, so a design change can only be published by
   changing the URL. `OG_VERSION` in `src/lib/og.ts` is stamped into every
   generated URL by `ogImageUrl()`, and **all callers must build URLs through
   that helper**. Bumping the constant re-points every caller at once.

   The rejected alternative was the sprint plan's "bump `CACHE_BUSTER` and update
   the callers". That is a discipline problem with a one-year fuse on it; routing
   every caller through one function makes forgetting impossible.

4. **Input is normalised, not trusted.** `normaliseOgTitle()` strips control
   characters, collapses whitespace, and clamps to 110 code points. The route
   re-applies it to whatever arrives on the wire rather than assuming the caller
   used the helper. The function is idempotent (proved in `src/lib/og.test.ts`),
   so a helper-built URL passes through byte-identical.

5. **`kind` is a closed set.** `"tool"` selects the green tools card; anything
   else — including garbage — falls back to the original blue blog card, so old
   URLs with no `kind` parameter keep rendering exactly what they rendered before.

## Consequences

- `(site)/opengraph-image.tsx` deliberately **stays on Node**: it reads a
  headshot off disk with `node:fs/promises`. It is statically prerendered, so it
  renders once at build time and never per request. Do not "unify" the two.
- Clamping the title bounds the cost of any *single* render. It does not bound
  the *number* of distinct cache keys an attacker can mint. Accepted: an edge
  invocation that immediately CDN-caches is cheap, and Vercel's platform
  protections sit in front of it. Revisit only if the `/og` invocation count on
  the Vercel dashboard stops tracking real referral traffic.
- Codepoint-accurate clamping matters for the cache key as well as for looks: a
  UTF-16 slice could split an emoji, and two visually identical titles that
  differ by a lone surrogate would occupy two cache entries.

## Verification

```bash
# Edge, not Node
node -e "console.log(Object.keys(require('./.next/server/middleware-manifest.json').functions))"
# => [ '/og/route' ]

# After deploy
curl -sI 'https://kavithakanchana.me/og?kind=tool&title=Percentage%20Calculator&v=1' \
  | grep -iE 'cache-control|x-vercel-cache'
# expect: cache-control: public, max-age=31536000, s-maxage=31536000, immutable, no-transform
# second identical request expect: x-vercel-cache: HIT
```

Record the `/og` invocation count for the 24h before and after the deploy;
`docs/baselines.md` holds the pre-change header capture.
