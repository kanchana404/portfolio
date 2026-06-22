"use client";

import BlurFade from "@/components/magicui/blur-fade";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { DATA } from "@/data/resume";
import { useState } from "react";

const BLUR_FADE_DELAY = 0.04;
const PER_PAGE = 4;

export default function ProjectsSection() {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(DATA.projects.length / PER_PAGE);
  const start = (page - 1) * PER_PAGE;
  const current = DATA.projects.slice(start, start + PER_PAGE);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {current.map((project, id) => (
          <BlurFade
            key={`${project.title}-${page}`}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label="Previous projects page"
          >
            Previous
          </Button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={page === p ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setPage(p)}
                aria-label={`Projects page ${p}`}
                aria-current={page === p ? "page" : undefined}
              >
                {p}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            aria-label="Next projects page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
