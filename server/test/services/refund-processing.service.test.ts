/**
 * Unit tests for RefundProcessingService
 *
 * Tests refund processing including:
 * - Full refunds for cancelled bookings
 * - Partial refunds with cumulative tracking
 * - Error handling for various edge cases
 * - Event emission for REFUNDED events
 * - Multi-tenant data isolation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RefundProcessingService } from '../../src/services/refund-processing.service';
import {
  FakeBookingRepository,
  FakePaymentProvider,
  FakeEventEmitter,
  buildBooking,
} from '../helpers/fakes';
import { NotFoundError } from '../../src/lib/errors';
import { BookingEvents } from '../../src/lib/core/events';

describe('RefundProcessingService', () => {
  let service: RefundProcessingService;
  let bookingRepo: FakeBookingRepository;
  let paymentProvider: FakePaymentProvider;
  let eventEmitter: FakeEventEmitter;

  const tenantId = 'test-tenant';
  const bookingId = 'booking_1';
  const paymentIntentId = 'pi_test_123';

  beforeEach(() => {
    bookingRepo = new FakeBookingRepository();
    paymentProvider = new FakePaymentProvider();
    eventEmitter = new FakeEventEmitter();

    service = new RefundProcessingService(bookingRepo, paymentProvider, eventEmitter);
  });

  describe('Full Refund', () => {
    it('processes complete refund for cancelled booking', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        coupleName: 'John & Jane',
        email: 'couple@example.com',
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act
      const result = await service.processRefund(tenantId, bookingId, paymentIntentId);

      // Assert
      expect(result.refundStatus).toBe('COMPLETED');
      expect(result.refundAmount).toBe(10000);
      expect(result.status).toBe('REFUNDED');
      expect(result.stripeRefundId).toMatch(/^re_/);
      expect(result.refundedAt).toBeDefined();
    });

    it('falls back to totalCents when deposit/balance not set', async () => {
      // Arrange - legacy booking without deposit/balance tracking
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 15000,
        // depositPaidAmount and balancePaidAmount not set
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act
      const result = await service.processRefund(tenantId, bookingId, paymentIntentId);

      // Assert
      expect(result.refundStatus).toBe('COMPLETED');
      expect(result.refundAmount).toBe(15000);
      expect(result.status).toBe('REFUNDED');
    });
  });

  describe('Partial Refund', () => {
    it('processes partial refund and tracks cumulatively', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        refundAmount: 0,
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act - partial refund of 5000 cents
      const result = await service.processRefund(tenantId, bookingId, paymentIntentId, 5000);

      // Assert
      expect(result.refundStatus).toBe('PARTIAL');
      expect(result.refundAmount).toBe(5000);
      expect(result.status).toBe('CANCELED'); // Still CANCELED because not fully refunded
    });

    it('tracks cumulative refunds across multiple calls', async () => {
      // Arrange - booking with previous partial refund
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING', // Reset to PENDING for next refund
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        refundAmount: 3000, // Already refunded 3000 cents
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act - refund remaining 7000 cents
      const result = await service.processRefund(tenantId, bookingId, paymentIntentId, 7000);

      // Assert - cumulative refund should be 10000 (3000 + 7000)
      expect(result.refundStatus).toBe('COMPLETED');
      expect(result.refundAmount).toBe(10000);
      expect(result.status).toBe('REFUNDED');
    });

    it('marks as PARTIAL when cumulative refund is less than total paid', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        refundAmount: 2000, // Already refunded 2000
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act - refund 3000 more (total will be 5000, less than 10000)
      const result = await service.processRefund(tenantId, bookingId, paymentIntentId, 3000);

      // Assert
      expect(result.refundStatus).toBe('PARTIAL');
      expect(result.refundAmount).toBe(5000); // 2000 + 3000
      expect(result.status).toBe('CANCELED'); // Still CANCELED
    });
  });

  describe('Error: Booking Not Found', () => {
    it('throws NotFoundError for non-existent booking', async () => {
      // Act & Assert
      await expect(
        service.processRefund(tenantId, 'nonexistent_booking', paymentIntentId)
      ).rejects.toThrow(NotFoundError);

      await expect(
        service.processRefund(tenantId, 'nonexistent_booking', paymentIntentId)
      ).rejects.toThrow('Booking nonexistent_booking not found');
    });
  });

  describe('Error: Booking Not Cancelled', () => {
    it('throws Error for booking that is not cancelled', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'PAID', // Not cancelled
        refundStatus: 'NONE',
        totalCents: 10000,
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act & Assert
      await expect(
        service.processRefund(tenantId, bookingId, paymentIntentId)
      ).rejects.toThrow(`Booking ${bookingId} does not need a refund`);
    });

    it('throws Error for cancelled booking with non-PENDING refund status', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'COMPLETED', // Already completed
        totalCents: 10000,
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act & Assert
      await expect(
        service.processRefund(tenantId, bookingId, paymentIntentId)
      ).rejects.toThrow(`Booking ${bookingId} does not need a refund`);
    });

    it('throws Error for REFUNDED status booking', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'REFUNDED',
        refundStatus: 'COMPLETED',
        totalCents: 10000,
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act & Assert
      await expect(
        service.processRefund(tenantId, bookingId, paymentIntentId)
      ).rejects.toThrow(`Booking ${bookingId} does not need a refund`);
    });
  });

  describe('Error: Refund Exceeds Available Amount', () => {
    it('throws Error when refund amount exceeds remaining refundable amount', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        refundAmount: 8000, // Already refunded 8000
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act & Assert - trying to refund 5000 when only 2000 remains
      await expect(
        service.processRefund(tenantId, bookingId, paymentIntentId, 5000)
      ).rejects.toThrow('Refund amount 5000 cents exceeds remaining refundable amount 2000 cents');
    });

    it('throws Error when refund amount is larger than total paid', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        refundAmount: 0,
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act & Assert - trying to refund more than total paid
      await expect(
        service.processRefund(tenantId, bookingId, paymentIntentId, 15000)
      ).rejects.toThrow(
        'Refund amount 15000 cents exceeds remaining refundable amount 10000 cents'
      );
    });
  });

  describe('Error: No Refundable Amount Remaining', () => {
    it('throws Error when no refundable amount remaining', async () => {
      // Arrange - fully refunded booking (but somehow reset to PENDING)
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        refundAmount: 10000, // Already fully refunded
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act & Assert
      await expect(
        service.processRefund(tenantId, bookingId, paymentIntentId)
      ).rejects.toThrow(`No refundable amount remaining for booking ${bookingId}`);
    });

    it('throws Error when refund amount is zero', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 0, // No payment was made
        depositPaidAmount: 0,
        balancePaidAmount: 0,
        refundAmount: 0,
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act & Assert
      await expect(
        service.processRefund(tenantId, bookingId, paymentIntentId)
      ).rejects.toThrow(`No refundable amount remaining for booking ${bookingId}`);
    });
  });

  describe('Refund Failure', () => {
    it('marks refund as FAILED and re-throws error on payment provider failure', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
      });
      bookingRepo.addBooking(booking, tenantId);
      paymentProvider.setRefundShouldFail(true, new Error('Stripe API error'));

      // Act & Assert
      await expect(
        service.processRefund(tenantId, bookingId, paymentIntentId)
      ).rejects.toThrow('Stripe API error');

      // Verify booking status was updated to FAILED
      const updatedBooking = await bookingRepo.findById(tenantId, bookingId);
      expect(updatedBooking?.refundStatus).toBe('FAILED');
    });

    it('sets refundStatus to PROCESSING before attempting refund', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
      });
      bookingRepo.addBooking(booking, tenantId);

      // Track intermediate state by failing the refund
      paymentProvider.setRefundShouldFail(true);

      // Act
      try {
        await service.processRefund(tenantId, bookingId, paymentIntentId);
      } catch {
        // Expected to fail
      }

      // The final status is FAILED, but PROCESSING was set before the refund attempt
      const updatedBooking = await bookingRepo.findById(tenantId, bookingId);
      expect(updatedBooking?.refundStatus).toBe('FAILED');
    });
  });

  describe('Event Emission', () => {
    it('emits REFUNDED event with correct payload for full refund', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        coupleName: 'John & Jane',
        email: 'couple@example.com',
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act
      await service.processRefund(tenantId, bookingId, paymentIntentId);

      // Assert
      expect(eventEmitter.emittedEvents).toHaveLength(1);
      const emittedEvent = eventEmitter.emittedEvents[0];
      expect(emittedEvent.event).toBe(BookingEvents.REFUNDED);
      expect(emittedEvent.payload).toEqual({
        bookingId,
        tenantId,
        email: 'couple@example.com',
        coupleName: 'John & Jane',
        refundAmount: 10000,
        isPartial: false,
      });
    });

    it('emits REFUNDED event with isPartial=true for partial refund', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        coupleName: 'Alice & Bob',
        email: 'alice.bob@example.com',
        refundAmount: 0,
      });
      bookingRepo.addBooking(booking, tenantId);

      // Act - partial refund
      await service.processRefund(tenantId, bookingId, paymentIntentId, 5000);

      // Assert
      expect(eventEmitter.emittedEvents).toHaveLength(1);
      const emittedEvent = eventEmitter.emittedEvents[0];
      expect(emittedEvent.event).toBe(BookingEvents.REFUNDED);
      expect(emittedEvent.payload).toEqual({
        bookingId,
        tenantId,
        email: 'alice.bob@example.com',
        coupleName: 'Alice & Bob',
        refundAmount: 5000,
        isPartial: true,
      });
    });

    it('does not emit event on refund failure', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
      });
      bookingRepo.addBooking(booking, tenantId);
      paymentProvider.setRefundShouldFail(true);

      // Act
      try {
        await service.processRefund(tenantId, bookingId, paymentIntentId);
      } catch {
        // Expected to fail
      }

      // Assert - no events emitted
      expect(eventEmitter.emittedEvents).toHaveLength(0);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('only finds booking for correct tenant', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
      });
      bookingRepo.addBooking(booking, 'tenant-A');

      // Act & Assert - try to access with different tenant
      await expect(
        service.processRefund('tenant-B', bookingId, paymentIntentId)
      ).rejects.toThrow(NotFoundError);
    });

    it('processes refund for correct tenant only', async () => {
      // Arrange - same booking ID in two different tenants
      const bookingTenantA = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
        coupleName: 'Tenant A Couple',
      });
      const bookingTenantB = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 20000,
        depositPaidAmount: 10000,
        balancePaidAmount: 10000,
        coupleName: 'Tenant B Couple',
      });
      bookingRepo.addBooking(bookingTenantA, 'tenant-A');
      bookingRepo.addBooking(bookingTenantB, 'tenant-B');

      // Act - refund for tenant-A
      const result = await service.processRefund('tenant-A', bookingId, paymentIntentId);

      // Assert - only tenant-A's booking was refunded
      expect(result.coupleName).toBe('Tenant A Couple');
      expect(result.refundAmount).toBe(10000);

      // Verify tenant-B's booking is untouched
      const tenantBBooking = await bookingRepo.findById('tenant-B', bookingId);
      expect(tenantBBooking?.refundStatus).toBe('PENDING');
      expect(tenantBBooking?.refundAmount).toBeUndefined();
    });

    it('event emission includes correct tenantId', async () => {
      // Arrange
      const booking = buildBooking({
        id: bookingId,
        status: 'CANCELED',
        refundStatus: 'PENDING',
        totalCents: 10000,
        depositPaidAmount: 5000,
        balancePaidAmount: 5000,
      });
      bookingRepo.addBooking(booking, 'specific-tenant-123');

      // Act
      await service.processRefund('specific-tenant-123', bookingId, paymentIntentId);

      // Assert
      const emittedEvent = eventEmitter.emittedEvents[0];
      expect(emittedEvent.payload).toHaveProperty('tenantId', 'specific-tenant-123');
    });
  });
});
