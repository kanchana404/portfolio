"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import {
  TOOL_CHIP_CLASS,
  TOOL_CHIP_OFF_CLASS,
  TOOL_CHIP_ON_CLASS,
  ToolInput,
  ToolLabel,
  cx,
} from "@/components/tools/ui";
import {
  type TimeUnit,
  format,
  parseDate,
  parseEpoch,
} from "@/lib/tools/dev/timestamp";

/**
 * A fixed default rather than `Date.now()`.
 *
 * The server prerenders this page, so a "now" default would bake one instant
 * into the HTML and every visitor would see a stale timestamp until hydration
 * replaced it. A fixed, obviously-real epoch renders identically everywhere and
 * the Now button is one click away.
 */
const DEFAULT_INPUT = "1755000000";

export default function TimestampConverter() {
  const id = useId();
  const [value, setValue] = useState(DEFAULT_INPUT);
  const [forced, setForced] = useState<TimeUnit | null>(null);

  // Local time and "3 hours ago" both depend on the reader's clock and zone, so
  // they cannot be rendered on the server without a hydration mismatch. They
  // appear once mounted; everything above them is timezone-independent and
  // ships in the static HTML.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const parsed = useMemo(() => {
    const text = value.trim();
    // A bare integer is an epoch; anything else is a date string. Deciding here
    // rather than with a mode switch means pasting either one just works.
    return /^-?\d+$/.test(text)
      ? parseEpoch(text, forced ?? undefined)
      : parseDate(text);
  }, [value, forced]);

  const out = parsed.ok ? format(parsed.ms, now ?? parsed.ms) : null;
  const isEpoch = /^-?\d+$/.test(value.trim());

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-in`}>Timestamp or date</ToolLabel>
        <ToolInput
          id={`${id}-in`}
          value={value}
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            setForced(null);
          }}
          placeholder="1755000000 or 2026-08-20T14:30:00Z"
          className="mt-2 font-mono"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setValue(String(Math.floor(Date.now() / 1000)));
              setForced(null);
            }}
            className="inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted"
          >
            Now
          </button>

          {/* Only meaningful for a bare number, and only worth showing because
              the guess can be wrong: a small integer really can be milliseconds. */}
          {isEpoch && parsed.ok ? (
            <div role="group" aria-label="Read the number as" className="flex gap-2">
              {(["seconds", "milliseconds"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={parsed.unit === u}
                  onClick={() => setForced(u)}
                  className={cx(
                    TOOL_CHIP_CLASS,
                    parsed.unit === u ? TOOL_CHIP_ON_CLASS : TOOL_CHIP_OFF_CLASS
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {!parsed.ok ? (
          <p className="text-sm text-muted-foreground">{parsed.error}</p>
        ) : out ? (
          <dl className="space-y-0">
            {[
              ["ISO 8601", out.iso],
              ["UTC", out.utc],
              ["Seconds", String(out.seconds)],
              ["Milliseconds", String(out.milliseconds)],
            ].map(([label, v], i) => (
              <div
                key={label}
                className={cx(
                  "flex min-h-11 items-center gap-3 py-1.5",
                  i > 0 && "border-t border-border/60"
                )}
              >
                <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
                <dd className="min-w-0 flex-1 break-all font-mono text-sm tabular-nums">
                  {v}
                </dd>
                <CopyButton value={v} />
              </div>
            ))}

            {/* Rendered only after mount. Before that the reader's zone is
                unknown, and guessing it on the server is how a converter shows
                the wrong local time to everyone outside one timezone. */}
            {now !== null ? (
              <>
                <div className="flex min-h-11 items-center gap-3 border-t border-border/60 py-1.5">
                  <dt className="w-28 shrink-0 text-xs text-muted-foreground">
                    Your time
                  </dt>
                  <dd className="min-w-0 flex-1 text-sm">
                    {out.local}
                    <span className="text-muted-foreground"> ({out.localZone})</span>
                  </dd>
                </div>
                <div className="flex min-h-11 items-center gap-3 border-t border-border/60 py-1.5">
                  <dt className="w-28 shrink-0 text-xs text-muted-foreground">
                    Relative
                  </dt>
                  <dd className="min-w-0 flex-1 text-sm">{out.relative}</dd>
                </div>
              </>
            ) : null}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
