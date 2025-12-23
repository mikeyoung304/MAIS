/**
 * Public Balance Payment Routes (MVP Gaps Phase 4)
 *
 * Customer-facing endpoint for paying remaining balance after deposit.
 * Uses JWT tokens in query params for authentication (no login required).
 *
 * P2-284 FIX: Added booking state validation to prevent business logic bypass.
 * Tokens are now validated against the actual booking state to ensure:
 * - Only DEPOSIT_PAID bookings can have balance paid
 * - Canceled/fulfilled/refunded bookings reject payment attempts
 *
 * @see plans/mvp-gaps-phased-implementation.md
 */

import { Router } from 'express';
import type { BookingService } from '../services/booking.service';
import type { BookingRepository } from '../lib/ports';
import { validateBookingToken } from '../lib/booking-tokens';
import { logger } from '../lib/core/logger';
import { handlePublicRouteError } from '../lib/public-route-error-handler';

/**
 * Public Balance Payment Controller
 *
 * Handles customer-facing balance payment operations:
 * - Create Stripe checkout for balance payment
 *
 * P2-284: Requires BookingRepository for token state validation
 */
export class PublicBalancePaymentController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly bookingRepo: BookingRepository
  ) {}

  /**
   * Create balance payment checkout
   *
   * POST /v1/public/bookings/pay-balance?token=xxx
   *
   * P2-284: Now validates booking state before allowing checkout creation.
   * Only DEPOSIT_PAID bookings can proceed with balance payment.
   */
  async createBalancePaymentCheckout(token: string): Promise<{
    checkoutUrl: string;
    balanceAmountCents: number;
  }> {
    // P2-284 FIX: Validate token WITH state validation
    // This prevents:
    // - Paying balance on canceled bookings
    // - Paying balance on already-paid bookings
    // - Paying balance on fulfilled/refunded bookings
    const result = await validateBookingToken(token, 'pay_balance', this.bookingRepo);
    if (!result.valid) {
      throw new Error(`Token validation failed: ${result.message}`);
    }

    const { tenantId, bookingId } = result.payload;

    // Create balance payment checkout
    const checkout = await this.bookingService.createBalancePaymentCheckout(tenantId, bookingId);

    logger.info(
      { tenantId, bookingId, balanceAmountCents: checkout.balanceAmountCents },
      'Balance payment checkout created via public API'
    );

    return checkout;
  }
}

/**
 * Create Express router for public balance payment
 */
export function createPublicBalancePaymentRouter(
  controller: PublicBalancePaymentController
): Router {
  const router = Router();

  /**
   * POST /v1/public/bookings/pay-balance
   * Create Stripe checkout for balance payment
   */
  router.post('/pay-balance', async (req, res) => {
    try {
      const token = req.query.token as string;

      if (!token) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'Token is required',
        });
      }

      const result = await controller.createBalancePaymentCheckout(token);

      return res.status(200).json(result);
    } catch (error: any) {
      return handlePublicRouteError(error, res, 'create balance payment checkout');
    }
  });

  return router;
}
