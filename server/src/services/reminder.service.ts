/**
 * Reminder Service
 *
 * Implements lazy reminder evaluation - reminders are processed when
 * the tenant admin views the dashboard, not via cron jobs.
 *
 * MVP Design Decision (from plans/mvp-gaps-phased-implementation.md):
 * - No new database models (uses existing Booking fields)
 * - No cron jobs (lazy evaluation on dashboard load)
 * - Reuses existing Postmark adapter
 */

import type { BookingRepository, CatalogRepository } from '../lib/ports';
import type { Booking } from '../lib/entities';
import type { EventEmitter } from '../lib/core/events';
import { BookingEvents } from '../lib/core/events';
import { logger } from '../lib/core/logger';
import { generateManageBookingUrl } from '../lib/booking-tokens';

/**
 * Result of processing pending reminders
 */
export interface ProcessRemindersResult {
  processed: number;
  failed: number;
  bookings: Array<{
    id: string;
    coupleName: string;
    eventDate: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Reminder Service
 *
 * Handles lazy evaluation of booking reminders. When a tenant admin
 * views their dashboard, this service checks for any pending reminders
 * and processes them inline (non-blocking).
 */
export class ReminderService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly catalogRepo: CatalogRepository,
    private readonly eventEmitter: EventEmitter
  ) {}

  /**
   * Check and process pending reminders for a tenant
   *
   * Called from dashboard API when tenant admin loads their dashboard.
   * This implements the "lazy evaluation" pattern - no cron jobs needed.
   *
   * @param tenantId - Tenant ID for isolation
   * @param limit - Maximum reminders to process in one batch (default 10)
   * @returns Result of processing
   */
  async processOverdueReminders(
    tenantId: string,
    limit: number = 10
  ): Promise<ProcessRemindersResult> {
    const result: ProcessRemindersResult = {
      processed: 0,
      failed: 0,
      bookings: [],
    };

    try {
      // Find bookings needing reminders
      const bookingsToRemind = await this.bookingRepo.findBookingsNeedingReminders(tenantId, limit);

      if (bookingsToRemind.length === 0) {
        logger.debug({ tenantId }, 'No pending reminders found');
        return result;
      }

      logger.info({ tenantId, count: bookingsToRemind.length }, 'Processing overdue reminders');

      // Batch fetch all tiers to avoid N+1 query (filter out null tierIds for TIMESLOT bookings)
      const tierIds = [
        ...new Set(bookingsToRemind.map((b) => b.tierId).filter((id): id is string => id !== null)),
      ];
      const tiers =
        tierIds.length > 0 ? await this.catalogRepo.getTiersByIds(tenantId, tierIds) : [];
      const tierMap = new Map(tiers.map((t) => [t.id, t]));

      // Process each reminder
      for (const booking of bookingsToRemind) {
        try {
          const tier = booking.tierId ? tierMap.get(booking.tierId) : undefined;
          await this.sendReminderForBooking(tenantId, booking, tier);

          // Mark reminder as sent
          await this.bookingRepo.markReminderSent(tenantId, booking.id);

          result.processed++;
          result.bookings.push({
            id: booking.id,
            coupleName: booking.coupleName,
            eventDate: booking.eventDate,
            success: true,
          });
        } catch (error) {
          result.failed++;
          result.bookings.push({
            id: booking.id,
            coupleName: booking.coupleName,
            eventDate: booking.eventDate,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          logger.error({ bookingId: booking.id, error }, 'Failed to send reminder');
        }
      }

      logger.info(
        { tenantId, processed: result.processed, failed: result.failed },
        'Reminder processing complete'
      );

      return result;
    } catch (error) {
      logger.error({ tenantId, error }, 'Error processing reminders');
      throw error;
    }
  }

  /**
   * Send a reminder email for a specific booking
   */
  private async sendReminderForBooking(
    tenantId: string,
    booking: Booking,
    tier?: { id: string; title: string }
  ): Promise<void> {
    // Use provided tier (batch-fetched) or default
    const tierName = tier?.title || 'Your Booking';

    // Calculate days until event
    const eventDate = new Date(booking.eventDate + 'T00:00:00Z');
    const now = new Date();
    const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Generate manage booking URL
    const manageUrl = generateManageBookingUrl(booking.id, tenantId);

    // Emit event for email sending
    // The notification handler will pick this up and send the actual email
    await this.eventEmitter.emit(BookingEvents.REMINDER_DUE, {
      bookingId: booking.id,
      tenantId,
      email: booking.email,
      coupleName: booking.coupleName,
      eventDate: booking.eventDate,
      tierName: tierName,
      daysUntilEvent,
      manageUrl,
    });

    logger.debug({ bookingId: booking.id, daysUntilEvent }, 'Booking reminder event emitted');
  }

  /**
   * Get count of pending reminders for dashboard display
   *
   * @param tenantId - Tenant ID for isolation
   * @returns Number of pending reminders
   */
  async getPendingReminderCount(tenantId: string): Promise<number> {
    const pending = await this.bookingRepo.findBookingsNeedingReminders(
      tenantId,
      100 // Just need the count
    );
    return pending.length;
  }

  /**
   * Get list of bookings that will receive reminders soon
   * (useful for dashboard preview)
   */
  async getUpcomingReminders(
    tenantId: string,
    limit: number = 5
  ): Promise<
    Array<{
      bookingId: string;
      coupleName: string;
      eventDate: string;
      reminderDueDate: string;
      daysUntilEvent: number;
    }>
  > {
    const pending = await this.bookingRepo.findBookingsNeedingReminders(tenantId, limit);

    const now = new Date();

    return pending.map((booking) => {
      const eventDate = new Date(booking.eventDate + 'T00:00:00Z');
      const daysUntilEvent = Math.ceil(
        (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        bookingId: booking.id,
        coupleName: booking.coupleName,
        eventDate: booking.eventDate,
        reminderDueDate: booking.reminderDueDate || booking.eventDate,
        daysUntilEvent,
      };
    });
  }
}
