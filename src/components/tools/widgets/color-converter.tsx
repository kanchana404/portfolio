"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  buildScale,
  checkContrast,
  formatAll,
  parseColor,
  rgbToHex,
} from "@/lib/tools/image/color";

const FORMAT_ROWS = [
  ["HEX", "hex"],
  ["HEX + alpha", "hexAlpha"],
  ["RGB", "rgb"],
  ["HSL", "hsl"],
  ["OKLCH", "oklch"],
] as const;

export default function ColorConverter() {
  const id = useId();
  const [input, setInput] = useState("#3b82f6");
  const [background, setBackground] = useState("#ffffff");

  const color = useMemo(() => parseColor(input), [input]);
  const backdrop = useMemo(() => parseColor(background), [background]);

  const formats = color ? formatAll(color) : null;
  const contrast = color && backdrop ? checkContrast(color, backdrop) : null;
  const scale = useMemo(() => (color ? buildScale(color) : []), [color]);

  const swatch = color ? rgbToHex(color) : "transparent";

  return (
    <div className="rounded-lg border">
      <div className="grid gap-4 border-b p-4 sm:p-5 sm:grid-cols-2">
        <div>
          <ToolLabel htmlFor={`${id}-color`}>Color</ToolLabel>
          <div className="mt-2 flex gap-2">
            <ToolInput
              id={`${id}-color`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              placeholder="#3b82f6, rebeccapurple, hsl(217 91% 60%)…"
              className="font-mono"
            />
            <input
              type="color"
              aria-label="Pick a color"
              value={color ? rgbToHex(color) : "#000000"}
              onChange={(e) => setInput(e.target.value)}
              className="h-10 w-12 shrink-0 cursor-pointer rounded-md border bg-background p-1"
            />
          </div>
        </div>

        <div>
          <ToolLabel htmlFor={`${id}-background`}>Against (for contrast)</ToolLabel>
          <div className="mt-2 flex gap-2">
            <ToolInput
              id={`${id}-background`}
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              spellCheck={false}
              className="font-mono"
            />
            <input
              type="color"
              aria-label="Pick a background color"
              value={backdrop ? rgbToHex(backdrop) : "#ffffff"}
              onChange={(e) => setBackground(e.target.value)}
              className="h-10 w-12 shrink-0 cursor-pointer rounded-md border bg-background p-1"
            />
          </div>
        </div>
      </div>

      {color === null ? (
        <div className="p-4 sm:p-5" role="alert">
          <p className="text-sm font-medium text-destructive">
            That is not a color this understands. Try hex ({"#3b82f6"}), a CSS
            name, {"rgb()"}, {"hsl()"} or {"oklch()"}.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-stretch gap-4 border-b p-4 sm:p-5">
            <div
              aria-hidden="true"
              className="size-20 shrink-0 rounded-lg border"
              style={{ backgroundColor: swatch }}
            />
            <dl className="min-w-0 flex-1 space-y-1.5" aria-live="polite">
              {FORMAT_ROWS.map(([label, key]) => (
                <div key={key} className="flex items-center gap-3">
                  <dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="min-w-0 flex-1 truncate font-mono text-sm">
                    {formats?.[key]}
                  </dd>
                  <CopyButton value={formats?.[key] ?? ""} label="Copy" />
                </div>
              ))}
            </dl>
          </div>

          {contrast && backdrop ? (
            <div className="border-b p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div
                  className="rounded-md border px-4 py-3"
                  style={{ backgroundColor: rgbToHex(backdrop), color: swatch }}
                >
                  <span className="text-sm font-medium">Sample text</span>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {contrast.ratio.toFixed(2)}:1
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {contrast.summary}
                  </p>
                </div>
              </div>

              <ul className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    ["AA body text", contrast.aaNormal],
                    ["AA large text", contrast.aaLarge],
                    ["AAA body text", contrast.aaaNormal],
                    ["UI components", contrast.uiComponents],
                  ] as const
                ).map(([label, pass]) => (
                  <li
                    key={label}
                    className={cx(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      pass
                        ? "border-emerald-600/30 text-emerald-600"
                        : "border-destructive/30 text-destructive"
                    )}
                  >
                    {pass ? "Passes" : "Fails"} · {label}
                  </li>
                ))}
              </ul>

              {color.a < 1 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Contrast is measured on the opaque color. A translucent color
                  has no single ratio — it depends on whatever sits behind it.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Perceptual scale
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {scale.map((step) => (
                <li key={step.step} className="text-center">
                  <div
                    aria-hidden="true"
                    className="size-12 rounded-md border"
                    style={{ backgroundColor: step.hex }}
                  />
                  <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                    {step.step}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {step.hex}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Stepped in OKLCH, not HSL. Equal lightness steps in HSL are not
              equal perceptual steps, which is why so many generated palettes
              have a muddy middle.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
