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
 * ## The cookie no longer carries the password
 *
 * It used to store `ADMIN_PASSWORD` verbatim. It now stores a digest derived
 * from it, so the secret itself is never written to a cookie jar, a proxy log or
 * an error report. This is not a session system — there is no server-side store
 * and no revocation beyond changing the password, which is the correct amount of
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

const TOKEN_CONTEXT = "admin-session-v1";

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

/** The value the session cookie should hold, or null if admin access is unconfigured. */
export async function expectedSessionToken(): Promise<string | null> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  const digest = await sha256(`${TOKEN_CONTEXT}:${secret}`);
  return Array.from(digest)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
  const expected = await expectedSessionToken();
  if (!expected) return false;
  const presented = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!presented) return false;
  return constantTimeEquals(presented, expected);
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
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
