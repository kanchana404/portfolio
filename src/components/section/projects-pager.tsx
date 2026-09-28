"use client";

import { PagerControls, usePageChangeView } from "@/components/section/pager-controls";
import { Children, useRef, useState } from "react";

/**
 * Pages through project cards that the server already rendered. The cards
 * arrive as children, so they (and the Markdown inside them) stay server
 * components; this island only decides which page is visible.
 *
 * Off-page cards are kept in the markup with `hidden` rather than dropped, so
 * every project is in the HTML that crawlers read. A card is re-keyed when its
 * page comes into view, which replays its BlurFade entrance.
 *
 * No auto-rows-fr: grid items already stretch to the taller card in their
 * row, and equal rows across the whole grid left 80-120px of empty space in
 * single-column cards on phones.
 */
export function ProjectsPager({
  children,
  pageSize = 4,
}: {
  children: React.ReactNode;
  pageSize?: number;
}) {
  const items = Children.toArray(children);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const gridRef = useRef<HTMLDivElement>(null);
  // Brings the section back into view and moves focus to the grid when a
  // page change would leave either off-screen (see usePageChangeView).
  const onPageChange = usePageChangeView(gridRef, page);

  const goTo = (next: number) => {
    setPage(next);
    onPageChange();
  };

  return (
    <div className="flex flex-col gap-y-6">
      <div
        ref={gridRef}
        role="group"
        tabIndex={-1}
        aria-label={`Projects, page ${page} of ${totalPages}`}
        className="mx-auto grid w-full max-w-[800px] grid-cols-1 gap-3 focus:outline-none sm:grid-cols-2"
      >
        {items.map((child, index) => {
          const onPage = Math.floor(index / pageSize) + 1 === page;
          return (
            <div key={onPage ? `page-${page}-${index}` : `off-${index}`} hidden={!onPage} className="h-full">
              {child}
            </div>
          );
        })}
      </div>
      <PagerControls
        page={page}
        totalPages={totalPages}
        onChange={goTo}
        label="projects"
        summary={`Page ${page} of ${totalPages} • ${items.length} total projects`}
      />
    </div>
  );
}
