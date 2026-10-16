import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessPath } from '@/app/lib/accessControl';
import { AUTH_COOKIE, verifyAuthToken } from '@/app/lib/authToken';

// Route publik — tidak perlu login (prefix match)
const PUBLIC_PREFIXES = ['/login', '/daftar', '/lupa-password', '/reset-password'];

// API publik — satu-satunya API yang boleh diakses tanpa token
const PUBLIC_API_PREFIXES = ['/api/login', '/api/register', '/api/lupa-password', '/api/reset-password'];

// Static & internal paths — jangan redirect ke login
const STATIC_PATHS = ['/_next/', '/manifest.json', '/icon.svg', '/sw.js', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Biarkan static files & Next.js internal paths lolos
  if (STATIC_PATHS.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // ── API: wajib token valid (kecuali endpoint publik auth flow) ──
  if (pathname.startsWith('/api/')) {
    const isPublic = PUBLIC_API_PREFIXES.some((r) => pathname === r || pathname.startsWith(r + '/'));
    if (isPublic) return NextResponse.next();

    const token = request.cookies.get(AUTH_COOKIE)?.value;
    if (!verifyAuthToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Biarkan public routes lolos
  if (PUBLIC_PREFIXES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // ── Halaman: token wajib valid (bukan sekadar cookie ada) ──
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const payload = verifyAuthToken(token);
  if (!payload) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(loginUrl);
    // Bersihkan cookie stale biar tidak redirect-loop
    res.cookies.delete(AUTH_COOKIE);
    res.cookies.delete('user_name');
    res.cookies.delete('user_role');
    res.cookies.delete('user_roles');
    res.cookies.delete('user_pegawai_id');
    return res;
  }

  // ── Cek role (dari token terverifikasi, bukan cookie yang bisa dipalsukan) ──
  const roles = Array.isArray(payload.roles) && payload.roles.length > 0 ? payload.roles : [payload.role];
  if (!canAccessPath(roles, pathname)) {
    const home = new URL('/', request.url);
    home.searchParams.set('denied', pathname);
    return NextResponse.redirect(home);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)'],
};
