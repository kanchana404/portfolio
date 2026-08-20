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

/** Long enough to finish a download, short enough that a solve is not a licence. */
export const CLEARANCE_TTL_S = 15 * 60;

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

interface ClearancePayload {
  /** Ties the cookie to the address that solved the challenge. */
  ip_hash: string;
  /** Unix seconds. */
  exp: number;
}

export function mintClearance(
  ipHash: string,
  secret: string,
  now: number = Date.now()
): string {
  const payload: ClearancePayload = {
    ip_hash: ipHash,
    exp: Math.floor(now / 1000) + CLEARANCE_TTL_S,
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
export function clearanceValid(
  cookie: string | undefined,
  ipHash: string,
  secret: string,
  now: number = Date.now()
): boolean {
  if (!cookie) return false;

  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return false;

  const payloadB64 = cookie.slice(0, dot);
  const providedSig = cookie.slice(dot + 1);
  const expectedSig = sign(payloadB64, secret);

  // Compare before parsing. Anything below this line is trusted input only
  // because the signature already proved it came from here.
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  let payload: ClearancePayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  if (typeof payload.exp !== "number" || typeof payload.ip_hash !== "string") {
    return false;
  }
  if (payload.exp <= Math.floor(now / 1000)) return false;

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
