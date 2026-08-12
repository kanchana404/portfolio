"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolInput, ToolLabel, ToolSelect, cx } from "@/components/tools/ui";
import {
  type TimestampUnit,
  UNIT_LABEL,
  describeDate,
  parseDateString,
  parseTimestamp,
} from "@/lib/tools/dev/timestamp";

type Direction = "fromEpoch" | "fromDate";

export default function TimestampConverter() {
  const id = useId();
  const [direction, setDirection] = useState<Direction>("fromEpoch");
  const [unit, setUnit] = useState<TimestampUnit | "auto">("auto");
  const [epoch, setEpoch] = useState("1700000000");
  const [dateText, setDateText] = useState("2026-08-09T14:30:00Z");

  // `now` drives the relative description ("3 days ago"). It cannot be computed
  // during render or the server and client would disagree, so it is set after
  // mount and then ticks once a second.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const parsed = useMemo(
    () =>
      direction === "fromEpoch"
        ? parseTimestamp(epoch, unit)
        : parseDateString(dateText),
    [direction, epoch, unit, dateText]
  );

  const views = parsed.ok && parsed.date ? describeDate(parsed.date, now ?? undefined) : null;

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-4 border-b p-4 sm:p-5">
        <div role="group" aria-label="Direction" className="flex gap-2">
          {(
            [
              ["fromEpoch", "Timestamp → date"],
              ["fromDate", "Date → timestamp"],
            ] as const
          ).map(([d, label]) => (
            <button
              key={d}
              type="button"
              aria-pressed={direction === d}
              onClick={() => setDirection(d)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                direction === d
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {now ? (
          <button
            type="button"
            onClick={() => {
              setDirection("fromEpoch");
              setUnit("seconds");
              setEpoch(String(Math.floor(Date.now() / 1000)));
            }}
            className="text-xs underline underline-offset-2 hover:text-foreground"
          >
            Use the current time
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
        {direction === "fromEpoch" ? (
          <>
            <div>
              <ToolLabel htmlFor={`${id}-epoch`}>Unix timestamp</ToolLabel>
              <ToolInput
                id={`${id}-epoch`}
                value={epoch}
                onChange={(e) => setEpoch(e.target.value)}
                inputMode="numeric"
                spellCheck={false}
                aria-invalid={!parsed.ok && epoch.trim().length > 0}
                className={cx(
                  "mt-2 font-mono",
                  !parsed.ok &&
                    epoch.trim().length > 0 &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>
            <div className="sm:w-44">
              <ToolLabel htmlFor={`${id}-unit`}>Unit</ToolLabel>
              <ToolSelect
                id={`${id}-unit`}
                value={unit}
                onChange={(e) => setUnit(e.target.value as TimestampUnit | "auto")}
                className="mt-2"
              >
                <option value="auto">
                  Detect{parsed.detectedUnit ? ` (${UNIT_LABEL[parsed.detectedUnit]})` : ""}
                </option>
                <option value="seconds">Seconds</option>
                <option value="milliseconds">Milliseconds</option>
                <option value="microseconds">Microseconds</option>
                <option value="nanoseconds">Nanoseconds</option>
              </ToolSelect>
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <ToolLabel htmlFor={`${id}-date`}>Date and time</ToolLabel>
            <ToolInput
              id={`${id}-date`}
              value={dateText}
              onChange={(e) => setDateText(e.target.value)}
              spellCheck={false}
              aria-invalid={!parsed.ok && dateText.trim().length > 0}
              className={cx(
                "mt-2 font-mono",
                !parsed.ok &&
                  dateText.trim().length > 0 &&
                  "border-destructive focus-visible:ring-destructive"
              )}
              placeholder="2026-08-09T14:30:00Z"
            />
          </div>
        )}
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite" aria-atomic="true">
        {views ? (
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            {(
              [
                ["Seconds", views.seconds],
                ["Milliseconds", views.milliseconds],
                ["ISO 8601 (UTC)", views.iso],
                ["RFC 1123 (UTC)", views.utc],
                [`Your time (${views.timeZone})`, views.local],
                ["Day", views.dayOfWeek],
                ["Relative", views.relative],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="flex items-start justify-between gap-2 break-all font-mono">
                  <span>{value}</span>
                  <CopyButton value={value} className="shrink-0" />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p
            className={cx(
              "text-sm",
              parsed.error ? "text-red-700 dark:text-red-400" : "text-muted-foreground"
            )}
            role={parsed.error ? "alert" : undefined}
          >
            {parsed.error ?? "Enter a timestamp or a date."}
          </p>
        )}
      </div>
    </div>
  );
}
