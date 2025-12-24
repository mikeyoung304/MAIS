/**
 * Unit tests for payment_intent.payment_failed webhook handler
 * TODO-266: Missing webhook handler for payment_intent.failed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhooksController } from '../../src/routes/webhooks.routes';
import type { PaymentProvider, WebhookRepository } from '../../src/lib/ports';
import type { BookingService } from '../../src/services/booking.service';
import { createPaymentFailedEvent } from '../fixtures/stripe-events';

describe('WebhooksController - payment_intent.payment_failed', () => {
  let controller: WebhooksController;
  let mockPaymentProvider: PaymentProvider;
  let mockBookingService: BookingService;
  let mockWebhookRepo: WebhookRepository;

  beforeEach(() => {
    // Mock dependencies
    mockPaymentProvider = {
      verifyWebhook: vi.fn(),
    } as any;

    mockBookingService = {
      markPaymentFailed: vi.fn(),
    } as any;

    mockWebhookRepo = {
      isDuplicate: vi.fn().mockResolvedValue(false),
      recordWebhook: vi.fn().mockResolvedValue(true),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
    } as any;

    controller = new WebhooksController(mockPaymentProvider, mockBookingService, mockWebhookRepo);
  });

  it('should handle payment_intent.payment_failed with bookingId', async () => {
    // Arrange
    const event = createPaymentFailedEvent(
      'pi_test_123',
      {
        tenantId: 'tenant_123',
        packageId: 'package_abc',
        eventDate: '2025-06-15',
        email: 'customer@example.com',
        coupleName: 'John & Jane',
      },
      50000,
      'card_declined'
    );

    // Add bookingId to metadata for balance payment scenario
    (event.data.object as any).metadata.bookingId = 'booking_abc';

    const rawBody = JSON.stringify(event);
    const signature = 'test-signature';

    (mockPaymentProvider.verifyWebhook as any).mockResolvedValue(event);

    // Act
    await controller.handleStripeWebhook(rawBody, signature);

    // Assert
    expect(mockBookingService.markPaymentFailed).toHaveBeenCalledWith('tenant_123', 'booking_abc', {
      reason: 'Your card was declined.',
      code: 'card_declined',
      paymentIntentId: 'pi_test_123',
    });
    expect(mockWebhookRepo.markProcessed).toHaveBeenCalled();
  });

  it('should handle payment_intent.payment_failed without bookingId', async () => {
    // Arrange
    const event = createPaymentFailedEvent(
      'pi_test_456',
      {
        tenantId: 'tenant_123',
        packageId: 'package_abc',
        eventDate: '2025-06-15',
        email: 'customer@example.com',
        coupleName: 'John & Jane',
      },
      50000,
      'insufficient_funds'
    );

    const rawBody = JSON.stringify(event);
    const signature = 'test-signature';

    (mockPaymentProvider.verifyWebhook as any).mockResolvedValue(event);

    // Act
    await controller.handleStripeWebhook(rawBody, signature);

    // Assert - should NOT call markPaymentFailed since no bookingId
    expect(mockBookingService.markPaymentFailed).not.toHaveBeenCalled();
    // Should still process the webhook successfully
    expect(mockWebhookRepo.markProcessed).toHaveBeenCalled();
  });

  it('should handle payment_intent.payment_failed with various error codes', async () => {
    const errorCodes = ['card_declined', 'insufficient_funds', 'expired_card', 'processing_error'];

    for (const errorCode of errorCodes) {
      // Reset mocks
      vi.clearAllMocks();

      // Arrange
      const event = createPaymentFailedEvent(
        `pi_test_${errorCode}`,
        {
          tenantId: 'tenant_123',
          packageId: 'package_abc',
          eventDate: '2025-06-15',
          email: 'customer@example.com',
          coupleName: 'John & Jane',
        },
        50000,
        errorCode
      );

      (event.data.object as any).metadata.bookingId = 'booking_abc';

      const rawBody = JSON.stringify(event);
      const signature = 'test-signature';

      (mockPaymentProvider.verifyWebhook as any).mockResolvedValue(event);
      (mockWebhookRepo.isDuplicate as any).mockResolvedValue(false);
      (mockWebhookRepo.recordWebhook as any).mockResolvedValue(true);

      // Act
      await controller.handleStripeWebhook(rawBody, signature);

      // Assert
      expect(mockBookingService.markPaymentFailed).toHaveBeenCalledWith(
        'tenant_123',
        'booking_abc',
        expect.objectContaining({
          code: errorCode,
          paymentIntentId: `pi_test_${errorCode}`,
        })
      );
    }
  });

  it('should not fail webhook if markPaymentFailed throws error', async () => {
    // Arrange
    const event = createPaymentFailedEvent(
      'pi_test_error',
      {
        tenantId: 'tenant_123',
        packageId: 'package_abc',
        eventDate: '2025-06-15',
        email: 'customer@example.com',
        coupleName: 'John & Jane',
      },
      50000,
      'card_declined'
    );

    (event.data.object as any).metadata.bookingId = 'booking_nonexistent';

    const rawBody = JSON.stringify(event);
    const signature = 'test-signature';

    (mockPaymentProvider.verifyWebhook as any).mockResolvedValue(event);
    (mockBookingService.markPaymentFailed as any).mockRejectedValue(new Error('Booking not found'));

    // Act - should not throw
    await controller.handleStripeWebhook(rawBody, signature);

    // Assert - webhook should still be marked as processed
    expect(mockWebhookRepo.markProcessed).toHaveBeenCalled();
  });

  it('should handle missing last_payment_error gracefully', async () => {
    // Arrange
    const event = createPaymentFailedEvent(
      'pi_test_no_error',
      {
        tenantId: 'tenant_123',
        packageId: 'package_abc',
        eventDate: '2025-06-15',
        email: 'customer@example.com',
        coupleName: 'John & Jane',
      },
      50000,
      'unknown'
    );

    // Remove last_payment_error
    delete (event.data.object as any).last_payment_error;
    (event.data.object as any).metadata.bookingId = 'booking_abc';

    const rawBody = JSON.stringify(event);
    const signature = 'test-signature';

    (mockPaymentProvider.verifyWebhook as any).mockResolvedValue(event);

    // Act
    await controller.handleStripeWebhook(rawBody, signature);

    // Assert - should handle missing error gracefully
    expect(mockBookingService.markPaymentFailed).toHaveBeenCalledWith('tenant_123', 'booking_abc', {
      reason: 'Payment failed',
      code: 'unknown',
      paymentIntentId: 'pi_test_no_error',
    });
  });
});
