/**
 * Port interfaces for repositories and external adapters
 */

import type { Package, AddOn, Booking, Service } from './entities';
import type Stripe from 'stripe';

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
  getPackageById(tenantId: string, id: string): Promise<Package | null>;
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
  getPackagesBySegmentWithAddOns(tenantId: string, segmentId: string): Promise<(Package & { addOns: AddOn[] })[]>;
  getAddOnsForSegment(tenantId: string, segmentId: string): Promise<AddOn[]>;
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
  findAll(tenantId: string): Promise<Booking[]>;
  isDateBooked(tenantId: string, date: string): Promise<boolean>;
  getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<Date[]>;
  updateGoogleEventId(tenantId: string, bookingId: string, googleEventId: string): Promise<void>;

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
}

/**
 * Appointment DTO for admin dashboard
 */
export interface AppointmentDto {
  id: string;
  tenantId: string;
  customerId: string;
  serviceId: string | null;
  packageId: string;
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
  findBlackoutById(tenantId: string, id: string): Promise<{ id: string; date: string; reason?: string } | null>;
}

/**
 * User Repository - User authentication and management
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
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
  getByDayOfWeek(tenantId: string, dayOfWeek: number, serviceId?: string | null): Promise<AvailabilityRule[]>;
  getEffectiveRules(tenantId: string, date: Date, serviceId?: string | null): Promise<AvailabilityRule[]>;
  create(tenantId: string, data: CreateAvailabilityRuleData): Promise<AvailabilityRule>;
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

// ============================================================================
// Provider Ports
// ============================================================================

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
  }): Promise<{ eventId: string } | null>;

  /**
   * Delete a calendar event (optional - for one-way sync)
   * Returns true if successfully deleted, false otherwise
   */
  deleteEvent?(tenantId: string, eventId: string): Promise<boolean>;
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
  }): Promise<CheckoutSession>;
  createConnectCheckoutSession(input: {
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    stripeAccountId: string; // Connected account ID
    applicationFeeAmount: number; // Platform commission in cents (required for Connect)
    idempotencyKey?: string; // Idempotency key to prevent duplicate charges
  }): Promise<CheckoutSession>;
  verifyWebhook(
    payload: string,
    signature: string
  ): Promise<Stripe.Event>;
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
  uploadPackagePhoto(file: UploadedFile, packageId: string, tenantId?: string): Promise<UploadResult>;
  uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult>;
  deleteLogo(filename: string): Promise<void>;
  deletePackagePhoto(filename: string): Promise<void>;
  deleteSegmentImage(url: string, tenantId: string): Promise<void>;
}
