"use client";

import { useEffect, useState } from "react";

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
        {data.totalContributions.toLocaleString()} contributions in the last year
      </p>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          {data.weeks.map((week, wi) => {
            // The first week may start mid-week — pad the top so each row
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
