"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  type SizeSystem,
  humanise,
  systemGapPercent,
  toBytes,
  unitsFor,
} from "@/lib/tools/math/data-size";

export default function DataSizeConverter() {
  const id = useId();
  const [value, setValue] = useState("500");
  const [system, setSystem] = useState<SizeSystem>("decimal");
  const [exponent, setExponent] = useState(3); // GB by default: the drive case

  const units = useMemo(() => unitsFor(system), [system]);
  const parsed = useMemo(
    () => toBytes(value, units[exponent].bytes),
    [value, units, exponent]
  );

  const gap = systemGapPercent(exponent);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-v`}>Size</ToolLabel>
        <div className="mt-2 flex gap-2">
          <ToolInput
            id={`${id}-v`}
            value={value}
            inputMode="decimal"
            onChange={(e) => setValue(e.target.value)}
            className="font-mono"
          />
          <select
            aria-label="Unit"
            value={exponent}
            onChange={(e) => setExponent(Number(e.target.value))}
            className="h-10 shrink-0 rounded-md border bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {units.map((u, i) => (
              <option key={u.id} value={i}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        <div role="group" aria-label="System" className="mt-3 flex gap-2">
          {(["decimal", "binary"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={system === s}
              onClick={() => setSystem(s)}
              className={cx(
                "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
                system === s
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {s === "decimal" ? "Decimal (1000)" : "Binary (1024)"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {!parsed.ok ? (
          <p className="text-sm text-muted-foreground">{parsed.error}</p>
        ) : (
          <>
            <dl>
              {[
                ["Bytes", parsed.bytes!.toLocaleString("en-US")],
                ["Decimal", humanise(parsed.bytes!, "decimal")],
                ["Binary", humanise(parsed.bytes!, "binary")],
              ].map(([label, v], i) => (
                <div
                  key={label}
                  className={cx(
                    "flex min-h-11 items-center gap-3 py-1.5",
                    i > 0 && "border-t border-border/60"
                  )}
                >
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 flex-1 break-all font-mono text-sm tabular-nums">
                    {v}
                  </dd>
                  <CopyButton value={v} />
                </div>
              ))}
            </dl>

            {gap > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                At this scale the two systems differ by {gap.toFixed(1)}%. That is
                the whole reason a drive sold as one number shows up as a smaller
                one: nothing is missing, the label and the operating system are
                using different units under the same abbreviation.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
