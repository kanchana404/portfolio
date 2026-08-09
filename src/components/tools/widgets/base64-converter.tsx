"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import { decodeBase64, decodedByteLength, encodeBase64 } from "@/lib/tools/dev/base64";

type Direction = "encode" | "decode";

export default function Base64Converter() {
  const id = useId();
  const [direction, setDirection] = useState<Direction>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [input, setInput] = useState("Hello 🚀 සිංහල");

  const result = useMemo(() => {
    if (direction === "encode") {
      return { ok: true as const, value: encodeBase64(input, urlSafe), error: null };
    }
    const decoded = decodeBase64(input);
    return decoded.ok
      ? { ok: true as const, value: decoded.text, error: null }
      : { ok: false as const, value: "", error: decoded.error };
  }, [input, direction, urlSafe]);

  const payloadBytes = direction === "decode" ? decodedByteLength(input) : null;

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-3 border-b p-4 sm:p-5">
        <div role="group" aria-label="Direction" className="flex gap-2">
          {(
            [
              ["encode", "Text → Base64"],
              ["decode", "Base64 → Text"],
            ] as const
          ).map(([id_, label]) => (
            <button
              key={id_}
              type="button"
              aria-pressed={direction === id_}
              onClick={() => setDirection(id_)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                direction === id_
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {direction === "encode" ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={urlSafe}
              onChange={(e) => setUrlSafe(e.target.checked)}
              className="size-4"
            />
            URL-safe (<code className="font-mono">-_</code>, no padding)
          </label>
        ) : null}
      </div>

      <div className="p-4 sm:p-5">
        <ToolLabel htmlFor={id}>
          {direction === "encode" ? "Text" : "Base64"}
        </ToolLabel>
        <ToolTextarea
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          spellCheck={false}
          aria-invalid={!result.ok}
          className={cx(
            "mt-2 resize-y",
            !result.ok && "border-destructive focus-visible:ring-destructive"
          )}
          placeholder={direction === "encode" ? "Anything at all…" : "SGVsbG8="}
        />
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite" aria-atomic="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {direction === "encode" ? "Base64" : "Text"}
            {payloadBytes !== null ? ` · ${payloadBytes} bytes` : ""}
          </p>
          <CopyButton value={result.value} />
        </div>

        {result.ok ? (
          result.value.length > 0 ? (
            <p className="mt-2 break-all font-mono text-sm">{result.value}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Enter something above.
            </p>
          )
        ) : (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {result.error}
          </p>
        )}
      </div>
    </div>
  );
}
