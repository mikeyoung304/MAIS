/**
 * Shared in-memory storage for mock adapters
 *
 * All mock repositories share these Maps/Sets to simulate a database.
 * Extracted from the monolithic index.ts for maintainability.
 */

import type { Tier, AddOn } from '../../lib/entities';
import type { Booking } from '../../lib/entities';
import type { User, EarlyAccessRequest } from '../../lib/ports';

// Default tenant ID for mock mode (single-tenant simulation)
export const DEFAULT_TENANT = 'tenant_default_legacy';

// In-memory storage
export const tiers = new Map<string, Tier>();
export const addOns = new Map<string, AddOn>();
export const bookings = new Map<string, Booking>(); // keyed by booking ID
export const bookingsByDate = new Map<string, string>(); // date -> booking ID
export const blackouts = new Map<string, { date: string; reason?: string }>();
export const calendarBusyDates = new Set<string>();
export const users = new Map<string, User>();
export const webhookEvents = new Map<
  string,
  {
    eventId: string;
    eventType: string;
    status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'DUPLICATE';
  }
>();
export const earlyAccessRequests = new Map<string, EarlyAccessRequest>();

// In-memory tenant storage for mock mode
// Phase 5.2 Section Content Migration: landingPageConfig columns removed
// All storefront content now stored in SectionContent table
export interface MockTenant {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  apiKeyPublic: string;
  apiKeySecret: string;
  commissionPercent: number;
  branding: Record<string, unknown>;
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
  isActive: boolean;
  isTestTenant: boolean;
  tier: 'FREE' | 'STARTER' | 'PRO';
  onboardingStatus: string;
  createdAt: Date;
  updatedAt: Date;
}
export const tenants = new Map<string, MockTenant>();
