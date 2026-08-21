/**
 * Turning the service's error codes into sentences a person can act on.
 *
 * The downloader returns machine codes, and a few of them are the difference
 * between "this is broken" and "this is working exactly as intended":
 *
 * - `ticket_replayed` means a ticket was presented twice. That is the single-use
 *   guarantee doing its job, and the fix is to try again, not to report a bug.
 *   The name matters: an earlier version of this file handled `ticket_used`,
 *   which nothing emits, so every genuine replay fell through to the generic
 *   fallback — the one code most in need of a specific message got the least
 *   specific one. These strings are a wire contract with
 *   `downloader-api/app/errors.py`; they are not descriptive prose.
 * - `platform_degraded` means an extractor broke upstream. Every downloader on
 *   the internet has the same problem at the same time, and it comes back on
 *   its own, so saying "try again in a few days" is more honest than "error".
 * - `killswitch_active` means the daily spend cap tripped. Nothing is broken and
 *   nothing the reader does will help today.
 *
 * A code with no entry here falls back to a plain sentence rather than being
 * printed raw. `unsupported_platform_x` shown to a visitor is a bug report they
 * cannot file and an implementation detail they did not ask for.
 */

export interface DownloadErrorInfo {
  /** What to show. One sentence, no code, no jargon. */
  message: string;
  /** True when trying the same thing again might work. */
  retryable: boolean;
}

const MESSAGES: Record<string, DownloadErrorInfo> = {
  // --- the link itself -----------------------------------------------------
  unsupported_platform: {
    message:
      "That link is not from a site this supports. Check the list below and paste a link to a single post.",
    retryable: false,
  },
  playlist_rejected: {
    message: "That is a playlist or a channel. Paste a link to one video instead.",
    retryable: false,
  },
  video_too_long: {
    message: "That video is longer than this will handle. Short posts and clips work best.",
    retryable: false,
  },
  file_too_large: {
    message: "That file is too large to process here.",
    retryable: false,
  },

  // --- the platform, not us ------------------------------------------------
  extractor_failed: {
    message:
      "The post could not be read. It is usually private, deleted, or age restricted, and none of those can be worked around.",
    retryable: false,
  },
  platform_degraded: {
    message:
      "That platform changed something and the reader for it is broken right now. It normally comes back within a few days, and nothing you do will speed it up.",
    retryable: false,
  },

  // --- the ticket, which is the protection working -------------------------
  ticket_expired: {
    message: "That took too long. Press the button again.",
    retryable: true,
  },
  ticket_replayed: {
    message: "That session was already used. Press the button again.",
    retryable: true,
  },
  ticket_rejected: {
    message: "The download session was refused. Press the button again.",
    retryable: true,
  },
  ticket_ttl_implausible: {
    // The clock on one side is wrong. Nothing the reader does fixes it, and
    // "try again" would be a lie, so this one is not retryable.
    message:
      "The download session had an impossible lifetime, which usually means a clock is wrong. This is not something you can work around.",
    retryable: false,
  },
  ticket_missing: {
    message: "The download session did not start. Press the button again.",
    retryable: true,
  },
  ticket_bad_signature: {
    // Says nothing about *why*, matching the service, which refuses to be an
    // oracle for whether the secret or the address was wrong.
    message: "The download session was not valid. Press the button again.",
    retryable: true,
  },
  ticket_wrong_audience: {
    message: "The download session was not valid. Press the button again.",
    retryable: true,
  },

  // --- challenge -----------------------------------------------------------
  turnstile_failed: {
    message: "The 'are you human' check did not pass. Try once more.",
    retryable: true,
  },
  challenge_required: {
    message: "Complete the 'are you human' check first.",
    retryable: true,
  },
  challenge_failed: {
    message: "The 'are you human' check could not be verified. Try once more.",
    retryable: true,
  },
  challenge_misconfigured: {
    // Deliberately does not say "try again". This is a Cloudflare 4xxxxx: the
    // sitekey is unknown to Cloudflare, usually because the widget was deleted
    // or never listed this hostname. Every retry fails the same way, and the
    // only person who can fix it is the operator.
    message:
      "The 'are you human' check is not set up correctly on this site, so downloads cannot run. This is my fault, not yours, and retrying will not help.",
    retryable: false,
  },

  // --- capacity ------------------------------------------------------------
  killswitch_active: {
    message:
      "Downloads are paused for today because the daily limit was reached. Nothing is broken; try tomorrow.",
    retryable: false,
  },
  quota_exceeded: {
    message: "You have used today's downloads from this connection. Try again tomorrow.",
    retryable: false,
  },

  // --- ours ----------------------------------------------------------------
  not_configured: {
    message: "Downloads are not switched on for this site yet.",
    retryable: false,
  },
  unreachable: {
    message: "The downloader could not be reached. Your link was not sent anywhere else.",
    retryable: true,
  },
  internal: {
    message: "Something went wrong on the server. Trying again sometimes helps.",
    retryable: true,
  },
};

export function describeError(code: string, fallback?: string): DownloadErrorInfo {
  const known = MESSAGES[code];
  if (known) return known;

  // Never print a raw code. It is a bug report the reader cannot file.
  return {
    message: fallback?.trim()
      ? fallback
      : "That link could not be processed. Try a different one.",
    retryable: false,
  };
}

/** Codes for which offering a retry button is honest rather than annoying. */
export function isRetryable(code: string): boolean {
  return describeError(code).retryable;
}
