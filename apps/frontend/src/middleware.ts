import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('artemis_auth_token')?.value;
  const role = request.cookies.get('artemis_auth_role')?.value;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isAdminPage = pathname.startsWith('/admin');

  // Si tiene sesión activa e intenta ir a login o register -> redirigir al inicio
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Si intenta acceder a /admin sin rol ADMIN
  if (isAdminPage) {
    if (!token) {
      const returnUrl = encodeURIComponent(pathname);
      return NextResponse.redirect(new URL(`/login?returnUrl=${returnUrl}`, request.url));
    }
    if (role && role !== 'ADMIN') {
      // Redirigir al inicio con advertencia de acceso denegado
      return NextResponse.redirect(new URL('/?access_denied=true', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/register', '/admin/:path*'],
};

