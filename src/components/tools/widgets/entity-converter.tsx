"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import {
  REQUIRED_ESCAPES,
  decodeEntities,
  encodeEntities,
} from "@/lib/tools/text/entities";

type Direction = "encode" | "decode";

export default function EntityConverter() {
  const id = useId();
  const [direction, setDirection] = useState<Direction>("encode");
  const [text, setText] = useState(`<a href="x">Tom & Jerry's</a>`);

  const output = useMemo(
    () => (direction === "encode" ? encodeEntities(text) : decodeEntities(text)),
    [direction, text]
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap gap-2 border-b p-4 sm:p-5">
        {(["encode", "decode"] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={direction === d}
            onClick={() => setDirection(d)}
            className={cx(
              "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
              direction === d
                ? "border-foreground/20 bg-muted text-foreground"
                : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            {d === "encode" ? "Text to entities" : "Entities to text"}
          </button>
        ))}
      </div>

      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-in`}>Input</ToolLabel>
        <ToolTextarea
          id={`${id}-in`}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-2"
        />
      </div>

      <div className="border-b p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <ToolLabel htmlFor={`${id}-out`}>Output</ToolLabel>
          <CopyButton value={output} />
        </div>
        <ToolTextarea id={`${id}-out`} rows={4} readOnly value={output} className="mt-2" />
      </div>

      {/* The reference is the useful half for most visitors: five characters,
          and why each one matters. Guides that list three are describing text
          between tags and quietly break inside an attribute. */}
      <div className="p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          The five that must be escaped
        </p>
        <dl className="mt-2">
          {REQUIRED_ESCAPES.map((e, i) => (
            <div
              key={e.char}
              className={cx(
                "flex min-h-11 items-center gap-3 py-1.5",
                i > 0 && "border-t border-border/60"
              )}
            >
              <dt className="w-8 shrink-0 font-mono text-sm">{e.char}</dt>
              <dd className="w-24 shrink-0 font-mono text-sm text-muted-foreground">
                {e.entity}
              </dd>
              <dd className="min-w-0 flex-1 text-xs text-muted-foreground">{e.why}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
