/**
 * Booking domain service
 */

import type { BookingRepository, PaymentProvider, ServiceRepository } from '../lib/ports';
import type { Booking, CreateBookingInput } from '../lib/entities';
import type { CatalogRepository } from '../lib/ports';
import type { EventEmitter } from '../lib/core/events';
import {
  NotFoundError,
  BookingAlreadyCancelledError,
  BookingCannotBeRescheduledError,
  BookingConflictError,
} from '../lib/errors';
import { CommissionService } from './commission.service';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { IdempotencyService } from './idempotency.service';
import type { SchedulingAvailabilityService } from './scheduling-availability.service';

// ============================================================================
// Input DTOs for Appointment Scheduling
// ============================================================================

/**
 * Input for creating an appointment checkout session
 */
export interface CreateAppointmentInput {
  serviceId: string;
  startTime: Date;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientTimezone?: string;
  notes?: string;
}

/**
 * Input for handling appointment payment completion
 */
export interface AppointmentPaymentCompletedInput {
  sessionId: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientTimezone?: string;
  notes?: string;
  totalCents: number;
}

/**
 * Filters for querying appointments
 *
 * P2 #052 FIX: Added pagination to prevent DoS via unbounded queries
 */
export interface GetAppointmentsFilters {
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'FULFILLED';
  serviceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class BookingService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly catalogRepo: CatalogRepository,
    private readonly _eventEmitter: EventEmitter,
    private readonly paymentProvider: PaymentProvider,
    private readonly commissionService: CommissionService,
    private readonly tenantRepo: PrismaTenantRepository,
    private readonly idempotencyService: IdempotencyService,
    private readonly schedulingAvailabilityService?: SchedulingAvailabilityService,
    private readonly serviceRepo?: ServiceRepository
  ) {}

  // ============================================================================
  // Shared Checkout Logic (P2 #156 FIX)
  // ============================================================================

  /**
   * Shared checkout session creation logic
   *
   * Handles idempotency, race conditions, and Stripe Connect/Standard checkout routing.
   * This method prevents duplication of checkout session creation logic across
   * wedding bookings, balance payments, and appointment bookings.
   *
   * P2 #156 FIX: Extracted from createCheckout, createBalancePaymentCheckout, and
   * createAppointmentCheckout to eliminate 120+ lines of duplicated code.
   *
   * @private
   * @param params - Checkout session parameters
   * @param params.tenantId - Tenant ID for data isolation
   * @param params.amountCents - Amount to charge in cents
   * @param params.email - Customer email address
   * @param params.metadata - Stripe session metadata
   * @param params.applicationFeeAmount - Platform commission amount
   * @param params.idempotencyKeyParts - Parts to generate idempotency key
   *
   * @returns Object containing the Stripe checkout URL
   */
  private async createCheckoutSession(params: {
    tenantId: string;
    amountCents: number;
    email: string;
    metadata: Record<string, string>;
    applicationFeeAmount: number;
    idempotencyKeyParts: [string, string, string, string, number];
  }): Promise<{ checkoutUrl: string }> {
    const { tenantId, amountCents, email, metadata, applicationFeeAmount, idempotencyKeyParts } = params;

    // Fetch tenant to get Stripe account ID
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant ${tenantId} not found`);
    }

    // Generate idempotency key for checkout session
    const idempotencyKey = this.idempotencyService.generateCheckoutKey(...idempotencyKeyParts);

    // Check if this request has already been processed
    const cachedResponse = await this.idempotencyService.getStoredResponse(idempotencyKey);
    if (cachedResponse) {
      const data = cachedResponse.data as { url: string };
      return { checkoutUrl: data.url };
    }

    // Store idempotency key before making Stripe call
    const isNew = await this.idempotencyService.checkAndStore(idempotencyKey);
    if (!isNew) {
      // Race condition: another request stored the key while we were checking
      await new Promise(resolve => setTimeout(resolve, 100));
      const retryResponse = await this.idempotencyService.getStoredResponse(idempotencyKey);
      if (retryResponse) {
        const retryData = retryResponse.data as { url: string };
        return { checkoutUrl: retryData.url };
      }
      // If still no response, proceed anyway (edge case)
    }

    // Create Stripe checkout session
    let session;

    if (tenant.stripeAccountId && tenant.stripeOnboarded) {
      // Stripe Connect checkout - payment goes to tenant's account
      session = await this.paymentProvider.createConnectCheckoutSession({
        amountCents,
        email,
        metadata,
        stripeAccountId: tenant.stripeAccountId,
        applicationFeeAmount,
        idempotencyKey,
      });
    } else {
      // Standard Stripe checkout - payment goes to platform account
      session = await this.paymentProvider.createCheckoutSession({
        amountCents,
        email,
        metadata,
        applicationFeeAmount,
        idempotencyKey,
      });
    }

    // Cache the response for future duplicate requests
    await this.idempotencyService.updateResponse(idempotencyKey, {
      data: session,
      timestamp: new Date().toISOString(),
    });

    return { checkoutUrl: session.url };
  }

  // ============================================================================
  // Wedding Package Booking
  // ============================================================================

  /**
   * Creates a Stripe checkout session for a wedding package booking
   *
   * MULTI-TENANT: Accepts tenantId for data isolation and commission calculation
   * Validates package existence, calculates total cost including add-ons,
   * calculates platform commission, and creates a Stripe checkout session
   * with metadata and application fee.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param input - Booking creation data
   * @param input.packageId - Package slug identifier
   * @param input.eventDate - Wedding date in YYYY-MM-DD format
   * @param input.email - Customer email address
   * @param input.coupleName - Names of the couple
   * @param input.addOnIds - Optional array of add-on IDs to include
   *
   * @returns Object containing the Stripe checkout URL
   *
   * @throws {NotFoundError} If package doesn't exist
   *
   * @example
   * ```typescript
   * const checkout = await bookingService.createCheckout('tenant_123', {
   *   packageId: 'intimate-ceremony',
   *   eventDate: '2025-06-15',
   *   email: 'couple@example.com',
   *   coupleName: 'Jane & John',
   *   addOnIds: ['addon_photography', 'addon_flowers']
   * });
   * // Returns: { checkoutUrl: 'https://checkout.stripe.com/...' }
   * ```
   */
  async createCheckout(tenantId: string, input: CreateBookingInput): Promise<{ checkoutUrl: string }> {
    // Validate package exists for this tenant
    const pkg = await this.catalogRepo.getPackageBySlug(tenantId, input.packageId);
    if (!pkg) {
      throw new NotFoundError(`Package ${input.packageId} not found`);
    }

    // Fetch tenant to get Stripe account ID
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant ${tenantId} not found`);
    }

    // Calculate total with commission
    const calculation = await this.commissionService.calculateBookingTotal(
      tenantId,
      pkg.priceCents,
      input.addOnIds || []
    );

    // Check if deposit is required
    const depositPercent = tenant.depositPercent ? Number(tenant.depositPercent) : null;
    let amountToCharge = calculation.subtotal;
    let isDeposit = false;
    let depositCommissionAmount = 0;
    let balanceCommissionAmount = calculation.commissionAmount;

    if (depositPercent !== null && depositPercent > 0) {
      // Calculate deposit amount
      amountToCharge = Math.round((calculation.subtotal * depositPercent) / 100);
      isDeposit = true;

      // P1-148 FIX: Split commission proportionally between deposit and balance
      // Commission is calculated on full total, then split by payment amounts
      depositCommissionAmount = Math.round((calculation.commissionAmount * depositPercent) / 100);
      balanceCommissionAmount = calculation.commissionAmount - depositCommissionAmount;
    }

    // Prepare session metadata
    const metadata = {
      tenantId, // CRITICAL: Include tenantId in metadata
      packageId: pkg.id,
      eventDate: input.eventDate,
      email: input.email,
      coupleName: input.coupleName,
      addOnIds: JSON.stringify(input.addOnIds || []),
      commissionAmount: String(calculation.commissionAmount), // Total commission (for reference)
      depositCommissionAmount: String(depositCommissionAmount), // Commission on deposit
      balanceCommissionAmount: String(balanceCommissionAmount), // Commission on balance
      commissionPercent: String(calculation.commissionPercent),
      isDeposit: String(isDeposit),
      totalCents: String(calculation.subtotal), // Store full total for balance calculation
      depositPercent: depositPercent !== null ? String(depositPercent) : '',
    };

    // P2 #156 FIX: Use shared checkout session creation logic
    return this.createCheckoutSession({
      tenantId,
      amountCents: amountToCharge,
      email: input.email,
      metadata,
      applicationFeeAmount: isDeposit ? depositCommissionAmount : calculation.commissionAmount,
      idempotencyKeyParts: [tenantId, input.email, pkg.id, input.eventDate, Date.now()],
    });
  }

  /**
   * Creates a Stripe checkout session for balance payment
   *
   * MULTI-TENANT: Accepts tenantId for data isolation
   * Validates booking has deposit paid and balance due, calculates remaining amount,
   * and creates Stripe checkout session for balance payment.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param bookingId - Booking identifier
   *
   * @returns Object containing the Stripe checkout URL and balance amount
   *
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {Error} If booking doesn't have deposit or balance already paid
   *
   * @example
   * ```typescript
   * const checkout = await bookingService.createBalancePaymentCheckout('tenant_123', 'booking_abc');
   * // Returns: { checkoutUrl: 'https://checkout.stripe.com/...', balanceAmountCents: 150000 }
   * ```
   */
  async createBalancePaymentCheckout(
    tenantId: string,
    bookingId: string
  ): Promise<{ checkoutUrl: string; balanceAmountCents: number }> {
    // Validate booking exists
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Check if booking has deposit paid
    if (!booking.depositPaidAmount) {
      throw new Error('Booking does not have a deposit paid');
    }

    if (booking.balancePaidAmount || booking.balancePaidAt) {
      throw new Error('Balance has already been paid for this booking');
    }

    // Calculate balance amount
    const balanceAmountCents = booking.totalCents - booking.depositPaidAmount;

    if (balanceAmountCents <= 0) {
      throw new Error('No balance due for this booking');
    }

    // P1-148 FIX: Calculate balance commission proportionally from original booking commission
    // The total commission was split at checkout time: deposit commission + balance commission = total
    // Balance commission = total commission - deposit commission
    // deposit commission = total commission * (deposit amount / total amount)
    const totalCommission = booking.commissionAmount || 0;
    const depositPercent = booking.depositPaidAmount / booking.totalCents;
    const depositCommission = Math.round(totalCommission * depositPercent);
    const balanceCommission = totalCommission - depositCommission;

    // Prepare session metadata
    const metadata = {
      tenantId,
      bookingId,
      isBalancePayment: 'true',
      balanceAmountCents: String(balanceAmountCents),
      email: booking.email,
      coupleName: booking.coupleName,
      eventDate: booking.eventDate,
      commissionAmount: String(balanceCommission), // P1-148 FIX: Use proportional balance commission
      commissionPercent: String(booking.commissionPercent), // Use stored rate from original booking
    };

    // P2 #156 FIX: Use shared checkout session creation logic
    const result = await this.createCheckoutSession({
      tenantId,
      amountCents: balanceAmountCents,
      email: booking.email,
      metadata,
      applicationFeeAmount: balanceCommission,
      idempotencyKeyParts: [tenantId, booking.email, bookingId, 'balance', Date.now()],
    });

    return { ...result, balanceAmountCents };
  }

  /**
   * Handles balance payment completion
   *
   * MULTI-TENANT: Accepts tenantId for data isolation
   * Called by Stripe webhook handler after successful balance payment.
   * Updates booking with balance paid details and changes status to PAID.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param bookingId - Booking identifier
   * @param balanceAmountCents - Balance amount paid in cents
   *
   * @returns Updated booking with balance paid
   *
   * @throws {NotFoundError} If booking doesn't exist
   *
   * @example
   * ```typescript
   * const booking = await bookingService.onBalancePaymentCompleted(
   *   'tenant_123',
   *   'booking_abc',
   *   150000
   * );
   * ```
   */
  async onBalancePaymentCompleted(
    tenantId: string,
    bookingId: string,
    balanceAmountCents: number
  ): Promise<Booking> {
    // P1-147 FIX: Use atomic balance payment completion with advisory lock
    // This prevents race conditions when concurrent balance payment webhooks arrive
    const updated = await this.bookingRepo.completeBalancePayment(
      tenantId,
      bookingId,
      balanceAmountCents
    );

    // If null returned, balance was already paid (idempotent success)
    if (!updated) {
      // Fetch the booking to return it (already in correct state)
      const existing = await this.bookingRepo.findById(tenantId, bookingId);
      if (!existing) {
        throw new NotFoundError(`Booking ${bookingId} not found`);
      }
      return existing;
    }

    // Emit event for downstream processing (notifications)
    await this._eventEmitter.emit('BalancePaymentCompleted', {
      bookingId: updated.id,
      tenantId,
      email: updated.email,
      coupleName: updated.coupleName,
      eventDate: updated.eventDate,
      balanceAmountCents,
    });

    return updated;
  }

  /**
   * Retrieves all bookings from the database for a tenant
   *
   * MULTI-TENANT: Filters bookings by tenantId for data isolation
   * Returns bookings ordered by creation date (most recent first).
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Array of all bookings for the tenant
   *
   * @example
   * ```typescript
   * const bookings = await bookingService.getAllBookings('tenant_123');
   * // Returns: [{ id: 'booking_123', status: 'PAID', ... }, ...]
   * ```
   */
  async getAllBookings(tenantId: string): Promise<Booking[]> {
    return this.bookingRepo.findAll(tenantId);
  }

  /**
   * Retrieves a specific booking by ID
   *
   * MULTI-TENANT: Validates booking belongs to specified tenant
   *
   * @param tenantId - Tenant ID for data isolation
   * @param id - Booking identifier
   *
   * @returns The requested booking
   *
   * @throws {NotFoundError} If booking doesn't exist
   *
   * @example
   * ```typescript
   * const booking = await bookingService.getBookingById('tenant_123', 'booking_123');
   * // Returns: { id: 'booking_123', status: 'PAID', ... }
   * ```
   */
  async getBookingById(tenantId: string, id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(tenantId, id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found`);
    }
    return booking;
  }

  /**
   * Retrieves all unavailable booking dates within a date range for a tenant
   *
   * MULTI-TENANT: Filters bookings by tenantId for data isolation
   * This method performs a batch query to fetch all booked dates in a given range,
   * which is much more efficient than checking each date individually.
   * Only returns dates with CONFIRMED or PENDING bookings (excludes CANCELED).
   *
   * @param tenantId - Tenant ID for data isolation
   * @param startDate - Start of date range
   * @param endDate - End of date range
   *
   * @returns Array of date strings in YYYY-MM-DD format
   *
   * @example
   * ```typescript
   * const unavailable = await bookingService.getUnavailableDates(
   *   'tenant_123',
   *   new Date('2025-06-01'),
   *   new Date('2025-06-30')
   * );
   * // Returns: ['2025-06-15', '2025-06-22', '2025-06-29']
   * ```
   */
  async getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<string[]> {
    const dates = await this.bookingRepo.getUnavailableDates(tenantId, startDate, endDate);
    return dates.map(d => d.toISOString().split('T')[0]); // Return as YYYY-MM-DD strings
  }

  /**
   * Handles payment completion and creates a confirmed booking
   *
   * MULTI-TENANT: Accepts tenantId for data isolation and commission tracking
   * Called by Stripe webhook handler or development simulator after successful payment.
   * Creates a PAID booking with commission data, enriches event data with package/add-on
   * details, and emits BookingPaid event for downstream processing.
   *
   * CRITICAL FIX (P2 #037): Booking and Payment records are now created atomically
   * within a single Prisma transaction to prevent financial reconciliation issues.
   * If either operation fails, both are rolled back to maintain data integrity.
   *
   * Uses race condition protection via the booking repository's SERIALIZABLE transaction
   * and pessimistic locking to prevent double-booking scenarios.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param input - Payment completion data from Stripe
   * @param input.sessionId - Stripe checkout session ID
   * @param input.packageId - Package slug identifier
   * @param input.eventDate - Wedding date in YYYY-MM-DD format
   * @param input.email - Customer email address
   * @param input.coupleName - Names of the couple
   * @param input.addOnIds - Optional array of selected add-on IDs
   * @param input.totalCents - Total payment amount in cents
   * @param input.commissionAmount - Platform commission in cents
   * @param input.commissionPercent - Commission percentage
   *
   * @returns Created booking with PAID status
   *
   * @throws {NotFoundError} If package doesn't exist
   * @throws {BookingConflictError} If date is already booked (from repository)
   * @throws {BookingLockTimeoutError} If transaction lock cannot be acquired (from repository)
   *
   * @example
   * ```typescript
   * const booking = await bookingService.onPaymentCompleted('tenant_123', {
   *   sessionId: 'cs_test_123',
   *   packageId: 'intimate-ceremony',
   *   eventDate: '2025-06-15',
   *   email: 'couple@example.com',
   *   coupleName: 'Jane & John',
   *   addOnIds: ['addon_photography'],
   *   totalCents: 150000,
   *   commissionAmount: 18000,
   *   commissionPercent: 12.0
   * });
   * // Returns: { id: 'booking_123', status: 'PAID', commissionAmount: 18000, ... }
   * ```
   */
  async onPaymentCompleted(tenantId: string, input: {
    sessionId: string;
    packageId: string;
    eventDate: string;
    email: string;
    coupleName: string;
    addOnIds?: string[];
    totalCents: number;
    commissionAmount?: number;
    commissionPercent?: number;
    isDeposit?: boolean;
    depositPercent?: number;
  }): Promise<Booking> {
    // Fetch package details for event payload
    const pkg = await this.catalogRepo.getPackageBySlug(tenantId, input.packageId);
    if (!pkg) {
      throw new NotFoundError(`Package ${input.packageId} not found`);
    }

    // Fetch add-on details
    const addOnTitles: string[] = [];
    if (input.addOnIds && input.addOnIds.length > 0) {
      const addOns = await this.catalogRepo.getAddOnsByPackageId(tenantId, pkg.id);
      const selectedAddOns = addOns.filter((a) => input.addOnIds?.includes(a.id));
      addOnTitles.push(...selectedAddOns.map((a) => a.title));
    }

    // Calculate reminder due date (7 days before event)
    // Only set if the event is more than 7 days away
    const eventDate = new Date(input.eventDate + 'T00:00:00Z');
    const now = new Date();
    const daysUntilEvent = Math.floor((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const reminderDueDate = daysUntilEvent > 7
      ? new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : undefined;

    // Handle deposit vs full payment
    let depositPaidAmount: number | undefined;
    let balanceDueDate: string | undefined;
    let bookingStatus: Booking['status'] = 'PAID';

    if (input.isDeposit && input.depositPercent) {
      // This is a deposit payment - P1-149 FIX: Use DEPOSIT_PAID status
      depositPaidAmount = input.totalCents;
      bookingStatus = 'DEPOSIT_PAID'; // Indicates deposit received, balance due later

      // Fetch tenant to get balanceDueDays
      const tenant = await this.tenantRepo.findById(tenantId);
      if (tenant) {
        const balanceDueDays = tenant.balanceDueDays || 30;
        balanceDueDate = new Date(eventDate.getTime() - balanceDueDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
      }
    }

    // Create booking with commission data and reminder
    const booking: Booking = {
      id: `booking_${Date.now()}`,
      packageId: pkg.id, // Use actual package ID from fetched package (input.packageId is a slug)
      coupleName: input.coupleName,
      email: input.email,
      eventDate: input.eventDate,
      addOnIds: input.addOnIds || [],
      totalCents: input.totalCents,
      commissionAmount: input.commissionAmount,
      commissionPercent: input.commissionPercent,
      status: bookingStatus,
      createdAt: new Date().toISOString(),
      reminderDueDate,
      depositPaidAmount,
      balanceDueDate,
    };

    // P2 #037 FIX: Create booking AND payment record atomically
    // Pass payment data to repository for atomic transaction
    const created = await this.bookingRepo.create(tenantId, booking, {
      amount: input.totalCents,
      processor: 'stripe',
      processorId: input.sessionId,
    });

    // Emit BookingPaid event for notifications with enriched data
    await this._eventEmitter.emit('BookingPaid', {
      bookingId: created.id,
      email: created.email,
      coupleName: created.coupleName,
      eventDate: created.eventDate,
      packageTitle: pkg.title,
      addOnTitles,
      totalCents: input.totalCents,
    });

    return created;
  }

  // ============================================================================
  // Appointment Scheduling Methods
  // ============================================================================

  /**
   * Creates a Stripe checkout session for a time-slot appointment booking
   *
   * MULTI-TENANT: Accepts tenantId for data isolation
   * Validates service existence, checks slot availability, and creates a Stripe
   * checkout session with TIMESLOT booking metadata.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param input - Appointment creation data
   * @param input.serviceId - Service ID to book
   * @param input.startTime - Appointment start time (UTC)
   * @param input.clientName - Client's name
   * @param input.clientEmail - Client's email address
   * @param input.clientPhone - Optional client phone number
   * @param input.clientTimezone - Optional client timezone (e.g., "America/New_York")
   * @param input.notes - Optional booking notes
   *
   * @returns Object containing the Stripe checkout URL
   *
   * @throws {NotFoundError} If service doesn't exist
   * @throws {Error} If scheduling dependencies are not available
   * @throws {Error} If time slot is not available
   *
   * @example
   * ```typescript
   * const checkout = await bookingService.createAppointmentCheckout('tenant_123', {
   *   serviceId: 'service_abc',
   *   startTime: new Date('2025-06-15T14:00:00Z'),
   *   clientName: 'John Doe',
   *   clientEmail: 'john@example.com',
   *   clientPhone: '555-1234',
   *   clientTimezone: 'America/New_York',
   *   notes: 'First consultation'
   * });
   * // Returns: { checkoutUrl: 'https://checkout.stripe.com/...' }
   * ```
   */
  async createAppointmentCheckout(
    tenantId: string,
    input: CreateAppointmentInput
  ): Promise<{ checkoutUrl: string }> {
    // Verify scheduling dependencies are available
    if (!this.serviceRepo || !this.schedulingAvailabilityService) {
      throw new Error('Scheduling services are not available. Ensure ServiceRepository and SchedulingAvailabilityService are injected.');
    }

    // 1. Fetch service and validate it exists and belongs to this tenant
    const service = await this.serviceRepo.getById(tenantId, input.serviceId);
    if (!service) {
      throw new NotFoundError(`Service ${input.serviceId} not found`);
    }

    // 2. Calculate endTime based on service duration
    const endTime = new Date(input.startTime.getTime() + service.durationMinutes * 60 * 1000);

    // 3. Verify slot is available
    const isAvailable = await this.schedulingAvailabilityService.isSlotAvailable(
      tenantId,
      input.serviceId,
      input.startTime,
      endTime
    );

    if (!isAvailable) {
      throw new Error(`Time slot starting at ${input.startTime.toISOString()} is not available`);
    }

    // 4. Prepare session metadata for TIMESLOT booking
    const metadata = {
      tenantId, // CRITICAL: Include tenantId in metadata
      bookingType: 'TIMESLOT',
      serviceId: input.serviceId,
      startTime: input.startTime.toISOString(),
      endTime: endTime.toISOString(),
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone || '',
      clientTimezone: input.clientTimezone || '',
      notes: input.notes || '',
    };

    // P2 #156 FIX: Use shared checkout session creation logic
    return this.createCheckoutSession({
      tenantId,
      amountCents: service.priceCents,
      email: input.clientEmail,
      metadata,
      applicationFeeAmount: 0, // No commission for appointments (can be configured later)
      idempotencyKeyParts: [tenantId, input.clientEmail, input.serviceId, input.startTime.toISOString(), Date.now()],
    });
  }

  /**
   * Handles payment completion for appointment bookings and creates a confirmed booking
   *
   * MULTI-TENANT: Accepts tenantId for data isolation
   * Called by Stripe webhook handler after successful payment for TIMESLOT bookings.
   * Creates a booking record with TIMESLOT type and emits AppointmentBooked event.
   *
   * Uses pessimistic locking to prevent double-booking scenarios.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param input - Payment completion data from Stripe
   * @param input.sessionId - Stripe checkout session ID
   * @param input.serviceId - Service ID
   * @param input.startTime - Appointment start time (UTC)
   * @param input.endTime - Appointment end time (UTC)
   * @param input.clientName - Client's name
   * @param input.clientEmail - Client's email address
   * @param input.clientPhone - Optional client phone number
   * @param input.clientTimezone - Optional client timezone
   * @param input.notes - Optional booking notes
   * @param input.totalCents - Total payment amount in cents
   *
   * @returns Created booking with CONFIRMED status
   *
   * @throws {NotFoundError} If service doesn't exist
   * @throws {Error} If scheduling dependencies are not available
   *
   * @example
   * ```typescript
   * const booking = await bookingService.onAppointmentPaymentCompleted('tenant_123', {
   *   sessionId: 'cs_test_123',
   *   serviceId: 'service_abc',
   *   startTime: new Date('2025-06-15T14:00:00Z'),
   *   endTime: new Date('2025-06-15T14:30:00Z'),
   *   clientName: 'John Doe',
   *   clientEmail: 'john@example.com',
   *   clientPhone: '555-1234',
   *   clientTimezone: 'America/New_York',
   *   notes: 'First consultation',
   *   totalCents: 10000
   * });
   * ```
   */
  async onAppointmentPaymentCompleted(
    tenantId: string,
    input: AppointmentPaymentCompletedInput
  ): Promise<any> {
    // Verify scheduling dependencies are available
    if (!this.serviceRepo) {
      throw new Error('ServiceRepository is not available. Ensure it is injected.');
    }

    // 1. Fetch service details for event payload
    const service = await this.serviceRepo.getById(tenantId, input.serviceId);
    if (!service) {
      throw new NotFoundError(`Service ${input.serviceId} not found`);
    }

    // 2. Create booking record with TIMESLOT type
    // Note: This will use the BookingRepository which should support TIMESLOT bookings
    // The booking will be created with pessimistic locking to prevent double-booking
    const booking: Booking = {
      id: `booking_${Date.now()}`,
      tenantId,
      serviceId: input.serviceId,
      customerId: `customer_${Date.now()}`, // TODO: Integrate with Customer management
      packageId: '', // Not applicable for TIMESLOT bookings
      venueId: null,
      coupleName: input.clientName,
      email: input.clientEmail,
      phone: input.clientPhone,
      eventDate: new Date(input.startTime.getFullYear(), input.startTime.getMonth(), input.startTime.getDate()).toISOString().split('T')[0],
      addOnIds: [], // No add-ons for appointments
      startTime: input.startTime.toISOString(),
      endTime: input.endTime.toISOString(),
      bookingType: 'TIMESLOT' as const,
      clientTimezone: input.clientTimezone || null,
      status: 'CONFIRMED',
      totalCents: input.totalCents,
      notes: input.notes || null,
      commissionAmount: 0, // No commission for appointments (can be configured later)
      commissionPercent: 0,
      stripePaymentIntentId: input.sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Persist booking
    // Note: The BookingRepository.create method handles the Prisma schema mapping
    const created = await this.bookingRepo.create(tenantId, booking);

    // 4. Emit AppointmentBooked event for notifications
    await this._eventEmitter.emit('AppointmentBooked', {
      bookingId: created.id,
      tenantId,
      serviceId: input.serviceId,
      serviceName: service.name,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone,
      startTime: input.startTime.toISOString(),
      endTime: input.endTime.toISOString(),
      totalCents: input.totalCents,
      notes: input.notes,
    });

    return created;
  }

  /**
   * Retrieves all appointment bookings with optional filters
   *
   * MULTI-TENANT: Filters by tenantId for data isolation
   * Returns only TIMESLOT bookings (excludes legacy DATE bookings).
   * Results are ordered by startTime ascending.
   *
   * P2 #052 FIX: Delegates to repository with pagination to prevent DoS.
   * - Default limit: 100 appointments
   * - Maximum limit: 500 appointments
   * - Maximum date range: 90 days
   *
   * @param tenantId - Tenant ID for data isolation
   * @param filters - Optional filters
   * @param filters.status - Filter by booking status
   * @param filters.serviceId - Filter by service ID
   * @param filters.startDate - Filter by start date (inclusive)
   * @param filters.endDate - Filter by end date (inclusive)
   * @param filters.limit - Maximum number of results to return (default 100, max 500)
   * @param filters.offset - Number of results to skip for pagination (default 0)
   *
   * @returns Array of appointment bookings
   *
   * @example
   * ```typescript
   * // Get all confirmed appointments (uses default limit of 100)
   * const appointments = await bookingService.getAppointments('tenant_123', {
   *   status: 'CONFIRMED'
   * });
   *
   * // Get appointments for a specific service in a date range with pagination
   * const serviceAppointments = await bookingService.getAppointments('tenant_123', {
   *   serviceId: 'service_abc',
   *   startDate: new Date('2025-06-01'),
   *   endDate: new Date('2025-06-30'),
   *   limit: 50,
   *   offset: 0
   * });
   * ```
   */
  async getAppointments(
    tenantId: string,
    filters?: GetAppointmentsFilters
  ): Promise<any[]> {
    // Delegate to repository with pagination
    // Convert Date objects to ISO strings for repository
    const repositoryFilters = {
      status: filters?.status,
      serviceId: filters?.serviceId,
      startDate: filters?.startDate?.toISOString().split('T')[0],
      endDate: filters?.endDate?.toISOString().split('T')[0],
      limit: filters?.limit,
      offset: filters?.offset,
    };

    return this.bookingRepo.findAppointments(tenantId, repositoryFilters);
  }

  // ============================================================================
  // Booking Management Methods (MVP Gaps Phase 1)
  // ============================================================================

  /**
   * Reschedule a booking to a new date
   *
   * Uses advisory locks (ADR-006) to prevent race conditions when multiple
   * reschedule requests target the same new date.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param bookingId - Booking identifier
   * @param newDate - New event date (YYYY-MM-DD format)
   *
   * @returns Updated booking with new date
   *
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {BookingAlreadyCancelledError} If booking is already cancelled
   * @throws {BookingConflictError} If new date is already booked
   *
   * @example
   * ```typescript
   * const updated = await bookingService.rescheduleBooking(
   *   'tenant_123',
   *   'booking_abc',
   *   '2025-07-15'
   * );
   * ```
   */
  async rescheduleBooking(
    tenantId: string,
    bookingId: string,
    newDate: string
  ): Promise<Booking> {
    // Validate booking exists
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Cannot reschedule cancelled bookings
    if (booking.status === 'CANCELED') {
      throw new BookingAlreadyCancelledError(bookingId);
    }

    // Check if trying to reschedule to the same date
    if (booking.eventDate === newDate) {
      throw new BookingCannotBeRescheduledError(bookingId, 'New date is the same as current date');
    }

    // Reschedule with advisory lock protection
    const updated = await this.bookingRepo.reschedule(tenantId, bookingId, newDate);

    // Emit event for downstream processing (calendar sync, notifications)
    await this._eventEmitter.emit('BookingRescheduled', {
      bookingId: updated.id,
      tenantId,
      email: updated.email,
      coupleName: updated.coupleName,
      oldDate: booking.eventDate,
      newDate: updated.eventDate,
    });

    return updated;
  }

  /**
   * Cancel a booking with 3-phase pattern
   *
   * Phase 1: Mark booking as CANCELED
   * Phase 2: Record cancellation details
   * Phase 3: Initiate refund (if paid) - async via event
   *
   * @param tenantId - Tenant ID for data isolation
   * @param bookingId - Booking identifier
   * @param cancelledBy - Who is cancelling (CUSTOMER, TENANT, ADMIN, SYSTEM)
   * @param reason - Optional reason for cancellation
   *
   * @returns Cancelled booking
   *
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {BookingAlreadyCancelledError} If booking is already cancelled
   *
   * @example
   * ```typescript
   * const cancelled = await bookingService.cancelBooking(
   *   'tenant_123',
   *   'booking_abc',
   *   'CUSTOMER',
   *   'Found a different venue'
   * );
   * ```
   */
  async cancelBooking(
    tenantId: string,
    bookingId: string,
    cancelledBy: 'CUSTOMER' | 'TENANT' | 'ADMIN' | 'SYSTEM',
    reason?: string
  ): Promise<Booking> {
    // Validate booking exists
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Cannot cancel already cancelled bookings
    if (booking.status === 'CANCELED') {
      throw new BookingAlreadyCancelledError(bookingId);
    }

    // Phase 1 & 2: Mark as cancelled and record details
    const cancelled = await this.bookingRepo.update(tenantId, bookingId, {
      status: 'CANCELED',
      cancelledAt: new Date(),
      cancelledBy,
      cancellationReason: reason,
      // Start refund process for paid bookings
      refundStatus: booking.status === 'PAID' ? 'PENDING' : 'NONE',
    });

    // Emit event for downstream processing (refund, notifications, calendar)
    await this._eventEmitter.emit('BookingCancelled', {
      bookingId: cancelled.id,
      tenantId,
      email: cancelled.email,
      coupleName: cancelled.coupleName,
      eventDate: cancelled.eventDate,
      totalCents: cancelled.totalCents,
      cancelledBy,
      reason,
      needsRefund: booking.status === 'PAID',
    });

    return cancelled;
  }

  /**
   * Process refund for a cancelled booking
   *
   * Called after cancellation to initiate the refund with Stripe.
   * Updates refund status and stores Stripe refund ID.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param bookingId - Booking identifier
   * @param paymentIntentId - Stripe PaymentIntent ID for refund
   * @param amountCents - Optional amount for partial refund (full refund if omitted)
   *
   * @returns Updated booking with refund status
   *
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {Error} If booking is not cancelled or doesn't need refund
   *
   * @example
   * ```typescript
   * const refunded = await bookingService.processRefund(
   *   'tenant_123',
   *   'booking_abc',
   *   'pi_stripe_123'
   * );
   * ```
   */
  async processRefund(
    tenantId: string,
    bookingId: string,
    paymentIntentId: string,
    amountCents?: number
  ): Promise<Booking> {
    // Validate booking exists
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Only refund cancelled bookings with pending refund status
    if (booking.status !== 'CANCELED' || booking.refundStatus !== 'PENDING') {
      throw new Error(`Booking ${bookingId} does not need a refund`);
    }

    // P1-150 FIX: Calculate total paid and validate refund amount
    // Total paid = deposit + balance (if applicable), falling back to totalCents for legacy bookings
    const totalPaid = (booking.depositPaidAmount ?? 0) +
                     (booking.balancePaidAmount ?? 0) ||
                     booking.totalCents;

    // Track cumulative refunds to prevent over-refunds
    const previousRefunds = booking.refundAmount ?? 0;
    const maxRefundable = totalPaid - previousRefunds;

    // Determine refund amount (requested or remaining amount)
    const refundAmount = amountCents ?? maxRefundable;

    // Validate refund doesn't exceed what's available
    if (refundAmount <= 0) {
      throw new Error(`No refundable amount remaining for booking ${bookingId}`);
    }
    if (refundAmount > maxRefundable) {
      throw new Error(
        `Refund amount ${refundAmount} cents exceeds remaining refundable amount ${maxRefundable} cents`
      );
    }

    // Mark as processing
    await this.bookingRepo.update(tenantId, bookingId, {
      refundStatus: 'PROCESSING',
    });

    try {
      // Process refund via Stripe
      const refundResult = await this.paymentProvider.refund({
        paymentIntentId,
        amountCents: refundAmount,
        reason: 'Customer cancelled booking',
      });

      // P1-150 FIX: Track cumulative refunds and determine if partial vs complete
      const cumulativeRefund = previousRefunds + refundResult.amountCents;
      const isPartial = cumulativeRefund < totalPaid;

      // Update with refund details
      const refunded = await this.bookingRepo.update(tenantId, bookingId, {
        refundStatus: isPartial ? 'PARTIAL' : 'COMPLETED',
        refundAmount: cumulativeRefund, // P1-150 FIX: Use cumulative, not just latest
        refundedAt: new Date(),
        stripeRefundId: refundResult.refundId,
        status: isPartial ? 'CANCELED' : 'REFUNDED', // Mark as REFUNDED only if fully refunded
      });

      // Emit event for notifications
      await this._eventEmitter.emit('BookingRefunded', {
        bookingId: refunded.id,
        tenantId,
        email: refunded.email,
        coupleName: refunded.coupleName,
        refundAmount: refundResult.amountCents,
        isPartial,
      });

      return refunded;
    } catch (error) {
      // Mark refund as failed
      await this.bookingRepo.update(tenantId, bookingId, {
        refundStatus: 'FAILED',
      });
      throw error;
    }
  }
}
