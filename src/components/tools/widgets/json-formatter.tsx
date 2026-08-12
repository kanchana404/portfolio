"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import {
  ToolLabel,
  ToolSelect,
  ToolTextarea,
  cx,
} from "@/components/tools/ui";
import {
  type IndentStyle,
  describeJson,
  formatJson,
  minifyJson,
  sortJsonKeys,
} from "@/lib/tools/dev/json-format";

type Action = "format" | "minify" | "sort";

const SAMPLE = '{"name":"Kavitha","tools":[{"slug":"json-formatter","free":true}]}';

export default function JsonFormatter() {
  const id = useId();
  const [source, setSource] = useState(SAMPLE);
  const [action, setAction] = useState<Action>("format");
  const [indent, setIndent] = useState<IndentStyle>(2);

  const result = useMemo(() => {
    if (action === "minify") return minifyJson(source);
    if (action === "sort") return sortJsonKeys(source, indent);
    return formatJson(source, indent);
  }, [source, action, indent]);

  const shape = useMemo(() => describeJson(source), [source]);
  const saved =
    result.ok && result.bytesIn > 0 ? result.bytesIn - result.bytesOut : 0;

  return (
    <div className="rounded-lg border">
      <div className="p-4 sm:p-5">
        <ToolLabel htmlFor={id}>JSON</ToolLabel>
        <ToolTextarea
          id={id}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={8}
          spellCheck={false}
          className={cx(
            "mt-2 min-h-[160px] resize-y",
            !result.ok && "border-destructive focus-visible:ring-destructive"
          )}
          aria-invalid={!result.ok}
          placeholder='{"paste": "your JSON here"}'
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t p-4 sm:p-5">
        <div role="group" aria-label="Action" className="flex flex-wrap gap-2">
          {(
            [
              ["format", "Format"],
              ["minify", "Minify"],
              ["sort", "Sort keys"],
            ] as const
          ).map(([id_, label]) => (
            <button
              key={id_}
              type="button"
              aria-pressed={action === id_}
              onClick={() => setAction(id_)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                action === id_
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {action !== "minify" ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Indent
            <ToolSelect
              value={String(indent)}
              onChange={(e) =>
                setIndent(e.target.value === "tab" ? "tab" : (Number(e.target.value) as 2 | 4))
              }
              className="h-8 w-auto py-0 text-xs"
              aria-label="Indent size"
            >
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="tab">Tabs</option>
            </ToolSelect>
          </label>
        ) : null}
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite" aria-atomic="true">
        {result.ok ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Valid JSON{shape ? ` · ${shape}` : ""}
                {saved > 0 ? ` · ${saved} bytes smaller` : ""}
                {saved < 0 ? ` · ${Math.abs(saved)} bytes larger` : ""}
              </p>
              <CopyButton value={result.value} />
            </div>
            {result.value.length > 0 ? (
              <pre className="mt-3 max-h-[420px] overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                {result.value}
              </pre>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Paste some JSON above.
              </p>
            )}
          </>
        ) : (
          <div role="alert">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Line {result.error.line}, column {result.error.column}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.error.message}
            </p>
            {result.error.excerpt ? (
              <pre className="mt-3 overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-xs">
                {result.error.excerpt}
                {"\n"}
                {" ".repeat(Math.max(0, result.error.column - 1))}
                <span className="text-red-700 dark:text-red-400">^</span>
              </pre>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
