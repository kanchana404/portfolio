import type { Metadata } from "next";

// Private authoring route — keep out of the index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PublishBlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
