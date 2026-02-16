/**
 * Mock adapters for local development without external services
 *
 * Phase 2 Migration: All Package references renamed to Tier.
 * In-memory storage uses `tiers` Map instead of `packages` Map.
 */

import { toUtcMidnight } from '@macon/shared';
import type { Tier, AddOn } from '../../lib/entities';
import type { CatalogRepository, CreateTierInput, UpdateTierInput } from '../../lib/ports';
import type { Booking } from '../../lib/entities';
import type { BookingRepository, TimeslotBooking, AppointmentDto } from '../../lib/ports';
import type { BlackoutRepository, CalendarProvider, WebhookRepository } from '../../lib/ports';
import type { PaymentProvider, CheckoutSession } from '../../lib/ports';
import type { EmailProvider } from '../../lib/ports';
import type { User, UserRepository } from '../../lib/ports';
import type { EarlyAccessRepository, EarlyAccessRequest } from '../../lib/ports';
import { BookingConflictError, NotFoundError } from '../../lib/errors';
import bcrypt from 'bcryptjs';
import type Stripe from 'stripe';
import { logger } from '../../lib/core/logger';

// Default tenant ID for mock mode (single-tenant simulation)
const DEFAULT_TENANT = 'tenant_default_legacy';

// In-memory storage
const tiers = new Map<string, Tier>();
const addOns = new Map<string, AddOn>();
const bookings = new Map<string, Booking>(); // keyed by booking ID
const bookingsByDate = new Map<string, string>(); // date -> booking ID
const blackouts = new Map<string, { date: string; reason?: string }>();
const calendarBusyDates = new Set<string>();
const users = new Map<string, User>();
const webhookEvents = new Map<
  string,
  {
    eventId: string;
    eventType: string;
    status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'DUPLICATE';
  }
>();
const earlyAccessRequests = new Map<string, EarlyAccessRequest>();

// In-memory tenant storage for mock mode
// Phase 5.2 Section Content Migration: landingPageConfig columns removed
// All storefront content now stored in SectionContent table
interface MockTenant {
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
  onboardingPhase: string;
  createdAt: Date;
  updatedAt: Date;
}
const tenants = new Map<string, MockTenant>();

// Seed default tenant for mock mode
function seedTenants(): void {
  if (tenants.size > 0) return; // Already seeded

  // Default test tenant for mock mode
  tenants.set(DEFAULT_TENANT, {
    id: DEFAULT_TENANT,
    slug: 'test-studio',
    name: 'Test Photography Studio',
    email: 'test@example.com',
    apiKeyPublic: `pk_live_test-studio_mock123`,
    apiKeySecret: `sk_live_test-studio_mock456`,
    commissionPercent: 10,
    branding: {
      businessType: 'photography',
      industry: 'creative services',
      tagline: 'Capturing moments that last forever',
      discoveryFacts: {
        businessName: 'Test Photography Studio',
        targetAudience: 'couples and families',
        uniqueSellingPoint: 'personalized service',
      },
    },
    stripeAccountId: null,
    stripeOnboarded: false,
    isActive: true,
    isTestTenant: false,
    tier: 'PRO',
    onboardingPhase: 'COMPLETED',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  logger.debug('Mock tenant seeded: test-studio');
}

// Seed data on module load
// NOTE: Tier slugs MUST match demo.ts seed slugs (starter, growth, enterprise)
// to ensure booking links work correctly across mock and real modes.
function seedData(): void {
  if (tiers.size > 0) return; // Already seeded

  // Seed tenants first (for tenant isolation in mock mode)
  seedTenants();

  // Tiers - aligned with demo.ts seed slugs for consistency
  tiers.set('tier_starter', {
    id: 'tier_starter',
    tenantId: DEFAULT_TENANT,
    slug: 'starter',
    title: 'Starter Tier',
    description:
      'Essential business services to get you started. Perfect for solopreneurs ready to focus on their craft.',
    priceCents: 25000, // $250
    photoUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
    bookingType: 'DATE',
  });

  tiers.set('tier_growth', {
    id: 'tier_growth',
    tenantId: DEFAULT_TENANT,
    slug: 'growth',
    title: 'Growth Tier',
    description: 'Full-service support for growing businesses. Scale with confidence.',
    priceCents: 50000, // $500
    photoUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
    bookingType: 'DATE',
  });

  tiers.set('tier_enterprise', {
    id: 'tier_enterprise',
    tenantId: DEFAULT_TENANT,
    slug: 'enterprise',
    title: 'Enterprise Tier',
    description: 'Comprehensive solutions for established businesses. Your complete back office.',
    priceCents: 100000, // $1,000
    photoUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
    bookingType: 'DATE',
  });

  // Add-ons - aligned with demo.ts seed add-ons for consistency
  addOns.set('addon_social_media', {
    id: 'addon_social_media',
    tierId: 'tier_starter',
    title: 'Social Media Management',
    description: 'Monthly social media content and posting',
    priceCents: 15000, // $150
    photoUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
  });

  addOns.set('addon_email_marketing', {
    id: 'addon_email_marketing',
    tierId: 'tier_starter',
    title: 'Email Marketing',
    description: 'Automated email sequences and campaigns',
    priceCents: 10000, // $100
    photoUrl: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=400&h=300&fit=crop',
  });

  addOns.set('addon_crm_setup', {
    id: 'addon_crm_setup',
    tierId: 'tier_growth',
    title: 'CRM Setup & Training',
    description: 'Custom CRM configuration and onboarding',
    priceCents: 25000, // $250
    photoUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
  });

  addOns.set('addon_dedicated_manager', {
    id: 'addon_dedicated_manager',
    tierId: 'tier_enterprise',
    title: 'Dedicated Account Manager',
    description: 'Personal point of contact for all your needs',
    priceCents: 50000, // $500
    photoUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop',
  });

  // Admin user
  // OWASP 2023 recommendation for bcrypt rounds
  const passwordHash = bcrypt.hashSync('admin123', 12);
  users.set('admin@macon.com', {
    id: 'user_admin',
    email: 'admin@macon.com',
    passwordHash,
    role: 'admin',
  });

  logger.debug('Mock data seeded: 3 tiers, 4 add-ons, 1 admin user');
}

// Initialize seed data
seedData();

// Mock Catalog Repository
export class MockCatalogRepository implements CatalogRepository {
  async getAllTiers(_tenantId: string, _options?: { take?: number }): Promise<Tier[]> {
    return Array.from(tiers.values());
  }

  async getAllTiersWithAddOns(
    _tenantId: string,
    _options?: { take?: number }
  ): Promise<Array<Tier & { addOns: AddOn[] }>> {
    const allTiers = Array.from(tiers.values());
    return allTiers.map((tier) => ({
      ...tier,
      addOns: Array.from(addOns.values()).filter((a) => a.tierId === tier.id),
    }));
  }

  async getTierBySlug(_tenantId: string, slug: string): Promise<Tier | null> {
    const tier = Array.from(tiers.values()).find((t) => t.slug === slug);
    return tier || null;
  }

  async getTierBySlugWithAddOns(
    _tenantId: string,
    slug: string
  ): Promise<(Tier & { addOns: AddOn[] }) | null> {
    const tier = Array.from(tiers.values()).find((t) => t.slug === slug);
    if (!tier) {
      return null;
    }
    return {
      ...tier,
      addOns: Array.from(addOns.values()).filter((a) => a.tierId === tier.id),
    };
  }

  async getTierById(_tenantId: string, id: string): Promise<Tier | null> {
    return tiers.get(id) || null;
  }

  async getTierByIdWithAddOns(
    _tenantId: string,
    id: string
  ): Promise<(Tier & { addOns: AddOn[] }) | null> {
    const tier = tiers.get(id);
    if (!tier) return null;
    return {
      ...tier,
      addOns: Array.from(addOns.values()).filter((a) => a.tierId === tier.id),
    };
  }

  async getTiersByIds(_tenantId: string, ids: string[]): Promise<Tier[]> {
    return ids.map((id) => tiers.get(id)).filter((tier): tier is Tier => tier !== undefined);
  }

  async getAllAddOns(_tenantId: string, _options?: { take?: number }): Promise<AddOn[]> {
    return Array.from(addOns.values());
  }

  async getAddOnsByTierId(_tenantId: string, tierId: string): Promise<AddOn[]> {
    return Array.from(addOns.values()).filter((a) => a.tierId === tierId);
  }

  async getAddOnById(_tenantId: string, id: string): Promise<AddOn | null> {
    return addOns.get(id) || null;
  }

  async createTier(tenantId: string, data: CreateTierInput): Promise<Tier> {
    // Check slug uniqueness
    const existing = await this.getTierBySlug(tenantId, data.slug);
    if (existing) {
      throw new Error(`Tier with slug "${data.slug}" already exists`);
    }

    const tier: Tier = {
      id: `tier_${Date.now()}`,
      tenantId,
      slug: data.slug,
      title: data.title,
      description: data.description,
      priceCents: data.priceCents,
      displayPriceCents: data.displayPriceCents ?? null,
      photos: data.photos || [],
      active: true,
      segmentId: data.segmentId ?? null,
      groupingOrder: data.groupingOrder ?? null,
      bookingType: 'DATE',
      maxGuests: data.maxGuests ?? null,
      scalingRules: data.scalingRules ?? null,
    };
    tiers.set(tier.id, tier);
    return tier;
  }

  async updateTier(tenantId: string, id: string, data: UpdateTierInput): Promise<Tier> {
    const tier = tiers.get(id);
    if (!tier) {
      throw new Error(`Tier with id "${id}" not found`);
    }

    // Check slug uniqueness if updating slug
    if (data.slug && data.slug !== tier.slug) {
      const existing = await this.getTierBySlug(tenantId, data.slug);
      if (existing) {
        throw new Error(`Tier with slug "${data.slug}" already exists`);
      }
    }

    const updated: Tier = {
      ...tier,
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
      ...(data.displayPriceCents !== undefined && { displayPriceCents: data.displayPriceCents }),
      ...(data.segmentId !== undefined && { segmentId: data.segmentId }),
      ...(data.groupingOrder !== undefined && { groupingOrder: data.groupingOrder }),
      ...(data.photos !== undefined && { photos: data.photos }),
      ...(data.maxGuests !== undefined && { maxGuests: data.maxGuests }),
      ...(data.scalingRules !== undefined && { scalingRules: data.scalingRules }),
    };
    tiers.set(id, updated);
    return updated;
  }

  async deleteTier(_tenantId: string, id: string): Promise<void> {
    const tier = tiers.get(id);
    if (!tier) {
      throw new Error(`Tier with id "${id}" not found`);
    }

    // Also delete associated add-ons
    const tierAddOns = Array.from(addOns.values()).filter((a) => a.tierId === id);
    tierAddOns.forEach((addOn) => addOns.delete(addOn.id));

    tiers.delete(id);
  }

  async createAddOn(
    _tenantId: string,
    data: {
      tierId: string;
      title: string;
      priceCents: number;
      photoUrl?: string;
    }
  ): Promise<AddOn> {
    // Verify tier exists
    const tier = tiers.get(data.tierId);
    if (!tier) {
      throw new Error(`Tier with id "${data.tierId}" not found`);
    }

    const addOn: AddOn = {
      id: `addon_${Date.now()}`,
      ...data,
    };
    addOns.set(addOn.id, addOn);
    return addOn;
  }

  async updateAddOn(
    _tenantId: string,
    id: string,
    data: {
      tierId?: string;
      title?: string;
      priceCents?: number;
      photoUrl?: string;
    }
  ): Promise<AddOn> {
    const addOn = addOns.get(id);
    if (!addOn) {
      throw new Error(`AddOn with id "${id}" not found`);
    }

    // Verify tier exists if updating tierId
    if (data.tierId && data.tierId !== addOn.tierId) {
      const tier = tiers.get(data.tierId);
      if (!tier) {
        throw new Error(`Tier with id "${data.tierId}" not found`);
      }
    }

    const updated: AddOn = {
      ...addOn,
      ...data,
    };
    addOns.set(id, updated);
    return updated;
  }

  async deleteAddOn(_tenantId: string, id: string): Promise<void> {
    const addOn = addOns.get(id);
    if (!addOn) {
      throw new Error(`AddOn with id "${id}" not found`);
    }
    addOns.delete(id);
  }

  // Segment-scoped methods
  async getTiersBySegment(
    _tenantId: string,
    segmentId: string,
    _options?: { take?: number }
  ): Promise<Tier[]> {
    return Array.from(tiers.values()).filter((t) => t.segmentId === segmentId);
  }

  async getTiersBySegmentWithAddOns(
    _tenantId: string,
    segmentId: string,
    _options?: { take?: number }
  ): Promise<Array<Tier & { addOns: AddOn[] }>> {
    const segmentTiers = Array.from(tiers.values()).filter((t) => t.segmentId === segmentId);
    return segmentTiers.map((tier) => ({
      ...tier,
      addOns: Array.from(addOns.values()).filter((a) => a.tierId === tier.id),
    }));
  }

  async getAddOnsForSegment(
    _tenantId: string,
    segmentId: string,
    _options?: { take?: number }
  ): Promise<AddOn[]> {
    const segmentTiers = Array.from(tiers.values()).filter((t) => t.segmentId === segmentId);
    const tierIds = new Set(segmentTiers.map((t) => t.id));
    return Array.from(addOns.values()).filter((a) => tierIds.has(a.tierId));
  }
}

// Mock Booking Repository
export class MockBookingRepository implements BookingRepository {
  async create(
    _tenantId: string,
    booking: Booking,
    paymentData?: {
      amount: number;
      processor: string;
      processorId: string;
    }
  ): Promise<Booking> {
    // Mock mode: Ignore tenantId and paymentData (no Payment table in mock)
    const dateKey = toUtcMidnight(booking.eventDate);

    // Enforce unique by date
    if (bookingsByDate.has(dateKey)) {
      throw new BookingConflictError(dateKey);
    }

    bookings.set(booking.id, booking);
    bookingsByDate.set(dateKey, booking.id);

    // P2 #037: In mock mode, we just log payment data
    // Real Prisma implementation creates Payment record atomically
    if (paymentData) {
      logger.debug(
        {
          bookingId: booking.id,
          amount: paymentData.amount / 100,
          processor: paymentData.processor,
          processorId: paymentData.processorId,
        },
        'Mock payment recorded for booking'
      );
    }

    return booking;
  }

  async findById(_tenantId: string, id: string): Promise<Booking | null> {
    return bookings.get(id) || null;
  }

  async findAll(
    _tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Booking[]> {
    const all = Array.from(bookings.values());
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return all.slice(offset, offset + limit);
  }

  async isDateBooked(_tenantId: string, date: string): Promise<boolean> {
    const dateKey = toUtcMidnight(date);
    return bookingsByDate.has(dateKey);
  }

  async getUnavailableDates(_tenantId: string, startDate: Date, endDate: Date): Promise<Date[]> {
    const unavailable: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const booking of bookings.values()) {
      const bookingDate = new Date(booking.eventDate);
      if (bookingDate >= start && bookingDate <= end && booking.status === 'PAID') {
        unavailable.push(bookingDate);
      }
    }

    return unavailable.sort((a, b) => a.getTime() - b.getTime());
  }

  async updateGoogleEventId(
    _tenantId: string,
    bookingId: string,
    googleEventId: string
  ): Promise<void> {
    const booking = bookings.get(bookingId);
    if (booking) {
      (booking as any).googleEventId = googleEventId;
      logger.debug({ bookingId, googleEventId }, 'Updated booking with Google event ID');
    }
  }

  async update(
    _tenantId: string,
    bookingId: string,
    data: {
      eventDate?: string;
      status?: 'CANCELED';
      cancelledAt?: Date;
      cancelledBy?: 'CUSTOMER' | 'TENANT' | 'ADMIN' | 'SYSTEM';
      cancellationReason?: string;
      refundStatus?: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
      refundAmount?: number;
      refundedAt?: Date;
      stripeRefundId?: string;
    }
  ): Promise<Booking> {
    const booking = bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (data.eventDate !== undefined) {
      const oldDateKey = toUtcMidnight(booking.eventDate);
      const newDateKey = toUtcMidnight(data.eventDate);
      bookingsByDate.delete(oldDateKey);
      bookingsByDate.set(newDateKey, bookingId);
      booking.eventDate = data.eventDate;
    }
    if (data.status !== undefined) {
      booking.status = data.status;
    }

    if (data.cancelledAt !== undefined) {
      (booking as any).cancelledAt = data.cancelledAt;
    }
    if (data.cancelledBy !== undefined) {
      (booking as any).cancelledBy = data.cancelledBy;
    }
    if (data.cancellationReason !== undefined) {
      (booking as any).cancellationReason = data.cancellationReason;
    }
    if (data.refundStatus !== undefined) {
      (booking as any).refundStatus = data.refundStatus;
    }
    if (data.refundAmount !== undefined) {
      (booking as any).refundAmount = data.refundAmount;
    }
    if (data.refundedAt !== undefined) {
      (booking as any).refundedAt = data.refundedAt;
    }
    if (data.stripeRefundId !== undefined) {
      (booking as any).stripeRefundId = data.stripeRefundId;
    }

    logger.debug({ bookingId, data }, 'Mock booking updated');
    return booking;
  }

  async reschedule(_tenantId: string, bookingId: string, newDate: string): Promise<Booking> {
    const booking = bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (booking.status === 'CANCELED') {
      throw new Error(`Booking ${bookingId} is already cancelled`);
    }

    const newDateKey = toUtcMidnight(newDate);

    const existingId = bookingsByDate.get(newDateKey);
    if (existingId && existingId !== bookingId) {
      const existingBooking = bookings.get(existingId);
      if (existingBooking && existingBooking.status !== 'CANCELED') {
        throw new BookingConflictError(newDate);
      }
    }

    const oldDateKey = toUtcMidnight(booking.eventDate);
    bookingsByDate.delete(oldDateKey);
    bookingsByDate.set(newDateKey, bookingId);
    booking.eventDate = newDate;

    const eventDate = new Date(newDate + 'T00:00:00Z');
    const now = new Date();
    const daysUntilEvent = Math.floor(
      (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    (booking as any).reminderDueDate =
      daysUntilEvent > 7
        ? new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : undefined;

    (booking as any).reminderSentAt = undefined;

    logger.debug({ bookingId, newDate }, 'Mock booking rescheduled');
    return booking;
  }

  async findTimeslotBookings(
    _tenantId: string,
    date: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]> {
    logger.debug(
      { date: date.toISOString(), serviceId: serviceId || 'all' },
      'findTimeslotBookings called'
    );
    return [];
  }

  async findTimeslotBookingsInRange(
    _tenantId: string,
    startDate: Date,
    endDate: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]> {
    logger.debug(
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        serviceId: serviceId || 'all',
      },
      'findTimeslotBookingsInRange called'
    );
    return [];
  }

  async countTimeslotBookingsForServiceOnDate(
    _tenantId: string,
    serviceId: string,
    date: Date
  ): Promise<number> {
    logger.debug(
      {
        serviceId,
        date: date.toISOString(),
      },
      'countTimeslotBookingsForServiceOnDate called'
    );
    return 0;
  }

  async findAppointments(
    tenantId: string,
    filters?: {
      status?: string;
      serviceId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AppointmentDto[]> {
    const MAX_LIMIT = 500;
    const DEFAULT_LIMIT = 100;

    const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(filters?.offset ?? 0, 0);

    logger.debug({ tenantId, filters, limit, offset }, 'findAppointments called');
    return [];
  }

  async findBookingsNeedingReminders(_tenantId: string, limit: number = 10): Promise<Booking[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: Booking[] = [];
    for (const booking of bookings.values()) {
      if (booking.status !== 'PAID') continue;

      const reminderDueDate = (booking as any).reminderDueDate;
      const reminderSentAt = (booking as any).reminderSentAt;

      if (reminderDueDate && !reminderSentAt) {
        const dueDate = new Date(reminderDueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate <= today) {
          result.push(booking);
          if (result.length >= limit) break;
        }
      }
    }

    logger.debug(
      { tenantId: _tenantId, count: result.length },
      'findBookingsNeedingReminders called'
    );
    return result;
  }

  async markReminderSent(_tenantId: string, bookingId: string): Promise<void> {
    const booking = bookings.get(bookingId);
    if (booking) {
      (booking as any).reminderSentAt = new Date().toISOString();
      logger.debug({ bookingId }, 'Reminder marked as sent');
    }
  }

  /**
   * Complete balance payment atomically
   * P1-147 FIX: Mock implementation - in-memory is naturally atomic
   */
  async completeBalancePayment(
    _tenantId: string,
    bookingId: string,
    balanceAmountCents: number
  ): Promise<Booking | null> {
    const booking = bookings.get(bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Idempotent: If balance already paid, return null
    if ((booking as any).balancePaidAt) {
      return null;
    }

    // Update booking with balance paid
    (booking as any).balancePaidAmount = balanceAmountCents;
    (booking as any).balancePaidAt = new Date().toISOString();
    booking.status = 'PAID';

    return booking;
  }
}

// Mock Blackout Repository
export class MockBlackoutRepository implements BlackoutRepository {
  async isBlackoutDate(_tenantId: string, date: string): Promise<boolean> {
    const dateKey = toUtcMidnight(date);
    return blackouts.has(dateKey);
  }

  async getAllBlackouts(_tenantId: string): Promise<Array<{ date: string; reason?: string }>> {
    return Array.from(blackouts.values());
  }

  async addBlackout(_tenantId: string, date: string, reason?: string): Promise<void> {
    const dateKey = toUtcMidnight(date);
    blackouts.set(dateKey, { date: dateKey, reason });
  }

  async deleteBlackout(_tenantId: string, id: string): Promise<void> {
    const dateKey = toUtcMidnight(id);
    blackouts.delete(dateKey);
  }

  async findBlackoutById(
    _tenantId: string,
    id: string
  ): Promise<{ id: string; date: string; reason?: string } | null> {
    const dateKey = toUtcMidnight(id);
    const blackout = blackouts.get(dateKey);
    if (!blackout) return null;
    return {
      id: dateKey,
      ...blackout,
    };
  }
}

// Mock Calendar Provider
export class MockCalendarProvider implements CalendarProvider {
  private mockEvents = new Map<
    string,
    {
      eventId: string;
      summary: string;
      startTime: Date;
      endTime: Date;
      tenantId: string;
    }
  >();

  async isDateAvailable(date: string): Promise<boolean> {
    const dateKey = toUtcMidnight(date);
    return !calendarBusyDates.has(dateKey);
  }

  // Helper method to mark dates as busy (for testing)
  markBusy(date: string): void {
    const dateKey = toUtcMidnight(date);
    calendarBusyDates.add(dateKey);
  }

  async createEvent(input: {
    tenantId: string;
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: { email: string; name?: string }[];
    metadata?: Record<string, string>;
  }): Promise<{ eventId: string } | null> {
    const eventId = `mock_gcal_event_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.mockEvents.set(eventId, {
      eventId,
      summary: input.summary,
      startTime: input.startTime,
      endTime: input.endTime,
      tenantId: input.tenantId,
    });

    logger.debug(
      {
        eventId,
        summary: input.summary,
        startTime: input.startTime.toISOString(),
        endTime: input.endTime.toISOString(),
        attendees: input.attendees?.map((a) => a.email).join(', '),
      },
      'Mock Google Calendar event created'
    );

    return { eventId };
  }

  async deleteEvent(_tenantId: string, eventId: string): Promise<boolean> {
    const event = this.mockEvents.get(eventId);

    if (!event) {
      logger.debug({ eventId }, 'Mock Google Calendar event not found');
      return false;
    }

    this.mockEvents.delete(eventId);
    logger.debug(
      {
        eventId,
        summary: event.summary,
      },
      'Mock Google Calendar event deleted'
    );

    return true;
  }

  getMockEvents(): Array<{ eventId: string; summary: string; startTime: Date; endTime: Date }> {
    return Array.from(this.mockEvents.values());
  }
}

// Mock Payment Provider
export class MockPaymentProvider implements PaymentProvider {
  private idempotencyCache = new Map<string, CheckoutSession>();

  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    idempotencyKey?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    if (input.idempotencyKey && this.idempotencyCache.has(input.idempotencyKey)) {
      return this.idempotencyCache.get(input.idempotencyKey)!;
    }

    const sessionId = `mock_session_${Date.now()}`;
    const checkoutUrl = input.successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId);

    const session: CheckoutSession = {
      url: checkoutUrl,
      sessionId,
    };

    if (input.idempotencyKey) {
      this.idempotencyCache.set(input.idempotencyKey, session);
    }

    return session;
  }

  async createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string;
    applicationFeeAmount: number;
    idempotencyKey?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    if (input.idempotencyKey && this.idempotencyCache.has(input.idempotencyKey)) {
      return this.idempotencyCache.get(input.idempotencyKey)!;
    }

    const sessionId = `mock_connect_session_${Date.now()}`;
    const checkoutUrl = input.successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId);

    const session: CheckoutSession = {
      url: checkoutUrl,
      sessionId,
    };

    if (input.idempotencyKey) {
      this.idempotencyCache.set(input.idempotencyKey, session);
    }

    return session;
  }

  async verifyWebhook(_payload: string, _signature: string): Promise<Stripe.Event> {
    return {
      id: 'evt_mock_123',
      object: 'event',
      api_version: '2025-10-29.clover',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'mock_session_verified',
        } as Stripe.Checkout.Session,
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
    } as Stripe.Event;
  }

  async refund(input: {
    paymentIntentId: string;
    amountCents?: number;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<{
    refundId: string;
    status: string;
    amountCents: number;
  }> {
    return {
      refundId: `mock_refund_${Date.now()}`,
      status: 'succeeded',
      amountCents: input.amountCents || 100000,
    };
  }
}

// Mock Email Provider
export class MockEmailProvider implements EmailProvider {
  async sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
    logger.debug(
      {
        to: input.to,
        subject: input.subject,
        bodyPreview: input.html.substring(0, 100),
      },
      'Mock email sent'
    );
  }
}

// Mock User Repository
export class MockUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return users.get(email) || null;
  }
}

// Mock Webhook Repository
export class MockWebhookRepository implements WebhookRepository {
  async isDuplicate(_tenantId: string, eventId: string): Promise<boolean> {
    const existing = webhookEvents.get(eventId);
    if (existing) {
      existing.status = 'DUPLICATE';
      return true;
    }
    return false;
  }

  async recordWebhook(input: {
    tenantId: string;
    eventId: string;
    eventType: string;
    rawPayload: string;
  }): Promise<boolean> {
    if (webhookEvents.has(input.eventId)) {
      return false;
    }
    webhookEvents.set(input.eventId, {
      eventId: input.eventId,
      eventType: input.eventType,
      status: 'PENDING',
    });
    return true;
  }

  async markProcessed(_tenantId: string, eventId: string): Promise<void> {
    const event = webhookEvents.get(eventId);
    if (event) {
      event.status = 'PROCESSED';
    }
  }

  async markFailed(_tenantId: string, eventId: string, errorMessage: string): Promise<void> {
    const event = webhookEvents.get(eventId);
    if (event) {
      event.status = 'FAILED';
    }
    logger.debug({ eventId, errorMessage }, 'Mock webhook failed');
  }
}

// Mock Early Access Repository
export class MockEarlyAccessRepository implements EarlyAccessRepository {
  async upsert(
    email: string,
    source: string
  ): Promise<{ request: EarlyAccessRequest; isNew: boolean }> {
    const existing = earlyAccessRequests.get(email);
    const now = new Date();

    if (existing) {
      existing.updatedAt = now;
      logger.debug({ email }, 'Mock early access request updated');
      return { request: existing, isNew: false };
    }

    const request: EarlyAccessRequest = {
      id: `ear_${Date.now()}`,
      email,
      source,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    earlyAccessRequests.set(email, request);
    logger.debug({ email, id: request.id }, 'Mock early access request created');
    return { request, isNew: true };
  }
}

// Export MockSectionContentRepository for section content testing
export { MockSectionContentRepository } from './section-content.repository';

/**
 * Mock Tenant Repository
 *
 * Provides in-memory tenant storage for unit tests without database access.
 * Seeded with a default test tenant for immediate use.
 *
 * Note: Only implements methods needed for HTTP endpoint testing.
 * Full PrismaTenantRepository has many more methods for landing page config, etc.
 */
export class MockTenantRepository {
  async findById(id: string): Promise<MockTenant | null> {
    return tenants.get(id) || null;
  }

  async findBySlug(slug: string): Promise<MockTenant | null> {
    return Array.from(tenants.values()).find((t) => t.slug === slug) || null;
  }

  async findByApiKey(apiKey: string): Promise<MockTenant | null> {
    return Array.from(tenants.values()).find((t) => t.apiKeyPublic === apiKey) || null;
  }

  async findByEmail(email: string): Promise<MockTenant | null> {
    return (
      Array.from(tenants.values()).find((t) => t.email?.toLowerCase() === email.toLowerCase()) ||
      null
    );
  }

  async create(data: {
    id?: string;
    slug: string;
    name: string;
    email?: string;
    apiKeyPublic?: string;
    apiKeySecret?: string;
    commissionPercent?: number;
    branding?: Record<string, unknown>;
    tier?: 'FREE' | 'STARTER' | 'PRO';
  }): Promise<MockTenant> {
    const id = data.id || `tenant_${Date.now()}`;
    const tenant: MockTenant = {
      id,
      slug: data.slug,
      name: data.name,
      email: data.email || null,
      apiKeyPublic: data.apiKeyPublic || `pk_live_${data.slug}_${Date.now()}`,
      apiKeySecret: data.apiKeySecret || `sk_live_${data.slug}_${Date.now()}`,
      commissionPercent: data.commissionPercent ?? 10,
      branding: data.branding || {},
      stripeAccountId: null,
      stripeOnboarded: false,
      isActive: true,
      isTestTenant: false,
      tier: data.tier || 'FREE',
      onboardingPhase: 'NOT_STARTED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    tenants.set(id, tenant);
    logger.debug({ id, slug: data.slug }, 'Mock tenant created');
    return tenant;
  }

  async update(id: string, data: Partial<MockTenant>): Promise<MockTenant> {
    const tenant = tenants.get(id);
    if (!tenant) {
      throw new NotFoundError(`Tenant ${id} not found`);
    }
    const updated: MockTenant = {
      ...tenant,
      ...data,
      updatedAt: new Date(),
    };
    tenants.set(id, updated);
    return updated;
  }

  async list(): Promise<MockTenant[]> {
    return Array.from(tenants.values());
  }

  getDefaultTenantId(): string {
    return DEFAULT_TENANT;
  }
}

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
