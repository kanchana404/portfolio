# 3. Widgets code-split behind a client boundary, not a server map

Date: 2026-08-09
Status: Accepted
Supersedes the widget-map guidance in ADR 0002.

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
