import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/core/logger';
import { getConfig } from '../lib/core/config';

// Check if we're in a test environment (unit tests OR E2E tests)
// Must be defined before rate limiters that use it.
// Uses getConfig() for validated env access; safe at module level because config
// is loaded (loadConfig()) before Express middleware is registered.
const isTestEnvironment = getConfig().NODE_ENV === 'test' || getConfig().E2E_TEST === '1';

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
  max: isTestEnvironment ? 5000 : 300, // 300 requests per 15 minutes (5000 in test)
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
  max: isTestEnvironment ? 2000 : 120, // 120 requests per 15 minutes (2000 in test)
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
  // Allow more login attempts in test environment for testing (unit tests AND E2E tests)
  max: isTestEnvironment ? 100 : 5,
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
  // Allow many more signups in test environment (E2E tests create 120+ test tenants)
  max: isTestEnvironment ? 5000 : 5,
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
  max: isTestEnvironment ? 500 : 200, // 200 uploads per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  // Use normalized IP to handle IPv6 addresses properly
  keyGenerator: (req) => normalizeIp(req.ip),
  // Disable all validation - we handle IPv6 with normalizeIp()
  validate: false,
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
  max: isTestEnvironment ? 500 : 50, // 50 uploads per hour per tenant
  standardHeaders: true,
  legacyHeaders: false,
  // Prefer tenantId, fallback to normalized IP
  keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(req.ip),
  skip: (_req, res) => !res.locals.tenantAuth, // Only apply to authenticated requests
  // Disable all validation - we handle IPv6 with normalizeIp()
  validate: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_uploads_tenant',
      message: 'Upload quota exceeded for this tenant. Please try again later.',
    }),
});

/**
 * Rate limiter for visual editor draft autosave endpoints
 * Allows frequent saves (1 per second client debounce) while preventing abuse
 * 120 saves per minute per tenant (2 per second to allow for bursts)
 */
export const draftAutosaveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 120, // 120 saves per minute (2/sec)
  standardHeaders: true,
  legacyHeaders: false,
  // Key by tenantId for per-tenant limiting
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth, // Only apply to authenticated requests
  validate: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_save_requests',
      message: 'Saving too frequently. Please slow down.',
    }),
});

/**
 * Rate limiter for public tenant lookup (storefront routing)
 * 100 requests per 15 minutes per IP - generous for legitimate storefront use
 * Prevents enumeration attacks on tenant slugs
 */
export const publicTenantLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnvironment ? 500 : 100, // 100 lookups per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
});

/**
 * P1-145 FIX: Rate limiter for public booking management actions
 * 10 requests per 15 minutes per IP - prevents token brute-force and DoS
 * Actions: view, reschedule, cancel
 */
export const publicBookingActionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnvironment ? 500 : 10, // 10 actions per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_booking_actions',
      message: 'Too many booking actions from this IP. Please try again later.',
    }),
});

/**
 * P1-145 FIX: Rate limiter for balance payment checkout creation
 * 5 requests per hour per IP - prevents Stripe API abuse and checkout spam
 */
export const publicBalancePaymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTestEnvironment ? 500 : 5, // 5 checkout sessions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_payment_attempts',
      message: 'Too many payment attempts. Please try again later.',
    }),
});

/**
 * Rate limiter for public scheduling endpoints
 * 100 requests per minute per tenant/IP - prevents enumeration and DoS attacks
 * Protects service listing and availability slot queries
 */
export const publicSchedulingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  // Use tenantId if available (via tenant middleware), otherwise IP
  keyGenerator: (req, _res) => {
    // Type assertion for TenantRequest with tenantId property
    const tenantReq = req as Request & { tenantId?: string };
    return tenantReq.tenantId || normalizeIp(req.ip);
  },
  validate: false, // Disable validation - we handle IPv6 with normalizeIp()
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Too many requests, please try again later.',
    }),
});

/**
 * Rate limiter for add-on read operations
 * 100 requests per minute per tenant - allows frequent catalog browsing
 */
export const addonReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 100, // 100 reads per minute per tenant
  standardHeaders: true,
  legacyHeaders: false,
  // Key by tenantId for per-tenant limiting
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth, // Only apply to authenticated requests
  validate: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_addon_read_requests',
      message: 'Too many add-on requests. Please try again later.',
    }),
});

/**
 * Rate limiter for add-on write operations
 * 20 requests per minute per tenant - prevents rapid creation/modification abuse
 */
export const addonWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 20, // 20 writes per minute per tenant
  standardHeaders: true,
  legacyHeaders: false,
  // Key by tenantId for per-tenant limiting
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth, // Only apply to authenticated requests
  validate: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_addon_write_requests',
      message: 'Too many add-on modification requests. Please try again later.',
    }),
});

/**
 * Rate limiter for AI agent chat endpoints (per-tenant)
 * 30 messages per minute per tenant - balances UX with API cost protection
 * Prevents:
 * - Claude API token exhaustion (each message costs ~$0.01-0.10)
 * - Denial of service via unbounded agent conversations
 * - Abuse of costly AI capabilities
 * - Malicious tenants creating infinite sessions to bypass limits
 */
export const agentChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: isTestEnvironment ? 500 : 30, // 30 messages per minute per tenant
  standardHeaders: true,
  legacyHeaders: false,
  // Key by tenantId for per-tenant limiting
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth, // Only apply to authenticated requests
  validate: false, // Disable validation - we handle IPv6 with normalizeIp()
  handler: (_req: Request, res: Response) => {
    logger.warn({ tenantId: res.locals.tenantAuth?.tenantId }, 'Agent chat rate limit exceeded');
    res.status(429).json({
      error: 'too_many_agent_requests',
      message: 'Too many agent messages. Please slow down and try again in a minute.',
    });
  },
});

/**
 * Rate limiter for agent chat sessions - per-session burst protection
 * 10 messages per minute per session - prevents rapid-fire abuse within a conversation
 *
 * SECURITY: Uses compound key (tenant:session) to prevent sessionId spoofing.
 * Without tenant association, attackers could bypass by rotating sessionIds.
 * The tenantId comes from authenticated JWT (res.locals.tenantAuth), not user input.
 *
 * Layered with agentChatLimiter for defense in depth:
 * - agentChatLimiter: 30/5min per tenant (overall quota)
 * - agentSessionLimiter: 10/min per session (burst protection)
 */
export const agentSessionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 10, // 10 messages per minute per session
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const sessionId = (req.body as { sessionId?: string })?.sessionId;
    const tenantId = res.locals.tenantAuth?.tenantId;

    // Validate sessionId format using CUID pattern (MAIS uses CUIDs for IDs)
    // This prevents injection of special characters (colons, newlines, control chars)
    // that could be interpreted by the underlying rate limiter store
    // CUID format: 'c' followed by 24 lowercase alphanumeric characters
    const CUID_PATTERN = /^c[a-z0-9]{24}$/;
    if (sessionId && typeof sessionId === 'string' && CUID_PATTERN.test(sessionId)) {
      // Use compound key to ensure tenant association - prevents sessionId spoofing
      // An attacker rotating sessionIds will still be bound to their tenantId
      if (tenantId) {
        return `tenant:${tenantId}:session:${sessionId}`;
      }
      // Fallback for unauthenticated (should not happen in practice for agent routes)
      return `session:${sessionId}`;
    }

    // Fallback when no valid sessionId: use tenant or IP
    return tenantId ? `tenant:${tenantId}` : normalizeIp(req.ip);
  },
  skip: (_req, res) => !res.locals.tenantAuth, // Only apply to authenticated requests
  validate: false, // Disable validation - we handle IPv6 with normalizeIp()
  handler: (_req: Request, res: Response) => {
    logger.warn(
      {
        tenantId: res.locals.tenantAuth?.tenantId,
        sessionId: (_req.body as { sessionId?: string })?.sessionId,
      },
      'Agent session rate limit exceeded'
    );
    res.status(429).json({
      error: 'too_many_session_requests',
      message: 'Too many messages in this conversation. Please wait a moment.',
    });
  },
});

/**
 * Rate limiter for public customer chat endpoints
 * 20 messages per minute per IP - balances UX with API cost protection
 *
 * More restrictive than admin agent (30/5min) because:
 * - Public endpoint (potential for abuse from anonymous users)
 * - Per-IP to prevent single user from exhausting tenant's quota
 * - Lower limit acceptable for customer booking (simpler conversations)
 */
export const customerChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 20, // 20 messages per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  // Use IP for rate limiting (public endpoint - no tenant auth)
  keyGenerator: (req) => normalizeIp(req.ip),
  validate: false, // Disable validation - we handle IPv6 with normalizeIp()
  handler: (_req: Request, res: Response) => {
    logger.warn({ ip: normalizeIp(_req.ip) }, 'Customer chat rate limit exceeded');
    res.status(429).json({
      error: 'too_many_requests',
      message: 'Too many messages. Please wait a moment before sending more.',
    });
  },
});

/**
 * Rate limiter for Project Hub chat - per-project quota
 * 30 messages per minute per project - prevents abuse while allowing active conversations
 *
 * Layered protection (Phase 1 - Security Review):
 * - publicProjectRateLimiter: 100/15min per IP (overall project endpoint protection)
 * - projectHubChatLimiter: 30/min per project (project-level quota)
 * - projectHubSessionLimiter: 15/min per session (burst protection within conversation)
 *
 * This limiter ensures a single project can't exhaust API quotas,
 * regardless of how many sessions or IPs are accessing it.
 */
export const projectHubChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 30, // 30 messages per minute per project
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const projectId = req.params?.projectId;
    if (projectId) {
      return `project-hub:${projectId}`;
    }
    // Fallback to IP if projectId not available
    return `project-hub:ip:${normalizeIp(req.ip)}`;
  },
  validate: false,
  handler: (_req: Request, res: Response) => {
    const projectId = _req.params?.projectId;
    logger.warn({ projectId }, 'Project Hub chat rate limit exceeded');
    res.status(429).json({
      error: 'too_many_project_messages',
      message: 'This project has reached its message limit. Please wait a moment.',
    });
  },
});

/**
 * Rate limiter for Project Hub chat sessions (per-session burst protection)
 * 15 messages per minute per session - prevents rapid-fire abuse within a project conversation
 *
 * Phase 2 Enhancement: Layered rate limiting for Project Hub agent.
 *
 * Uses compound key (project:session) to prevent session rotation attacks.
 * The projectId comes from URL params, sessionId from request body.
 *
 * Layered protection:
 * - publicProjectRateLimiter: 100/15min per IP (overall project endpoint protection)
 * - projectHubChatLimiter: 30/min per project (project-level quota)
 * - projectHubSessionLimiter: 15/min per session (burst protection within conversation)
 *
 * Higher limit than agentSessionLimiter (10/min) because:
 * - Project Hub conversations may require multiple back-and-forth messages
 * - Users managing bookings need responsive experience
 * - Still protected by per-IP limits on the route level
 */
export const projectHubSessionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 15, // 15 messages per minute per session
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Extract sessionId from request body
    const sessionId = (req.body as { sessionId?: string })?.sessionId;
    // Extract projectId from URL params
    const projectId = req.params?.projectId;

    // Validate sessionId format (project session format: project-{id}-{timestamp})
    // or CUID format for compatibility
    const PROJECT_SESSION_PATTERN = /^project-[a-z0-9]+-\d+$/;
    const CUID_PATTERN = /^c[a-z0-9]{24}$/;
    const isValidSessionId =
      sessionId &&
      typeof sessionId === 'string' &&
      (PROJECT_SESSION_PATTERN.test(sessionId) || CUID_PATTERN.test(sessionId));

    if (isValidSessionId && projectId) {
      // Use compound key: project + session
      return `project:${projectId}:session:${sessionId}`;
    }

    // Fallback: just projectId if available
    if (projectId) {
      return `project:${projectId}`;
    }

    // Final fallback: IP address
    return normalizeIp(req.ip);
  },
  validate: false, // Disable validation - we handle custom key generation
  handler: (_req: Request, res: Response) => {
    const projectId = _req.params?.projectId;
    const sessionId = (_req.body as { sessionId?: string })?.sessionId;
    logger.warn(
      { projectId, sessionId: sessionId?.substring(0, 30) },
      'Project Hub session rate limit exceeded'
    );
    res.status(429).json({
      error: 'too_many_session_messages',
      message: 'Too many messages in this conversation. Please wait a moment.',
    });
  },
});

/**
 * Rate limiter for Stripe webhook endpoint
 * 100 requests per minute - prevents DoS attacks on webhook processing
 *
 * IMPORTANT: Returns HTTP 200 (not 429) on rate limit to prevent Stripe retry storms.
 * Stripe interprets non-200 responses as failures and will retry aggressively,
 * which could lead to retry accumulation and further overwhelm the system.
 *
 * Protects against:
 * - Database exhaustion via WebhookEvent record creation attempts
 * - Advisory lock DoS (each webhook acquires locks during processing)
 * - CPU exhaustion from cryptographic signature verification
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isTestEnvironment ? 500 : 100, // 100 requests per minute (Stripe typically sends < 10/min per tenant)
  standardHeaders: false, // Don't leak rate limit info to potential attackers
  legacyHeaders: false,
  // Use IP for rate limiting (webhooks don't have tenant authentication)
  keyGenerator: (req) => normalizeIp(req.ip),
  validate: false, // Disable validation - we handle IPv6 with normalizeIp()
  // Return 200 to prevent Stripe retries on rate limit
  handler: (_req: Request, res: Response) => {
    logger.warn(
      { ip: normalizeIp(_req.ip) },
      'Webhook rate limit exceeded - returning 200 to prevent Stripe retries'
    );
    res.status(200).send('OK');
  },
});

/**
 * Rate limiter for build retry endpoint (per-tenant)
 * 3 retries per hour per tenant — prevents abuse of costly LLM build pipeline
 *
 * Protects against:
 * - Excessive LLM API calls (each build triggers 3+ Vertex AI generations)
 * - Denial of wallet via repeated build triggers
 */
export const buildRetryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTestEnvironment ? 500 : 3, // 3 retries per hour per tenant
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth,
  validate: false,
  handler: (_req: Request, res: Response) => {
    logger.warn({ tenantId: res.locals.tenantAuth?.tenantId }, 'Build retry rate limit exceeded');
    res.status(429).json({
      error: 'too_many_retries',
      message: 'Too many build retries. Please try again later.',
    });
  },
});

export const skipIfHealth = (req: Request, _res: Response, next: NextFunction) => {
  // Skip rate limiting for health/ready endpoints
  if (req.path === '/health' || req.path === '/ready') {
    return next();
  }
  // Skip public limiter for webhooks (they have their own dedicated limiter)
  if (req.path.startsWith('/v1/webhooks')) {
    return next();
  }
  return publicLimiter(req, _res, next);
};
