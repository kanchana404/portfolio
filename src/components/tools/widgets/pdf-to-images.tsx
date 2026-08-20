"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/components/tools/ui";
import {
  pdfInfo,
  pdfServiceAvailable,
  renderPage,
} from "@/lib/tools/pdf/client";

type Stage = "idle" | "asking" | "working" | "done" | "error";

interface Page {
  index: number;
  url: string;
}

export default function PdfToImages() {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const available = pdfServiceAvailable();

  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  const choose = useCallback((f: File) => {
    setFile(f);
    setPages([]);
    setMessage(null);
    setStage("asking");
  }, []);

  const send = useCallback(async () => {
    if (!file) return;
    setStage("working");
    try {
      // Page count first, then one request per page. Rendering a long document
      // in a single response would hold a hundred pages of pixels in memory on
      // both ends; this way each page arrives as it is ready and the first one
      // is visible almost immediately.
      const info = await pdfInfo(file);
      setTotal(info.pageCount);

      for (let i = 1; i <= info.pageCount; i += 1) {
        const blob = await renderPage(file, i);
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        setPages((c) => [...c, { index: i, url }]);
      }
      setStage("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That PDF could not be rendered.");
      setStage("error");
    }
  }, [file]);

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
              : "The rendering service is not configured for this deployment, so this tool cannot run here."}
          </p>
        </div>
      </div>

      {stage === "asking" && file ? (
        <div className="border-t p-4 sm:p-5">
          <p className="max-w-prose text-sm">
            Send <span className="font-medium">{file.name}</span> to the server to
            render its pages? The file is read in memory and never written to
            disk, and only the images come back.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={send}
              className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Send and render
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
        <p className="border-t p-4 text-sm tabular-nums text-muted-foreground sm:p-5">
          Rendering page {pages.length + 1}
          {total ? ` of ${total}` : ""}…
        </p>
      ) : null}

      {stage === "error" ? (
        <p className="border-t p-4 text-sm text-muted-foreground sm:p-5">{message}</p>
      ) : null}

      {pages.length > 0 ? (
        <div className="border-t">
          {pages.map((page, i) => (
            <div
              key={page.url}
              className={cx(
                "flex min-h-11 items-center gap-3 px-4 py-2 sm:px-5",
                i > 0 && "border-t border-border/60"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.url}
                alt={`Page ${page.index}`}
                width={40}
                height={52}
                className="h-13 w-10 shrink-0 rounded border object-cover"
              />
              <p className="min-w-0 flex-1 text-sm tabular-nums">Page {page.index}</p>
              <a
                href={page.url}
                download={`page-${String(page.index).padStart(3, "0")}.png`}
                className="inline-flex h-7 shrink-0 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted"
              >
                Save
              </a>
            </div>
          ))}
        </div>
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
