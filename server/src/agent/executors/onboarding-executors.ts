/**
 * Onboarding Tool Executors
 *
 * Implements execution logic for onboarding write tool proposals.
 * These are registered with the proposal executor registry during initialization.
 *
 * Each executor:
 * 1. Receives tenantId and payload from the confirmed proposal
 * 2. Executes actual database operations
 * 3. Returns structured results for logging and display
 *
 * Architecture:
 * - Uses transaction for segment + packages creation (atomicity)
 * - Validates tenant ownership before all mutations (tenant isolation)
 * - Returns IDs for newly created resources (for state machine tracking)
 *
 * P0-FIX (2026-01-10): update_storefront now uses DraftUpdateService to write
 * to landingPageConfigDraft instead of landingPageConfig. This ensures changes
 * appear in the preview system.
 */

import type { PrismaClient } from '../../generated/prisma/client';
import { registerProposalExecutor } from '../proposals/executor-registry';
import { logger } from '../../lib/core/logger';
import { MissingFieldError, ValidationError } from '../errors';
import { DraftUpdateService } from '../services/draft-update.service';
import { UpdateStorefrontPayloadSchema } from '../proposals/executor-schemas';

// ============================================================================
// Types
// ============================================================================

interface UpsertServicesPayload {
  segmentName: string;
  segmentSlug: string;
  packages: Array<{
    name: string;
    slug: string;
    description?: string;
    priceCents: number;
    groupingOrder: number;
  }>;
}

// UpdateStorefrontPayload is now imported from executor-schemas.ts
// Type is inferred from UpdateStorefrontPayloadSchema

// ============================================================================
// Executor Registration
// ============================================================================

/**
 * Register all onboarding-related executors
 * Call this during server initialization alongside registerAllExecutors()
 */
export function registerOnboardingExecutors(prisma: PrismaClient): void {
  // ============================================================================
  // upsert_services - Create segment and packages atomically
  // ============================================================================

  registerProposalExecutor('upsert_services', async (tenantId, payload) => {
    const typedPayload = payload as unknown as UpsertServicesPayload;
    const { segmentName, segmentSlug, packages } = typedPayload;

    // Validate required fields
    if (!segmentName) {
      throw new MissingFieldError('segmentName', 'upsert_services');
    }
    if (!segmentSlug) {
      throw new MissingFieldError('segmentSlug', 'upsert_services');
    }
    if (!packages || packages.length === 0) {
      throw new MissingFieldError('packages', 'upsert_services');
    }

    // Execute in transaction for atomicity
    return await prisma.$transaction(async (tx) => {
      // Check if segment with this slug already exists
      const existingSegment = await tx.segment.findFirst({
        where: { tenantId, slug: segmentSlug },
      });

      if (existingSegment) {
        throw new ValidationError(
          `Segment with slug "${segmentSlug}" already exists. Use a different slug.`
        );
      }

      // Create segment
      const segment = await tx.segment.create({
        data: {
          tenantId,
          name: segmentName,
          slug: segmentSlug,
          heroTitle: segmentName, // Use name as default hero title
          active: true,
          sortOrder: 0,
        },
      });

      logger.info(
        { tenantId, segmentId: segment.id, slug: segmentSlug },
        'Segment created via onboarding'
      );

      // Create packages within segment
      const createdPackages: Array<{
        id: string;
        name: string;
        priceCents: number;
        slug: string;
      }> = [];

      for (const pkg of packages) {
        // Generate slug if not provided
        const packageSlug =
          pkg.slug ||
          pkg.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        const created = await tx.package.create({
          data: {
            tenantId,
            segmentId: segment.id,
            name: pkg.name,
            slug: packageSlug,
            description: pkg.description || null,
            basePrice: pkg.priceCents,
            groupingOrder: pkg.groupingOrder,
            active: true,
            bookingType: 'DATE',
          },
        });

        createdPackages.push({
          id: created.id,
          name: created.name,
          priceCents: created.basePrice,
          slug: created.slug,
        });

        logger.info(
          { tenantId, packageId: created.id, segmentId: segment.id },
          'Package created via onboarding'
        );
      }

      // Get tenant slug for preview URL
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true },
      });

      const previewUrl = tenant?.slug
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/t/${tenant.slug}`
        : undefined;

      return {
        action: 'created',
        segmentId: segment.id,
        segmentName: segment.name,
        segmentSlug: segment.slug,
        packages: createdPackages,
        packageCount: createdPackages.length,
        previewUrl,
      };
    });
  });

  // ============================================================================
  // update_storefront - Update landing page configuration
  //
  // P0-FIX (2026-01-10): Refactored to use DraftUpdateService
  // - Writes to landingPageConfigDraft (NOT landingPageConfig)
  // - Uses advisory lock for TOCTOU prevention
  // - Returns hasDraft: true for frontend cache invalidation
  // ============================================================================

  registerProposalExecutor('update_storefront', async (tenantId, payload) => {
    // P0: Validate payload against strict schema (TypeScript reviewer requirement)
    const validationResult = UpdateStorefrontPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    const { headline, tagline, brandVoice, heroImageUrl, primaryColor } = validationResult.data;

    // Use shared service (DHH requirement: single source of truth)
    const draftService = new DraftUpdateService(prisma);

    const allUpdatedFields: string[] = [];

    // Update hero section in draft (P0-FIX: writes to landingPageConfigDraft)
    if (headline || tagline || heroImageUrl) {
      const result = await draftService.updateHeroSection(tenantId, {
        headline,
        tagline,
        heroImageUrl,
      });
      allUpdatedFields.push(...result.updatedFields);
    }

    // Update branding (applies immediately, not part of draft system)
    if (primaryColor || brandVoice) {
      const result = await draftService.updateBranding(tenantId, {
        primaryColor,
        brandVoice,
      });
      allUpdatedFields.push(...result.updatedFields);
    }

    // Get preview URL
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    logger.info({ tenantId, updatedFields: allUpdatedFields }, 'Storefront updated via onboarding');

    return {
      action: 'updated',
      updatedFields: allUpdatedFields,
      previewUrl: tenant?.slug ? `/t/${tenant.slug}?preview=draft` : undefined,
      hasDraft: true, // Signal for frontend cache invalidation
    };
  });

  logger.info('Onboarding proposal executors registered');
}
