/**
 * One challenge, then a short window in which tickets are cheap to get.
 *
 * The problem this exists to solve is specific. A server-side download is a
 * job, and a job has to be polled — `GET /v1/jobs/{id}` needs a ticket, a
 * ticket needs a Turnstile token, and a Turnstile token is single use. Wiring
 * those together literally means one CAPTCHA per poll, forty CAPTCHAs per
 * download. That is not a strict version of the design; it is a broken one.
 *
 * So the challenge is exchanged once for a clearance cookie, and mints inside
 * that window present the cookie instead. This is the same shape as
 * Cloudflare's own `cf_clearance`, for the same reason.
 *
 * What keeps it from being a hole:
 *
 * - It is HMAC'd with `TICKET_SECRET`, so it cannot be forged without the
 *   secret that already protects everything else.
 * - It is bound to `ip_hash`, so a stolen cookie is worthless from another
 *   address — the same binding the ticket itself uses.
 * - It expires in 15 minutes, long enough for a download and short enough that
 *   a solve cannot be farmed into an afternoon of automation.
 * - It is `httpOnly` and `SameSite=Strict`, so script on another origin can
 *   neither read it nor cause it to be sent.
 *
 * The honest limit: within the window, one solve buys as many resolves as the
 * per-IP quota allows. That is deliberate. The quota is the spend control and
 * always was; Turnstile is there to make automation expensive, not to be the
 * thing standing between an attacker and the bill.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const CLEARANCE_COOKIE = "dl_clearance";

/** How long the cookie survives without being used. Slides on every use. */
export const CLEARANCE_TTL_S = 15 * 60;

/**
 * How long one solve can be stretched by continuous use, no matter what.
 *
 * The idle window has to slide, or a long mux expires the cookie in the middle
 * of a download the visitor is actively waiting for. But sliding alone means a
 * client that keeps polling never has to prove anything again, and one solve
 * becomes a permanent key. Two hours is far longer than any legitimate session
 * here and far shorter than a useful stolen credential.
 */
export const CLEARANCE_MAX_LIFETIME_S = 2 * 60 * 60;

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

interface ClearancePayload {
  /** Ties the cookie to the address that solved the challenge. */
  ip_hash: string;
  /** Unix seconds. Idle expiry; moves forward each time the cookie is used. */
  exp: number;
  /** Unix seconds. When the original challenge was solved. Never moves. */
  iat: number;
}

/**
 * Issues a cookie, carrying forward the original solve time when there is one.
 *
 * `solvedAt` is what makes the absolute cap real: a reissue that forgot it would
 * reset the clock, and the sliding window would have no ceiling at all.
 */
export function mintClearance(
  ipHash: string,
  secret: string,
  now: number = Date.now(),
  solvedAt?: number
): string {
  const nowS = Math.floor(now / 1000);
  const payload: ClearancePayload = {
    ip_hash: ipHash,
    exp: nowS + CLEARANCE_TTL_S,
    iat: solvedAt ?? nowS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/**
 * True only for a cookie this server signed, for this address, still in date.
 *
 * Returns a boolean rather than the payload on purpose: nothing downstream
 * needs to know anything about the cookie beyond whether to trust it, and a
 * function that hands back parsed attacker-supplied data invites someone to
 * start using them.
 */
/** The solve time inside a cookie, or null when it does not carry one. */
export function clearanceSolvedAt(
  cookie: string | undefined,
  secret: string
): number | null {
  const parsed = parseTrusted(cookie, secret);
  return parsed && typeof parsed.iat === "number" ? parsed.iat : null;
}

function parseTrusted(
  cookie: string | undefined,
  secret: string
): ClearancePayload | null {
  if (!cookie) return null;

  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return null;

  const payloadB64 = cookie.slice(0, dot);
  const providedSig = cookie.slice(dot + 1);
  const expectedSig = sign(payloadB64, secret);

  // Compare before parsing. Anything below this line is trusted input only
  // because the signature already proved it came from here.
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function clearanceValid(
  cookie: string | undefined,
  ipHash: string,
  secret: string,
  now: number = Date.now()
): boolean {
  const payload = parseTrusted(cookie, secret);
  if (!payload) return false;

  if (typeof payload.exp !== "number" || typeof payload.ip_hash !== "string") {
    return false;
  }

  const nowS = Math.floor(now / 1000);
  if (payload.exp <= nowS) return false;

  // The absolute cap. A cookie with no `iat` predates this field and is refused
  // rather than grandfathered: an un-capped clearance is exactly what the cap
  // exists to prevent, and reissuing one costs a single silent challenge.
  if (typeof payload.iat !== "number") return false;
  if (nowS - payload.iat >= CLEARANCE_MAX_LIFETIME_S) return false;

  // A cookie carried to a different address is not this visitor's clearance.
  const want = Buffer.from(payload.ip_hash);
  const have = Buffer.from(ipHash);
  return want.length === have.length && timingSafeEqual(want, have);
}

/** The `Set-Cookie` value. `httpOnly` so no script can lift it. */
export function clearanceCookieHeader(value: string, secure: boolean): string {
  return [
    `${CLEARANCE_COOKIE}=${value}`,
    "Path=/api/tools/download-ticket",
    `Max-Age=${CLEARANCE_TTL_S}`,
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
