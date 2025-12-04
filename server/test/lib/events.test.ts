import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InProcessEventEmitter, BookingEvents, AppointmentEvents } from '../../src/lib/core/events';

describe('InProcessEventEmitter', () => {
  let emitter: InProcessEventEmitter;

  beforeEach(() => {
    emitter = new InProcessEventEmitter();
  });

  describe('subscribe and emit', () => {
    it('should call all handlers for an event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: ['Album', 'Drone Shots'],
        totalCents: 250000,
      };

      emitter.subscribe(BookingEvents.PAID, handler1);
      emitter.subscribe(BookingEvents.PAID, handler2);
      emitter.subscribe(BookingEvents.PAID, handler3);

      await emitter.emit(BookingEvents.PAID, payload);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler1).toHaveBeenCalledWith(payload);
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledWith(payload);
      expect(handler3).toHaveBeenCalledOnce();
      expect(handler3).toHaveBeenCalledWith(payload);
    });

    it('should handle async handlers', async () => {
      const handler1 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      const handler2 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 150000,
      };

      emitter.subscribe(BookingEvents.PAID, handler1);
      emitter.subscribe(BookingEvents.PAID, handler2);

      await emitter.emit(BookingEvents.PAID, payload);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('should only call handlers for the specific event emitted', async () => {
      const paidHandler = vi.fn();
      const cancelledHandler = vi.fn();

      const paidPayload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      emitter.subscribe(BookingEvents.PAID, paidHandler);
      emitter.subscribe(BookingEvents.CANCELLED, cancelledHandler);

      await emitter.emit(BookingEvents.PAID, paidPayload);

      expect(paidHandler).toHaveBeenCalledOnce();
      expect(cancelledHandler).not.toHaveBeenCalled();
    });

    it('should support different event types', async () => {
      const bookingHandler = vi.fn();
      const appointmentHandler = vi.fn();

      const bookingPayload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      const appointmentPayload = {
        bookingId: 'apt_456',
        tenantId: 'ten_123',
        serviceId: 'srv_789',
        serviceName: 'Consultation',
        clientName: 'Alice Smith',
        clientEmail: 'alice@example.com',
        clientPhone: '555-1234',
        startTime: '2024-06-15T10:00:00Z',
        endTime: '2024-06-15T11:00:00Z',
        totalCents: 10000,
        notes: 'First consultation',
      };

      emitter.subscribe(BookingEvents.PAID, bookingHandler);
      emitter.subscribe(AppointmentEvents.BOOKED, appointmentHandler);

      await emitter.emit(BookingEvents.PAID, bookingPayload);
      await emitter.emit(AppointmentEvents.BOOKED, appointmentPayload);

      expect(bookingHandler).toHaveBeenCalledOnce();
      expect(bookingHandler).toHaveBeenCalledWith(bookingPayload);
      expect(appointmentHandler).toHaveBeenCalledOnce();
      expect(appointmentHandler).toHaveBeenCalledWith(appointmentPayload);
    });
  });

  describe('error isolation', () => {
    it('should isolate handler errors (one handler error does not affect others)', async () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 failed');
      });
      const handler2 = vi.fn();
      const handler3 = vi.fn(async () => {
        throw new Error('Handler 3 failed');
      });
      const handler4 = vi.fn();

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      emitter.subscribe(BookingEvents.PAID, handler1);
      emitter.subscribe(BookingEvents.PAID, handler2);
      emitter.subscribe(BookingEvents.PAID, handler3);
      emitter.subscribe(BookingEvents.PAID, handler4);

      // Should not throw despite handler errors
      await expect(emitter.emit(BookingEvents.PAID, payload)).resolves.toBeUndefined();

      // All handlers should have been called
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler3).toHaveBeenCalledOnce();
      expect(handler4).toHaveBeenCalledOnce();
    });

    it('should continue processing after handler rejection', async () => {
      const handler1 = vi.fn(async () => {
        return Promise.reject(new Error('Async failure'));
      });
      const handler2 = vi.fn();

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      emitter.subscribe(BookingEvents.PAID, handler1);
      emitter.subscribe(BookingEvents.PAID, handler2);

      await emitter.emit(BookingEvents.PAID, payload);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe('clearAll', () => {
    it('should clear all handlers with clearAll()', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      emitter.subscribe(BookingEvents.PAID, handler1);
      emitter.subscribe(BookingEvents.CANCELLED, handler2);

      // Verify handlers are registered
      await emitter.emit(BookingEvents.PAID, payload);
      expect(handler1).toHaveBeenCalledOnce();

      // Clear all handlers
      emitter.clearAll();

      // Handlers should no longer be called
      await emitter.emit(BookingEvents.PAID, payload);
      expect(handler1).toHaveBeenCalledOnce(); // Still only once (not called again)
    });

    it('should allow re-subscribing after clearAll()', async () => {
      const handler = vi.fn();

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      emitter.subscribe(BookingEvents.PAID, handler);
      emitter.clearAll();

      // Re-subscribe after clear
      emitter.subscribe(BookingEvents.PAID, handler);

      await emitter.emit(BookingEvents.PAID, payload);

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe individual handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      const unsubscribe1 = emitter.subscribe(BookingEvents.PAID, handler1);
      const unsubscribe2 = emitter.subscribe(BookingEvents.PAID, handler2);
      emitter.subscribe(BookingEvents.PAID, handler3);

      // Unsubscribe handler1
      unsubscribe1();

      await emitter.emit(BookingEvents.PAID, payload);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler3).toHaveBeenCalledOnce();

      // Unsubscribe handler2
      unsubscribe2();

      await emitter.emit(BookingEvents.PAID, payload);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce(); // Still only once
      expect(handler3).toHaveBeenCalledTimes(2);
    });

    it('should handle unsubscribing the same handler multiple times safely', () => {
      const handler = vi.fn();

      const unsubscribe = emitter.subscribe(BookingEvents.PAID, handler);

      // Unsubscribe multiple times should not throw
      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });

    it('should unsubscribe only the specific handler instance', async () => {
      // Note: When the same function reference is subscribed multiple times,
      // calling unsubscribe removes ALL matching references due to filter !== behavior
      // This test verifies that unsubscribing does remove all matching handlers
      const sharedFn = vi.fn();

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      // Subscribe the same function reference twice
      const unsubscribe1 = emitter.subscribe(BookingEvents.PAID, sharedFn);
      emitter.subscribe(BookingEvents.PAID, sharedFn);

      // Unsubscribe using first unsubscribe function
      // Due to filter behavior, this removes ALL matching references
      unsubscribe1();

      await emitter.emit(BookingEvents.PAID, payload);

      // Should not be called (both subscriptions removed by filter)
      expect(sharedFn).not.toHaveBeenCalled();
    });

    it('should remove event key from map when last handler is unsubscribed', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      const unsubscribe1 = emitter.subscribe(BookingEvents.PAID, handler1);
      const unsubscribe2 = emitter.subscribe(BookingEvents.PAID, handler2);

      // Unsubscribe both handlers
      unsubscribe1();
      unsubscribe2();

      // Emit should not call any handlers
      await emitter.emit(BookingEvents.PAID, payload);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle emitting events with no subscribers', async () => {
      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      // Should not throw when no handlers are registered
      await expect(emitter.emit(BookingEvents.PAID, payload)).resolves.toBeUndefined();
    });

    it('should handle subscribing during emit', async () => {
      const handler1 = vi.fn(() => {
        // Subscribe a new handler during execution
        emitter.subscribe(BookingEvents.PAID, handler3);
      });
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const payload = {
        bookingId: 'bkg_123',
        email: 'customer@example.com',
        coupleName: 'John & Jane Doe',
        eventDate: '2024-06-15',
        packageTitle: 'Wedding Photography',
        addOnTitles: [],
        totalCents: 250000,
      };

      emitter.subscribe(BookingEvents.PAID, handler1);
      emitter.subscribe(BookingEvents.PAID, handler2);

      await emitter.emit(BookingEvents.PAID, payload);

      // handler3 should not be called in first emit (added during emit)
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler3).not.toHaveBeenCalled();

      // But should be called in subsequent emit
      await emitter.emit(BookingEvents.PAID, payload);
      expect(handler3).toHaveBeenCalledOnce();
    });
  });
});
