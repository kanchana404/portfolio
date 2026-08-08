import type { Metadata } from "next";

// Private authoring route — keep out of the index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// The width classes moved off <body> into the route-group layouts; this route
// sits outside those groups, so it carries its own copy to stay unchanged.
export default function PublishBlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto py-12 sm:py-24 px-6">{children}</div>
  );
}
