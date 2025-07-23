import { Metadata } from 'next';
import { DATA } from "@/data/resume";

export const metadata: Metadata = {
  title: "Blog Post - Kavitha Kanchan",
  description: "Read insights on software development, AI automation, and technology innovation.",
  openGraph: {
    title: "Blog Post - Kavitha Kanchan",
    description: "Read insights on software development, AI automation, and technology innovation.",
    type: "article",
    url: `${DATA.url}/blog`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog Post - Kavitha Kanchan",
    description: "Read insights on software development, AI automation, and technology innovation.",
  },
};

export default function BlogPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 