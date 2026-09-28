import BlurFade from "@/components/magicui/blur-fade";
import GithubCalendar from "@/components/github-calendar";
import { HighlightedText } from "@/components/highlighted-text";
import { Highlighter } from "@/components/magicui/highlighter";
import { LogoImage } from "@/components/logo-image";
import ContactSection from "@/components/section/contact-section";
import HackathonsSection from "@/components/section/hackathons-section";
import ProjectsSection from "@/components/section/projects-section";
import { SectionIntro } from "@/components/section/section-pill";
import WorkSection from "@/components/section/work-section";
import { DATA } from "@/data/resume";
import { cssBlurFade } from "@/lib/css-blur-fade";
import { jsonLdHtml } from "@/lib/json-ld";
import { PERSON_ID, SITE_AVATAR, WEBSITE_ID } from "@/lib/site";
import { cn } from "@/lib/utils";
import { toolsByRecency } from "@/lib/tools/registry";
import { TOOLS_SECTION_LIVE } from "@/lib/tools/section-flag";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Markdown from "react-markdown";

/**
 * Homepage, laid out after the Magic UI portfolio template
 * (github.com/magicuidesign/portfolio): hero, About, Work Experience,
 * Education, Skills, then the pill-headed Projects, Hackathons and Contact
 * blocks. Two sections are this site's own and sit where the template has
 * nothing: GitHub Contributions (the calendar) after Skills, and Tools,
 * which renders only while the tools section is live.
 */

// Stagger step within a section. BlurFade waits for each block to scroll into
// view, so delays are counted from the moment a section appears, not from
// page load: every section runs its own short 0.04s cascade.
//
// The hero and About are on screen at load, so they take the same entrance
// in CSS (cssBlurFade) and paint straight from the HTML. With the motion
// BlurFade they stayed at opacity 0 until the JS hydrated.
const BLUR_FADE_DELAY = 0.04;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold">{children}</h2>;
}

// The homepage is the profile: its ProfilePage node points at the Person and
// WebSite nodes the root layout publishes, by @id.
const PROFILE_PAGE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": `${DATA.url}/#profilepage`,
  url: DATA.url,
  name: `${DATA.name} - Software Engineer & Founder`,
  dateCreated: "2025-08-01T00:00:00+05:30",
  dateModified: "2026-09-28T00:00:00+05:30",
  isPartOf: { "@id": WEBSITE_ID },
  about: { "@id": PERSON_ID },
  mainEntity: { "@id": PERSON_ID },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: new URL(SITE_AVATAR, DATA.url).toString(),
  },
  inLanguage: "en-US",
};

export default function Page() {
  const firstName = DATA.name.split(" ")[0];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(PROFILE_PAGE_JSON_LD) }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
      >
        Skip to main content
      </a>
      <main id="main-content" className="relative flex min-h-dvh flex-col gap-14">
        <section id="hero" className="scroll-mt-24">
          <div className="mx-auto w-full max-w-2xl space-y-8">
            <div className="flex flex-col justify-between gap-2 gap-y-6 md:flex-row">
              <div className="order-2 flex flex-col gap-2 md:order-1">
                {/*
                  A block fade rather than the template's BlurFadeText so the
                  lines can hold Highlighter marks. Two marks, one strong and
                  one quiet: a highlighter stroke behind the name, then a thin
                  underline under the current role once the fade settles.
                */}
                <div {...cssBlurFade({ delay: BLUR_FADE_DELAY, yOffset: 8, blur: 8 })}>
                  <h1 className="text-3xl font-semibold tracking-tighter sm:text-4xl lg:text-5xl">
                    {"Hi, I'm "}
                    <Highlighter
                      action="highlight"
                      padding={[2, 6]}
                      animationDuration={800}
                      delay={550}
                    >
                      {firstName}
                    </Highlighter>
                    <span className="sr-only">. Software engineer based in Sri Lanka.</span>
                  </h1>
                </div>
                <div {...cssBlurFade({ delay: BLUR_FADE_DELAY, yOffset: 8, blur: 8 })}>
                  <p className="max-w-[600px] text-muted-foreground md:text-lg lg:text-xl">
                    <HighlightedText
                      text={DATA.description}
                      marks={DATA.descriptionMarks}
                      delay={1000}
                    />
                  </p>
                </div>
              </div>
              <div {...cssBlurFade({ delay: BLUR_FADE_DELAY, className: "order-1 md:order-2" })}>
                {/*
                  The template's Avatar look (ring, shadow, border), drawn with
                  next/image instead of Radix AvatarImage: Radix only mounts the
                  <img> after a client-side load check, which keeps the photo
                  out of the server HTML and delays the largest paint.
                */}
                <div className="relative size-24 shrink-0 overflow-hidden rounded-full border shadow-lg ring-4 ring-muted md:size-32">
                  <Image
                    src={DATA.avatarUrl}
                    alt="Kavitha Kanchana, software engineer"
                    fill
                    sizes="(min-width: 768px) 128px, 96px"
                    priority
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="scroll-mt-24">
          <div className="flex min-h-0 flex-col gap-y-4">
            <div {...cssBlurFade({ delay: BLUR_FADE_DELAY })}>
              <SectionHeading>About</SectionHeading>
            </div>
            <div {...cssBlurFade({ delay: BLUR_FADE_DELAY * 2 })}>
              <div className="prose max-w-full text-pretty font-sans leading-relaxed text-muted-foreground dark:prose-invert">
                <Markdown
                  components={{
                    a: ({ node, href, ...props }) =>
                      href?.startsWith("http") ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" {...props} />
                      ) : (
                        <a href={href} {...props} />
                      ),
                  }}
                >
                  {DATA.summary}
                </Markdown>
              </div>
            </div>
          </div>
        </section>

        <section id="work" className="scroll-mt-24">
          <div className="flex min-h-0 flex-col gap-y-6">
            <BlurFade delay={BLUR_FADE_DELAY}>
              <SectionHeading>
                {"Work "}
                <Highlighter action="highlight" padding={[1, 4]} isView delay={200}>
                  Experience
                </Highlighter>
              </SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 2}>
              <WorkSection work={DATA.work} asOf={new Date().toISOString()} />
            </BlurFade>
          </div>
        </section>

        <section id="education" className="scroll-mt-24">
          <div className="flex min-h-0 flex-col gap-y-6">
            <BlurFade delay={BLUR_FADE_DELAY}>
              <SectionHeading>
                <Highlighter action="underline" strokeWidth={2.5} isView delay={200}>
                  Education
                </Highlighter>
              </SectionHeading>
            </BlurFade>
            <div className="flex flex-col gap-8">
              {DATA.education.map((education, index) => {
                // Same grid as a work row: from sm the dates sit in a right-hand
                // column, then an empty 1rem track where a work row has its
                // chevron, so the two date columns end at the same x. On
                // phones the dates drop under the degree so the school name
                // keeps the width.
                const body = (
                  <>
                    <LogoImage
                      src={education.logoUrl}
                      alt=""
                      className="col-start-1 row-span-3 row-start-1 self-center sm:row-span-2"
                    />
                    <div className="col-start-2 row-start-1 flex items-center gap-2 font-semibold leading-snug">
                      {education.school}
                      {education.href !== "#" && (
                        <ArrowUpRight
                          className="h-3.5 w-3.5 shrink-0 -translate-x-2 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="col-start-2 row-start-2 font-sans text-sm leading-snug text-muted-foreground">
                      {education.degree}
                    </div>
                    <div className="col-start-2 row-start-3 whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:self-center sm:text-right">
                      {education.start} - {education.end}
                    </div>
                  </>
                );
                const rowClass =
                  "group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)_auto_1rem]";
                return (
                  <BlurFade
                    key={education.school}
                    delay={BLUR_FADE_DELAY * 2 + index * 0.05}
                  >
                    {education.href !== "#" ? (
                      <Link
                        href={education.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={rowClass}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className={rowClass}>{body}</div>
                    )}
                  </BlurFade>
                );
              })}
            </div>
          </div>
        </section>

        <section id="skills" className="scroll-mt-24">
          <div className="flex min-h-0 flex-col gap-y-4">
            <BlurFade delay={BLUR_FADE_DELAY}>
              <SectionHeading>
                <Highlighter action="highlight" padding={[1, 4]} isView delay={200}>
                  Skills
                </Highlighter>
              </SectionHeading>
            </BlurFade>
            <ul className="flex flex-wrap gap-2">
              {DATA.skills.map((skill, id) => (
                <li key={skill.name}>
                  <BlurFade delay={BLUR_FADE_DELAY * 2 + id * 0.03}>
                    <div className="flex h-8 w-fit items-center gap-2 rounded-xl border border-border bg-background px-4 ring-2 ring-border/20">
                      {"icon" in skill && skill.icon ? (
                        <skill.icon
                          className="size-4 overflow-hidden rounded object-contain"
                          aria-hidden
                        />
                      ) : "logo" in skill && skill.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={skill.logo}
                          alt=""
                          width={"logoWide" in skill && skill.logoWide ? 38 : 16}
                          height={"logoWide" in skill && skill.logoWide ? 14 : 16}
                          loading="lazy"
                          className={cn(
                            "logoWide" in skill && skill.logoWide ? "h-3.5 w-auto" : "size-4",
                            "object-contain",
                            "invertOnDark" in skill && skill.invertOnDark && "dark:invert"
                          )}
                        />
                      ) : null}
                      <span className="text-sm font-medium text-foreground">{skill.name}</span>
                    </div>
                  </BlurFade>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="github-contributions" className="scroll-mt-24">
          <div className="flex min-h-0 flex-col gap-y-4">
            <BlurFade delay={BLUR_FADE_DELAY}>
              <SectionHeading>
                {"GitHub "}
                <Highlighter action="highlight" padding={[1, 4]} isView delay={200}>
                  Contributions
                </Highlighter>
              </SectionHeading>
            </BlurFade>
            <BlurFade delay={BLUR_FADE_DELAY * 2}>
              <GithubCalendar />
            </BlurFade>
          </div>
        </section>

        <section id="projects" className="scroll-mt-24">
          <BlurFade delay={BLUR_FADE_DELAY}>
            <ProjectsSection />
          </BlurFade>
        </section>

        {/*
          Tools: the crawl path into /tools.

          A body link inside the main content flow, not just the Dock. The Dock
          is a real <Link> and does pass equity, but it is fixed-position chrome
          rendered after {children}; a link surrounded by topical prose is the
          path that actually gets followed, and indexation is the bottleneck this
          whole section exists to solve.

          Imports only the registry, never the widget map, so nothing here can
          drag widget code into the homepage bundle.
        */}
        {TOOLS_SECTION_LIVE && (
          <section id="tools" className="scroll-mt-24">
            <BlurFade delay={BLUR_FADE_DELAY}>
              <div className="flex min-h-0 flex-col gap-y-8">
                <SectionIntro pill="Tools" title="Free tools I built">
                  Small utilities I made for my own use and kept online. Most run
                  entirely in your browser: nothing is uploaded and nothing needs
                  an account. <Link
                    href="/tools"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    Browse all tools
                  </Link>
                  .
                </SectionIntro>
                <ul className="mx-auto grid w-full max-w-[800px] grid-cols-1 gap-3 sm:grid-cols-3">
                  {toolsByRecency()
                    .slice(0, 3)
                    .map((tool) => (
                      <li key={tool.slug}>
                        <Link
                          href={`/tools/${tool.slug}`}
                          className="flex h-full flex-col gap-1 rounded-xl border border-border p-6 transition-all duration-200 hover:ring-2 hover:ring-muted"
                        >
                          <span className="font-semibold">{tool.title}</span>
                          <span className="text-xs leading-relaxed text-muted-foreground">
                            {tool.description}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            </BlurFade>
          </section>
        )}

        <section id="hackathons" className="scroll-mt-24">
          <BlurFade delay={BLUR_FADE_DELAY}>
            <HackathonsSection />
          </BlurFade>
        </section>

        <section id="contact" className="scroll-mt-24">
          <BlurFade delay={BLUR_FADE_DELAY}>
            <ContactSection />
          </BlurFade>
        </section>
      </main>
    </>
  );
}
