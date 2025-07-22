import BlurFade from "@/components/magicui/blur-fade";
import BlurFadeText from "@/components/magicui/blur-fade-text";
import { getBlogPosts } from "@/data/blog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const metadata = {
  title: "Blog - Kavitha Kanchan | Software Development, AI Automation & Technology Insights",
  description: "Insights on software development, AI automation, n8n workflows, MERN stack development, and technology innovation. Expert perspectives on web development, automation solutions, and emerging technologies.",
  keywords: [
    "Software Development Blog",
    "AI Automation",
    "n8n Workflows",
    "MERN Stack",
    "React.js Development",
    "Node.js Development",
    "Workflow Automation",
    "Technology Insights",
    "Web Development",
    "Automation Solutions",
    "Sri Lanka Tech Blog",
    "Software Engineering",
    "Full-Stack Development",
    "Java Development",
    "Spring Boot",
    "Government Systems",
    "Digital Transformation"
  ],
  openGraph: {
    title: "Blog - Kavitha Kanchan | Software Development & AI Automation",
    description: "Expert insights on software development, AI automation, n8n workflows, and technology innovation.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog - Kavitha Kanchan | Software Development & AI Automation",
    description: "Expert insights on software development, AI automation, n8n workflows, and technology innovation.",
  },
};

const BLUR_FADE_DELAY = 0.04;

export default async function BlogPage() {
  const posts = await getBlogPosts();

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
              </div>
            </div>
      </BlurFade>

          <div className="grid grid-cols-1 gap-6 max-w-[800px] mx-auto">
      {posts
        .sort((a, b) => {
          if (
            new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)
          ) {
            return -1;
          }
          return 1;
        })
        .map((post, id) => (
                <BlurFade
                  key={post.slug}
                  delay={BLUR_FADE_DELAY * 3 + id * 0.05}
                >
                  <Link href={`/blog/${post.slug}`}>
                    <Card className="flex flex-col overflow-hidden border hover:shadow-lg transition-all duration-300 ease-out h-full cursor-pointer group">
                      <CardHeader className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-semibold group-hover:text-blue-600 transition-colors">
                              {post.metadata.title}
                            </CardTitle>
                            <Badge variant="secondary" className="text-xs">
                              {new Date(post.metadata.publishedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </Badge>
                          </div>
                          {post.metadata.summary && (
                            <p className="text-muted-foreground text-sm leading-relaxed">
                              {post.metadata.summary}
                            </p>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="px-6 pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              Read More
                            </Badge>
                            <span className="text-xs text-muted-foreground group-hover:text-blue-600 transition-colors">
                              →
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </BlurFade>
              ))}
          </div>

          {posts.length === 0 && (
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
