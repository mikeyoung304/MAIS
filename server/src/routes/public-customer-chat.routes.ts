/**
 * Public Customer Chat Routes
 *
 * Public endpoints for customer-facing chatbot.
 * NO authentication required - uses tenant context from X-Tenant-Key header.
 *
 * Routes customer chat directly to the Booking Agent on Cloud Run.
 * Bookings are completed via Stripe checkout (no proposal confirmation step).
 *
 * Endpoints:
 * - GET  /v1/public/chat/health    - Check if chatbot is available
 * - POST /v1/public/chat/session   - Create or get chat session
 * - POST /v1/public/chat/message   - Send message to Booking Agent
 * - POST /v1/public/chat/confirm   - DEPRECATED (bookings via Stripe checkout)
 * - GET  /v1/public/chat/greeting  - Get initial greeting message
 *
 * @see plans/LEGACY_AGENT_MIGRATION_PLAN.md Phase 1
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { CustomerAgentService } from '../services/customer-agent.service';
import type { TenantOnboardingService } from '../services/tenant-onboarding.service';

// ============================================================================
// Request Body Schemas (TS-4: Typed request validation)
// ============================================================================

/** Message endpoint request body schema */
const MessageRequestSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long (max 2000 characters)'),
  sessionId: z.string().optional(),
});

/**
 * IP-based rate limiter for public chat endpoints
 * - 50 requests per 15 minutes per IP
 * - Protects against abuse from unauthenticated sources
 * - Separate from agent-level rate limiting (which is per-session)
 *
 * NOTE: Uses default keyGenerator (req.ip) which works correctly because
 * app.set('trust proxy', 1) is configured in app.ts. This makes Express
 * extract the real client IP from X-Forwarded-For in a secure way:
 * - Takes rightmost IP minus trusted proxy count (prevents spoofing)
 * - Falls back to socket address if no proxy headers
 * See: https://expressjs.com/en/guide/behind-proxies.html
 */
const publicChatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window per IP
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable deprecated headers
  // Default keyGenerator uses req.ip which is correctly set by trust proxy
});

/**
 * Middleware factory to require chat to be enabled for tenant.
 * Returns 403 if chat is disabled or tenant not found.
 */
function createRequireChatEnabled(tenantOnboarding: TenantOnboardingService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenantId = req.tenantId ?? null;

    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant context' });
      return;
    }

    const enabled = await tenantOnboarding.isChatEnabled(tenantId);
    if (!enabled) {
      res.status(403).json({ error: 'Chat is not enabled for this business' });
      return;
    }

    next();
  };
}

interface PublicCustomerChatDeps {
  prisma: import('../generated/prisma/client').PrismaClient;
  tenantOnboarding: TenantOnboardingService;
}

/**
 * Create public customer chat routes
 */
export function createPublicCustomerChatRoutes(deps: PublicCustomerChatDeps): Router {
  const { prisma, tenantOnboarding } = deps;
  const router = Router();
  // CustomerAgentService routes chat to Booking Agent on Cloud Run
  // Guardrails are handled by the Booking Agent and AI quota limits
  const agentService = new CustomerAgentService(prisma);
  const requireChatEnabled = createRequireChatEnabled(tenantOnboarding);

  // Apply IP rate limiting to all routes
  router.use(publicChatRateLimiter);

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * GET /health
   * Check if chatbot is available for this tenant
   */
  router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;

      if (!tenantId) {
        res.json({
          available: false,
          reason: 'missing_tenant',
          message: 'Business not found.',
        });
        return;
      }

      // Check if LLM API is configured (Vertex AI via ADC)
      const apiKeyConfigured = !!process.env.GOOGLE_VERTEX_PROJECT;

      // Check if tenant has chat enabled
      const chatInfo = await tenantOnboarding.getTenantChatInfo(tenantId);

      if (!chatInfo) {
        res.json({
          available: false,
          reason: 'tenant_not_found',
          message: 'Business not found.',
        });
        return;
      }

      if (!chatInfo.chatEnabled) {
        res.json({
          available: false,
          reason: 'chat_disabled',
          message: 'Chat is not available for this business.',
        });
        return;
      }

      if (!apiKeyConfigured) {
        res.json({
          available: false,
          reason: 'api_not_configured',
          message: 'Chat is temporarily unavailable.',
        });
        return;
      }

      res.json({
        available: true,
        businessName: chatInfo.name,
      });
    } catch (error) {
      logger.error({ error }, 'Customer chat health check error');
      next(error);
    }
  });

  // ============================================================================
  // Greeting
  // ============================================================================

  /**
   * GET /greeting
   * Get initial greeting message for chat widget
   */
  router.get('/greeting', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      const greeting = await agentService.getGreeting(tenantId);

      res.json({ greeting });
    } catch (error) {
      logger.error({ error }, 'Customer chat greeting error');
      next(error);
    }
  });

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * POST /session
   * Create or get existing chat session
   */
  router.post(
    '/session',
    requireChatEnabled,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // tenantId guaranteed by requireChatEnabled middleware
        const tenantId = req.tenantId!;

        const session = await agentService.getOrCreateSession(tenantId);
        const greeting = await agentService.getGreeting(tenantId);

        // Get business name from tenant (not stored in session)
        const businessName = await tenantOnboarding.getTenantName(tenantId);

        res.json({
          sessionId: session.sessionId,
          greeting,
          businessName,
          messageCount: session.messageCount,
        });
      } catch (error) {
        logger.error({ error }, 'Customer chat session error');
        next(error);
      }
    }
  );

  // ============================================================================
  // Chat Messages
  // ============================================================================

  /**
   * POST /message
   * Send a message to the chatbot
   */
  router.post(
    '/message',
    requireChatEnabled,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // tenantId guaranteed by requireChatEnabled middleware
        const tenantId = req.tenantId!;

        // Validate request body with Zod
        const parseResult = MessageRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          const firstError = parseResult.error.errors[0];
          res.status(400).json({ error: firstError?.message || 'Invalid request' });
          return;
        }

        const { message, sessionId } = parseResult.data;

        // Get or create session, validating ownership if sessionId provided
        let actualSessionId = sessionId;
        if (actualSessionId) {
          // Validate that sessionId belongs to this tenant
          const session = await agentService.getSession(tenantId, actualSessionId);
          if (!session) {
            res.status(400).json({ error: 'Invalid or expired session' });
            return;
          }
        } else {
          const session = await agentService.getOrCreateSession(tenantId);
          actualSessionId = session.sessionId;
        }

        // Send message to Booking Agent
        const response = await agentService.chat(tenantId, actualSessionId, message);

        logger.info(
          {
            tenantId,
            sessionId: actualSessionId,
            messageLength: message.length,
            responseLength: response.message.length,
            hasToolResults: !!response.toolResults?.length,
          },
          'Customer chat message processed'
        );

        res.json({
          message: response.message,
          sessionId: response.sessionId,
          toolResults: response.toolResults,
          usage: response.usage,
        });
      } catch (error) {
        logger.error({ error }, 'Customer chat message error');
        next(error);
      }
    }
  );

  // ============================================================================
  // Booking Confirmation (DEPRECATED)
  // ============================================================================

  /**
   * POST /confirm/:proposalId
   * DEPRECATED: The new Booking Agent flow creates bookings directly via Stripe checkout.
   * Customers confirm payment on Stripe's hosted checkout page, not via this endpoint.
   *
   * This endpoint is kept for backwards compatibility but returns a deprecation notice.
   * The Booking Agent's create_booking tool returns a checkoutUrl for payment completion.
   */
  router.post('/confirm/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId ?? null;

      if (!tenantId) {
        res.status(400).json({ error: 'Missing tenant context' });
        return;
      }

      logger.warn(
        { tenantId, proposalId: req.params.proposalId },
        'Deprecated /confirm endpoint called - new flow uses Stripe checkout directly'
      );

      // Return helpful deprecation message
      res.status(410).json({
        error: 'This booking flow has been updated.',
        message:
          'Bookings are now confirmed via Stripe checkout. Please complete your booking using the checkout link provided in the chat.',
        deprecated: true,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
