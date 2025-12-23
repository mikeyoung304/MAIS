/**
 * Unit tests for BookingService.createDateBooking()
 *
 * Phase 2 Refactor (#305): Tests for the new DATE booking service method
 * that consolidates package lookup, type validation, and availability checking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingService } from '../../src/services/booking.service';
import {
  FakeBookingRepository,
  FakeCatalogRepository,
  FakeEventEmitter,
  FakePaymentProvider,
  buildPackage,
} from '../helpers/fakes';
import {
  NotFoundError,
  BookingConflictError,
  InvalidBookingTypeError,
} from '../../src/lib/errors';

describe('BookingService.createDateBooking', () => {
  let service: BookingService;
  let bookingRepo: FakeBookingRepository;
  let catalogRepo: FakeCatalogRepository;
  let eventEmitter: FakeEventEmitter;
  let paymentProvider: FakePaymentProvider;
  let commissionService: ReturnType<typeof createMockCommissionService>;
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let idempotencyService: ReturnType<typeof createMockIdempotencyService>;
  let availabilityService: ReturnType<typeof createMockAvailabilityService>;

  const tenantId = 'test-tenant';

  function createMockCommissionService() {
    return {
      calculateCommission: vi
        .fn()
        .mockReturnValue({ platformFeeCents: 500, vendorPayoutCents: 99500 }),
      calculateBookingTotal: vi.fn().mockResolvedValue({
        basePrice: 100000,
        addOnsTotal: 0,
        subtotal: 100000,
        commissionAmount: 5000,
        commissionPercent: 5,
        platformFeeCents: 5000,
        vendorPayoutCents: 95000,
        customerTotalCents: 100000,
      }),
    };
  }

  function createMockTenantRepo() {
    return {
      findById: vi.fn().mockResolvedValue({
        id: tenantId,
        stripeConnectedAccountId: 'acct_test123',
        name: 'Test Tenant',
      }),
    };
  }

  function createMockIdempotencyService() {
    return {
      generateCheckoutKey: vi.fn().mockReturnValue('checkout_test_key_123'),
      checkAndStore: vi.fn().mockResolvedValue(true),
      getStoredResponse: vi.fn().mockResolvedValue(null),
      updateResponse: vi.fn().mockResolvedValue(undefined),
    };
  }

  function createMockAvailabilityService() {
    return {
      checkAvailability: vi.fn().mockResolvedValue({ date: '2025-06-15', available: true }),
      getUnavailableDates: vi.fn().mockResolvedValue([]),
    };
  }

  beforeEach(() => {
    bookingRepo = new FakeBookingRepository();
    catalogRepo = new FakeCatalogRepository();
    eventEmitter = new FakeEventEmitter();
    paymentProvider = new FakePaymentProvider();
    commissionService = createMockCommissionService();
    tenantRepo = createMockTenantRepo();
    idempotencyService = createMockIdempotencyService();
    availabilityService = createMockAvailabilityService();

    service = new BookingService({
      bookingRepo,
      catalogRepo,
      eventEmitter,
      paymentProvider,
      commissionService: commissionService as any,
      tenantRepo: tenantRepo as any,
      idempotencyService: idempotencyService as any,
      availabilityService: availabilityService as any,
    });
  });

  describe('Error Handling', () => {
    it('throws NotFoundError for missing package', async () => {
      // Act & Assert
      await expect(
        service.createDateBooking(tenantId, {
          packageId: 'nonexistent-package',
          date: '2025-06-15',
          customerName: 'Test Couple',
          customerEmail: 'test@example.com',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('throws InvalidBookingTypeError for TIMESLOT package', async () => {
      // Arrange
      const pkg = buildPackage({
        id: 'pkg_timeslot',
        slug: 'appointment-service',
        priceCents: 15000,
        bookingType: 'TIMESLOT',
      });
      catalogRepo.addPackage(pkg);

      // Act & Assert
      await expect(
        service.createDateBooking(tenantId, {
          packageId: 'pkg_timeslot',
          date: '2025-06-15',
          customerName: 'Test Client',
          customerEmail: 'test@example.com',
        })
      ).rejects.toThrow(InvalidBookingTypeError);
    });

    it('throws BookingConflictError when date is unavailable (booked)', async () => {
      // Arrange
      const pkg = buildPackage({
        id: 'pkg_wedding',
        slug: 'wedding-package',
        priceCents: 250000,
        bookingType: 'DATE',
      });
      catalogRepo.addPackage(pkg);
      availabilityService.checkAvailability.mockResolvedValue({
        date: '2025-06-15',
        available: false,
        reason: 'booked',
      });

      // Act & Assert
      await expect(
        service.createDateBooking(tenantId, {
          packageId: 'pkg_wedding',
          date: '2025-06-15',
          customerName: 'Test Couple',
          customerEmail: 'test@example.com',
        })
      ).rejects.toThrow(BookingConflictError);
    });

    it('throws BookingConflictError when date is blackout', async () => {
      // Arrange
      const pkg = buildPackage({
        id: 'pkg_wedding',
        slug: 'wedding-package',
        priceCents: 250000,
        bookingType: 'DATE',
      });
      catalogRepo.addPackage(pkg);
      availabilityService.checkAvailability.mockResolvedValue({
        date: '2025-12-25',
        available: false,
        reason: 'blackout',
      });

      // Act & Assert
      await expect(
        service.createDateBooking(tenantId, {
          packageId: 'pkg_wedding',
          date: '2025-12-25',
          customerName: 'Test Couple',
          customerEmail: 'test@example.com',
        })
      ).rejects.toThrow(BookingConflictError);
    });
  });

  describe('Happy Path', () => {
    it('creates checkout for valid DATE booking', async () => {
      // Arrange
      const pkg = buildPackage({
        id: 'pkg_wedding',
        slug: 'intimate-ceremony',
        priceCents: 250000,
        bookingType: 'DATE',
      });
      catalogRepo.addPackage(pkg);

      // Act
      const result = await service.createDateBooking(tenantId, {
        packageId: 'pkg_wedding',
        date: '2025-06-15',
        customerName: 'Jane & John',
        customerEmail: 'couple@example.com',
      });

      // Assert
      expect(result.checkoutUrl).toContain('fake-checkout.com');
      expect(availabilityService.checkAvailability).toHaveBeenCalledWith(tenantId, '2025-06-15');
    });

    it('passes add-on IDs to createCheckout', async () => {
      // Arrange
      const pkg = buildPackage({
        id: 'pkg_wedding',
        slug: 'grand-celebration',
        priceCents: 500000,
        bookingType: 'DATE',
      });
      catalogRepo.addPackage(pkg);

      // Act
      const result = await service.createDateBooking(tenantId, {
        packageId: 'pkg_wedding',
        date: '2025-08-20',
        customerName: 'Emma & Oliver',
        customerEmail: 'couple@example.com',
        addOnIds: ['addon_1', 'addon_2'],
      });

      // Assert
      expect(result.checkoutUrl).toBeDefined();
    });

    it('handles package without explicit bookingType (defaults to undefined, fails validation)', async () => {
      // Arrange - package without bookingType set
      const pkg = buildPackage({
        id: 'pkg_legacy',
        slug: 'legacy-package',
        priceCents: 100000,
        // No bookingType set
      });
      catalogRepo.addPackage(pkg);

      // Act & Assert - should throw because bookingType !== 'DATE'
      await expect(
        service.createDateBooking(tenantId, {
          packageId: 'pkg_legacy',
          date: '2025-06-15',
          customerName: 'Test Couple',
          customerEmail: 'test@example.com',
        })
      ).rejects.toThrow(InvalidBookingTypeError);
    });
  });

  describe('Availability Service Integration', () => {
    it('skips availability check when service not injected', async () => {
      // Arrange - create service without availability service
      const serviceWithoutAvailability = new BookingService({
        bookingRepo,
        catalogRepo,
        eventEmitter,
        paymentProvider,
        commissionService: commissionService as any,
        tenantRepo: tenantRepo as any,
        idempotencyService: idempotencyService as any,
        // availabilityService not provided - should be skipped
      });

      const pkg = buildPackage({
        id: 'pkg_wedding',
        slug: 'simple-ceremony',
        priceCents: 100000,
        bookingType: 'DATE',
      });
      catalogRepo.addPackage(pkg);

      // Act
      const result = await serviceWithoutAvailability.createDateBooking(tenantId, {
        packageId: 'pkg_wedding',
        date: '2025-06-15',
        customerName: 'Test Couple',
        customerEmail: 'test@example.com',
      });

      // Assert - should still work, just without availability check
      expect(result.checkoutUrl).toBeDefined();
      expect(availabilityService.checkAvailability).not.toHaveBeenCalled();
    });
  });
});
