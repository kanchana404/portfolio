/**
 * Talking to the downloader service from the browser.
 *
 * Two hops, and the split is the whole design. The browser cannot hold
 * `TICKET_SECRET`, so it asks our own route for a ticket, then presents that
 * ticket to the downloader. Our route is the only thing holding the secret; the
 * downloader verifies with nothing but the secret and one Redis round trip.
 *
 *     browser -> /api/tools/download-ticket  -> ticket (120s, single use, IP-bound)
 *     browser -> downloader /v1/resolve      -> formats
 *     browser -> the platform's own CDN      -> the file
 *
 * The third line is the cheap path: the response carries a URL on the
 * platform's CDN and the browser fetches it itself, so no bytes move through
 * infrastructure anyone here pays for. It applies to three of the ten
 * platforms — Twitter, Pinterest and Snapchat.
 *
 * The other seven need the worker, and for a reason worth stating rather than
 * assuming. TikTok's CDN URL was measured to be bound to session cookies the
 * browser cannot send (`Cookie` and `Referer` are forbidden headers, and CORS
 * would block reading the response anyway); YouTube serves video and audio as
 * separate IP-bound streams that have to be muxed. For those, `resolve` returns
 * `delivery: "job"` and the work moves to:
 *
 *     browser -> downloader POST /v1/jobs      -> job id
 *     browser -> downloader GET  /v1/jobs/{id} -> poll until done
 *     browser -> presigned R2 URL              -> the file
 *
 * Polling is why the clearance cookie exists. Every one of those GETs needs its
 * own single-use ticket, and challenging each one would mean dozens of CAPTCHAs
 * per download. See `clearance.ts`.
 *
 * A ticket is single use, so one is fetched per resolve rather than cached.
 * Reusing one produces `ticket_used`, which is the protection working.
 */

import { TICKET_HEADER, TURNSTILE_HEADER } from "./protocol";

export const DOWNLOADER_API = process.env.NEXT_PUBLIC_DOWNLOADER_API ?? "";

export function downloaderAvailable(): boolean {
  return DOWNLOADER_API.length > 0;
}

export class DownloaderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DownloaderError";
    this.code = code;
  }
}

export interface MediaFormat {
  format_id: string;
  ext: string;
  label: string;
  height: number | null;
  filesize: number | null;
  has_audio: boolean;
  has_video: boolean;
  direct_url: string | null;
}

export interface ResolveResponse {
  platform: string;
  title: string;
  duration_s: number | null;
  thumbnail: string | null;
  uploader: string | null;
  formats: MediaFormat[];
  delivery: "direct" | "job";
}

async function getTicket(turnstileToken?: string): Promise<string> {
  const response = await fetch("/api/tools/download-ticket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: turnstileToken ?? null }),
    // The clearance cookie is same-origin and httpOnly; without this it is
    // neither stored nor sent, and every mint asks for a fresh challenge.
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    throw new DownloaderError(
      body.error ?? "ticket_failed",
      body.detail ?? "Could not start a download session."
    );
  }
  const { ticket } = (await response.json()) as { ticket: string };
  return ticket;
}

export async function resolve(
  url: string,
  options: { turnstileToken?: string; signal?: AbortSignal } = {}
): Promise<ResolveResponse> {
  if (!downloaderAvailable()) {
    throw new DownloaderError(
      "not_configured",
      "The downloader is not available on this deployment."
    );
  }

  const ticket = await getTicket(options.turnstileToken);

  let response: Response;
  try {
    response = await fetch(`${DOWNLOADER_API}/v1/resolve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [TICKET_HEADER]: ticket,
      },
      body: JSON.stringify({ url }),
      signal: options.signal,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new DownloaderError(
      "unreachable",
      "The downloader could not be reached. Nothing was sent anywhere else."
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    throw new DownloaderError(
      body.error ?? `http_${response.status}`,
      body.detail ?? describeStatus(response.status)
    );
  }

  return (await response.json()) as ResolveResponse;
}

/** A sentence for the codes worth explaining, rather than a bare number. */
function describeStatus(status: number): string {
  if (status === 429) return "Too many requests from this address today. Try again tomorrow.";
  if (status === 503) return "The downloader is paused. It will be back.";
  if (status === 451) return "That link cannot be resolved from here.";
  return `The downloader refused the request (${status}).`;
}

/** Human size for the format list; null when the platform did not say. */
export function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "kB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1000)));
  const value = bytes / 1000 ** i;
  return `${i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** Seconds to m:ss, for the duration line. */
export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}


// ---------------------------------------------------------------------------
// The worker path, for the seven platforms whose CDN the browser cannot fetch
// ---------------------------------------------------------------------------

export type JobState = "queued" | "running" | "done" | "failed";

export interface JobStatus {
  id: string;
  state: JobState;
  progress: number;
  error_code: string | null;
  download_url: string | null;
  expires_at: number | null;
}

async function jobFetch(
  path: string,
  init: RequestInit,
  turnstileToken?: string
): Promise<JobStatus> {
  const ticket = await getTicket(turnstileToken);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    [TICKET_HEADER]: ticket,
    ...(init.headers as Record<string, string> | undefined),
  };
  // Job creation is charged, so the service challenges it independently of the
  // ticket. Polling is not.
  if (turnstileToken) headers[TURNSTILE_HEADER] = turnstileToken;

  let response: Response;
  try {
    response = await fetch(`${DOWNLOADER_API}${path}`, {
      ...init,
      headers,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new DownloaderError(
      "unreachable",
      "The downloader could not be reached. Nothing was sent anywhere else."
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    throw new DownloaderError(
      body.error ?? `http_${response.status}`,
      body.detail ?? describeStatus(response.status)
    );
  }
  return (await response.json()) as JobStatus;
}

export function createJob(
  url: string,
  formatId: string,
  mode: "video" | "audio",
  options: { turnstileToken?: string; signal?: AbortSignal } = {}
): Promise<JobStatus> {
  return jobFetch(
    "/v1/jobs",
    { method: "POST", body: JSON.stringify({ url, format_id: formatId, mode }), signal: options.signal },
    options.turnstileToken
  );
}

export function readJob(
  jobId: string,
  options: { signal?: AbortSignal } = {}
): Promise<JobStatus> {
  return jobFetch(`/v1/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
    signal: options.signal,
  });
}

/** Poll delay in milliseconds, by how long we have already been waiting. */
function pollDelay(elapsedMs: number): number {
  // Tight at the start because short clips finish in seconds, then backing off
  // so a two-minute encode does not cost a hundred round trips.
  if (elapsedMs < 10_000) return 1_000;
  if (elapsedMs < 60_000) return 2_500;
  return 5_000;
}

/** Nothing legitimate takes this long; past it the job is not coming back. */
const JOB_TIMEOUT_MS = 10 * 60_000;

/**
 * Runs a job to completion, reporting progress, and resolves to the file URL.
 *
 * The URL is a presigned R2 link with an expiry, so it is handed straight to
 * the browser rather than stored — a saved one stops working and looks like a
 * bug in this page rather than the deliberate limit it is.
 */
export async function runJob(
  url: string,
  formatId: string,
  mode: "video" | "audio",
  options: {
    turnstileToken?: string;
    signal?: AbortSignal;
    onProgress?: (status: JobStatus) => void;
  } = {}
): Promise<JobStatus> {
  let status = await createJob(url, formatId, mode, options);
  options.onProgress?.(status);

  const started = Date.now();
  while (status.state === "queued" || status.state === "running") {
    if (Date.now() - started > JOB_TIMEOUT_MS) {
      throw new DownloaderError(
        "job_timeout",
        "That download took too long and was given up on."
      );
    }
    await sleep(pollDelay(Date.now() - started), options.signal);
    status = await readJob(status.id, { signal: options.signal });
    options.onProgress?.(status);
  }

  if (status.state === "failed") {
    throw new DownloaderError(
      status.error_code ?? "internal",
      "That download did not finish."
    );
  }
  if (!status.download_url) {
    throw new DownloaderError("internal", "The download finished with no file.");
  }
  return status;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
