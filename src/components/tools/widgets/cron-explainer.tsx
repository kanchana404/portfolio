"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import { nextRuns, parseCron } from "@/lib/tools/dev/cron";

const EXAMPLES = [
  ["*/15 * * * *", "Every 15 minutes"],
  ["0 9 * * 1-5", "Weekday mornings"],
  ["0 0 1 * *", "Monthly"],
  ["0 0 13 * 5", "The OR trap"],
] as const;

export default function CronExplainer() {
  const id = useId();
  const [value, setValue] = useState("*/15 * * * *");

  // Next-run times depend on the reader's clock and zone, so they cannot be
  // server-rendered without a hydration mismatch. The description and the field
  // breakdown are pure functions of the expression and ship in the static HTML.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const parsed = useMemo(() => parseCron(value), [value]);
  const runs = useMemo(
    () => (parsed.ok && parsed.fields && now ? nextRuns(parsed.fields, now, 5) : []),
    [parsed, now]
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-cron`}>Cron expression</ToolLabel>
        <ToolInput
          id={`${id}-cron`}
          value={value}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          placeholder="*/15 * * * *"
          className="mt-2 font-mono"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map(([expr, label]) => (
            <button
              key={expr}
              type="button"
              onClick={() => setValue(expr)}
              className="inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {!parsed.ok ? (
          <p className="text-sm text-muted-foreground">{parsed.error}</p>
        ) : (
          <>
            <p className="text-sm font-medium">{parsed.description}</p>

            <dl className="mt-4">
              {parsed.fields?.map((f, i) => (
                <div
                  key={f.name}
                  className={cx(
                    "flex min-h-11 items-center gap-3 py-1.5",
                    i > 0 && "border-t border-border/60"
                  )}
                >
                  <dt className="w-28 shrink-0 text-xs text-muted-foreground">
                    {f.name}
                  </dt>
                  <dd className="min-w-0 flex-1 text-sm">
                    <span className="font-mono">{f.text}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      {f.wildcard
                        ? "every value"
                        : f.values.length > 12
                          ? `${f.values.length} values`
                          : f.values.join(", ")}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>

      {parsed.ok ? (
        <div className="border-t p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next runs
          </p>
          {now === null ? (
            // Waiting on the browser's clock, not on a computation.
            <p className="mt-2 text-sm text-muted-foreground">
              Calculating in your timezone…
            </p>
          ) : runs.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              This schedule never fires. 30 February is the usual reason.
            </p>
          ) : (
            <ul className="mt-2">
              {runs.map((d, i) => (
                <li
                  key={d.toISOString()}
                  className={cx(
                    "flex min-h-11 items-center gap-3 py-1.5 text-sm tabular-nums",
                    i > 0 && "border-t border-border/60"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    {d.toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {parsed.ok ? (
            <div className="mt-3">
              <CopyButton value={value} label="Copy expression" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
