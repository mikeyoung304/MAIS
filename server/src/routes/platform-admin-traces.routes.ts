/**
 * Platform Admin Trace Routes
 * Routes for querying and managing conversation traces for agent evaluation.
 * Requires PLATFORM_ADMIN role authentication.
 *
 * @see plans/agent-evaluation-system.md Phase 1.6
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient, Prisma } from '../generated/prisma';
import { logger } from '../lib/core/logger';
import { sanitizeError } from '../lib/core/error-sanitizer';

// ─────────────────────────────────────────────────────────────────────────────
// Request Schemas
// ─────────────────────────────────────────────────────────────────────────────

const listTracesQuerySchema = z.object({
  tenantId: z.string().optional(),
  agentType: z.enum(['customer', 'onboarding', 'admin']).optional(),
  flagged: z.enum(['true', 'false']).optional(),
  reviewStatus: z.enum(['pending', 'reviewed', 'actioned']).optional(),
  minScore: z.coerce.number().min(0).max(10).optional(),
  maxScore: z.coerce.number().min(0).max(10).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  orderBy: z.enum(['startedAt', 'evalScore', 'turnCount', 'totalTokens']).default('startedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const traceIdParamSchema = z.object({
  traceId: z.string().min(1),
});

const updateReviewSchema = z.object({
  reviewStatus: z.enum(['pending', 'reviewed', 'actioned']),
  reviewNotes: z.string().max(2000).optional(),
  flagged: z.boolean().optional(),
  flagReason: z.string().max(500).optional(),
});

const createReviewActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'escalate', 'retrain', 'prompt_updated', 'bug_filed']),
  notes: z.string().max(2000).optional(),
  correctedScore: z.number().min(0).max(10).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Route Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create platform admin trace routes
 * All routes require PLATFORM_ADMIN authentication (applied via middleware)
 *
 * @param prisma - Prisma client for database access
 * @returns Express router with trace query endpoints
 */
export function createPlatformAdminTracesRouter(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /v1/platform/admin/traces
   * List conversation traces with filtering and pagination.
   * Used in platform admin dashboard for monitoring agent performance.
   *
   * Query params:
   * - tenantId: Filter by specific tenant
   * - agentType: Filter by agent type (customer, onboarding, admin)
   * - flagged: Filter by flagged status (true/false)
   * - reviewStatus: Filter by review status
   * - minScore: Minimum eval score
   * - maxScore: Maximum eval score
   * - startDate: Filter by start date (ISO 8601)
   * - endDate: Filter by end date (ISO 8601)
   * - limit: Number of results (default 50, max 100)
   * - offset: Pagination offset
   * - orderBy: Sort field
   * - order: Sort direction (asc/desc)
   *
   * @returns 200 - Array of traces with pagination metadata
   * @returns 400 - Validation error
   * @returns 401 - Unauthorized
   * @returns 500 - Internal server error
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate query params
      const query = listTracesQuerySchema.parse(req.query);

      // Build where clause
      const where: Prisma.ConversationTraceWhereInput = {};

      if (query.tenantId) {
        where.tenantId = query.tenantId;
      }

      if (query.agentType) {
        where.agentType = query.agentType;
      }

      if (query.flagged !== undefined) {
        where.flagged = query.flagged === 'true';
      }

      if (query.reviewStatus) {
        where.reviewStatus = query.reviewStatus;
      }

      if (query.minScore !== undefined || query.maxScore !== undefined) {
        where.evalScore = {};
        if (query.minScore !== undefined) {
          where.evalScore.gte = query.minScore;
        }
        if (query.maxScore !== undefined) {
          where.evalScore.lte = query.maxScore;
        }
      }

      if (query.startDate || query.endDate) {
        where.startedAt = {};
        if (query.startDate) {
          where.startedAt.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          where.startedAt.lte = new Date(query.endDate);
        }
      }

      // Query with pagination
      const [traces, total] = await Promise.all([
        prisma.conversationTrace.findMany({
          where,
          select: {
            id: true,
            tenantId: true,
            sessionId: true,
            agentType: true,
            startedAt: true,
            endedAt: true,
            turnCount: true,
            totalTokens: true,
            estimatedCostCents: true,
            evalScore: true,
            evalDimensions: true,
            evalConfidence: true,
            flagged: true,
            flagReason: true,
            reviewStatus: true,
            taskCompleted: true,
            // Exclude encrypted fields for list view (too large)
            // messages: false,
            // toolCalls: false,
          },
          orderBy: { [query.orderBy]: query.order },
          skip: query.offset,
          take: query.limit,
        }),
        prisma.conversationTrace.count({ where }),
      ]);

      res.json({
        traces,
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + traces.length < total,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /v1/platform/admin/traces/:traceId
   * Get single trace with full details (including messages and tool calls).
   * Messages and tool calls are decrypted automatically via Prisma middleware.
   *
   * @returns 200 - Full trace object
   * @returns 404 - Trace not found
   * @returns 500 - Internal server error
   */
  router.get('/:traceId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { traceId } = traceIdParamSchema.parse(req.params);

      const trace = await prisma.conversationTrace.findUnique({
        where: { id: traceId },
        include: {
          reviewActions: {
            orderBy: { performedAt: 'desc' },
          },
          feedbacks: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!trace) {
        res.status(404).json({ error: 'Trace not found' });
        return;
      }

      res.json(trace);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  });

  /**
   * PATCH /v1/platform/admin/traces/:traceId/review
   * Update review status and notes for a trace.
   *
   * @returns 200 - Updated trace
   * @returns 404 - Trace not found
   * @returns 500 - Internal server error
   */
  router.patch('/:traceId/review', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { traceId } = traceIdParamSchema.parse(req.params);
      const data = updateReviewSchema.parse(req.body);

      // Get user ID from auth
      const userId = res.locals.user?.id || 'system';

      const trace = await prisma.conversationTrace.update({
        where: { id: traceId },
        data: {
          reviewStatus: data.reviewStatus,
          reviewNotes: data.reviewNotes,
          reviewedAt: new Date(),
          reviewedBy: userId,
          flagged: data.flagged,
          flagReason: data.flagReason,
        },
      });

      logger.info({ traceId, reviewStatus: data.reviewStatus, userId }, 'Trace review updated');

      res.json(trace);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        res.status(404).json({ error: 'Trace not found' });
        return;
      }
      next(error);
    }
  });

  /**
   * POST /v1/platform/admin/traces/:traceId/actions
   * Create a review action for a trace.
   * Used to track human reviewer decisions.
   *
   * @returns 201 - Created review action
   * @returns 404 - Trace not found
   * @returns 500 - Internal server error
   */
  router.post('/:traceId/actions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { traceId } = traceIdParamSchema.parse(req.params);
      const data = createReviewActionSchema.parse(req.body);

      // Verify trace exists and get tenantId
      const trace = await prisma.conversationTrace.findUnique({
        where: { id: traceId },
        select: { id: true, tenantId: true },
      });

      if (!trace) {
        res.status(404).json({ error: 'Trace not found' });
        return;
      }

      // Get user ID from auth
      const userId = res.locals.user?.id || 'system';

      const action = await prisma.reviewAction.create({
        data: {
          tenantId: trace.tenantId,
          traceId,
          action: data.action,
          notes: data.notes,
          correctedScore: data.correctedScore,
          performedBy: userId,
        },
      });

      // Update trace review status
      await prisma.conversationTrace.update({
        where: { id: traceId },
        data: {
          reviewStatus: 'actioned',
          reviewedAt: new Date(),
          reviewedBy: userId,
        },
      });

      logger.info({ traceId, action: data.action, userId }, 'Review action created');

      res.status(201).json(action);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /v1/platform/admin/traces/stats
   * Get aggregate statistics for traces.
   * Used for dashboard metrics.
   *
   * Query params:
   * - tenantId: Filter by specific tenant
   * - agentType: Filter by agent type
   * - startDate: Filter by start date
   * - endDate: Filter by end date
   *
   * @returns 200 - Stats object
   * @returns 500 - Internal server error
   */
  router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listTracesQuerySchema
        .pick({
          tenantId: true,
          agentType: true,
          startDate: true,
          endDate: true,
        })
        .parse(req.query);

      // Build where clause
      const where: Prisma.ConversationTraceWhereInput = {};

      if (query.tenantId) {
        where.tenantId = query.tenantId;
      }

      if (query.agentType) {
        where.agentType = query.agentType;
      }

      if (query.startDate || query.endDate) {
        where.startedAt = {};
        if (query.startDate) {
          where.startedAt.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          where.startedAt.lte = new Date(query.endDate);
        }
      }

      const [totalTraces, flaggedCount, pendingReviewCount, avgScore, totalCost, totalTokens] =
        await Promise.all([
          prisma.conversationTrace.count({ where }),
          prisma.conversationTrace.count({ where: { ...where, flagged: true } }),
          prisma.conversationTrace.count({
            where: { ...where, reviewStatus: 'pending' },
          }),
          prisma.conversationTrace.aggregate({
            where: { ...where, evalScore: { not: null } },
            _avg: { evalScore: true },
          }),
          prisma.conversationTrace.aggregate({
            where,
            _sum: { estimatedCostCents: true },
          }),
          prisma.conversationTrace.aggregate({
            where,
            _sum: { totalTokens: true },
          }),
        ]);

      res.json({
        totalTraces,
        flaggedCount,
        flaggedRate: totalTraces > 0 ? flaggedCount / totalTraces : 0,
        pendingReviewCount,
        avgScore: avgScore._avg.evalScore,
        totalCostCents: totalCost._sum.estimatedCostCents || 0,
        totalCostDollars: (totalCost._sum.estimatedCostCents || 0) / 100,
        totalTokens: totalTokens._sum.totalTokens || 0,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      next(error);
    }
  });

  return router;
}
