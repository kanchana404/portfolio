"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";

/**
 * The client half of the downloader.
 *
 * ## How this talks to the backend, and why it is shaped this way
 *
 * Three hops, and the middle one deliberately skips this site entirely:
 *
 *   1. `POST /api/tools/download-ticket`  (our origin, edge)  → a 120s ticket
 *   2. `POST {API}/v1/resolve`            (Railway, direct)   → formats
 *   3. `POST {API}/v1/jobs` + poll        (Railway, direct)   → a presigned URL
 *
 * The browser talks to Railway **directly** rather than through a Next.js proxy.
 * Proxying would route every byte of every video through Vercel, which bills
 * egress; Railway → Cloudflare R2 → user does not touch this project's
 * bandwidth at all. The cost of that choice is that the API must be reachable
 * cross-origin, which is why the service pins CORS to this exact origin and why
 * every call carries a single-use, IP-bound ticket instead of an API key.
 *
 * A ticket is minted per request, never reused: the service burns the `jti` on
 * first use, so a second call with the same ticket is rejected as a replay.
 *
 * ## Why there is a job queue at all
 *
 * Almost every platform serves video and audio as separate streams. One URL
 * handed to a browser is a silent clip, so the bytes have to pass through a
 * worker that muxes them with ffmpeg. Only a handful of platforms (Pinterest,
 * Snapchat, X) publish a single progressive file we can hand over directly, and
 * for those `delivery` comes back as `"direct"` and no job is created.
 */

const API_BASE = process.env.NEXT_PUBLIC_DOWNLOADER_API ?? "";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

export type DownloaderPlatform =
  | "tiktok"
  | "youtube"
  | "instagram"
  | "facebook"
  | "loom";

interface MediaFormat {
  format_id: string;
  ext: string;
  label: string;
  height: number | null;
  filesize: number | null;
  has_audio: boolean;
  has_video: boolean;
  direct_url: string | null;
}

interface ResolveResponse {
  platform: string;
  title: string;
  duration_s: number | null;
  thumbnail: string | null;
  uploader: string | null;
  formats: MediaFormat[];
  delivery: "direct" | "job";
}

interface JobStatus {
  id: string;
  state: "queued" | "running" | "done" | "failed";
  progress: number;
  error_code: string | null;
  download_url: string | null;
  expires_at: number | null;
}

type Phase = "idle" | "resolving" | "ready" | "working" | "done" | "error";

const PLATFORM_COPY: Record<DownloaderPlatform, { name: string; example: string }> = {
  tiktok: { name: "TikTok", example: "https://www.tiktok.com/@user/video/1234567890" },
  youtube: { name: "YouTube", example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  instagram: { name: "Instagram", example: "https://www.instagram.com/reel/Cxxxxxxxxxx/" },
  facebook: { name: "Facebook", example: "https://www.facebook.com/reel/1234567890" },
  loom: { name: "Loom", example: "https://www.loom.com/share/0123456789abcdef0123456789abcdef" },
};

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Ask our own origin for a fresh single-use ticket. */
async function getTicket(): Promise<string> {
  const res = await fetch("/api/tools/download-ticket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 503
        ? "The downloader is not configured yet."
        : "Could not start a download session. Reload the page and try again."
    );
  }
  const data = (await res.json()) as { ticket?: string };
  if (!data.ticket) throw new Error("Could not start a download session.");
  return data.ticket;
}

/** Error codes that mean "the credential was stale", not "the request was bad". */
const TICKET_ERRORS = new Set([
  "ticket_missing",
  "ticket_expired",
  "ticket_replayed",
  "ticket_bad_signature",
  "ticket_wrong_audience",
]);

/**
 * Call the downloader service, surfacing its human-readable `detail`.
 *
 * Retries once on a ticket rejection. A ticket lives 120 seconds and is
 * single-use, so a visitor who leaves the tab open, or whose polling loop races
 * an expiry, will occasionally present a stale one — that is a transient
 * condition and a fresh ticket fixes it silently.
 *
 * The one case a retry cannot fix is `ip_mismatch`: the ticket is bound to the
 * address that requested it, so a visitor whose egress IP rotates mid-session
 * (some VPNs, some mobile CGNAT) will fail twice. They get a message that says
 * what to do rather than the raw "Invalid ticket", which is meaningless to
 * anyone who does not know what a ticket is.
 */
async function callApi<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const ticket = await getTicket();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "X-Download-Ticket": ticket,
      ...(init.headers ?? {}),
    },
  });

  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return body as T;

  const code =
    body && typeof body === "object" && "error" in body
      ? String((body as { error: unknown }).error)
      : "";

  if (TICKET_ERRORS.has(code)) {
    if (!isRetry) return callApi<T>(path, init, true);
    throw new Error(
      "Your session could not be verified. This usually means your connection " +
        "changed — reload the page and try once more."
    );
  }

  const detail =
    body && typeof body === "object" && "detail" in body
      ? String((body as { detail: unknown }).detail)
      : "That did not work. Try again in a moment.";
  throw new Error(detail);
}

/**
 * Hand a URL to the browser as a download.
 *
 * For the worker path this points at a presigned R2 URL that carries
 * `Content-Disposition: attachment`, so the browser saves it rather than
 * playing it. For the direct path we cannot set that header on someone else's
 * CDN, and the `download` attribute is ignored cross-origin — so those open in
 * a new tab and the visitor saves from there. Opening a tab is honest; a
 * `download` attribute that silently does nothing is not.
 */
function triggerDownload(url: string, sameOrigin: boolean): void {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  if (sameOrigin) {
    a.download = "";
  } else {
    a.target = "_blank";
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function VideoDownloader({ platform }: { platform: DownloaderPlatform }) {
  const id = useId();
  const copy = PLATFORM_COPY[platform];

  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<ResolveResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const cancelled = useRef(false);

  const configured = API_BASE.length > 0;

  const reset = () => {
    cancelled.current = true;
    setPhase("idle");
    setError(null);
    setMedia(null);
    setProgress(0);
    setNote(null);
  };

  const resolve = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    cancelled.current = false;
    setPhase("resolving");
    setError(null);
    setMedia(null);
    setNote(null);
    try {
      const data = await callApi<ResolveResponse>("/v1/resolve", {
        method: "POST",
        body: JSON.stringify({ url: trimmed }),
      });
      if (cancelled.current) return;
      if (!data.formats?.length) {
        setPhase("error");
        setError("No downloadable video was found at that link.");
        return;
      }
      setMedia(data);
      setPhase("ready");
    } catch (e) {
      if (cancelled.current) return;
      setPhase("error");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [url]);

  const download = useCallback(
    async (format: MediaFormat) => {
      if (!media) return;
      cancelled.current = false;
      setError(null);

      // Direct path: the CDN URL is fetchable by the browser as one playable
      // file, so no server time is spent at all.
      if (media.delivery === "direct" && format.direct_url) {
        triggerDownload(format.direct_url, false);
        setPhase("done");
        setNote("Opened in a new tab — save it from there.");
        return;
      }

      setPhase("working");
      setProgress(0);
      try {
        const job = await callApi<JobStatus>("/v1/jobs", {
          method: "POST",
          body: JSON.stringify({
            url: url.trim(),
            format_id: format.format_id,
            mode: format.has_video ? "video" : "audio",
          }),
        });

        const startedAt = Date.now();
        // Poll rather than stream: a job is minutes long at worst, an SSE
        // connection held open through Cloudflare for that duration is a
        // liability, and each poll re-authenticates with a fresh ticket.
        for (;;) {
          if (cancelled.current) return;
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            throw new Error("This is taking longer than expected. Try a smaller size.");
          }
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          if (cancelled.current) return;

          const status = await callApi<JobStatus>(`/v1/jobs/${job.id}`, { method: "GET" });
          setProgress(status.progress);

          if (status.state === "done" && status.download_url) {
            triggerDownload(status.download_url, false);
            setPhase("done");
            setNote("Your download has started. The link stays valid for a few hours.");
            return;
          }
          if (status.state === "failed") {
            throw new Error("The download failed. The post may be private or removed.");
          }
        }
      } catch (e) {
        if (cancelled.current) return;
        setPhase("error");
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    },
    [media, url]
  );

  const busy = phase === "resolving" || phase === "working";

  return (
    <div className="rounded-lg border">
      <div className="p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-url`}>{copy.name} link</ToolLabel>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <ToolInput
            id={`${id}-url`}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (phase !== "idle") reset();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void resolve();
            }}
            placeholder={copy.example}
            spellCheck={false}
            inputMode="url"
            autoComplete="off"
            className="font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => void resolve()}
            disabled={busy || !url.trim() || !configured}
            className="shrink-0 rounded-md border bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {phase === "resolving" ? "Checking…" : "Get video"}
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Paste a public {copy.name} link. The file is fetched by my server, converted
          if it needs it, and deleted a few hours later.
        </p>
      </div>

      {/* One live region for every async state, so a screen reader hears the
          result instead of silence. */}
      <div aria-live="polite" className="contents">
        {!configured ? (
          <div className="border-t p-4 sm:p-5">
            <p className="text-sm text-muted-foreground">
              This tool is not connected yet. The other tools on this site still work.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="border-t p-4 sm:p-5" role="alert">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          </div>
        ) : null}

        {media && (phase === "ready" || phase === "working" || phase === "done") ? (
          <div className="border-t p-4 sm:p-5">
            <div className="flex items-start gap-3">
              {media.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.thumbnail}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-md border object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{media.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[media.uploader, formatDuration(media.duration_s)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {media.formats.map((f) => (
                <li
                  key={f.format_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <span className="min-w-0 text-sm">
                    {f.label}
                    {formatBytes(f.filesize) ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatBytes(f.filesize)}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => void download(f)}
                    disabled={busy}
                    className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>

            {phase === "working" ? (
              <div className="mt-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground transition-[width] duration-500"
                    style={{ width: `${Math.max(4, progress)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Preparing your file… {progress}%. You can leave this tab open.
                </p>
              </div>
            ) : null}

            {note ? (
              <p
                className={cx(
                  "mt-4 text-sm",
                  phase === "done" ? "text-emerald-700 dark:text-emerald-400" : ""
                )}
              >
                {note}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Thin per-platform entries. The widget map is keyed by slug and passes no
// props, so each tool page gets its own zero-logic wrapper rather than the
// registry growing a props channel it would only ever use here.
export const TikTokDownloader = () => <VideoDownloader platform="tiktok" />;
export const YouTubeDownloader = () => <VideoDownloader platform="youtube" />;
export const InstagramDownloader = () => <VideoDownloader platform="instagram" />;
export const FacebookDownloader = () => <VideoDownloader platform="facebook" />;
export const LoomDownloader = () => <VideoDownloader platform="loom" />;

export default VideoDownloader;
