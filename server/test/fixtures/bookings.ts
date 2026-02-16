/**
 * Booking fixtures for integration tests
 *
 * Provides reusable booking data for testing payment flows,
 * cancellations, and commission calculations.
 */

import type { Booking } from '../../src/lib/entities';

/**
 * Create a booking fixture with sensible defaults
 */
export function createBookingFixture(overrides: Partial<Booking> = {}): Booking {
  return {
    id: `booking_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    tierId: 'pkg_test_classic',
    coupleName: 'Jane & John Doe',
    email: 'couple@example.com',
    eventDate: '2025-06-15',
    addOnIds: [],
    totalCents: 250000, // $2,500.00
    commissionAmount: undefined,
    commissionPercent: undefined,
    status: 'PAID',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a booking with commission data
 * Useful for testing commission tracking and refunds
 */
export function createBookingWithCommission(
  packagePrice: number,
  commissionPercent: number,
  overrides: Partial<Booking> = {}
): Booking {
  const commissionAmount = Math.ceil(packagePrice * (commissionPercent / 100));

  return createBookingFixture({
    totalCents: packagePrice,
    commissionAmount,
    commissionPercent,
    ...overrides,
  });
}

/**
 * Create a booking with add-ons
 * Tests commission calculation on package + add-ons
 */
export function createBookingWithAddOns(
  packagePrice: number,
  addOnPrices: number[],
  addOnIds: string[],
  commissionPercent: number,
  overrides: Partial<Booking> = {}
): Booking {
  const subtotal = packagePrice + addOnPrices.reduce((sum, price) => sum + price, 0);
  const commissionAmount = Math.ceil(subtotal * (commissionPercent / 100));

  return createBookingFixture({
    totalCents: subtotal,
    addOnIds,
    commissionAmount,
    commissionPercent,
    ...overrides,
  });
}

/**
 * Booking scenarios for common test cases
 */
export const BookingScenarios = {
  /**
   * Standard $2,500 package with 12% commission
   */
  standard: () =>
    createBookingWithCommission(250000, 12.0, {
      tierId: 'pkg_classic',
      coupleName: 'Alice & Bob',
      email: 'alice.bob@example.com',
      eventDate: '2025-07-15',
    }),

  /**
   * Premium $5,000 package with 10% commission
   */
  premium: () =>
    createBookingWithCommission(500000, 10.0, {
      tierId: 'pkg_premium',
      coupleName: 'Carol & Dave',
      email: 'carol.dave@example.com',
      eventDate: '2025-08-20',
    }),

  /**
   * Package with add-ons totaling $3,000 (12% commission)
   */
  withAddOns: (addOnIds: string[]) =>
    createBookingWithAddOns(
      250000, // $2,500 package
      [30000, 20000], // $300 + $200 add-ons
      addOnIds,
      12.0,
      {
        tierId: 'pkg_classic',
        coupleName: 'Eve & Frank',
        email: 'eve.frank@example.com',
        eventDate: '2025-09-10',
      }
    ),

  /**
   * Low-cost package for edge case testing
   */
  lowCost: () =>
    createBookingWithCommission(10000, 12.0, {
      tierId: 'pkg_starter',
      coupleName: 'Grace & Henry',
      email: 'grace.henry@example.com',
      eventDate: '2025-10-05',
    }),

  /**
   * Booking near cancellation deadline (for refund policy tests)
   */
  nearDeadline: () => {
    // 8 days from now (assuming 7-day cancellation policy)
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 8);

    return createBookingWithCommission(250000, 12.0, {
      tierId: 'pkg_classic',
      coupleName: 'Ivy & Jack',
      email: 'ivy.jack@example.com',
      eventDate: eventDate.toISOString().split('T')[0],
    });
  },

  /**
   * Booking past cancellation deadline
   */
  pastDeadline: () => {
    // 5 days from now (assuming 7-day cancellation policy)
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 5);

    return createBookingWithCommission(250000, 12.0, {
      tierId: 'pkg_classic',
      coupleName: 'Kate & Leo',
      email: 'kate.leo@example.com',
      eventDate: eventDate.toISOString().split('T')[0],
    });
  },
};

/**
 * Calculate expected commission for a booking
 * Uses same rounding logic as CommissionService (always round up)
 */
export function calculateExpectedCommission(totalCents: number, commissionPercent: number): number {
  return Math.ceil(totalCents * (commissionPercent / 100));
}

/**
 * Calculate expected refund commission (proportional)
 * Used for partial refund scenarios
 */
export function calculateRefundCommission(
  originalCommission: number,
  refundAmount: number,
  originalTotal: number
): number {
  if (refundAmount >= originalTotal) {
    return originalCommission; // Full refund
  }

  const refundRatio = refundAmount / originalTotal;
  return Math.ceil(originalCommission * refundRatio);
}
