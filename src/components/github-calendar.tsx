"use client";

import { Highlighter } from "@/components/magicui/highlighter";
import { useEffect, useRef, useState } from "react";

type ContributionLevel =
  | "NONE"
  | "FIRST_QUARTILE"
  | "SECOND_QUARTILE"
  | "THIRD_QUARTILE"
  | "FOURTH_QUARTILE";

type Day = {
  date: string;
  contributionCount: number;
  contributionLevel: ContributionLevel;
};

type Week = { contributionDays: Day[] };

type CalendarData = {
  totalContributions: number;
  weeks: Week[];
};

const LEVEL_CLASS: Record<ContributionLevel, string> = {
  NONE: "bg-neutral-100 dark:bg-neutral-800",
  FIRST_QUARTILE: "bg-neutral-300 dark:bg-neutral-600",
  SECOND_QUARTILE: "bg-neutral-500 dark:bg-neutral-400",
  THIRD_QUARTILE: "bg-neutral-700 dark:bg-neutral-200",
  FOURTH_QUARTILE: "bg-neutral-900 dark:bg-neutral-50",
};

const LEGEND_LEVELS: ContributionLevel[] = [
  "NONE",
  "FIRST_QUARTILE",
  "SECOND_QUARTILE",
  "THIRD_QUARTILE",
  "FOURTH_QUARTILE",
];

export default function GithubCalendar() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open on the latest weeks. On narrow screens the year is wider than the
  // column, and the interesting end is the right one; scroll there once the
  // grid exists. Visitors can still scroll back to see earlier weeks.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);

  useEffect(() => {
    fetch("/api/github-contributions")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError("Failed to load contributions"));
  }, []);

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t load GitHub contributions right now.
      </p>
    );
  }

  if (!data) {
    return <div className="h-[140px] w-full animate-pulse rounded-md bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {/* The count carries the section, so it gets a hand-drawn underline,
            in ink like every other marked word. */}
        <Highlighter action="underline" strokeWidth={2} isView delay={200}>
          <span className="whitespace-nowrap font-medium tabular-nums text-foreground">
            {data.totalContributions.toLocaleString()}
          </span>
        </Highlighter>
        {" contributions in the last year"}
      </p>

      {/*
        data-lenis-prevent-horizontal: Lenis otherwise claims any wheel event
        with a vertical component, so a mostly sideways trackpad swipe moved
        the page instead of the calendar. Vertical wheel stays smoothed.
        A named, focusable region, so keyboard users can scroll it too.
      */}
      <div
        ref={scrollRef}
        role="region"
        aria-label="GitHub contributions calendar"
        tabIndex={0}
        data-lenis-prevent-horizontal
        className="overflow-x-auto rounded-sm pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex gap-[3px]">
          {data.weeks.map((week, wi) => {
            // The first week may start mid-week, so pad the top so each row
            // lines up with the correct weekday (Sun at top, like GitHub).
            const pad =
              wi === 0
                ? new Date(week.contributionDays[0].date).getUTCDay()
                : 0;
            return (
              <div key={wi} className="flex flex-col gap-[3px]">
                {Array.from({ length: pad }).map((_, i) => (
                  <div key={`pad-${i}`} className="size-[11px] rounded-[2px]" />
                ))}
                {week.contributionDays.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.contributionCount} contribution${
                      day.contributionCount === 1 ? "" : "s"
                    } on ${new Date(day.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      // GitHub's dates are calendar days ("2026-09-28", read
                      // as UTC midnight). Formatting them in the visitor's
                      // zone showed the day before west of UTC.
                      timeZone: "UTC",
                    })}`}
                    className={`size-[11px] rounded-[2px] ${
                      LEVEL_CLASS[day.contributionLevel]
                    }`}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 self-end text-xs text-muted-foreground">
        <span>Less</span>
        {LEGEND_LEVELS.map((lvl) => (
          <span
            key={lvl}
            className={`size-[11px] rounded-[2px] ${LEVEL_CLASS[lvl]}`}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
