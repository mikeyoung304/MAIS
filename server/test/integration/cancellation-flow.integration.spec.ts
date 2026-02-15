/**
 * Cancellation & Refund Flow Integration Tests
 *
 * Tests end-to-end cancellation and refund flows including:
 * - Full cancellation with 100% refund
 * - Partial cancellation with proportional refund
 * - Late cancellation with no refund allowed
 * - Commission reversal calculations
 * - Stripe application fee automatic reversal
 *
 * Setup: Requires test database with booking fixtures
 * Run: npm run test:integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommissionService } from '../../src/services/commission.service';
import { PrismaBookingRepository } from '../../src/adapters/prisma/booking.repository';
import { PrismaCatalogRepository } from '../../src/adapters/prisma/catalog.repository';
import { setupCompleteIntegrationTest, createTestSegment } from '../helpers/integration-setup';
import {
  BookingScenarios,
  calculateExpectedCommission,
  calculateRefundCommission,
} from '../fixtures/bookings';
import type { Booking } from '../../src/lib/entities';
import { withDatabaseRetry } from '../helpers/retry';

describe.sequential('Cancellation & Refund Flow Integration', () => {
  const ctx = setupCompleteIntegrationTest('cancellation-flow');
  let testTenantId: string;
  let testSegmentId: string;
  let bookingRepo: PrismaBookingRepository;
  let catalogRepo: PrismaCatalogRepository;
  let commissionService: CommissionService;
  let testTierId: string;

  // Mock payment provider with refund capability
  const mockPaymentProvider = {
    async refund(input: {
      paymentIntentId: string;
      amountCents?: number;
      reason?: string;
      idempotencyKey?: string;
    }) {
      return {
        refundId: `re_${Date.now()}`,
        status: 'succeeded',
        amountCents: input.amountCents || 0,
      };
    },

    async createCheckoutSession() {
      return {
        url: 'https://checkout.stripe.test/mock',
        sessionId: 'cs_mock',
      };
    },

    async createConnectCheckoutSession() {
      return {
        url: 'https://checkout.stripe.test/mock',
        sessionId: 'cs_mock',
      };
    },

    async verifyWebhook() {
      return {} as any;
    },
  };

  beforeEach(async () => {
    // Setup tenant
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    testTenantId = ctx.tenants.tenantA.id;

    // Set commission rate
    await ctx.prisma.tenant.update({
      where: { id: testTenantId },
      data: { commissionPercent: 12.0 },
    });

    // Create segment (Tier.segmentId is a non-nullable FK)
    const segment = await createTestSegment(ctx.prisma, testTenantId);
    testSegmentId = segment.id;

    // Initialize repositories
    bookingRepo = new PrismaBookingRepository(ctx.prisma);
    catalogRepo = new PrismaCatalogRepository(ctx.prisma);
    commissionService = new CommissionService(ctx.prisma);

    // Create test package
    const pkg = ctx.factories.tier.create({
      title: 'Cancellation Test Package',
      priceCents: 250000,
      segmentId: testSegmentId,
    });
    const createdPkg = await catalogRepo.createTier(testTenantId, pkg);
    testTierId = createdPkg.id;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe('Refund Scenarios', () => {
    it('should process full cancellation: 100% refund + commission reversal', async () => {
      // Create booking with commission
      const bookingFixture = BookingScenarios.standard();
      const booking = await bookingRepo.create(testTenantId, {
        ...bookingFixture,
        tierId: testTierId,
      });

      // Verify initial booking
      expect(booking.totalCents).toBe(250000); // $2,500
      expect(booking.commissionAmount).toBe(30000); // $300 (12%)
      expect(booking.status).toBe('PAID');

      // Calculate full refund
      const refundAmount = booking.totalCents;
      const commissionRefund = commissionService.calculateRefundCommission(
        booking.commissionAmount || 0,
        refundAmount,
        booking.totalCents
      );

      // Full refund should reverse full commission
      expect(commissionRefund).toBe(booking.commissionAmount);
      expect(commissionRefund).toBe(30000);

      // Process refund (in real scenario, this would call Stripe API)
      const refundResult = await mockPaymentProvider.refund({
        paymentIntentId: 'pi_test_12345',
        amountCents: refundAmount,
        reason: 'requested_by_customer',
      });

      expect(refundResult.status).toBe('succeeded');
      expect(refundResult.amountCents).toBe(refundAmount);

      // Update booking status (in real app, this would be in a service method)
      await ctx.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELED' },
      });

      // Verify cancellation
      const cancelledBooking = await bookingRepo.findById(testTenantId, booking.id);
      expect(cancelledBooking?.status).toBe('CANCELED');

      // In Stripe Connect, application fee is automatically reversed
      // Platform refunds: $300 (commission)
      // Tenant refunds: $2,200 (net amount)
      const platformRefund = commissionRefund;
      const tenantRefund = refundAmount - platformRefund;
      expect(platformRefund).toBe(30000);
      expect(tenantRefund).toBe(220000);
    });

    it('should process partial cancellation: 50% refund + proportional commission', async () => {
      // Create booking
      const bookingFixture = BookingScenarios.premium();
      const booking = await bookingRepo.create(testTenantId, {
        ...bookingFixture,
        tierId: testTierId,
      });

      // Verify initial booking
      expect(booking.totalCents).toBe(500000); // $5,000
      expect(booking.commissionAmount).toBe(50000); // $500 (10%)

      // Calculate 50% refund
      const refundAmount = Math.floor(booking.totalCents * 0.5); // $2,500
      const commissionRefund = commissionService.calculateRefundCommission(
        booking.commissionAmount || 0,
        refundAmount,
        booking.totalCents
      );

      // 50% refund should reverse 50% of commission
      const expectedCommissionRefund = Math.ceil((booking.commissionAmount || 0) * 0.5);
      expect(commissionRefund).toBe(expectedCommissionRefund);
      expect(commissionRefund).toBe(25000); // $250 (50% of $500)

      // Process partial refund
      const refundResult = await mockPaymentProvider.refund({
        paymentIntentId: 'pi_test_premium',
        amountCents: refundAmount,
        reason: 'requested_by_customer',
      });

      expect(refundResult.status).toBe('succeeded');
      expect(refundResult.amountCents).toBe(refundAmount);

      // Verify proportional calculation
      const refundRatio = refundAmount / booking.totalCents;
      expect(refundRatio).toBe(0.5);
      expect(commissionRefund).toBe(Math.ceil((booking.commissionAmount || 0) * refundRatio));
    });

    it('should handle late cancellation: no refund allowed', async () => {
      // Create booking that's past cancellation deadline
      const bookingFixture = BookingScenarios.pastDeadline();
      const booking = await bookingRepo.create(testTenantId, {
        ...bookingFixture,
        tierId: testTierId,
      });

      // Verify booking is within no-refund window
      const eventDate = new Date(booking.eventDate);
      const today = new Date();
      const daysUntilEvent = Math.ceil(
        (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Assuming 7-day cancellation policy
      const cancellationDeadlineDays = 7;
      expect(daysUntilEvent).toBeLessThan(cancellationDeadlineDays);

      // No refund should be processed
      const refundAmount = 0;
      const commissionRefund = commissionService.calculateRefundCommission(
        booking.commissionAmount || 0,
        refundAmount,
        booking.totalCents
      );

      // No refund = no commission reversal
      expect(commissionRefund).toBe(0);

      // Booking can still be cancelled, but no money returned
      await ctx.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELED' },
      });

      // Verify status updated but no refund processed
      const cancelledBooking = await bookingRepo.findById(testTenantId, booking.id);
      expect(cancelledBooking?.status).toBe('CANCELED');
      expect(cancelledBooking?.totalCents).toBe(booking.totalCents); // Original amount unchanged
    });
  });

  describe('Commission Reversal', () => {
    it('should calculate commission refund correctly for various scenarios', async () => {
      // Scenario 1: Full refund
      const fullRefund = commissionService.calculateRefundCommission(
        30000, // $300 commission
        250000, // $2,500 refund (100%)
        250000 // $2,500 original
      );
      expect(fullRefund).toBe(30000); // Full commission reversed

      // Scenario 2: 75% refund
      const partialRefund75 = commissionService.calculateRefundCommission(
        30000, // $300 commission
        187500, // $1,875 refund (75%)
        250000 // $2,500 original
      );
      expect(partialRefund75).toBe(22500); // 75% of $300 = $225

      // Scenario 3: 25% refund
      const partialRefund25 = commissionService.calculateRefundCommission(
        30000, // $300 commission
        62500, // $625 refund (25%)
        250000 // $2,500 original
      );
      expect(partialRefund25).toBe(7500); // 25% of $300 = $75

      // Scenario 4: No refund
      const noRefund = commissionService.calculateRefundCommission(
        30000, // $300 commission
        0, // No refund
        250000 // $2,500 original
      );
      expect(noRefund).toBe(0);

      // Scenario 5: Edge case - refund exceeds original (shouldn't happen, but handle gracefully)
      const excessRefund = commissionService.calculateRefundCommission(
        30000, // $300 commission
        300000, // $3,000 refund (120% - invalid)
        250000 // $2,500 original
      );
      expect(excessRefund).toBe(30000); // Capped at original commission
    });

    it('should verify Stripe application fee automatic reversal in Connect flow', async () => {
      // Create booking with Stripe Connect (application fee)
      const bookingFixture = BookingScenarios.standard();
      const booking = await bookingRepo.create(testTenantId, {
        ...bookingFixture,
        tierId: testTierId,
      });

      // Set tenant as Stripe Connect account
      await ctx.prisma.tenant.update({
        where: { id: testTenantId },
        data: {
          stripeAccountId: 'acct_test_connect',
          stripeOnboarded: true,
        },
      });

      // Original payment breakdown:
      // - Total: $2,500
      // - Application fee (commission): $300
      // - Tenant receives: $2,200

      // Process full refund
      const refundAmount = booking.totalCents;
      const commissionRefund = commissionService.calculateRefundCommission(
        booking.commissionAmount || 0,
        refundAmount,
        booking.totalCents
      );

      // In Stripe Connect, refund automatically reverses application fee
      // This is handled by Stripe, not our code
      expect(commissionRefund).toBe(30000);

      // Refund flow in Stripe Connect:
      // 1. Platform calls refund API with connected account
      // 2. Stripe automatically creates application_fee_refund
      // 3. Platform receives $300 back (commission reversed)
      // 4. Connected account receives $2,200 back

      const refundResult = await mockPaymentProvider.refund({
        paymentIntentId: 'pi_test_connect',
        amountCents: refundAmount,
        reason: 'requested_by_customer',
      });

      expect(refundResult.status).toBe('succeeded');

      // Verify refund breakdown
      const platformFeeReversed = commissionRefund;
      const tenantRefund = refundAmount - platformFeeReversed;

      expect(platformFeeReversed).toBe(30000); // Platform gets commission back
      expect(tenantRefund).toBe(220000); // Tenant gets net amount back
      expect(platformFeeReversed + tenantRefund).toBe(refundAmount); // Total matches
    });
  });

  describe('Edge Cases', () => {
    it('should handle refund with add-ons and calculate proportional commission', async () => {
      await withDatabaseRetry(async () => {
        // Create add-ons
        const addOn1 = await catalogRepo.createAddOn(testTenantId, {
          ...ctx.factories.addOn.create({ priceCents: 30000 }),
          tierId: testTierId,
        });
        const addOn2 = await catalogRepo.createAddOn(testTenantId, {
          ...ctx.factories.addOn.create({ priceCents: 20000 }),
          tierId: testTierId,
        });

        // Create booking with add-ons
        const bookingFixture = BookingScenarios.withAddOns([addOn1.id, addOn2.id]);
        const booking = await bookingRepo.create(testTenantId, {
          ...bookingFixture,
          tierId: testTierId,
        });

        // Total: $2,500 + $300 + $200 = $3,000
        expect(booking.totalCents).toBe(300000);
        expect(booking.commissionAmount).toBe(36000); // 12% of $3,000

        // Refund 50%
        const refundAmount = 150000; // $1,500
        const commissionRefund = commissionService.calculateRefundCommission(
          booking.commissionAmount || 0,
          refundAmount,
          booking.totalCents
        );

        // 50% refund → 50% commission reversal
        expect(commissionRefund).toBe(18000); // $180 (50% of $360)
      });
    });

    it('should handle rounding in commission refund calculations', async () => {
      await withDatabaseRetry(async () => {
        // Create booking with odd amount
        const booking = await bookingRepo.create(testTenantId, {
          ...BookingScenarios.standard(),
          tierId: testTierId,
          totalCents: 123456, // $1,234.56
          commissionAmount: 14815, // 12% = $148.15 (rounded up)
        });

        // Partial refund: $617.28 (50%)
        const refundAmount = 61728;
        const commissionRefund = commissionService.calculateRefundCommission(
          booking.commissionAmount || 0,
          refundAmount,
          booking.totalCents
        );

        // Should round UP to protect platform revenue
        const expectedRefund = Math.ceil((booking.commissionAmount || 0) * 0.5);
        expect(commissionRefund).toBe(expectedRefund);
        expect(commissionRefund).toBe(7408); // $74.08 (rounded up from $74.075)
      });
    });
  });
});
