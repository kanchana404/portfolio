"use client";

import BlurFade from "@/components/magicui/blur-fade";
import { LogoImage } from "@/components/logo-image";
import { MetaPill } from "@/components/meta-pill";
import {
  DISCLOSURE_TRIGGER_CLASS,
  DisclosureChevron,
  DisclosurePanel,
  DisclosureSurface,
} from "@/components/section/disclosure";
import { PagerControls, usePageChangeView } from "@/components/section/pager-controls";
import type { DATA } from "@/data/resume";
import { formatDuration } from "@/lib/duration";
import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState } from "react";

type WorkItem = (typeof DATA.work)[number];

const BLUR_FADE_DELAY = 0.04;
const PER_PAGE = 6;
// The current role opens page one, whatever its position in the data.
const PINNED_COMPANY = "Cortana AI";

/**
 * Work history in the Magic UI template's row style, with this site's own
 * behaviour kept from before the redesign:
 *
 * - Pagination, six rows a page, with the current role pinned to the top of
 *   page one. Off-page rows stay in the markup with `hidden`, so every role
 *   is in the HTML crawlers read.
 * - Every row expands on its own (several can be open at once). The surface,
 *   chevron and easing panel are shared with the Hackathons entries
 *   (section/disclosure.tsx).
 *
 * Each row is one grid with a fixed slot for everything, so no row looks
 * different from the next: logo, company and title on the left; the date
 * range, the duration and the employment pills together; and an always-visible
 * chevron on the far right. From `sm` the dates sit in their own right-hand
 * column as in the template; on phones they drop under the title so the
 * company name keeps the width.
 *
 * Durations are computed against `asOf`, the server's render time, so the
 * server and the first client render agree; after mount they are refreshed
 * against the visitor's clock, so "Present" roles never go stale on a page
 * that was statically built weeks ago.
 *
 * Takes the rows as a prop rather than importing DATA: a client component that
 * imports the resume module ships all of it (projects, hackathons, icon SVGs)
 * to the browser, not just the work entries it renders.
 */
export default function WorkSection({
  work,
  asOf,
}: {
  work: readonly WorkItem[];
  /** ISO timestamp from the server render; see above. */
  asOf: string;
}) {
  const [page, setPage] = useState(1);
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set());
  const [now, setNow] = useState(() => new Date(asOf));
  const baseId = useId();

  useEffect(() => setNow(new Date()), []);

  const pinned = work.find((item) => item.company === PINNED_COMPANY);
  const ordered = pinned ? [pinned, ...work.filter((item) => item !== pinned)] : [...work];
  const totalPages = Math.max(1, Math.ceil(ordered.length / PER_PAGE));

  const listRef = useRef<HTMLDivElement>(null);
  // Paging from the controls under a long list leaves the new page's first
  // rows above the viewport (and their entrance never runs), or the focused
  // page button below it. See usePageChangeView.
  const onPageChange = usePageChangeView(listRef, page);

  const goTo = (next: number) => {
    setPage(next);
    setOpenKeys(new Set());
    onPageChange();
  };

  const toggle = (key: string) =>
    setOpenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-y-6">
      <div
        ref={listRef}
        role="group"
        tabIndex={-1}
        aria-label={`Work experience, page ${page} of ${totalPages}`}
        className="grid w-full gap-3 focus:outline-none"
      >
        {ordered.map((item, index) => {
          // Company alone is not unique (two Xleron roles), so key on the start too.
          const key = `${item.company}-${item.start}`;
          const onPage = Math.floor(index / PER_PAGE) + 1 === page;
          const isOpen = onPage && openKeys.has(key);
          const triggerId = `${baseId}-trigger-${index}`;
          const panelId = `${baseId}-panel-${index}`;
          const duration = formatDuration(item.start, item.end, now);

          return (
            // Re-keyed when its page comes into view, which replays the entrance.
            <div key={onPage ? `${key}-page-${page}` : key} hidden={!onPage}>
              <BlurFade delay={BLUR_FADE_DELAY + (index % PER_PAGE) * 0.05}>
                <DisclosureSurface open={isOpen}>
                  <h3 className="m-0">
                    <button
                      type="button"
                      id={triggerId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(key)}
                      className={cn(
                        DISCLOSURE_TRIGGER_CLASS,
                        "grid cursor-pointer items-center gap-x-3 gap-y-1 py-2 font-normal",
                        "grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
                        !isOpen && "hover:bg-muted/50"
                      )}
                    >
                      <LogoImage
                        src={item.logoUrl}
                        darkSrc={"logoUrlDark" in item ? item.logoUrlDark : undefined}
                        alt=""
                        className="col-start-1 row-span-3 row-start-1 self-center sm:row-span-2"
                      />
                      <span className="col-start-2 row-start-1 font-semibold leading-snug text-foreground">
                        {item.company}
                      </span>
                      <span className="col-start-2 row-start-2 text-sm leading-snug text-muted-foreground">
                        {item.title}
                      </span>
                      {/*
                        Two lines, the same shape on every row. Phones: date and
                        duration, then the pills, under the title. From sm: a
                        right-hand column with the date, then duration and pills.
                        The duration is rendered twice (one copy per layout); the
                        hidden copy is display:none, so it is never read twice.
                      */}
                      <span
                        className={cn(
                          "col-start-2 row-start-3 flex flex-col items-start gap-1 text-xs text-muted-foreground",
                          "sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:items-end sm:text-right"
                        )}
                      >
                        {/* A role without dates yet shows no date line at all. */}
                        {item.start && (
                          <span className="whitespace-nowrap tabular-nums">
                            {item.start} - {item.end || "Present"}
                            {duration && <span className="text-[11px] sm:hidden"> · {duration}</span>}
                          </span>
                        )}
                        <span className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                          {duration && (
                            <span className="hidden whitespace-nowrap text-[11px] tabular-nums sm:inline">
                              {duration}
                            </span>
                          )}
                          {item.badges.map((badge) => (
                            <MetaPill key={badge}>{badge}</MetaPill>
                          ))}
                        </span>
                      </span>
                      <DisclosureChevron
                        open={isOpen}
                        className="col-start-3 row-span-3 row-start-1 sm:col-start-4 sm:row-span-2"
                      />
                    </button>
                  </h3>
                  <DisclosurePanel id={panelId} labelledBy={triggerId} open={isOpen}>
                    {/* Indent = px-2 + logo (32px, 40px from md) + gap-x-3, so the text lines up with the company name. */}
                    <p className="m-0 pb-2 pl-[3.25rem] pr-2 pt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm md:pl-[3.75rem]">
                      {item.description}
                    </p>
                  </DisclosurePanel>
                </DisclosureSurface>
              </BlurFade>
            </div>
          );
        })}
      </div>

      <PagerControls
        page={page}
        totalPages={totalPages}
        onChange={goTo}
        label="work experience"
        summary={`Page ${page} of ${totalPages} • ${work.length} total experiences`}
      />
    </div>
  );
}
