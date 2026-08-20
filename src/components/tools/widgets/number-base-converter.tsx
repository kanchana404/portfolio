"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  BASES,
  bitLength,
  group,
  parseInBase,
  toBase,
} from "@/lib/tools/dev/number-base";

/** Digits per group, by base. Nibbles for binary and hex, triples elsewhere. */
const GROUPING: Record<number, number> = { 2: 4, 8: 3, 10: 3, 16: 4 };

export default function NumberBaseConverter() {
  const id = useId();
  // A default that is recognisable in every base and exercises all four.
  const [source, setSource] = useState("255");
  const [radix, setRadix] = useState(10);

  const parsed = useMemo(() => parseInBase(source, radix), [source, radix]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-in`}>Number</ToolLabel>
        <ToolInput
          id={`${id}-in`}
          value={source}
          spellCheck={false}
          onChange={(e) => setSource(e.target.value)}
          className="mt-2 font-mono"
        />
        <div role="group" aria-label="Base of the input" className="mt-3 flex flex-wrap gap-2">
          {BASES.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={radix === b.radix}
              onClick={() => setRadix(b.radix)}
              className={cx(
                "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
                radix === b.radix
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {!parsed.ok ? (
          <p className="text-sm text-muted-foreground">{parsed.error}</p>
        ) : (
          <dl>
            {BASES.map((b, i) => {
              const text = toBase(parsed.value!, b.radix);
              return (
                <div
                  key={b.id}
                  className={cx(
                    "flex min-h-11 items-center gap-3 py-1.5",
                    i > 0 && "border-t border-border/60"
                  )}
                >
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">
                    {b.label}
                  </dt>
                  <dd className="min-w-0 flex-1 break-all font-mono text-sm tabular-nums">
                    {group(text, GROUPING[b.radix] ?? 3)}
                  </dd>
                  <CopyButton value={(b.prefix ?? "") + text} />
                </div>
              );
            })}
            <div className="flex min-h-11 items-center gap-3 border-t border-border/60 py-1.5">
              <dt className="w-24 shrink-0 text-xs text-muted-foreground">Bit width</dt>
              <dd className="min-w-0 flex-1 text-sm tabular-nums">
                {bitLength(parsed.value!)} bits
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
