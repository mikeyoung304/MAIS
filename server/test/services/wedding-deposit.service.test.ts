/**
 * Unit tests for WeddingDepositService
 *
 * Tests deposit calculation, balance payment preparation and completion,
 * and commission split between deposit and balance payments.
 *
 * @module wedding-deposit.service.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WeddingDepositService,
  type DepositCalculation,
  type BalancePaymentResult,
} from '../../src/services/wedding-deposit.service';
import { FakeBookingRepository, FakeEventEmitter, buildBooking } from '../helpers/fakes';
import { NotFoundError } from '../../src/lib/errors';
import { BookingEvents } from '../../src/lib/core/events';
import type { Booking } from '../../src/lib/entities';

describe('WeddingDepositService', () => {
  let service: WeddingDepositService;
  let bookingRepo: FakeBookingRepository;
  let eventEmitter: FakeEventEmitter;
  let tenantRepo: ReturnType<typeof createMockTenantRepo>;
  let commissionService: ReturnType<typeof createMockCommissionService>;

  const tenantId = 'tenant_test_123';
  const bookingId = 'booking_test_456';

  /**
   * Creates a mock tenant repository
   * @param overrides - Optional tenant property overrides
   */
  function createMockTenantRepo(overrides?: {
    depositPercent?: number | null;
    exists?: boolean;
  }) {
    const defaultTenant = {
      id: tenantId,
      slug: 'test-tenant',
      name: 'Test Tenant',
      email: 'tenant@example.com',
      depositPercent: overrides?.depositPercent ?? null,
    };

    return {
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (overrides?.exists === false) {
          return null;
        }
        return id === tenantId ? defaultTenant : null;
      }),
    };
  }

  /**
   * Creates a mock commission service with configurable calculation results
   */
  function createMockCommissionService(overrides?: {
    subtotal?: number;
    commissionAmount?: number;
    commissionPercent?: number;
  }) {
    const defaultResult = {
      packagePrice: 100000,
      addOnsTotal: 0,
      subtotal: overrides?.subtotal ?? 100000,
      commissionAmount: overrides?.commissionAmount ?? 10000, // 10% default
      commissionPercent: overrides?.commissionPercent ?? 10,
      tenantReceives: (overrides?.subtotal ?? 100000) - (overrides?.commissionAmount ?? 10000),
    };

    return {
      calculateBookingTotal: vi.fn().mockResolvedValue(defaultResult),
      calculateCommission: vi.fn().mockResolvedValue({
        amount: defaultResult.commissionAmount,
        percent: defaultResult.commissionPercent,
      }),
    };
  }

  beforeEach(() => {
    bookingRepo = new FakeBookingRepository();
    eventEmitter = new FakeEventEmitter();
    tenantRepo = createMockTenantRepo();
    commissionService = createMockCommissionService();

    service = new WeddingDepositService(
      bookingRepo,
      tenantRepo as any,
      commissionService as any,
      eventEmitter
    );
  });

  // ============================================================================
  // calculateDeposit Tests
  // ============================================================================

  describe('calculateDeposit', () => {
    describe('when no deposit is configured', () => {
      it('returns full amount when depositPercent is null', async () => {
        // Arrange
        tenantRepo = createMockTenantRepo({ depositPercent: null });
        service = new WeddingDepositService(
          bookingRepo,
          tenantRepo as any,
          commissionService as any,
          eventEmitter
        );

        // Act
        const result = await service.calculateDeposit(tenantId, 100000);

        // Assert
        expect(result.amountToCharge).toBe(100000);
        expect(result.isDeposit).toBe(false);
        expect(result.depositPercent).toBeNull();
        expect(result.depositCommissionAmount).toBe(0);
        expect(result.balanceCommissionAmount).toBe(10000); // Full commission on balance
      });

      it('returns full amount when depositPercent is 0', async () => {
        // Arrange
        tenantRepo = createMockTenantRepo({ depositPercent: 0 });
        service = new WeddingDepositService(
          bookingRepo,
          tenantRepo as any,
          commissionService as any,
          eventEmitter
        );

        // Act
        const result = await service.calculateDeposit(tenantId, 100000);

        // Assert
        expect(result.amountToCharge).toBe(100000);
        expect(result.isDeposit).toBe(false);
      });
    });

    describe('when deposit is configured', () => {
      it('returns deposit percentage when configured (50%)', async () => {
        // Arrange
        tenantRepo = createMockTenantRepo({ depositPercent: 50 });
        service = new WeddingDepositService(
          bookingRepo,
          tenantRepo as any,
          commissionService as any,
          eventEmitter
        );

        // Act
        const result = await service.calculateDeposit(tenantId, 100000);

        // Assert
        expect(result.amountToCharge).toBe(50000); // 50% of 100000
        expect(result.isDeposit).toBe(true);
        expect(result.depositPercent).toBe(50);
        expect(result.subtotal).toBe(100000);
      });

      it('returns deposit percentage when configured (25%)', async () => {
        // Arrange
        tenantRepo = createMockTenantRepo({ depositPercent: 25 });
        commissionService = createMockCommissionService({
          subtotal: 200000, // $2000 package
          commissionAmount: 20000, // 10% commission
          commissionPercent: 10,
        });
        service = new WeddingDepositService(
          bookingRepo,
          tenantRepo as any,
          commissionService as any,
          eventEmitter
        );

        // Act
        const result = await service.calculateDeposit(tenantId, 200000);

        // Assert
        expect(result.amountToCharge).toBe(50000); // 25% of 200000
        expect(result.isDeposit).toBe(true);
        expect(result.depositPercent).toBe(25);
      });

      it('splits commission proportionally between deposit and balance', async () => {
        // Arrange
        tenantRepo = createMockTenantRepo({ depositPercent: 50 });
        commissionService = createMockCommissionService({
          subtotal: 100000,
          commissionAmount: 10000, // 10% commission
          commissionPercent: 10,
        });
        service = new WeddingDepositService(
          bookingRepo,
          tenantRepo as any,
          commissionService as any,
          eventEmitter
        );

        // Act
        const result = await service.calculateDeposit(tenantId, 100000);

        // Assert
        expect(result.totalCommission).toBe(10000);
        expect(result.depositCommissionAmount).toBe(5000); // 50% of commission
        expect(result.balanceCommissionAmount).toBe(5000); // 50% of commission
        expect(result.depositCommissionAmount + result.balanceCommissionAmount).toBe(
          result.totalCommission
        );
      });

      it('handles non-even commission splits correctly (30% deposit)', async () => {
        // Arrange
        tenantRepo = createMockTenantRepo({ depositPercent: 30 });
        commissionService = createMockCommissionService({
          subtotal: 100000,
          commissionAmount: 10000,
          commissionPercent: 10,
        });
        service = new WeddingDepositService(
          bookingRepo,
          tenantRepo as any,
          commissionService as any,
          eventEmitter
        );

        // Act
        const result = await service.calculateDeposit(tenantId, 100000);

        // Assert
        expect(result.depositCommissionAmount).toBe(3000); // 30% of 10000, rounded
        expect(result.balanceCommissionAmount).toBe(7000); // remaining
        expect(result.depositCommissionAmount + result.balanceCommissionAmount).toBe(10000);
      });
    });

    describe('error handling', () => {
      it('throws NotFoundError for unknown tenant', async () => {
        // Arrange
        tenantRepo = createMockTenantRepo({ exists: false });
        service = new WeddingDepositService(
          bookingRepo,
          tenantRepo as any,
          commissionService as any,
          eventEmitter
        );

        // Act & Assert
        await expect(
          service.calculateDeposit('nonexistent_tenant', 100000)
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe('with add-ons', () => {
      it('includes add-ons in calculation', async () => {
        // Arrange
        tenantRepo = createMockTenantRepo({ depositPercent: 50 });
        commissionService = createMockCommissionService({
          subtotal: 150000, // package + add-ons
          commissionAmount: 15000,
          commissionPercent: 10,
        });
        service = new WeddingDepositService(
          bookingRepo,
          tenantRepo as any,
          commissionService as any,
          eventEmitter
        );

        // Act
        const result = await service.calculateDeposit(tenantId, 100000, ['addon_1', 'addon_2']);

        // Assert
        expect(commissionService.calculateBookingTotal).toHaveBeenCalledWith(
          tenantId,
          100000,
          ['addon_1', 'addon_2']
        );
        expect(result.subtotal).toBe(150000);
        expect(result.amountToCharge).toBe(75000); // 50% of 150000
      });
    });
  });

  // ============================================================================
  // prepareBalancePayment Tests
  // ============================================================================

  describe('prepareBalancePayment', () => {
    describe('happy path', () => {
      it('returns correct balance amount when deposit was paid', async () => {
        // Arrange
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: 50000,
          commissionAmount: 10000,
          commissionPercent: 10,
          status: 'DEPOSIT_PAID',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act
        const result = await service.prepareBalancePayment({
          tenantId,
          bookingId,
        });

        // Assert
        expect(result.balanceAmountCents).toBe(50000); // 100000 - 50000
        expect(result.booking.id).toBe(bookingId);
      });

      it('calculates balance commission proportionally', async () => {
        // Arrange
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: 50000, // 50% deposit
          commissionAmount: 10000, // 10% total commission
          commissionPercent: 10,
          status: 'DEPOSIT_PAID',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act
        const result = await service.prepareBalancePayment({
          tenantId,
          bookingId,
        });

        // Assert
        expect(result.balanceCommission).toBe(5000); // 50% of commission for balance
      });

      it('includes correct metadata for Stripe checkout', async () => {
        // Arrange
        const booking = buildBooking({
          id: bookingId,
          email: 'couple@example.com',
          coupleName: 'Jane & John',
          eventDate: '2025-08-15',
          totalCents: 100000,
          depositPaidAmount: 30000,
          commissionAmount: 10000,
          commissionPercent: 10,
          status: 'DEPOSIT_PAID',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act
        const result = await service.prepareBalancePayment({
          tenantId,
          bookingId,
        });

        // Assert
        expect(result.metadata.tenantId).toBe(tenantId);
        expect(result.metadata.bookingId).toBe(bookingId);
        expect(result.metadata.isBalancePayment).toBe('true');
        expect(result.metadata.balanceAmountCents).toBe('70000');
        expect(result.metadata.email).toBe('couple@example.com');
        expect(result.metadata.coupleName).toBe('Jane & John');
        expect(result.metadata.eventDate).toBe('2025-08-15');
      });
    });

    describe('error handling', () => {
      it('throws NotFoundError if booking does not exist', async () => {
        // Act & Assert
        await expect(
          service.prepareBalancePayment({
            tenantId,
            bookingId: 'nonexistent_booking',
          })
        ).rejects.toThrow(NotFoundError);
      });

      it('throws if no deposit was paid', async () => {
        // Arrange
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: undefined, // No deposit paid
          status: 'PENDING',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act & Assert
        await expect(
          service.prepareBalancePayment({
            tenantId,
            bookingId,
          })
        ).rejects.toThrow('Booking does not have a deposit paid');
      });

      it('throws if balance was already paid (balancePaidAmount set)', async () => {
        // Arrange
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: 50000,
          balancePaidAmount: 50000, // Already paid
          status: 'PAID',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act & Assert
        await expect(
          service.prepareBalancePayment({
            tenantId,
            bookingId,
          })
        ).rejects.toThrow('Balance has already been paid for this booking');
      });

      it('throws if balance was already paid (balancePaidAt set)', async () => {
        // Arrange
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: 50000,
          balancePaidAt: new Date().toISOString(), // Already paid
          status: 'PAID',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act & Assert
        await expect(
          service.prepareBalancePayment({
            tenantId,
            bookingId,
          })
        ).rejects.toThrow('Balance has already been paid for this booking');
      });

      it('throws if no balance is due (deposit equals total)', async () => {
        // Arrange
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: 100000, // Full amount paid as deposit
          status: 'DEPOSIT_PAID',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act & Assert
        await expect(
          service.prepareBalancePayment({
            tenantId,
            bookingId,
          })
        ).rejects.toThrow('No balance due for this booking');
      });
    });
  });

  // ============================================================================
  // completeBalancePayment Tests
  // ============================================================================

  describe('completeBalancePayment', () => {
    describe('happy path', () => {
      it('updates booking status to PAID', async () => {
        // Arrange
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: 50000,
          status: 'DEPOSIT_PAID',
          email: 'couple@example.com',
          coupleName: 'Jane & John',
          eventDate: '2025-08-15',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act
        const result = await service.completeBalancePayment(tenantId, bookingId, 50000);

        // Assert
        expect(result.status).toBe('PAID');
        expect(result.balancePaidAmount).toBe(50000);
        expect(result.balancePaidAt).toBeDefined();
      });

      it('emits BALANCE_PAYMENT_COMPLETED event', async () => {
        // Arrange
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: 50000,
          status: 'DEPOSIT_PAID',
          email: 'couple@example.com',
          coupleName: 'Jane & John',
          eventDate: '2025-08-15',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act
        await service.completeBalancePayment(tenantId, bookingId, 50000);

        // Assert
        expect(eventEmitter.emittedEvents).toHaveLength(1);
        expect(eventEmitter.emittedEvents[0].event).toBe(BookingEvents.BALANCE_PAYMENT_COMPLETED);
        expect(eventEmitter.emittedEvents[0].payload).toMatchObject({
          bookingId,
          tenantId,
          email: 'couple@example.com',
          coupleName: 'Jane & John',
          eventDate: '2025-08-15',
          balanceAmountCents: 50000,
        });
      });
    });

    describe('idempotency', () => {
      it('handles idempotent completion when balance already paid', async () => {
        // Arrange - booking with balance already completed
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: 50000,
          balancePaidAmount: 50000,
          balancePaidAt: new Date().toISOString(),
          status: 'PAID',
          email: 'couple@example.com',
          coupleName: 'Jane & John',
          eventDate: '2025-08-15',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act
        const result = await service.completeBalancePayment(tenantId, bookingId, 50000);

        // Assert - should return existing booking without error
        expect(result.id).toBe(bookingId);
        expect(result.status).toBe('PAID');
        // Should NOT emit event for idempotent call
        expect(eventEmitter.emittedEvents).toHaveLength(0);
      });

      it('does not emit event on idempotent completion', async () => {
        // Arrange - booking with balance already completed
        const booking = buildBooking({
          id: bookingId,
          totalCents: 100000,
          depositPaidAmount: 50000,
          balancePaidAmount: 50000,
          balancePaidAt: new Date().toISOString(),
          status: 'PAID',
        });
        bookingRepo.addBooking(booking, tenantId);

        // Act
        await service.completeBalancePayment(tenantId, bookingId, 50000);

        // Assert
        expect(eventEmitter.emittedEvents).toHaveLength(0);
      });
    });

    describe('error handling', () => {
      it('throws NotFoundError if booking does not exist', async () => {
        // Act & Assert
        await expect(
          service.completeBalancePayment(tenantId, 'nonexistent_booking', 50000)
        ).rejects.toThrow(NotFoundError);
      });
    });
  });

  // ============================================================================
  // Integration / Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('handles very small deposit percentages correctly', async () => {
      // Arrange
      tenantRepo = createMockTenantRepo({ depositPercent: 1 }); // 1%
      commissionService = createMockCommissionService({
        subtotal: 100000,
        commissionAmount: 10000,
      });
      service = new WeddingDepositService(
        bookingRepo,
        tenantRepo as any,
        commissionService as any,
        eventEmitter
      );

      // Act
      const result = await service.calculateDeposit(tenantId, 100000);

      // Assert
      expect(result.amountToCharge).toBe(1000); // 1% of 100000
      expect(result.depositCommissionAmount).toBe(100); // 1% of 10000
    });

    it('handles 100% deposit correctly', async () => {
      // Arrange
      tenantRepo = createMockTenantRepo({ depositPercent: 100 });
      commissionService = createMockCommissionService({
        subtotal: 100000,
        commissionAmount: 10000,
      });
      service = new WeddingDepositService(
        bookingRepo,
        tenantRepo as any,
        commissionService as any,
        eventEmitter
      );

      // Act
      const result = await service.calculateDeposit(tenantId, 100000);

      // Assert
      expect(result.amountToCharge).toBe(100000); // Full amount
      expect(result.isDeposit).toBe(true);
      expect(result.depositCommissionAmount).toBe(10000); // Full commission
      expect(result.balanceCommissionAmount).toBe(0); // No balance commission
    });

    it('maintains tenant isolation in balance payment', async () => {
      // Arrange - same booking ID but different tenant
      const otherTenantId = 'other_tenant_789';
      const booking = buildBooking({
        id: bookingId,
        totalCents: 100000,
        depositPaidAmount: 50000,
        status: 'DEPOSIT_PAID',
      });
      bookingRepo.addBooking(booking, otherTenantId); // Add to different tenant

      // Act & Assert - should throw because booking not found for our tenant
      await expect(
        service.prepareBalancePayment({
          tenantId, // Our tenant
          bookingId,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
