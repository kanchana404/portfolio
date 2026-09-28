import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { SmoothScroll } from "@/components/smooth-scroll";
import TrackingScript from "@/components/tracking-script";

/**
 * Narrow reading column for the portfolio and blog.
 *
 * These classes used to sit on <body> in the root layout, which capped every
 * route in the app, the tools section included, at 672px. Route groups keep
 * the URLs identical (`/`, `/blog`, `/blog/[slug]`) while letting `(tools)`
 * opt into a wider canvas.
 *
 * ## Why the analytics pixel lives here and not in the root layout
 *
 * It used to be mounted in `src/app/layout.tsx`, which meant it loaded on every
 * tool page, and a tool page's meta row promises "Runs in your browser — nothing
 * uploaded" (quoted verbatim from the UI), derived from `ToolDef.compute`. That sentence was written to be
 * underivable-from-nothing precisely so it could not go stale, and a
 * third-party script contradicting it made the page's most load-bearing claim
 * false in a way any visitor could see in devtools.
 *
 * Portfolio and blog pages make no such promise, so the pixel is scoped to
 * them. `tests/browser/tool-page.spec.ts` asserts that a tool page sends
 * nothing while the user types; keep it that way.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/*
        The Magic UI template's header atmosphere: a flickering dot grid across
        the top 100px that fades out downward. It lives here rather than in the
        root layout so the tool pages keep a plain canvas. Positioned against
        the page itself (nothing above it is positioned), so it spans the full
        window width while the column below stays at 672px. On phones it is
        72px tall: the column starts 48px down there, and a grid dot under the
        first line of muted text (the /blog and /privacy subtitles) dropped its
        contrast under 4.5:1.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[72px] overflow-hidden sm:h-[100px]"
      >
        <FlickeringGrid
          className="h-full w-full"
          squareSize={2}
          gridGap={2}
          style={{
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
      </div>
      <div className="relative z-10 mx-auto max-w-2xl px-6 pb-28 pt-12 sm:pb-32 sm:pt-24">
        {children}
        <TrackingScript />
        <SmoothScroll />
      </div>
    </>
  );
}
