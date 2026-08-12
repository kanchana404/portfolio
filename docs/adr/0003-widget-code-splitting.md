# 3. Widgets code-split behind a client boundary, not a server map

Date: 2026-08-09
Status: **Reversed on 2026-08-09 — see "Reversal" at the foot of this file.**
Supersedes the widget-map guidance in ADR 0002.

> **Read the reversal first.** The decision below was measured, shipped, and
> wrong. The client boundary was kept; the `next/dynamic` code-splitting that
> was the entire point of it was removed. The analysis is preserved unedited
> because the *way* it was wrong is the useful part.

## Context

`/tools/[slug]` is a single dynamic route with `dynamicParams = false`. Every
tool page is prerendered from the same `page.tsx`, so the route's module graph is
identical for all of them.

The widget map originally lived in `src/lib/tools/widgets.ts`, a Server Component
module holding static imports of every widget. Because RSC resolves client
references eagerly, **every widget landed in the route's client chunk regardless
of which tool was being rendered**. A visitor to the percentage calculator
downloaded the JWT decoder, the colour converter and fifteen others.

Measured cost of the whole widget set, gzipped, as a delta against `/tools`
(which shares the same shell and shared chunk, so the platform floor cancels):

| Tools | Widget delta | `/tools/[slug]` first load |
|---|---|---|
| 12 | 15.1 kB | 108.6 kB |
| 17 | 27.5 kB | 121.6 kB |

That is linear in the size of the catalogue, and the catalogue is capped at 30 —
projecting to roughly 48 kB of unused JavaScript on every tool page.

The budget in `scripts/check-bundle-budget.mjs` was set at 20 kB with an explicit
instruction not to raise it. Adding the seventeenth tool broke it, as designed.

`next/dynamic` had already been tried **inside the Server Component map** and
rejected: it produces no separately-fetched chunk there, and measured marginally
worse (109.0 kB against 108.6 kB) for the wrapper it adds. That result was
correct and led to the wrong conclusion — that per-widget splitting was
incompatible with server rendering the widget.

## Decision

Move the map into `src/components/tools/tool-widget.tsx`, a **Client Component**,
using `dynamic(() => import(...))` per widget with `ssr` left at its default of
`true`.

Webpack then emits one async chunk per widget and the browser fetches only the
one it needs. Because `ssr` stays `true`, each widget is still rendered into the
prerendered HTML, so a crawler — or anyone with JavaScript disabled — receives
the real tool rather than a spinner.

The slug list moves to `src/lib/tools/widget-slugs.ts`, which has no React in it.
This split is deliberate: the client map keys off the exported `as const` union
(so a missing entry is a compile error), while the registry cross-check stays on
the server side. **The registry must never be reachable from client code** — it
carries every tool's copy, which would cost far more than the widgets ever did.

## Consequences

Measured after the change:

| Metric | Before | After |
|---|---|---|
| `/tools/[slug]` first load | 121.6 kB | **95.8 kB** |
| Widget delta vs `/tools` | 27.5 kB | **1.4 kB** |
| Route-specific page size (Next's own table) | 28.3 kB | 1.63 kB |

The delta is now roughly constant rather than linear, so the budget was tightened
from 20 kB to 5 kB and the route budget from 115 kB to 100 kB. A loose budget is
not a gate.

Verified, not assumed:

- Every one of the 17 prerendered HTML files contains real widget markup inside
  `#tool-widget` — checked for computed content (`oklch(`, contrast ratios,
  parsed CSV rows), not merely non-empty output.
- `tests/browser/all-tools.spec.ts` renders every tool with
  `javaScriptEnabled: false` and asserts the widget is visible and non-empty.
- CLS stays inside the 0.05 budget on all 17 tools, desktop and mobile.
- Mutation-tested: converting three widgets back to static imports fails both the
  route budget (103.2 kB) and the widget delta (8.8 kB).

### What can undo this

A static `import` of a widget creeping back into `tool-widget.tsx`, or a shared
dependency being hoisted out of the async chunks. The 5 kB delta budget is the
tripwire for both.

`tool-widget.tsx` must not import from `./widget-frame`: that module uses `cn()`,
which is clsx + tailwind-merge, and tailwind-merge alone is ~21 kB of client
JavaScript. `src/components/tools/ui.test.ts` now enforces this by listing the
widget directory and checking import specifiers on every module on the client
side of the boundary — including ones not yet wired into the map, which the
previous version of that check silently exempted.

`ssr: false` must not be added to any entry in this map. It would remove the
widget from the prerendered HTML, which is the one thing this platform cannot
afford. A widget that genuinely cannot render on the server — WASM, canvas,
`window` at module scope — needs its own wrapper and a `<WidgetSkeleton>`
reserving its final height, or the CLS budget fails.

---

# Reversal

Date: 2026-08-09 (same day)
Status: Accepted. This supersedes the decision above.

## What went wrong

`next/dynamic` inside a Client Component creates a Suspense boundary. During
hydration, if the widget's async chunk has not arrived yet, React replaces the
server-rendered markup with the boundary's fallback — empty, since no `loading`
was supplied — and restores it when the chunk lands. `WidgetFrame` collapses to
its `minHeight` floor for that interval and springs back, so every element below
the widget jumps up and then down.

Measured on `/tools/color-converter`: the widget settles at 643 px against a
360 px floor, and the two layout-shift entries move the sections below it by
exactly 925 − 642 = **283 px**, which is 643 − 360. The gap lasted ~10 ms.

The verification in the original decision was not wrong about what it checked.
It was wrong about what it *didn't*:

- 17/17 tools rendered real widget markup in prerendered HTML — still true.
- CLS stayed inside 0.05 on all 17 tools, desktop and mobile — **measured on warm
  localhost, where the chunk is always already there and the gap never opens.**

## The measurement that mattered

Same pages, same build, throttled to Fast 3G with 4× CPU — an ordinary mid-range
phone, and what Lighthouse simulates:

| tool | warm loopback | Fast 3G + 4× CPU |
|---|---|---|
| compound-interest-calculator | 0.0000 | **0.2779** |
| text-diff-checker | 0.0000 | **0.2086** |
| color-converter | 0.0000 | **0.1740** |
| json-formatter | 0.0000 | **0.1334** |

0.25 is the edge of Google's *poor* band for CLS, and mobile is the indexed
viewport. Eight of seventeen tools breached the 0.05 budget under throttling
while every one of them read 0.0000 unthrottled.

## Decision

Revert to static imports. Keep the Client Component boundary — it is still
required so that `registry.ts`, which carries every tool's copy, stays off the
client.

| | static (now) | dynamic (reverted) |
|---|---|---|
| `/tools/[slug]` first load | 120.9 kB | 95.8 kB |
| widget delta vs `/tools` | 26.8 kB | 1.4 kB |
| worst throttled CLS | **0.0235** | **0.2779** |

26 kB of gzipped JavaScript is a real cost. It is a much smaller one than a
*poor* Core Web Vital on the viewport Google indexes, on a platform whose only
purpose is ranking. Budgets re-based to 126 kB / 30 kB.

## What this cost, and the lesson worth keeping

The tests were not weak in an obvious way. They asserted the right property with
the right threshold on every tool in the registry. They ran against a production
build. They passed, honestly, on a machine where the failure cannot occur.

Two changes make that class of bug visible:

1. **The CLS test now throttles.** `Network.emulateNetworkConditions` at Fast 3G
   plus `Emulation.setCPUThrottlingRate: 4` via CDP, in
   `tests/browser/all-tools.spec.ts`. Mutation-tested: reintroducing
   `dynamic()` fails 7 tools on mobile. Before throttling it failed none.
2. **The observer is installed via `addInitScript`,** before any page script
   runs. It was previously registered inside `page.evaluate()` after
   `goto(..., { waitUntil: "load" })` had resolved, relying on `buffered: true`
   to replay what it missed — which it does not do reliably for `layout-shift`.

The generalisable point: a performance test whose environment is faster than
production does not measure a weaker version of the problem, it measures nothing
at all, and it reports that as success. Localhost is not a slow network with the
latency turned down; it is a different regime in which the failure mode is
absent by construction.

## Superseded guidance

The "What can undo this" section above still applies to the client boundary
itself — `tool-widget.tsx` must not import `@/lib/utils`, and the registry must
never become reachable from client code. Both are enforced by tests.

Its instruction to keep `ssr: true` is now moot: there is no `dynamic()` call
left to configure. If a future widget genuinely needs code-splitting — WASM, a
large parser — it must use `dynamic(..., { ssr: false })` with a
`<WidgetSkeleton>` reserving its settled height. With `ssr: false` there is no
server-rendered markup to lose, so no gap exists to shift through. Splitting an
`ssr: true` widget is the mistake this reversal exists to prevent.
