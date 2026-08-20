"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  type JobStatus,
  type MediaFormat,
  type ResolveResponse,
  DownloaderError,
  downloaderAvailable,
  formatDuration,
  formatSize,
  resolve,
  runJob,
} from "@/lib/tools/download/client";
import { describeError } from "@/lib/tools/download/errors";
import {
  TurnstileError,
  getTurnstileToken,
  turnstileConfigured,
} from "@/lib/tools/download/turnstile";

/**
 * Two delivery paths, and which one a link takes is not the reader's problem.
 *
 * Three platforms hand back a CDN URL the browser can fetch itself; the other
 * seven have to be muxed by a worker and polled. The UI does not name that
 * split — it shows "Open" for one and "Download" with a progress line for the
 * other, and both mean the same thing to the person using it.
 */

type Stage = "idle" | "working" | "done" | "error";

/** Mirrors SUPPORTED in app/resolver/platforms.py. */
const PLATFORMS =
  "TikTok, Instagram, Facebook, X, Reddit, Pinterest, YouTube, Loom, Twitch and Snapchat";

export default function VideoDownloader() {
  const id = useId();
  const challengeRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [job, setJob] = useState<{ formatId: string; status: JobStatus | null } | null>(
    null
  );
  const available = downloaderAvailable();

  // A resolve or a job in flight when the page goes away is a request nobody
  // will read the answer to, and on the job path it is a poll loop that keeps
  // running.
  useEffect(() => () => abortRef.current?.abort(), []);

  const challenge = useCallback(async () => {
    if (!turnstileConfigured()) return undefined;
    const container = challengeRef.current;
    if (!container) return undefined;
    const token = await getTurnstileToken(container);
    return token ?? undefined;
  }, []);

  const fail = useCallback((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    if (error instanceof DownloaderError || error instanceof TurnstileError) {
      setMessage(describeError(error.code, error.message).message);
    } else {
      setMessage(describeError("internal").message);
    }
    setStage("error");
  }, []);

  const run = useCallback(async () => {
    const value = url.trim();
    if (!value) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStage("working");
    setMessage(null);
    setResult(null);
    setJob(null);
    try {
      const token = await challenge();
      const out = await resolve(value, {
        turnstileToken: token,
        signal: controller.signal,
      });
      setResult(out);
      setStage("done");
    } catch (error) {
      fail(error);
    }
  }, [url, challenge, fail]);

  const download = useCallback(
    async (format: MediaFormat) => {
      const value = url.trim();
      if (!value) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setJob({ formatId: format.format_id, status: null });
      setMessage(null);
      try {
        // Job creation is charged, so the service challenges it separately from
        // the ticket. Polling afterwards rides the clearance cookie.
        const token = await challenge();
        const finished = await runJob(
          value,
          format.format_id,
          format.has_video ? "video" : "audio",
          {
            turnstileToken: token,
            signal: controller.signal,
            onProgress: (status) => setJob({ formatId: format.format_id, status }),
          }
        );
        if (finished.download_url) {
          // Opened rather than navigated to, so the resolved list survives and a
          // second format can be fetched without starting over.
          window.open(finished.download_url, "_blank", "noopener,noreferrer");
        }
        setJob(null);
      } catch (error) {
        setJob(null);
        fail(error);
      }
    },
    [url, challenge, fail]
  );

  const busy = stage === "working" || job !== null;

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
              if (e.key === "Enter" && !busy) void run();
            }}
          />
          <button
            type="button"
            disabled={!available || busy || !url.trim()}
            onClick={() => void run()}
            className="inline-flex h-10 shrink-0 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {stage === "working" ? "Checking…" : "Get links"}
          </button>
        </div>

        {/* Empty until Cloudflare decides this visitor has to prove something,
            so it must collapse rather than reserve a box that is usually blank. */}
        <div ref={challengeRef} className="empty:hidden mt-3" />

        <p className="mt-2 max-w-prose text-xs text-muted-foreground">
          {available
            ? `Works with ${PLATFORMS}. Paste a link to one post, not a channel or a playlist.`
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
                  {[result.platform, result.uploader, formatDuration(result.duration_s)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            {result.formats.length === 0 ? (
              <p className="mt-4 max-w-prose text-sm text-muted-foreground">
                No downloadable media was found at that link. Photo and slideshow
                posts often have no video stream at all.
              </p>
            ) : (
              <ul className="mt-4">
                {result.formats.map((f, i) => (
                  <FormatRow
                    key={f.format_id}
                    format={f}
                    first={i === 0}
                    job={job?.formatId === f.format_id ? job.status : undefined}
                    disabled={busy}
                    onDownload={() => void download(f)}
                  />
                ))}
              </ul>
            )}

            {message ? (
              <p className="mt-3 max-w-prose text-sm text-muted-foreground">{message}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function FormatRow({
  format,
  first,
  job,
  disabled,
  onDownload,
}: {
  format: MediaFormat;
  first: boolean;
  /** `undefined` when no job for this row; `null` while one is starting. */
  job?: JobStatus | null;
  disabled: boolean;
  onDownload: () => void;
}) {
  const running = job !== undefined;
  const size = formatSize(format.filesize);

  return (
    <li
      className={cx(
        "flex min-h-11 items-center gap-3 py-1.5",
        !first && "border-t border-border/60"
      )}
    >
      <span className="min-w-0 flex-1 text-sm">
        {format.label}
        <span className="text-muted-foreground">
          {" "}
          {format.ext}
          {size ? ` · ${size}` : ""}
          {!format.has_audio && format.has_video ? " · no audio" : ""}
        </span>
      </span>

      {running ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {job === null || job.state === "queued"
            ? "Queued…"
            : job.state === "running"
              ? `${job.progress}%`
              : "Finishing…"}
        </span>
      ) : format.direct_url ? (
        <a
          href={format.direct_url}
          // The file comes from the platform's CDN, not from here. `noreferrer`
          // keeps this site out of their logs.
          rel="noopener noreferrer"
          target="_blank"
          className="inline-flex h-7 shrink-0 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted"
        >
          Open
        </a>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={onDownload}
          className="inline-flex h-7 shrink-0 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted disabled:opacity-50"
        >
          Download
        </button>
      )}
    </li>
  );
}
