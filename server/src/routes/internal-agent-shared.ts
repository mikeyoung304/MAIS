/**
 * Internal Agent Shared Module
 *
 * Shared middleware, helpers, schemas, and dependency interfaces used by
 * all internal-agent domain route files.
 */

import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { timingSafeCompare } from '../lib/timing-safe';
import { logger } from '../lib/core/logger';
import { ConcurrentModificationError, NotFoundError, ValidationError } from '../lib/errors';
import type { CatalogService } from '../services/catalog.service';
import type { SchedulingAvailabilityService } from '../services/scheduling-availability.service';
import type { BookingService } from '../services/booking.service';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { ServiceRepository } from '../lib/ports';
import type { ContextBuilderService } from '../services/context-builder.service';
import type { ProjectHubService } from '../services/project-hub.service';
import type { VocabularyEmbeddingService } from '../services/vocabulary-embedding.service';
import type { SectionContentService } from '../services/section-content.service';

// =============================================================================
// Shared Schemas
// =============================================================================

export const TenantIdSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
});

// =============================================================================
// Shared Middleware
// =============================================================================

/**
 * Create middleware to verify internal API secret.
 * Uses X-Internal-Secret header with constant-time comparison to prevent timing attacks.
 */
export function verifyInternalSecret(
  internalApiSecret?: string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const secret = req.headers['x-internal-secret'];
    const expectedSecret = internalApiSecret;

    // If no secret configured, reject all requests (fail-safe)
    if (!expectedSecret) {
      logger.warn('Internal API secret not configured - rejecting agent request');
      res.status(503).json({
        error: 'Internal API not configured',
      });
      return;
    }

    // Verify secret matches using constant-time comparison to prevent timing attacks
    const secretStr = typeof secret === 'string' ? secret : '';
    if (!timingSafeCompare(secretStr, expectedSecret)) {
      logger.warn({ ip: req.ip }, 'Invalid internal API secret from agent');
      res.status(403).json({
        error: 'Invalid API secret',
      });
      return;
    }

    next();
  };
}

// =============================================================================
// Shared Error Handler
// =============================================================================

/**
 * Handle errors consistently across all internal agent endpoints.
 */
export function handleError(res: Response, error: unknown, endpoint: string): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: error.message,
    });
    return;
  }

  if (error instanceof ValidationError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: error.message,
    });
    return;
  }

  if (error instanceof ConcurrentModificationError) {
    res.status(409).json({
      error: 'CONCURRENT_MODIFICATION',
      message: error.message,
      currentVersion: error.currentVersion,
    });
    return;
  }

  logger.error({ error, endpoint, requestId: res.locals?.requestId }, '[Agent] Internal error');

  res.status(500).json({
    error: 'Internal server error',
    requestId: res.locals?.requestId,
  });
}

// =============================================================================
// Per-Domain Dependency Interfaces
// =============================================================================

export interface DiscoveryRoutesDeps {
  tenantRepo: PrismaTenantRepository;
  contextBuilder?: ContextBuilderService;
  catalogService: CatalogService;
  internalApiSecret?: string;
}

export interface StorefrontRoutesDeps {
  sectionContentService?: SectionContentService;
  tenantRepo: PrismaTenantRepository;
  internalApiSecret?: string;
}

export interface MarketingRoutesDeps {
  tenantRepo: PrismaTenantRepository;
  catalogService: CatalogService;
  vocabularyEmbeddingService?: VocabularyEmbeddingService;
  internalApiSecret?: string;
}

export interface BookingRoutesDeps {
  catalogService: CatalogService;
  schedulingAvailabilityService?: SchedulingAvailabilityService;
  bookingService: BookingService;
  tenantRepo: PrismaTenantRepository;
  serviceRepo?: ServiceRepository;
  internalApiSecret?: string;
}

export interface ProjectHubRoutesDeps {
  projectHubService?: ProjectHubService;
  internalApiSecret?: string;
}

/** Union type for the aggregator — satisfies all domain interfaces */
export type InternalAgentRoutesDeps = DiscoveryRoutesDeps &
  StorefrontRoutesDeps &
  MarketingRoutesDeps &
  BookingRoutesDeps &
  ProjectHubRoutesDeps;
