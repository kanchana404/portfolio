"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import {
  type EncodeMode,
  decodeUrl,
  encodeUrl,
  parseUrl,
} from "@/lib/tools/dev/url-codec";

type Direction = "encode" | "decode";

export default function UrlEncoder() {
  const id = useId();
  const [direction, setDirection] = useState<Direction>("encode");
  const [mode, setMode] = useState<EncodeMode>("component");
  const [input, setInput] = useState("https://example.com/search?q=hello world&lang=සිංහල");

  const result = useMemo(() => {
    if (direction === "encode") {
      return { ok: true as const, value: encodeUrl(input, mode), error: null };
    }
    const decoded = decodeUrl(input, mode);
    return decoded.ok
      ? { ok: true as const, value: decoded.value, error: null }
      : { ok: false as const, value: "", error: decoded.error };
  }, [input, direction, mode]);

  const parsed = useMemo(() => parseUrl(input), [input]);

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-4 border-b p-4 sm:p-5">
        <div role="group" aria-label="Direction" className="flex gap-2">
          {(
            [
              ["encode", "Encode"],
              ["decode", "Decode"],
            ] as const
          ).map(([d, label]) => (
            <button
              key={d}
              type="button"
              aria-pressed={direction === d}
              onClick={() => setDirection(d)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                direction === d
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Scope" className="flex gap-2">
          {(
            [
              ["component", "A value"],
              ["uri", "A whole URL"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cx(
                "rounded border px-2.5 py-1 text-[11px] transition-colors",
                mode === m ? "bg-muted font-medium" : "hover:border-foreground/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <ToolLabel htmlFor={id}>
          {direction === "encode" ? "Text or URL" : "Encoded text"}
        </ToolLabel>
        <ToolTextarea
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          spellCheck={false}
          aria-invalid={!result.ok}
          className={cx(
            "mt-2 resize-y",
            !result.ok && "border-destructive focus-visible:ring-destructive"
          )}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {mode === "component"
            ? "Escapes ? & = / # too — use this for a single value going into a query string."
            : "Leaves ? & = / # alone — use this for an address you are encoding as a whole."}
        </p>
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite" aria-atomic="true">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Result
          </p>
          <CopyButton value={result.value} />
        </div>
        {result.ok ? (
          result.value.length > 0 ? (
            <p className="mt-2 break-all font-mono text-sm">{result.value}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Enter something above.</p>
          )
        ) : (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            {result.error}
          </p>
        )}
      </div>

      {parsed.valid ? (
        <div className="border-t p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            This URL, broken up
          </p>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Scheme</dt>
            <dd className="font-mono">{parsed.protocol}</dd>
            <dt className="text-muted-foreground">Host</dt>
            <dd className="font-mono break-all">{parsed.host}</dd>
            {parsed.port ? (
              <>
                <dt className="text-muted-foreground">Port</dt>
                <dd className="font-mono">{parsed.port}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Path</dt>
            <dd className="font-mono break-all">{parsed.path}</dd>
            {parsed.hash ? (
              <>
                <dt className="text-muted-foreground">Fragment</dt>
                <dd className="font-mono break-all">{parsed.hash}</dd>
              </>
            ) : null}
          </dl>

          {parsed.params.length > 0 ? (
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Query parameters, decoded</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 font-medium">Parameter</th>
                  <th scope="col" className="py-1 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {parsed.params.map((p, i) => (
                  <tr key={`${p.key}-${i}`} className="border-t">
                    <td className="py-1 pr-3 font-mono">{p.key}</td>
                    <td className="py-1 break-all font-mono">{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
