/**
 * Public Balance Payment Routes (MVP Gaps Phase 4)
 *
 * Customer-facing endpoint for paying remaining balance after deposit.
 * Uses JWT tokens in query params for authentication (no login required).
 *
 * @see plans/mvp-gaps-phased-implementation.md
 */

import { Router } from 'express';
import type { BookingService } from '../services/booking.service';
import { validateBookingToken } from '../lib/booking-tokens';
import { logger } from '../lib/core/logger';
import { handlePublicRouteError } from '../lib/public-route-error-handler';

/**
 * Public Balance Payment Controller
 *
 * Handles customer-facing balance payment operations:
 * - Create Stripe checkout for balance payment
 */
export class PublicBalancePaymentController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * Create balance payment checkout
   *
   * POST /v1/public/bookings/pay-balance?token=xxx
   */
  async createBalancePaymentCheckout(token: string): Promise<{
    checkoutUrl: string;
    balanceAmountCents: number;
  }> {
    // Validate token (must be 'pay_balance' action)
    const result = validateBookingToken(token, 'pay_balance');
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
