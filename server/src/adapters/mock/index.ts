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

// Seed data on module load
function seedData(): void {
  if (packages.size > 0) return; // Already seeded

  // Packages
  packages.set('pkg_basic', {
    id: 'pkg_basic',
    tenantId: DEFAULT_TENANT,
    slug: 'basic-elopement',
    title: 'Basic Elopement',
    description: 'Simple, intimate ceremony with professional photography and officiant',
    priceCents: 99900, // $999
    photoUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  });

  packages.set('pkg_micro', {
    id: 'pkg_micro',
    tenantId: DEFAULT_TENANT,
    slug: 'micro-ceremony',
    title: 'Micro Ceremony',
    description: 'Intimate micro-wedding with up to 10 guests, photography, and champagne toast',
    priceCents: 249900, // $2,499
    photoUrl: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  });

  packages.set('pkg_garden', {
    id: 'pkg_garden',
    tenantId: DEFAULT_TENANT,
    slug: 'garden-romance',
    title: 'Garden Romance',
    description:
      'Outdoor garden ceremony with floral arch, photography, and reception for up to 20 guests',
    priceCents: 449900, // $4,499
    photoUrl: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  });

  packages.set('pkg_luxury', {
    id: 'pkg_luxury',
    tenantId: DEFAULT_TENANT,
    slug: 'luxury-escape',
    title: 'Luxury Escape',
    description:
      'Premium all-inclusive experience with venue, catering, photography, videography, and coordinator',
    priceCents: 899900, // $8,999
    photoUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  });

  packages.set('pkg_destination', {
    id: 'pkg_destination',
    tenantId: DEFAULT_TENANT,
    slug: 'destination-bliss',
    title: 'Destination Bliss',
    description:
      'Beachfront or mountain ceremony with travel coordination, photography, and celebration dinner',
    priceCents: 599900, // $5,999
    photoUrl: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  });

  packages.set('pkg_courthouse', {
    id: 'pkg_courthouse',
    tenantId: DEFAULT_TENANT,
    slug: 'courthouse-chic',
    title: 'Courthouse Chic',
    description:
      'Stylish courthouse wedding with photography, marriage license assistance, and celebration lunch',
    priceCents: 79900, // $799
    photoUrl: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
  });

  // Add-ons
  addOns.set('addon_video', {
    id: 'addon_video',
    packageId: 'pkg_basic',
    title: 'Video Recording',
    description: 'Professional video recording of your ceremony',
    priceCents: 50000, // $500
    photoUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&h=300&fit=crop',
  });

  addOns.set('addon_flowers', {
    id: 'addon_flowers',
    packageId: 'pkg_basic',
    title: 'Floral Arrangement',
    description: 'Beautiful floral arrangements for your special day',
    priceCents: 15000, // $150
    photoUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=300&fit=crop',
  });

  addOns.set('addon_makeup', {
    id: 'addon_makeup',
    packageId: 'pkg_micro',
    title: 'Hair & Makeup',
    description: 'Professional hair and makeup services',
    priceCents: 30000, // $300
    photoUrl: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&h=300&fit=crop',
  });

  addOns.set('addon_music', {
    id: 'addon_music',
    packageId: 'pkg_garden',
    title: 'Live Music (Acoustic)',
    description: 'Live acoustic music performance',
    priceCents: 75000, // $750
    photoUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop',
  });

  addOns.set('addon_cake', {
    id: 'addon_cake',
    packageId: 'pkg_garden',
    title: 'Custom Wedding Cake',
    description: 'Custom designed wedding cake',
    priceCents: 35000, // $350
    photoUrl: 'https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=400&h=300&fit=crop',
  });

  addOns.set('addon_album', {
    id: 'addon_album',
    packageId: 'pkg_luxury',
    title: 'Premium Photo Album',
    description: 'Premium leather-bound photo album',
    priceCents: 45000, // $450
    photoUrl: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=400&h=300&fit=crop',
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

  logger.debug('Mock data seeded: 6 packages, 6 add-ons, 1 admin user');
}

// Initialize seed data
seedData();

// Mock Catalog Repository
export class MockCatalogRepository implements CatalogRepository {
  async getAllPackages(tenantId: string): Promise<Package[]> {
    // Mock mode: Ignore tenantId, return all packages
    return Array.from(packages.values());
  }

  async getAllPackagesWithAddOns(tenantId: string): Promise<Array<Package & { addOns: AddOn[] }>> {
    // Mock mode: Ignore tenantId, return all packages
    const allPackages = Array.from(packages.values());
    return allPackages.map((pkg) => ({
      ...pkg,
      addOns: Array.from(addOns.values()).filter((a) => a.packageId === pkg.id),
    }));
  }

  async getPackageBySlug(tenantId: string, slug: string): Promise<Package | null> {
    // Mock mode: Ignore tenantId
    const pkg = Array.from(packages.values()).find((p) => p.slug === slug);
    return pkg || null;
  }

  async getPackageById(tenantId: string, id: string): Promise<Package | null> {
    // Mock mode: Ignore tenantId
    return packages.get(id) || null;
  }

  async getPackagesByIds(tenantId: string, ids: string[]): Promise<Package[]> {
    // Mock mode: Ignore tenantId
    return ids.map((id) => packages.get(id)).filter((pkg): pkg is Package => pkg !== undefined);
  }

  async getAllAddOns(tenantId: string): Promise<AddOn[]> {
    // Mock mode: Ignore tenantId, return all add-ons
    return Array.from(addOns.values());
  }

  async getAddOnsByPackageId(tenantId: string, packageId: string): Promise<AddOn[]> {
    // Mock mode: Ignore tenantId
    return Array.from(addOns.values()).filter((a) => a.packageId === packageId);
  }

  async getAddOnById(tenantId: string, id: string): Promise<AddOn | null> {
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

  async deletePackage(tenantId: string, id: string): Promise<void> {
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
    tenantId: string,
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
    tenantId: string,
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

  async deleteAddOn(tenantId: string, id: string): Promise<void> {
    // Mock mode: Ignore tenantId
    const addOn = addOns.get(id);
    if (!addOn) {
      throw new Error(`AddOn with id "${id}" not found`);
    }
    addOns.delete(id);
  }

  // Segment-scoped methods (Phase A - Segment Implementation)
  async getPackagesBySegment(tenantId: string, segmentId: string): Promise<Package[]> {
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

  async getAddOnsForSegment(tenantId: string, segmentId: string): Promise<AddOn[]> {
    // Mock mode: Return all add-ons for packages in segment
    const segmentPackages = await this.getPackagesBySegment(tenantId, segmentId);
    const packageIds = new Set(segmentPackages.map((p) => p.id));
    return Array.from(addOns.values()).filter((a) => packageIds.has(a.packageId));
  }

  // Draft methods (Visual Editor)
  async getAllPackagesWithDrafts(tenantId: string): Promise<PackageWithDraft[]> {
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
    tenantId: string,
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

  async publishDrafts(tenantId: string, packageIds?: string[]): Promise<Package[]> {
    // Mock mode: Return empty array (no drafts to publish)
    return [];
  }

  async discardDrafts(tenantId: string, packageIds?: string[]): Promise<number> {
    // Mock mode: Return 0 (no drafts to discard)
    return 0;
  }

  async countDrafts(tenantId: string): Promise<number> {
    // Mock mode: Return 0 (no drafts)
    return 0;
  }
}

// Mock Booking Repository
export class MockBookingRepository implements BookingRepository {
  async create(
    tenantId: string,
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

  async findById(tenantId: string, id: string): Promise<Booking | null> {
    // Mock mode: Ignore tenantId
    return bookings.get(id) || null;
  }

  async findAll(tenantId: string): Promise<Booking[]> {
    // Mock mode: Ignore tenantId
    return Array.from(bookings.values());
  }

  async isDateBooked(tenantId: string, date: string): Promise<boolean> {
    // Mock mode: Ignore tenantId
    const dateKey = toUtcMidnight(date);
    return bookingsByDate.has(dateKey);
  }

  async getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<Date[]> {
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
    tenantId: string,
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
    tenantId: string,
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

  async reschedule(tenantId: string, bookingId: string, newDate: string): Promise<Booking> {
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
    tenantId: string,
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
    tenantId: string,
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

  async findBookingsNeedingReminders(tenantId: string, limit: number = 10): Promise<Booking[]> {
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

    logger.debug({ tenantId, count: result.length }, 'findBookingsNeedingReminders called');
    return result;
  }

  async markReminderSent(tenantId: string, bookingId: string): Promise<void> {
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
    tenantId: string,
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
  async isBlackoutDate(tenantId: string, date: string): Promise<boolean> {
    // Mock mode: Ignore tenantId
    const dateKey = toUtcMidnight(date);
    return blackouts.has(dateKey);
  }

  async getAllBlackouts(tenantId: string): Promise<Array<{ date: string; reason?: string }>> {
    // Mock mode: Ignore tenantId
    return Array.from(blackouts.values());
  }

  async addBlackout(tenantId: string, date: string, reason?: string): Promise<void> {
    // Mock mode: Ignore tenantId
    const dateKey = toUtcMidnight(date);
    blackouts.set(dateKey, { date: dateKey, reason });
  }

  async deleteBlackout(tenantId: string, id: string): Promise<void> {
    // Mock mode: Ignore tenantId, use date as ID
    const dateKey = toUtcMidnight(id);
    blackouts.delete(dateKey);
  }

  async findBlackoutById(
    tenantId: string,
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
  async deleteEvent(tenantId: string, eventId: string): Promise<boolean> {
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
  async createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<CheckoutSession> {
    const sessionId = `mock_session_${Date.now()}`;
    const successUrl = input.metadata.successUrl || 'http://localhost:5173/success';
    const checkoutUrl = `${successUrl}?session_id=${sessionId}&mock=1`;

    return {
      url: checkoutUrl,
      sessionId,
    };
  }

  async createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string;
    applicationFeeAmount: number;
    idempotencyKey?: string;
  }): Promise<CheckoutSession> {
    const sessionId = `mock_connect_session_${Date.now()}`;
    const successUrl = input.metadata.successUrl || 'http://localhost:5173/success';
    const checkoutUrl = `${successUrl}?session_id=${sessionId}&mock=1&connect=1`;

    return {
      url: checkoutUrl,
      sessionId,
    };
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
  async isDuplicate(tenantId: string, eventId: string): Promise<boolean> {
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

  async markProcessed(tenantId: string, eventId: string): Promise<void> {
    // Mock mode: Ignore tenantId
    const event = webhookEvents.get(eventId);
    if (event) {
      event.status = 'PROCESSED';
    }
  }

  async markFailed(tenantId: string, eventId: string, errorMessage: string): Promise<void> {
    // Mock mode: Ignore tenantId
    const event = webhookEvents.get(eventId);
    if (event) {
      event.status = 'FAILED';
    }
    logger.debug({ eventId, errorMessage }, 'Mock webhook failed');
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
  // Clear dynamic data (bookings, blackouts, calendar, webhooks)
  bookings.clear();
  bookingsByDate.clear();
  blackouts.clear();
  calendarBusyDates.clear();
  webhookEvents.clear();

  logger.debug('Mock state reset to seed data');
}
