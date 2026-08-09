import TrackingScript from "@/components/tracking-script";

/**
 * Narrow reading column for the portfolio and blog.
 *
 * These classes used to sit on <body> in the root layout, which capped every
 * route in the app — including the tools section — at 672px. Route groups keep
 * the URLs identical (`/`, `/blog`, `/blog/[slug]`) while letting `(tools)`
 * opt into a wider canvas.
 *
 * ## Why the analytics pixel lives here and not in the root layout
 *
 * It used to be mounted in `src/app/layout.tsx`, which meant it loaded on every
 * tool page — pages whose meta row says "Runs in your browser — nothing
 * uploaded", derived from `ToolDef.compute`. That sentence was written to be
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
    <div className="max-w-2xl mx-auto py-12 sm:py-24 px-6">
      {children}
      <TrackingScript />
    </div>
  );
}
