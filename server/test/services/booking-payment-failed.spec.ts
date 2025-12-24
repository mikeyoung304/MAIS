/**
 * Unit tests for BookingService.markPaymentFailed
 * TODO-266: Missing webhook handler for payment_intent.failed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingService } from '../../src/services/booking.service';
import type { BookingRepository, CatalogRepository, PaymentProvider } from '../../src/lib/ports';
import type { EventEmitter } from '../../src/lib/core/events';
import { BookingEvents } from '../../src/lib/core/events';
import { NotFoundError } from '../../src/lib/errors';
import type { Booking } from '../../src/lib/entities';

describe('BookingService.markPaymentFailed', () => {
  let bookingService: BookingService;
  let mockBookingRepo: BookingRepository;
  let mockCatalogRepo: CatalogRepository;
  let mockEventEmitter: EventEmitter;
  let mockPaymentProvider: PaymentProvider;

  beforeEach(() => {
    mockBookingRepo = {
      findById: vi.fn(),
      update: vi.fn(),
    } as any;

    mockCatalogRepo = {} as any;

    mockEventEmitter = {
      emit: vi.fn(),
    } as any;

    mockPaymentProvider = {} as any;

    bookingService = new BookingService({
      bookingRepo: mockBookingRepo,
      catalogRepo: mockCatalogRepo,
      eventEmitter: mockEventEmitter,
      paymentProvider: mockPaymentProvider,
      commissionService: {} as any,
      tenantRepo: {} as any,
      idempotencyService: {} as any,
    });
  });

  it('should mark payment as failed and emit event', async () => {
    // Arrange
    const mockBooking: Booking = {
      id: 'booking_123',
      tenantId: 'tenant_123',
      customerId: 'customer_123',
      packageId: 'package_123',
      venueId: null,
      coupleName: 'John & Jane',
      email: 'customer@example.com',
      phone: null,
      eventDate: '2025-06-15',
      addOnIds: [],
      totalCents: 50000,
      status: 'DEPOSIT_PAID',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockBookingRepo.findById as any).mockResolvedValue(mockBooking);

    const failureDetails = {
      reason: 'Your card was declined',
      code: 'card_declined',
      paymentIntentId: 'pi_test_123',
    };

    // Act
    const result = await bookingService.markPaymentFailed(
      'tenant_123',
      'booking_123',
      failureDetails
    );

    // Assert
    expect(result).toEqual(mockBooking);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(BookingEvents.PAYMENT_FAILED, {
      bookingId: 'booking_123',
      tenantId: 'tenant_123',
      email: 'customer@example.com',
      coupleName: 'John & Jane',
      eventDate: '2025-06-15',
      failureReason: 'Your card was declined',
      failureCode: 'card_declined',
      paymentIntentId: 'pi_test_123',
    });
  });

  it('should throw NotFoundError if booking does not exist', async () => {
    // Arrange
    (mockBookingRepo.findById as any).mockResolvedValue(null);

    const failureDetails = {
      reason: 'Your card was declined',
      code: 'card_declined',
      paymentIntentId: 'pi_test_123',
    };

    // Act & Assert
    await expect(
      bookingService.markPaymentFailed('tenant_123', 'nonexistent_booking', failureDetails)
    ).rejects.toThrow(NotFoundError);
    await expect(
      bookingService.markPaymentFailed('tenant_123', 'nonexistent_booking', failureDetails)
    ).rejects.toThrow('Booking nonexistent_booking not found');
  });

  it('should handle various payment error codes', async () => {
    const mockBooking: Booking = {
      id: 'booking_123',
      tenantId: 'tenant_123',
      customerId: 'customer_123',
      packageId: 'package_123',
      venueId: null,
      coupleName: 'John & Jane',
      email: 'customer@example.com',
      phone: null,
      eventDate: '2025-06-15',
      addOnIds: [],
      totalCents: 50000,
      status: 'DEPOSIT_PAID',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockBookingRepo.findById as any).mockResolvedValue(mockBooking);

    const errorCodes = [
      { code: 'card_declined', reason: 'Your card was declined' },
      { code: 'insufficient_funds', reason: 'Your card has insufficient funds' },
      { code: 'expired_card', reason: 'Your card has expired' },
      { code: 'processing_error', reason: 'An error occurred processing your payment' },
    ];

    for (const errorCode of errorCodes) {
      // Reset mocks
      vi.clearAllMocks();
      (mockBookingRepo.findById as any).mockResolvedValue(mockBooking);

      const failureDetails = {
        reason: errorCode.reason,
        code: errorCode.code,
        paymentIntentId: `pi_test_${errorCode.code}`,
      };

      // Act
      await bookingService.markPaymentFailed('tenant_123', 'booking_123', failureDetails);

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BookingEvents.PAYMENT_FAILED,
        expect.objectContaining({
          failureCode: errorCode.code,
          failureReason: errorCode.reason,
        })
      );
    }
  });

  it('should not modify booking status for payment failures', async () => {
    // Arrange - booking is DEPOSIT_PAID
    const mockBooking: Booking = {
      id: 'booking_123',
      tenantId: 'tenant_123',
      customerId: 'customer_123',
      packageId: 'package_123',
      venueId: null,
      coupleName: 'John & Jane',
      email: 'customer@example.com',
      phone: null,
      eventDate: '2025-06-15',
      addOnIds: [],
      totalCents: 50000,
      status: 'DEPOSIT_PAID', // Balance payment is due
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockBookingRepo.findById as any).mockResolvedValue(mockBooking);

    const failureDetails = {
      reason: 'Your card was declined',
      code: 'card_declined',
      paymentIntentId: 'pi_test_123',
    };

    // Act
    const result = await bookingService.markPaymentFailed(
      'tenant_123',
      'booking_123',
      failureDetails
    );

    // Assert - status should remain DEPOSIT_PAID
    expect(result.status).toBe('DEPOSIT_PAID');
    // Should NOT call update on the repository
    expect(mockBookingRepo.update).not.toHaveBeenCalled();
  });
});
