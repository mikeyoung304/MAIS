/**
 * Dev-only controller for mock mode simulators
 */

import { toUtcMidnight } from '@macon/shared';
import type { BookingService } from '../services/booking.service';
import type { CatalogService } from '../services/catalog.service';
import type { CatalogRepository, BookingRepository } from '../lib/ports';
import { getMockState, resetMockState } from '../adapters/mock';
import { logger } from '../lib/core/logger';
import { generateBookingToken, type BookingTokenAction } from '../lib/booking-tokens';

// Default tenant for dev simulator (mock mode)
const DEFAULT_TENANT = 'tenant_default_legacy';

export class DevController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly catalogService: CatalogService,
    private readonly catalogRepo: CatalogRepository,
    private readonly bookingRepo?: BookingRepository
  ) {}

  /**
   * Simulate a completed checkout without going through Stripe
   */
  async simulateCheckoutCompleted(input: {
    sessionId: string;
    tierId: string;
    eventDate: string;
    email: string;
    coupleName: string;
    addOnIds?: string[];
  }): Promise<{ bookingId: string }> {
    logger.info(
      {
        sessionId: input.sessionId,
        tierId: input.tierId,
        eventDate: input.eventDate,
      },
      '🧪 Simulating checkout completion'
    );

    // Normalize date
    const normalizedDate = toUtcMidnight(input.eventDate);

    // Get tier to calculate total
    const tier = await this.catalogService.getTierById(DEFAULT_TENANT, input.tierId);
    if (!tier) {
      throw new Error(`Tier ${input.tierId} not found`);
    }

    // Calculate total
    let totalCents = tier.priceCents;
    if (input.addOnIds && input.addOnIds.length > 0) {
      const addOns = await this.catalogRepo.getAddOnsByTierId(DEFAULT_TENANT, tier.id);
      const selectedAddOns = addOns.filter((a) => input.addOnIds?.includes(a.id));
      totalCents += selectedAddOns.reduce((sum, a) => sum + a.priceCents, 0);
    }

    // Call the same domain path used by webhook handler
    const booking = await this.bookingService.onPaymentCompleted(DEFAULT_TENANT, {
      sessionId: input.sessionId,
      tierId: tier.id,
      eventDate: normalizedDate,
      email: input.email,
      coupleName: input.coupleName,
      addOnIds: input.addOnIds || [],
      totalCents,
    });

    logger.info({ bookingId: booking.id }, '✅ Checkout simulation completed');

    return { bookingId: booking.id };
  }

  /**
   * Get current in-memory state for debugging
   */
  async getDebugState() {
    logger.info('🔍 Fetching debug state');
    return getMockState();
  }

  /**
   * Reset in-memory state to initial seed (E2E test determinism)
   */
  async reset(): Promise<void> {
    logger.info('🔄 Resetting mock state');
    resetMockState();
  }

  /**
   * Generate a booking management token for E2E testing
   * Returns the token and a full URL for easy testing
   */
  async generateBookingToken(input: {
    bookingId: string;
    action?: BookingTokenAction;
    expiresInDays?: number;
  }): Promise<{
    token: string;
    url: string;
    booking: {
      id: string;
      email: string;
      coupleName: string;
      eventDate: string;
      status: string;
    } | null;
  }> {
    const action = input.action || 'manage';
    const expiresInDays = input.expiresInDays || 7;

    // Get the booking to return details for verification
    let booking = null;
    if (this.bookingRepo) {
      const bookingData = await this.bookingRepo.findById(DEFAULT_TENANT, input.bookingId);
      if (bookingData) {
        booking = {
          id: bookingData.id,
          email: bookingData.email,
          coupleName: bookingData.coupleName,
          eventDate: bookingData.eventDate,
          status: bookingData.status,
        };
      }
    }

    const token = generateBookingToken(input.bookingId, DEFAULT_TENANT, action, expiresInDays);
    const url = `http://localhost:5173/bookings/manage?token=${token}`;

    logger.info({ bookingId: input.bookingId, action }, '🎟️ Generated booking management token');

    return { token, url, booking };
  }

  /**
   * Create a booking and return its management token
   * Convenience method for E2E tests that need a complete booking + token
   */
  async createBookingWithToken(input: {
    tierId: string;
    eventDate: string;
    email: string;
    coupleName: string;
    addOnIds?: string[];
  }): Promise<{ bookingId: string; token: string; url: string }> {
    // Create the booking via checkout simulation
    const sessionId = `mock_session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const { bookingId } = await this.simulateCheckoutCompleted({
      sessionId,
      ...input,
    });

    // Generate a management token for it
    const token = generateBookingToken(bookingId, DEFAULT_TENANT, 'manage');
    const url = `http://localhost:5173/bookings/manage?token=${token}`;

    logger.info({ bookingId }, '🎟️ Created booking with management token');

    return { bookingId, token, url };
  }
}
