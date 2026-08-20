"use client";

import { useCallback, useEffect, useId, useState } from "react";
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
  MAX_UUID_COUNT,
  UUID_VERSIONS,
  type UuidVersion,
  generateUuids,
  uuidV7Timestamp,
} from "@/lib/tools/dev/uuid";

export default function UuidGenerator() {
  const id = useId();
  const [version, setVersion] = useState<UuidVersion>("v4");
  const [count, setCount] = useState(5);
  const [ids, setIds] = useState<string[]>([]);

  const regenerate = useCallback(() => {
    setIds(generateUuids(version, count));
  }, [version, count]);

  // After mount only. These come from crypto.getRandomValues, so a server render
  // would bake one fixed set into the HTML: identical for every visitor, and
  // cached by every CDN between here and them. The placeholder below says so
  // rather than implying a stall.
  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const info = UUID_VERSIONS.find((v) => v.id === version);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b p-4 sm:p-5">
        <div role="group" aria-label="UUID version" className="flex gap-2">
          {UUID_VERSIONS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={version === v.id}
              onClick={() => setVersion(v.id)}
              className={cx(
                TOOL_CHIP_CLASS,
                version === v.id ? TOOL_CHIP_ON_CLASS : TOOL_CHIP_OFF_CLASS
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ToolLabel htmlFor={`${id}-count`} className="text-xs text-muted-foreground">
            How many
          </ToolLabel>
          <ToolInput
            id={`${id}-count`}
            type="number"
            min={1}
            max={MAX_UUID_COUNT}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-7 w-20 px-2 text-xs tabular-nums"
          />
        </div>
      </div>

      {info ? (
        <p className="border-b px-4 py-2 text-xs text-muted-foreground sm:px-5">
          {info.summary}
        </p>
      ) : null}

      <div className="p-4 sm:p-5">
        {ids.length === 0 ? (
          /*
            Placeholder rows at the real row height, not a single line of text.
            A one-line "generating…" that becomes five 44px rows moves everything
            below it, and the throttled CLS test measured exactly that: 0.0778
            against a 0.05 budget on mobile. The ids cannot be server-rendered
            (they come from crypto.getRandomValues, so the HTML would carry one
            fixed set for every visitor), which leaves reserving the space as the
            only honest option.
          */
          <ul className="space-y-0" aria-hidden>
            {Array.from({ length: Math.max(1, Math.min(count, 20)) }, (_, i) => (
              <li
                key={i}
                className={cx(
                  "flex min-h-11 items-center py-1.5",
                  i > 0 && "border-t border-border/60"
                )}
              >
                <span className="font-mono text-sm text-muted-foreground">
                  {i === 0 ? "Generating in your browser…" : "\u00a0"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-0">
            {ids.map((value, index) => {
              const at = version === "v7" ? uuidV7Timestamp(value) : null;
              return (
                <li
                  key={value}
                  className={cx(
                    "flex min-h-11 items-center gap-3 py-1.5",
                    index > 0 && "border-t border-border/60"
                  )}
                >
                  <span className="min-w-0 flex-1 break-all font-mono text-sm">
                    {value}
                  </span>
                  {at !== null ? (
                    <time
                      dateTime={new Date(at).toISOString()}
                      className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block"
                    >
                      {new Date(at).toISOString().replace("T", " ").slice(0, 19)}
                    </time>
                  ) : null}
                  <CopyButton value={value} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t p-4 sm:p-5">
        <button
          type="button"
          onClick={regenerate}
          className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Generate again
        </button>
        {ids.length > 1 ? <CopyButton value={ids.join("\n")} label="Copy all" /> : null}
      </div>
    </div>
  );
}
