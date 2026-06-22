import { HackathonCard } from "@/components/hackathon-card";
import BlurFade from "@/components/magicui/blur-fade";
import BlurFadeText from "@/components/magicui/blur-fade-text";
import { ResumeCard } from "@/components/resume-card";
import GithubCalendar from "@/components/github-calendar";
import GithubRepos from "@/components/github-repos";
import WorkSection from "@/components/work-section";
import ProjectsSection from "@/components/projects-section";
import { DotPattern } from "@/components/ui/dot-pattern";
import { Badge } from "@/components/ui/badge";
import { DATA } from "@/data/resume";
import Image from "next/image";
import Link from "next/link";
import Markdown from "react-markdown";

const BLUR_FADE_DELAY = 0.04;

// One plain, left-aligned heading style for every section (minimalist redesign).
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold tracking-tight">{children}</h2>;
}

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
      <main id="main-content" className="flex flex-col min-h-[100dvh] space-y-16">
        <section id="hero" className="relative scroll-mt-24">
          <DotPattern
            width={20}
            height={20}
            className="text-foreground/[0.05] [mask-image:radial-gradient(340px_circle_at_center,white,transparent)]"
          />
          <div className="relative z-10 flex items-start justify-between gap-6">
            <div className="flex flex-1 flex-col space-y-6">
              {/* Single, keyword-rich H1 — rendered statically (no fade) so it
                  is visible to every crawler, including non-JS AI bots. */}
              <h1 className="text-4xl font-bold tracking-tighter leading-[1.05] sm:text-5xl">
                Hi, I&apos;m{" "}
                <span className="whitespace-nowrap">
                  {firstName}{" "}
                  <span
                    className="inline-block animate-wave"
                    role="img"
                    aria-label="waving hand"
                  >
                    👋
                  </span>
                </span>
                <span className="sr-only">
                  {" "}
                  . Software engineer based in Sri Lanka.
                </span>
              </h1>
              <div className="space-y-3">
                <BlurFadeText
                  className="max-w-prose text-pretty text-base leading-relaxed text-muted-foreground"
                  delay={BLUR_FADE_DELAY}
                  text={DATA.description}
                />
                <BlurFade delay={BLUR_FADE_DELAY * 2}>
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    <Link
                      href={DATA.locationLink}
                      className="link-underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📍 {DATA.location}
                    </Link>
                    <span aria-hidden>·</span>
                    <span>He/Him</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />
                      Available for remote &amp; freelance work
                    </span>
                  </p>
                </BlurFade>
              </div>
            </div>
            <BlurFade delay={BLUR_FADE_DELAY}>
              <Image
                src={DATA.avatarUrl}
                alt="Kavitha Kanchana, software engineer"
                width={112}
                height={112}
                priority
                className="size-28 rounded-full border object-cover object-[center_25%]"
              />
            </BlurFade>
          </div>
        </section>

        <section id="about" className="scroll-mt-24">
          <div className="flex flex-col gap-y-3">
            <BlurFade delay={BLUR_FADE_DELAY * 3}>
              <SectionHeading>About</SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 4}>
              <Markdown className="prose max-w-prose text-pretty font-sans text-sm leading-relaxed text-muted-foreground dark:prose-invert">
                {DATA.summary}
              </Markdown>
            </BlurFade>
          </div>
        </section>

        <section id="work" className="scroll-mt-24">
          <div className="flex flex-col gap-y-6">
            <BlurFade delay={BLUR_FADE_DELAY * 5}>
              <SectionHeading>Work Experience</SectionHeading>
            </BlurFade>
            <WorkSection />
          </div>
        </section>

        <section id="education" className="scroll-mt-24">
          <div className="flex flex-col gap-y-3">
            <BlurFade delay={BLUR_FADE_DELAY * 6}>
              <SectionHeading>Education</SectionHeading>
            </BlurFade>
            {DATA.education.map((education, id) => (
              <BlurFade
                key={education.school}
                delay={BLUR_FADE_DELAY * 7 + id * 0.05}
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
          <div className="flex flex-col gap-y-3">
            <BlurFade delay={BLUR_FADE_DELAY * 8}>
              <SectionHeading>Technical Skills</SectionHeading>
            </BlurFade>
            <div className="flex flex-wrap gap-1.5">
              {DATA.skills.map((skill, id) => (
                <BlurFade key={skill} delay={BLUR_FADE_DELAY * 9 + id * 0.03}>
                  <Badge variant="secondary" className="font-normal">
                    {skill}
                  </Badge>
                </BlurFade>
              ))}
            </div>
          </div>
        </section>

        <section id="open-source" className="scroll-mt-24">
          <div className="flex flex-col gap-y-6">
            <BlurFade delay={BLUR_FADE_DELAY * 10}>
              <SectionHeading>Open Source</SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 11}>
              <GithubCalendar />
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 11.5}>
              <p className="text-sm text-muted-foreground">
                Every public repository I&apos;ve built, pulled live from the
                GitHub API. New projects I push show up here automatically.
              </p>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 12}>
              <GithubRepos />
            </BlurFade>
          </div>
        </section>

        <section id="projects" className="scroll-mt-24">
          <div className="flex flex-col gap-y-6">
            <BlurFade delay={BLUR_FADE_DELAY * 13}>
              <SectionHeading>Featured Projects</SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 13.5}>
              <p className="text-sm text-muted-foreground">
                A selection of recent work.
              </p>
            </BlurFade>
            <ProjectsSection />
          </div>
        </section>

        <section id="hackathons" className="scroll-mt-24">
          <div className="flex flex-col gap-y-6">
            <BlurFade delay={BLUR_FADE_DELAY * 14}>
              <SectionHeading>Community</SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 15}>
              <ul className="mb-4 ml-4 divide-y divide-dashed border-l">
                {DATA.hackathons.map((project, id) => (
                  <BlurFade
                    key={project.title + project.dates}
                    delay={BLUR_FADE_DELAY * 16 + id * 0.05}
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
          <div className="flex flex-col gap-y-3">
            <BlurFade delay={BLUR_FADE_DELAY * 17}>
              <SectionHeading>Get in touch</SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 18}>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                Open to new opportunities, collaborations, and interesting
                projects. Reach out and let&apos;s build something.
              </p>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 19}>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <Link
                  href={DATA.contact.social.GitHub.url}
                  className="link-underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </Link>
                <Link
                  href={DATA.contact.social.LinkedIn.url}
                  className="link-underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </Link>
                <Link href={DATA.contact.social.email.url} className="link-underline">
                  Email
                </Link>
              </div>
            </BlurFade>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t pt-6 text-sm text-muted-foreground">
        <p>
          © {year} {DATA.name}, based in {DATA.location}.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            href={DATA.contact.social.GitHub.url}
            className="link-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
          <Link
            href={DATA.contact.social.LinkedIn.url}
            className="link-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </Link>
          <Link href={DATA.contact.social.email.url} className="link-underline">
            Email
          </Link>
          <Link href="/blog" className="link-underline">
            Blog
          </Link>
        </div>
      </footer>
    </>
  );
}
