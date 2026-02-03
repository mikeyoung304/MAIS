/**
 * Port interfaces for repositories and external adapters
 */

import type { Package, AddOn, Booking, Service } from './entities';
import type Stripe from 'stripe';
import type { AdvisorMemory } from '@macon/contracts';

// ============================================================================
// Repository Ports
// ============================================================================

/**
 * Catalog Repository - Package and AddOn persistence
 */
export interface CatalogRepository {
  getAllPackages(tenantId: string): Promise<Package[]>;
  getAllPackagesWithAddOns(tenantId: string): Promise<(Package & { addOns: AddOn[] })[]>;
  getPackageBySlug(tenantId: string, slug: string): Promise<Package | null>;
  getPackageBySlugWithAddOns(
    tenantId: string,
    slug: string
  ): Promise<(Package & { addOns: AddOn[] }) | null>;
  getPackageById(tenantId: string, id: string): Promise<Package | null>;
  getPackageByIdWithAddOns(
    tenantId: string,
    id: string
  ): Promise<(Package & { addOns: AddOn[] }) | null>;
  getPackagesByIds(tenantId: string, ids: string[]): Promise<Package[]>;
  getAllAddOns(tenantId: string): Promise<AddOn[]>;
  getAddOnsByPackageId(tenantId: string, packageId: string): Promise<AddOn[]>;
  getAddOnById(tenantId: string, id: string): Promise<AddOn | null>;
  createPackage(tenantId: string, data: CreatePackageInput): Promise<Package>;
  updatePackage(tenantId: string, id: string, data: UpdatePackageInput): Promise<Package>;
  deletePackage(tenantId: string, id: string): Promise<void>;
  createAddOn(tenantId: string, data: CreateAddOnInput): Promise<AddOn>;
  updateAddOn(tenantId: string, id: string, data: UpdateAddOnInput): Promise<AddOn>;
  deleteAddOn(tenantId: string, id: string): Promise<void>;

  // Segment-scoped methods (Phase A - Segment Implementation)
  getPackagesBySegment(tenantId: string, segmentId: string): Promise<Package[]>;
  getPackagesBySegmentWithAddOns(
    tenantId: string,
    segmentId: string
  ): Promise<(Package & { addOns: AddOn[] })[]>;
  getAddOnsForSegment(tenantId: string, segmentId: string): Promise<AddOn[]>;

  // Draft methods (Visual Editor)
  getAllPackagesWithDrafts(tenantId: string): Promise<PackageWithDraft[]>;
  updateDraft(
    tenantId: string,
    packageId: string,
    draft: UpdatePackageDraftInput
  ): Promise<PackageWithDraft>;
  publishDrafts(tenantId: string, packageIds?: string[]): Promise<Package[]>;
  discardDrafts(tenantId: string, packageIds?: string[]): Promise<number>;
  countDrafts(tenantId: string): Promise<number>;
}

/**
 * Time-slot booking for conflict detection
 */
export interface TimeslotBooking {
  id: string;
  tenantId: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'FULFILLED';
}

/**
 * Booking Repository - Booking persistence
 */
/**
 * Update fields for booking modifications
 */
export interface BookingUpdateInput {
  // Reschedule fields
  eventDate?: string; // New date (YYYY-MM-DD format)

  // Status transitions
  status?:
    | 'PENDING'
    | 'DEPOSIT_PAID'
    | 'PAID'
    | 'CONFIRMED'
    | 'CANCELED'
    | 'REFUNDED'
    | 'FULFILLED';

  // Cancellation fields
  cancelledAt?: Date;
  cancelledBy?: 'CUSTOMER' | 'TENANT' | 'ADMIN' | 'SYSTEM';
  cancellationReason?: string;

  // Refund tracking
  refundStatus?: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  refundAmount?: number;
  refundedAt?: Date;
  stripeRefundId?: string;

  // Reminder tracking
  reminderSentAt?: Date;
  reminderDueDate?: Date;

  // Deposit tracking
  depositPaidAmount?: number;
  balanceDueDate?: Date;
  balancePaidAmount?: number;
  balancePaidAt?: Date;
}

export interface BookingRepository {
  create(
    tenantId: string,
    booking: Booking,
    paymentData?: {
      amount: number;
      processor: string;
      processorId: string;
    }
  ): Promise<Booking>;
  findById(tenantId: string, id: string): Promise<Booking | null>;
  findAll(tenantId: string, options?: { limit?: number; offset?: number }): Promise<Booking[]>;
  isDateBooked(tenantId: string, date: string): Promise<boolean>;
  getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<Date[]>;
  updateGoogleEventId(tenantId: string, bookingId: string, googleEventId: string): Promise<void>;

  /**
   * Update booking fields (reschedule, cancel, refund status, etc.)
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   * @param data - Fields to update
   * @returns Updated booking
   */
  update(tenantId: string, bookingId: string, data: BookingUpdateInput): Promise<Booking>;

  /**
   * Reschedule booking to a new date with advisory lock protection
   *
   * Uses PostgreSQL advisory locks (ADR-006) to prevent race conditions
   * when multiple reschedule requests target the same date.
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   * @param newDate - New event date (YYYY-MM-DD format)
   * @returns Updated booking
   * @throws {BookingConflictError} If new date is already booked
   * @throws {BookingAlreadyCancelledError} If booking is already cancelled
   */
  reschedule(tenantId: string, bookingId: string, newDate: string): Promise<Booking>;

  /**
   * Complete balance payment atomically with advisory lock protection
   *
   * P1-147 FIX: Uses PostgreSQL advisory locks to prevent race conditions
   * when concurrent balance payment webhooks arrive for the same booking.
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   * @param balanceAmountCents - Balance amount paid in cents
   * @returns Updated booking with balance paid, or null if already paid (idempotent)
   * @throws {NotFoundError} If booking doesn't exist
   */
  completeBalancePayment(
    tenantId: string,
    bookingId: string,
    balanceAmountCents: number
  ): Promise<Booking | null>;

  /**
   * Find all TIMESLOT bookings that overlap with a date range
   *
   * Used by SchedulingAvailabilityService for conflict detection.
   * Returns bookings where startTime overlaps with the given date's day.
   *
   * @param tenantId - Tenant ID for isolation
   * @param date - The date to check for time-slot bookings
   * @param serviceId - Optional service ID to filter by specific service
   * @returns Array of time-slot bookings for conflict detection
   */
  findTimeslotBookings(
    tenantId: string,
    date: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]>;

  /**
   * Find all TIMESLOT bookings within a date range (batch query)
   *
   * Used for batch availability checking to avoid N+1 query problem.
   * Returns all TIMESLOT bookings where startTime falls within the range.
   *
   * @param tenantId - Tenant ID for isolation
   * @param startDate - Start of date range (inclusive)
   * @param endDate - End of date range (inclusive)
   * @param serviceId - Optional service ID to filter by specific service
   * @returns Array of time-slot bookings for conflict detection
   */
  findTimeslotBookingsInRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]>;

  /**
   * Count TIMESLOT bookings for a specific service on a specific date
   *
   * Used for maxPerDay enforcement. Only counts active bookings (PENDING, CONFIRMED).
   *
   * @param tenantId - Tenant ID for isolation
   * @param serviceId - Service ID to count bookings for
   * @param date - The date to count bookings for
   * @returns Number of active bookings for this service on this date
   */
  countTimeslotBookingsForServiceOnDate(
    tenantId: string,
    serviceId: string,
    date: Date
  ): Promise<number>;

  /**
   * Find all appointments (TIMESLOT bookings) with optional filters
   *
   * Performs server-side filtering for efficient queries.
   * Used by admin dashboard to list appointments.
   *
   * PERFORMANCE: Implements pagination with reasonable limits to prevent DoS.
   * - Default limit: 100 appointments
   * - Maximum limit: 500 appointments
   * - Maximum date range: 90 days
   *
   * @param tenantId - Tenant ID for isolation
   * @param filters - Optional filters for status, serviceId, and date range
   * @param filters.status - Filter by booking status
   * @param filters.serviceId - Filter by service ID
   * @param filters.startDate - Filter by start date (inclusive, ISO string)
   * @param filters.endDate - Filter by end date (inclusive, ISO string)
   * @param filters.limit - Maximum number of results to return (default 100, max 500)
   * @param filters.offset - Number of results to skip for pagination (default 0)
   * @returns Array of appointments with full details
   */
  findAppointments(
    tenantId: string,
    filters?: {
      status?: string;
      serviceId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AppointmentDto[]>;

  /**
   * Find bookings that need reminders sent (lazy reminder evaluation)
   *
   * Returns bookings where:
   * - reminderDueDate <= today
   * - reminderSentAt is null
   * - status is PAID/CONFIRMED (not cancelled)
   *
   * @param tenantId - Tenant ID for isolation
   * @param limit - Maximum number of reminders to process (default 10)
   * @returns Array of bookings needing reminders
   */
  findBookingsNeedingReminders(tenantId: string, limit?: number): Promise<Booking[]>;

  /**
   * Mark a booking's reminder as sent
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   */
  markReminderSent(tenantId: string, bookingId: string): Promise<void>;
}

/**
 * Appointment DTO for admin dashboard
 */
export interface AppointmentDto {
  id: string;
  tenantId: string;
  customerId: string;
  serviceId: string | null;
  packageId: string | null; // Nullable for TIMESLOT bookings
  date: string; // YYYY-MM-DD
  startTime: string | null; // ISO datetime
  endTime: string | null; // ISO datetime
  clientTimezone: string | null;
  status: string;
  totalPrice: number;
  notes: string | null;
  createdAt: string;
}

/**
 * Blackout Repository - Blackout date management
 */
export interface BlackoutRepository {
  isBlackoutDate(tenantId: string, date: string): Promise<boolean>;
  getAllBlackouts(tenantId: string): Promise<{ date: string; reason?: string }[]>;
  addBlackout(tenantId: string, date: string, reason?: string): Promise<void>;
  deleteBlackout(tenantId: string, id: string): Promise<void>;
  findBlackoutById(
    tenantId: string,
    id: string
  ): Promise<{ id: string; date: string; reason?: string } | null>;
}

/**
 * User Repository - User authentication and management
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
}

/**
 * Early Access Request entity
 */
export interface EarlyAccessRequest {
  id: string;
  email: string;
  source: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Early Access Repository - Early access request persistence
 * Used for homepage waitlist signups
 */
export interface EarlyAccessRepository {
  /**
   * Upsert early access request (creates or updates timestamp if exists)
   * Returns the request and whether it was newly created
   */
  upsert(email: string, source: string): Promise<{ request: EarlyAccessRequest; isNew: boolean }>;
}

/**
 * Webhook Repository - Webhook event tracking and deduplication
 */
export interface WebhookRepository {
  /**
   * Records a webhook event. Returns true if this is a new record, false if duplicate.
   * Used for idempotency - if false, caller should return early (duplicate detected).
   */
  recordWebhook(input: {
    tenantId: string;
    eventId: string;
    eventType: string;
    rawPayload: string;
  }): Promise<boolean>;
  markProcessed(tenantId: string, eventId: string): Promise<void>;
  markFailed(tenantId: string, eventId: string, errorMessage: string): Promise<void>;
  isDuplicate(tenantId: string, eventId: string): Promise<boolean>;
}

/**
 * Webhook Subscription Repository - Custom webhook subscriptions for tenants
 */
export interface WebhookSubscriptionRepository {
  /**
   * Create a new webhook subscription
   */
  create(
    tenantId: string,
    data: {
      url: string;
      events: string[];
      secret: string;
    }
  ): Promise<WebhookSubscription>;

  /**
   * Find all webhook subscriptions for a tenant
   */
  findAll(tenantId: string): Promise<WebhookSubscriptionListItem[]>;

  /**
   * Find webhook subscription by ID
   */
  findById(tenantId: string, id: string): Promise<WebhookSubscription | null>;

  /**
   * Find active subscriptions for a specific event type
   */
  findActiveByEvent(tenantId: string, eventType: string): Promise<WebhookSubscriptionForDelivery[]>;

  /**
   * Update webhook subscription
   */
  update(
    tenantId: string,
    id: string,
    data: {
      url?: string;
      events?: string[];
      active?: boolean;
    }
  ): Promise<WebhookSubscriptionListItem>;

  /**
   * Delete webhook subscription
   */
  delete(tenantId: string, id: string): Promise<void>;

  /**
   * Create a webhook delivery record
   */
  createDelivery(data: {
    subscriptionId: string;
    event: string;
    payload: Record<string, any>;
  }): Promise<WebhookDeliveryRecord>;

  /**
   * Mark delivery as delivered
   */
  markDelivered(deliveryId: string): Promise<void>;

  /**
   * Mark delivery as failed
   */
  markFailed(deliveryId: string, error: string): Promise<void>;

  /**
   * Find deliveries by subscription
   */
  findDeliveriesBySubscription(
    tenantId: string,
    subscriptionId: string,
    limit?: number
  ): Promise<WebhookDeliveryListItem[]>;
}

/**
 * Full webhook subscription with secret (used internally)
 */
export interface WebhookSubscription {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook subscription for list view (excludes secret)
 */
export interface WebhookSubscriptionListItem {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook subscription for delivery (minimal data)
 */
export interface WebhookSubscriptionForDelivery {
  id: string;
  url: string;
  secret: string;
}

/**
 * Webhook delivery record (minimal for creation)
 */
export interface WebhookDeliveryRecord {
  id: string;
  subscriptionId: string;
  event: string;
  status: string;
}

/**
 * Webhook delivery for list view
 */
export interface WebhookDeliveryListItem {
  id: string;
  event: string;
  status: string;
  attempts: number;
  createdAt: Date;
  deliveredAt: Date | null;
  lastError: string | null;
}

/**
 * Service Repository - Scheduling service management
 */
export interface ServiceRepository {
  getAll(tenantId: string, includeInactive?: boolean): Promise<Service[]>;
  getActiveServices(tenantId: string): Promise<Service[]>;
  getBySlug(tenantId: string, slug: string): Promise<Service | null>;
  getById(tenantId: string, id: string): Promise<Service | null>;
  create(tenantId: string, data: CreateServiceInput): Promise<Service>;
  update(tenantId: string, id: string, data: UpdateServiceInput): Promise<Service>;
  delete(tenantId: string, id: string): Promise<void>;
}

/**
 * AvailabilityRule Repository - Scheduling availability rules
 */
export interface AvailabilityRuleRepository {
  getAll(tenantId: string): Promise<AvailabilityRule[]>;
  getByService(tenantId: string, serviceId: string | null): Promise<AvailabilityRule[]>;
  getByDayOfWeek(
    tenantId: string,
    dayOfWeek: number,
    serviceId?: string | null
  ): Promise<AvailabilityRule[]>;
  getEffectiveRules(
    tenantId: string,
    date: Date,
    serviceId?: string | null
  ): Promise<AvailabilityRule[]>;
  create(tenantId: string, data: CreateAvailabilityRuleData): Promise<AvailabilityRule>;
  update(tenantId: string, id: string, data: UpdateAvailabilityRuleData): Promise<AvailabilityRule>;
  delete(tenantId: string, id: string): Promise<void>;
  deleteByService(tenantId: string, serviceId: string): Promise<void>;
}

/**
 * Domain entity for AvailabilityRule
 */
export interface AvailabilityRule {
  id: string;
  tenantId: string;
  serviceId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new availability rule
 */
export interface CreateAvailabilityRuleData {
  serviceId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}

/**
 * Input for updating an existing availability rule
 * All fields are optional for partial updates
 */
export interface UpdateAvailabilityRuleData {
  serviceId?: string | null;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}

// ============================================================================
// Provider Ports
// ============================================================================

/**
 * Busy time block from external calendar
 */
export interface BusyTimeBlock {
  start: Date;
  end: Date;
}

/**
 * Calendar Provider - External calendar integration
 */
export interface CalendarProvider {
  isDateAvailable(date: string): Promise<boolean>;

  /**
   * Create a calendar event (optional - for one-way sync)
   * Returns null if calendar provider doesn't support event creation
   */
  createEvent?(input: {
    tenantId: string;
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: { email: string; name?: string }[];
    metadata?: Record<string, string>;
    timezone?: string; // IANA timezone (e.g., "America/New_York")
  }): Promise<{ eventId: string } | null>;

  /**
   * Delete a calendar event (optional - for one-way sync)
   * Returns true if successfully deleted, false otherwise
   */
  deleteEvent?(tenantId: string, eventId: string): Promise<boolean>;

  /**
   * Get busy time blocks from external calendar (optional - for two-way sync)
   * Returns empty array if calendar provider doesn't support FreeBusy API or on error
   *
   * Used for two-way calendar sync to prevent double-booking when external
   * events already exist in the calendar.
   *
   * @param tenantId - Tenant ID for multi-tenant calendar configuration
   * @param startDate - Start of time range to check
   * @param endDate - End of time range to check
   * @returns Array of busy time blocks, or empty array on error/not supported
   */
  getBusyTimes?(tenantId: string, startDate: Date, endDate: Date): Promise<BusyTimeBlock[]>;
}

/**
 * Payment Provider - Payment processing integration
 */
export interface PaymentProvider {
  createCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount?: number; // Platform commission in cents
    idempotencyKey?: string; // Idempotency key to prevent duplicate charges
    successUrl: string; // Tenant-specific success URL
    cancelUrl: string; // Tenant-specific cancel URL
  }): Promise<CheckoutSession>;
  createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string; // Connected account ID
    applicationFeeAmount: number; // Platform commission in cents (required for Connect)
    idempotencyKey?: string; // Idempotency key to prevent duplicate charges
    successUrl: string; // Tenant-specific success URL
    cancelUrl: string; // Tenant-specific cancel URL
  }): Promise<CheckoutSession>;
  verifyWebhook(payload: string, signature: string): Promise<Stripe.Event>;
  refund(input: {
    paymentIntentId: string;
    amountCents?: number; // Optional: for partial refunds, omit for full refund
    reason?: string; // Optional: reason for refund
    idempotencyKey?: string; // Idempotency key to prevent duplicate refunds
  }): Promise<{
    refundId: string;
    status: string;
    amountCents: number;
  }>;
}

/**
 * Email Provider - Email notifications
 */
export interface EmailProvider {
  sendEmail(input: { to: string; subject: string; html: string }): Promise<void>;
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * User entity with authentication details
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin';
}

/**
 * Standardized role types for unified authentication
 */
export type UserRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN';

/**
 * JWT token payload for platform admin authentication
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin';
}

/**
 * JWT token payload for tenant authentication
 * Includes tenant context instead of user context
 */
export interface TenantTokenPayload {
  tenantId: string;
  slug: string;
  email: string;
  type: 'tenant'; // Distinguishes from platform admin tokens
}

/**
 * Unified JWT token payload (supports both admin and tenant)
 * Use this for new implementations
 */
export interface UnifiedTokenPayload {
  // Common fields
  email: string;
  role: UserRole;

  // Platform admin fields (present when role = PLATFORM_ADMIN)
  userId?: string;

  // Tenant admin fields (present when role = TENANT_ADMIN)
  tenantId?: string;
  slug?: string;

  // Impersonation fields (present when platform admin impersonates tenant)
  impersonating?: {
    tenantId: string;
    tenantSlug: string;
    tenantEmail: string;
    startedAt: string; // ISO timestamp
  };
}

/**
 * Checkout session response from payment provider
 */
export interface CheckoutSession {
  url: string;
  sessionId: string;
}

/**
 * Availability check result
 */
export interface AvailabilityCheck {
  date: string;
  available: boolean;
  reason?: 'blackout' | 'booked' | 'calendar';
}

// ============================================================================
// Input DTOs
// ============================================================================

/**
 * Input for creating a new package
 */
export interface CreatePackageInput {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  photoUrl?: string;
  // Tier/segment organization fields
  segmentId?: string | null;
  grouping?: string | null;
  groupingOrder?: number | null;
}

/**
 * Photo object for package gallery
 */
export interface PackagePhoto {
  url: string;
  altText?: string;
  order?: number;
}

/**
 * Input for updating an existing package
 */
export interface UpdatePackageInput {
  slug?: string;
  title?: string;
  description?: string;
  priceCents?: number;
  photoUrl?: string;
  photos?: PackagePhoto[]; // Photo gallery JSON array
  // Tier/segment organization fields
  segmentId?: string | null;
  grouping?: string | null;
  groupingOrder?: number | null;
}

/**
 * Package with draft fields for Visual Editor
 */
export interface PackageWithDraft {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string | null;
  basePrice: number;
  active: boolean;
  segmentId: string | null;
  grouping: string | null;
  groupingOrder: number | null;
  photos: PackagePhoto[];
  // Draft fields
  draftTitle: string | null;
  draftDescription: string | null;
  draftPriceCents: number | null;
  draftPhotos: PackagePhoto[] | null;
  hasDraft: boolean;
  draftUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for updating package draft (Visual Editor autosave)
 */
export interface UpdatePackageDraftInput {
  title?: string;
  description?: string;
  priceCents?: number;
  photos?: PackagePhoto[];
}

/**
 * Input for creating a new add-on
 */
export interface CreateAddOnInput {
  packageId: string;
  title: string;
  priceCents: number;
  photoUrl?: string;
}

/**
 * Input for updating an existing add-on
 */
export interface UpdateAddOnInput {
  packageId?: string;
  title?: string;
  priceCents?: number;
  photoUrl?: string;
}

/**
 * Input for creating a new service
 */
export interface CreateServiceInput {
  slug: string;
  name: string;
  description?: string;
  durationMinutes: number;
  bufferMinutes?: number;
  priceCents: number;
  timezone?: string;
  active?: boolean;
  sortOrder?: number;
  segmentId?: string | null;
}

/**
 * Input for updating an existing service
 */
export interface UpdateServiceInput {
  slug?: string;
  name?: string;
  description?: string;
  durationMinutes?: number;
  bufferMinutes?: number;
  priceCents?: number;
  timezone?: string;
  active?: boolean;
  sortOrder?: number;
  segmentId?: string | null;
}

// ============================================================================
// Cache Service Port
// ============================================================================

/**
 * Default cache TTL in seconds (1 hour)
 * Applied when no explicit TTL is provided to prevent indefinite caching
 */
export const DEFAULT_CACHE_TTL_SECONDS = 3600;

/**
 * Cache Service Port
 *
 * Provides key-value caching with TTL support.
 * Implementations: Redis (production), In-Memory (development/fallback)
 *
 * CRITICAL: All cache keys MUST include tenantId to prevent cross-tenant data leakage
 * Example: `catalog:${tenantId}:packages` NOT `catalog:packages`
 *
 * TTL BEHAVIOR:
 * - All cache entries MUST have a TTL to prevent stale data
 * - Default TTL: 1 hour (3600 seconds) when not specified
 * - Recommended TTLs:
 *   - Catalog/packages: 15 minutes (900s)
 *   - Availability: 5 minutes (300s)
 *   - User sessions: 1 hour (3600s)
 *   - Static content: 24 hours (86400s)
 */
export interface CacheServicePort {
  /**
   * Get value by key
   * Returns null if key doesn't exist or is expired
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value with TTL (time-to-live in seconds)
   * @param key - Cache key (must include tenantId for multi-tenant safety)
   * @param value - Value to cache (will be JSON serialized)
   * @param ttlSeconds - TTL in seconds (defaults to DEFAULT_CACHE_TTL_SECONDS = 3600)
   */
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;

  /**
   * Delete single key
   */
  del(key: string): Promise<void>;

  /**
   * Delete all keys matching pattern (e.g., "catalog:tenant_123:*")
   * Uses SCAN for Redis (production-safe), regex for in-memory
   * If no pattern provided, flushes all keys
   */
  flush(pattern?: string): Promise<void>;

  /**
   * Check if cache is available (health check)
   * Returns false if cache is down or unreachable
   */
  isConnected(): Promise<boolean>;

  /**
   * Get cache statistics for monitoring
   * Returns cache hit/miss rates and key count
   */
  getStats?(): Promise<{
    hits: number;
    misses: number;
    keys: number;
    totalRequests: number;
    hitRate: string;
  }>;
}

// ============================================================================
// STORAGE INTERFACES
// ============================================================================

/**
 * File uploaded via multer or similar middleware
 */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * Result of a successful file upload
 */
export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

/**
 * FileSystem abstraction for dependency injection (testability)
 */
export interface FileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  writeFile(path: string, data: Buffer): Promise<void>;
  unlink(path: string): Promise<void>;
}

/**
 * Storage provider for file uploads (logos, package photos, segment images)
 */
export interface StorageProvider {
  uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult>;
  uploadPackagePhoto(
    file: UploadedFile,
    packageId: string,
    tenantId?: string
  ): Promise<UploadResult>;
  uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult>;
  uploadLandingPageImage(file: UploadedFile, tenantId: string): Promise<UploadResult>;
  deleteLogo(filename: string): Promise<void>;
  deletePackagePhoto(filename: string): Promise<void>;
  deleteSegmentImage(url: string, tenantId: string): Promise<void>;
  deleteLandingPageImage(url: string, tenantId: string): Promise<void>;
}

// ============================================================================
// ONBOARDING AGENT INTERFACES
// ============================================================================

/**
 * Advisor Memory Repository - Event sourcing projection for onboarding agent
 *
 * Provides:
 * - Memory projection from event history (for session resumption)
 * - Memory clearing (for reset/testing)
 * - Event history access (for debugging/audit)
 *
 * This interface enables testability by abstracting database access.
 * (Kieran Fix #5: Repository interface for AdvisorMemory)
 */
export interface AdvisorMemoryRepository {
  /**
   * Get current advisor memory for a tenant.
   * Returns null if no events exist.
   *
   * @param tenantId - Tenant ID for isolation
   * @returns Projected memory state or null
   */
  getMemory(tenantId: string): Promise<AdvisorMemory | null>;

  /**
   * Project memory from event history.
   * Replays all events to build current state.
   *
   * @param tenantId - Tenant ID for isolation
   * @returns Projected memory state
   */
  projectFromEvents(tenantId: string): Promise<AdvisorMemory>;

  /**
   * Clear all onboarding memory for a tenant.
   * Used for reset/testing scenarios.
   *
   * @param tenantId - Tenant ID for isolation
   */
  clearMemory(tenantId: string): Promise<void>;

  /**
   * Get event history for a tenant.
   * Returns events in descending order (newest first).
   *
   * @param tenantId - Tenant ID for isolation
   * @param limit - Maximum events to return (default 50)
   */
  getEventHistory(
    tenantId: string,
    limit?: number
  ): Promise<
    Array<{
      id: string;
      eventType: string;
      version: number;
      timestamp: Date;
    }>
  >;
}

/**
 * Advisor Memory type for onboarding agent
 * Re-exported from contracts - single source of truth (Kieran Fix #5)
 */
export type { AdvisorMemory } from '@macon/contracts';

// ============================================================================
// Tenant Repository Port
// ============================================================================

/**
 * Tenant entity for repository operations
 * Subset of Prisma Tenant model for port interface
 */
export interface TenantEntity {
  id: string;
  slug: string;
  name: string;
  apiKeyPublic: string;
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
  commissionPercent: number;
  depositPercent: number | null;
  balanceDueDays: number | null;
  isActive: boolean;
}

/**
 * Tenant Repository Port
 *
 * Core interface for tenant data access. Used by:
 * - CheckoutSessionFactory (findById for Stripe routing)
 * - WeddingDepositService (findById for deposit config)
 * - CommissionService (findById for commission rates)
 *
 * SECURITY: All methods enforce tenant isolation internally.
 *
 * @example
 * ```typescript
 * // In services
 * constructor(private readonly tenantRepo: ITenantRepository) {}
 *
 * // Usage
 * const tenant = await this.tenantRepo.findById(tenantId);
 * ```
 */
export interface ITenantRepository {
  /**
   * Find tenant by ID
   * @param id - Tenant CUID
   * @returns Tenant or null if not found
   */
  findById(id: string): Promise<TenantEntity | null>;

  /**
   * Find tenant by slug
   * @param slug - URL-safe tenant identifier
   * @returns Tenant or null if not found
   */
  findBySlug(slug: string): Promise<TenantEntity | null>;

  /**
   * Find tenant by public API key
   * @param apiKey - Public API key (pk_live_*)
   * @returns Tenant or null if not found
   */
  findByApiKey(apiKey: string): Promise<TenantEntity | null>;
}

// ============================================================================
// Section Content Repository Port
// ============================================================================

/**
 * Page names for multi-page storefront support
 */
export type PageName =
  | 'home'
  | 'about'
  | 'services'
  | 'faq'
  | 'contact'
  | 'gallery'
  | 'testimonials';

/**
 * BlockType import from Prisma (re-exported for consumers)
 */
export type { BlockType } from '../generated/prisma/client';

/**
 * Section Content entity for repository operations
 */
export interface SectionContentEntity {
  id: string;
  tenantId: string;
  segmentId: string | null;
  blockType: import('../generated/prisma/client').BlockType;
  pageName: string;
  content: unknown; // JSON content validated by SectionContentSchema
  order: number;
  isDraft: boolean;
  publishedAt: Date | null;
  versions: unknown | null; // JSON array of version history
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for upserting section content
 */
export interface UpsertSectionInput {
  blockType: import('../generated/prisma/client').BlockType;
  pageName?: string;
  segmentId?: string | null;
  content: unknown;
  order?: number;
}

/**
 * Version history entry for undo support
 */
export interface VersionEntry {
  content: unknown;
  timestamp: string; // ISO datetime
  description?: string;
}

/**
 * Section Content Repository Port
 *
 * CRITICAL: All methods require tenantId as first parameter for multi-tenant isolation.
 *
 * This interface enables:
 * - Section-level CRUD operations
 * - Draft/publish workflow
 * - Version history for undo
 * - Multi-page storefront support
 *
 * @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md
 */
export interface ISectionContentRepository {
  // ─────────────────────────────────────────────────────────────────────────
  // Read Operations (T1)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find a section by ID
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to find
   * @returns Section or null
   */
  findById(tenantId: string, sectionId: string): Promise<SectionContentEntity | null>;

  /**
   * Find a specific section by block type
   *
   * @param tenantId - Tenant ID for isolation
   * @param blockType - Block type to find
   * @param pageName - Page name (defaults to 'home')
   * @param segmentId - Optional segment filter
   * @returns Section or null
   */
  findByBlockType(
    tenantId: string,
    blockType: import('../generated/prisma/client').BlockType,
    pageName?: string,
    segmentId?: string | null
  ): Promise<SectionContentEntity | null>;

  /**
   * Find all sections for a tenant
   *
   * @param tenantId - Tenant ID for isolation
   * @param options - Filter options
   * @returns Array of sections ordered by `order` field
   */
  findAllForTenant(
    tenantId: string,
    options?: {
      publishedOnly?: boolean;
      draftsOnly?: boolean;
      pageName?: string;
      segmentId?: string | null;
    }
  ): Promise<SectionContentEntity[]>;

  /**
   * Check if tenant has any draft sections
   *
   * @param tenantId - Tenant ID for isolation
   * @returns True if any drafts exist
   */
  hasDrafts(tenantId: string): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────────────────
  // Write Operations (T2 - create/update draft)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create or update a section (always creates draft)
   *
   * @param tenantId - Tenant ID for isolation
   * @param input - Section data
   * @returns Created/updated section
   */
  upsert(tenantId: string, input: UpsertSectionInput): Promise<SectionContentEntity>;

  /**
   * Update section order within a page
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to move
   * @param newOrder - New order value
   * @returns Updated section
   */
  reorder(tenantId: string, sectionId: string, newOrder: number): Promise<SectionContentEntity>;

  /**
   * Delete a section
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to delete
   */
  delete(tenantId: string, sectionId: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Publish Operations (T3 - require confirmation)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Publish a single section (make live)
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to publish
   * @returns Published section
   */
  publishSection(tenantId: string, sectionId: string): Promise<SectionContentEntity>;

  /**
   * Publish all draft sections for a tenant
   *
   * @param tenantId - Tenant ID for isolation
   * @returns Count of published sections
   */
  publishAll(tenantId: string): Promise<{ count: number }>;

  // ─────────────────────────────────────────────────────────────────────────
  // Discard Operations (T3 - require confirmation)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Discard changes to a single section (revert to published)
   *
   * @param tenantId - Tenant ID for isolation
   * @param sectionId - Section ID to discard
   */
  discardSection(tenantId: string, sectionId: string): Promise<void>;

  /**
   * Discard all draft sections for a tenant
   *
   * @param tenantId - Tenant ID for isolation
   * @returns Count of discarded sections
   */
  discardAll(tenantId: string): Promise<{ count: number }>;
}
