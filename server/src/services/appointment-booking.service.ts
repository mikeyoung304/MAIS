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
import type { PrismaClient } from '../generated/prisma/client';
import { hashServiceDate } from '../lib/advisory-locks';

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
  /** Prisma client for transactional operations with advisory locks (TODO-708) */
  prisma: PrismaClient;
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
  private readonly prisma: PrismaClient;

  constructor(options: AppointmentBookingServiceOptions) {
    this.bookingRepo = options.bookingRepo;
    this.serviceRepo = options.serviceRepo;
    this.schedulingAvailabilityService = options.schedulingAvailabilityService;
    this.checkoutSessionFactory = options.checkoutSessionFactory;
    this.eventEmitter = options.eventEmitter;
    this.prisma = options.prisma;
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
   * TODO-708 FIX: Uses PostgreSQL advisory locks to prevent TOCTOU race conditions.
   * The count check and booking creation are wrapped in a single transaction with
   * an advisory lock to ensure atomic enforcement of maxPerDay limits.
   *
   * @throws {NotFoundError} If service doesn't exist
   * @throws {MaxBookingsPerDayExceededError} If maxPerDay limit is reached
   */
  async onAppointmentPaymentCompleted(
    tenantId: string,
    input: AppointmentPaymentCompletedInput
  ): Promise<Booking> {
    const service = await this.serviceRepo.getById(tenantId, input.serviceId);
    if (!service) {
      throw new NotFoundError(`Service ${input.serviceId} not found`);
    }

    const dateStr = input.startTime.toISOString().split('T')[0];

    // TODO-708 FIX: Wrap count check AND booking creation in a single transaction
    // with advisory lock to prevent TOCTOU race condition on maxPerDay enforcement
    const created = await this.prisma.$transaction(async (tx) => {
      // Acquire advisory lock for this specific tenant+service+date combination
      // Lock is automatically released when transaction commits or aborts
      const lockId = hashServiceDate(tenantId, input.serviceId, dateStr);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

      // Now safe to check count atomically within the lock
      if (service.maxPerDay !== null) {
        const startOfDay = new Date(input.startTime);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(input.startTime);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const existingBookingsCount = await tx.booking.count({
          where: {
            tenantId,
            serviceId: input.serviceId,
            bookingType: 'TIMESLOT',
            startTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
            status: {
              in: ['PENDING', 'CONFIRMED'],
            },
          },
        });

        if (existingBookingsCount >= service.maxPerDay) {
          logger.warn(
            {
              tenantId,
              serviceId: input.serviceId,
              date: dateStr,
              existingCount: existingBookingsCount,
              maxPerDay: service.maxPerDay,
              sessionId: input.sessionId,
            },
            'maxPerDay limit exceeded during payment completion - blocked by advisory lock'
          );
          throw new MaxBookingsPerDayExceededError(dateStr, service.maxPerDay);
        }
      }

      // Normalize email for customer lookup/creation
      const normalizedEmail = input.clientEmail.toLowerCase().trim();

      // Create or find the customer (tenant-scoped)
      const customer = await tx.customer.upsert({
        where: {
          tenantId_email: {
            tenantId,
            email: normalizedEmail,
          },
        },
        update: {
          name: input.clientName,
          phone: input.clientPhone,
        },
        create: {
          tenantId,
          email: normalizedEmail,
          name: input.clientName,
          phone: input.clientPhone,
        },
      });

      // Create booking atomically within the same transaction
      const bookingData = await tx.booking.create({
        data: {
          tenantId,
          customerId: customer.id,
          serviceId: input.serviceId,
          // tierId omitted - TIMESLOT bookings don't have tiers (use serviceId instead)
          date: new Date(dateStr),
          totalPrice: input.totalCents,
          status: 'CONFIRMED',
          bookingType: 'TIMESLOT',
          startTime: input.startTime,
          endTime: input.endTime,
          clientTimezone: input.clientTimezone || null,
          notes: input.notes || null,
          commissionAmount: 0,
          commissionPercent: 0,
          stripePaymentIntentId: input.sessionId,
        },
      });

      // Map Prisma model to domain entity
      const booking: Booking = {
        id: bookingData.id,
        tenantId: bookingData.tenantId,
        serviceId: bookingData.serviceId || undefined,
        customerId: bookingData.customerId,
        tierId: bookingData.tierId || null,
        venueId: null,
        coupleName: input.clientName,
        email: input.clientEmail,
        phone: input.clientPhone,
        eventDate: dateStr,
        addOnIds: [],
        startTime: bookingData.startTime?.toISOString(),
        endTime: bookingData.endTime?.toISOString(),
        bookingType: 'TIMESLOT' as const,
        clientTimezone: bookingData.clientTimezone || null,
        status: 'CONFIRMED',
        totalCents: bookingData.totalPrice,
        notes: bookingData.notes || null,
        commissionAmount: bookingData.commissionAmount,
        commissionPercent: bookingData.commissionPercent.toNumber(),
        stripePaymentIntentId: input.sessionId,
        createdAt: bookingData.createdAt.toISOString(),
        updatedAt: bookingData.updatedAt.toISOString(),
      };

      return booking;
    });

    // Emit event outside transaction (event emission should not block transaction)
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
