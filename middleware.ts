import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessPath } from '@/app/lib/accessControl';

// Route publik — tidak perlu login (prefix match)
const PUBLIC_PREFIXES = ['/login', '/daftar', '/lupa-password', '/reset-password'];

// Route API — selalu bypass middleware auth (gunakan token di header)
const API_ROUTES = ['/api/'];

// Static & internal paths — jangan redirect ke login
const STATIC_PATHS = ['/_next/', '/manifest.json', '/icon.svg', '/sw.js', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Biarkan static files & Next.js internal paths lolos
  if (STATIC_PATHS.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Biarkan API routes lolos
  if (API_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Biarkan public routes lolos
  if (PUBLIC_PREFIXES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Cek token dari cookie (simulasi — ganti dengan verifikasi JWT nanti)
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // Redirect ke login jika belum login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Cek role (ketat): user hanya bisa buka modul sesuai rolenya ──
  const rolesCookie = request.cookies.get('user_roles')?.value || request.cookies.get('user_role')?.value || '';
  const roles = rolesCookie.split(',').map(r => r.trim()).filter(Boolean);
  if (!canAccessPath(roles, pathname)) {
    const home = new URL('/', request.url);
    home.searchParams.set('denied', pathname);
    return NextResponse.redirect(home);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)'],
};
