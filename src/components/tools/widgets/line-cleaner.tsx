"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import {
  DEFAULT_LINE_OPTIONS,
  type LineOptions,
  processLines,
} from "@/lib/tools/text/lines";

const SAMPLE = "banana\nApple\napple\n\ncherry \nbanana\nitem10\nitem2";

const TOGGLES: Array<[keyof LineOptions, string]> = [
  ["trim", "Trim spaces"],
  ["removeBlank", "Drop blank lines"],
  ["deduplicate", "Remove duplicates"],
  ["ignoreCase", "Ignore case"],
  ["reverse", "Reverse"],
];

export default function LineCleaner() {
  const id = useId();
  const [text, setText] = useState(SAMPLE);
  const [options, setOptions] = useState<LineOptions>(DEFAULT_LINE_OPTIONS);

  const result = useMemo(() => processLines(text, options), [text, options]);

  const toggle = (key: keyof LineOptions) =>
    setOptions((o) => ({ ...o, [key]: !o[key] }));

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-in`}>Your lines</ToolLabel>
        <ToolTextarea
          id={`${id}-in`}
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-2"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b p-4 sm:p-5">
        {TOGGLES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={Boolean(options[key])}
            onClick={() => toggle(key)}
            className={cx(
              "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
              options[key]
                ? "border-foreground/20 bg-muted text-foreground"
                : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}

        {(["none", "asc", "desc"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={options.sort === s}
            onClick={() => setOptions((o) => ({ ...o, sort: s }))}
            className={cx(
              "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
              options.sort === s
                ? "border-foreground/20 bg-muted text-foreground"
                : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            {s === "none" ? "No sort" : s === "asc" ? "A to Z" : "Z to A"}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs tabular-nums text-muted-foreground">
            {result.before} in, {result.after} out
            {result.removed > 0 ? `, ${result.removed} removed` : ""}
          </p>
          <CopyButton value={result.text} />
        </div>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-sm">
          {result.text}
        </pre>
      </div>
    </div>
  );
}
