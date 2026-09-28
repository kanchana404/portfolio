"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";

/**
 * Inertial page scrolling with Lenis (darkroom.engineering, MIT), the same
 * library and version as kalanalk.com, which the owner asked to match.
 *
 * - Mounted from the (site) layout only: tool pages keep native scrolling,
 *   since their widgets have scrollable panes of their own.
 * - Wheel and trackpad are smoothed; touch keeps native momentum (Lenis
 *   default), so phones scroll exactly as before.
 * - `anchors` animates same-page hash links (/#education). Lenis does not
 *   cancel the click, so the browser still updates the hash and moves focus,
 *   and the skip link keeps working for keyboard users. Targets honour
 *   scroll-margin, so sections' scroll-mt-24 still applies. Anchor jumps run
 *   for a fixed duration rather than on the wheel's lerp; see below.
 * - Lenis 1.3.23 ends a lerp only when Math.round(position) equals
 *   Math.round(target). A target on a half pixel (anchor targets often are,
 *   e.g. #education at 1115.5) is approached from below and never rounds up,
 *   so the scroll stays "smooth" for 6 to 27 seconds and snaps every keyboard
 *   and focus scroll back. A timed animation always ends, and the scroll
 *   handler settles any wheel scroll that gets within half a pixel.
 * - prefers-reduced-motion: Lenis is never created and scrolling stays native.
 *
 * Renders nothing; it only owns the instance's lifetime.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      smoothWheel: true,
      anchors: { duration: 1.2 },
    });

    // A wheel scroll stuck under half a pixel from its target: finish it with
    // an immediate scrollTo to the rounded target. That takes Lenis's own
    // completion path (reset, swallow the next native scroll event, fire
    // scrollend); stop()/start() reset it too, but left WebKit reading its own
    // last scroll event as a native scroll, stuck in "lenis-scrolling". The
    // gap is exactly 0 on every frame of a programmatic scroll (an anchor jump
    // moves the target along with the position), so those are left to run.
    lenis.on("scroll", () => {
      const gap = Math.abs(lenis.targetScroll - lenis.animatedScroll);
      if (lenis.isScrolling === "smooth" && gap > 0 && gap < 0.5) {
        lenis.scrollTo(Math.round(lenis.targetScroll), { immediate: true });
      }
    });

    // Lenis computes an anchor's target from its own last known position,
    // which only updates on the next scroll event. A scroll and a hash-link
    // click in the same frame (assistive tech and automation do this) then
    // landed hundreds of pixels off. Resync before its click handler runs.
    const resync = () => {
      if (lenis.isScrolling !== "smooth") lenis.resize();
    };
    window.addEventListener("click", resync, true);

    return () => {
      window.removeEventListener("click", resync, true);
      lenis.destroy();
    };
  }, []);

  return null;
}
