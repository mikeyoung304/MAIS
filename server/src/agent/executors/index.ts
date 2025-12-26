/**
 * Proposal Executors
 *
 * Implements the actual execution logic for write tool proposals.
 * These are registered with the agent routes during initialization.
 *
 * Each executor:
 * 1. Receives tenantId and payload from the confirmed proposal
 * 2. Executes the actual database/service operation
 * 3. Returns the result for storage and display
 */

import type { PrismaClient } from '../../generated/prisma';
import { Prisma } from '../../generated/prisma';
import { registerProposalExecutor } from '../../routes/agent.routes';
import { logger } from '../../lib/core/logger';

/**
 * Register all proposal executors
 * Call this during server initialization
 */
export function registerAllExecutors(prisma: PrismaClient): void {
  // upsert_package - Create or update package
  registerProposalExecutor('upsert_package', async (tenantId, payload) => {
    const { packageId, slug, title, description, priceCents, photoUrl, bookingType, active } = payload as {
      packageId?: string;
      slug?: string;
      title: string;
      description?: string;
      priceCents: number;
      photoUrl?: string;
      bookingType?: string;
      active?: boolean;
    };

    if (packageId) {
      // Update existing package
      const updated = await prisma.package.update({
        where: { id: packageId },
        data: {
          ...(slug && { slug }),
          name: title,
          ...(description !== undefined && { description }),
          basePrice: priceCents,
          ...(bookingType && { bookingType: bookingType as 'DATE' | 'TIMESLOT' }),
          ...(active !== undefined && { active }),
        },
      });

      logger.info({ tenantId, packageId }, 'Package updated via agent');
      return {
        action: 'updated',
        packageId: updated.id,
        name: updated.name,
        basePrice: updated.basePrice,
      };
    }

    // Create new package - generate slug if not provided
    const generatedSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const created = await prisma.package.create({
      data: {
        tenantId,
        slug: generatedSlug,
        name: title,
        description: description || null,
        basePrice: priceCents,
        bookingType: (bookingType as 'DATE' | 'TIMESLOT') || 'DATE',
        active: active ?? true,
      },
    });

    logger.info({ tenantId, packageId: created.id }, 'Package created via agent');
    return {
      action: 'created',
      packageId: created.id,
      name: created.name,
      basePrice: created.basePrice,
      slug: created.slug,
    };
  });

  // delete_package - Remove package
  registerProposalExecutor('delete_package', async (tenantId, payload) => {
    const { packageId } = payload as { packageId: string };

    // Soft delete by deactivating (safer than hard delete)
    const deleted = await prisma.package.update({
      where: { id: packageId },
      data: { active: false },
    });

    logger.info({ tenantId, packageId }, 'Package deactivated via agent');
    return {
      action: 'deactivated',
      packageId: deleted.id,
      name: deleted.name,
    };
  });

  // manage_blackout - Create or delete blackout date
  registerProposalExecutor('manage_blackout', async (tenantId, payload) => {
    const { action, date, reason } = payload as {
      action: 'create' | 'delete';
      date: string;
      reason?: string;
    };

    const dateObj = new Date(date);

    if (action === 'create') {
      // Check if blackout already exists
      const existing = await prisma.blackoutDate.findFirst({
        where: { tenantId, date: dateObj },
      });

      if (existing) {
        return {
          action: 'already_exists',
          date,
          blackoutId: existing.id,
        };
      }

      const created = await prisma.blackoutDate.create({
        data: {
          tenantId,
          date: dateObj,
          reason: reason || null,
        },
      });

      logger.info({ tenantId, date }, 'Blackout created via agent');
      return {
        action: 'created',
        blackoutId: created.id,
        date,
        reason: created.reason,
      };
    }

    // Delete blackout
    const existing = await prisma.blackoutDate.findFirst({
      where: { tenantId, date: dateObj },
    });

    if (!existing) {
      return {
        action: 'not_found',
        date,
      };
    }

    await prisma.blackoutDate.delete({
      where: { id: existing.id },
    });

    logger.info({ tenantId, date }, 'Blackout deleted via agent');
    return {
      action: 'deleted',
      date,
    };
  });

  // update_branding - Update brand settings
  registerProposalExecutor('update_branding', async (tenantId, payload) => {
    const { primaryColor, secondaryColor, accentColor, backgroundColor, logoUrl } = payload as {
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      logoUrl?: string;
    };

    const updateData: Record<string, string> = {};
    if (primaryColor) updateData.primaryColor = primaryColor;
    if (secondaryColor) updateData.secondaryColor = secondaryColor;
    if (accentColor) updateData.accentColor = accentColor;
    if (backgroundColor) updateData.backgroundColor = backgroundColor;

    // Logo URL goes in branding JSON field
    let branding: Record<string, unknown> | undefined;
    if (logoUrl) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { branding: true },
      });
      branding = {
        ...(tenant?.branding as Record<string, unknown> || {}),
        logo: logoUrl,
      };
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...updateData,
        ...(branding && { branding: branding as Prisma.JsonObject }),
      },
    });

    logger.info({ tenantId }, 'Branding updated via agent');
    return {
      action: 'updated',
      changes: Object.keys(updateData).concat(logoUrl ? ['logo'] : []),
    };
  });

  // update_landing_page - Update storefront configuration
  registerProposalExecutor('update_landing_page', async (tenantId, payload) => {
    const { hero, about, testimonials, gallery, faq, sections } = payload as {
      hero?: Record<string, unknown>;
      about?: Record<string, unknown>;
      testimonials?: Record<string, unknown>;
      gallery?: Record<string, unknown>;
      faq?: Record<string, unknown>;
      sections?: Record<string, unknown>;
    };

    // Get existing config
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true },
    });

    const currentConfig = (tenant?.landingPageConfig as Record<string, unknown>) || {};

    // Merge updates
    const newConfig = {
      ...currentConfig,
      ...(hero && { hero }),
      ...(about && { about }),
      ...(testimonials && { testimonials }),
      ...(gallery && { gallery }),
      ...(faq && { faq }),
      ...(sections && { sections }),
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { landingPageConfig: newConfig as Prisma.JsonObject },
    });

    logger.info({ tenantId }, 'Landing page updated via agent');
    return {
      action: 'updated',
      updatedSections: Object.keys(payload).filter(k => payload[k as keyof typeof payload] !== undefined),
    };
  });

  // cancel_booking - Cancel and initiate refund
  registerProposalExecutor('cancel_booking', async (tenantId, payload) => {
    const { bookingId, reason } = payload as {
      bookingId: string;
      reason?: string;
    };

    // Get booking to verify ownership and get details
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: { customer: true, package: true },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'CANCELED' || booking.status === 'REFUNDED') {
      throw new Error('Booking is already cancelled or refunded');
    }

    // Update booking status
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELED',
        cancelledAt: new Date(),
        cancelledBy: 'TENANT',
        cancellationReason: reason || 'Cancelled by business owner',
        refundStatus: 'PENDING', // Mark for refund processing
      },
    });

    logger.info({ tenantId, bookingId }, 'Booking cancelled via agent');

    // Note: Actual refund processing would be handled by a separate service
    // that processes PENDING refunds via Stripe

    return {
      action: 'cancelled',
      bookingId: updated.id,
      customerName: booking.customer?.name || 'Unknown',
      date: booking.date.toISOString().split('T')[0],
      refundStatus: 'PENDING',
      note: 'Refund will be processed automatically',
    };
  });

  logger.info('Agent proposal executors registered');
}
