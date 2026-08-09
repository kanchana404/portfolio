import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdminRequest } from '@/lib/auth/admin';

/**
 * Page-level gate for the admin area.
 *
 * This is **defence in depth, not the authorisation boundary**. The real guard
 * is `requireAdmin()` inside each privileged route handler, because this
 * middleware's matcher cannot protect the admin API: those routes live under
 * `/api/admin/*`, which does not start with `/admin`, so the previous version of
 * this file never ran on them at all. Every mutating admin endpoint was open to
 * the internet as a result.
 *
 * Keep both. If a future route is added under `/admin` and someone forgets the
 * handler guard, this still redirects; if the matcher is wrong again, the
 * handler guard still denies.
 */
export async function middleware(request: NextRequest) {
  if (await isAdminRequest(request)) return NextResponse.next();

  // Fails closed. The previous version returned `NextResponse.next()` when
  // ADMIN_PASSWORD was unset — commented "for development", but middleware runs
  // in production too, so a missing environment variable silently unlocked the
  // admin area rather than locking it.
  const loginUrl = new URL('/admin/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/admin',
    // Everything under /admin except the login page itself, which must stay
    // reachable while logged out.
    '/admin/((?!login).*)',
  ],
};
