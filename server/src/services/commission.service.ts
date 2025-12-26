import type { PrismaClient } from '../generated/prisma';
import { logger } from '../lib/core/logger';

/**
 * Service for calculating platform commission on bookings
 *
 * KEY INSIGHT FROM RESEARCH:
 * Stripe Connect does NOT support `application_fee_percent` parameter.
 * All commission amounts must be calculated server-side as fixed cent values.
 *
 * ARCHITECTURE:
 * - Each tenant has a `commissionPercent` field (e.g., 10.5, 12.0, 15.0)
 * - Commission is calculated at booking creation time
 * - Both amount (cents) and percent are stored in Booking record
 * - Commission amount is passed to Stripe as `application_fee_amount`
 *
 * ROUNDING STRATEGY:
 * - Always round UP to protect platform revenue
 * - Example: 10.5% of $100.00 = $10.50 (1050 cents) ✓
 * - Example: 10.5% of $99.99 = $10.4990 → $10.50 (1050 cents) ✓
 *
 * VALIDATION:
 * - Stripe Connect requires commission between 0.5% and 50%
 * - We enforce this limit to prevent invalid Stripe API calls
 *
 * @example
 * const result = await commissionService.calculateCommission('tenant_123', 50000);
 * // Returns: { amount: 6000, percent: 12.0 }
 * // $500.00 booking → $60.00 commission (12%)
 */
export class CommissionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Calculate commission for a booking
   *
   * @param tenantId - Tenant making the booking
   * @param bookingTotal - Total booking amount in cents (package + add-ons)
   * @returns Commission amount (cents) and percent (decimal)
   * @throws Error if tenant not found or commission rate invalid
   *
   * @example
   * const result = await calculateCommission('tenant_abc', 50000);
   * // Tenant has 12% commission rate
   * // Returns: { amount: 6000, percent: 12.0 }
   */
  async calculateCommission(tenantId: string, bookingTotal: number): Promise<CommissionResult> {
    // Validate input
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Invalid tenantId');
    }

    if (!bookingTotal || bookingTotal < 0) {
      throw new Error('Booking total must be positive');
    }

    // Fetch tenant commission rate
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { commissionPercent: true, slug: true },
    });

    if (!tenant) {
      logger.error({ tenantId }, 'Tenant not found for commission calculation');
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const commissionPercent = Number(tenant.commissionPercent);

    // Validate commission percent
    if (commissionPercent < 0 || commissionPercent > 100) {
      logger.error({ tenantId, commissionPercent }, 'Invalid commission percent');
      throw new Error(
        `Invalid commission percent: ${commissionPercent}%. Must be between 0 and 100.`
      );
    }

    // Calculate commission (always round UP to protect platform revenue)
    const commissionCents = Math.ceil(bookingTotal * (commissionPercent / 100));

    // Validate Stripe Connect limits (0.5% - 50%)
    const minCommission = Math.ceil(bookingTotal * 0.005); // 0.5%
    const maxCommission = Math.ceil(bookingTotal * 0.5); // 50%

    let finalCommission = commissionCents;

    // Enforce Stripe limits
    if (commissionCents < minCommission) {
      logger.warn(
        {
          tenantId,
          tenantSlug: tenant.slug,
          commissionPercent,
          bookingTotal,
          calculatedCommission: commissionCents,
          minCommission,
        },
        'Commission below Stripe minimum (0.5%), adjusting to minimum'
      );
      finalCommission = minCommission;
    } else if (commissionCents > maxCommission) {
      logger.warn(
        {
          tenantId,
          tenantSlug: tenant.slug,
          commissionPercent,
          bookingTotal,
          calculatedCommission: commissionCents,
          maxCommission,
        },
        'Commission above Stripe maximum (50%), adjusting to maximum'
      );
      finalCommission = maxCommission;
    }

    logger.debug(
      {
        tenantId,
        tenantSlug: tenant.slug,
        commissionPercent,
        bookingTotal,
        commissionCents: finalCommission,
        platformRevenue: finalCommission,
        tenantRevenue: bookingTotal - finalCommission,
      },
      'Commission calculated'
    );

    return {
      amount: finalCommission,
      percent: commissionPercent,
    };
  }

  /**
   * Calculate commission for booking with add-ons
   * Handles package price + add-on prices + commission calculation
   *
   * @param tenantId - Tenant making the booking
   * @param packagePrice - Base package price in cents
   * @param addOnIds - Array of selected add-on IDs
   * @returns Full breakdown with commission
   * @throws Error if package or add-ons not found, or tenant mismatch
   *
   * @example
   * const breakdown = await calculateBookingTotal(
   *   'tenant_abc',
   *   50000,  // $500 package
   *   ['addon_1', 'addon_2']
   * );
   * // Returns:
   * // {
   * //   packagePrice: 50000,
   * //   addOnsTotal: 10000,
   * //   subtotal: 60000,
   * //   commissionAmount: 7200,
   * //   commissionPercent: 12.0,
   * //   tenantReceives: 52800
   * // }
   */
  async calculateBookingTotal(
    tenantId: string,
    packagePrice: number,
    addOnIds: string[]
  ): Promise<BookingCalculation> {
    // Calculate add-ons total
    let addOnsTotal = 0;

    if (addOnIds && addOnIds.length > 0) {
      const addOns = await this.prisma.addOn.findMany({
        where: {
          tenantId, // CRITICAL: Prevent cross-tenant add-on access
          id: { in: addOnIds },
          active: true,
        },
        select: { id: true, price: true },
      });

      // Validate all add-ons found
      if (addOns.length !== addOnIds.length) {
        const foundIds = addOns.map((a) => a.id);
        const missingIds = addOnIds.filter((id) => !foundIds.includes(id));
        logger.error(
          { tenantId, requestedIds: addOnIds, foundIds, missingIds },
          'Invalid add-ons requested'
        );
        throw new Error(`Invalid or inactive add-ons: ${missingIds.join(', ')}`);
      }

      addOnsTotal = addOns.reduce((sum, addOn) => sum + addOn.price, 0);

      logger.debug({ tenantId, addOnCount: addOns.length, addOnsTotal }, 'Add-ons calculated');
    }

    // Calculate subtotal
    const subtotal = packagePrice + addOnsTotal;

    // Calculate commission
    const commission = await this.calculateCommission(tenantId, subtotal);

    return {
      packagePrice,
      addOnsTotal,
      subtotal,
      commissionAmount: commission.amount,
      commissionPercent: commission.percent,
      tenantReceives: subtotal - commission.amount,
    };
  }

  /**
   * Calculate commission refund for partial or full refund
   *
   * STRIPE BEHAVIOR:
   * When refunding via Connected Account API, application fees are
   * automatically reversed proportionally.
   *
   * This method is for record-keeping and validation only.
   *
   * @param originalCommission - Original commission in cents
   * @param refundAmount - Refund amount in cents
   * @param originalTotal - Original booking total in cents
   * @returns Commission amount to be refunded (cents)
   *
   * @example
   * // Full refund: $500 booking, $60 commission
   * calculateRefundCommission(6000, 50000, 50000)
   * // Returns: 6000 (full commission reversed)
   *
   * // Partial refund: $500 booking, $60 commission, refund $250
   * calculateRefundCommission(6000, 25000, 50000)
   * // Returns: 3000 (50% commission reversed)
   */
  calculateRefundCommission(
    originalCommission: number,
    refundAmount: number,
    originalTotal: number
  ): number {
    if (refundAmount <= 0 || originalTotal <= 0) {
      return 0;
    }

    // Full refund
    if (refundAmount >= originalTotal) {
      return originalCommission;
    }

    // Partial refund: proportional commission refund
    const refundRatio = refundAmount / originalTotal;
    const commissionRefund = Math.ceil(originalCommission * refundRatio);

    logger.debug(
      {
        originalCommission,
        refundAmount,
        originalTotal,
        refundRatio,
        commissionRefund,
      },
      'Commission refund calculated'
    );

    return commissionRefund;
  }

  /**
   * Get tenant commission rate (for display/preview purposes)
   *
   * @param tenantId - Tenant ID
   * @returns Commission percent as decimal (e.g., 12.5)
   */
  async getTenantCommissionRate(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { commissionPercent: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    return Number(tenant.commissionPercent);
  }

  /**
   * Preview commission for a given amount (without creating booking)
   * Useful for displaying estimated fees to users
   *
   * @param tenantId - Tenant ID
   * @param amount - Amount in cents
   * @returns Commission breakdown
   *
   * @example
   * const preview = await previewCommission('tenant_abc', 50000);
   * // Display: "Platform fee: $60.00 (12%)"
   */
  async previewCommission(
    tenantId: string,
    amount: number
  ): Promise<{
    amount: number;
    percent: number;
    platformFee: number;
    tenantReceives: number;
  }> {
    const commission = await this.calculateCommission(tenantId, amount);

    return {
      amount,
      percent: commission.percent,
      platformFee: commission.amount,
      tenantReceives: amount - commission.amount,
    };
  }
}

/**
 * Commission calculation result
 */
export interface CommissionResult {
  /** Commission amount in cents */
  amount: number;
  /** Commission percentage as decimal (e.g., 12.5) */
  percent: number;
}

/**
 * Full booking calculation breakdown
 */
export interface BookingCalculation {
  /** Package price in cents */
  packagePrice: number;
  /** Total add-ons price in cents */
  addOnsTotal: number;
  /** Subtotal (package + add-ons) in cents */
  subtotal: number;
  /** Platform commission in cents */
  commissionAmount: number;
  /** Commission percentage (e.g., 12.0) */
  commissionPercent: number;
  /** Amount tenant receives after commission (cents) */
  tenantReceives: number;
}
