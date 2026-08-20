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
  /**
   * Finished jobs, by format id.
   *
   * Kept rather than acted on, because `window.open` after the poll loop does
   * not work: transient user activation from the click is long gone by the time
   * a mux finishes, so Safari and Firefox block it outright and Chrome blocks it
   * past a few seconds. The result was the tool's main path — seven of the ten
   * platforms — ending in silence: no file, no link, no error. So the URL is
   * rendered as a link the visitor clicks, the same shape image-resizer and
   * pdf-to-images already use.
   */
  const [ready, setReady] = useState<Record<string, string>>({});
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

  const explain = useCallback((error: unknown): string | null => {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    if (error instanceof DownloaderError || error instanceof TurnstileError) {
      return describeError(error.code, error.message).message;
    }
    return describeError("internal").message;
  }, []);

  /** Replaces the panel. For a resolve, where there is nothing to keep. */
  const fail = useCallback(
    (error: unknown) => {
      const text = explain(error);
      if (text === null) return;
      setMessage(text);
      setStage("error");
    },
    [explain]
  );

  /** Keeps the resolved list and reports beside it. For a failed download. */
  const failInPlace = useCallback(
    (error: unknown) => {
      const text = explain(error);
      if (text !== null) setMessage(text);
    },
    [explain]
  );

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
    setReady({});
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
        // `challenge` is handed over rather than called: a Turnstile token is
        // redeemed on first verification, and this path may need more than one —
        // the service challenges job creation separately from our mint route.
        // Letting the client ask for each token as it needs one is what keeps it
        // from spending the same token twice.
        const finished = await runJob(
          value,
          format.format_id,
          format.has_video ? "video" : "audio",
          {
            getToken: challenge,
            signal: controller.signal,
            onProgress: (status) => setJob({ formatId: format.format_id, status }),
          }
        );
        if (finished.download_url) {
          setReady((prev) => ({ ...prev, [format.format_id]: finished.download_url! }));
        }
        setJob(null);
      } catch (error) {
        setJob(null);
        // Not `fail`: that switches the whole panel to the error stage and takes
        // the resolved format list with it, so one failed download loses the
        // work of resolving and there is nothing left to retry against.
        failInPlace(error);
      }
    },
    [url, challenge, failInPlace]
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
            // Deliberately not disabled while busy. A disabled element loses
            // focus, and this is the element the visitor just pressed Enter on —
            // disabling it drops them back to the top of the document exactly
            // when a challenge may be about to appear and need their attention.
            // `aria-busy` says the same thing without moving anyone.
            disabled={!available || !url.trim()}
            aria-busy={busy}
            onClick={() => {
              if (!busy) void run();
            }}
            className="inline-flex h-10 shrink-0 items-center rounded-md bg-foreground px-3.5 text-sm font-medium text-background ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 aria-busy:opacity-50"
          >
            {stage === "working" ? "Checking…" : "Get links"}
          </button>
        </div>

        {/* Usually blank: with `interaction-only` most visitors never see a
            challenge. `:empty` cannot do the collapsing, because Turnstile
            renders a wrapper element whether or not it shows anything — the
            selector stops matching after the first submit and leaves a permanent
            gap. So the container carries no spacing of its own and any height
            comes from Turnstile's own element. */}
        <div ref={challengeRef} className="[&:not(:empty)]:mt-3" />

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
                    readyUrl={ready[f.format_id]}
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
  readyUrl,
  disabled,
  onDownload,
}: {
  format: MediaFormat;
  first: boolean;
  /** `undefined` when no job for this row; `null` while one is starting. */
  job?: JobStatus | null;
  /** Set once a job for this row has produced a file. */
  readyUrl?: string;
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

      {readyUrl ? (
        <a
          href={readyUrl}
          // The object carries `Content-Disposition: attachment`, set on upload,
          // so this genuinely saves rather than opening a player.
          className="inline-flex h-7 shrink-0 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:bg-muted"
        >
          Save
        </a>
      ) : running ? (
        <span
          // Outside the live region on purpose. A percentage that changes every
          // second is read out every second, so a ten-minute mux becomes several
          // hundred announcements of a number nobody asked to hear. The state
          // changes that matter are announced once each, above.
          aria-hidden="true"
          className="shrink-0 text-xs tabular-nums text-muted-foreground"
        >
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
