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
 * @param expiresInDays - Token validity period (default: 7 days)
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
  expiresInDays: number = 7
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
  error: 'expired' | 'invalid' | 'wrong_action' | 'malformed';
  message: string;
}

export type ValidateTokenResult = TokenValidationResult | TokenValidationError;

/**
 * Validates a booking management token
 *
 * Verification includes:
 * - JWT signature verification
 * - Expiration check
 * - Optional action type validation
 *
 * NOTE: This does NOT verify booking status. Caller must check if booking
 * is still valid (not already cancelled, etc.) after token validation.
 *
 * @param token - The JWT token to validate
 * @param expectedAction - Optional: Require specific action type
 * @returns Validation result with payload or error
 *
 * @example
 * ```typescript
 * const result = validateBookingToken(token, 'cancel');
 * if (result.valid) {
 *   // result.payload.bookingId, result.payload.tenantId available
 * } else {
 *   // result.error, result.message describe the failure
 * }
 * ```
 */
export function validateBookingToken(
  token: string,
  expectedAction?: BookingTokenAction
): ValidateTokenResult {
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

    return { valid: true, payload };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        error: 'expired',
        message: 'Token has expired',
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        error: 'invalid',
        message: 'Invalid token signature',
      };
    }

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
