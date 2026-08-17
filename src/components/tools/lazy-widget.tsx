"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { WidgetSkeleton } from "./widget-frame";

/**
 * The one correct way to mount a heavy widget.
 *
 * Every tool from here on needs a WASM codec, a canvas pipeline or a large
 * parser, and none of them may sit in the tool route's first-load chunk. This
 * wraps the exact `next/dynamic` shape that satisfies both gates at once, so
 * that decision is made in one place instead of re-derived — probably wrongly —
 * per tool.
 *
 * ## Why `ssr: false` is not optional
 *
 * ADR 0003 records a code-split that was measured, shipped and reverted. It
 * used `dynamic()` with `ssr` left at its default of `true`. That renders the
 * widget on the server, then drops it during hydration if its chunk has not
 * arrived, then puts it back — so `WidgetFrame` collapses to its floor and the
 * page jumps. On warm localhost the chunk is always there and it measured
 * 0.0000 everywhere; under Fast 3G with 4× CPU throttling the same pages hit
 * **0.2779**, the edge of Google's "poor" band, on the viewport that gets
 * indexed.
 *
 * `ssr: false` is what makes it safe: there is no server markup to lose, so
 * there is no gap to shift through. The skeleton is what the server renders,
 * and it is the same size as what replaces it.
 *
 * This is the remedy `scripts/check-bundle-budget.mjs` prescribes in its own
 * tripwire comment. Do not reach for plain `dynamic()` instead.
 *
 * ## `minHeight` is data, not decoration
 *
 * It must be the height the *loaded* widget settles at, measured in devtools at
 * 375px — the width where a wrong number costs the most. Guess low and the page
 * still jumps, which defeats the entire mechanism. Guess high and there is a
 * visible gap under the widget forever.
 *
 * ## This defers the widget, not the library
 *
 * `dynamic(ssr:false)` fetches the widget chunk **at hydration**, not on click.
 * A codec imported at the top of that chunk therefore still reaches every
 * visitor who opens the page, while `pnpm budget` prints "ok" because the bytes
 * are not in the first-load graph. Import the heavy dependency *inside the
 * handler*:
 *
 * ```tsx
 * // ✅ the library arrives when the user asks for it
 * const run = async () => {
 *   const { Conversion } = await import("mediabunny");
 *   …
 * };
 *
 * // ❌ ships to everyone who loads the page; the budget will not catch it
 * import { Conversion } from "mediabunny";
 * ```
 *
 * @example
 * const Impl = lazyWidget(() => import("./widgets/image-converter.impl"), 512);
 * export default function ImageConverter() {
 *   return <Impl />;
 * }
 */
export function lazyWidget<P extends object = Record<string, never>>(
  load: () => Promise<{ default: ComponentType<P> }>,
  minHeight: number
): ComponentType<P> {
  return dynamic(load, {
    ssr: false,
    loading: () => <WidgetSkeleton minHeight={minHeight} />,
  }) as ComponentType<P>;
}
