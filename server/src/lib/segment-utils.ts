/**
 * Segment Utilities
 *
 * Shared utilities for segment operations used across multiple code paths.
 * Extracted to prevent duplicate logic in CatalogService and agent executors.
 *
 * @see docs/solutions/patterns/STOREFRONT_SECTION_IDS_QUICK_REFERENCE.md - DRY utilities pattern
 */

import type { PrismaClient } from '../generated/prisma/client';
import { DEFAULT_SEGMENT } from './tenant-defaults';
import { logger } from './core/logger';

/**
 * Options for resolving the General segment
 */
export interface ResolveGeneralSegmentOptions {
  /** Whether to create the segment if it doesn't exist (default: true) */
  createIfMissing?: boolean;
}

/**
 * Result of resolving a segment
 */
export interface ResolveSegmentResult {
  /** The segment ID, or null if not found and createIfMissing is false */
  segmentId: string | null;
  /** Whether the segment was created during this call */
  wasCreated: boolean;
}

/**
 * Resolves the General segment for a tenant, creating it if necessary.
 *
 * This utility consolidates the "find General segment or create it" pattern
 * that was duplicated in:
 * - CatalogService.createPackage()
 * - Agent executors (upsert_package)
 *
 * @param prisma - PrismaClient instance (or transaction client)
 * @param tenantId - Tenant ID for data isolation
 * @param options - Optional configuration
 * @returns The segment ID and whether it was created
 *
 * @example
 * ```typescript
 * // Basic usage - find or create
 * const { segmentId, wasCreated } = await resolveOrCreateGeneralSegment(prisma, tenantId);
 *
 * // Read-only - don't create if missing
 * const { segmentId } = await resolveOrCreateGeneralSegment(prisma, tenantId, {
 *   createIfMissing: false,
 * });
 * ```
 */
export async function resolveOrCreateGeneralSegment(
  prisma: PrismaClient,
  tenantId: string,
  options: ResolveGeneralSegmentOptions = {}
): Promise<ResolveSegmentResult> {
  const { createIfMissing = true } = options;

  // First try to find existing General segment using the compound unique key
  const existingSegment = await prisma.segment.findUnique({
    where: {
      tenantId_slug: {
        tenantId,
        slug: DEFAULT_SEGMENT.slug,
      },
    },
    select: { id: true },
  });

  if (existingSegment) {
    return {
      segmentId: existingSegment.id,
      wasCreated: false,
    };
  }

  // No General segment exists
  if (!createIfMissing) {
    return {
      segmentId: null,
      wasCreated: false,
    };
  }

  // Create new General segment with defaults from tenant-defaults.ts
  const newSegment = await prisma.segment.create({
    data: {
      tenantId,
      slug: DEFAULT_SEGMENT.slug,
      name: DEFAULT_SEGMENT.name,
      heroTitle: DEFAULT_SEGMENT.heroTitle,
      description: DEFAULT_SEGMENT.description,
      sortOrder: 0,
      active: true,
    },
    select: { id: true },
  });

  logger.info(
    { tenantId, segmentId: newSegment.id },
    'Created General segment for tenant (was missing)'
  );

  return {
    segmentId: newSegment.id,
    wasCreated: true,
  };
}

/**
 * Validates that a segment ID belongs to the specified tenant.
 *
 * @param prisma - PrismaClient instance
 * @param tenantId - Tenant ID for ownership validation
 * @param segmentId - Segment ID to validate
 * @returns The segment if found and owned by tenant, null otherwise
 *
 * @example
 * ```typescript
 * const segment = await validateSegmentOwnership(prisma, tenantId, segmentId);
 * if (!segment) {
 *   throw new ValidationError('Segment not found or access denied');
 * }
 * ```
 */
export async function validateSegmentOwnership(
  prisma: PrismaClient,
  tenantId: string,
  segmentId: string
): Promise<{ id: string; name: string } | null> {
  return await prisma.segment.findFirst({
    where: { id: segmentId, tenantId },
    select: { id: true, name: true },
  });
}
