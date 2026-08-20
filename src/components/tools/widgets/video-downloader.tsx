"use client";

import { useCallback, useId, useState } from "react";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  type ResolveResponse,
  DownloaderError,
  downloaderAvailable,
  formatDuration,
  formatSize,
  resolve,
} from "@/lib/tools/download/client";

type Stage = "idle" | "working" | "done" | "error";

export default function VideoDownloader() {
  const id = useId();
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const available = downloaderAvailable();

  const run = useCallback(async () => {
    const value = url.trim();
    if (!value) return;
    setStage("working");
    setMessage(null);
    setResult(null);
    try {
      const out = await resolve(value);
      setResult(out);
      setStage("done");
    } catch (error) {
      setMessage(
        error instanceof DownloaderError
          ? error.message
          : "That link could not be resolved."
      );
      setStage("error");
    }
  }, [url]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-url`}>Link</ToolLabel>
        <div className="mt-2 flex gap-2">
          <ToolInput
            id={`${id}-url`}
            value={url}
            disabled={!available}
            placeholder="Paste a post or video link"
            spellCheck={false}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
          />
          <button
            type="button"
            disabled={!available || stage === "working" || !url.trim()}
            onClick={() => void run()}
            className="inline-flex h-10 shrink-0 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {stage === "working" ? "Checking…" : "Get links"}
          </button>
        </div>
        <p className="mt-2 max-w-prose text-xs text-muted-foreground">
          {available
            ? "The link is read to find its media URLs. The file itself downloads straight from the platform, not through this site."
            : "The downloader is not configured on this deployment."}
        </p>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {stage === "error" ? (
          <p className="max-w-prose text-sm text-muted-foreground">{message}</p>
        ) : stage === "working" ? (
          <p className="text-sm text-muted-foreground">Reading the link…</p>
        ) : stage === "done" && result ? (
          <>
            <div className="flex gap-3">
              {result.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.thumbnail}
                  alt=""
                  width={96}
                  height={54}
                  className="h-14 w-24 shrink-0 rounded border object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{result.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    result.platform,
                    result.uploader,
                    formatDuration(result.duration_s),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            {result.formats.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No downloadable media was found at that link.
              </p>
            ) : (
              <ul className="mt-4">
                {result.formats.map((f, i) => (
                  <li
                    key={f.format_id}
                    className={cx(
                      "flex min-h-11 items-center gap-3 py-1.5",
                      i > 0 && "border-t border-border/60"
                    )}
                  >
                    <span className="min-w-0 flex-1 text-sm">
                      {f.label}
                      <span className="text-muted-foreground">
                        {" "}
                        {f.ext}
                        {formatSize(f.filesize) ? ` · ${formatSize(f.filesize)}` : ""}
                        {!f.has_audio && f.has_video ? " · no audio" : ""}
                      </span>
                    </span>
                    {f.direct_url ? (
                      <a
                        href={f.direct_url}
                        // The file comes from the platform's CDN, not from here.
                        // `noreferrer` keeps this site out of their logs.
                        rel="noopener noreferrer"
                        target="_blank"
                        className="inline-flex h-7 shrink-0 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        needs processing
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
