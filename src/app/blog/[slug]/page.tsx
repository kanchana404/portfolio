import { formatDate } from "@/lib/utils";
import { DATA } from "@/data/resume";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { connectToDatabase } from "../../../../db";
import Blog from "../../../../db/models/Blog";

// ISR: prebuild known posts, render new ones on demand, refresh hourly.
export const revalidate = 3600;
export const dynamicParams = true;

interface PostDoc {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  generatedImageUrl?: string;
  tags?: string[];
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}

async function getPost(slug: string): Promise<PostDoc | null> {
  try {
    await connectToDatabase();
    const post = await Blog.findOne({ slug, isPublished: true }).lean();
    return post ? JSON.parse(JSON.stringify(post)) : null;
  } catch (error) {
    console.error("getPost error", error);
    return null;
  }
}

export async function generateStaticParams() {
  try {
    await connectToDatabase();
    const posts = await Blog.find({ isPublished: true }).select("slug").lean();
    return posts.map((p: any) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

function resolveImage(post: PostDoc): string {
  const img = post.generatedImageUrl || post.featuredImage;
  if (img) return img.startsWith("http") ? img : `${DATA.url}${img}`;
  return `${DATA.url}/og?title=${encodeURIComponent(post.title)}`;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) {
    return { title: "Blog Post Not Found", robots: { index: false } };
  }
  const url = `${DATA.url}/blog/${post.slug}`;
  const ogImage = resolveImage(post);
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      type: "article",
      publishedTime: post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : undefined,
      modifiedTime: post.updatedAt
        ? new Date(post.updatedAt).toISOString()
        : undefined,
      authors: [DATA.name],
      images: [{ url: ogImage }],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const url = `${DATA.url}/blog/${post.slug}`;
  const imageUrl = post.generatedImageUrl || post.featuredImage;
  const absImage = resolveImage(post);
  const published = post.publishedAt
    ? new Date(post.publishedAt).toISOString()
    : undefined;
  const modified = post.updatedAt
    ? new Date(post.updatedAt).toISOString()
    : published;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#post`,
        headline: post.title,
        description: post.excerpt,
        image: absImage,
        url,
        mainEntityOfPage: url,
        datePublished: published,
        dateModified: modified,
        author: { "@id": `${DATA.url}/#person` },
        publisher: { "@id": `${DATA.url}/#person` },
        keywords: post.tags?.join(", "),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: DATA.url },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: `${DATA.url}/blog`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: post.title,
            item: url,
          },
        ],
      },
    ],
  };

  return (
    <section id="blog">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <a href="/" className="hover:underline">
          Home
        </a>{" "}
        /{" "}
        <a href="/blog" className="hover:underline">
          Blog
        </a>
      </nav>

      {imageUrl && (
        <div className="relative h-64 mb-8 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${post.title} — article cover`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <h1 className="title font-medium text-2xl tracking-tighter max-w-[650px]">
        {post.title}
      </h1>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 mb-8 text-sm max-w-[650px] space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <p className="text-sm text-muted-foreground">
            {post.publishedAt ? formatDate(post.publishedAt) : ""}
          </p>
          <span className="text-sm text-muted-foreground">
            By {post.author || "Kavitha Kanchana"}
          </span>
        </div>
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag: string) => (
              <span
                key={tag}
                className="inline-block bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2 py-1 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <article className="prose dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ node, ...props }) => {
              const isFeaturedImage =
                props.alt?.includes("Featured Image") ||
                props.src === imageUrl ||
                props.src === post.featuredImage ||
                props.src === post.generatedImageUrl;
              if (isFeaturedImage) {
                return null;
              }
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              return (
                <img
                  {...props}
                  className="w-full h-auto rounded-lg my-8 shadow-lg"
                  loading="lazy"
                />
              );
            },
            // Keep exactly one <h1> on the page (the post title above). Markdown
            // '#' headings are demoted one level so they never emit extra H1s.
            h1: ({ node, ...props }) => (
              <h2
                {...props}
                className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100"
              />
            ),
            h2: ({ node, ...props }) => (
              <h3
                {...props}
                className="text-2xl font-semibold mb-4 mt-8 text-gray-800 dark:text-gray-200"
              />
            ),
            h3: ({ node, ...props }) => (
              <h4
                {...props}
                className="text-xl font-semibold mb-3 mt-6 text-gray-800 dark:text-gray-200"
              />
            ),
            p: ({ node, ...props }) => (
              <p
                {...props}
                className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed"
              />
            ),
            a: ({ node, ...props }) => (
              <a
                {...props}
                className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-[#0070f3]"
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
            strong: ({ node, ...props }) => (
              <strong
                {...props}
                className="font-semibold text-gray-900 dark:text-gray-100"
              />
            ),
            em: ({ node, ...props }) => (
              <em {...props} className="italic text-gray-800 dark:text-gray-200" />
            ),
            hr: ({ node, ...props }) => (
              <hr {...props} className="my-8 border-gray-300 dark:border-gray-600" />
            ),
          }}
        >
          {post.content}
        </ReactMarkdown>
      </article>
    </section>
  );
}
