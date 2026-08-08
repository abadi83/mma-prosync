import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Route publik — tidak perlu login (prefix match)
const PUBLIC_PREFIXES = ['/login', '/daftar', '/lupa-password', '/reset-password'];

// Route API — selalu bypass middleware auth (gunakan token di header)
const API_ROUTES = ['/api/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Biarkan API routes lolos (auth di-handle oleh endpoint masing-masing)
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)'],
};
