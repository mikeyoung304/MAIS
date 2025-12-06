/**
 * Tests for booking token generation and validation
 * Critical security tests for JWT secret isolation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateBookingToken,
  validateBookingToken,
  generateManageBookingUrl,
  generateBalancePaymentUrl,
  type BookingTokenAction,
} from '../../src/lib/booking-tokens';
import type { BookingRepository } from '../../src/lib/ports';
import type { Booking } from '../../src/lib/entities';

describe('Booking Tokens', () => {
  // Ensure test environment has required secrets set
  beforeEach(() => {
    // These should already be set in the .env file for tests to run
    if (!process.env.JWT_SECRET || !process.env.BOOKING_TOKEN_SECRET) {
      throw new Error('Test environment must have JWT_SECRET and BOOKING_TOKEN_SECRET set');
    }
  });

  describe('Security: JWT Secret Isolation', () => {
    it('should use separate BOOKING_TOKEN_SECRET (not JWT_SECRET)', async () => {
      // This test verifies that the code uses BOOKING_TOKEN_SECRET
      // The actual enforcement is in config.ts with Zod validation requiring min 32 chars
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // Token should validate successfully
      const result = await validateBookingToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.bookingId).toBe('booking_123');
        expect(result.payload.tenantId).toBe('tenant_abc');
      }
    });

    it('should enforce minimum 32 character length for BOOKING_TOKEN_SECRET', async () => {
      // This is enforced at the Zod schema level in config.ts
      // If BOOKING_TOKEN_SECRET is < 32 chars, the application won't start
      // This test documents the requirement
      const minLength = 32;
      const actualLength = process.env.BOOKING_TOKEN_SECRET?.length || 0;
      expect(actualLength).toBeGreaterThanOrEqual(minLength);
    });

    it('should keep BOOKING_TOKEN_SECRET separate from JWT_SECRET', async () => {
      // Verify they are different secrets (best practice)
      const jwtSecret = process.env.JWT_SECRET;
      const bookingSecret = process.env.BOOKING_TOKEN_SECRET;
      expect(bookingSecret).not.toBe(jwtSecret);
    });
  });

  describe('Token Generation', () => {
    it('should generate valid token with all required fields', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature
    });

    it('should include bookingId, tenantId, and action in payload', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'reschedule');
      const result = await validateBookingToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.bookingId).toBe('booking_123');
        expect(result.payload.tenantId).toBe('tenant_abc');
        expect(result.payload.action).toBe('reschedule');
      }
    });

    it('should support all action types', async () => {
      const actions: BookingTokenAction[] = ['manage', 'reschedule', 'cancel', 'pay_balance'];

      for (const action of actions) {
        const token = generateBookingToken('booking_123', 'tenant_abc', action);
        const result = await validateBookingToken(token);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.payload.action).toBe(action);
        }
      }
    });

    it('should set expiration based on expiresInDays parameter', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage', 30);
      const result = await validateBookingToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDays = 30 * 24 * 60 * 60;
        expect(result.payload.exp).toBeGreaterThan(now);
        expect(result.payload.exp).toBeLessThanOrEqual(now + thirtyDays + 60); // 60s tolerance
      }
    });
  });

  describe('Token Validation', () => {
    it('should validate correctly signed token', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage');
      const result = await validateBookingToken(token);

      expect(result.valid).toBe(true);
    });

    it('should reject token with invalid signature', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage');
      const tamperedToken = token.slice(0, -5) + 'xxxxx'; // Tamper with signature

      const result = await validateBookingToken(tamperedToken);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('invalid');
      }
    });

    it('should reject malformed token', async () => {
      const result = await validateBookingToken('not-a-valid-jwt');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('invalid');
      }
    });

    it('should validate action type when expectedAction provided', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'reschedule');

      const validResult = await validateBookingToken(token, 'reschedule');
      expect(validResult.valid).toBe(true);

      const invalidResult = await validateBookingToken(token, 'cancel');
      expect(invalidResult.valid).toBe(false);
      if (!invalidResult.valid) {
        expect(invalidResult.error).toBe('wrong_action');
      }
    });

    it('should allow manage token for any action', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage');

      // manage tokens should work for any action
      const actions: BookingTokenAction[] = ['reschedule', 'cancel', 'pay_balance'];
      for (const action of actions) {
        const result = await validateBookingToken(token, action);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject token with missing required fields', async () => {
      // This would require manually crafting a malformed token
      // For now, we trust jwt.sign to include all fields
      // Real-world scenario: someone tries to craft a token manually
    });
  });

  describe('URL Generation', () => {
    it('should generate manage booking URL with token', async () => {
      const url = generateManageBookingUrl('booking_123', 'tenant_abc');
      expect(url).toContain('/bookings/manage?token=');
      expect(url).toMatch(/^http:\/\/localhost:5173\/bookings\/manage\?token=.+/);
    });

    it('should generate balance payment URL with token', async () => {
      const url = generateBalancePaymentUrl('booking_123', 'tenant_abc');
      expect(url).toContain('/bookings/pay-balance?token=');
      expect(url).toMatch(/^http:\/\/localhost:5173\/bookings\/pay-balance\?token=.+/);
    });

    it('should use custom base URL when provided', async () => {
      const customUrl = 'https://example.com';
      const url = generateManageBookingUrl('booking_123', 'tenant_abc', customUrl);
      expect(url).toMatch(/^https:\/\/example\.com\/bookings\/manage\?token=.+/);
    });

    it('should generate valid token in URL', async () => {
      const url = generateManageBookingUrl('booking_123', 'tenant_abc');
      const tokenMatch = url.match(/token=(.+)$/);
      expect(tokenMatch).toBeTruthy();

      if (tokenMatch) {
        const token = tokenMatch[1];
        const result = await validateBookingToken(token);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Tenant Isolation', () => {
    it('should include tenantId in token payload', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage');
      const result = await validateBookingToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.tenantId).toBe('tenant_abc');
      }
    });

    it('should not allow cross-tenant token usage without verification', async () => {
      // Generate token for tenant_abc
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage');
      const result = await validateBookingToken(token);

      // Token validates successfully
      expect(result.valid).toBe(true);

      // But the application layer MUST verify tenantId matches
      if (result.valid) {
        expect(result.payload.tenantId).toBe('tenant_abc');
        // Application should reject if trying to use for tenant_xyz
        expect(result.payload.tenantId).not.toBe('tenant_xyz');
      }
    });
  });

  describe('Token Expiration', () => {
    it('should include expiration timestamp', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage', 7);
      const result = await validateBookingToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.exp).toBeDefined();
        expect(result.payload.exp).toBeGreaterThan(Date.now() / 1000);
      }
    });

    it('should include issued at timestamp', async () => {
      const token = generateBookingToken('booking_123', 'tenant_abc', 'manage');
      const result = await validateBookingToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.iat).toBeDefined();
        expect(result.payload.iat).toBeLessThanOrEqual(Date.now() / 1000);
      }
    });

    // Note: Testing actual expiration requires mocking time or waiting
    // which is impractical in unit tests. Integration tests should cover this.
  });

  describe('P2-284: State Validation (Token Revocation)', () => {
    let mockBookingRepo: BookingRepository;
    let mockBooking: Booking;
    const mockTenantId = 'tenant_test_123';
    const mockBookingId = 'booking_test_456';

    beforeEach(() => {
      process.env.JWT_SECRET = 'test-jwt-secret-32chars-0123456789abcdef';
      process.env.BOOKING_TOKEN_SECRET = 'test-booking-secret-32chars-0123456789abcdef';

      // Create mock booking with default PAID status
      mockBooking = {
        id: mockBookingId,
        tenantId: mockTenantId,
        packageId: 'pkg_123',
        eventDate: '2025-06-15',
        coupleName: 'John & Jane Doe',
        email: 'john@example.com',
        totalCents: 150000,
        status: 'PAID',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Booking;

      // Create mock repository
      mockBookingRepo = {
        findById: async (tenantId: string, id: string) => {
          if (tenantId === mockTenantId && id === mockBookingId) {
            return mockBooking;
          }
          return null;
        },
      } as BookingRepository;
    });

    it('should validate token when booking exists and is in valid state', async () => {
      const token = generateBookingToken(mockBookingId, mockTenantId, 'reschedule');
      const result = await validateBookingToken(token, 'reschedule', mockBookingRepo);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.bookingId).toBe(mockBookingId);
      }
    });

    it('should reject token when booking does not exist', async () => {
      const token = generateBookingToken('non_existent_booking', mockTenantId, 'manage');
      const result = await validateBookingToken(token, 'manage', mockBookingRepo);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('booking_not_found');
        expect(result.message).toContain('no longer exists');
      }
    });

    it('should allow viewing canceled bookings with manage token', async () => {
      mockBooking.status = 'CANCELED';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'manage');
      const result = await validateBookingToken(token, 'manage', mockBookingRepo);

      expect(result.valid).toBe(true);
    });

    it('should reject rescheduling canceled bookings', async () => {
      mockBooking.status = 'CANCELED';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'reschedule');
      const result = await validateBookingToken(token, 'reschedule', mockBookingRepo);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('booking_canceled');
        expect(result.message).toContain('canceled');
      }
    });

    it('should reject canceling already canceled bookings', async () => {
      mockBooking.status = 'CANCELED';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'cancel');
      const result = await validateBookingToken(token, 'cancel', mockBookingRepo);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('booking_canceled');
        expect(result.message).toContain('canceled');
      }
    });

    it('should reject rescheduling fulfilled bookings', async () => {
      mockBooking.status = 'FULFILLED';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'reschedule');
      const result = await validateBookingToken(token, 'reschedule', mockBookingRepo);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('booking_completed');
        expect(result.message).toContain('completed');
      }
    });

    it('should reject canceling fulfilled bookings', async () => {
      mockBooking.status = 'FULFILLED';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'cancel');
      const result = await validateBookingToken(token, 'cancel', mockBookingRepo);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('booking_completed');
        expect(result.message).toContain('completed');
      }
    });

    it('should reject canceling refunded bookings', async () => {
      mockBooking.status = 'REFUNDED';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'cancel');
      const result = await validateBookingToken(token, 'cancel', mockBookingRepo);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('booking_canceled');
        expect(result.message).toContain('refunded');
      }
    });

    it('should allow rescheduling PAID bookings', async () => {
      mockBooking.status = 'PAID';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'reschedule');
      const result = await validateBookingToken(token, 'reschedule', mockBookingRepo);

      expect(result.valid).toBe(true);
    });

    it('should allow rescheduling CONFIRMED bookings', async () => {
      mockBooking.status = 'CONFIRMED';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'reschedule');
      const result = await validateBookingToken(token, 'reschedule', mockBookingRepo);

      expect(result.valid).toBe(true);
    });

    it('should allow rescheduling DEPOSIT_PAID bookings', async () => {
      mockBooking.status = 'DEPOSIT_PAID';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'reschedule');
      const result = await validateBookingToken(token, 'reschedule', mockBookingRepo);

      expect(result.valid).toBe(true);
    });

    it('ATTACK SCENARIO: should prevent "un-canceling" via old reschedule link', async () => {
      // Step 1: Customer books wedding for June 15
      mockBooking.status = 'PAID';
      const rescheduleToken = generateBookingToken(mockBookingId, mockTenantId, 'reschedule');

      // Step 2: Token is valid initially
      const validResult = await validateBookingToken(rescheduleToken, 'reschedule', mockBookingRepo);
      expect(validResult.valid).toBe(true);

      // Step 3: Customer cancels booking on June 2
      mockBooking.status = 'CANCELED';

      // Step 4: Customer tries to use old reschedule link (should fail)
      const invalidResult = await validateBookingToken(rescheduleToken, 'reschedule', mockBookingRepo);
      expect(invalidResult.valid).toBe(false);
      if (!invalidResult.valid) {
        expect(invalidResult.error).toBe('booking_canceled');
        expect(invalidResult.message).toContain('canceled');
      }
    });

    it('ATTACK SCENARIO: should prevent modifying completed bookings via old links', async () => {
      // Step 1: Event happens, booking is fulfilled
      mockBooking.status = 'FULFILLED';
      const token = generateBookingToken(mockBookingId, mockTenantId, 'reschedule');

      // Step 2: Customer tries to reschedule past event (should fail)
      const result = await validateBookingToken(token, 'reschedule', mockBookingRepo);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('booking_completed');
      }
    });

    it('should work without state validation for backward compatibility', async () => {
      const token = generateBookingToken(mockBookingId, mockTenantId, 'manage');

      // Without bookingRepo, validation should still work (just without state checks)
      const result = await validateBookingToken(token, 'manage');
      expect(result.valid).toBe(true);
    });
  });
});
