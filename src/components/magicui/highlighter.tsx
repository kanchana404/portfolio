"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { annotate } from "rough-notation";
import type { RoughAnnotation } from "rough-notation/lib/model";

type AnnotationAction =
  | "highlight"
  | "underline"
  | "box"
  | "circle"
  | "strike-through"
  | "crossed-off"
  | "bracket";

interface HighlighterProps {
  children: React.ReactNode;
  action?: AnnotationAction;
  /**
   * Any CSS colour, custom properties included. Defaults to the highlighter
   * tokens: the marker fill for "highlight", the amber stroke otherwise.
   */
  color?: string;
  strokeWidth?: number;
  animationDuration?: number;
  iterations?: number;
  /** px, or [vertical, horizontal], or [top, right, bottom, left]. */
  padding?: number | [number, number] | [number, number, number, number];
  multiline?: boolean;
  /** Wait until the text scrolls into view before drawing. */
  isView?: boolean;
  /** Milliseconds to wait before drawing, e.g. until an entrance fade ends. */
  delay?: number;
}

const DEFAULT_COLORS: Record<"highlight" | "stroke", string> = {
  highlight: "hsl(var(--marker) / var(--marker-alpha))",
  stroke: "hsl(var(--marker-stroke))",
};

/**
 * rough-notation writes the colour into an SVG `stroke` attribute, and
 * attributes cannot read CSS custom properties. Resolve it through the DOM so
 * the site tokens (and their dark-theme values) work.
 */
function resolveColor(value: string): string {
  if (!value.includes("var(")) return value;
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || value;
}

/**
 * Magic UI Highlighter (magicui.design/docs/components/highlighter, MIT,
 * credit @pratiyank), a hand-drawn marker built on rough-notation. Changes:
 *
 * - Colours default to the site's highlighter tokens (--marker,
 *   --marker-stroke) and follow the theme toggle.
 * - Only the first draw animates. Upstream re-runs show() on every resize of
 *   document.body, which replays the stroke whenever anything on the page
 *   changes height (opening a work row, turning a page).
 * - useEffect, not useLayoutEffect: this renders on the server, where React 18
 *   warns about layout effects, and the drawing has to wait for layout anyway.
 * - The SVG it adds is hidden from assistive tech, and reduced motion draws
 *   it in place with no animation or delay.
 * - Highlights are blended into the line (globals.css), so they never hide a
 *   neighbouring glyph.
 */
export function Highlighter({
  children,
  action = "highlight",
  color,
  strokeWidth = 1.5,
  animationDuration = 600,
  iterations = 2,
  padding = 2,
  multiline = true,
  isView = false,
  delay = 0,
}: HighlighterProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  // Shrink the in-view band vertically only. A single "-10%" also trims 10%
  // off each side, and a mark near the left edge of a narrow screen (the
  // contributions count at 641-679px) never counted as in view.
  const isInView = useInView(elementRef, { once: true, margin: "-10% 0px" });
  const shouldShow = !isView || isInView;
  const colorValue = color ?? DEFAULT_COLORS[action === "highlight" ? "highlight" : "stroke"];

  useEffect(() => {
    const element = elementRef.current;
    if (!shouldShow || !element) return;

    let annotation: RoughAnnotation | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const draw = () => {
      const current = annotate(element, {
        type: action,
        color: resolveColor(colorValue),
        strokeWidth,
        animationDuration,
        iterations,
        padding,
        multiline,
        animate: !reduceMotion,
      });
      annotation = current;
      current.show();

      // The SVG is inserted next to the element: before it for highlights,
      // after it for everything else.
      const svg =
        action === "highlight" ? element.previousElementSibling : element.nextElementSibling;
      if (svg?.classList.contains("rough-annotation")) {
        svg.setAttribute("aria-hidden", "true");
        // Blend mode per theme lives in globals.css (.rough-annotation--highlight).
        svg.classList.add(
          action === "highlight" ? "rough-annotation--highlight" : "rough-annotation--stroke"
        );
      }

      // From here on, redraws are instant.
      settleTimer = setTimeout(() => {
        current.animate = false;
      }, reduceMotion ? 0 : animationDuration);

      resizeObserver = new ResizeObserver(() => {
        current.hide();
        current.show();
      });
      resizeObserver.observe(element);
      resizeObserver.observe(document.body);

      // Lenis toggles classes on <html> at every scroll start and stop; only
      // an actual theme change needs the colour re-resolved.
      let wasDark = document.documentElement.classList.contains("dark");
      themeObserver = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains("dark");
        if (isDark === wasDark) return;
        wasDark = isDark;
        current.color = resolveColor(colorValue);
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    };

    const startTimer = setTimeout(draw, reduceMotion ? 0 : delay);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(settleTimer);
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      annotation?.remove();
    };
  }, [
    shouldShow,
    action,
    colorValue,
    strokeWidth,
    animationDuration,
    iterations,
    padding,
    multiline,
    delay,
    reduceMotion,
  ]);

  return (
    // Inline, not inline-block, so a marked phrase can wrap like the text
    // around it; rough-notation's multiline mode follows each line box.
    <span ref={elementRef} className="relative bg-transparent">
      {children}
    </span>
  );
}
