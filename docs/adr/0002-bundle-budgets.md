# ADR 0002 — Bundle budgets are measured against the platform floor, not the blog

**Status:** accepted · **Date:** 2026-08-09 · **Sprint:** 1

## Context

The sprint plan sets the tool-page budget as:

> First Load JS for `/tools/[slug]` ≤ First Load JS for `/blog/[slug]` + 10 kB

At baseline `/blog/[slug]` is 87.4 kB, so that is a 97.4 kB ceiling. The first
tool page landed at 98.3 kB — nominally a failure.

Investigating rather than accepting the number produced two findings.

**`/blog/[slug]` imports no `next/link`.** Verified: the file has zero
`next/link` imports, so it never loads the ~25 kB router/link runtime chunk.
Every tools route needs that chunk structurally — breadcrumbs, related tools, the
link back to the hub, the category link in the meta row. Budgeting a linked page
against an unlinked one charges the tools section for a cost it cannot avoid and
that has nothing to do with tools.

**The widget itself costs 2.2 kB.** `/tools` (the hub, no widget) is 96.1 kB and
`/tools/[slug]` is 98.3 kB. With the platform floor cancelled out on both sides,
one widget costs 2.2 kB. That is the number worth governing, and the plan's
formula obscures it.

Two genuine regressions surfaced on the way and were fixed rather than budgeted
around:

- `next/image` was pulling a ~12 kB client runtime into every tool page to render
  a 48×48 author avatar. The full headshot is 272 kB at 896×1195, so a plain
  `<img>` pointed at it would have been far worse. Fixed with a purpose-built
  96×96 crop (~6 kB) served by a plain `<img>` with explicit dimensions — no
  JavaScript and no layout shift.
- The widget imported `@/components/ui/input` and `@/components/ui/label`, which
  go through `cn()` and therefore ship **`tailwind-merge`, ~21 kB**, plus
  `@radix-ui/react-label` and `class-variance-authority`. `tailwind-merge` earns
  its weight resolving conflicting classes from a `className` prop; a
  self-contained widget has neither. Replaced with dependency-free primitives in
  `src/components/tools/ui.tsx`.

Those two fixes took the route from 112 kB to 98.3 kB.

## Decision

`scripts/check-bundle-budget.mjs` enforces five things, chosen because each maps
to a way this can actually go wrong:

| Check | Budget | Failure it catches |
|---|---|---|
| Shared chunk does not grow | — | The most expensive regression possible: it lands on every route, blog and homepage included |
| `/` | ≤ 200 kB | The registry dragging widget code into the homepage graph |
| `/blog/[slug]` | ≤ 88 kB | **The canary.** A route with no tools on it. Growth here means the registry leaked into a graph that should never see it |
| `/tools/[slug]` | ≤ 108 kB | Absolute ceiling |
| **Widget delta** (`/tools/[slug]` − `/tools`) | ≤ 8 kB | A heavy dependency inside a widget, with the platform floor cancelled out |
| Forbidden modules in `/(tools)` first-load chunks | 0 | `onnxruntime`, `pdfjs`, `pdf-lib`, `libheif`, `jsquash`, `jszip`, `mediapipe`, `opencv` — all must sit behind `dynamic(ssr:false)` and a user gesture |

Sizes are gzipped and computed by the script itself rather than scraped from
Next's build table, so they are self-consistent run to run. They read ~2 kB below
Next's printed numbers; compare against the script, not the table.

## Consequences

- The gate was mutation-tested: tightening a route ceiling, tightening the widget
  delta, adding a module that is genuinely present, and renaming a route key each
  make it exit non-zero. A budget that cannot fail is decoration.
- `src/components/tools/ui.tsx` duplicates two class strings from the shared UI
  kit. `src/components/tools/ui.test.ts` reads both originals off disk and fails
  if they diverge, and separately asserts that no registered widget imports
  `@/lib/utils`, `@/components/ui/*`, `tailwind-merge` or `@radix-ui`.
- Current headroom: the widget delta is 2.2 kB against a budget of 8, so there is
  room for a genuinely richer widget before anything needs revisiting.
