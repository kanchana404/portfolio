import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  /** Settled height of the loaded widget in CSS pixels, measured at 375px wide. */
  minHeight: number;
  className?: string;
  children: ReactNode;
}) {
  // Inline style rather than a Tailwind arbitrary value: the height is data that
  // varies per tool, and `min-h-[${n}px]` would not survive Tailwind's static
  // class extraction.
  const style: CSSProperties = { minHeight };
  return (
    <div style={style} className={cn("w-full", className)}>
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
