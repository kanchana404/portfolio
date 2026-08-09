import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_OPTIONS,
  LEGACY_ADMIN_COOKIE,
  expectedSessionToken,
  verifyPassword,
} from '@/lib/auth/admin';

/**
 * Two things changed here, both of which were holes rather than rough edges.
 *
 * 1. `const expectedPassword = correctPassword || 'admin123'` — with
 *    ADMIN_PASSWORD unset in any environment, the admin area accepted a
 *    hardcoded password that is in this file's git history forever. Now an
 *    unconfigured deployment refuses every login instead.
 * 2. The cookie stored the password verbatim. It now stores a digest derived
 *    from it, so the secret is never written to a cookie jar or a proxy log.
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const password =
      typeof body === 'object' && body !== null
        ? (body as { password?: unknown }).password
        : undefined;

    const token = await expectedSessionToken();
    if (!token) {
      console.error('ADMIN_PASSWORD is not set — refusing all admin logins.');
      return NextResponse.json(
        { error: 'Admin access is not configured on this deployment.' },
        { status: 503 }
      );
    }

    if (!(await verifyPassword(password))) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE, token, ADMIN_COOKIE_OPTIONS);
    // Retire any cookie left over from the version that stored the password.
    cookieStore.delete(LEGACY_ADMIN_COOKIE);

    return NextResponse.json({ message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
