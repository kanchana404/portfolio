import { notFound } from "next/navigation";

// Posts are Markdown in git from the next change on; until then there are none.
export const dynamic = "error";
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export default function BlogPostPage(): never {
  notFound();
}
