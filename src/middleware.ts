import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TOOLS_SECTION_LIVE } from '@/lib/tools/section-flag';

/**
 * ## The retired /tools section
 *
 * A static decision that must not depend on a cookie read. See
 * `@/lib/tools/section-flag` for why the section is dark and why the response
 * is 410 rather than a 404 or a redirect.
 *
 * The admin gate that used to share this file was removed together with the
 * admin area, so nothing is left to protect.
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Note the early `return` on the live path as well as the retired one. Both
  // branches must terminate.
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    // The retired section: the hub itself and every tool and category beneath
    // it. Harmless to match while the flag is on — the branch above no-ops.
    '/tools',
    '/tools/:path*',
  ],
};
