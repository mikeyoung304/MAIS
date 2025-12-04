/**
 * Concurrency and race condition tests for BookingRepository
 * Tests locking, duplicate prevention, and timeout handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FakeBookingRepository, buildBooking } from '../helpers/fakes';
import { BookingConflictError } from '../../src/lib/errors';

describe('BookingRepository - Concurrency', () => {
  let repository: FakeBookingRepository;

  beforeEach(() => {
    repository = new FakeBookingRepository();
  });

  describe('Concurrent booking prevention', () => {
    it('should prevent concurrent bookings for same date - only one succeeds', async () => {
      // Arrange: Two bookings for the same date
      const date = '2025-06-15';
      const booking1 = buildBooking({
        id: 'booking_1',
        eventDate: date,
        email: 'first@example.com',
      });
      const booking2 = buildBooking({
        id: 'booking_2',
        eventDate: date,
        email: 'second@example.com',
      });

      // Act: Simulate concurrent execution
      const results = await Promise.allSettled([
        repository.create('test-tenant', booking1),
        repository.create('test-tenant', booking2),
      ]);

      // Assert: Only one succeeds, one fails
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // The failure should be a BookingConflictError
      const failedResult = failures[0];
      if (failedResult && failedResult.status === 'rejected') {
        expect(failedResult.reason).toBeInstanceOf(BookingConflictError);
        expect(failedResult.reason.message).toContain('already booked');
      }
    });

    it('should allow bookings for different dates concurrently', async () => {
      // Arrange: Two bookings for different dates
      const booking1 = buildBooking({ id: 'booking_1', eventDate: '2025-06-15' });
      const booking2 = buildBooking({ id: 'booking_2', eventDate: '2025-06-16' });

      // Act: Simulate concurrent execution
      const results = await Promise.allSettled([
        repository.create('test-tenant', booking1),
        repository.create('test-tenant', booking2),
      ]);

      // Assert: Both succeed
      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes.length).toBe(2);

      // Verify both are in repository
      const allBookings = await repository.findAll('test-tenant');
      expect(allBookings.length).toBe(2);
    });

    it('should throw BookingConflictError for duplicate date', async () => {
      // Arrange: Create first booking
      const date = '2025-07-01';
      await repository.create('test-tenant', buildBooking({ id: 'booking_1', eventDate: date }));

      // Act & Assert: Attempt to book same date again
      await expect(
        repository.create('test-tenant', buildBooking({ id: 'booking_2', eventDate: date }))
      ).rejects.toThrow(BookingConflictError);

      await expect(
        repository.create('test-tenant', buildBooking({ id: 'booking_2', eventDate: date }))
      ).rejects.toThrow('already booked');
    });

    it('should verify date is booked after successful booking', async () => {
      // Arrange & Act
      const date = '2025-08-01';
      await repository.create('test-tenant', buildBooking({ eventDate: date }));

      // Assert
      const isBooked = await repository.isDateBooked('test-tenant', date);
      expect(isBooked).toBe(true);
    });

    it('should verify date is not booked before any booking', async () => {
      // Act
      const isBooked = await repository.isDateBooked('test-tenant', '2025-12-25');

      // Assert
      expect(isBooked).toBe(false);
    });
  });

  describe('Sequential booking flow', () => {
    it('should successfully process bookings sequentially for different dates', async () => {
      // Arrange: Multiple dates
      const dates = ['2025-06-15', '2025-06-16', '2025-06-17'];

      // Act: Book each date sequentially
      for (const date of dates) {
        await repository.create(
          'test-tenant',
          buildBooking({ id: `booking_${date}`, eventDate: date })
        );
      }

      // Assert: All bookings created
      const allBookings = await repository.findAll('test-tenant');
      expect(allBookings.length).toBe(3);

      // Verify each date is booked
      for (const date of dates) {
        const isBooked = await repository.isDateBooked('test-tenant', date);
        expect(isBooked).toBe(true);
      }
    });

    it('should fail when trying to book already booked date in sequence', async () => {
      // Arrange
      const date = '2025-09-01';
      await repository.create('test-tenant', buildBooking({ id: 'booking_1', eventDate: date }));

      // Act & Assert: Second booking should fail
      await expect(
        repository.create('test-tenant', buildBooking({ id: 'booking_2', eventDate: date }))
      ).rejects.toThrow(BookingConflictError);

      // Verify only one booking exists
      const allBookings = await repository.findAll('test-tenant');
      expect(allBookings.length).toBe(1);
    });
  });

  describe('Repository state management', () => {
    it('should maintain correct state after failed booking attempt', async () => {
      // Arrange
      const date = '2025-10-01';
      await repository.create('test-tenant', buildBooking({ id: 'booking_1', eventDate: date }));

      // Act: Try to create duplicate
      try {
        await repository.create('test-tenant', buildBooking({ id: 'booking_2', eventDate: date }));
      } catch {
        // Expected error
      }

      // Assert: Repository state is consistent
      const allBookings = await repository.findAll('test-tenant');
      expect(allBookings.length).toBe(1);
      expect(allBookings[0]?.id).toBe('booking_1');
    });

    it('should clear all bookings when clear() is called', async () => {
      // Arrange: Create multiple bookings
      await repository.create(
        'test-tenant',
        buildBooking({ id: 'booking_1', eventDate: '2025-11-01' })
      );
      await repository.create(
        'test-tenant',
        buildBooking({ id: 'booking_2', eventDate: '2025-11-02' })
      );

      // Act
      repository.clear();

      // Assert
      const allBookings = await repository.findAll('test-tenant');
      expect(allBookings.length).toBe(0);
    });

    it('should find booking by ID correctly', async () => {
      // Arrange
      const booking = buildBooking({ id: 'specific_id', eventDate: '2025-12-01' });
      await repository.create('test-tenant', booking);

      // Act
      const found = await repository.findById('test-tenant', 'specific_id');

      // Assert
      expect(found).not.toBeNull();
      expect(found?.id).toBe('specific_id');
      expect(found?.eventDate).toBe('2025-12-01');
    });

    it('should return null for non-existent booking ID', async () => {
      // Act
      const found = await repository.findById('test-tenant', 'non_existent_id');

      // Assert
      expect(found).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid sequential booking attempts for same date', async () => {
      // Arrange
      const date = '2025-06-20';
      const attempts = 5;

      // Act: Try to book same date multiple times rapidly
      const results = await Promise.allSettled(
        Array.from({ length: attempts }, (_, i) =>
          repository.create('test-tenant', buildBooking({ id: `booking_${i}`, eventDate: date }))
        )
      );

      // Assert: Only one succeeds
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(attempts - 1);

      // All failures should be BookingConflictError
      for (const result of failures) {
        if (result.status === 'rejected') {
          expect(result.reason).toBeInstanceOf(BookingConflictError);
        }
      }
    });

    it('should handle bookings with same ID but different dates', async () => {
      // Note: This is an edge case that shouldn't happen in real usage
      // but tests repository robustness
      const booking1 = buildBooking({ id: 'same_id', eventDate: '2025-07-01' });
      await repository.create('test-tenant', booking1);

      // In a real implementation with unique ID constraints, this would fail
      // For FakeRepository, it allows duplicate IDs but enforces unique dates
      const booking2 = buildBooking({ id: 'same_id', eventDate: '2025-07-02' });
      await expect(repository.create('test-tenant', booking2)).resolves.toBeDefined();
    });
  });

  describe('Data consistency', () => {
    it('should store bookings correctly', async () => {
      // Arrange & Act
      const originalBooking = buildBooking({
        id: 'original',
        eventDate: '2025-08-15',
        coupleName: 'John & Jane',
      });
      const created = await repository.create('test-tenant', originalBooking);

      // Assert: Created booking has correct data
      expect(created.coupleName).toBe('John & Jane');
      expect(created.eventDate).toBe('2025-08-15');

      // Finding by ID should return the same data
      const found = await repository.findById('test-tenant', 'original');
      expect(found?.coupleName).toBe('John & Jane');
      expect(found?.eventDate).toBe('2025-08-15');
    });

    it('should return consistent results from findAll()', async () => {
      // Arrange
      await repository.create(
        'test-tenant',
        buildBooking({ id: 'booking_1', eventDate: '2025-06-01' })
      );
      await repository.create(
        'test-tenant',
        buildBooking({ id: 'booking_2', eventDate: '2025-06-02' })
      );

      // Act: Call findAll multiple times
      const result1 = await repository.findAll('test-tenant');
      const result2 = await repository.findAll('test-tenant');

      // Assert: Results should be consistent
      expect(result1.length).toBe(result2.length);
      expect(result1.length).toBe(2);
    });
  });
});

/**
 * Note: Lock timeout tests
 *
 * The FakeBookingRepository doesn't implement actual database locking
 * or timeout behavior. In a real Prisma implementation, you would test:
 *
 * - Lock acquisition timeout (BookingLockTimeoutError)
 * - Lock release after successful transaction
 * - Lock release after failed transaction
 * - Deadlock detection and recovery
 *
 * These would be tested against the actual PrismaBookingRepository
 * in integration tests, not unit tests with fakes.
 *
 * Example integration test pattern:
 *
 * it('should handle lock timeout for concurrent bookings', async () => {
 *   // This would use real Prisma with transaction locks
 *   const date = '2025-06-15';
 *
 *   // Start long-running transaction that holds lock
 *   const tx1 = prisma.$transaction(async (tx) => {
 *     await tx.booking.create({ ... });
 *     await new Promise(resolve => setTimeout(resolve, 5000));
 *   });
 *
 *   // Attempt concurrent booking with shorter timeout
 *   await expect(
 *     prismaBookingRepo.createWithLock(booking, { timeout: 1000 })
 *   ).rejects.toThrow(BookingLockTimeoutError);
 * });
 */
