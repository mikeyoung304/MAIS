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
import { calculateScalingPrice } from './scaling-price.service';
import type { ScalingRules } from '@macon/contracts';
import {
  NotFoundError,
  InvalidBookingTypeError,
  BookingConflictError,
  TierNotAvailableError,
} from '../lib/errors';
import { logger } from '../lib/core/logger';

/** Input for creating a date booking via the orchestrator */
export interface CreateDateBookingInput {
  tierId: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  addOnIds?: string[];
  guestCount?: number;
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
   * Creates a Stripe checkout session for a wedding tier booking
   *
   * MULTI-TENANT: All queries filter by tenantId
   *
   * @param tenantId - Tenant ID for data isolation
   * @param input - Booking creation data (tierId, eventDate, email, coupleName, addOnIds)
   * @param prefetchedTier - Optional pre-fetched tier to avoid duplicate DB query
   * @returns Object containing the Stripe checkout URL
   * @throws {NotFoundError} If tier doesn't exist
   */
  async createCheckout(
    tenantId: string,
    input: CreateBookingInput & { guestCount?: number },
    prefetchedTier?: {
      id: string;
      slug: string;
      priceCents: number;
      scalingRules?: ScalingRules | null;
      maxGuests?: number | null;
    }
  ): Promise<{ checkoutUrl: string }> {
    // Use pre-fetched tier if provided, otherwise fetch (avoids duplicate query)
    const tier = prefetchedTier ?? (await this.catalogRepo.getTierById(tenantId, input.tierId));
    if (!tier) {
      logger.warn({ tenantId, tierId: input.tierId }, 'Tier not found in checkout');
      throw new NotFoundError('The requested resource was not found');
    }

    // Calculate total with per-person scaling (if applicable)
    // Backend ALWAYS recalculates — never trust client-submitted totals
    const effectivePriceCents = (() => {
      const scalingRules = (tier as { scalingRules?: ScalingRules | null }).scalingRules;
      const maxGuests = (tier as { maxGuests?: number | null }).maxGuests;

      if (scalingRules && scalingRules.components.length > 0) {
        if (!input.guestCount) {
          throw new Error('Guest count is required for tiers with per-person pricing');
        }
        const result = calculateScalingPrice(
          { priceCents: tier.priceCents, scalingRules, maxGuests: maxGuests ?? null },
          input.guestCount
        );
        return result.totalBeforeCommission;
      }
      return tier.priceCents;
    })();

    // Calculate deposit and commission using scaled price
    const calc = await this.weddingDepositService.calculateDeposit(
      tenantId,
      effectivePriceCents,
      input.addOnIds || []
    );

    // Prepare metadata and create checkout session
    const metadata: Record<string, string> = {
      tenantId,
      tierId: tier.id,
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
      ...(input.guestCount ? { guestCount: String(input.guestCount) } : {}),
    };

    const checkoutInput: CreateCheckoutSessionInput = {
      tenantId,
      amountCents: calc.amountToCharge,
      email: input.email,
      metadata,
      applicationFeeAmount: calc.isDeposit ? calc.depositCommissionAmount : calc.totalCommission,
      idempotencyKeyParts: [tenantId, input.email, tier.id, input.eventDate, Date.now()],
    };

    return this.checkoutSessionFactory.createCheckoutSession(checkoutInput);
  }

  /**
   * Creates a Stripe checkout session for a DATE booking (e.g., weddings)
   *
   * MULTI-TENANT: All queries filter by tenantId
   * Validates tier, checks availability, and delegates to createCheckout.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param input - Date booking data (tierId as ID, date, customerName, customerEmail, addOnIds)
   * @returns Object containing the Stripe checkout URL
   * @throws {NotFoundError} If tier doesn't exist
   * @throws {InvalidBookingTypeError} If tier doesn't support DATE booking
   * @throws {TierNotAvailableError} If tier is inactive
   * @throws {BookingConflictError} If date is unavailable
   */
  async createDateBooking(
    tenantId: string,
    input: CreateDateBookingInput
  ): Promise<{ checkoutUrl: string }> {
    // Fetch and validate tier
    const tier = await this.catalogRepo.getTierById(tenantId, input.tierId);
    if (!tier) {
      logger.warn({ tenantId, tierId: input.tierId }, 'Tier not found in date booking');
      throw new NotFoundError('The requested resource was not found');
    }
    if (tier.bookingType !== 'DATE') {
      throw new InvalidBookingTypeError(tier.title, 'DATE');
    }
    if (!tier.active) {
      logger.warn({ tenantId, tierId: input.tierId }, 'Inactive tier requested');
      throw new TierNotAvailableError();
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

    // Validate guest count against tier maxGuests
    if (input.guestCount && tier.maxGuests && input.guestCount > tier.maxGuests) {
      throw new Error(
        `Guest count ${input.guestCount} exceeds maximum of ${tier.maxGuests} for this tier`
      );
    }

    // Require guest count if tier has scaling rules
    const scalingRules = (tier as { scalingRules?: ScalingRules | null }).scalingRules;
    if (scalingRules && scalingRules.components?.length > 0 && !input.guestCount) {
      throw new Error('Guest count is required for tiers with per-person pricing');
    }

    // Delegate to createCheckout - pass pre-fetched tier to avoid duplicate DB query
    return this.createCheckout(
      tenantId,
      {
        tierId: tier.slug,
        eventDate: input.date,
        email: input.customerEmail,
        coupleName: input.customerName,
        addOnIds: input.addOnIds,
        bookingType: 'DATE',
        guestCount: input.guestCount,
      },
      tier // Pass pre-fetched tier
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
