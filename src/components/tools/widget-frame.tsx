import type { CSSProperties, ReactNode } from "react";
import { cx } from "./ui";

/**
 * Reserves vertical space for a tool widget before it exists.
 *
 * Every tool page mounts its widget above the fold against a Cumulative Layout
 * Shift budget of 0.05 — half the usual 0.1, because a widget that jumps on
 * hydration is the single most damaging thing a tool page can do to its Core Web
 * Vitals, and it happens on every tool page simultaneously rather than one at a
 * time.
 *
 * `minHeight` must be the height the *loaded* widget settles at, not a guess.
 * Measure it in devtools at 375px, which is the width where a wrong number costs
 * the most.
 *
 * A widget rendered during static generation (a plain `"use client"` component,
 * no `ssr: false`) does not shift at all, so the frame is belt-and-braces there.
 * It becomes load-bearing the moment a widget is code-split behind
 * `dynamic(..., { ssr: false })`, because then the server sends the skeleton and
 * the browser swaps in something of a different size.
 */
export function WidgetFrame({
  minHeight,
  className,
  children,
}: {
  /**
   * Settled height in CSS pixels. Required only on the `ssr: false` path.
   *
   * Omitted for a server-rendered widget, and that is the normal case: every
   * widget in `tool-widget.tsx` is a static import, so the server markup is
   * never unmounted and the shift this guards against is structurally
   * impossible. A floor here would then be pure dead air, which is exactly what
   * it became when one hardcoded number was applied to all fifteen tools: the
   * subtitle converter settles at 236px against a 360px floor, so a quarter of
   * the panel's own height was empty space between it and the next section.
   */
  minHeight?: number;
  className?: string;
  children: ReactNode;
}) {
  // Inline style rather than a Tailwind arbitrary value: the height is data that
  // varies per tool, and `min-h-[${n}px]` would not survive Tailwind's static
  // class extraction.
  const style: CSSProperties | undefined = minHeight ? { minHeight } : undefined;
  return (
    <div style={style} className={cx("w-full", className)}>
      {children}
    </div>
  );
}

/**
 * Placeholder for a widget that is still downloading.
 *
 * Pass as `loading` to `next/dynamic`. It must occupy the same box the real
 * widget will, which is why it takes the same `minHeight`.
 *
 * `aria-hidden` because a screen reader announcing an empty pulsing rectangle is
 * noise; the surrounding section already carries the tool's heading.
 */
export function WidgetSkeleton({ minHeight }: { minHeight: number }) {
  return (
    <div
      aria-hidden
      style={{ minHeight }}
      className="w-full animate-pulse rounded-lg border border-dashed bg-muted/40"
    />
  );
}
