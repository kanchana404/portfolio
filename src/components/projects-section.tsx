import BlurFade from "@/components/magicui/blur-fade";
import { ProjectCard } from "@/components/project-card";
import { DATA } from "@/data/resume";

const BLUR_FADE_DELAY = 0.04;

// Show every project as a clean card (no curation, no pagination).
export default function ProjectsSection() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {DATA.projects.map((project, id) => (
        <BlurFade
          key={project.title}
          delay={BLUR_FADE_DELAY + id * 0.05}
          className="h-full"
        >
          <ProjectCard
            title={project.title}
            href={project.href}
            description={project.description}
            dates={project.dates}
            tags={project.technologies}
            image={project.image}
            video={project.video}
            links={project.links}
            className="h-full"
          />
        </BlurFade>
      ))}
    </div>
  );
}
