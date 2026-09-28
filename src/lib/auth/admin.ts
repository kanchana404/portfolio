import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Admin authorisation.
 *
 * ## Why this module exists
 *
 * Authorisation used to live entirely in `src/middleware.ts`, whose matcher is
 * `/admin` and `/admin/((?!login|api).*)`. The admin API is served from
 * **`/api/admin/*`**, which does not start with `/admin` — so the middleware
 * never ran on it, and `POST /api/admin/blogs`, `PUT|DELETE
 * /api/admin/blogs/[id]` and `POST /api/admin/generate-image` were reachable by
 * any anonymous request on the public internet.
 *
 * A matcher that looks right and does not match is not a thing code review
 * catches reliably, so the guard now lives *in the route handlers* where the
 * privileged work happens. Middleware still runs, but only as defence in depth
 * for the page routes; it is no longer the thing standing between an attacker
 * and the database.
 *
 * ## Fail closed
 *
 * Every path here denies when `ADMIN_PASSWORD` is unset. The previous code did
 * the opposite in two separate places: middleware returned `NextResponse.next()`
 * ("allow access, for development") and the login route fell back to a hardcoded
 * `'admin123'`. An environment variable that goes missing during a deploy should
 * lock the door, not remove it.
 *
 * ## The cookie carries a signed, expiring token
 *
 * It once stored `ADMIN_PASSWORD` verbatim, then a fixed digest of it: the same
 * value for every session, with no server-side expiry, so a leaked cookie
 * worked until the password changed and could be brute-forced offline to
 * recover the password. It now holds `v2.<issuedAt>.<HMAC-SHA256(key,
 * issuedAt)>`, where the key comes from `ADMIN_SESSION_SECRET` (or, if that is
 * unset, from the password). The server rejects it after SESSION_MAX_AGE_S
 * whatever the cookie's own expiry says, and changing either secret signs
 * every session out. Still not a session store, which is the right amount of
 * machinery for a single-operator blog admin.
 *
 * ## Runtime
 *
 * Web Crypto only, no `node:crypto`. Middleware runs on the Edge runtime where
 * `node:crypto` is unavailable, and this module is imported from both sides.
 */

/**
 * Renamed from `admin-password`, which described its old contents accurately.
 * `clearAdminCookies` deletes both so existing sessions do not linger with a
 * cookie holding the real password.
 */
export const ADMIN_COOKIE = "admin-session";
export const LEGACY_ADMIN_COOKIE = "admin-password";

const TOKEN_VERSION = "v2";
/** Seven days; enforced from the token's own timestamp, not the cookie. */
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return new Uint8Array(digest);
}

/**
 * Compare two strings without leaking their contents through timing.
 *
 * Both sides are hashed first, so the comparison always runs over 32 bytes and
 * the loop count reveals nothing about the length of either input. A plain `===`
 * on secrets short-circuits at the first differing byte, which is measurable
 * over enough requests.
 */
export async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** True when admin login can work on this deployment. */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(message: string): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  const secret = process.env.ADMIN_SESSION_SECRET || `password:${password}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`admin-session-${TOKEN_VERSION}:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(new Uint8Array(mac));
}

/** A fresh session token, or null if admin access is unconfigured. */
export async function issueSessionToken(now: number = Date.now()): Promise<string | null> {
  const issuedAt = String(Math.floor(now / 1000));
  const mac = await sign(`${TOKEN_VERSION}.${issuedAt}`);
  return mac ? `${TOKEN_VERSION}.${issuedAt}.${mac}` : null;
}

/** True for a token this deployment signed that has not expired. */
export async function verifySessionToken(
  token: string | undefined,
  now: number = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const [version, issuedAt, mac] = token.split(".");
  if (version !== TOKEN_VERSION || !issuedAt || !mac || !/^\d+$/.test(issuedAt)) return false;
  const age = Math.floor(now / 1000) - Number(issuedAt);
  if (age < 0 || age > SESSION_MAX_AGE_S) return false;
  const expected = await sign(`${version}.${issuedAt}`);
  if (!expected) return false;
  return constantTimeEquals(mac, expected);
}

/** True when the submitted password matches. Constant-time, fails closed. */
export async function verifyPassword(submitted: unknown): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  if (typeof submitted !== "string" || submitted.length === 0) return false;
  return constantTimeEquals(submitted, secret);
}

/** True when the request carries a valid admin session cookie. */
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  return verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};

/**
 * Guard for a privileged route handler.
 *
 * Returns a response to send when the caller is not authorised, or `null` to
 * continue. Written this way so a handler reads:
 *
 * ```ts
 * const denied = await requireAdmin(request);
 * if (denied) return denied;
 * ```
 *
 * which is one line, hard to get subtly wrong, and greppable — see
 * `src/app/api/admin/route-guards.test.ts`, which fails the build if any
 * mutating handler under `/api/admin` is missing it.
 */
export async function requireAdmin(
  request: NextRequest
): Promise<NextResponse | null> {
  if (await isAdminRequest(request)) return null;

  // Deliberately identical for "not configured", "no cookie" and "wrong cookie".
  // Distinguishing them tells an attacker which wall they hit.
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
