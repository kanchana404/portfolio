/**
 * Narrow reading column for the portfolio and blog.
 *
 * These classes used to sit on <body> in the root layout, which capped every
 * route in the app — including the tools section — at 672px. Route groups keep
 * the URLs identical (`/`, `/blog`, `/blog/[slug]`) while letting `(tools)`
 * opt into a wider canvas.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto py-12 sm:py-24 px-6">{children}</div>
  );
}
