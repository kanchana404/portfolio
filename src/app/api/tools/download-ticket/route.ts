/**
 * Mints short-lived, IP-bound tickets for the downloader service.
 *
 * This is the only place in the web app that holds `DOWNLOADER_TICKET_SECRET`,
 * and it is the seam between "a visitor is on our page" and "a request the
 * downloader will accept". The browser calls this, gets a ticket, then talks to
 * the Railway service directly — Vercel never proxies the media, so a 200 MB
 * download costs this project nothing.
 *
 * ## Byte-compatibility contract with the downloader service
 *
 * The verifier lives in a SEPARATE REPOSITORY (`downloader-api`), at
 * `app/security/tickets.py`. Nothing enforces agreement across that boundary at
 * build time — no shared types, no shared tests — so treat the format below as
 * a wire protocol and change both sides together or neither.
 *
 *   ticket  = base64url(payloadJson) + "." + base64url(hmacSha256(secret, payloadB64))
 *   payload = {"jti":<32 hex>,"aud":"downloader","exp":<unix s>,"ip_hash":<16 hex>}
 *   ip_hash = sha256(ip + IP_SALT) hex, first 16 chars
 *   base64url is UNPADDED, "-" and "_"
 *
 * Three details break this silently if you change them:
 *  1. The MAC covers the base64url TEXT of the payload, not the JSON bytes. Sign
 *     exactly the string that goes before the ".".
 *  2. Key order is jti, aud, exp, ip_hash — matching Python's `json.dumps` with
 *     `separators=(",", ":")`. Verification does not strictly require it, but a
 *     divergence here is how two implementations start drifting apart.
 *  3. `exp` is UNIX SECONDS. `Date.now()` is milliseconds.
 *
 * ## Why the IP binding matters
 *
 * The ticket is useless from any address other than the one that requested it,
 * so a ticket scraped out of devtools cannot be replayed from a bot farm. The
 * value is derived from the header Vercel sets itself, which the visitor cannot
 * forge. The cost is that visitors on rotating egress (some VPNs, mobile CGNAT)
 * occasionally see a 401 and have to retry — an acceptable trade.
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * These must never carry the `NEXT_PUBLIC_` prefix. Next.js inlines any env var
 * with that prefix into the client bundle, and `DOWNLOADER_TICKET_SECRET` is a
 * symmetric HMAC key: anyone holding it can mint valid tickets for any IP hash,
 * forever, without ever loading the site. Publishing it would not weaken the
 * protection, it would delete it — silently, because every forged request would
 * still look legitimate to the downloader.
 */
const TICKET_SECRET = process.env.DOWNLOADER_TICKET_SECRET ?? "";
const IP_SALT = process.env.DOWNLOADER_IP_SALT ?? "";
const TURNSTILE_SECRET = process.env.DOWNLOADER_TURNSTILE_SECRET ?? "";

const TICKET_AUDIENCE = "downloader";
const TICKET_TTL_S = 120;
const IP_HASH_LEN = 16;
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TicketPayload {
  jti: string;
  aud: string;
  exp: number;
  ip_hash: string;
}

/** Unpadded base64url over raw bytes. */
function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Canonicalise an address so both sides of the ticket hash the same string.
 *
 * MEASURED 2026-08-12: the same browser on the same loopback connection was
 * reported as `::ffff:127.0.0.1` here (Node) and as `127.0.0.1` by uvicorn. Two
 * spellings of one address, two digests, every ticket rejected as `ip_mismatch`.
 * Any dual-stack listener or proxy can produce that split in production too,
 * where the symptom is a service that is 100% broken behind an unhelpful 401.
 *
 * Must stay byte-identical to `normalise_ip` in the downloader repo's
 * `app/security/quotas.py`.
 */
function normaliseIp(ip: string): string {
  let cleaned = ip.trim().toLowerCase();
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith("::ffff:")) {
    const candidate = cleaned.slice(7);
    const parts = candidate.split(".");
    // Only unwrap a real dotted-quad; "::ffff:1.2" is not one and is left be.
    if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
      cleaned = candidate;
    }
  }
  return cleaned;
}

/** sha256(normaliseIp(ip) + IP_SALT), hex, truncated — identical to quotas.hash_ip. */
async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${normaliseIp(ip)}${IP_SALT}`)
  );
  return toHex(digest).slice(0, IP_HASH_LEN);
}

async function hmacSha256(secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
}

/**
 * The client IP as the edge observed it.
 *
 * Vercel sets `x-forwarded-for` itself and the leftmost entry is the true
 * client — a header the visitor sends is replaced, not appended to. That is
 * what makes the binding worth anything: the value comes from a point the
 * client does not control.
 *
 * This must agree with what the downloader sees. The service reads
 * `CF-Connecting-IP` first (Cloudflare sits in front of Railway and sets it to
 * the real client address), so both sides hash the same end-user IP.
 */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() ?? "";
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  // Optional by design: the downloader itself only enforces Turnstile on the
  // expensive endpoint (`POST /v1/jobs`) and only when a secret is configured.
  // Requiring it here before it is set up would make every tool page dead.
  if (!TURNSTILE_SECRET) return true;
  if (!token) return false;

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
      // Fail closed on a slow Cloudflare rather than hanging the request.
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

async function mintTicket(ip: string): Promise<string> {
  const payload: TicketPayload = {
    jti: crypto.randomUUID().replace(/-/g, ""),
    aud: TICKET_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + TICKET_TTL_S,
    ip_hash: await hashIp(ip),
  };
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = base64url(await hmacSha256(TICKET_SECRET, payloadB64));
  return `${payloadB64}.${signature}`;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!TICKET_SECRET || !IP_SALT) {
    // Refuse rather than emit a ticket the downloader will reject two hops away
    // with an error the user cannot act on.
    console.error("download-ticket: DOWNLOADER_TICKET_SECRET or DOWNLOADER_IP_SALT is unset");
    return json({ error: "misconfigured" }, 503);
  }

  let token = "";
  try {
    const body = (await request.json()) as { turnstileToken?: unknown };
    token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  } catch {
    // No body is fine when Turnstile is not configured.
  }

  const ip = clientIp(request);
  if (!(await verifyTurnstile(token, ip))) {
    return json({ error: "turnstile_failed" }, 403);
  }

  return json(
    { ticket: await mintTicket(ip), expiresIn: TICKET_TTL_S },
    200,
    // Single-use and IP-bound: a cached copy is useless at best, and at worst
    // served to a second visitor from behind a shared cache.
    { "cache-control": "no-store, private" }
  );
}
