"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  type UuidVersion,
  generateUuids,
  inspectUuid,
} from "@/lib/tools/dev/uuid";

export default function UuidGenerator() {
  const id = useId();
  const [version, setVersion] = useState<UuidVersion>("v4");
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [check, setCheck] = useState("");

  const regenerate = useCallback(() => {
    setIds(generateUuids(count, version, uppercase));
  }, [count, version, uppercase]);

  // Generated after mount, never during render.
  //
  // These come from crypto.getRandomValues, so a server render and the client's
  // first render would disagree and React would throw a hydration mismatch. The
  // page ships with an empty list and fills it in immediately.
  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const inspection = check.trim().length > 0 ? inspectUuid(check) : null;

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-end gap-4 border-b p-4 sm:p-5">
        <div role="group" aria-label="UUID version" className="flex gap-2">
          {(
            [
              ["v4", "v4 · random"],
              ["v7", "v7 · time-ordered"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={version === v}
              onClick={() => setVersion(v)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                version === v
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-24">
          <ToolLabel htmlFor={`${id}-count`} className="text-xs">
            How many
          </ToolLabel>
          <ToolInput
            id={`${id}-count`}
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-1 h-9"
          />
        </div>

        <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={uppercase}
            onChange={(e) => setUppercase(e.target.checked)}
            className="size-4"
          />
          Uppercase
        </label>

        <button
          type="button"
          onClick={regenerate}
          className="rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:border-foreground/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Generate again
        </button>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {ids.length} {version.toUpperCase()} identifier{ids.length === 1 ? "" : "s"}
          </p>
          <CopyButton value={ids.join("\n")} label="Copy all" />
        </div>
        <ul className="mt-3 space-y-1">
          {ids.map((value) => (
            <li key={value} className="break-all font-mono text-sm">
              {value}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-check`}>Inspect an existing UUID</ToolLabel>
        <ToolInput
          id={`${id}-check`}
          value={check}
          onChange={(e) => setCheck(e.target.value)}
          spellCheck={false}
          placeholder="Paste a UUID to validate it"
          className="mt-2 font-mono"
        />
        {inspection ? (
          <div className="mt-3 text-sm" aria-live="polite">
            <p
              className={cx(
                "font-medium",
                inspection.valid ? "text-emerald-600" : "text-destructive"
              )}
            >
              {inspection.valid
                ? `Valid · version ${inspection.version}`
                : "Not a valid UUID"}
            </p>
            <p className="mt-1 text-muted-foreground">{inspection.note}</p>
            {inspection.timestamp ? (
              <p className="mt-1 text-muted-foreground">
                Created{" "}
                <time dateTime={inspection.timestamp.toISOString()}>
                  {inspection.timestamp.toLocaleString()}
                </time>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
