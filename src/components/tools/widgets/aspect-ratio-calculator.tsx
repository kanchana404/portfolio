"use client";

import { useId, useMemo, useState } from "react";
import { StatTile, ToolInput, ToolLabel } from "@/components/tools/ui";
import {
  matchNamedRatio,
  parseRatio,
  simplifyRatio,
  solveDimension,
} from "@/lib/tools/math/ratio";
import { parseDecimal } from "@/lib/tools/math/percentage";

export default function AspectRatioCalculator() {
  const id = useId();
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");

  const [ratioText, setRatioText] = useState("16:9");
  const [knownWidth, setKnownWidth] = useState("1280");

  const analysis = useMemo(() => {
    const w = parseDecimal(width);
    const h = parseDecimal(height);
    if (w === null || h === null || w <= 0 || h <= 0) return null;
    return {
      simplified: simplifyRatio(w, h),
      named: matchNamedRatio(w, h),
      decimal: w / h,
      megapixels: (w * h) / 1_000_000,
    };
  }, [width, height]);

  const solved = useMemo(() => {
    const ratio = parseRatio(ratioText);
    const w = parseDecimal(knownWidth);
    if (!ratio || w === null || w <= 0) return null;
    return solveDimension(ratio, { width: w });
  }, [ratioText, knownWidth]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What ratio is this size?
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <ToolLabel htmlFor={`${id}-w`}>Width</ToolLabel>
            <ToolInput
              id={`${id}-w`}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              inputMode="numeric"
              className="mt-2 tabular-nums"
            />
          </div>
          <div>
            <ToolLabel htmlFor={`${id}-h`}>Height</ToolLabel>
            <ToolInput
              id={`${id}-h`}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              inputMode="numeric"
              className="mt-2 tabular-nums"
            />
          </div>
        </div>

        <div className="mt-4" aria-live="polite" aria-atomic="true">
          {analysis === null || !analysis.simplified ? (
            <p className="text-sm text-muted-foreground">
              Enter a width and a height above.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <StatTile
                  label="Ratio"
                  value={`${analysis.simplified.w}:${analysis.simplified.h}`}
                />
                <StatTile label="Decimal" value={analysis.decimal.toFixed(4)} />
                <StatTile
                  label="Megapixels"
                  value={analysis.megapixels.toFixed(2)}
                />
                <StatTile
                  label="Orientation"
                  value={
                    analysis.decimal > 1
                      ? "Landscape"
                      : analysis.decimal < 1
                        ? "Portrait"
                        : "Square"
                  }
                />
              </div>
              {analysis.named ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {analysis.named.exact ? "This is " : "Close to "}
                  <strong className="text-foreground">{analysis.named.label}</strong>
                  {analysis.named.exact ? "" : " (not exactly)"}. {analysis.named.note}.
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Not close to any standard ratio.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="border-t p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Resize while keeping a ratio
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <ToolLabel htmlFor={`${id}-ratio`}>Ratio</ToolLabel>
            <ToolInput
              id={`${id}-ratio`}
              value={ratioText}
              onChange={(e) => setRatioText(e.target.value)}
              className="mt-2 font-mono"
              placeholder="16:9"
            />
          </div>
          <div>
            <ToolLabel htmlFor={`${id}-kw`}>New width</ToolLabel>
            <ToolInput
              id={`${id}-kw`}
              value={knownWidth}
              onChange={(e) => setKnownWidth(e.target.value)}
              inputMode="numeric"
              className="mt-2 tabular-nums"
            />
          </div>
        </div>

        <p className="mt-3 text-sm" aria-live="polite">
          {solved === null ? (
            <span className="text-muted-foreground">
              Enter a ratio like 16:9 and a width.
            </span>
          ) : (
            <>
              <span className="font-mono text-base">
                {solved.width} × {solved.height}
              </span>
              {solved.rounded ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  rounded to the nearest whole pixel
                </span>
              ) : null}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
