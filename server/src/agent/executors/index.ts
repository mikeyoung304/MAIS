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
import { Prisma, BookingStatus } from '../../generated/prisma';
import { registerProposalExecutor } from '../proposals/executor-registry';
import { logger } from '../../lib/core/logger';
import {
  MissingFieldError,
  ResourceNotFoundError,
  DateUnavailableError,
  InvalidStateError,
  ConfigurationError,
} from '../errors';

/**
 * Type guard for BookingStatus enum
 * Validates that a string value is a valid BookingStatus before casting
 */
function isValidBookingStatus(status: string): status is BookingStatus {
  return Object.values(BookingStatus).includes(status as BookingStatus);
}

/**
 * Generate deterministic lock ID from tenantId + date for PostgreSQL advisory locks
 * Uses FNV-1a hash algorithm to convert string to 32-bit integer
 */
function hashTenantDate(tenantId: string, date: string): number {
  const str = `${tenantId}:${date}`;
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  // Convert to 32-bit signed integer (PostgreSQL bigint range)
  return hash | 0;
}

/**
 * Verify tenant ownership of an entity before mutation.
 * CRITICAL: Prevents cross-tenant access.
 *
 * @param prisma - Prisma client instance
 * @param model - Model name to query
 * @param id - Entity ID
 * @param tenantId - Tenant ID to verify ownership against
 * @returns The entity if found and owned by tenant
 * @throws Error if entity not found or not owned by tenant
 */
async function verifyOwnership<T>(
  prisma: PrismaClient,
  model: 'package' | 'addOn' | 'booking' | 'segment' | 'customer',
  id: string,
  tenantId: string
): Promise<T> {
  const entity = await (prisma[model] as any).findFirst({
    where: { id, tenantId },
  });
  if (!entity) {
    const modelName = model.charAt(0).toUpperCase() + model.slice(1);
    throw new Error(
      `${modelName} "${id}" not found or you do not have permission to access it. Verify the ${model} ID belongs to your business.`
    );
  }
  return entity as T;
}

/**
 * Register all proposal executors
 * Call this during server initialization
 */
export function registerAllExecutors(prisma: PrismaClient): void {
  // upsert_package - Create or update package
  registerProposalExecutor('upsert_package', async (tenantId, payload) => {
    // Accept both 'title' (old) and 'name' (new) field names, plus 'basePrice'/'priceCents'
    const {
      packageId,
      slug,
      title,
      name,
      description,
      priceCents,
      basePrice,
      photoUrl,
      bookingType,
      active,
    } = payload as {
      packageId?: string;
      slug?: string;
      title?: string;
      name?: string;
      description?: string;
      priceCents?: number;
      basePrice?: number;
      photoUrl?: string;
      bookingType?: string;
      active?: boolean;
    };

    // Normalize field names (name takes precedence, fall back to title)
    const packageName = name || title;
    const packagePrice = basePrice ?? priceCents;

    if (!packageName) {
      throw new MissingFieldError('name', 'package');
    }
    if (packagePrice === undefined) {
      throw new MissingFieldError('price', 'package');
    }

    if (packageId) {
      // CRITICAL: Verify tenant ownership before update (prevent cross-tenant access)
      const existingPackage = await prisma.package.findFirst({
        where: { id: packageId, tenantId },
      });

      if (!existingPackage) {
        throw new ResourceNotFoundError(
          'package',
          packageId,
          'Try using get_packages to find available packages.'
        );
      }

      // Update existing package (now safe after tenant verification)
      const updated = await prisma.package.update({
        where: { id: packageId },
        data: {
          ...(slug && { slug }),
          name: packageName,
          ...(description !== undefined && { description }),
          basePrice: packagePrice,
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
    const generatedSlug =
      slug ||
      packageName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const created = await prisma.package.create({
      data: {
        tenantId,
        slug: generatedSlug,
        name: packageName,
        description: description || null,
        basePrice: packagePrice,
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

    // CRITICAL: Verify tenant ownership before update (prevent cross-tenant access)
    const existingPackage = await prisma.package.findFirst({
      where: { id: packageId, tenantId },
    });

    if (!existingPackage) {
      throw new ResourceNotFoundError(
        'package',
        packageId,
        'Try using get_packages to find available packages.'
      );
    }

    // Soft delete by deactivating (safer than hard delete, now safe after tenant verification)
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

  // add_blackout_date - Block one or more dates
  registerProposalExecutor('add_blackout_date', async (tenantId, payload) => {
    const { dates, newDates, reason, isRange, startDate, endDate } = payload as {
      dates: string[];
      newDates: string[];
      reason: string | null;
      isRange: boolean;
      startDate: string;
      endDate: string;
    };

    // Only create blackouts for dates that don't already exist
    if (newDates.length === 0) {
      return {
        action: 'all_already_blocked',
        totalDays: dates.length,
        alreadyBlocked: dates.length,
        message: 'All requested dates are already blocked.',
      };
    }

    // Create all new blackout dates
    const createdBlackouts = await prisma.blackoutDate.createMany({
      data: newDates.map((dateStr) => ({
        tenantId,
        date: new Date(dateStr),
        reason: reason || null,
      })),
      skipDuplicates: true, // Extra safety for race conditions
    });

    logger.info(
      { tenantId, startDate, endDate, count: createdBlackouts.count },
      'Blackout dates created via agent'
    );

    return {
      action: 'created',
      datesBlocked: newDates,
      count: createdBlackouts.count,
      isRange,
      startDate,
      endDate,
      reason: reason || null,
      ...(dates.length !== newDates.length
        ? { alreadyBlockedCount: dates.length - newDates.length }
        : {}),
    };
  });

  // remove_blackout_date - Unblock a single date by ID
  registerProposalExecutor('remove_blackout_date', async (tenantId, payload) => {
    const { blackoutId, date } = payload as {
      blackoutId: string;
      date: string;
    };

    // Verify ownership - CRITICAL: prevent cross-tenant access
    const blackout = await prisma.blackoutDate.findFirst({
      where: { id: blackoutId, tenantId },
    });

    if (!blackout) {
      throw new ResourceNotFoundError(
        'blackout date',
        blackoutId,
        'Try using get_blackout_dates to find existing blackouts.'
      );
    }

    // Delete the blackout
    await prisma.blackoutDate.delete({
      where: { id: blackoutId },
    });

    logger.info({ tenantId, blackoutId, date }, 'Blackout removed via agent');

    return {
      action: 'removed',
      blackoutId,
      date,
      message: `Date ${date} is now available for bookings.`,
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
        ...((tenant?.branding as Record<string, unknown>) || {}),
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
      updatedSections: Object.keys(payload).filter(
        (k) => payload[k as keyof typeof payload] !== undefined
      ),
    };
  });

  // upsert_addon - Create or update add-on
  registerProposalExecutor('upsert_addon', async (tenantId, payload) => {
    const { addOnId, slug, name, description, price, segmentId, active } = payload as {
      addOnId?: string;
      slug?: string;
      name: string;
      description?: string;
      price: number;
      segmentId?: string;
      active?: boolean;
    };

    if (addOnId) {
      // CRITICAL: Verify tenant ownership before update (prevent cross-tenant access)
      const existingAddOn = await prisma.addOn.findFirst({
        where: { id: addOnId, tenantId },
      });

      if (!existingAddOn) {
        throw new ResourceNotFoundError(
          'add-on',
          addOnId,
          'Try using get_addons to find available add-ons.'
        );
      }

      // Update existing add-on (now safe after tenant verification)
      const updated = await prisma.addOn.update({
        where: { id: addOnId },
        data: {
          ...(slug && { slug }),
          name,
          ...(description !== undefined && { description }),
          price,
          ...(segmentId !== undefined && { segmentId: segmentId || null }),
          ...(active !== undefined && { active }),
        },
      });

      logger.info({ tenantId, addOnId }, 'Add-on updated via agent');
      return {
        action: 'updated',
        addOnId: updated.id,
        name: updated.name,
        price: updated.price,
      };
    }

    // Create new add-on - generate slug if not provided
    const generatedSlug =
      slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const created = await prisma.addOn.create({
      data: {
        tenantId,
        slug: generatedSlug,
        name,
        description: description || null,
        price,
        segmentId: segmentId || null,
        active: active ?? true,
      },
    });

    logger.info({ tenantId, addOnId: created.id }, 'Add-on created via agent');
    return {
      action: 'created',
      addOnId: created.id,
      name: created.name,
      price: created.price,
      slug: created.slug,
    };
  });

  // delete_addon - Remove add-on (soft delete)
  registerProposalExecutor('delete_addon', async (tenantId, payload) => {
    const { addOnId } = payload as { addOnId: string };

    // CRITICAL: Verify tenant ownership before update (prevent cross-tenant access)
    const existingAddOn = await prisma.addOn.findFirst({
      where: { id: addOnId, tenantId },
    });

    if (!existingAddOn) {
      throw new ResourceNotFoundError(
        'add-on',
        addOnId,
        'Try using get_addons to find available add-ons.'
      );
    }

    // Soft delete by deactivating (safer than hard delete, now safe after tenant verification)
    const deleted = await prisma.addOn.update({
      where: { id: addOnId },
      data: { active: false },
    });

    logger.info({ tenantId, addOnId }, 'Add-on deactivated via agent');
    return {
      action: 'deactivated',
      addOnId: deleted.id,
      name: deleted.name,
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
      throw new ResourceNotFoundError(
        'booking',
        bookingId,
        'Try using get_bookings to find available bookings.'
      );
    }

    if (booking.status === 'CANCELED' || booking.status === 'REFUNDED') {
      throw new InvalidStateError('booking', booking.status.toLowerCase(), 'cancel');
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

  // create_booking - Manual booking creation
  // Uses advisory lock + transaction to prevent double-booking race conditions (ADR-013)
  registerProposalExecutor('create_booking', async (tenantId, payload) => {
    const { packageId, date, customerName, customerEmail, customerPhone, notes, totalPrice } =
      payload as {
        packageId: string;
        date: string;
        customerName: string;
        customerEmail: string;
        customerPhone?: string;
        notes?: string;
        totalPrice: number;
      };

    const bookingDate = new Date(date);

    // Wrap entire booking creation in transaction with advisory lock
    // to prevent double-booking race conditions
    return await prisma.$transaction(async (tx) => {
      // Acquire advisory lock for this specific tenant+date combination
      // Lock is automatically released when transaction ends
      const lockId = hashTenantDate(tenantId, date);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

      // CRITICAL: Verify package ownership before creating booking
      const pkg = await tx.package.findFirst({
        where: { id: packageId, tenantId, active: true },
      });

      if (!pkg) {
        throw new ResourceNotFoundError(
          'package',
          packageId,
          'Use get_packages to find available packages.'
        );
      }

      // Check availability AFTER acquiring lock (prevents race condition)
      const existingBooking = await tx.booking.findFirst({
        where: {
          tenantId,
          date: bookingDate,
          status: { notIn: ['CANCELED', 'REFUNDED'] },
        },
      });

      if (existingBooking) {
        throw new DateUnavailableError(
          date,
          'booked',
          'Use check_availability to find open dates.'
        );
      }

      // Find or create customer within transaction
      let customer = await tx.customer.findFirst({
        where: { tenantId, email: customerEmail },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId,
            email: customerEmail,
            name: customerName,
            phone: customerPhone || null,
          },
        });
        logger.info({ tenantId, customerId: customer.id }, 'Customer created via agent booking');
      }

      // Create the booking within same transaction
      const booking = await tx.booking.create({
        data: {
          tenantId,
          customerId: customer.id,
          packageId,
          date: bookingDate,
          totalPrice,
          status: 'CONFIRMED', // Manual bookings are immediately confirmed
          bookingType: 'DATE',
          notes: notes ? `[Manual booking via agent] ${notes}` : '[Manual booking via agent]',
        },
      });

      logger.info({ tenantId, bookingId: booking.id }, 'Manual booking created via agent');

      return {
        action: 'created',
        bookingId: booking.id,
        customerId: customer.id,
        customerName,
        date,
        totalPrice,
        formattedPrice: `$${(totalPrice / 100).toFixed(2)}`,
        status: 'CONFIRMED',
        note: 'Booking confirmed. Remember to collect payment separately if needed.',
      };
    });
  });

  // process_refund - Process refund for a booking
  registerProposalExecutor('process_refund', async (tenantId, payload) => {
    const { bookingId, refundAmount, isFullRefund, reason } = payload as {
      bookingId: string;
      refundAmount: number;
      isFullRefund: boolean;
      reason: string;
    };

    // Get booking to verify ownership
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: { customer: true },
    });

    if (!booking) {
      throw new ResourceNotFoundError(
        'booking',
        bookingId,
        'Try using get_bookings to find available bookings.'
      );
    }

    // Verify refund is still valid
    if (booking.refundStatus === 'COMPLETED') {
      throw new InvalidStateError('booking', 'fully refunded', 'process refund');
    }

    const existingRefundAmount = booking.refundAmount || 0;
    const newTotalRefund = existingRefundAmount + refundAmount;

    // Update booking with refund info
    // Note: Actual Stripe refund would be processed by a background job
    // that monitors PENDING refunds
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        refundStatus: isFullRefund ? 'PENDING' : 'PENDING', // Mark as pending for Stripe processing
        refundAmount: newTotalRefund,
        cancellationReason: reason,
        ...(isFullRefund ? { status: 'REFUNDED' } : {}),
      },
    });

    logger.info({ tenantId, bookingId, refundAmount, isFullRefund }, 'Refund initiated via agent');

    return {
      action: 'refund_initiated',
      bookingId: updated.id,
      customerName: booking.customer?.name || 'Unknown',
      refundAmount,
      totalRefunded: newTotalRefund,
      formattedRefund: `$${(refundAmount / 100).toFixed(2)}`,
      refundType: isFullRefund ? 'full' : 'partial',
      status: 'PENDING',
      note: 'Refund will be processed via Stripe. Customer will be notified.',
    };
  });

  // upsert_segment - Create or update segment
  registerProposalExecutor('upsert_segment', async (tenantId, payload) => {
    const { segmentId, slug, name, heroTitle, heroSubtitle, description, sortOrder, active } =
      payload as {
        segmentId?: string;
        slug: string;
        name: string;
        heroTitle: string;
        heroSubtitle?: string;
        description?: string;
        sortOrder?: number;
        active?: boolean;
      };

    if (segmentId) {
      // CRITICAL: Verify tenant ownership before update
      const existingSegment = await prisma.segment.findFirst({
        where: { id: segmentId, tenantId },
      });

      if (!existingSegment) {
        throw new ResourceNotFoundError(
          'segment',
          segmentId,
          'Try using get_segments to find available segments.'
        );
      }

      // Update existing segment
      const updated = await prisma.segment.update({
        where: { id: segmentId },
        data: {
          slug,
          name,
          heroTitle,
          ...(heroSubtitle !== undefined && { heroSubtitle }),
          ...(description !== undefined && { description }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(active !== undefined && { active }),
        },
      });

      logger.info({ tenantId, segmentId }, 'Segment updated via agent');
      return {
        action: 'updated',
        segmentId: updated.id,
        name: updated.name,
        slug: updated.slug,
      };
    }

    // Create new segment
    const created = await prisma.segment.create({
      data: {
        tenantId,
        slug,
        name,
        heroTitle,
        heroSubtitle: heroSubtitle || null,
        description: description || null,
        sortOrder: sortOrder ?? 0,
        active: active ?? true,
      },
    });

    logger.info({ tenantId, segmentId: created.id }, 'Segment created via agent');
    return {
      action: 'created',
      segmentId: created.id,
      name: created.name,
      slug: created.slug,
    };
  });

  // delete_segment - Soft delete segment
  registerProposalExecutor('delete_segment', async (tenantId, payload) => {
    const { segmentId } = payload as { segmentId: string };

    // CRITICAL: Verify tenant ownership before delete
    const existingSegment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!existingSegment) {
      throw new ResourceNotFoundError(
        'segment',
        segmentId,
        'Try using get_segments to find available segments.'
      );
    }

    // Soft delete by deactivating
    const deleted = await prisma.segment.update({
      where: { id: segmentId },
      data: { active: false },
    });

    logger.info({ tenantId, segmentId }, 'Segment deactivated via agent');
    return {
      action: 'deactivated',
      segmentId: deleted.id,
      name: deleted.name,
    };
  });

  // update_booking - Update booking details (reschedule, notes, status)
  // Preserves payment status and customer info during reschedules
  registerProposalExecutor('update_booking', async (tenantId, payload) => {
    const { bookingId, newDate, newTime, notes, status, notifyCustomer } = payload as {
      bookingId: string;
      newDate?: string;
      newTime?: string;
      notes?: string;
      status?: string;
      notifyCustomer?: boolean;
    };

    // Verify ownership - CRITICAL: tenant isolation
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        customer: { select: { name: true, email: true } },
        package: { select: { name: true } },
      },
    });

    if (!booking) {
      throw new ResourceNotFoundError(
        'booking',
        bookingId,
        'Try using get_bookings to find available bookings.'
      );
    }

    const hasScheduleChange = newDate || newTime;

    // If date or time change, wrap in transaction with advisory lock
    if (hasScheduleChange) {
      return await prisma.$transaction(async (tx) => {
        // Acquire advisory lock for the new date to prevent race conditions
        const lockDate = newDate || booking.date.toISOString().split('T')[0];
        const lockId = hashTenantDate(tenantId, lockDate);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // Build new date object
        const newDateObj = newDate ? new Date(newDate) : booking.date;

        // Check if the new date is already booked (exclude current booking from conflict check)
        const conflictingBooking = await tx.booking.findFirst({
          where: {
            tenantId,
            date: newDateObj,
            id: { not: bookingId }, // Exclude current booking
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
        });

        if (conflictingBooking) {
          throw new DateUnavailableError(
            newDate || lockDate,
            'booked',
            'Use check_availability to find open dates.'
          );
        }

        // Check for blackout date
        const blackout = await tx.blackoutDate.findFirst({
          where: { tenantId, date: newDateObj },
        });

        if (blackout) {
          const reason = blackout.reason ? ` This date is blocked: ${blackout.reason}` : '';
          throw new DateUnavailableError(
            newDate || lockDate,
            'blocked',
            `Please choose another date.${reason}`
          );
        }

        // Build updates - preserve payment info (depositPaidAmount, balancePaidAmount, stripePaymentIntentId, etc.)
        const updates: Prisma.BookingUpdateInput = {};

        if (newDate) {
          updates.date = newDateObj;
          // Update reminder due date (7 days before event)
          updates.reminderDueDate = new Date(newDateObj.getTime() - 7 * 24 * 60 * 60 * 1000);
          // Clear reminder sent flag since date changed
          updates.reminderSentAt = null;
        }

        if (newTime) {
          // Parse time and create startTime
          const [hours, minutes] = newTime.split(':').map(Number);
          const startTimeObj = new Date(newDateObj);
          startTimeObj.setHours(hours, minutes, 0, 0);
          updates.startTime = startTimeObj;
        }

        if (notes !== undefined) {
          updates.notes = notes;
        }

        if (status) {
          if (!isValidBookingStatus(status)) {
            throw new Error(
              `Invalid booking status "${status}". Valid values: ${Object.values(BookingStatus).join(', ')}`
            );
          }
          updates.status = status;
        }

        const updated = await tx.booking.update({
          where: { id: bookingId },
          data: updates,
        });

        const changesList = Object.keys(updates);
        logger.info(
          { tenantId, bookingId, changes: changesList, notifyCustomer },
          'Booking rescheduled via agent'
        );

        // Note: Customer notification would be handled by a separate notification service
        // based on the notifyCustomer flag - for now we log it
        if (notifyCustomer !== false && booking.customer?.email) {
          logger.info(
            { tenantId, bookingId, customerEmail: booking.customer.email },
            'Customer notification pending for booking reschedule'
          );
        }

        return {
          action: 'rescheduled',
          bookingId: updated.id,
          customerName: booking.customer?.name || 'Unknown',
          packageName: booking.package?.name || 'Unknown',
          changes: changesList,
          previousDate: booking.date.toISOString().split('T')[0],
          newDate: newDate || undefined,
          newTime: newTime || undefined,
          newStatus: status || undefined,
          notifyCustomer: notifyCustomer !== false,
          preservedPaymentInfo: true,
        };
      });
    }

    // No schedule change - simple update without transaction
    const updates: Prisma.BookingUpdateInput = {};

    if (notes !== undefined) {
      updates.notes = notes;
    }

    if (status) {
      if (!isValidBookingStatus(status)) {
        throw new Error(
          `Invalid booking status "${status}". Valid values: ${Object.values(BookingStatus).join(', ')}`
        );
      }
      updates.status = status;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: updates,
    });

    const changesList = Object.keys(updates);
    logger.info({ tenantId, bookingId, changes: changesList }, 'Booking updated via agent');

    return {
      action: 'updated',
      bookingId: updated.id,
      customerName: booking.customer?.name || 'Unknown',
      packageName: booking.package?.name || 'Unknown',
      changes: changesList,
      newDate: undefined,
      newTime: undefined,
      newStatus: status || undefined,
      preservedPaymentInfo: true,
    };
  });

  // update_deposit_settings - Update deposit and balance due settings
  registerProposalExecutor('update_deposit_settings', async (tenantId, payload) => {
    const { depositPercent, balanceDueDays } = payload as {
      depositPercent?: number | null;
      balanceDueDays?: number;
    };

    const updates: Prisma.TenantUpdateInput = {};

    if (depositPercent !== undefined) {
      updates.depositPercent = depositPercent;
    }

    if (balanceDueDays !== undefined) {
      updates.balanceDueDays = balanceDueDays;
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: updates,
    });

    logger.info({ tenantId, depositPercent, balanceDueDays }, 'Deposit settings updated via agent');
    return {
      action: 'updated',
      depositPercent: depositPercent ?? undefined,
      balanceDueDays: balanceDueDays ?? undefined,
    };
  });

  // start_trial - Start 14-day trial
  registerProposalExecutor('start_trial', async (tenantId, payload) => {
    const { trialEndsAt } = payload as { trialEndsAt: string };

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionStatus: true },
    });

    if (!tenant) {
      throw new ResourceNotFoundError('business profile', tenantId, 'Please contact support.');
    }

    // Double-check status (race condition protection)
    if (tenant.subscriptionStatus !== 'NONE') {
      throw new InvalidStateError('account', tenant.subscriptionStatus, 'start trial', {
        reason: 'Trial is only available for new accounts.',
      });
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'TRIALING',
        trialEndsAt: new Date(trialEndsAt),
      },
    });

    logger.info({ tenantId, trialEndsAt }, 'Trial started via agent');
    return {
      action: 'trial_started',
      trialEndsAt,
      subscriptionStatus: 'TRIALING',
    };
  });

  // initiate_stripe_onboarding - Set up Stripe Connect payments
  registerProposalExecutor('initiate_stripe_onboarding', async (tenantId, payload) => {
    const { email, businessName, hasExistingAccount } = payload as {
      email: string;
      businessName: string | null;
      hasExistingAccount: boolean;
    };

    // Import StripeConnectService dynamically to avoid circular deps
    const { StripeConnectService } = await import('../../services/stripe-connect.service');
    const stripeConnectService = new StripeConnectService(prisma);

    // Check if STRIPE_SECRET_KEY is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new ConfigurationError('Payment processing', 'Contact support for assistance.');
    }

    let accountId: string;

    if (hasExistingAccount) {
      // Resume onboarding for existing account
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeAccountId: true, slug: true },
      });

      if (!tenant?.stripeAccountId) {
        throw new ResourceNotFoundError(
          'Stripe account',
          tenantId,
          'Please try again or contact support.'
        );
      }

      accountId = tenant.stripeAccountId;
      logger.info({ tenantId, accountId }, 'Resuming Stripe onboarding via agent');
    } else {
      // Create new connected account
      accountId = await stripeConnectService.createConnectedAccount(
        tenantId,
        email,
        businessName || 'My Business',
        'US'
      );
      logger.info({ tenantId, accountId }, 'Created Stripe Connect account via agent');
    }

    // Generate onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const refreshUrl = `${baseUrl}/tenant/dashboard?stripe=retry`;
    const returnUrl = `${baseUrl}/tenant/dashboard?stripe=complete`;

    const onboardingUrl = await stripeConnectService.createOnboardingLink(
      tenantId,
      refreshUrl,
      returnUrl
    );

    logger.info({ tenantId, accountId }, 'Stripe onboarding link created via agent');

    return {
      action: hasExistingAccount ? 'resumed_onboarding' : 'started_onboarding',
      onboardingUrl,
      accountId,
      note: 'Open this link to complete your Stripe payment setup.',
    };
  });

  logger.info('Agent proposal executors registered');
}
