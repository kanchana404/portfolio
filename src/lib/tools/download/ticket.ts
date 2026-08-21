/**
 * Minting download tickets, byte-compatible with the downloader service.
 *
 * The wire format is a shared protocol between two programs in two languages in
 * two repositories, and `downloader-api/app/security/tickets.py` is the
 * authority: it is the code that actually verifies, so a disagreement is
 * measured against it, not negotiated with it.
 *
 *     ticket  = base64url(payloadJson) + "." + base64url(hmacSha256(secret, payloadB64))
 *     payload = {"jti":<32 hex>,"aud":"downloader","exp":<unix s>,"ip_hash":<16 hex>}
 *
 * Four details are load-bearing, and each has a specific failure mode:
 *
 * 1. **The MAC covers the base64url *text* of the payload**, not the JSON bytes.
 *    That removes any dependence on two languages serialising JSON identically,
 *    and means the verifier never re-encodes attacker-controlled data before
 *    checking it. Sign exactly the string that goes before the dot.
 * 2. **`exp` is UNIX seconds.** `Date.now()` is milliseconds. Forgetting the
 *    divide mints tickets valid until the year 57000, which the verifier
 *    rejects outright as `ticket_expired` rather than honouring.
 * 3. **base64url is unpadded** and uses `-` and `_`. Node's `base64url`
 *    encoding already does this; `base64` does not.
 * 4. **The IP is normalised before hashing.** Measured on 2026-08-12: the same
 *    loopback connection was `::ffff:127.0.0.1` to Node and `127.0.0.1` to
 *    uvicorn. Two spellings, two digests, every ticket rejected. Any dual-stack
 *    hop can do the same in production, where the symptom is a service that is
 *    100% broken behind a 401 that explains nothing.
 *
 * `src/lib/tools/download/ticket.test.ts` mints with this code and verifies
 * with the real Python verifier, so drift fails the build rather than the site.
 */

import {
  TICKET_AUDIENCE,
  TICKET_HEADER,
  TICKET_TTL_S,
} from "./protocol";
import { createHmac, createHash, randomBytes } from "node:crypto";

/** Matches TICKET_TTL_S. The verifier refuses anything over 300 + skew. */
const IP_HASH_LEN = 16;

function b64url(raw: Buffer): string {
  return raw.toString("base64url");
}

/**
 * Canonicalise an address so both sides hash the same string.
 *
 * Must stay byte-identical to `normalise_ip` in
 * `downloader-api/app/security/quotas.py`: trim, lowercase, strip brackets from
 * a bracketed IPv6 literal, and strip a leading `::ffff:` only when what
 * follows is a real dotted quad.
 */
export function normaliseIp(ip: string): string {
  let cleaned = ip.trim().toLowerCase();
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith("::ffff:")) {
    const candidate = cleaned.slice(7);
    const parts = candidate.split(".");
    // "::ffff:1.2" is not a dotted quad and is left alone.
    if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
      cleaned = candidate;
    }
  }
  return cleaned;
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256")
    .update(`${normaliseIp(ip)}${salt}`, "utf8")
    .digest("hex")
    .slice(0, IP_HASH_LEN);
}

export interface MintOptions {
  ip: string;
  secret: string;
  salt: string;
  ttlSeconds?: number;
  /** Injected in tests so the payload is reproducible. */
  now?: number;
  jti?: string;
}

export function mintTicket({
  ip,
  secret,
  salt,
  ttlSeconds = TICKET_TTL_S,
  now,
  jti,
}: MintOptions): string {
  const issued = now ?? Math.floor(Date.now() / 1000);

  // Key order matches the Python minter: jti, aud, exp, ip_hash. Verification
  // does not depend on it, since the MAC covers the encoded text, but a
  // divergence here is how two implementations start drifting apart.
  const payload = {
    jti: jti ?? randomBytes(16).toString("hex"),
    aud: TICKET_AUDIENCE,
    exp: issued + ttlSeconds,
    ip_hash: hashIp(ip, salt),
  };

  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = createHmac("sha256", secret).update(payloadB64, "ascii").digest();
  return `${payloadB64}.${b64url(mac)}`;
}

/**
 * The client address, matching `client_ip` in the verifier.
 *
 * The rightmost meaningful entry of X-Forwarded-For, not the leftmost: the
 * leftmost is whatever the client claimed. Cloudflare's own header wins when
 * present because it cannot be spoofed past Cloudflare.
 */
export function clientIpFrom(headers: Headers): string {
  // `cf-connecting-ip` is deliberately not consulted.
  //
  // It is only the true client address, and only unforgeable, when Cloudflare
  // is actually in front and has stripped the caller's copy. Neither this
  // deployment nor the downloader service is behind Cloudflare, so nothing on
  // the path strips it and it is simply a string the caller chose.
  //
  // Reading it was a measured hole rather than a theoretical one. Because both
  // this route and the service consulted it first, a caller could present one
  // fabricated address to both, watch them agree, and receive a ticket bound to
  // a per-IP quota bucket of their own choosing — then increment and repeat, so
  // the daily caps stopped being caps. Verified against the deployed service on
  // 2026-08-21: a ticket minted for 198.51.100.7 and presented with
  // `CF-Connecting-IP: 198.51.100.7` was accepted, while the same attempt
  // through `x-forwarded-for` was refused.
  //
  // If this site is ever put behind Cloudflare, the header becomes trustworthy
  // again — but only alongside an edge-proof check, the way
  // `downloader-api/app/security/origin.py` does it. Restoring the old
  // unconditional read would restore the hole.

  // RIGHTMOST entry here, LEFTMOST in app/security/tickets.py — deliberately.
  //
  // The goal is not that the two files run the same rule. It is that both
  // arrive at the same value: the visitor's address. The rule that achieves
  // that depends on what each platform does to the header, and they differ.
  //
  // MEASURED 2026-08-21. Railway APPENDS its own proxy, so its header reads
  // "112.134.221.2, 152.233.68.97" and the client is the FIRST entry. Vercel
  // does not append, so the client is the last entry here — which is the same
  // as the first, and is the value this side has always produced correctly.
  //
  // Making the service "match" this file by switching it to the rightmost entry
  // broke everything: the service started hashing Railway's proxy instead of the
  // visitor, every ip_hash stopped matching, and the resulting mismatch looked
  // so much like two real addresses that it was misdiagnosed as a CGNAT pool.
  // Symmetry of rule is not the invariant. Equality of derived value is.
  const forwarded = headers.get("x-forwarded-for") ?? "";
  const parts = forwarded
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 0) return parts[parts.length - 1];

  return headers.get("x-real-ip")?.trim() ?? "";
}

export { TICKET_AUDIENCE, TICKET_HEADER, TICKET_TTL_S };
