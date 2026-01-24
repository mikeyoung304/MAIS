/**
 * Wedding Booking Orchestrator
 *
 * Coordinates multi-step wedding booking workflow by orchestrating
 * CheckoutSessionFactory and WeddingDepositService.
 *
 * Pattern: Validate -> Check availability -> Calculate deposit -> Create checkout
 *
 * @module wedding-booking.orchestrator
 */

import type { CatalogRepository } from '../lib/ports';
import type { CreateBookingInput } from '../lib/entities';
import type { AvailabilityService } from './availability.service';
import type {
  CheckoutSessionFactory,
  CreateCheckoutSessionInput,
} from './checkout-session.factory';
import type { WeddingDepositService } from './wedding-deposit.service';
import {
  NotFoundError,
  InvalidBookingTypeError,
  BookingConflictError,
  PackageNotAvailableError,
} from '../lib/errors';
import { logger } from '../lib/core/logger';

/** Input for creating a date booking via the orchestrator */
export interface CreateDateBookingInput {
  packageId: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  addOnIds?: string[];
}

/**
 * Orchestrator for wedding booking workflow
 *
 * Coordinates CheckoutSessionFactory and WeddingDepositService to handle
 * the complete wedding booking flow including deposit calculation and
 * Stripe checkout session creation.
 */
export class WeddingBookingOrchestrator {
  constructor(
    private readonly checkoutSessionFactory: CheckoutSessionFactory,
    private readonly weddingDepositService: WeddingDepositService,
    private readonly catalogRepo: CatalogRepository,
    private readonly availabilityService: AvailabilityService
  ) {}

  /**
   * Creates a Stripe checkout session for a wedding package booking
   *
   * MULTI-TENANT: All queries filter by tenantId
   *
   * @param tenantId - Tenant ID for data isolation
   * @param input - Booking creation data (packageId as slug, eventDate, email, coupleName, addOnIds)
   * @param prefetchedPackage - Optional pre-fetched package to avoid duplicate DB query
   * @returns Object containing the Stripe checkout URL
   * @throws {NotFoundError} If package doesn't exist
   */
  async createCheckout(
    tenantId: string,
    input: CreateBookingInput,
    prefetchedPackage?: { id: string; slug: string; priceCents: number }
  ): Promise<{ checkoutUrl: string }> {
    // Use pre-fetched package if provided, otherwise fetch (avoids duplicate query)
    const pkg = prefetchedPackage ?? await this.catalogRepo.getPackageBySlug(tenantId, input.packageId);
    if (!pkg) {
      logger.warn({ tenantId, packageSlug: input.packageId }, 'Package not found in checkout');
      throw new NotFoundError('The requested resource was not found');
    }

    // Calculate deposit and commission
    const calc = await this.weddingDepositService.calculateDeposit(
      tenantId,
      pkg.priceCents,
      input.addOnIds || []
    );

    // Prepare metadata and create checkout session
    const metadata: Record<string, string> = {
      tenantId,
      packageId: pkg.id,
      eventDate: input.eventDate,
      email: input.email,
      coupleName: input.coupleName,
      addOnIds: JSON.stringify(input.addOnIds || []),
      bookingType: input.bookingType || 'DATE',
      commissionAmount: String(calc.totalCommission),
      depositCommissionAmount: String(calc.depositCommissionAmount),
      balanceCommissionAmount: String(calc.balanceCommissionAmount),
      commissionPercent: String(calc.totalCommission > 0 ? 12 : 0),
      isDeposit: String(calc.isDeposit),
      totalCents: String(calc.subtotal),
      depositPercent: calc.depositPercent !== null ? String(calc.depositPercent) : '',
    };

    const checkoutInput: CreateCheckoutSessionInput = {
      tenantId,
      amountCents: calc.amountToCharge,
      email: input.email,
      metadata,
      applicationFeeAmount: calc.isDeposit ? calc.depositCommissionAmount : calc.totalCommission,
      idempotencyKeyParts: [tenantId, input.email, pkg.id, input.eventDate, Date.now()],
    };

    return this.checkoutSessionFactory.createCheckoutSession(checkoutInput);
  }

  /**
   * Creates a Stripe checkout session for a DATE booking (e.g., weddings)
   *
   * MULTI-TENANT: All queries filter by tenantId
   * Validates package, checks availability, and delegates to createCheckout.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param input - Date booking data (packageId as ID, date, customerName, customerEmail, addOnIds)
   * @returns Object containing the Stripe checkout URL
   * @throws {NotFoundError} If package doesn't exist
   * @throws {InvalidBookingTypeError} If package doesn't support DATE booking
   * @throws {PackageNotAvailableError} If package is inactive
   * @throws {BookingConflictError} If date is unavailable
   */
  async createDateBooking(
    tenantId: string,
    input: CreateDateBookingInput
  ): Promise<{ checkoutUrl: string }> {
    // Fetch and validate package
    const pkg = await this.catalogRepo.getPackageById(tenantId, input.packageId);
    if (!pkg) {
      logger.warn({ tenantId, packageId: input.packageId }, 'Package not found in date booking');
      throw new NotFoundError('The requested resource was not found');
    }
    if (pkg.bookingType !== 'DATE') {
      throw new InvalidBookingTypeError(pkg.title, 'DATE');
    }
    if (!pkg.active) {
      logger.warn({ tenantId, packageId: input.packageId }, 'Inactive package requested');
      throw new PackageNotAvailableError();
    }

    // Check availability
    const availability = await this.availabilityService.checkAvailability(tenantId, input.date);
    if (!availability.available) {
      const reason =
        availability.reason === 'blackout'
          ? 'This date is not available for booking'
          : availability.reason === 'booked'
            ? 'This date is already booked'
            : 'This date is not available';
      throw new BookingConflictError(input.date, reason);
    }

    // Delegate to createCheckout - pass pre-fetched package to avoid duplicate DB query
    return this.createCheckout(
      tenantId,
      {
        packageId: pkg.slug,
        eventDate: input.date,
        email: input.customerEmail,
        coupleName: input.customerName,
        addOnIds: input.addOnIds,
        bookingType: 'DATE',
      },
      pkg // Pass pre-fetched package
    );
  }

  /**
   * Creates a Stripe checkout session for balance payment
   *
   * MULTI-TENANT: All queries filter by tenantId
   *
   * @param tenantId - Tenant ID for data isolation
   * @param bookingId - Booking identifier
   * @returns Object containing the Stripe checkout URL and balance amount
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {Error} If booking doesn't have deposit or balance already paid
   */
  async createBalancePaymentCheckout(
    tenantId: string,
    bookingId: string
  ): Promise<{ checkoutUrl: string; balanceAmountCents: number }> {
    // Prepare balance payment data
    const balanceData = await this.weddingDepositService.prepareBalancePayment({
      tenantId,
      bookingId,
    });

    // Create checkout session
    const checkoutInput: CreateCheckoutSessionInput = {
      tenantId,
      amountCents: balanceData.balanceAmountCents,
      email: balanceData.booking.email,
      metadata: balanceData.metadata,
      applicationFeeAmount: balanceData.balanceCommission,
      idempotencyKeyParts: [tenantId, balanceData.booking.email, bookingId, 'balance', Date.now()],
    };

    const result = await this.checkoutSessionFactory.createCheckoutSession(checkoutInput);
    return { ...result, balanceAmountCents: balanceData.balanceAmountCents };
  }
}
