"use client";

import { useId, useMemo, useState } from "react";
import { TOOL_CHIP_CLASS, TOOL_CHIP_OFF_CLASS, TOOL_CHIP_ON_CLASS, ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  formatNumber,
  formatPercent,
  parseDecimal,
  percentChange,
  percentOf,
  whatPercentOf,
} from "@/lib/tools/math/percentage";

/**
 * The platform's proving tool.
 *
 * Deliberately the cheapest useful thing that exercises the whole template: no
 * WASM, no new dependency, no server call, no regulated number that could go
 * stale. That matters for a first tool — it means any problem the page has is a
 * problem with the *platform*, not with this widget.
 *
 * It is a plain `"use client"` component imported directly by the widget map,
 * **not** a `dynamic(ssr: false)` one. So it renders during static generation,
 * its markup is in the HTML a crawler receives, and there is no layout shift on
 * hydration. Reserve `ssr: false` for widgets that genuinely cannot run on the
 * server.
 */

type Mode = "of" | "share" | "change";

const MODES: ReadonlyArray<{ id: Mode; label: string; hint: string }> = [
  { id: "of", label: "% of a number", hint: "What is 15% of 60?" },
  { id: "share", label: "X is what % of Y", hint: "9 is what percent of 60?" },
  { id: "change", label: "% increase / decrease", hint: "From 80 to 100 is what change?" },
];

interface Row {
  label: string;
  expression: string;
  value: string;
}

interface Outcome {
  headline: string;
  detail: string;
  rows: Row[];
}

/** Everything the panel needs, or `null` when the inputs are not yet answerable. */
function compute(mode: Mode, rawA: string, rawB: string): Outcome | null {
  const a = parseDecimal(rawA);
  const b = parseDecimal(rawB);
  if (a === null || b === null) return null;

  if (mode === "of") {
    const result = percentOf(a, b);
    if (result === null) return null;
    return {
      headline: formatNumber(result),
      detail: `${formatPercent(a)} of ${formatNumber(b)}`,
      rows: [
        {
          label: "As a decimal",
          expression: `${formatNumber(a)} ÷ 100`,
          value: formatNumber(a / 100),
        },
        {
          label: "Multiplied by the value",
          expression: `${formatNumber(a / 100)} × ${formatNumber(b)}`,
          value: formatNumber(result),
        },
      ],
    };
  }

  if (mode === "share") {
    const result = whatPercentOf(a, b);
    if (result === null) return null;
    return {
      headline: formatPercent(result),
      detail: `${formatNumber(a)} out of ${formatNumber(b)}`,
      rows: [
        {
          label: "As a fraction",
          expression: `${formatNumber(a)} ÷ ${formatNumber(b)}`,
          value: formatNumber(a / b),
        },
        {
          label: "As a percentage",
          expression: `${formatNumber(a / b)} × 100`,
          value: formatPercent(result),
        },
      ],
    };
  }

  const result = percentChange(a, b);
  if (result === null) return null;
  const direction = result > 0 ? "increase" : result < 0 ? "decrease" : "no change";
  return {
    headline: formatPercent(result),
    detail: `${formatNumber(a)} → ${formatNumber(b)} is ${
      result === 0 ? "no change" : `a ${formatPercent(Math.abs(result))} ${direction}`
    }`,
    rows: [
      {
        label: "Difference",
        expression: `${formatNumber(b)} − ${formatNumber(a)}`,
        value: formatNumber(b - a),
      },
      {
        label: "Over the starting size",
        expression: `${formatNumber(b - a)} ÷ ${formatNumber(Math.abs(a))}`,
        value: formatNumber((b - a) / Math.abs(a)),
      },
      {
        label: "As a percentage",
        expression: `${formatNumber((b - a) / Math.abs(a))} × 100`,
        value: formatPercent(result),
      },
    ],
  };
}

/** Why a given mode has nothing to show, phrased as a next action. */
function emptyMessage(mode: Mode, rawA: string, rawB: string): string {
  const a = parseDecimal(rawA);
  const b = parseDecimal(rawB);
  if (a === null || b === null) return "Enter both numbers to see the answer.";
  if (mode === "share" && b === 0) {
    return "Nothing is a meaningful percentage of zero. Give the second number a value.";
  }
  if (mode === "change" && a === 0) {
    return "Percentage change from zero is undefined, however large the new value is. Start from any non-zero number.";
  }
  return "Enter both numbers to see the answer.";
}

const FIELD_LABELS: Record<Mode, [string, string]> = {
  of: ["Percentage", "Of this number"],
  share: ["This number", "Out of"],
  change: ["From", "To"],
};

const FIELD_SUFFIX: Record<Mode, [string, string]> = {
  of: ["%", ""],
  share: ["", ""],
  change: ["", ""],
};

export default function PercentageCalculator() {
  const baseId = useId();
  const [mode, setMode] = useState<Mode>("of");
  // Held as strings so a field can be genuinely empty rather than showing a 0
  // the user did not type.
  const [rawA, setRawA] = useState("15");
  const [rawB, setRawB] = useState("60");

  const outcome = useMemo(() => compute(mode, rawA, rawB), [mode, rawA, rawB]);
  const [labelA, labelB] = FIELD_LABELS[mode];
  const [suffixA, suffixB] = FIELD_SUFFIX[mode];

  const aId = `${baseId}-a`;
  const bId = `${baseId}-b`;

  return (
    <div className="rounded-lg border">
      {/*
        A group of toggle buttons, not a radiogroup.

        `role="radio"` would be the tempting choice, but it carries a keyboard
        contract: one tab stop for the whole set, arrow keys to move between
        options. Claiming the role without implementing that contract is worse
        than not claiming it — a screen-reader user is told to press arrow keys
        and nothing happens. These are buttons that are individually tabbable, so
        `aria-pressed` describes them accurately and promises nothing false.
      */}
      <div
        role="group"
        aria-label="Calculation type"
        className="flex flex-wrap gap-2 border-b p-4 sm:p-5"
      >
        {MODES.map((m) => {
          const selected = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setMode(m.id)}
              title={m.hint}
              className={cx(
                TOOL_CHIP_CLASS,
                selected
                  ? TOOL_CHIP_ON_CLASS
                  : TOOL_CHIP_OFF_CLASS
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <ToolLabel htmlFor={aId} className="text-sm font-medium">
            {labelA}
          </ToolLabel>
          <div className="relative mt-2">
            <ToolInput
              id={aId}
              // text + inputMode gives mobile the numeric keypad while still
              // accepting "1,234" without the browser fighting the value.
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={rawA}
              onChange={(e) => setRawA(e.target.value)}
              className={cx("text-base tabular-nums", suffixA && "pr-8")}
            />
            {suffixA ? (
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
              >
                {suffixA}
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <ToolLabel htmlFor={bId} className="text-sm font-medium">
            {labelB}
          </ToolLabel>
          <div className="relative mt-2">
            <ToolInput
              id={bId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={rawB}
              onChange={(e) => setRawB(e.target.value)}
              className={cx("text-base tabular-nums", suffixB && "pr-8")}
            />
            {suffixB ? (
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
              >
                {suffixB}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite" aria-atomic="true">
        {outcome === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyMessage(mode, rawA, rawB)}
          </p>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {outcome.detail}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {outcome.headline}
            </p>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">
                Show the working
              </summary>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {outcome.rows.map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <th
                        scope="row"
                        className="py-1.5 pr-3 text-left font-normal text-muted-foreground"
                      >
                        {row.label}
                      </th>
                      <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                        {row.expression}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
