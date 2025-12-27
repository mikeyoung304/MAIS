import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Next.js Middleware for Custom Domain Resolution and Auth
 *
 * This middleware handles:
 * 1. Custom domain routing (e.g., janephotography.com → /t/jane-photography)
 * 2. NextAuth.js session-based authentication
 * 3. Protected route redirection
 *
 * NOTE: Custom domains require Vercel Pro account ($20/mo)
 * See: docs/operations/VERCEL_CUSTOM_DOMAINS.md
 */

// Known MAIS domains that should use normal routing
const KNOWN_DOMAINS = [
  'maconaisolutions.com',
  'www.maconaisolutions.com',
  'app.maconaisolutions.com',
  'vercel.app',
  'localhost',
];

// Routes that require authentication
const PROTECTED_ROUTES = ['/tenant', '/admin'];

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // ===== CUSTOM DOMAIN RESOLUTION =====
  // Check if this is a custom domain (not a known MAIS domain)
  const isKnownDomain = KNOWN_DOMAINS.some(
    (domain) => hostname.includes(domain) || hostname.startsWith('localhost')
  );

  if (!isKnownDomain) {
    // This is a custom domain - rewrite to tenant route
    // The tenant lookup will happen in the page component
    const url = request.nextUrl.clone();

    // Preserve the path for the tenant site
    // e.g., janephotography.com/about → /t/_domain/about
    const tenantPath = pathname === '/' ? '' : pathname;
    url.pathname = `/t/_domain${tenantPath}`;
    url.searchParams.set('domain', hostname);

    return NextResponse.rewrite(url);
  }

  // ===== AUTHENTICATION CHECK =====
  // Check if this is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  // Get session from NextAuth
  const session = request.auth;

  if (isProtectedRoute && !session) {
    // Redirect to login if not authenticated
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For admin routes, verify admin role
  if (pathname.startsWith('/admin') && session) {
    const role = session.user?.role;
    const isImpersonating = !!session.user?.impersonation;

    // Only allow platform admins (not impersonating)
    if (role !== 'PLATFORM_ADMIN' || isImpersonating) {
      // Redirect to tenant dashboard
      return NextResponse.redirect(new URL('/tenant/dashboard', request.url));
    }
  }

  // ===== CONTINUE NORMALLY =====
  return NextResponse.next();
});

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
