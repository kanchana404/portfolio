"use client";

import BlurFade from "@/components/magicui/blur-fade";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { DATA } from "@/data/resume";
import { useState } from "react";

const BLUR_FADE_DELAY = 0.04;

// Interactive (paginated) projects island. Heading/intro copy is server-rendered
// in page.tsx; this component only owns pagination state.
export default function ProjectsSection() {
  const [currentPage, setCurrentPage] = useState(1);
  const projectsPerPage = 4;
  const totalPages = Math.ceil(DATA.projects.length / projectsPerPage);
  const startIndex = (currentPage - 1) * projectsPerPage;
  const endIndex = startIndex + projectsPerPage;
  const currentProjects = DATA.projects.slice(startIndex, endIndex);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-[800px] mx-auto">
        {currentProjects.map((project, id) => (
          <BlurFade key={project.title} delay={BLUR_FADE_DELAY * 14 + id * 0.05}>
            <ProjectCard
              href={project.href}
              key={project.title}
              title={project.title}
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

      {totalPages > 1 && (
        <BlurFade delay={BLUR_FADE_DELAY * 15}>
          <div className="flex justify-center items-center space-x-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1"
              aria-label="Previous page of projects"
            >
              Previous
            </Button>

            <div className="flex space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-8 h-8 p-0"
                  aria-label={`Projects page ${page}`}
                  aria-current={currentPage === page ? "page" : undefined}
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1"
              aria-label="Next page of projects"
            >
              Next
            </Button>
          </div>
        </BlurFade>
      )}

      <BlurFade delay={BLUR_FADE_DELAY * 16}>
        <div className="text-center text-sm text-muted-foreground">
          Showing {startIndex + 1}-
          {Math.min(endIndex, DATA.projects.length)} of {DATA.projects.length}{" "}
          projects
        </div>
      </BlurFade>
    </>
  );
}
