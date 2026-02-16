/**
 * Internal Agent Shared Module
 *
 * Shared middleware, helpers, schemas, and dependency interfaces used by
 * all internal-agent domain route files.
 */

import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import validator from 'validator';
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
import type { SegmentService } from '../services/segment.service';
import type { PrismaClient } from '../generated/prisma/client';

// =============================================================================
// Shared Constants
// =============================================================================

export const SECTION_TYPES = [
  'hero',
  'text',
  'about',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'services',
  'features',
  'custom',
] as const;

export const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'faq',
  'contact',
  'gallery',
  'testimonials',
] as const;

// Re-export DISCOVERY_FACT_KEYS for backward compatibility
export { DISCOVERY_FACT_KEYS } from '../shared/constants/discovery-facts';

// =============================================================================
// Shared Helpers
// =============================================================================

/** Convert text to URL-safe slug, max 50 chars */
export function slugify(text: string): string {
  return validator
    .unescape(text)
    .toLowerCase()
    .replace(/&/g, 'and') // & → and (human-readable)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

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
 * Error response configuration map: error type → {status, response}
 */
const ERROR_RESPONSE_MAP: Record<
  string,
  { status: number; buildResponse: (error: unknown) => Record<string, unknown> }
> = {
  ZodError: {
    status: 400,
    buildResponse: (error: unknown) => ({
      error: 'Validation error',
      details: ((error as ZodError).issues || []).map((i) => `${i.path.join('.')}: ${i.message}`),
    }),
  },
  NotFoundError: {
    status: 404,
    buildResponse: (error: unknown) => ({
      error: 'NOT_FOUND',
      message: (error as NotFoundError).message,
    }),
  },
  ValidationError: {
    status: 400,
    buildResponse: (error: unknown) => ({
      error: 'VALIDATION_ERROR',
      message: (error as ValidationError).message,
    }),
  },
  ConcurrentModificationError: {
    status: 409,
    buildResponse: (error: unknown) => ({
      error: 'CONCURRENT_MODIFICATION',
      message: (error as ConcurrentModificationError).message,
      currentVersion: (error as ConcurrentModificationError).currentVersion,
    }),
  },
};

/**
 * Handle errors consistently across all internal agent endpoints.
 */
export function handleError(res: Response, error: unknown, endpoint: string): void {
  const errorName = (error as Error).constructor.name;
  const config = ERROR_RESPONSE_MAP[errorName];

  if (config) {
    res.status(config.status).json(config.buildResponse(error));
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
  /** Pre-built services from DI. When provided, route factory skips internal instantiation. */
  discoveryService?: import('../services/discovery.service').DiscoveryService;
  researchService?: import('../services/research.service').ResearchService;
}

export interface StorefrontRoutesDeps {
  sectionContentService?: SectionContentService;
  tenantRepo: PrismaTenantRepository;
  internalApiSecret?: string;
}

export interface MarketingRoutesDeps {
  tenantRepo: PrismaTenantRepository;
  catalogService: CatalogService;
  segmentService?: SegmentService;
  prisma?: PrismaClient;
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
