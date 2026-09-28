import { cn } from "@/lib/utils";

/**
 * Props for the BlurFade entrance done in CSS (`.animate-blur-fade` in
 * globals.css), for server-rendered content that should paint without
 * waiting for JavaScript. Spread onto the wrapper:
 * `<div {...cssBlurFade({ delay: 0.04 })}>`.
 *
 * - The blog routes use it because the motion library would cost ~37 kB
 *   gzipped in their budgeted first load.
 * - The homepage hero and About use it because they are the first paint: the
 *   motion BlurFade renders them at opacity 0 until the chunks hydrate, which
 *   on a slow phone connection held the largest paint back to 4-5 seconds.
 *
 * Unlike the motion BlurFade it does not wait for the block to scroll into
 * view, so it belongs only on content that is on screen at load.
 */
export function cssBlurFade({
  delay = 0,
  yOffset = 6,
  blur = 6,
  className,
}: {
  /** Seconds. */
  delay?: number;
  /** px the block drops in from. */
  yOffset?: number;
  /** px of blur it starts with. */
  blur?: number;
  className?: string;
} = {}) {
  return {
    className: cn("animate-blur-fade", className),
    style: {
      "--blur-fade-delay": `${delay}s`,
      "--blur-fade-y": `${yOffset}px`,
      "--blur-fade-blur": `${blur}px`,
    } as React.CSSProperties,
  };
}
