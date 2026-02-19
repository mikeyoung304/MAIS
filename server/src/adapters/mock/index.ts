/**
 * Mock adapters for local development without external services
 *
 * Phase 2 Migration: All Package references renamed to Tier.
 * In-memory storage uses `tiers` Map instead of `packages` Map.
 *
 * Decomposed into domain-specific files for maintainability:
 * - state.ts: Shared in-memory Maps/Sets
 * - seed.ts: Seed data initialization
 * - *.repository.ts / *.provider.ts: Domain mock implementations
 */

// Trigger seed data initialization on first import
import { seedData } from './seed';
seedData();

// Re-export shared state types (for consumers that need MockTenant)
export type { MockTenant } from './state';

// Re-export all domain mock classes
export { MockCatalogRepository } from './catalog.repository';
export { MockBookingRepository } from './booking.repository';
export { MockBlackoutRepository } from './blackout.repository';
export { MockCalendarProvider } from './calendar.provider';
export { MockPaymentProvider } from './payment.provider';
export { MockEmailProvider } from './email.provider';
export { MockUserRepository } from './user.repository';
export { MockWebhookRepository } from './webhook.repository';
export { MockEarlyAccessRepository } from './early-access.repository';
export { MockTenantRepository } from './tenant.repository';

// Export MockSectionContentRepository for section content testing
export { MockSectionContentRepository } from './section-content.repository';

// Import classes for builder function
import { MockCatalogRepository } from './catalog.repository';
import { MockBookingRepository } from './booking.repository';
import { MockBlackoutRepository } from './blackout.repository';
import { MockCalendarProvider } from './calendar.provider';
import { MockPaymentProvider } from './payment.provider';
import { MockEmailProvider } from './email.provider';
import { MockUserRepository } from './user.repository';
import { MockWebhookRepository } from './webhook.repository';
import { MockEarlyAccessRepository } from './early-access.repository';
import { MockTenantRepository } from './tenant.repository';

// Import shared state for getMockState and resetMockState
import {
  tiers,
  addOns,
  blackouts,
  bookings,
  bookingsByDate,
  calendarBusyDates,
  webhookEvents,
  earlyAccessRequests,
} from './state';
import { logger } from '../../lib/core/logger';

// Export builder function
export function buildMockAdapters() {
  return {
    catalogRepo: new MockCatalogRepository(),
    bookingRepo: new MockBookingRepository(),
    blackoutRepo: new MockBlackoutRepository(),
    calendarProvider: new MockCalendarProvider(),
    paymentProvider: new MockPaymentProvider(),
    emailProvider: new MockEmailProvider(),
    userRepo: new MockUserRepository(),
    webhookRepo: new MockWebhookRepository(),
    earlyAccessRepo: new MockEarlyAccessRepository(),
    tenantRepo: new MockTenantRepository(),
  };
}

/**
 * Get current in-memory state for debugging (dev mode only)
 */
export function getMockState() {
  return {
    tiers: Array.from(tiers.values()),
    addOns: Array.from(addOns.values()),
    blackouts: Array.from(blackouts.values()),
    bookings: Array.from(bookings.values()),
  };
}

/**
 * Reset mock state to initial seeded state (E2E test determinism)
 */
export function resetMockState() {
  bookings.clear();
  bookingsByDate.clear();
  blackouts.clear();
  calendarBusyDates.clear();
  webhookEvents.clear();
  earlyAccessRequests.clear();

  logger.debug('Mock state reset to seed data');
}
