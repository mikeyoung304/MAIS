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
 */

import type { PrismaClient, Prisma } from '../../generated/prisma';
import { registerProposalExecutor } from '../proposals/executor-registry';
import { logger } from '../../lib/core/logger';
import { MissingFieldError, ResourceNotFoundError, ValidationError } from '../errors';

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

interface UpdateStorefrontPayload {
  headline?: string;
  tagline?: string;
  brandVoice?: string;
  heroImageUrl?: string;
  primaryColor?: string;
}

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
    const { segmentName, segmentSlug, packages } = payload as UpsertServicesPayload;

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
  // ============================================================================

  registerProposalExecutor('update_storefront', async (tenantId, payload) => {
    const { headline, tagline, brandVoice, heroImageUrl, primaryColor } =
      payload as UpdateStorefrontPayload;

    // Build update data
    const tenantUpdates: Prisma.TenantUpdateInput = {};
    const landingPageUpdates: Record<string, unknown> = {};

    // Direct tenant field updates
    if (primaryColor) {
      tenantUpdates.primaryColor = primaryColor;
    }

    // Landing page config updates
    if (headline || tagline || heroImageUrl) {
      // Get current landing page config
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { landingPageConfig: true },
      });

      const currentConfig = (tenant?.landingPageConfig as Record<string, unknown>) || {};
      const currentHero = (currentConfig.hero as Record<string, unknown>) || {};

      // Build updated hero section
      const heroUpdate: Record<string, unknown> = {
        ...currentHero,
        ...(headline && { headline }),
        ...(tagline && { subheadline: tagline }),
        ...(heroImageUrl && { backgroundImageUrl: heroImageUrl }),
      };

      landingPageUpdates.hero = heroUpdate;
    }

    // Brand voice goes in branding JSON field
    if (brandVoice) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { branding: true },
      });

      const currentBranding = (tenant?.branding as Record<string, unknown>) || {};
      tenantUpdates.branding = {
        ...currentBranding,
        voice: brandVoice,
      } as Prisma.JsonObject;
    }

    // Merge landing page config if we have updates
    if (Object.keys(landingPageUpdates).length > 0) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { landingPageConfig: true },
      });

      const currentConfig = (tenant?.landingPageConfig as Record<string, unknown>) || {};
      tenantUpdates.landingPageConfig = {
        ...currentConfig,
        ...landingPageUpdates,
      } as Prisma.JsonObject;
    }

    // Apply updates if any
    if (Object.keys(tenantUpdates).length > 0) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: tenantUpdates,
      });
    }

    // Build list of what was updated
    const updatedFields: string[] = [];
    if (headline) updatedFields.push('headline');
    if (tagline) updatedFields.push('tagline');
    if (brandVoice) updatedFields.push('brandVoice');
    if (heroImageUrl) updatedFields.push('heroImageUrl');
    if (primaryColor) updatedFields.push('primaryColor');

    logger.info({ tenantId, updatedFields }, 'Storefront updated via onboarding');

    // Get tenant slug for preview URL
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    const previewUrl = tenant?.slug
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/t/${tenant.slug}`
      : undefined;

    return {
      action: 'updated',
      updatedFields,
      previewUrl,
    };
  });

  logger.info('Onboarding proposal executors registered');
}
