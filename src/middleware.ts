import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the request is for admin routes (excluding login and API routes)
  if (request.nextUrl.pathname.startsWith('/admin') && 
      !request.nextUrl.pathname.startsWith('/admin/login') &&
      !request.nextUrl.pathname.startsWith('/admin/api')) {
    
    // Check for admin password in cookies
    const adminPassword = request.cookies.get('admin-password')?.value;
    const correctPassword = process.env.ADMIN_PASSWORD;

    // If no password is set in env, allow access (for development)
    if (!correctPassword) {
      return NextResponse.next();
    }

    // If password doesn't match, redirect to login
    if (adminPassword !== correctPassword) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/((?!login|api).*)',
  ],
}; 