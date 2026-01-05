/**
 * Booking Link Tool Executors
 *
 * Implements execution logic for booking link write tool proposals.
 * These are registered with the proposal executor registry during initialization.
 *
 * Each executor:
 * 1. Receives tenantId and payload from the confirmed proposal
 * 2. Executes actual database operations
 * 3. Returns structured results for logging and display
 *
 * Architecture:
 * - Uses transactions for atomic operations
 * - Validates tenant ownership before all mutations (tenant isolation)
 * - Returns IDs and URLs for newly created resources
 */

import type { PrismaClient } from '../../generated/prisma';
import { registerProposalExecutor } from '../proposals/executor-registry';
import { logger } from '../../lib/core/logger';
import { MissingFieldError, ResourceNotFoundError, ValidationError } from '../errors';
import { getTenantInfo } from '../utils/tenant-info';
import {
  generateServiceSlug,
  buildBookingUrl,
  type WorkingHoursEntry,
} from '@macon/contracts';

// ============================================================================
// Types
// ============================================================================

interface CreateServicePayload {
  name: string;
  slug?: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  maxPerDay?: number | null;
}

interface UpdateServicePayload {
  serviceId: string;
  updates: {
    name?: string;
    durationMinutes?: number;
    priceCents?: number;
    description?: string;
    bufferMinutes?: number;
    minNoticeMinutes?: number;
    maxAdvanceDays?: number;
    maxPerDay?: number | null;
    active?: boolean;
  };
}

interface DeleteServicePayload {
  serviceId: string;
}

interface ManageWorkingHoursPayload {
  workingHours: WorkingHoursEntry[];
  timezone?: string;
}

interface AddDateOverridePayload {
  date: string;
  available: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

interface RemoveDateOverridePayload {
  date: string;
}

interface ClearDateOverridesPayload {
  startDate: string;
  endDate: string;
}

// ============================================================================
// Executor Registration
// ============================================================================

/**
 * Register all booking link-related executors
 * Call this during server initialization alongside registerAllExecutors()
 */
export function registerBookingLinkExecutors(prisma: PrismaClient): void {
  // ============================================================================
  // manage_bookable_service - Create/Update/Delete services
  // ============================================================================

  registerProposalExecutor('manage_bookable_service', async (tenantId, payload) => {
    // Determine operation type based on payload structure
    if ('updates' in payload) {
      // Update operation
      const typedPayload = payload as unknown as UpdateServicePayload;
      const { serviceId, updates } = typedPayload;

      if (!serviceId) {
        throw new MissingFieldError('serviceId', 'manage_bookable_service');
      }

      // Verify service exists and belongs to tenant
      const existing = await prisma.service.findFirst({
        where: { id: serviceId, tenantId },
      });

      if (!existing) {
        throw new ResourceNotFoundError('Service', serviceId);
      }

      // Build Prisma update data
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.durationMinutes !== undefined) updateData.durationMinutes = updates.durationMinutes;
      if (updates.priceCents !== undefined) updateData.priceCents = updates.priceCents;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.bufferMinutes !== undefined) updateData.bufferMinutes = updates.bufferMinutes;
      if (updates.active !== undefined) updateData.active = updates.active;
      // Phase 1: Booking link scheduling fields now stored in database
      if (updates.minNoticeMinutes !== undefined) updateData.minNoticeMinutes = updates.minNoticeMinutes;
      if (updates.maxAdvanceDays !== undefined) updateData.maxAdvanceDays = updates.maxAdvanceDays;
      if (updates.maxPerDay !== undefined) updateData.maxPerDay = updates.maxPerDay;

      // Use transaction with updateMany for tenant isolation, then fetch updated record
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.service.updateMany({
          where: { id: serviceId, tenantId },
          data: updateData,
        });

        if (result.count === 0) {
          throw new ResourceNotFoundError('Service', serviceId);
        }

        return tx.service.findFirstOrThrow({
          where: { id: serviceId, tenantId },
        });
      });

      logger.info(
        { tenantId, serviceId, updates: Object.keys(updates) },
        'Service updated via booking link executor'
      );

      // Get tenant info for URL
      const tenantInfo = await getTenantInfo(prisma, tenantId);
      const bookingUrl = tenantInfo
        ? buildBookingUrl(tenantInfo.slug, updated.slug, tenantInfo.customDomain)
        : undefined;

      return {
        action: 'updated',
        serviceId: updated.id,
        serviceName: updated.name,
        bookingUrl,
      };
    } else if ('serviceId' in payload && !('name' in payload)) {
      // Delete operation
      const typedPayload = payload as unknown as DeleteServicePayload;
      const { serviceId } = typedPayload;

      if (!serviceId) {
        throw new MissingFieldError('serviceId', 'manage_bookable_service');
      }

      // Verify service exists and belongs to tenant
      const existing = await prisma.service.findFirst({
        where: { id: serviceId, tenantId },
      });

      if (!existing) {
        throw new ResourceNotFoundError('Service', serviceId);
      }

      // Use transaction with row lock to prevent TOCTOU race condition
      // A booking could be created between the check and delete without this
      await prisma.$transaction(async (tx) => {
        // Lock the service row to prevent concurrent modifications
        await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;

        // Check for upcoming bookings within the transaction
        const upcomingBookings = await tx.booking.count({
          where: {
            serviceId,
            tenantId,
            date: { gte: new Date() },
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        });

        if (upcomingBookings > 0) {
          throw new ValidationError(
            `Cannot delete service with ${upcomingBookings} upcoming booking(s). Cancel or complete them first.`
          );
        }

        // Delete the service with tenant isolation (defense-in-depth)
        const deleted = await tx.service.deleteMany({
          where: { id: serviceId, tenantId },
        });

        if (deleted.count === 0) {
          throw new ResourceNotFoundError('Service', serviceId);
        }
      });

      logger.info(
        { tenantId, serviceId, serviceName: existing.name },
        'Service deleted via booking link executor'
      );

      return {
        action: 'deleted',
        serviceId,
        serviceName: existing.name,
      };
    } else {
      // Create operation
      const typedPayload = payload as unknown as CreateServicePayload;
      const {
        name,
        description,
        durationMinutes,
        priceCents,
        bufferMinutes,
        minNoticeMinutes,
        maxAdvanceDays,
        maxPerDay,
      } = typedPayload;

      if (!name) {
        throw new MissingFieldError('name', 'manage_bookable_service');
      }
      if (durationMinutes === undefined) {
        throw new MissingFieldError('durationMinutes', 'manage_bookable_service');
      }

      // Generate slug
      const slug = typedPayload.slug || generateServiceSlug(name);

      // Check for existing slug
      const existing = await prisma.service.findFirst({
        where: { tenantId, slug },
      });

      if (existing) {
        throw new ValidationError(
          `A service with slug "${slug}" already exists. Choose a different name.`
        );
      }

      // Get tenant info for timezone and URL building (single query, #628 fix)
      const tenantInfo = await getTenantInfo(prisma, tenantId, { includeTimezone: true });
      const serviceTimezone = tenantInfo?.timezone ?? 'America/New_York';

      // Get max sort order
      const maxSortOrder = await prisma.service.aggregate({
        where: { tenantId },
        _max: { sortOrder: true },
      });

      // Create the service with Phase 1 scheduling fields
      const service = await prisma.service.create({
        data: {
          tenantId,
          name,
          slug,
          description: description || null,
          durationMinutes,
          priceCents: priceCents ?? 0,
          bufferMinutes: bufferMinutes ?? 0,
          timezone: serviceTimezone,
          active: true,
          sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
          // Phase 1: Booking link scheduling fields
          minNoticeMinutes: minNoticeMinutes ?? 120,
          maxAdvanceDays: maxAdvanceDays ?? 60,
          maxPerDay: maxPerDay ?? null,
        },
      });

      logger.info(
        { tenantId, serviceId: service.id, slug },
        'Service created via booking link executor'
      );

      // Build URL from tenant info fetched earlier (#628 fix - reuse single query)
      const bookingUrl = tenantInfo
        ? buildBookingUrl(tenantInfo.slug, slug, tenantInfo.customDomain)
        : undefined;

      return {
        action: 'created',
        serviceId: service.id,
        serviceName: service.name,
        slug: service.slug,
        bookingUrl,
      };
    }
  });

  // ============================================================================
  // manage_working_hours - Update availability rules
  // ============================================================================

  registerProposalExecutor('manage_working_hours', async (tenantId, payload) => {
    const typedPayload = payload as unknown as ManageWorkingHoursPayload;
    const { workingHours, timezone } = typedPayload;

    if (!workingHours || workingHours.length === 0) {
      throw new MissingFieldError('workingHours', 'manage_working_hours');
    }

    // Use transaction to replace all default availability rules
    await prisma.$transaction(async (tx) => {
      // Delete existing default rules (serviceId = null applies to all services)
      await tx.availabilityRule.deleteMany({
        where: { tenantId, serviceId: null },
      });

      // Create new rules for active days using batch insert (#623 optimization)
      const activeRules = workingHours
        .filter((entry) => entry.isActive)
        .map((entry) => ({
          tenantId,
          serviceId: null, // Default for all services
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
        }));

      if (activeRules.length > 0) {
        await tx.availabilityRule.createMany({
          data: activeRules,
        });
      }

      // Update tenant timezone if provided (#627 fix - now implemented)
      if (timezone) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { timezone },
        });
      }
    });

    logger.info(
      { tenantId, activeDays: workingHours.filter((h) => h.isActive).length, timezoneUpdated: !!timezone },
      'Working hours updated via executor'
    );

    return {
      action: 'updated',
      workingHours,
      timezone: timezone ?? 'unchanged',
      timezoneUpdated: !!timezone,
    };
  });

  // ============================================================================
  // manage_date_overrides - Add/Remove/Clear date overrides
  // ============================================================================

  registerProposalExecutor('manage_date_overrides', async (tenantId, payload) => {
    // Determine operation type based on payload structure
    if ('startDate' in payload && 'endDate' in payload) {
      // Clear range operation
      const typedPayload = payload as unknown as ClearDateOverridesPayload;
      const { startDate, endDate } = typedPayload;

      // Validate date range (#624 fix)
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        throw new ValidationError(
          `Invalid date range: startDate (${startDate}) must be before or equal to endDate (${endDate})`
        );
      }

      // Delete all blackout dates in range
      const deleted = await prisma.blackoutDate.deleteMany({
        where: {
          tenantId,
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      });

      logger.info(
        { tenantId, startDate, endDate, deletedCount: deleted.count },
        'Date overrides cleared via executor'
      );

      return {
        action: 'cleared',
        range: `${startDate} to ${endDate}`,
        deletedCount: deleted.count,
      };
    } else if ('available' in payload) {
      // Add override operation
      const typedPayload = payload as unknown as AddDateOverridePayload;
      const { date, available, startTime, endTime, reason } = typedPayload;

      const targetDate = new Date(date);

      // Upsert the blackout date
      // Note: For "available" with special hours, we're using BlackoutDate.
      // In Phase 1, consider adding DateOverride model for more flexibility.
      if (!available) {
        // Block the date
        await prisma.blackoutDate.upsert({
          where: {
            tenantId_date: {
              tenantId,
              date: targetDate,
            },
          },
          create: {
            tenantId,
            date: targetDate,
            reason: reason || 'Blocked via assistant',
          },
          update: {
            reason: reason || 'Blocked via assistant',
          },
        });
      } else {
        // For special hours, we'd need the DateOverride model
        // For now, just ensure the date is not blocked
        await prisma.blackoutDate.deleteMany({
          where: { tenantId, date: targetDate },
        });
      }

      logger.info(
        { tenantId, date, available, reason },
        'Date override added via executor'
      );

      return {
        action: 'added',
        date,
        available,
        reason,
      };
    } else {
      // Remove override operation
      const typedPayload = payload as unknown as RemoveDateOverridePayload;
      const { date } = typedPayload;

      const targetDate = new Date(date);

      const deleted = await prisma.blackoutDate.deleteMany({
        where: { tenantId, date: targetDate },
      });

      logger.info(
        { tenantId, date, deleted: deleted.count > 0 },
        'Date override removed via executor'
      );

      return {
        action: 'removed',
        date,
        wasDeleted: deleted.count > 0,
      };
    }
  });

  logger.info('Booking link proposal executors registered');
}
