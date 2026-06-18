import { HackathonCard } from "@/components/hackathon-card";
import BlurFade from "@/components/magicui/blur-fade";
import BlurFadeText from "@/components/magicui/blur-fade-text";
import { ResumeCard } from "@/components/resume-card";
import GithubCalendar from "@/components/github-calendar";
import GithubRepos from "@/components/github-repos";
import WorkSection from "@/components/work-section";
import ProjectsSection from "@/components/projects-section";
import { Badge } from "@/components/ui/badge";
import { DATA } from "@/data/resume";
import Image from "next/image";
import Link from "next/link";
import Markdown from "react-markdown";

const BLUR_FADE_DELAY = 0.04;

export default function Page() {
  const firstName = DATA.name.split(" ")[0];
  const year = new Date().getFullYear();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
      >
        Skip to main content
      </a>
      <main
        id="main-content"
        className="flex flex-col min-h-[100dvh] space-y-10"
      >
        <section id="hero" className="scroll-mt-24">
          <div className="mx-auto w-full max-w-2xl space-y-8">
            <div className="gap-2 flex justify-between">
              <div className="flex-col flex flex-1 space-y-1.5">
                {/* Single, keyword-rich H1 — rendered statically (no fade) so it
                    is visible to every crawler, including non-JS AI bots. */}
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                  Hi, I&apos;m {firstName} 👋
                  <span className="sr-only">
                    {" "}
                    — Full-Stack Software Engineer building SaaS products, from
                    micro SaaS to enterprise level, plus AI automation, in Sri
                    Lanka
                  </span>
                </h1>
                <BlurFadeText
                  className="max-w-[600px] md:text-xl"
                  delay={BLUR_FADE_DELAY}
                  text={DATA.description}
                />
                <BlurFade delay={BLUR_FADE_DELAY * 2}>
                  <p className="text-sm text-muted-foreground">
                    📍{" "}
                    <Link
                      href={DATA.locationLink}
                      className="hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {DATA.location}
                    </Link>{" "}
                    · He/Him · Available worldwide for remote work &amp;
                    freelance projects
                  </p>
                </BlurFade>
              </div>
              <BlurFade delay={BLUR_FADE_DELAY}>
                <Image
                  src={DATA.avatarUrl}
                  alt="Kavitha Kanchana — Software Engineer at Cortana AI, full-stack & SaaS developer (and AI automation) in Sri Lanka"
                  width={112}
                  height={112}
                  priority
                  className="size-28 rounded-full border object-cover object-[center_25%]"
                />
              </BlurFade>
            </div>
          </div>
        </section>

        <nav aria-label="Page sections" className="-mt-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <li>
              <Link href="#about" className="hover:text-foreground hover:underline">
                About
              </Link>
            </li>
            <li>
              <Link href="#work" className="hover:text-foreground hover:underline">
                Work Experience
              </Link>
            </li>
            <li>
              <Link href="#skills" className="hover:text-foreground hover:underline">
                Technical Skills
              </Link>
            </li>
            <li>
              <Link
                href="#projects"
                className="hover:text-foreground hover:underline"
              >
                SaaS Projects
              </Link>
            </li>
            <li>
              <Link
                href="#repositories"
                className="hover:text-foreground hover:underline"
              >
                Open Source
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-foreground hover:underline">
                Writing
              </Link>
            </li>
            <li>
              <Link
                href="#contact"
                className="hover:text-foreground hover:underline"
              >
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        <section id="about" className="scroll-mt-24">
          <BlurFade delay={BLUR_FADE_DELAY * 3}>
            <h2 className="text-xl font-bold">About Me</h2>
          </BlurFade>
          <BlurFade delay={BLUR_FADE_DELAY * 4}>
            <Markdown className="prose max-w-full text-pretty font-sans text-sm text-muted-foreground dark:prose-invert">
              {DATA.summary}
            </Markdown>
          </BlurFade>
        </section>

        <section id="work" className="scroll-mt-24">
          <div className="space-y-12 w-full py-12">
            <BlurFade delay={BLUR_FADE_DELAY * 5}>
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="space-y-2">
                  <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                    Professional Experience
                  </div>
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                    Work Experience
                  </h2>
                  <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    My professional journey across various companies and roles,
                    building innovative solutions and gaining valuable
                    experience.
                  </p>
                </div>
              </div>
            </BlurFade>
            <WorkSection />
          </div>
        </section>

        <section id="education" className="scroll-mt-24">
          <div className="flex min-h-0 flex-col gap-y-3">
            <BlurFade delay={BLUR_FADE_DELAY * 9}>
              <h2 className="text-xl font-bold">Education</h2>
            </BlurFade>
            {DATA.education.map((education, id) => (
              <BlurFade
                key={education.school}
                delay={BLUR_FADE_DELAY * 10 + id * 0.05}
              >
                <ResumeCard
                  key={education.school}
                  href={education.href}
                  logoUrl={education.logoUrl}
                  altText={education.school}
                  title={education.school}
                  subtitle={education.degree}
                  period={`${education.start} - ${education.end}`}
                />
              </BlurFade>
            ))}
          </div>
        </section>

        <section id="skills" className="scroll-mt-24">
          <div className="flex min-h-0 flex-col gap-y-3">
            <BlurFade delay={BLUR_FADE_DELAY * 11}>
              <h2 className="text-xl font-bold">Technical Skills</h2>
            </BlurFade>
            <div className="flex flex-wrap gap-1">
              {DATA.skills.map((skill, id) => (
                <BlurFade key={skill} delay={BLUR_FADE_DELAY * 12 + id * 0.05}>
                  <Badge key={skill}>{skill}</Badge>
                </BlurFade>
              ))}
            </div>
          </div>
        </section>

        <section id="github" className="scroll-mt-24">
          <div className="flex min-h-0 flex-col gap-y-3">
            <BlurFade delay={BLUR_FADE_DELAY * 12.5}>
              <h2 className="text-xl font-bold">GitHub Contributions</h2>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 13}>
              <GithubCalendar />
            </BlurFade>
          </div>
        </section>

        <section id="projects" className="scroll-mt-24">
          <div className="space-y-12 w-full py-12">
            <BlurFade delay={BLUR_FADE_DELAY * 13}>
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="space-y-2">
                  <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                    Featured Projects
                  </div>
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                    Featured SaaS &amp; Web Projects
                  </h2>
                  <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    I&apos;ve built a range of products, from micro SaaS tools to
                    full-scale, enterprise-grade platforms — along with AI
                    automation and AI-powered features. Here are some of my
                    recent highlights.
                  </p>
                </div>
              </div>
            </BlurFade>
            <ProjectsSection />
          </div>
        </section>

        <section id="repositories" className="scroll-mt-24">
          <div className="space-y-12 w-full py-12">
            <BlurFade delay={BLUR_FADE_DELAY * 16.5}>
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="space-y-2">
                  <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                    Open Source
                  </div>
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                    Open Source GitHub Repositories
                  </h2>
                  <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Every public repository I&apos;ve built, pulled live from the
                    GitHub API and analyzed into a short description. This list
                    syncs itself — new projects I push show up here
                    automatically.
                  </p>
                </div>
              </div>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 17}>
              <div className="max-w-[800px] mx-auto">
                <GithubRepos />
              </div>
            </BlurFade>
          </div>
        </section>

        <section id="writing" className="scroll-mt-24">
          <div className="flex min-h-0 flex-col gap-y-3">
            <BlurFade delay={BLUR_FADE_DELAY * 17.5}>
              <h2 className="text-xl font-bold">Writing</h2>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 18}>
              <p className="text-sm text-muted-foreground">
                I write about software development, building SaaS products,
                scalable architecture, and shipping with Next.js &amp; React.{" "}
                <Link href="/blog" className="text-blue-500 hover:underline">
                  Read the blog →
                </Link>
              </p>
            </BlurFade>
          </div>
        </section>

        <section id="hackathons" className="scroll-mt-24">
          <div className="space-y-12 w-full py-12">
            <BlurFade delay={BLUR_FADE_DELAY * 18}>
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="space-y-2">
                  <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                    Community &amp; Events
                  </div>
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                    Community Involvement
                  </h2>
                  <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    I love participating in tech communities and contributing to
                    open-source projects. These experiences help me grow as a
                    developer and give back to the community.
                  </p>
                </div>
              </div>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 19}>
              <ul className="mb-4 ml-4 divide-y divide-dashed border-l">
                {DATA.hackathons.map((project, id) => (
                  <BlurFade
                    key={project.title + project.dates}
                    delay={BLUR_FADE_DELAY * 20 + id * 0.05}
                  >
                    <HackathonCard
                      title={project.title}
                      description={project.description}
                      location={project.location}
                      dates={project.dates}
                      image={project.image}
                      links={project.links}
                    />
                  </BlurFade>
                ))}
              </ul>
            </BlurFade>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24">
          <div className="grid items-center justify-center gap-4 px-4 text-center md:px-6 w-full py-12">
            <BlurFade delay={BLUR_FADE_DELAY * 21}>
              <div className="space-y-3">
                <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                  Get In Touch
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  Contact Kavitha Kanchana
                </h2>
                <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  I&apos;m always interested in new opportunities,
                  collaborations, and interesting projects. Feel free to reach
                  out if you&apos;d like to work together or just want to say
                  hello!
                </p>
                <div className="flex justify-center space-x-4 mt-6">
                  <Link
                    href={DATA.contact.social.GitHub.url}
                    className="text-blue-500 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                  </Link>
                  <Link
                    href={DATA.contact.social.LinkedIn.url}
                    className="text-blue-500 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </Link>
                  <Link
                    href={DATA.contact.social.email.url}
                    className="text-blue-500 hover:underline"
                  >
                    Email
                  </Link>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-2xl border-t pt-6 mt-12 text-sm text-muted-foreground">
        <p>
          © {year} {DATA.name} — Software Engineer &amp; Founder, based in{" "}
          {DATA.location}.
        </p>
        <div className="mt-2 flex gap-4">
          <Link
            href={DATA.contact.social.GitHub.url}
            className="hover:text-foreground hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
          <Link
            href={DATA.contact.social.LinkedIn.url}
            className="hover:text-foreground hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </Link>
          <Link
            href={DATA.contact.social.email.url}
            className="hover:text-foreground hover:underline"
          >
            Email
          </Link>
          <Link href="/blog" className="hover:text-foreground hover:underline">
            Blog
          </Link>
        </div>
      </footer>
    </>
  );
}
