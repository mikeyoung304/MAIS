import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Next.js Middleware for Custom Domain Resolution, Redirects, and Auth
 *
 * This middleware handles:
 * 1. Custom domain routing (e.g., janephotography.com → /t/jane-photography)
 * 2. Legacy URL redirects (Squarespace → HANDLED 301 redirects)
 * 3. NextAuth.js session-based authentication
 * 4. Protected route redirection
 *
 * NOTE: Custom domains require Vercel Pro account ($20/mo)
 * See: docs/operations/VERCEL_CUSTOM_DOMAINS.md
 */

// Known HANDLED domains that should use normal routing
const KNOWN_DOMAINS = [
  'gethandled.ai',
  'www.gethandled.ai',
  'app.gethandled.ai',
  'vercel.app',
  'localhost',
  // Legacy domains that redirect to gethandled.ai (handled by next.config.js redirects)
  'maconaisolutions.com',
  'www.maconaisolutions.com',
];

// Routes that require authentication
const PROTECTED_ROUTES = ['/tenant', '/admin'];

/**
 * Redirect mappings for Squarespace/legacy migrations.
 *
 * Structure: Map of domain → Map of old path → new path
 * These are permanent 301 redirects for SEO preservation.
 *
 * Example:
 * 'maconheadshots.com' → {
 *   '/book-online' → '/services',
 *   '/gallery-1' → '/gallery',
 *   '/pricing' → '/services',
 * }
 *
 * TODO: In production, load these from database or Vercel Edge Config
 * for dynamic updates without redeployment.
 *
 * @see https://vercel.com/docs/edge-config
 */
const LEGACY_REDIRECTS: Map<string, Map<string, string>> = new Map([
  // Example: maconheadshots.com migration from Squarespace
  // Uncomment and customize when migrating clients:
  // ['maconheadshots.com', new Map([
  //   ['/book-online', '/services'],
  //   ['/gallery-1', '/gallery'],
  //   ['/gallery-2', '/gallery'],
  //   ['/about-1', '/about'],
  //   ['/pricing', '/services'],
  //   ['/contact-1', '/contact'],
  //   ['/faq-1', '/faq'],
  // ])],
]);

/**
 * Validate that a redirect target is a safe relative path.
 * Rejects absolute URLs, protocol-relative URLs, and invalid characters.
 *
 * SECURITY: Prevents open redirect attacks when redirect map is loaded from external source.
 */
function isRelativePath(path: string): boolean {
  // Must start with /
  if (!path.startsWith('/')) return false;

  // Reject protocol-relative URLs (//example.com)
  if (path.startsWith('//')) return false;

  // Reject URLs with protocols (https://, javascript:, data:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return false;

  // Validate path contains only safe characters
  // Allow: letters, numbers, /, -, _, ., ~, ?, #, &, =, %
  if (!/^\/[a-zA-Z0-9\-_.~/?#&=%]*$/.test(path)) return false;

  return true;
}

/**
 * Check if there's a legacy redirect for this domain + path combination.
 * Returns the new path if a redirect exists, null otherwise.
 *
 * SECURITY: Only accepts relative paths to prevent open redirect attacks.
 */
function getLegacyRedirect(hostname: string, pathname: string): string | null {
  // Early exit if no redirects configured
  if (LEGACY_REDIRECTS.size === 0) return null;

  const domainRedirects = LEGACY_REDIRECTS.get(hostname);
  if (!domainRedirects) return null;

  // Check exact match first
  const exactMatch = domainRedirects.get(pathname);
  if (exactMatch) {
    // SECURITY: Validate redirect is a relative path
    if (!isRelativePath(exactMatch)) {
      console.error('[middleware] Rejected non-relative redirect:', {
        hostname,
        pathname,
        target: exactMatch,
      });
      return null;
    }
    return exactMatch;
  }

  // Normalize pathname (remove trailing slash for consistent lookup)
  const normalizedPath =
    pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;

  const match = domainRedirects.get(normalizedPath);
  if (match && !isRelativePath(match)) {
    console.error('[middleware] Rejected non-relative redirect:', {
      hostname,
      pathname,
      target: match,
    });
    return null;
  }

  return match || null;
}

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // ===== LEGACY REDIRECT CHECK =====
  // Check for Squarespace/legacy URL redirects before other processing
  // This preserves SEO juice from old URLs
  const legacyRedirect = getLegacyRedirect(hostname, pathname);
  if (legacyRedirect) {
    const redirectUrl = new URL(legacyRedirect, request.url);
    // 301 permanent redirect for SEO
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

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

  // ===== SECURITY HEADERS =====
  const response = NextResponse.next();

  // Add CSP frame-ancestors for tenant routes to prevent clickjacking
  // 'self' allows same-origin framing (needed for Build Mode preview)
  // but prevents external sites from embedding tenant storefronts
  if (pathname.startsWith('/t/')) {
    response.headers.set('Content-Security-Policy', "frame-ancestors 'self'");
  }

  return response;
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
