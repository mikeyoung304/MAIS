/**
 * Wedding Deposit Service
 *
 * Handles deposit calculation, balance payment logic, and deposit/balance
 * payment completion for wedding bookings.
 *
 * Extracted from BookingService as part of P0-1 BookingService decomposition.
 *
 * @module wedding-deposit.service
 */

import type { Booking } from '../lib/entities';
import type { BookingRepository } from '../lib/ports';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { CommissionService } from './commission.service';
import type { EventEmitter } from '../lib/core/events';
import { BookingEvents } from '../lib/core/events';
import { NotFoundError } from '../lib/errors';

/**
 * Deposit calculation result
 */
export interface DepositCalculation {
  amountToCharge: number;
  isDeposit: boolean;
  depositPercent: number | null;
  depositCommissionAmount: number;
  balanceCommissionAmount: number;
  totalCommission: number;
  subtotal: number;
}

/**
 * Balance payment checkout input
 */
export interface BalancePaymentInput {
  bookingId: string;
  tenantId: string;
}

/**
 * Balance payment checkout result
 */
export interface BalancePaymentResult {
  balanceAmountCents: number;
  balanceCommission: number;
  booking: Booking;
  metadata: Record<string, string>;
}

/**
 * Service for handling wedding deposit and balance payment logic
 */
export class WeddingDepositService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly tenantRepo: PrismaTenantRepository,
    private readonly commissionService: CommissionService,
    private readonly eventEmitter: EventEmitter
  ) {}

  /**
   * Calculate deposit amount and commission split
   *
   * @param tenantId - Tenant ID for deposit configuration
   * @param packagePriceCents - Base package price in cents
   * @param addOnIds - Optional add-on IDs for total calculation
   * @returns Deposit calculation with amounts and commission split
   */
  async calculateDeposit(
    tenantId: string,
    packagePriceCents: number,
    addOnIds: string[] = []
  ): Promise<DepositCalculation> {
    // Fetch tenant to get deposit configuration
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError('The requested resource was not found');
    }

    // Calculate total with commission
    const calculation = await this.commissionService.calculateBookingTotal(
      tenantId,
      packagePriceCents,
      addOnIds
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

      // Split commission proportionally between deposit and balance
      depositCommissionAmount = Math.round((calculation.commissionAmount * depositPercent) / 100);
      balanceCommissionAmount = calculation.commissionAmount - depositCommissionAmount;
    }

    return {
      amountToCharge,
      isDeposit,
      depositPercent,
      depositCommissionAmount,
      balanceCommissionAmount,
      totalCommission: calculation.commissionAmount,
      subtotal: calculation.subtotal,
    };
  }

  /**
   * Prepare balance payment checkout data
   *
   * Validates booking has deposit paid and balance due, calculates remaining
   * amount, and prepares metadata for Stripe checkout.
   *
   * @param input - Balance payment input
   * @returns Balance payment checkout data
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {Error} If booking doesn't have deposit or balance already paid
   */
  async prepareBalancePayment(input: BalancePaymentInput): Promise<BalancePaymentResult> {
    const { tenantId, bookingId } = input;

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

    // Calculate balance commission proportionally from original booking commission
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
      commissionAmount: String(balanceCommission),
      commissionPercent: String(booking.commissionPercent),
    };

    return {
      balanceAmountCents,
      balanceCommission,
      booking,
      metadata,
    };
  }

  /**
   * Complete balance payment
   *
   * Called by webhook handler after successful balance payment.
   * Updates booking with balance paid details and changes status to PAID.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param bookingId - Booking identifier
   * @param balanceAmountCents - Balance amount paid in cents
   * @returns Updated booking with balance paid
   */
  async completeBalancePayment(
    tenantId: string,
    bookingId: string,
    balanceAmountCents: number
  ): Promise<Booking> {
    // Use atomic balance payment completion with advisory lock
    const updated = await this.bookingRepo.completeBalancePayment(
      tenantId,
      bookingId,
      balanceAmountCents
    );

    // If null returned, balance was already paid (idempotent success)
    if (!updated) {
      const existing = await this.bookingRepo.findById(tenantId, bookingId);
      if (!existing) {
        throw new NotFoundError(`Booking ${bookingId} not found`);
      }
      return existing;
    }

    // Emit event for downstream processing (notifications)
    await this.eventEmitter.emit(BookingEvents.BALANCE_PAYMENT_COMPLETED, {
      bookingId: updated.id,
      tenantId,
      email: updated.email,
      coupleName: updated.coupleName,
      eventDate: updated.eventDate,
      balanceAmountCents,
    });

    return updated;
  }
}
