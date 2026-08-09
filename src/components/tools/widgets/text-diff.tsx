"use client";

import { useId, useMemo, useState } from "react";
import { StatTile, ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import { diffLines } from "@/lib/tools/text/diff";

const LEFT_SAMPLE = `The quick brown fox
jumps over the lazy dog.
Pack my box with five
dozen liquor jugs.`;

const RIGHT_SAMPLE = `The quick brown fox
leaps over the lazy dog.
Pack my box with five
dozen liquor jugs.
Sphinx of black quartz.`;

/**
 * Cap on rendered rows.
 *
 * The diff itself is computed for the whole input; this only limits how much of
 * it becomes DOM. Thirty thousand `<div>`s is a frozen tab, and nobody reads
 * past a few hundred rows anyway.
 */
const MAX_RENDERED = 1500;

const ROW_STYLE: Record<string, string> = {
  insert: "bg-emerald-500/10",
  delete: "bg-destructive/10",
  equal: "",
};

const MARK: Record<string, string> = { insert: "+", delete: "−", equal: " " };

export default function TextDiff() {
  const id = useId();
  const [left, setLeft] = useState(LEFT_SAMPLE);
  const [right, setRight] = useState(RIGHT_SAMPLE);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);

  const result = useMemo(
    () => diffLines(left, right, { ignoreCase, ignoreWhitespace }),
    [left, right, ignoreCase, ignoreWhitespace]
  );

  const shown = result.lines.slice(0, MAX_RENDERED);

  return (
    <div className="rounded-lg border">
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
        <div>
          <ToolLabel htmlFor={`${id}-left`}>Original</ToolLabel>
          <ToolTextarea
            id={`${id}-left`}
            rows={8}
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            spellCheck={false}
            className="mt-2"
          />
        </div>
        <div>
          <ToolLabel htmlFor={`${id}-right`}>Changed</ToolLabel>
          <ToolTextarea
            id={`${id}-right`}
            rows={8}
            value={right}
            onChange={(e) => setRight(e.target.value)}
            spellCheck={false}
            className="mt-2"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t p-4 sm:p-5">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={ignoreCase}
            onChange={(e) => setIgnoreCase(e.target.checked)}
            className="size-4"
          />
          Ignore case
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={ignoreWhitespace}
            onChange={(e) => setIgnoreWhitespace(e.target.checked)}
            className="size-4"
          />
          Ignore leading and trailing spaces
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t p-4 sm:p-5" aria-live="polite">
        <StatTile label="Added" value={String(result.added)} />
        <StatTile label="Removed" value={String(result.removed)} />
        <StatTile label="Unchanged" value={String(result.unchanged)} />
      </div>

      <div className="border-t p-4 sm:p-5">
        {result.identical ? (
          <p className="text-sm font-medium text-emerald-600">
            The two texts are identical.
          </p>
        ) : (
          <>
            {result.truncated ? (
              <p className="mb-3 text-sm text-amber-600">
                These are too large to align line by line, so the differing
                middle is shown as a wholesale replacement rather than a
                misleading alignment.
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-md border">
              <div className="min-w-max font-mono text-xs leading-relaxed">
                {shown.map((line, index) => (
                  <div
                    key={`${line.type}-${index}`}
                    className={cx("flex gap-3 px-3 py-0.5", ROW_STYLE[line.type])}
                  >
                    <span className="w-10 shrink-0 select-none text-right tabular-nums text-muted-foreground">
                      {line.leftNumber ?? ""}
                    </span>
                    <span className="w-10 shrink-0 select-none text-right tabular-nums text-muted-foreground">
                      {line.rightNumber ?? ""}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cx(
                        "w-3 shrink-0 select-none",
                        line.type === "insert" && "text-emerald-600",
                        line.type === "delete" && "text-destructive"
                      )}
                    >
                      {MARK[line.type]}
                    </span>
                    <span className="whitespace-pre">{line.text || " "}</span>
                  </div>
                ))}
              </div>
            </div>
            {result.lines.length > MAX_RENDERED ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing the first {MAX_RENDERED.toLocaleString()} of{" "}
                {result.lines.length.toLocaleString()} lines. The counts above
                cover the whole comparison.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
