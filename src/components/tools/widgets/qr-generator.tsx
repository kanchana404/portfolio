"use client";

import { useId, useMemo, useState } from "react";
import { renderSVG } from "uqr";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import {
  CORRECTION_LEVELS,
  type ErrorCorrection,
  checkInput,
  looksLikeUrl,
} from "@/lib/tools/image/qr";

const DEFAULT = "https://kavithakanchana.me";

export default function QrGenerator() {
  const id = useId();
  const [text, setText] = useState(DEFAULT);
  const [level, setLevel] = useState<ErrorCorrection>("M");

  const check = useMemo(() => checkInput(text, level), [text, level]);

  // SVG rather than canvas, which is why this renders identically on the server
  // and in the browser: no pixel buffer, no device pixel ratio, and it stays
  // sharp at any print size. A canvas QR has to guess a resolution.
  const svg = useMemo(() => {
    if (!check.ok) return null;
    try {
      return renderSVG(text.trim(), { ecc: level, border: 2 });
    } catch {
      return null;
    }
  }, [text, level, check.ok]);

  const download = useMemo(() => {
    if (!svg) return null;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [svg]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-text`}>Text or URL</ToolLabel>
        <ToolTextarea
          id={`${id}-text`}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-2"
        />
        <div role="group" aria-label="Error correction" className="mt-3 flex flex-wrap gap-2">
          {CORRECTION_LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={level === l.id}
              onClick={() => setLevel(l.id)}
              title={l.note}
              className={cx(
                "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
                level === l.id
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {l.label} {l.recovers}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {!check.ok ? (
          <p className="text-sm text-muted-foreground">{check.error}</p>
        ) : svg ? (
          <div className="flex flex-col items-center gap-3">
            {/* The SVG is generated here, not fetched, so it is safe to inline.
                It also means the code works with the network off. */}
            <div
              className="w-full max-w-[240px] [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            {check.hint ? (
              <p className="max-w-prose text-center text-xs text-muted-foreground">
                {check.hint}
              </p>
            ) : null}
            {looksLikeUrl(text) ? (
              <p className="text-xs text-muted-foreground">
                Scanning this opens {new URL(text.trim()).hostname}.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            That text could not be encoded. It may be too long for this level.
          </p>
        )}
      </div>

      {download ? (
        <div className="flex flex-wrap gap-2 border-t p-4 sm:p-5">
          <a
            href={download}
            download="qr-code.svg"
            className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Download SVG
          </a>
          <CopyButton value={svg ?? ""} label="Copy SVG" />
        </div>
      ) : null}
    </div>
  );
}
