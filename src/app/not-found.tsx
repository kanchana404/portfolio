import type { Metadata } from "next";
import Link from "next/link";

// Its own title and no index, instead of inheriting the homepage's title,
// canonical and og:url. (Next also adds its own noindex for a 404; this makes
// the root layout's "index, follow" stop contradicting it.)
export const metadata: Metadata = {
  title: "404: Page not found",
  description: "The page you're looking for doesn't exist or has moved.",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

const LINK_CLASS =
  "rounded-sm font-medium text-foreground underline underline-offset-4 transition-colors hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function NotFound() {
  return (
    // Global 404 must stay at the app root to catch every unmatched URL, so it
    // is outside the (site) route group and carries its own width classes.
    <main className="max-w-2xl mx-auto py-12 sm:py-24 px-6 flex flex-col items-center justify-center min-h-[60dvh] text-center space-y-4">
      <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">
        404: Page not found
      </h1>
      <p className="max-w-[500px] text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      {/* Underlined at rest, as the About links are: in foreground colour
          with only a hover wipe they read as plain text. */}
      <div className="flex gap-4">
        <Link href="/" className={LINK_CLASS}>
          Back to home
        </Link>
        <Link href="/blog" className={LINK_CLASS}>
          Read the blog
        </Link>
      </div>
    </main>
  );
}
