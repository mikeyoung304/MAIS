/**
 * Appointment Booking Service
 *
 * Handles TIMESLOT booking operations for time-based scheduling (appointments).
 * Extracted from BookingService as part of P0-1 BookingService decomposition.
 */

import type { BookingRepository, ServiceRepository } from '../lib/ports';
import type { Booking } from '../lib/entities';
import type { EventEmitter } from '../lib/core/events';
import { AppointmentEvents } from '../lib/core/events';
import type { CheckoutSessionFactory } from './checkout-session.factory';
import type { SchedulingAvailabilityService } from './scheduling-availability.service';
import { NotFoundError, MaxBookingsPerDayExceededError } from '../lib/errors';
import { logger } from '../lib/core/logger';

/** Input for creating an appointment checkout session */
export interface CreateAppointmentInput {
  serviceId: string;
  startTime: Date;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientTimezone?: string;
  notes?: string;
}

/** Input for handling appointment payment completion */
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

export interface AppointmentBookingServiceOptions {
  bookingRepo: BookingRepository;
  serviceRepo: ServiceRepository;
  schedulingAvailabilityService: SchedulingAvailabilityService;
  checkoutSessionFactory: CheckoutSessionFactory;
  eventEmitter: EventEmitter;
}

/**
 * Handles TIMESLOT booking operations including checkout creation
 * and payment completion for time-based appointments.
 */
export class AppointmentBookingService {
  private readonly bookingRepo: BookingRepository;
  private readonly serviceRepo: ServiceRepository;
  private readonly schedulingAvailabilityService: SchedulingAvailabilityService;
  private readonly checkoutSessionFactory: CheckoutSessionFactory;
  private readonly eventEmitter: EventEmitter;

  constructor(options: AppointmentBookingServiceOptions) {
    this.bookingRepo = options.bookingRepo;
    this.serviceRepo = options.serviceRepo;
    this.schedulingAvailabilityService = options.schedulingAvailabilityService;
    this.checkoutSessionFactory = options.checkoutSessionFactory;
    this.eventEmitter = options.eventEmitter;
  }

  /**
   * Creates a Stripe checkout session for a time-slot appointment booking
   *
   * MULTI-TENANT: Accepts tenantId for data isolation
   * @throws {NotFoundError} If service doesn't exist
   * @throws {Error} If time slot is not available
   * @throws {MaxBookingsPerDayExceededError} If maxPerDay limit is reached
   */
  async createAppointmentCheckout(
    tenantId: string,
    input: CreateAppointmentInput
  ): Promise<{ checkoutUrl: string }> {
    const service = await this.serviceRepo.getById(tenantId, input.serviceId);
    if (!service) {
      throw new NotFoundError(`Service ${input.serviceId} not found`);
    }

    const endTime = new Date(input.startTime.getTime() + service.durationMinutes * 60 * 1000);

    const isAvailable = await this.schedulingAvailabilityService.isSlotAvailable(
      tenantId,
      input.serviceId,
      input.startTime,
      endTime
    );
    if (!isAvailable) {
      throw new Error(`Time slot starting at ${input.startTime.toISOString()} is not available`);
    }

    // Enforce maxPerDay limit if configured
    if (service.maxPerDay !== null) {
      const existingBookingsCount = await this.bookingRepo.countTimeslotBookingsForServiceOnDate(
        tenantId,
        input.serviceId,
        input.startTime
      );

      if (existingBookingsCount >= service.maxPerDay) {
        const dateStr = input.startTime.toISOString().split('T')[0];
        logger.info(
          {
            tenantId,
            serviceId: input.serviceId,
            date: dateStr,
            existingCount: existingBookingsCount,
            maxPerDay: service.maxPerDay,
          },
          'maxPerDay limit reached for service'
        );
        throw new MaxBookingsPerDayExceededError(dateStr, service.maxPerDay);
      }
    }

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

    return this.checkoutSessionFactory.createCheckoutSession({
      tenantId,
      amountCents: service.priceCents,
      email: input.clientEmail,
      metadata,
      applicationFeeAmount: 0,
      idempotencyKeyParts: [
        tenantId,
        input.clientEmail,
        input.serviceId,
        input.startTime.toISOString(),
        Date.now(),
      ],
    });
  }

  /**
   * Handles payment completion for appointment bookings
   *
   * MULTI-TENANT: Accepts tenantId for data isolation
   * Called by Stripe webhook handler after successful payment for TIMESLOT bookings.
   * Creates a booking record with TIMESLOT type and emits AppointmentBooked event.
   *
   * Defense-in-depth: Re-validates maxPerDay limit even though checkout already checked.
   * This prevents race conditions where multiple checkouts pass validation but only
   * some should succeed based on maxPerDay limit.
   *
   * @throws {NotFoundError} If service doesn't exist
   * @throws {MaxBookingsPerDayExceededError} If maxPerDay limit is reached (defense-in-depth)
   */
  async onAppointmentPaymentCompleted(
    tenantId: string,
    input: AppointmentPaymentCompletedInput
  ): Promise<Booking> {
    const service = await this.serviceRepo.getById(tenantId, input.serviceId);
    if (!service) {
      throw new NotFoundError(`Service ${input.serviceId} not found`);
    }

    // Defense-in-depth: Re-validate maxPerDay limit
    // This handles race conditions where multiple concurrent checkouts
    // may have passed validation but only some should succeed
    if (service.maxPerDay !== null) {
      const existingBookingsCount = await this.bookingRepo.countTimeslotBookingsForServiceOnDate(
        tenantId,
        input.serviceId,
        input.startTime
      );

      if (existingBookingsCount >= service.maxPerDay) {
        const dateStr = input.startTime.toISOString().split('T')[0];
        logger.warn(
          {
            tenantId,
            serviceId: input.serviceId,
            date: dateStr,
            existingCount: existingBookingsCount,
            maxPerDay: service.maxPerDay,
            sessionId: input.sessionId,
          },
          'maxPerDay limit exceeded during payment completion - possible race condition'
        );
        throw new MaxBookingsPerDayExceededError(dateStr, service.maxPerDay);
      }
    }

    const booking: Booking = {
      id: `booking_${Date.now()}`,
      tenantId,
      serviceId: input.serviceId,
      customerId: `customer_${Date.now()}`,
      packageId: '',
      venueId: null,
      coupleName: input.clientName,
      email: input.clientEmail,
      phone: input.clientPhone,
      eventDate: new Date(
        input.startTime.getFullYear(),
        input.startTime.getMonth(),
        input.startTime.getDate()
      )
        .toISOString()
        .split('T')[0],
      addOnIds: [],
      startTime: input.startTime.toISOString(),
      endTime: input.endTime.toISOString(),
      bookingType: 'TIMESLOT' as const,
      clientTimezone: input.clientTimezone || null,
      status: 'CONFIRMED',
      totalCents: input.totalCents,
      notes: input.notes || null,
      commissionAmount: 0,
      commissionPercent: 0,
      stripePaymentIntentId: input.sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await this.bookingRepo.create(tenantId, booking);

    await this.eventEmitter.emit(AppointmentEvents.BOOKED, {
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
      timezone: input.clientTimezone,
    });

    return created;
  }
}
