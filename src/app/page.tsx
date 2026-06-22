import { HackathonCard } from "@/components/hackathon-card";
import BlurFade from "@/components/magicui/blur-fade";
import BlurFadeText from "@/components/magicui/blur-fade-text";
import GithubCalendar from "@/components/github-calendar";
import WorkSection from "@/components/work-section";
import ProjectsSection from "@/components/projects-section";
import { DotPattern } from "@/components/ui/dot-pattern";
import { BorderBeam } from "@/components/ui/border-beam";
import { Ripple } from "@/components/ui/ripple";
import { MorphingText } from "@/components/ui/morphing-text";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DATA } from "@/data/resume";
import Image from "next/image";
import Link from "next/link";
import Markdown from "react-markdown";
import { Boxes, Code2, Workflow } from "lucide-react";

const BLUR_FADE_DELAY = 0.04;

// One plain, left-aligned heading style for every section.
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold tracking-tight">{children}</h2>;
}

const WHAT_I_BUILD = [
  {
    Icon: Boxes,
    title: "SaaS products",
    description:
      "Micro SaaS tools to enterprise platforms, with auth, billing, and dashboards.",
  },
  {
    Icon: Workflow,
    title: "AI automation",
    description:
      "Workflows, integrations, and GPT-powered features that cut manual work.",
  },
  {
    Icon: Code2,
    title: "Full-stack web",
    description: "End-to-end apps with React, Next.js, Node.js, and TypeScript.",
  },
];

const SKILL_GROUPS = [
  { label: "Languages", items: ["JavaScript", "TypeScript"] },
  {
    label: "Frontend",
    items: ["React", "Next.js", "Redux", "Three.js", "GSAP", "Tailwind CSS"],
  },
  {
    label: "Backend",
    items: ["Node.js", "Express.js", "MongoDB", "PostgreSQL", "REST APIs"],
  },
  {
    label: "AI & Automation",
    items: ["OpenAI API", "GPT-4", "AI/ML Integration", "n8n", "Make.com"],
  },
  {
    label: "DevOps & Cloud",
    items: ["Docker", "Git", "CI/CD", "Google Cloud", "Microsoft Azure", "Heroku"],
  },
];

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
        {/* Hero */}
        <section id="hero" className="relative scroll-mt-24">
          <DotPattern
            width={20}
            height={20}
            className="text-foreground/[0.05] [mask-image:radial-gradient(340px_circle_at_center,white,transparent)]"
          />
          <div className="relative z-10 flex items-start justify-between gap-6">
            <div className="flex flex-1 flex-col space-y-6">
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

        {/* About */}
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

        {/* Selected Work (project showcase) — moved up: it's the evidence */}
        <section id="projects" className="scroll-mt-24">
          <div className="flex flex-col gap-y-6">
            <BlurFade delay={BLUR_FADE_DELAY * 5}>
              <SectionHeading>Selected Work</SectionHeading>
            </BlurFade>
            <ProjectsSection />
          </div>
        </section>

        {/* What I Build (capability summary) */}
        <section id="what-i-build" className="scroll-mt-24">
          <div className="flex flex-col gap-y-4">
            <BlurFade delay={BLUR_FADE_DELAY * 5}>
              <SectionHeading>What I Build</SectionHeading>
            </BlurFade>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {WHAT_I_BUILD.map((item, id) => (
                <BlurFade key={item.title} delay={BLUR_FADE_DELAY * 6 + id * 0.05}>
                  <div className="relative h-full overflow-hidden rounded-lg border p-4 transition-colors duration-150 hover:border-foreground/20">
                    <BorderBeam size={70} duration={6} delay={id * 2} />
                    <item.Icon
                      className="size-5 text-foreground"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <h3 className="mt-3 text-sm font-medium">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </BlurFade>
              ))}
            </div>
          </div>
        </section>

        {/* Work Experience */}
        <section id="work" className="scroll-mt-24">
          <div className="flex flex-col gap-y-6">
            <BlurFade delay={BLUR_FADE_DELAY * 6}>
              <SectionHeading>Work Experience</SectionHeading>
            </BlurFade>
            <WorkSection />
          </div>
        </section>

        {/* Technical Skills (grouped) */}
        <section id="skills" className="scroll-mt-24">
          <div className="flex flex-col gap-y-4">
            <BlurFade delay={BLUR_FADE_DELAY * 7}>
              <SectionHeading>Technical Skills</SectionHeading>
            </BlurFade>
            <div className="flex flex-col gap-y-3">
              {SKILL_GROUPS.map((group, gi) => (
                <BlurFade key={group.label} delay={BLUR_FADE_DELAY * 8 + gi * 0.04}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="w-32 shrink-0 text-sm text-muted-foreground">
                      {group.label}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((skill) => (
                        <Badge key={skill} variant="secondary" className="font-normal">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </BlurFade>
              ))}
            </div>
          </div>
        </section>

        {/* Education (compact) */}
        <section id="education" className="scroll-mt-24">
          <div className="flex flex-col gap-y-3">
            <BlurFade delay={BLUR_FADE_DELAY * 9}>
              <SectionHeading>Education</SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 10}>
              <div className="flex flex-col gap-y-2">
                {DATA.education.map((education) => (
                  <div
                    key={education.school}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm"
                  >
                    <span className="font-medium">{education.school}</span>
                    <span className="text-muted-foreground">
                      {education.degree} · {education.start}–{education.end}
                    </span>
                  </div>
                ))}
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Open Source — contributions activity */}
        <section id="open-source" className="scroll-mt-24">
          <div className="flex flex-col gap-y-4">
            <BlurFade delay={BLUR_FADE_DELAY * 11}>
              <SectionHeading>Open Source</SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 12}>
              <GithubCalendar />
            </BlurFade>
          </div>
        </section>

        {/* Community */}
        <section id="hackathons" className="scroll-mt-24">
          <div className="flex flex-col gap-y-6">
            <BlurFade delay={BLUR_FADE_DELAY * 13}>
              <SectionHeading>Community</SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 14}>
              <ul className="mb-4 ml-4 divide-y divide-dashed border-l">
                {DATA.hackathons.map((project, id) => (
                  <BlurFade
                    key={project.title + project.dates}
                    delay={BLUR_FADE_DELAY * 15 + id * 0.05}
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

        {/* Contact — closing statement with Morphing Text + Ripple */}
        <section
          id="contact"
          className="relative scroll-mt-24 overflow-hidden rounded-xl"
        >
          <Ripple className="opacity-60" />
          <div className="relative z-10 flex flex-col items-center gap-6 py-16 text-center">
            <BlurFade delay={BLUR_FADE_DELAY * 16}>
              <MorphingText
                texts={[
                  "SaaS products",
                  "AI automation",
                  "Full-stack apps",
                  "Clean code",
                ]}
                className="text-foreground"
              />
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 17}>
              <div className="space-y-2">
                <SectionHeading>Get in touch</SectionHeading>
                <p className="mx-auto max-w-prose text-sm leading-relaxed text-muted-foreground">
                  Open to new opportunities, collaborations, and interesting
                  projects. Let&apos;s build something.
                </p>
              </div>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 18}>
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
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
