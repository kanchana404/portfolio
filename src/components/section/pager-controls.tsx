"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

// A 2px ring (the default Button ring is 1px, hard to tell from the border).
const FOCUS = "focus-visible:ring-2";

// The dock covers the bottom 72px (bottom-4 + h-14); focus under it is off-screen.
const DOCK_CLEARANCE = 72;

// useLayoutEffect on the client; React 18 warns about it during the server render.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Keeps a paged list in view after a page change, for both the work list and
 * the project grid. Returns the function the pager calls on every change.
 *
 * It measures after the new page has rendered, before paint. Measuring when
 * the button is pressed gets it wrong, because the list's height changes with
 * the page: going back from a short last page to a full first page pushes the
 * pager (and the button that has focus) far down. WebKit even scrolls to
 * follow the button, so page one's first rows end up above the screen.
 *
 * - The list's top is above the viewport: scroll its section back to the
 *   top (scroll-mt-24 keeps it clear) and move focus to the list.
 * - Focus is below the fold or under the dock: move focus to the list,
 *   without scrolling, so Tab continues from the first row on screen.
 *
 * Scroll anchoring is switched off for the page change. The list's height
 * changes above whatever the browser picked as its anchor (often the pager
 * itself), and WebKit's compensating scroll cancelled the smooth scroll back
 * to the section, leaving the new page's cards far above the screen.
 */
function setScrollAnchoring(on: boolean) {
  for (const el of [document.documentElement, document.body]) {
    if (on) el.style.removeProperty("overflow-anchor");
    else el.style.setProperty("overflow-anchor", "none");
  }
}

// Long enough for the smooth scroll back to the section to finish.
const ANCHORING_OFF_MS = 1200;

export function usePageChangeView(listRef: React.RefObject<HTMLElement>, page: number) {
  const pending = useRef(false);
  const restoreTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(restoreTimer.current);
      setScrollAnchoring(true);
    },
    []
  );

  useIsomorphicLayoutEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    window.clearTimeout(restoreTimer.current);
    restoreTimer.current = window.setTimeout(() => setScrollAnchoring(true), ANCHORING_OFF_MS);
    const list = listRef.current;
    if (!list) return;

    if (list.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      list.closest("section")?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      // preventScroll keeps the smooth scroll going.
      list.focus({ preventScroll: true });
      return;
    }

    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== document.body) {
      const { top, bottom } = focused.getBoundingClientRect();
      if (top < 0 || bottom > window.innerHeight - DOCK_CLEARANCE) {
        list.focus({ preventScroll: true });
      }
    }
  }, [page, listRef]);

  return useCallback(() => {
    pending.current = true;
    // Off before the new page renders, so its layout is never compensated.
    setScrollAnchoring(false);
  }, []);
}

/**
 * Previous / numbered / Next buttons and a "Page X of Y" line: the work
 * section's pagination from before the redesign, shared with Projects.
 */
export function PagerControls({
  page,
  totalPages,
  onChange,
  label,
  summary,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Names the list for screen readers, e.g. "work experience". */
  label: string;
  summary: string;
}) {
  const numberRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Pressing the current page's number is not a page change; reporting it
  // would leave usePageChangeView waiting for a render that never comes.
  const go = (next: number) => {
    const target = Math.min(totalPages, Math.max(1, next));
    if (target !== page) onChange(target);
  };
  // Previous and Next disable themselves at the ends. A disabled button loses
  // focus to <body>, so hand focus to the new page's number first. Without
  // preventScroll, WebKit queues a scroll for this focus and runs it after
  // usePageChangeView has moved focus to the list, top-aligning the list and
  // hiding the section heading. The number is on screen when it takes focus.
  const step = (delta: number) => {
    const next = Math.min(totalPages, Math.max(1, page + delta));
    if (next === 1 || next === totalPages) numberRefs.current[next - 1]?.focus({ preventScroll: true });
    go(next);
  };

  return (
    <>
      {totalPages > 1 && (
        <nav aria-label={`${label} pages`} className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => step(-1)}
            disabled={page === 1}
            className={cn("px-3 py-1", FOCUS)}
            aria-label={`Previous page of ${label}`}
          >
            Previous
          </Button>
          <div className="flex space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                variant={page === n ? "default" : "outline"}
                size="sm"
                ref={(el) => {
                  numberRefs.current[n - 1] = el;
                }}
                onClick={() => go(n)}
                className={cn("h-8 w-8 p-0", FOCUS)}
                aria-label={`${label} page ${n}`}
                aria-current={page === n ? "page" : undefined}
              >
                {n}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => step(1)}
            disabled={page === totalPages}
            className={cn("px-3 py-1", FOCUS)}
            aria-label={`Next page of ${label}`}
          >
            Next
          </Button>
        </nav>
      )}
      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        {summary}
      </p>
    </>
  );
}
