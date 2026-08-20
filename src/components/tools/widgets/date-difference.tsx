"use client";

import { useId, useMemo, useState } from "react";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import { diffDates } from "@/lib/tools/math/date-diff";

/**
 * Fixed defaults, not today's date.
 *
 * The page is prerendered, so a `Date.now()` default would bake one day into
 * the HTML and every visitor after it would see a stale value until hydration
 * corrected it. These two are a Monday and the Monday after, which also makes
 * the weekday count obviously right at a glance.
 */
const DEFAULT_FROM = "2026-08-17";
const DEFAULT_TO = "2026-12-25";

export default function DateDifference() {
  const id = useId();
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);

  const result = useMemo(() => diffDates(from, to), [from, to]);

  const rows: Array<[string, string]> = result.ok
    ? [
        [
          "Calendar",
          [
            result.parts!.years ? `${result.parts!.years} years` : "",
            result.parts!.months ? `${result.parts!.months} months` : "",
            result.parts!.days ? `${result.parts!.days} days` : "",
          ]
            .filter(Boolean)
            .join(", ") || "the same day",
        ],
        ["Days", String(result.totalDays)],
        ["Days inclusive", String(result.inclusiveDays)],
        ["Weeks", String(result.totalWeeks)],
        ["Weekdays", String(result.weekdays)],
      ]
    : [];

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid gap-4 border-b p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <ToolLabel htmlFor={`${id}-from`}>From</ToolLabel>
          <ToolInput
            id={`${id}-from`}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <ToolLabel htmlFor={`${id}-to`}>To</ToolLabel>
          <ToolInput
            id={`${id}-to`}
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-2"
          />
        </div>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {!result.ok ? (
          <p className="text-sm text-muted-foreground">{result.error}</p>
        ) : (
          <>
            <dl>
              {rows.map(([label, value], i) => (
                <div
                  key={label}
                  className={cx(
                    "flex min-h-11 items-center gap-3 py-1.5",
                    i > 0 && "border-t border-border/60"
                  )}
                >
                  <dt className="w-32 shrink-0 text-xs text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="min-w-0 flex-1 text-sm tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {result.direction === "backward" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                The second date is earlier, so this is how far back it is.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
