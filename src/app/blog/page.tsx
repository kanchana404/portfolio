"use client";

import { useState, useEffect } from 'react';
import BlurFade from "@/components/magicui/blur-fade";
import BlurFadeText from "@/components/magicui/blur-fade-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, User, Clock, Eye, Maximize2, Image, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

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

const BLUR_FADE_DELAY = 0.04;
const BLOGS_PER_PAGE = 3;

export default function BlogPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const response = await fetch('/api/blogs');
        if (!response.ok) {
          throw new Error('Failed to fetch blogs');
        }
        const data = await response.json();
        setBlogs(data);
      } catch (err) {
        console.error('Error fetching blogs:', err);
        setError('Failed to load blogs');
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, []);

  // Reset to first page when blogs change
  useEffect(() => {
    setCurrentPage(1);
  }, [blogs]);

  if (loading) {
    return (
      <main className="flex flex-col min-h-[100dvh] space-y-10">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600">Loading blogs...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-col min-h-[100dvh] space-y-10">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const publishedBlogs = blogs.filter(blog => blog.isPublished);
  const totalPages = Math.ceil(publishedBlogs.length / BLOGS_PER_PAGE);
  const startIndex = (currentPage - 1) * BLOGS_PER_PAGE;
  const endIndex = startIndex + BLOGS_PER_PAGE;
  const currentBlogs = publishedBlogs.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  return (
    <main className="flex flex-col min-h-[100dvh] space-y-10">
      <section id="hero">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <BlurFade delay={BLUR_FADE_DELAY}>
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                  Blog & Insights
                </div>
                <BlurFadeText
                  delay={BLUR_FADE_DELAY}
                  className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none"
                  yOffset={8}
                  text="My Thoughts & Ideas"
                />
                <BlurFadeText
                  className="max-w-[600px] md:text-xl"
                  delay={BLUR_FADE_DELAY}
                  text="Exploring software development, AI automation, low-code platforms, and the future of technology. Sharing insights from my journey as a software engineer and entrepreneur."
                />
              </div>
            </div>
          </BlurFade>
        </div>
      </section>

      <section id="blog-posts">
        <div className="space-y-12 w-full py-12">
          <BlurFade delay={BLUR_FADE_DELAY * 2}>
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                  Latest Articles
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  Featured Posts
                </h2>
                <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Dive into my latest thoughts on technology, development practices, and industry insights.
                </p>
                {publishedBlogs.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, publishedBlogs.length)} of {publishedBlogs.length} posts
                  </p>
                )}
              </div>
            </div>
          </BlurFade>

          <div className="grid grid-cols-1 gap-8 max-w-6xl mx-auto">
            {publishedBlogs.length === 0 ? (
              <BlurFade delay={BLUR_FADE_DELAY * 4}>
                <div className="text-center py-12">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-muted-foreground">
                      No posts yet
                    </h3>
                    <p className="text-muted-foreground">
                      I&apos;m working on some great content. Check back soon!
                    </p>
                  </div>
                </div>
              </BlurFade>
            ) : (
              currentBlogs
                .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
                .map((blog, id) => (
                  <BlurFade
                    key={blog.id}
                    delay={BLUR_FADE_DELAY * 3 + id * 0.05}
                  >
                    <Card className="overflow-hidden border hover:shadow-xl transition-all duration-500 ease-out cursor-pointer group bg-gradient-to-r from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
                      <div className="flex flex-col lg:flex-row">
                        {/* Image Section */}
                        <div className="lg:w-2/5 relative">
                          {blog.generatedImageUrl || blog.featuredImage ? (
                            <div className="relative h-64 lg:h-full overflow-hidden">
                              <img
                                src={blog.generatedImageUrl || blog.featuredImage}
                                alt={blog.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              
                              {/* Image Modal Trigger */}
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute top-3 right-3 bg-white/90 dark:bg-gray-900/90 hover:bg-white dark:hover:bg-gray-900 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Maximize2 className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl p-0 overflow-hidden">
                                  <img
                                    src={blog.generatedImageUrl || blog.featuredImage}
                                    alt={blog.title}
                                    className="w-full h-auto max-h-[80vh] object-contain"
                                  />
                                </DialogContent>
                              </Dialog>
                            </div>
                          ) : (
                            <div className="h-64 lg:h-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 flex items-center justify-center">
                              <div className="text-center text-gray-500 dark:text-gray-400">
                                <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No Image</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Content Section */}
                        <div className="lg:w-3/5 p-6 lg:p-8 flex flex-col justify-between">
                          <div className="space-y-4">
                            {/* Header */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                <span>
                                  {new Date(blog.publishedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </span>
                                <span>•</span>
                                <User className="w-4 h-4" />
                                <span>{blog.author}</span>
                              </div>
                              
                              <Link href={`/blog/${blog.slug}`}>
                                <CardTitle className="text-2xl lg:text-3xl font-bold group-hover:text-blue-600 transition-colors duration-300 leading-tight">
                                  {blog.title}
                                </CardTitle>
                              </Link>
                            </div>

                            {/* Summary */}
                            {blog.excerpt && (
                              <p className="text-muted-foreground text-lg leading-relaxed">
                                {blog.excerpt}
                              </p>
                            )}

                            {/* Tags */}
                            {blog.tags && blog.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {blog.tags.map((tag: string) => (
                                  <Badge 
                                    key={tag} 
                                    variant="secondary" 
                                    className="text-xs px-3 py-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                  >
                                    #{tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Footer */}
                          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Link href={`/blog/${blog.slug}`}>
                              <Button 
                                variant="outline" 
                                className="group/btn hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300"
                              >
                                <Eye className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                                Read Full Article
                                <span className="ml-2 group-hover/btn:translate-x-1 transition-transform">→</span>
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </BlurFade>
                ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <BlurFade delay={BLUR_FADE_DELAY * 4}>
              <div className="flex justify-center items-center space-x-2 mt-12">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(page)}
                      className="w-10 h-10 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </BlurFade>
          )}
        </div>
      </section>

      <section id="topics">
        <div className="space-y-12 w-full py-12">
          <BlurFade delay={BLUR_FADE_DELAY * 5}>
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                  Topics I Write About
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  Areas of Focus
                </h2>
                <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  From software development to AI automation, here are the key topics I explore in my writing.
                </p>
              </div>
            </div>
          </BlurFade>

          <BlurFade delay={BLUR_FADE_DELAY * 6}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[800px] mx-auto">
              {[
                {
                  title: "Software Development",
                  description: "Modern web development, best practices, and emerging technologies",
                  color: "bg-blue-100 dark:bg-blue-900/20"
                },
                {
                  title: "AI Automation",
                  description: "Low-code platforms, workflow optimization, and process automation",
                  color: "bg-green-100 dark:bg-green-900/20"
                },
                {
                  title: "Entrepreneurship",
                  description: "Building startups, product development, and business insights",
                  color: "bg-purple-100 dark:bg-purple-900/20"
                },
                {
                  title: "Open Source",
                  description: "Contributing to the community and building developer tools",
                  color: "bg-orange-100 dark:bg-orange-900/20"
                },
                {
                  title: "Technology Trends",
                  description: "Industry insights, emerging technologies, and future predictions",
                  color: "bg-pink-100 dark:bg-pink-900/20"
                },
                {
                  title: "Career Growth",
                  description: "Professional development, learning strategies, and career advice",
                  color: "bg-indigo-100 dark:bg-indigo-900/20"
                }
              ].map((topic, id) => (
                <BlurFade
                  key={topic.title}
                  delay={BLUR_FADE_DELAY * 7 + id * 0.05}
                >
                  <Card className={`${topic.color} border-0 hover:shadow-lg transition-all duration-300`}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm mb-2">{topic.title}</h3>
                      <p className="text-xs text-muted-foreground">{topic.description}</p>
                    </CardContent>
                  </Card>
                </BlurFade>
              ))}
            </div>
          </BlurFade>
        </div>
      </section>

      <section id="newsletter">
        <div className="grid items-center justify-center gap-4 px-4 text-center md:px-6 w-full py-12">
          <BlurFade delay={BLUR_FADE_DELAY * 8}>
            <div className="space-y-3">
              <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                Stay Updated
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                Get My Latest Insights
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Subscribe to my newsletter for the latest articles on software development, AI automation, and technology trends.
              </p>
              <div className="flex justify-center space-x-4 mt-6">
                <Link
                  href="/"
                  className="text-blue-500 hover:underline"
                >
                  Back to Portfolio
                </Link>
                <Link
                  href="https://github.com/kanchana404"
                  className="text-blue-500 hover:underline"
                >
                  GitHub
                </Link>
                <Link
                  href="https://www.linkedin.com/in/kavitha-kanchana"
                  className="text-blue-500 hover:underline"
                >
                  LinkedIn
                </Link>
              </div>
            </div>
          </BlurFade>
        </div>
      </section>
    </main>
  );
}
