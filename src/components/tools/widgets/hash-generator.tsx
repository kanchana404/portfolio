"use client";

import { useEffect, useId, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import {
  HASH_ALGORITHMS,
  type HashAlgorithm,
  type HashResult,
  hashText,
} from "@/lib/tools/dev/hash";

export default function HashGenerator() {
  const id = useId();
  const [text, setText] = useState("hello world");
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [result, setResult] = useState<HashResult | null>(null);
  const [encoding, setEncoding] = useState<"hex" | "base64">("hex");

  // crypto.subtle.digest is async, so the digest cannot be computed during
  // render. An effect keyed on the inputs keeps it in step with what is typed,
  // and the stale-response guard stops a slow earlier digest from overwriting a
  // newer one when someone types quickly.
  useEffect(() => {
    let current = true;
    void hashText(text, algorithm).then((r) => {
      if (current) setResult(r);
    });
    return () => {
      current = false;
    };
  }, [text, algorithm]);

  const meta = HASH_ALGORITHMS.find((a) => a.id === algorithm);
  const value = result?.ok ? (encoding === "hex" ? result.hex : result.base64) : "";

  return (
    <div className="rounded-lg border">
      <div role="group" aria-label="Algorithm" className="flex flex-wrap gap-2 border-b p-4 sm:p-5">
        {HASH_ALGORITHMS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={algorithm === a.id}
            onClick={() => setAlgorithm(a.id)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              algorithm === a.id
                ? "border-foreground bg-foreground text-background"
                : "hover:border-foreground/30"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        <ToolLabel htmlFor={id}>Text to hash</ToolLabel>
        <ToolTextarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          spellCheck={false}
          className="mt-2 resize-y"
          placeholder="Anything — the digest updates as you type"
        />
        {meta ? (
          <p className="mt-2 text-xs text-muted-foreground">{meta.note}</p>
        ) : null}
      </div>

      <div className="border-t p-4 sm:p-5" aria-live="polite" aria-atomic="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {algorithm}
              {result?.ok ? ` · ${result.bytes} bytes in` : ""}
            </p>
            <div role="group" aria-label="Output encoding" className="flex gap-1">
              {(["hex", "base64"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={encoding === e}
                  onClick={() => setEncoding(e)}
                  className={cx(
                    "rounded border px-2 py-0.5 text-[11px] transition-colors",
                    encoding === e ? "bg-muted font-medium" : "hover:border-foreground/30"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <CopyButton value={value} />
        </div>

        {result === null ? (
          <p className="mt-2 text-sm text-muted-foreground">Computing…</p>
        ) : result.ok ? (
          <p className="mt-2 break-all font-mono text-sm">{value}</p>
        ) : (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {result.error}
          </p>
        )}
      </div>
    </div>
  );
}
