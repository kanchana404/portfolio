import BlurFade from "@/components/magicui/blur-fade";
import { ProjectCard } from "@/components/project-card";
import { ProjectsPager } from "@/components/section/projects-pager";
import { SectionIntro } from "@/components/section/section-pill";
import { DATA } from "@/data/resume";

const BLUR_FADE_DELAY = 0.04;
// Two rows of two on wide screens.
const PAGE_SIZE = 4;

export default function ProjectsSection() {
  return (
    <div className="flex min-h-0 flex-col gap-y-8">
      <SectionIntro pill="My Projects" title="Check out my latest work" titleMark="latest work">
        I&apos;ve built everything from e-commerce storefronts to AI agents and
        SaaS platforms. Here are a few of my favorites.
      </SectionIntro>
      <ProjectsPager pageSize={PAGE_SIZE}>
        {DATA.projects.map((project, id) => (
          <BlurFade
            key={project.title}
            // Stagger within a page, so page two does not wait for page one's delays.
            delay={BLUR_FADE_DELAY * 2 + (id % PAGE_SIZE) * 0.05}
            className="h-full"
          >
            <ProjectCard
              href={project.href}
              title={project.title}
              description={project.description}
              dates={project.dates}
              tags={project.technologies}
              category={"category" in project ? project.category : undefined}
              featured={"featured" in project ? project.featured : undefined}
              image={project.image}
              video={project.video}
              links={project.links}
            />
          </BlurFade>
        ))}
      </ProjectsPager>
    </div>
  );
}
