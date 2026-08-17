import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdminRequest } from '@/lib/auth/admin';
import { TOOLS_SECTION_LIVE } from '@/lib/tools/section-flag';

/**
 * Two unrelated jobs share this file because Next.js allows exactly one
 * middleware per app. They are kept in separate branches and the matcher below
 * is the union of their paths.
 *
 * ## 1. The retired /tools section
 *
 * Answered first, and deliberately before any auth work: it is a static
 * decision that must not depend on a cookie read. See
 * `@/lib/tools/section-flag` for why the section is dark and why the response
 * is 410 rather than a 404 or a redirect.
 *
 * ## 2. The admin gate
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

const GONE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>This tool has been retired</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:2rem;
         font:16px/1.6 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
         background:#fbfaf7; color:#1c1a24; }
  @media (prefers-color-scheme: dark) { body { background:#16151c; color:#eeebf2; } }
  main { max-width:32rem; text-align:center; }
  h1 { font-size:1.5rem; letter-spacing:-.02em; margin:0 0 .75rem; }
  p { margin:0 0 1.5rem; opacity:.75; }
  a { color:inherit; }
</style>
</head>
<body>
<main>
  <h1>This tool has been retired</h1>
  <p>The tools section is being rebuilt. Nothing here is coming back at this address.</p>
  <p><a href="/">Go to the homepage</a></p>
</main>
</body>
</html>
`;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Note the early `return` on the live path as well as the retired one. Both
  // branches must terminate: the matcher covers /tools *and* /admin, so falling
  // through here sends every tool request into the admin gate below and
  // redirects the visitor to a login page. That is exactly what happened the
  // first time this ran with the flag on.
  if (pathname === '/tools' || pathname.startsWith('/tools/')) {
    if (TOOLS_SECTION_LIVE) return NextResponse.next();

    return new NextResponse(GONE_PAGE, {
      status: 410,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Crawlers should not cache a 410 aggressively — when the section comes
        // back, the flag flip should be visible on the next crawl.
        'Cache-Control': 'public, max-age=0, s-maxage=3600',
        'X-Robots-Tag': 'noindex',
      },
    });
  }

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
    // The retired section: the hub itself and every tool and category beneath
    // it. Harmless to match while the flag is on — the branch above no-ops.
    '/tools',
    '/tools/:path*',
  ],
};
