/**
 * Mock adapters for local development without external services
 */

import { toUtcMidnight } from '@macon/shared';
import type { Package, AddOn } from '../lib/entities';
import type { CatalogRepository, PackageWithDraft, UpdatePackageDraftInput } from '../lib/ports';
import type { Booking } from '../lib/entities';
import type { BookingRepository, TimeslotBooking, AppointmentDto } from '../lib/ports';
import type { BlackoutRepository, CalendarProvider, WebhookRepository } from '../lib/ports';
import type { PaymentProvider, CheckoutSession } from '../lib/ports';
import type { EmailProvider } from '../lib/ports';
import type { User, UserRepository } from '../lib/ports';
import type { EarlyAccessRepository, EarlyAccessRequest } from '../lib/ports';
import { BookingConflictError, NotFoundError } from '../../lib/errors';
import bcrypt from 'bcryptjs';
import type Stripe from 'stripe';
import { logger } from '../lib/core/logger';

// Default tenant ID for mock mode (single-tenant simulation)
const DEFAULT_TENANT = 'tenant_default_legacy';

// In-memory storage
const packages = new Map<string, Package>();
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

// Seed data on module load
// NOTE: Package slugs MUST match demo.ts seed slugs (starter, growth, enterprise)
// to ensure booking links work correctly across mock and real modes.
// See TODO #396 for context on this alignment requirement.
function seedData(): void {
  if (packages.size > 0) return; // Already seeded

  // Packages - aligned with demo.ts seed slugs for consistency
  packages.set('pkg_starter', {
    id: 'pkg_starter',
    tenantId: DEFAULT_TENANT,
    slug: 'starter',
    title: 'Starter Package',
    description:
      'Essential business services to get you started. Perfect for solopreneurs ready to focus on their craft.',
    priceCents: 25000, // $250
    photoUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  });

  packages.set('pkg_growth', {
    id: 'pkg_growth',
    tenantId: DEFAULT_TENANT,
    slug: 'growth',
    title: 'Growth Package',
    description: 'Full-service support for growing businesses. Scale with confidence.',
    priceCents: 50000, // $500
    photoUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  });

  packages.set('pkg_enterprise', {
    id: 'pkg_enterprise',
    tenantId: DEFAULT_TENANT,
    slug: 'enterprise',
    title: 'Enterprise Package',
    description: 'Comprehensive solutions for established businesses. Your complete back office.',
    priceCents: 100000, // $1,000
    photoUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  });

  // Add-ons - aligned with demo.ts seed add-ons for consistency
  addOns.set('addon_social_media', {
    id: 'addon_social_media',
    packageId: 'pkg_starter',
    title: 'Social Media Management',
    description: 'Monthly social media content and posting',
    priceCents: 15000, // $150
    photoUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
  });

  addOns.set('addon_email_marketing', {
    id: 'addon_email_marketing',
    packageId: 'pkg_starter',
    title: 'Email Marketing',
    description: 'Automated email sequences and campaigns',
    priceCents: 10000, // $100
    photoUrl: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=400&h=300&fit=crop',
  });

  addOns.set('addon_crm_setup', {
    id: 'addon_crm_setup',
    packageId: 'pkg_growth',
    title: 'CRM Setup & Training',
    description: 'Custom CRM configuration and onboarding',
    priceCents: 25000, // $250
    photoUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
  });

  addOns.set('addon_dedicated_manager', {
    id: 'addon_dedicated_manager',
    packageId: 'pkg_enterprise',
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

  logger.debug('Mock data seeded: 3 packages, 4 add-ons, 1 admin user');
}

// Initialize seed data
seedData();

// Mock Catalog Repository
export class MockCatalogRepository implements CatalogRepository {
  async getAllPackages(_tenantId: string): Promise<Package[]> {
    // Mock mode: Ignore tenantId, return all packages
    return Array.from(packages.values());
  }

  async getAllPackagesWithAddOns(_tenantId: string): Promise<Array<Package & { addOns: AddOn[] }>> {
    // Mock mode: Ignore tenantId, return all packages
    const allPackages = Array.from(packages.values());
    return allPackages.map((pkg) => ({
      ...pkg,
      addOns: Array.from(addOns.values()).filter((a) => a.packageId === pkg.id),
    }));
  }

  async getPackageBySlug(_tenantId: string, slug: string): Promise<Package | null> {
    // Mock mode: Ignore tenantId
    const pkg = Array.from(packages.values()).find((p) => p.slug === slug);
    return pkg || null;
  }

  async getPackageBySlugWithAddOns(
    _tenantId: string,
    slug: string
  ): Promise<(Package & { addOns: AddOn[] }) | null> {
    // Mock mode: Ignore tenantId
    const pkg = Array.from(packages.values()).find((p) => p.slug === slug);
    if (!pkg) {
      return null;
    }
    return {
      ...pkg,
      addOns: Array.from(addOns.values()).filter((a) => a.packageId === pkg.id),
    };
  }

  async getPackageById(_tenantId: string, id: string): Promise<Package | null> {
    // Mock mode: Ignore tenantId
    return packages.get(id) || null;
  }

  async getPackagesByIds(_tenantId: string, ids: string[]): Promise<Package[]> {
    // Mock mode: Ignore tenantId
    return ids.map((id) => packages.get(id)).filter((pkg): pkg is Package => pkg !== undefined);
  }

  async getAllAddOns(_tenantId: string): Promise<AddOn[]> {
    // Mock mode: Ignore tenantId, return all add-ons
    return Array.from(addOns.values());
  }

  async getAddOnsByPackageId(_tenantId: string, packageId: string): Promise<AddOn[]> {
    // Mock mode: Ignore tenantId
    return Array.from(addOns.values()).filter((a) => a.packageId === packageId);
  }

  async getAddOnById(_tenantId: string, id: string): Promise<AddOn | null> {
    // Mock mode: Ignore tenantId
    return addOns.get(id) || null;
  }

  async createPackage(
    tenantId: string,
    data: {
      slug: string;
      title: string;
      description: string;
      priceCents: number;
      photoUrl?: string;
    }
  ): Promise<Package> {
    // Check slug uniqueness
    const existing = await this.getPackageBySlug(tenantId, data.slug);
    if (existing) {
      throw new Error(`Package with slug "${data.slug}" already exists`);
    }

    const pkg: Package = {
      id: `pkg_${Date.now()}`,
      tenantId,
      ...data,
      photos: [],
    };
    packages.set(pkg.id, pkg);
    return pkg;
  }

  async updatePackage(
    tenantId: string,
    id: string,
    data: {
      slug?: string;
      title?: string;
      description?: string;
      priceCents?: number;
      photoUrl?: string;
    }
  ): Promise<Package> {
    const pkg = packages.get(id);
    if (!pkg) {
      throw new Error(`Package with id "${id}" not found`);
    }

    // Check slug uniqueness if updating slug
    if (data.slug && data.slug !== pkg.slug) {
      const existing = await this.getPackageBySlug(tenantId, data.slug);
      if (existing) {
        throw new Error(`Package with slug "${data.slug}" already exists`);
      }
    }

    const updated: Package = {
      ...pkg,
      ...data,
    };
    packages.set(id, updated);
    return updated;
  }

  async deletePackage(_tenantId: string, id: string): Promise<void> {
    // Mock mode: Ignore tenantId
    const pkg = packages.get(id);
    if (!pkg) {
      throw new Error(`Package with id "${id}" not found`);
    }

    // Also delete associated add-ons
    const packageAddOns = Array.from(addOns.values()).filter((a) => a.packageId === id);
    packageAddOns.forEach((addOn) => addOns.delete(addOn.id));

    packages.delete(id);
  }

  async createAddOn(
    _tenantId: string,
    data: {
      packageId: string;
      title: string;
      priceCents: number;
      photoUrl?: string;
    }
  ): Promise<AddOn> {
    // Verify package exists
    const pkg = packages.get(data.packageId);
    if (!pkg) {
      throw new Error(`Package with id "${data.packageId}" not found`);
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
      packageId?: string;
      title?: string;
      priceCents?: number;
      photoUrl?: string;
    }
  ): Promise<AddOn> {
    const addOn = addOns.get(id);
    if (!addOn) {
      throw new Error(`AddOn with id "${id}" not found`);
    }

    // Verify package exists if updating packageId
    if (data.packageId && data.packageId !== addOn.packageId) {
      const pkg = packages.get(data.packageId);
      if (!pkg) {
        throw new Error(`Package with id "${data.packageId}" not found`);
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
    // Mock mode: Ignore tenantId
    const addOn = addOns.get(id);
    if (!addOn) {
      throw new Error(`AddOn with id "${id}" not found`);
    }
    addOns.delete(id);
  }

  // Segment-scoped methods (Phase A - Segment Implementation)
  async getPackagesBySegment(_tenantId: string, segmentId: string): Promise<Package[]> {
    // Mock mode: Return all packages (mock doesn't support segments)
    return Array.from(packages.values()).filter((p) => p.segmentId === segmentId);
  }

  async getPackagesBySegmentWithAddOns(
    tenantId: string,
    segmentId: string
  ): Promise<Array<Package & { addOns: AddOn[] }>> {
    // Mock mode: Return packages with their add-ons
    const segmentPackages = await this.getPackagesBySegment(tenantId, segmentId);
    return segmentPackages.map((pkg) => ({
      ...pkg,
      addOns: Array.from(addOns.values()).filter((a) => a.packageId === pkg.id),
    }));
  }

  async getAddOnsForSegment(_tenantId: string, segmentId: string): Promise<AddOn[]> {
    // Mock mode: Return all add-ons for packages in segment
    const segmentPackages = await this.getPackagesBySegment(_tenantId, segmentId);
    const packageIds = new Set(segmentPackages.map((p) => p.id));
    return Array.from(addOns.values()).filter((a) => packageIds.has(a.packageId));
  }

  // Draft methods (Visual Editor)
  async getAllPackagesWithDrafts(_tenantId: string): Promise<PackageWithDraft[]> {
    // Mock mode: Return packages with draft fields (all null since mock doesn't persist drafts)
    return Array.from(packages.values()).map((pkg) => ({
      id: pkg.id,
      tenantId: pkg.tenantId,
      slug: pkg.slug,
      name: pkg.title, // Map title to name for compatibility
      description: pkg.description,
      basePrice: pkg.priceCents, // Map priceCents to basePrice for compatibility
      active: pkg.active ?? true,
      segmentId: pkg.segmentId ?? null,
      grouping: pkg.grouping ?? null,
      groupingOrder: pkg.groupingOrder ?? null,
      photos: pkg.photos ?? [],
      draftTitle: null,
      draftDescription: null,
      draftPriceCents: null,
      draftPhotos: null,
      hasDraft: false,
      draftUpdatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  async updateDraft(
    _tenantId: string,
    packageId: string,
    draft: UpdatePackageDraftInput
  ): Promise<PackageWithDraft> {
    const pkg = packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package with id "${packageId}" not found`);
    }

    // Mock mode: Just return the package with draft fields set
    return {
      id: pkg.id,
      tenantId: pkg.tenantId,
      slug: pkg.slug,
      name: pkg.title,
      description: pkg.description,
      basePrice: pkg.priceCents,
      active: pkg.active ?? true,
      segmentId: pkg.segmentId ?? null,
      grouping: pkg.grouping ?? null,
      groupingOrder: pkg.groupingOrder ?? null,
      photos: pkg.photos ?? [],
      draftTitle: draft.title ?? null,
      draftDescription: draft.description ?? null,
      draftPriceCents: draft.priceCents ?? null,
      draftPhotos: draft.photos ?? null,
      hasDraft: true,
      draftUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async publishDrafts(_tenantId: string, _packageIds?: string[]): Promise<Package[]> {
    // Mock mode: Return empty array (no drafts to publish)
    return [];
  }

  async discardDrafts(_tenantId: string, _packageIds?: string[]): Promise<number> {
    // Mock mode: Return 0 (no drafts to discard)
    return 0;
  }

  async countDrafts(_tenantId: string): Promise<number> {
    // Mock mode: Return 0 (no drafts)
    return 0;
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
    // Mock mode: Ignore tenantId
    return bookings.get(id) || null;
  }

  async findAll(
    _tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Booking[]> {
    // Mock mode: Ignore tenantId
    const all = Array.from(bookings.values());
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return all.slice(offset, offset + limit);
  }

  async isDateBooked(_tenantId: string, date: string): Promise<boolean> {
    // Mock mode: Ignore tenantId
    const dateKey = toUtcMidnight(date);
    return bookingsByDate.has(dateKey);
  }

  async getUnavailableDates(_tenantId: string, startDate: Date, endDate: Date): Promise<Date[]> {
    // Mock mode: Ignore tenantId
    const unavailable: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Iterate through all bookings
    for (const booking of bookings.values()) {
      const bookingDate = new Date(booking.eventDate);

      // Check if booking is within date range and not canceled/refunded
      if (bookingDate >= start && bookingDate <= end && booking.status === 'PAID') {
        unavailable.push(bookingDate);
      }
    }

    // Sort by date
    return unavailable.sort((a, b) => a.getTime() - b.getTime());
  }

  async updateGoogleEventId(
    _tenantId: string,
    bookingId: string,
    googleEventId: string
  ): Promise<void> {
    // Mock mode: Ignore tenantId
    const booking = bookings.get(bookingId);
    if (booking) {
      // Store googleEventId in mock booking (extend Booking type if needed)
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

    // Apply updates
    if (data.eventDate !== undefined) {
      // Update date mapping
      const oldDateKey = toUtcMidnight(booking.eventDate);
      const newDateKey = toUtcMidnight(data.eventDate);
      bookingsByDate.delete(oldDateKey);
      bookingsByDate.set(newDateKey, bookingId);
      booking.eventDate = data.eventDate;
    }
    if (data.status !== undefined) {
      booking.status = data.status;
    }

    // Store extra fields in mock
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

    // Check if new date is taken by a different booking
    const existingId = bookingsByDate.get(newDateKey);
    if (existingId && existingId !== bookingId) {
      const existingBooking = bookings.get(existingId);
      if (existingBooking && existingBooking.status !== 'CANCELED') {
        throw new BookingConflictError(newDate);
      }
    }

    // Update date
    const oldDateKey = toUtcMidnight(booking.eventDate);
    bookingsByDate.delete(oldDateKey);
    bookingsByDate.set(newDateKey, bookingId);
    booking.eventDate = newDate;

    // TODO-154 FIX: Calculate new reminder due date (7 days before new event date)
    // Only set if the event is more than 7 days away
    const eventDate = new Date(newDate + 'T00:00:00Z');
    const now = new Date();
    const daysUntilEvent = Math.floor(
      (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    (booking as any).reminderDueDate =
      daysUntilEvent > 7
        ? new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : undefined;

    // TODO-154 FIX: Reset reminderSentAt so new reminder will be sent
    (booking as any).reminderSentAt = undefined;

    logger.debug({ bookingId, newDate }, 'Mock booking rescheduled');
    return booking;
  }

  async findTimeslotBookings(
    _tenantId: string,
    date: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]> {
    // Mock mode: Return empty array for now
    // Real TIMESLOT bookings would need to be stored with startTime/endTime
    // This mock implementation is sufficient for basic testing
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
    // Mock mode: Return empty array for now
    // Real TIMESLOT bookings would need to be stored with startTime/endTime
    // This mock implementation is sufficient for basic testing
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
    // P2 #052 FIX: Mock implementation respects pagination parameters
    const MAX_LIMIT = 500;
    const DEFAULT_LIMIT = 100;

    const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(filters?.offset ?? 0, 0);

    // Mock mode: Return empty array for now
    // Mock bookings don't have TIMESLOT type
    logger.debug({ tenantId, filters, limit, offset }, 'findAppointments called');
    return [];
  }

  async findBookingsNeedingReminders(_tenantId: string, limit: number = 10): Promise<Booking[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find bookings where reminderDueDate is in the past and reminderSentAt is not set
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
    // Mock mode: Ignore tenantId
    const dateKey = toUtcMidnight(date);
    return blackouts.has(dateKey);
  }

  async getAllBlackouts(_tenantId: string): Promise<Array<{ date: string; reason?: string }>> {
    // Mock mode: Ignore tenantId
    return Array.from(blackouts.values());
  }

  async addBlackout(_tenantId: string, date: string, reason?: string): Promise<void> {
    // Mock mode: Ignore tenantId
    const dateKey = toUtcMidnight(date);
    blackouts.set(dateKey, { date: dateKey, reason });
  }

  async deleteBlackout(_tenantId: string, id: string): Promise<void> {
    // Mock mode: Ignore tenantId, use date as ID
    const dateKey = toUtcMidnight(id);
    blackouts.delete(dateKey);
  }

  async findBlackoutById(
    _tenantId: string,
    id: string
  ): Promise<{ id: string; date: string; reason?: string } | null> {
    // Mock mode: Ignore tenantId, use date as ID
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

  /**
   * Create a mock calendar event (for testing Google Calendar sync)
   */
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

  /**
   * Delete a mock calendar event (for testing Google Calendar sync)
   */
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

  /**
   * Get all mock events (for testing/debugging)
   */
  getMockEvents(): Array<{ eventId: string; summary: string; startTime: Date; endTime: Date }> {
    return Array.from(this.mockEvents.values());
  }
}

// Mock Payment Provider
export class MockPaymentProvider implements PaymentProvider {
  /**
   * Idempotency cache for checkout sessions
   * Simulates real Stripe behavior: same idempotency key returns same session
   * Cache is instance-scoped (cleared when new instance is created)
   */
  private idempotencyCache = new Map<string, CheckoutSession>();

  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<CheckoutSession> {
    // Check idempotency cache first (simulates real Stripe behavior)
    if (input.idempotencyKey && this.idempotencyCache.has(input.idempotencyKey)) {
      return this.idempotencyCache.get(input.idempotencyKey)!;
    }

    const sessionId = `mock_session_${Date.now()}`;
    const successUrl = input.metadata.successUrl || 'http://localhost:5173/success';
    const checkoutUrl = `${successUrl}?session_id=${sessionId}&mock=1`;

    const session: CheckoutSession = {
      url: checkoutUrl,
      sessionId,
    };

    // Store in cache if idempotency key provided
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
  }): Promise<CheckoutSession> {
    // Check idempotency cache first (simulates real Stripe behavior)
    if (input.idempotencyKey && this.idempotencyCache.has(input.idempotencyKey)) {
      return this.idempotencyCache.get(input.idempotencyKey)!;
    }

    const sessionId = `mock_connect_session_${Date.now()}`;
    const successUrl = input.metadata.successUrl || 'http://localhost:5173/success';
    const checkoutUrl = `${successUrl}?session_id=${sessionId}&mock=1&connect=1`;

    const session: CheckoutSession = {
      url: checkoutUrl,
      sessionId,
    };

    // Store in cache if idempotency key provided
    if (input.idempotencyKey) {
      this.idempotencyCache.set(input.idempotencyKey, session);
    }

    return session;
  }

  async verifyWebhook(_payload: string, _signature: string): Promise<Stripe.Event> {
    // Mock webhook verification - always succeeds
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
    // Mock refund - always succeeds
    return {
      refundId: `mock_refund_${Date.now()}`,
      status: 'succeeded',
      amountCents: input.amountCents || 100000, // Default to $1000 if not specified
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
    // Mock mode: Ignore tenantId
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
    // Mock mode: Ignore tenantId
    // Check if already exists (duplicate)
    if (webhookEvents.has(input.eventId)) {
      return false; // Duplicate
    }
    webhookEvents.set(input.eventId, {
      eventId: input.eventId,
      eventType: input.eventType,
      status: 'PENDING',
    });
    return true; // New record
  }

  async markProcessed(_tenantId: string, eventId: string): Promise<void> {
    // Mock mode: Ignore tenantId
    const event = webhookEvents.get(eventId);
    if (event) {
      event.status = 'PROCESSED';
    }
  }

  async markFailed(_tenantId: string, eventId: string, errorMessage: string): Promise<void> {
    // Mock mode: Ignore tenantId
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
      // Update timestamp
      existing.updatedAt = now;
      logger.debug({ email }, 'Mock early access request updated');
      return { request: existing, isNew: false };
    }

    // Create new
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
  };
}

/**
 * Get current in-memory state for debugging (dev mode only)
 */
export function getMockState() {
  return {
    packages: Array.from(packages.values()),
    addOns: Array.from(addOns.values()),
    blackouts: Array.from(blackouts.values()),
    bookings: Array.from(bookings.values()),
  };
}

/**
 * Reset mock state to initial seeded state (E2E test determinism)
 */
export function resetMockState() {
  // Clear dynamic data (bookings, blackouts, calendar, webhooks, early access)
  bookings.clear();
  bookingsByDate.clear();
  blackouts.clear();
  calendarBusyDates.clear();
  webhookEvents.clear();
  earlyAccessRequests.clear();

  logger.debug('Mock state reset to seed data');
}
