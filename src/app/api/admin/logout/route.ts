import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, LEGACY_ADMIN_COOKIE } from '@/lib/auth/admin';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_COOKIE);
    // Also clear the old cookie, which held the password in plaintext. Anyone
    // logged in before this change is carrying one.
    cookieStore.delete(LEGACY_ADMIN_COOKIE);

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
