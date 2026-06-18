"use client";

import BlurFade from "@/components/magicui/blur-fade";
import { ResumeCard } from "@/components/resume-card";
import { Button } from "@/components/ui/button";
import { DATA } from "@/data/resume";
import { useState } from "react";

const BLUR_FADE_DELAY = 0.04;

// Interactive (paginated) work-experience island. The heading/intro copy is
// rendered server-side by page.tsx; this client component only owns the
// pagination state.
export default function WorkSection() {
  const [currentWorkPage, setCurrentWorkPage] = useState(1);
  const workPerPage = 4;

  const primaryWork = DATA.work.find((work) => work.company === "Cortana AI");
  const otherWork = DATA.work.filter((work) => work.company !== "Cortana AI");

  let currentWork;
  if (currentWorkPage === 1) {
    const firstPageOthers = otherWork.slice(0, workPerPage - 1);
    currentWork = primaryWork
      ? [primaryWork, ...firstPageOthers]
      : otherWork.slice(0, workPerPage);
  } else {
    const remainingWork = otherWork.slice(workPerPage - 1);
    const startIndex = (currentWorkPage - 2) * workPerPage;
    const endIndex = startIndex + workPerPage;
    currentWork = remainingWork.slice(startIndex, endIndex);
  }

  const totalWorkPages = Math.ceil((otherWork.length + 1) / workPerPage);

  return (
    <>
      <div className="flex min-h-0 flex-col gap-y-3 max-w-[800px] mx-auto">
        {currentWork.map((work, id) => (
          <BlurFade
            key={`${work.company}-${work.title}-${currentWorkPage}`}
            delay={BLUR_FADE_DELAY * 6 + id * 0.05}
          >
            <ResumeCard
              key={work.company}
              logoUrl={work.logoUrl}
              altText={work.company}
              title={work.company}
              subtitle={work.title}
              href={work.href}
              badges={work.badges}
              period={`${work.start} - ${work.end ?? "Present"}`}
              description={work.description}
            />
          </BlurFade>
        ))}
      </div>

      {totalWorkPages > 1 && (
        <BlurFade delay={BLUR_FADE_DELAY * 7}>
          <div className="flex justify-center items-center space-x-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWorkPage(Math.max(1, currentWorkPage - 1))}
              disabled={currentWorkPage === 1}
              className="px-3 py-1"
              aria-label="Previous page of work experience"
            >
              Previous
            </Button>

            <div className="flex space-x-1">
              {Array.from({ length: totalWorkPages }, (_, i) => i + 1).map(
                (page) => (
                  <Button
                    key={page}
                    variant={currentWorkPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentWorkPage(page)}
                    className="w-8 h-8 p-0"
                    aria-label={`Work experience page ${page}`}
                    aria-current={currentWorkPage === page ? "page" : undefined}
                  >
                    {page}
                  </Button>
                )
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentWorkPage(Math.min(totalWorkPages, currentWorkPage + 1))
              }
              disabled={currentWorkPage === totalWorkPages}
              className="px-3 py-1"
              aria-label="Next page of work experience"
            >
              Next
            </Button>
          </div>
        </BlurFade>
      )}

      <BlurFade delay={BLUR_FADE_DELAY * 8}>
        <div className="text-center text-sm text-muted-foreground">
          Page {currentWorkPage} of {totalWorkPages} • {DATA.work.length} total
          experiences
        </div>
      </BlurFade>
    </>
  );
}
