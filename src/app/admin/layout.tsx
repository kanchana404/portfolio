import type { Metadata } from "next";

// Private area — keep out of the index. robots.txt Disallow alone does not
// prevent indexing of discovered/linked URLs; a noindex meta tag does.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
