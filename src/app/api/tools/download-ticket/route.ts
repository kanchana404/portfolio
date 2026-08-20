import { NextResponse } from "next/server";
import {
  CLEARANCE_COOKIE,
  clearanceCookieHeader,
  clearanceSolvedAt,
  clearanceValid,
  mintClearance,
} from "@/lib/tools/download/clearance";
import {
  TICKET_TTL_S,
  clientIpFrom,
  hashIp,
  mintTicket,
} from "@/lib/tools/download/ticket";

/**
 * Mints a download ticket, and is the only place outside the downloader service
 * that holds `TICKET_SECRET`.
 *
 * This is where "a human solved a challenge" becomes a credential the service
 * can verify offline: 120 seconds, single use, bound to the caller's address.
 * The service can then refuse `/v1/resolve` and `/v1/jobs` to anyone with curl
 * without holding any per-user state or calling back here.
 *
 * ## It fails closed, deliberately
 *
 * Every configuration mistake here produces a refusal rather than a ticket. A
 * missing secret, a missing salt, a missing Turnstile secret in production, an
 * unverified token: all 5xx or 403, none mint. The alternative is worse than
 * broken — a route that mints unchallenged tickets is an open proxy in front of
 * a service that spends money per request, and it looks perfectly healthy while
 * it does it.
 *
 * ## The address is taken from headers, not from the socket
 *
 * It has to match, byte for byte, what the service computes from its own peer
 * address, or every request 401s as `ip_mismatch` with nothing in the response
 * explaining why. `clientIpFrom` implements the same rule as `client_ip` there:
 * Cloudflare's header first, then the RIGHTMOST forwarded entry, because the
 * leftmost is whatever the client claimed.
 *
 * Spoofing that header is not a bypass. The value gets hashed into the ticket,
 * and the service recomputes it from the connection it actually received, so a
 * forged address produces a ticket that fails on the caller's own next request.
 *
 * ## One challenge, then a window
 *
 * A ticket is single use and a Turnstile token is single use, so the literal
 * reading — challenge every mint — means a CAPTCHA per poll of a running job,
 * dozens per download. Instead the first solve sets a signed, IP-bound,
 * 15-minute clearance cookie and later mints present that. See `clearance.ts`
 * for why this is a window rather than a hole; the short version is that the
 * per-IP quota on the service, not the challenge, is what caps the bill.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cloudflare's verification endpoint for a Turnstile token. */
const TURNSTILE_VERIFY =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function refuse(code: string, detail: string, status: number) {
  // No `Cache-Control: public` anywhere on this route: a cached ticket is a
  // ticket issued to somebody else's address.
  return NextResponse.json(
    { error: code, detail },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Cloudflare's tokens are ~2 kB at the outside. Anything past this is not a
 * token, and forwarding it would make this route a free relay for pushing
 * arbitrary bodies at Cloudflare on someone else's behalf.
 */
const MAX_TOKEN_LENGTH = 4096;

/** Long enough for a slow verification, short enough not to pin a function. */
const VERIFY_TIMEOUT_MS = 5_000;

async function turnstileOk(token: string, secret: string, ip: string): Promise<boolean> {
  if (token.length > MAX_TOKEN_LENGTH) return false;

  // Without a deadline, a hung siteverify holds this function open until the
  // platform kills it — and every visitor waiting on a challenge holds another
  // one. The failure mode of a slow dependency should be a fast refusal.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), VERIFY_TIMEOUT_MS);
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: ip });
    const response = await fetch(TURNSTILE_VERIFY, {
      method: "POST",
      body,
      signal: abort.signal,
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    // A network failure verifying the challenge is not permission to skip it.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const secret = process.env.TICKET_SECRET;
  const salt = process.env.IP_SALT;
  const turnstileSecret = process.env.TURNSTILE_SECRET;

  if (!secret || !salt) {
    // Names the variables, and names the ones that did arrive.
    //
    // "TICKET_SECRET or IP_SALT is not configured" was true and useless: on
    // Vercel a variable can exist in the dashboard and still be absent from the
    // running function, because it is injected at build time and scoped per
    // environment. Whether *none* of the five arrived or only one is missing
    // separates "wrong environment tick-box" from "typo", and that difference
    // is the whole debugging session.
    //
    // Names only. A value never goes near a log line.
    const missing = [
      !secret && "TICKET_SECRET",
      !salt && "IP_SALT",
    ].filter(Boolean);
    const present = [
      "TICKET_SECRET",
      "IP_SALT",
      "TURNSTILE_SECRET",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "NEXT_PUBLIC_DOWNLOADER_API",
    ].filter((name) => Boolean(process.env[name]));
    console.error(
      `download-ticket: missing ${missing.join(" and ")}. ` +
        `Of the five expected variables, the ones this function can see are: ` +
        `${present.length ? present.join(", ") : "none"}.`
    );
    return refuse(
      "not_configured",
      "Downloads are not available on this deployment.",
      503
    );
  }

  const ip = clientIpFrom(request.headers);
  const ipHash = hashIp(ip, salt);
  let grantClearance = false;
  /** Carried forward on a reissue so the absolute cap cannot be reset. */
  let solvedAt: number | undefined;

  if (turnstileSecret) {
    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${CLEARANCE_COOKIE}=`))
      ?.slice(CLEARANCE_COOKIE.length + 1);

    if (clearanceValid(cookie, ipHash, secret)) {
      // Slide the window on use. A fixed 15 minutes from the solve expires in
      // the middle of a long mux — the visitor is actively waiting, polling
      // every few seconds, and gets asked to prove they are human again for a
      // download that is already running and already paid for. An idle window
      // is the thing worth bounding, not an active one.
      grantClearance = true;
      solvedAt = clearanceSolvedAt(cookie, secret) ?? undefined;
    } else {
      let token: string | null = null;
      try {
        const body = (await request.json()) as { token?: unknown };
        token =
          typeof body.token === "string" && body.token.length <= MAX_TOKEN_LENGTH
            ? body.token
            : null;
      } catch {
        token = null;
      }
      if (!token) {
        return refuse("challenge_required", "Complete the challenge first.", 403);
      }
      if (!(await turnstileOk(token, turnstileSecret, ip))) {
        return refuse("challenge_failed", "That challenge could not be verified.", 403);
      }
      grantClearance = true;
    }
  } else if (process.env.NODE_ENV === "production") {
    // Minting unchallenged tickets in production would hand the expensive
    // endpoints to anyone who can find this URL.
    console.error("download-ticket: TURNSTILE_SECRET missing in production");
    return refuse(
      "not_configured",
      "Downloads are not available on this deployment.",
      503
    );
  }

  const ticket = mintTicket({ ip, secret, salt });

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (grantClearance) {
    headers["Set-Cookie"] = clearanceCookieHeader(
      mintClearance(ipHash, secret, Date.now(), solvedAt),
      // `Secure` would make the cookie undeliverable over plain HTTP, which is
      // exactly what local development runs on.
      process.env.NODE_ENV === "production"
    );
  }

  return NextResponse.json({ ticket, expiresIn: TICKET_TTL_S }, { headers });
}
