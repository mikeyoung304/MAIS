/**
 * JWT-based booking management tokens
 *
 * Provides secure, stateless tokens for customer self-service actions
 * (reschedule, cancel, pay balance) without requiring authentication.
 *
 * ADR Decision: JWT signed URLs chosen over database tokens for MVP
 * - Zero new database tables
 * - Stateless validation (no DB hit)
 * - Reuses existing JWT infrastructure
 * - Already has expiry built-in
 *
 * @see plans/mvp-gaps-phased-implementation.md - ADR: JWT vs Database Tokens
 */

import jwt from 'jsonwebtoken';
import { loadConfig, getBookingTokenSecret } from './core/config';
import { logger } from './core/logger';
import type { BookingRepository } from './ports';

/**
 * Booking token actions
 * - manage: General access to booking management page
 * - reschedule: Permission to change booking date
 * - cancel: Permission to cancel booking
 * - pay_balance: Permission to pay remaining balance
 */
export type BookingTokenAction = 'manage' | 'reschedule' | 'cancel' | 'pay_balance';

/**
 * Payload structure for booking management tokens
 */
export interface BookingTokenPayload {
  bookingId: string;
  tenantId: string;
  action: BookingTokenAction;
  iat: number; // Issued at
  exp: number; // Expiration
}

/**
 * Generates a JWT token for booking management actions
 *
 * Token includes:
 * - bookingId: Which booking this token grants access to
 * - tenantId: Tenant isolation (prevents cross-tenant access)
 * - action: What actions are permitted (manage/reschedule/cancel/pay_balance)
 * - expiry: Auto-expires after specified days
 *
 * @param bookingId - The booking ID this token grants access to
 * @param tenantId - The tenant ID for isolation
 * @param action - The permitted action(s)
 * @param expiresInDays - Token validity period (default: 2 days, reduced from 7 for security)
 * @returns Signed JWT token string
 *
 * @example
 * ```typescript
 * const token = generateBookingToken('booking_123', 'tenant_abc', 'manage');
 * // Returns: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * ```
 */
export function generateBookingToken(
  bookingId: string,
  tenantId: string,
  action: BookingTokenAction,
  expiresInDays: number = 2
): string {
  const config = loadConfig();

  const token = jwt.sign(
    { bookingId, tenantId, action },
    getBookingTokenSecret(config), // Use dedicated secret with fallback to JWT_SECRET
    { expiresIn: `${expiresInDays}d` }
  );

  logger.debug(
    { bookingId, tenantId, action, expiresInDays },
    'Generated booking management token'
  );

  return token;
}

/**
 * Result of token validation
 */
export interface TokenValidationResult {
  valid: true;
  payload: BookingTokenPayload;
}

export interface TokenValidationError {
  valid: false;
  error:
    | 'expired'
    | 'invalid'
    | 'wrong_action'
    | 'malformed'
    | 'booking_not_found'
    | 'booking_canceled'
    | 'booking_completed';
  message: string;
}

export type ValidateTokenResult = TokenValidationResult | TokenValidationError;

/**
 * Validates a booking management token with optional state validation
 *
 * Verification includes:
 * - JWT signature verification
 * - Expiration check
 * - Optional action type validation
 * - Optional booking state validation (prevents business logic bypass)
 *
 * State validation (when bookingRepo provided):
 * - Blocks operations on non-existent bookings
 * - Blocks modifications on CANCELED bookings (except 'manage' for viewing)
 * - Blocks reschedule on FULFILLED bookings
 * - Validates against real-time booking state
 *
 * @param token - The JWT token to validate
 * @param expectedAction - Optional: Require specific action type
 * @param bookingRepo - Optional: Repository for state validation (recommended for security)
 * @returns Validation result with payload or error
 *
 * @example
 * ```typescript
 * // Without state validation (backward compatible)
 * const result = validateBookingToken(token, 'cancel');
 *
 * // With state validation (recommended)
 * const result = await validateBookingToken(token, 'cancel', bookingRepo);
 * if (result.valid) {
 *   // Token is valid AND booking is in valid state
 * } else if (result.error === 'booking_canceled') {
 *   // Booking was canceled, link is no longer valid
 * }
 * ```
 */
export async function validateBookingToken(
  token: string,
  expectedAction?: BookingTokenAction,
  bookingRepo?: BookingRepository
): Promise<ValidateTokenResult> {
  const config = loadConfig();

  try {
    const payload = jwt.verify(token, getBookingTokenSecret(config)) as BookingTokenPayload;

    // Validate payload structure
    if (!payload.bookingId || !payload.tenantId || !payload.action) {
      return {
        valid: false,
        error: 'malformed',
        message: 'Token is missing required fields',
      };
    }

    // Validate action type if specified
    if (expectedAction && payload.action !== expectedAction) {
      // 'manage' tokens can be used for any action (they're general-purpose)
      if (payload.action !== 'manage') {
        return {
          valid: false,
          error: 'wrong_action',
          message: `Invalid token action: expected ${expectedAction}, got ${payload.action}`,
        };
      }
    }

    // State validation (defense against business logic bypass)
    if (bookingRepo) {
      const booking = await bookingRepo.findById(payload.tenantId, payload.bookingId);

      // Booking must exist
      if (!booking) {
        logger.warn(
          { bookingId: payload.bookingId, tenantId: payload.tenantId },
          'Token validation failed: booking not found'
        );
        return {
          valid: false,
          error: 'booking_not_found',
          message: 'This booking no longer exists',
        };
      }

      // Block modifications on canceled bookings (view-only access allowed)
      if (booking.status === 'CANCELED') {
        // Allow 'manage' action for viewing canceled bookings
        if (payload.action !== 'manage') {
          logger.info(
            { bookingId: booking.id, action: payload.action, status: booking.status },
            'Token validation failed: cannot modify canceled booking'
          );
          return {
            valid: false,
            error: 'booking_canceled',
            message: 'This booking has been canceled and cannot be modified',
          };
        }
      }

      // Block reschedule on fulfilled bookings (event already happened)
      if (booking.status === 'FULFILLED' && payload.action === 'reschedule') {
        logger.info(
          { bookingId: booking.id, action: payload.action, status: booking.status },
          'Token validation failed: cannot reschedule completed booking'
        );
        return {
          valid: false,
          error: 'booking_completed',
          message: 'This booking has been completed and cannot be rescheduled',
        };
      }

      // Block cancel on fulfilled bookings (event already happened)
      if (booking.status === 'FULFILLED' && payload.action === 'cancel') {
        logger.info(
          { bookingId: booking.id, action: payload.action, status: booking.status },
          'Token validation failed: cannot cancel completed booking'
        );
        return {
          valid: false,
          error: 'booking_completed',
          message: 'This booking has been completed and cannot be canceled',
        };
      }

      // Block cancel on refunded bookings (already processed)
      if (booking.status === 'REFUNDED' && payload.action === 'cancel') {
        logger.info(
          { bookingId: booking.id, action: payload.action, status: booking.status },
          'Token validation failed: cannot cancel refunded booking'
        );
        return {
          valid: false,
          error: 'booking_canceled',
          message: 'This booking has already been refunded',
        };
      }

      // Block pay_balance on invalid statuses
      if (payload.action === 'pay_balance') {
        // Only DEPOSIT_PAID bookings can have balance paid
        if (booking.status !== 'DEPOSIT_PAID') {
          // Different messages based on status
          if (booking.status === 'PAID' || booking.status === 'CONFIRMED') {
            logger.info(
              { bookingId: booking.id, action: payload.action, status: booking.status },
              'Token validation failed: balance already paid'
            );
            return {
              valid: false,
              error: 'booking_completed',
              message: 'The balance for this booking has already been paid',
            };
          }

          if (booking.status === 'CANCELED') {
            logger.info(
              { bookingId: booking.id, action: payload.action, status: booking.status },
              'Token validation failed: cannot pay balance on canceled booking'
            );
            return {
              valid: false,
              error: 'booking_canceled',
              message: 'This booking has been canceled and cannot accept payments',
            };
          }

          if (booking.status === 'FULFILLED') {
            logger.info(
              { bookingId: booking.id, action: payload.action, status: booking.status },
              'Token validation failed: cannot pay balance on completed booking'
            );
            return {
              valid: false,
              error: 'booking_completed',
              message: 'This booking has been completed',
            };
          }

          if (booking.status === 'REFUNDED') {
            logger.info(
              { bookingId: booking.id, action: payload.action, status: booking.status },
              'Token validation failed: cannot pay balance on refunded booking'
            );
            return {
              valid: false,
              error: 'booking_canceled',
              message: 'This booking has been refunded',
            };
          }

          if (booking.status === 'PENDING') {
            logger.info(
              { bookingId: booking.id, action: payload.action, status: booking.status },
              'Token validation failed: no deposit paid yet'
            );
            return {
              valid: false,
              error: 'invalid',
              message: 'No deposit has been paid for this booking yet',
            };
          }
        }
      }

      logger.debug(
        { bookingId: booking.id, action: payload.action, status: booking.status },
        'Token validated with booking state check'
      );
    }

    return { valid: true, payload };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        error: 'expired',
        message: 'This link has expired. Please contact us for assistance.',
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        error: 'invalid',
        message: 'Invalid token signature',
      };
    }

    logger.error({ error }, 'Token validation failed with unexpected error');
    return {
      valid: false,
      error: 'invalid',
      message: 'Token validation failed',
    };
  }
}

/**
 * Generates a complete manage booking URL with embedded token
 *
 * Use this in confirmation emails to give customers self-service access
 * to reschedule or cancel their bookings.
 *
 * @param bookingId - The booking ID
 * @param tenantId - The tenant ID
 * @param baseUrl - Client application base URL
 * @returns Full URL with token query parameter
 *
 * @example
 * ```typescript
 * const url = generateManageBookingUrl('booking_123', 'tenant_abc');
 * // Returns: http://localhost:5173/bookings/manage?token=eyJhbGc...
 * ```
 */
export function generateManageBookingUrl(
  bookingId: string,
  tenantId: string,
  baseUrl: string = process.env.CLIENT_URL || 'http://localhost:5173'
): string {
  const token = generateBookingToken(bookingId, tenantId, 'manage');
  return `${baseUrl}/bookings/manage?token=${token}`;
}

/**
 * Generates a URL for balance payment
 *
 * Used when deposit-only payment was made and customer needs to pay remaining balance.
 *
 * @param bookingId - The booking ID
 * @param tenantId - The tenant ID
 * @param baseUrl - Client application base URL
 * @returns Full URL with pay_balance token
 *
 * @example
 * ```typescript
 * const url = generateBalancePaymentUrl('booking_123', 'tenant_abc');
 * // Returns: http://localhost:5173/bookings/pay-balance?token=eyJhbGc...
 * ```
 */
export function generateBalancePaymentUrl(
  bookingId: string,
  tenantId: string,
  baseUrl: string = process.env.CLIENT_URL || 'http://localhost:5173'
): string {
  const token = generateBookingToken(bookingId, tenantId, 'pay_balance');
  return `${baseUrl}/bookings/pay-balance?token=${token}`;
}
