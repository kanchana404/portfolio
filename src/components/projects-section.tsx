import BlurFade from "@/components/magicui/blur-fade";
import { ProjectCard } from "@/components/project-card";
import { Separator } from "@/components/ui/separator";
import { DATA } from "@/data/resume";
import Link from "next/link";

const BLUR_FADE_DELAY = 0.04;
const GITHUB_URL = DATA.contact.social.GitHub.url;

const isReal = (u?: string) =>
  Boolean(
    u &&
      u !== "#" &&
      /^https?:\/\//.test(u) &&
      !u.includes("lnkd.in") &&
      !u.includes("linkedin.com")
  );

// Prefer a real repo link for archive rows, then a real live URL.
function archiveLink(project: any): string | undefined {
  const repo = project.links?.find(
    (l: any) => l.type === "GitHub" && isReal(l.href)
  )?.href;
  if (repo) return repo;
  if (isReal(project.href)) return project.href;
  return project.links?.find((l: any) => isReal(l.href))?.href;
}

export default function ProjectsSection() {
  const projects = DATA.projects as readonly any[];
  const featured = projects.filter((p) => p.featured);
  const archive = projects.filter((p) => !p.featured);

  return (
    <div className="flex flex-col gap-y-10">
      {/* Tier 1 — featured work with browser frames */}
      <div className="flex flex-col gap-y-10">
        {featured.map((project, id) => (
          <BlurFade key={project.title} delay={BLUR_FADE_DELAY + id * 0.06}>
            <ProjectCard
              title={project.title}
              href={project.href}
              description={project.description}
              dates={project.dates}
              tags={project.technologies}
              image={project.image}
              video={project.video}
              links={project.links}
            />
          </BlurFade>
        ))}
      </div>

      {/* Tier 2 — compact archive */}
      {archive.length > 0 && (
        <BlurFade delay={BLUR_FADE_DELAY * 2}>
          <div className="flex flex-col">
            <p className="mb-2 text-sm font-medium">Other projects</p>
            <ul>
              {archive.map((project, id) => {
                const link = archiveLink(project);
                return (
                  <li key={project.title}>
                    {id > 0 && <Separator />}
                    <div className="flex items-baseline justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium">
                          {link ? (
                            <Link
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-underline"
                            >
                              {project.title}
                            </Link>
                          ) : (
                            project.title
                          )}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {project.technologies.slice(0, 4).join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {project.dates}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-sm text-muted-foreground link-underline"
            >
              View all on GitHub →
            </Link>
          </div>
        </BlurFade>
      )}
    </div>
  );
}
