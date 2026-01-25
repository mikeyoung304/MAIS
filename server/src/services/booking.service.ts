/**
 * Booking Service (Facade)
 *
 * This service acts as a facade that delegates to focused services extracted
 * during the P0-1 BookingService decomposition. It maintains backward compatibility
 * with existing consumers while routing calls to the appropriate specialized service.
 *
 * Decomposed Services:
 * - BookingQueryService: Read operations (getAllBookings, getById, getUnavailableDates)
 * - BookingLifecycleService: State transitions (reschedule, cancel, markPaymentFailed)
 * - WeddingBookingOrchestrator: Wedding booking workflow (createCheckout, createDateBooking)
 * - WeddingDepositService: Deposit/balance payment logic
 * - AppointmentBookingService: TIMESLOT booking operations
 * - RefundProcessingService: Stripe refund processing
 * - CheckoutSessionFactory: Shared checkout session creation
 *
 * @module booking.service
 */

import type { BookingRepository, PaymentProvider, ServiceRepository } from '../lib/ports';
import type { Booking, CreateBookingInput } from '../lib/entities';
import type { CatalogRepository } from '../lib/ports';
import type { EventEmitter } from '../lib/core/events';
import { BookingEvents } from '../lib/core/events';
import { NotFoundError } from '../lib/errors';
import type { CommissionService } from './commission.service';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { IdempotencyService } from './idempotency.service';
import type { SchedulingAvailabilityService } from './scheduling-availability.service';
import type { AvailabilityService } from './availability.service';
import { logger } from '../lib/core/logger';
import type { PrismaClient } from '../generated/prisma/client';
import type { Config } from '../lib/core/config';

// Import decomposed services
import { BookingQueryService, type GetAppointmentsFilters } from './booking-query.service';
import { BookingLifecycleService } from './booking-lifecycle.service';
import {
  WeddingBookingOrchestrator,
  type CreateDateBookingInput,
} from './wedding-booking.orchestrator';
import { WeddingDepositService } from './wedding-deposit.service';
import {
  AppointmentBookingService,
  type CreateAppointmentInput,
  type AppointmentPaymentCompletedInput,
} from './appointment-booking.service';
import { RefundProcessingService } from './refund-processing.service';
import { CheckoutSessionFactory } from './checkout-session.factory';

// Re-export types for backward compatibility
export type { CreateAppointmentInput, AppointmentPaymentCompletedInput, GetAppointmentsFilters };

/**
 * Configuration options for BookingService constructor
 *
 * Uses options object pattern to avoid undefined placeholder parameters
 * and improve maintainability when adding/removing optional dependencies.
 */
export interface BookingServiceOptions {
  // Required dependencies
  bookingRepo: BookingRepository;
  catalogRepo: CatalogRepository;
  eventEmitter: EventEmitter;
  paymentProvider: PaymentProvider;
  commissionService: CommissionService;
  tenantRepo: PrismaTenantRepository;
  idempotencyService: IdempotencyService;
  config: Config;

  // Optional dependencies (omit rather than pass undefined)
  /** Scheduling availability service for TIMESLOT bookings */
  schedulingAvailabilityService?: SchedulingAvailabilityService;
  /** Service repository for TIMESLOT bookings */
  serviceRepo?: ServiceRepository;
  /** Availability service for DATE booking availability checks */
  availabilityService?: AvailabilityService;
  /** Prisma client for transactional operations with advisory locks (TODO-708) */
  prisma?: PrismaClient;
}

/**
 * BookingService Facade
 *
 * Maintains backward compatibility by delegating to focused services.
 * This facade will be deprecated once all consumers migrate to using
 * the decomposed services directly.
 */
export class BookingService {
  // Decomposed services
  private readonly queryService: BookingQueryService;
  private readonly lifecycleService: BookingLifecycleService;
  private readonly weddingOrchestrator: WeddingBookingOrchestrator;
  private readonly weddingDepositService: WeddingDepositService;
  private readonly appointmentService?: AppointmentBookingService;
  private readonly refundService: RefundProcessingService;
  private readonly checkoutFactory: CheckoutSessionFactory;

  // Original dependencies (needed for onPaymentCompleted)
  private readonly bookingRepo: BookingRepository;
  private readonly catalogRepo: CatalogRepository;
  private readonly _eventEmitter: EventEmitter;
  private readonly tenantRepo: PrismaTenantRepository;
  private readonly prisma?: PrismaClient;

  constructor(options: BookingServiceOptions) {
    // Store original dependencies for onPaymentCompleted
    this.bookingRepo = options.bookingRepo;
    this.catalogRepo = options.catalogRepo;
    this.prisma = options.prisma;
    this._eventEmitter = options.eventEmitter;
    this.tenantRepo = options.tenantRepo;

    // Initialize CheckoutSessionFactory
    this.checkoutFactory = new CheckoutSessionFactory(
      options.paymentProvider,
      options.tenantRepo,
      options.idempotencyService,
      options.config
    );

    // Initialize WeddingDepositService
    this.weddingDepositService = new WeddingDepositService(
      options.bookingRepo,
      options.tenantRepo,
      options.commissionService,
      options.eventEmitter
    );

    // Initialize BookingQueryService
    this.queryService = new BookingQueryService({
      bookingRepo: options.bookingRepo,
    });

    // Initialize BookingLifecycleService
    this.lifecycleService = new BookingLifecycleService({
      bookingRepo: options.bookingRepo,
      eventEmitter: options.eventEmitter,
    });

    // Initialize WeddingBookingOrchestrator (requires availabilityService)
    if (options.availabilityService) {
      this.weddingOrchestrator = new WeddingBookingOrchestrator(
        this.checkoutFactory,
        this.weddingDepositService,
        options.catalogRepo,
        options.availabilityService
      );
    } else {
      // Create a minimal orchestrator for environments without availability service
      this.weddingOrchestrator = new WeddingBookingOrchestrator(
        this.checkoutFactory,
        this.weddingDepositService,
        options.catalogRepo,
        { checkAvailability: async () => ({ available: true }) } as unknown as AvailabilityService
      );
    }

    // Initialize AppointmentBookingService (optional - requires scheduling dependencies + Prisma)
    // TODO-708: Prisma is now required for advisory lock-based TOCTOU prevention
    if (options.serviceRepo && options.schedulingAvailabilityService && options.prisma) {
      this.appointmentService = new AppointmentBookingService({
        bookingRepo: options.bookingRepo,
        serviceRepo: options.serviceRepo,
        schedulingAvailabilityService: options.schedulingAvailabilityService,
        checkoutSessionFactory: this.checkoutFactory,
        eventEmitter: options.eventEmitter,
        prisma: options.prisma,
      });
    }

    // Initialize RefundProcessingService
    this.refundService = new RefundProcessingService(
      options.bookingRepo,
      options.paymentProvider,
      options.eventEmitter
    );
  }

  // ============================================================================
  // Wedding Package Booking (Delegated to WeddingBookingOrchestrator)
  // ============================================================================

  /**
   * Creates a Stripe checkout session for a wedding package booking
   * @delegate WeddingBookingOrchestrator.createCheckout
   */
  async createCheckout(
    tenantId: string,
    input: CreateBookingInput
  ): Promise<{ checkoutUrl: string }> {
    return this.weddingOrchestrator.createCheckout(tenantId, input);
  }

  /**
   * Creates a Stripe checkout session for a DATE booking (e.g., weddings)
   * @delegate WeddingBookingOrchestrator.createDateBooking
   */
  async createDateBooking(
    tenantId: string,
    input: CreateDateBookingInput
  ): Promise<{ checkoutUrl: string }> {
    return this.weddingOrchestrator.createDateBooking(tenantId, input);
  }

  /**
   * Creates a Stripe checkout session for balance payment
   * @delegate WeddingBookingOrchestrator.createBalancePaymentCheckout
   */
  async createBalancePaymentCheckout(
    tenantId: string,
    bookingId: string
  ): Promise<{ checkoutUrl: string; balanceAmountCents: number }> {
    return this.weddingOrchestrator.createBalancePaymentCheckout(tenantId, bookingId);
  }

  /**
   * Handles balance payment completion
   * @delegate WeddingDepositService.completeBalancePayment
   */
  async onBalancePaymentCompleted(
    tenantId: string,
    bookingId: string,
    balanceAmountCents: number
  ): Promise<Booking> {
    return this.weddingDepositService.completeBalancePayment(
      tenantId,
      bookingId,
      balanceAmountCents
    );
  }

  /**
   * Confirms a chatbot-created booking after payment completion
   *
   * Updates the booking from PENDING to CONFIRMED and sets the paidAt timestamp.
   * Emits BookingEvents.PAID for downstream processing (confirmation emails, etc.)
   *
   * @param tenantId - Tenant ID (multi-tenant isolation)
   * @param bookingId - Booking ID to confirm
   * @param amountPaidCents - Amount paid in cents
   * @returns Updated booking
   */
  async confirmChatbotBooking(
    tenantId: string,
    bookingId: string,
    amountPaidCents: number
  ): Promise<Booking> {
    // Fetch the booking with package details for the event payload
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found for tenant ${tenantId}`);
    }

    // Update booking to CONFIRMED with payment timestamp
    const confirmedBooking = await this.bookingRepo.update(tenantId, bookingId, {
      status: 'CONFIRMED',
      balancePaidAt: new Date(), // P1 fix: Set payment timestamp for reporting queries
    });

    // Fetch package title for the event payload (only for DATE bookings with packageId)
    let packageTitle = 'Package';
    if (booking.packageId) {
      const pkg = await this.catalogRepo.getPackageById(tenantId, booking.packageId);
      packageTitle = pkg?.title || 'Package';
    }

    // Fetch add-on titles if any (only for DATE bookings with packageId)
    const addOnTitles: string[] = [];
    if (booking.packageId && booking.addOnIds && booking.addOnIds.length > 0) {
      const addOns = await this.catalogRepo.getAddOnsByPackageId(tenantId, booking.packageId);
      for (const addOn of addOns) {
        if (booking.addOnIds.includes(addOn.id)) {
          addOnTitles.push(addOn.title);
        }
      }
    }

    // Emit PAID event for downstream processing (sends confirmation email via DI event handler)
    await this._eventEmitter.emit(BookingEvents.PAID, {
      bookingId,
      email: booking.email,
      coupleName: booking.coupleName,
      eventDate: booking.eventDate,
      packageTitle,
      totalCents: amountPaidCents,
      addOnTitles,
    });

    return confirmedBooking;
  }

  // ============================================================================
  // Query Operations (Delegated to BookingQueryService)
  // ============================================================================

  /**
   * Retrieves all bookings from the database for a tenant
   * @delegate BookingQueryService.getAllBookings
   */
  async getAllBookings(tenantId: string): Promise<Booking[]> {
    return this.queryService.getAllBookings(tenantId);
  }

  /**
   * Retrieves a specific booking by ID
   * @delegate BookingQueryService.getBookingById
   */
  async getBookingById(tenantId: string, id: string): Promise<Booking> {
    return this.queryService.getBookingById(tenantId, id);
  }

  /**
   * Retrieves all unavailable booking dates within a date range for a tenant
   * @delegate BookingQueryService.getUnavailableDates
   */
  async getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<string[]> {
    return this.queryService.getUnavailableDates(tenantId, startDate, endDate);
  }

  /**
   * Retrieves all appointment bookings with optional filters
   * @delegate BookingQueryService.getAppointments
   */
  async getAppointments(tenantId: string, filters?: GetAppointmentsFilters): Promise<any[]> {
    return this.queryService.getAppointments(tenantId, filters);
  }

  // ============================================================================
  // Booking Lifecycle (Delegated to BookingLifecycleService)
  // ============================================================================

  /**
   * Reschedule a booking to a new date
   * @delegate BookingLifecycleService.rescheduleBooking
   */
  async rescheduleBooking(tenantId: string, bookingId: string, newDate: string): Promise<Booking> {
    return this.lifecycleService.rescheduleBooking(tenantId, bookingId, newDate);
  }

  /**
   * Cancel a booking with 3-phase pattern
   * @delegate BookingLifecycleService.cancelBooking
   */
  async cancelBooking(
    tenantId: string,
    bookingId: string,
    cancelledBy: 'CUSTOMER' | 'TENANT' | 'ADMIN' | 'SYSTEM',
    reason?: string
  ): Promise<Booking> {
    return this.lifecycleService.cancelBooking(tenantId, bookingId, cancelledBy, reason);
  }

  /**
   * Mark a booking's payment as failed
   * @delegate BookingLifecycleService.markPaymentFailed
   */
  async markPaymentFailed(
    tenantId: string,
    bookingId: string,
    failureDetails: {
      reason: string;
      code: string;
      paymentIntentId: string;
    }
  ): Promise<Booking> {
    return this.lifecycleService.markPaymentFailed(tenantId, bookingId, failureDetails);
  }

  // ============================================================================
  // Appointment Scheduling (Delegated to AppointmentBookingService)
  // ============================================================================

  /**
   * Creates a Stripe checkout session for a time-slot appointment booking
   * @delegate AppointmentBookingService.createAppointmentCheckout
   */
  async createAppointmentCheckout(
    tenantId: string,
    input: CreateAppointmentInput
  ): Promise<{ checkoutUrl: string }> {
    if (!this.appointmentService) {
      throw new Error(
        'Scheduling services are not available. Ensure ServiceRepository and SchedulingAvailabilityService are injected.'
      );
    }
    return this.appointmentService.createAppointmentCheckout(tenantId, input);
  }

  /**
   * Handles payment completion for appointment bookings
   * @delegate AppointmentBookingService.onAppointmentPaymentCompleted
   */
  async onAppointmentPaymentCompleted(
    tenantId: string,
    input: AppointmentPaymentCompletedInput
  ): Promise<any> {
    if (!this.appointmentService) {
      throw new Error('ServiceRepository is not available. Ensure it is injected.');
    }
    return this.appointmentService.onAppointmentPaymentCompleted(tenantId, input);
  }

  // ============================================================================
  // Refund Processing (Delegated to RefundProcessingService)
  // ============================================================================

  /**
   * Process refund for a cancelled booking
   * @delegate RefundProcessingService.processRefund
   */
  async processRefund(
    tenantId: string,
    bookingId: string,
    paymentIntentId: string,
    amountCents?: number
  ): Promise<Booking> {
    return this.refundService.processRefund(tenantId, bookingId, paymentIntentId, amountCents);
  }

  // ============================================================================
  // Payment Completion (Kept in facade - complex booking creation logic)
  // ============================================================================

  /**
   * Handles payment completion and creates a confirmed booking
   *
   * This method remains in the facade because it contains complex logic for:
   * - Package enrichment with add-ons
   * - Reminder date calculation
   * - Deposit vs full payment handling
   * - Atomic booking + payment record creation
   *
   * Future refactor: Extract to WeddingPaymentCompletionService
   */
  async onPaymentCompleted(
    tenantId: string,
    input: {
      sessionId: string;
      packageId: string;
      eventDate: string;
      email: string;
      coupleName: string;
      addOnIds?: string[];
      totalCents: number;
      commissionAmount?: number;
      commissionPercent?: number;
      bookingType?: 'DATE' | 'TIMESLOT';
      isDeposit?: boolean;
      depositPercent?: number;
    }
  ): Promise<Booking> {
    // PERFORMANCE FIX: Fetch package with add-ons in single query (eliminates N+1)
    // FIX: Use getPackageByIdWithAddOns since input.packageId is a CUID, not a slug
    const pkg = await this.catalogRepo.getPackageByIdWithAddOns(tenantId, input.packageId);
    if (!pkg) {
      logger.warn(
        { tenantId, packageId: input.packageId },
        'Package not found in payment completion flow'
      );
      throw new NotFoundError('The requested resource was not found');
    }

    // Extract add-on titles from the already-fetched add-ons
    const addOnTitles: string[] = [];
    if (input.addOnIds && input.addOnIds.length > 0) {
      const selectedAddOns = pkg.addOns.filter((a) => input.addOnIds?.includes(a.id));
      addOnTitles.push(...selectedAddOns.map((a) => a.title));
    }

    // Calculate reminder due date (7 days before event)
    const eventDate = new Date(input.eventDate + 'T00:00:00Z');
    const now = new Date();
    const daysUntilEvent = Math.floor(
      (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const reminderDueDate =
      daysUntilEvent > 7
        ? new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : undefined;

    // Handle deposit vs full payment
    let depositPaidAmount: number | undefined;
    let balanceDueDate: string | undefined;
    let bookingStatus: Booking['status'] = 'PAID';

    if (input.isDeposit && input.depositPercent) {
      depositPaidAmount = input.totalCents;
      bookingStatus = 'DEPOSIT_PAID';

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
      packageId: pkg.id,
      coupleName: input.coupleName,
      email: input.email,
      eventDate: input.eventDate,
      addOnIds: input.addOnIds || [],
      totalCents: input.totalCents,
      commissionAmount: input.commissionAmount,
      commissionPercent: input.commissionPercent,
      bookingType: input.bookingType || 'DATE',
      status: bookingStatus,
      createdAt: new Date().toISOString(),
      reminderDueDate,
      depositPaidAmount,
      balanceDueDate,
    };

    // Create booking AND payment record atomically
    const created = await this.bookingRepo.create(tenantId, booking, {
      amount: input.totalCents,
      processor: 'stripe',
      processorId: input.sessionId,
    });

    // Create Project for post-booking customer portal (Project Hub)
    // This enables customer self-service via the Project Hub agent
    if (this.prisma) {
      try {
        const project = await this.prisma.project.create({
          data: {
            tenantId,
            bookingId: created.id,
            customerId: created.email, // Use email as customer identifier
            status: 'ACTIVE',
          },
        });

        // Record initial PROJECT_CREATED event for timeline
        await this.prisma.projectEvent.create({
          data: {
            tenantId,
            projectId: project.id,
            version: 1,
            type: 'PROJECT_CREATED',
            actor: 'SYSTEM',
            payload: {
              bookingId: created.id,
              packageTitle: pkg.title,
              eventDate: created.eventDate,
            },
            visibleToCustomer: true,
            visibleToTenant: true,
          },
        });

        logger.info(
          { tenantId, bookingId: created.id, projectId: project.id },
          'Project Hub created for booking'
        );
      } catch (projectError) {
        // Log but don't fail booking - Project Hub is enhancement, not critical path
        logger.error(
          {
            tenantId,
            bookingId: created.id,
            error: projectError instanceof Error ? projectError.message : String(projectError),
          },
          'Failed to create Project Hub for booking'
        );
      }
    }

    // Emit BookingPaid event for notifications with enriched data
    await this._eventEmitter.emit(BookingEvents.PAID, {
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
}
