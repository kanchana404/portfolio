"use client";

import { useCallback, useRef, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { cx } from "@/components/tools/ui";
import {
  type PdfText,
  extractText,
  pdfServiceAvailable,
} from "@/lib/tools/pdf/client";

type Stage = "idle" | "asking" | "working" | "done" | "error";

export default function PdfToText() {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PdfText | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const available = pdfServiceAvailable();

  // Choosing a file only *offers* to send it. A PDF is far more likely to be a
  // contract or a scanned ID than a holiday photo, so the upload waits for a
  // second, deliberate action.
  const choose = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setMessage(null);
    setStage("asking");
  }, []);

  const send = useCallback(async () => {
    if (!file) return;
    setStage("working");
    try {
      setResult(await extractText(file));
      setStage("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That PDF could not be read.");
      setStage("error");
    }
  }, [file]);

  const all = result?.pages.join("\n\n") ?? "";

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="p-4 sm:p-5">
        <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
          <button
            type="button"
            disabled={!available}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Choose a PDF
          </button>
          <p className="max-w-prose text-xs text-muted-foreground">
            {available
              ? "Nothing is sent until you confirm on the next step."
              : "The extraction service is not configured for this deployment, so this tool cannot run here."}
          </p>
        </div>
      </div>

      {stage === "asking" && file ? (
        <div className="border-t p-4 sm:p-5">
          <p className="max-w-prose text-sm">
            Send <span className="font-medium">{file.name}</span> to the server to
            read its text? The file is parsed in memory and never written to disk,
            and only the text comes back.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={send}
              className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Send and extract
            </button>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setStage("idle");
              }}
              className="inline-flex h-9 items-center rounded-md border px-3.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {stage === "working" ? (
        <p className="border-t p-4 text-sm text-muted-foreground sm:p-5">
          Reading the PDF…
        </p>
      ) : null}

      {stage === "error" ? (
        <p className="border-t p-4 text-sm text-muted-foreground sm:p-5">{message}</p>
      ) : null}

      {stage === "done" && result ? (
        <>
          <div className="flex flex-wrap items-center gap-3 border-t p-4 sm:p-5">
            <p className="text-xs tabular-nums text-muted-foreground">
              {result.pageCount} pages
            </p>
            {result.hasText ? <CopyButton value={all} label="Copy all text" /> : null}
          </div>

          {/* A scan and a failed read both produce empty strings. Saying which
              one happened is the difference between a useful answer and someone
              hunting for a bug in their own file. */}
          {result.note ? (
            <p className="max-w-prose border-t p-4 text-sm text-muted-foreground sm:p-5">
              {result.note}
            </p>
          ) : (
            <div className="max-h-96 overflow-auto border-t">
              {result.pages.map((page, i) => (
                <div
                  key={i}
                  className={cx("px-4 py-3 sm:px-5", i > 0 && "border-t border-border/60")}
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Page {i + 1}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {page || "(no text on this page)"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) choose(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
