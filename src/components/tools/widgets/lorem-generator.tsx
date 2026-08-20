"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  LOREM_UNITS,
  type LoremUnit,
  MAX_LOREM,
  countWords,
  generateLorem,
} from "@/lib/tools/text/lorem";

export default function LoremGenerator() {
  const id = useId();
  const [unit, setUnit] = useState<LoremUnit>("paragraphs");
  const [count, setCount] = useState(3);
  const [startWithLorem, setStartWithLorem] = useState(true);
  // The seed is state, not a clock read. Rendering the same text on the server
  // and on first paint is what keeps hydration quiet; Shuffle just moves it on.
  const [seed, setSeed] = useState(1);

  const text = useMemo(
    () => generateLorem(unit, count, startWithLorem, seed),
    [unit, count, startWithLorem, seed]
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5">
        <div role="group" aria-label="Unit" className="flex gap-2">
          {LOREM_UNITS.map((u) => (
            <button
              key={u.id}
              type="button"
              aria-pressed={unit === u.id}
              onClick={() => setUnit(u.id)}
              className={cx(
                "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
                unit === u.id
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {u.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ToolLabel htmlFor={`${id}-n`} className="text-xs text-muted-foreground">
            How many
          </ToolLabel>
          <ToolInput
            id={`${id}-n`}
            type="number"
            min={1}
            max={MAX_LOREM}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-7 w-20 px-2 text-xs tabular-nums"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={startWithLorem}
            onChange={(e) => setStartWithLorem(e.target.checked)}
            className="size-3.5 accent-foreground"
          />
          Start with Lorem ipsum
        </label>
      </div>

      <div className="p-4 sm:p-5">
        <div className="max-h-80 space-y-4 overflow-auto text-sm leading-relaxed">
          {text.split("\n\n").map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Shuffle
        </button>
        <CopyButton value={text} label="Copy text" />
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {countWords(text)} words
        </span>
      </div>
    </div>
  );
}
