"use client";

import { useState, useEffect } from 'react';
import { formatDate } from "@/lib/utils";
import { DATA } from "@/data/resume";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  generatedImageUrl?: string;
  tags: string[];
  author: string;
  publishedAt: string;
  isPublished: boolean;
}

export default function Blog({ params }: { params: { slug: string } }) {
  const [post, setPost] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const response = await fetch(`/api/blogs/${params.slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Blog not found');
          } else {
            throw new Error('Failed to fetch blog');
          }
        } else {
          const data = await response.json();
          setPost(data);
        }
      } catch (err) {
        console.error('Error fetching blog:', err);
        setError('Failed to load blog');
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [params.slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading blog...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Blog Not Found</h1>
          <p className="text-gray-600">{error || 'The requested blog post could not be found.'}</p>
        </div>
      </div>
    );
  }

  const imageUrl = post.generatedImageUrl || post.featuredImage;
  const ogImage = imageUrl ? `${DATA.url}${imageUrl}` : `${DATA.url}/og?title=${post.title}`;

  return (
    <section id="blog">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            datePublished: post.publishedAt,
            dateModified: post.publishedAt,
            description: post.excerpt,
            image: imageUrl
              ? `${DATA.url}${imageUrl}`
              : `${DATA.url}/og?title=${post.title}`,
            url: `${DATA.url}/blog/${post.slug}`,
            author: {
              "@type": "Person",
              name: DATA.name,
            },
          }),
        }}
      />
      {imageUrl && (
        <div className="relative h-64 mb-8 overflow-hidden rounded-lg">
          <img
            src={imageUrl}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <h1 className="title font-medium text-2xl tracking-tighter max-w-[650px]">
        {post.title}
      </h1>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-2 mb-8 text-sm max-w-[650px] space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <Suspense fallback={<p className="h-5" />}>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {formatDate(post.publishedAt)}
            </p>
          </Suspense>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            By {post.author || 'Kavitha Kanchan'}
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
              // Skip the featured image since it's already shown above
              const isFeaturedImage = props.alt?.includes('Featured Image') || 
                                    props.src === imageUrl ||
                                    props.src === post.featuredImage ||
                                    props.src === post.generatedImageUrl;
              if (isFeaturedImage) {
                return null;
              }
              return (
                <img 
                  {...props} 
                  className="w-full h-auto rounded-lg my-8 shadow-lg"
                  loading="lazy"
                />
              );
            },
            h1: ({ node, ...props }) => (
              <h1 {...props} className="text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100" />
            ),
            h2: ({ node, ...props }) => (
              <h2 {...props} className="text-2xl font-semibold mb-4 mt-8 text-gray-800 dark:text-gray-200" />
            ),
            h3: ({ node, ...props }) => (
              <h3 {...props} className="text-xl font-semibold mb-3 mt-6 text-gray-800 dark:text-gray-200" />
            ),
            p: ({ node, ...props }) => (
              <p {...props} className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed" />
            ),
            a: ({ node, ...props }) => (
              <a {...props} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />
            ),
            strong: ({ node, ...props }) => (
              <strong {...props} className="font-semibold text-gray-900 dark:text-gray-100" />
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
