import type { Metadata } from "next";

// Private area — keep out of the index. robots.txt Disallow alone does not
// prevent indexing of discovered/linked URLs; a noindex meta tag does.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// The width classes moved off <body> into the route-group layouts; admin sits
// outside those groups, so it carries its own copy to stay visually unchanged.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto py-12 sm:py-24 px-6">{children}</div>
  );
}
