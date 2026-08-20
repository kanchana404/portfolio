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
 * The third line is the point. For everything in the direct-handoff set the
 * response carries a URL on the platform's CDN and the browser fetches it
 * itself, so no bytes move through infrastructure anyone here pays for. The
 * expensive path exists for YouTube, which serves video and audio as separate
 * IP-bound streams that have to be muxed server-side, and it is not wired up
 * here.
 *
 * A ticket is single use, so one is fetched per resolve rather than cached.
 * Reusing one produces `ticket_used`, which is the protection working.
 */

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
        // Must match TICKET_HEADER in app/security/tickets.py.
        "X-Download-Ticket": ticket,
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
