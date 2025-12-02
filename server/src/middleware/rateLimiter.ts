import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

/**
 * Helper to normalize IP addresses for rate limiting
 * Handles IPv6 addresses properly by extracting the /64 prefix
 * This prevents IPv6 users from bypassing limits
 */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';

  // Check if it's an IPv6 address
  if (ip.includes(':')) {
    // Extract the /64 prefix (first 4 groups) for IPv6
    // This groups users by network rather than individual IPs
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + '::';
    }
  }

  return ip;
}

export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Admin route rate limit exceeded.',
    }),
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed login attempts
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_login_attempts',
      message: 'Too many login attempts. Please try again in 15 minutes.',
    }),
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  // Allow more signups in test environment for testing
  max: process.env.NODE_ENV === 'test' ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_signup_attempts',
      message: 'Too many signup attempts. Please try again in an hour.',
    }),
});

/**
 * IP-level rate limiter for file uploads (DDoS protection)
 * Higher limit to accommodate multiple tenants behind shared IPs (NAT, corporate proxies)
 * 200 uploads per hour per IP
 */
export const uploadLimiterIP = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 500 : 200, // 200 uploads per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  // Use normalized IP to handle IPv6 addresses properly
  keyGenerator: (req) => normalizeIp(req.ip),
  // Disable validation since we handle IPv6 ourselves
  validate: { xForwardedForHeader: false },
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_uploads_ip',
      message: 'Too many uploads from this IP. Please try again later.',
    }),
});

/**
 * Tenant-level rate limiter for file uploads (quota enforcement)
 * Prevents individual tenant abuse regardless of IP rotation
 * 50 uploads per hour per tenant
 */
export const uploadLimiterTenant = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 500 : 50, // 50 uploads per hour per tenant
  standardHeaders: true,
  legacyHeaders: false,
  // Prefer tenantId, fallback to normalized IP
  keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(req.ip),
  skip: (_req, res) => !res.locals.tenantAuth, // Only apply to authenticated requests
  // Disable validation since we handle IPv6 ourselves
  validate: { xForwardedForHeader: false },
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_uploads_tenant',
      message: 'Upload quota exceeded for this tenant. Please try again later.',
    }),
});

/**
 * @deprecated Use uploadLimiterIP and uploadLimiterTenant instead
 * Legacy single-layer rate limiter - kept for backwards compatibility
 */
export const uploadLimiter = uploadLimiterIP;

/**
 * Rate limiter for public tenant lookup (storefront routing)
 * 100 requests per 15 minutes per IP - generous for legitimate storefront use
 * Prevents enumeration attacks on tenant slugs
 */
export const publicTenantLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 500 : 100, // 100 lookups per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
});

export const skipIfHealth = (req: Request, _res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path === '/ready') {
    return next();
  }
  return publicLimiter(req, _res, next);
};
