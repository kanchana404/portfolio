"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import { CASES, type CaseId, convertCase, slugify } from "@/lib/tools/text/case";

const SAMPLE = "parseHTTPResponse handler_v2";

export default function CaseConverter() {
  const id = useId();
  const [text, setText] = useState(SAMPLE);
  const [active, setActive] = useState<CaseId | "slug">("camel");

  const output = useMemo(
    () => (active === "slug" ? slugify(text) : convertCase(text, active)),
    [text, active]
  );

  return (
    <div className="rounded-lg border">
      <div className="p-4 sm:p-5">
        <ToolLabel htmlFor={id}>Your text</ToolLabel>
        <ToolTextarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          spellCheck={false}
          className="mt-2 resize-y"
          placeholder="Type or paste anything…"
        />
      </div>

      <div role="group" aria-label="Target case" className="flex flex-wrap gap-2 border-t p-4 sm:p-5">
        {CASES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={active === c.id}
            onClick={() => setActive(c.id)}
            title={c.example}
            className={cx(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              active === c.id
                ? "border-foreground bg-foreground text-background"
                : "hover:border-foreground/30"
            )}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={active === "slug"}
          onClick={() => setActive("slug")}
          title="url-slug-case"
          className={cx(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            active === "slug"
              ? "border-foreground bg-foreground text-background"
              : "hover:border-foreground/30"
          )}
        >
          URL slug
        </button>
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite" aria-atomic="true">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {active === "slug" ? "URL slug" : CASES.find((c) => c.id === active)?.label}
          </p>
          <CopyButton value={output} />
        </div>
        {output.length > 0 ? (
          <p className="mt-2 break-words font-mono text-sm">{output}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {text.length === 0
              ? "Enter some text above."
              : "Nothing survives this conversion — a URL slug keeps only letters and digits."}
          </p>
        )}
      </div>
    </div>
  );
}
