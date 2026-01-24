/**
 * Unit tests for StripePaymentAdapter
 *
 * Tests the Stripe payment adapter implementation including:
 * - Standard checkout session creation
 * - Stripe Connect checkout sessions with application fees
 * - Refund operations (full and partial)
 * - Idempotency key handling
 * - Application fee validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StripePaymentAdapter } from '../../src/adapters/stripe.adapter';
import type Stripe from 'stripe';

// Create mock Stripe instance
const mockStripeInstance = {
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  refunds: {
    create: vi.fn(),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

// Mock Stripe SDK
vi.mock('stripe', () => {
  const MockStripe = vi.fn(() => mockStripeInstance);
  return {
    default: MockStripe,
  };
});

describe('StripePaymentAdapter', () => {
  let adapter: StripePaymentAdapter;
  let mockStripe: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create the adapter (which will use the mocked Stripe)
    adapter = new StripePaymentAdapter({
      secretKey: 'sk_test_fake',
      webhookSecret: 'whsec_test_fake',
    });

    // Use the mock Stripe instance
    mockStripe = mockStripeInstance;
  });

  describe('createCheckoutSession', () => {
    it('creates standard session with correct parameters', async () => {
      // Arrange
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test-session',
      };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      // Act
      const result = await adapter.createCheckoutSession({
        amountCents: 150000,
        email: 'customer@example.com',
        metadata: {
          tenantId: 'tenant_123',
          packageId: 'pkg_intimate',
        },
        successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://example.com/cancel',
      });

      // Assert
      expect(result).toEqual({
        url: 'https://checkout.stripe.com/test-session',
        sessionId: 'cs_test_123',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        {
          mode: 'payment',
          payment_method_types: ['card'],
          customer_email: 'customer@example.com',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                unit_amount: 150000,
                product_data: {
                  name: 'Wedding Package',
                  description: 'Elopement/Micro-Wedding Package',
                },
              },
              quantity: 1,
            },
          ],
          success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'https://example.com/cancel',
          metadata: {
            tenantId: 'tenant_123',
            packageId: 'pkg_intimate',
          },
        },
        {}
      );
    });

    it('includes idempotency key when provided', async () => {
      // Arrange
      const mockSession = {
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/test-session-2',
      };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      // Act
      await adapter.createCheckoutSession({
        amountCents: 100000,
        email: 'customer@example.com',
        metadata: { tenantId: 'tenant_123' },
        idempotencyKey: 'idem_checkout_unique_123',
        successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://example.com/cancel',
      });

      // Assert - verify idempotency key is passed in options
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(expect.any(Object), {
        idempotencyKey: 'idem_checkout_unique_123',
      });
    });
  });

  describe('createConnectCheckoutSession', () => {
    it('creates Connect session with application fee', async () => {
      // Arrange
      const mockSession = {
        id: 'cs_connect_123',
        url: 'https://checkout.stripe.com/connect-session',
      };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      // Act
      const result = await adapter.createConnectCheckoutSession({
        amountCents: 200000,
        email: 'customer@example.com',
        metadata: {
          tenantId: 'tenant_123',
          packageId: 'pkg_deluxe',
        },
        stripeAccountId: 'acct_connected_123',
        applicationFeeAmount: 24000, // 12% fee
        successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://example.com/cancel',
      });

      // Assert
      expect(result).toEqual({
        url: 'https://checkout.stripe.com/connect-session',
        sessionId: 'cs_connect_123',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          payment_method_types: ['card'],
          customer_email: 'customer@example.com',
          payment_intent_data: {
            application_fee_amount: 24000,
            transfer_data: {
              destination: 'acct_connected_123',
            },
          },
        }),
        {}
      );
    });

    it('validates fee minimum (0.5%)', async () => {
      // Arrange
      const amountCents = 100000; // $1000
      const tooLowFee = 400; // 0.4% - below minimum

      // Act & Assert
      await expect(
        adapter.createConnectCheckoutSession({
          amountCents,
          email: 'customer@example.com',
          metadata: { tenantId: 'tenant_123' },
          stripeAccountId: 'acct_connected_123',
          applicationFeeAmount: tooLowFee,
          successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow(/Application fee.*below Stripe minimum.*0.5%/);

      // Verify Stripe was not called
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('validates fee maximum (50%)', async () => {
      // Arrange
      const amountCents = 100000; // $1000
      const tooHighFee = 55000; // 55% - above maximum

      // Act & Assert
      await expect(
        adapter.createConnectCheckoutSession({
          amountCents,
          email: 'customer@example.com',
          metadata: { tenantId: 'tenant_123' },
          stripeAccountId: 'acct_connected_123',
          applicationFeeAmount: tooHighFee,
          successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow(/Application fee.*exceeds Stripe maximum.*50%/);

      // Verify Stripe was not called
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('accepts valid fee within range (0.5% - 50%)', async () => {
      // Arrange
      const mockSession = {
        id: 'cs_valid_fee',
        url: 'https://checkout.stripe.com/valid-fee-session',
      };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const amountCents = 100000; // $1000
      const validFee = 12000; // 12% - well within range

      // Act
      const result = await adapter.createConnectCheckoutSession({
        amountCents,
        email: 'customer@example.com',
        metadata: { tenantId: 'tenant_123' },
        stripeAccountId: 'acct_connected_123',
        applicationFeeAmount: validFee,
        successUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://example.com/cancel',
      });

      // Assert
      expect(result.sessionId).toBe('cs_valid_fee');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent_data: {
            application_fee_amount: 12000,
            transfer_data: {
              destination: 'acct_connected_123',
            },
          },
        }),
        {}
      );
    });
  });

  describe('refund', () => {
    it('creates full refund when amount not specified', async () => {
      // Arrange
      const mockRefund = {
        id: 're_full_123',
        status: 'succeeded',
        amount: 150000,
      };
      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      // Act
      const result = await adapter.refund({
        paymentIntentId: 'pi_test_123',
      });

      // Assert
      expect(result).toEqual({
        refundId: 're_full_123',
        status: 'succeeded',
        amountCents: 150000,
      });

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        {
          payment_intent: 'pi_test_123',
          amount: undefined, // Full refund - no amount specified
          reason: undefined,
        },
        {}
      );
    });

    it('creates partial refund with reason', async () => {
      // Arrange
      const mockRefund = {
        id: 're_partial_456',
        status: 'pending',
        amount: 50000,
      };
      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      // Act
      const result = await adapter.refund({
        paymentIntentId: 'pi_test_456',
        amountCents: 50000,
        reason: 'requested_by_customer',
        idempotencyKey: 'idem_refund_unique_789',
      });

      // Assert
      expect(result).toEqual({
        refundId: 're_partial_456',
        status: 'pending',
        amountCents: 50000,
      });

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        {
          payment_intent: 'pi_test_456',
          amount: 50000,
          reason: 'requested_by_customer',
        },
        { idempotencyKey: 'idem_refund_unique_789' }
      );
    });
  });
});
