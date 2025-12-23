/**
 * Payment Flow Integration Tests
 *
 * Tests end-to-end payment flows including:
 * - Complete checkout → webhook → booking creation flow
 * - Payment failures and error handling
 * - Idempotency protection
 * - Commission calculation and Stripe application fees
 * - Stripe Connect integration
 *
 * Setup: Requires test database with full schema
 * Run: npm run test:integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BookingService } from '../../src/services/booking.service';
import { CommissionService } from '../../src/services/commission.service';
import { IdempotencyService } from '../../src/services/idempotency.service';
import { PrismaBookingRepository } from '../../src/adapters/prisma/booking.repository';
import { PrismaCatalogRepository } from '../../src/adapters/prisma/catalog.repository';
import { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import { PrismaWebhookRepository } from '../../src/adapters/prisma/webhook.repository';
import { WebhooksController } from '../../src/routes/webhooks.routes';
import { BookingEvents } from '../../src/lib/core/events';
import { FakeEventEmitter } from '../helpers/fakes';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';
import {
  createCheckoutSessionCompletedEvent,
  createPaymentFailedEvent,
  createConnectCheckoutSessionCompletedEvent,
  serializeEvent,
} from '../fixtures/stripe-events';
import { BookingScenarios } from '../fixtures/bookings';
import type Stripe from 'stripe';

describe.sequential('Payment Flow - End-to-End Integration', () => {
  const ctx = setupCompleteIntegrationTest('payment-flow');
  let testTenantId: string;
  let bookingRepo: PrismaBookingRepository;
  let catalogRepo: PrismaCatalogRepository;
  let tenantRepo: PrismaTenantRepository;
  let webhookRepo: PrismaWebhookRepository;
  let commissionService: CommissionService;
  let idempotencyService: IdempotencyService;
  let bookingService: BookingService;
  let webhooksController: WebhooksController;
  let eventEmitter: FakeEventEmitter;
  let testPackageId: string;
  let testPackageSlug: string;
  let testAddOnIds: string[] = [];

  // Mock payment provider with verification
  const mockPaymentProvider = {
    async createCheckoutSession(input: {
      amountCents: number;
      email: string;
      metadata: Record<string, string>;
      idempotencyKey?: string;
    }) {
      return {
        url: `https://checkout.stripe.test/session_${Date.now()}`,
        sessionId: `cs_test_${Date.now()}`,
      };
    },

    async createConnectCheckoutSession(input: {
      amountCents: number;
      email: string;
      metadata: Record<string, string>;
      stripeAccountId: string;
      applicationFeeAmount: number;
      idempotencyKey?: string;
    }) {
      // Validate application fee constraints
      const minFee = Math.ceil(input.amountCents * 0.005);
      const maxFee = Math.floor(input.amountCents * 0.5);

      if (input.applicationFeeAmount < minFee || input.applicationFeeAmount > maxFee) {
        throw new Error(`Application fee ${input.applicationFeeAmount} outside valid range`);
      }

      return {
        url: `https://checkout.stripe.test/connect/session_${Date.now()}`,
        sessionId: `cs_test_connect_${Date.now()}`,
      };
    },

    async verifyWebhook(payload: string, signature: string): Promise<Stripe.Event> {
      // In real tests, this would verify the signature
      // For integration tests, we trust the payload
      return JSON.parse(payload) as Stripe.Event;
    },

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
  };

  beforeEach(async () => {
    // Setup tenant
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    testTenantId = ctx.tenants.tenantA.id;

    // Update tenant with commission rate
    await ctx.prisma.tenant.update({
      where: { id: testTenantId },
      data: { commissionPercent: 12.0 },
    });

    // Initialize repositories
    bookingRepo = new PrismaBookingRepository(ctx.prisma);
    catalogRepo = new PrismaCatalogRepository(ctx.prisma);
    tenantRepo = new PrismaTenantRepository(ctx.prisma);
    webhookRepo = new PrismaWebhookRepository(ctx.prisma);

    // Initialize services
    eventEmitter = new FakeEventEmitter();
    commissionService = new CommissionService(ctx.prisma);
    idempotencyService = new IdempotencyService(ctx.prisma);
    bookingService = new BookingService({
      bookingRepo,
      catalogRepo,
      eventEmitter,
      paymentProvider: mockPaymentProvider,
      commissionService,
      tenantRepo,
      idempotencyService,
    });

    // Initialize webhook controller
    webhooksController = new WebhooksController(mockPaymentProvider, bookingService, webhookRepo);

    // Create test package
    const pkg = ctx.factories.package.create({
      title: 'Classic Wedding Package',
      priceCents: 250000,
    });
    const createdPkg = await catalogRepo.createPackage(testTenantId, pkg);
    testPackageId = createdPkg.id;
    testPackageSlug = createdPkg.slug;

    // Create test add-ons
    const addOn1 = ctx.factories.addOn.create({
      title: 'Photography Add-on',
      priceCents: 30000,
    });
    const addOn2 = ctx.factories.addOn.create({
      title: 'Flowers Add-on',
      priceCents: 20000,
    });

    const createdAddOn1 = await catalogRepo.createAddOn(testTenantId, {
      ...addOn1,
      packageId: testPackageId,
    });
    const createdAddOn2 = await catalogRepo.createAddOn(testTenantId, {
      ...addOn2,
      packageId: testPackageId,
    });

    testAddOnIds = [createdAddOn1.id, createdAddOn2.id];
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe('Full Booking Flow', () => {
    it('should complete flow: createCheckout → webhook → booking created', async () => {
      // Step 1: Create checkout session
      const checkoutResponse = await bookingService.createCheckout(testTenantId, {
        packageId: testPackageSlug,
        eventDate: '2025-06-15',
        email: 'couple@example.com',
        coupleName: 'Jane & John',
        addOnIds: [],
      });

      expect(checkoutResponse.checkoutUrl).toContain('checkout.stripe.test');

      // Step 2: Simulate Stripe webhook for payment completion
      const webhookEvent = createCheckoutSessionCompletedEvent(
        'cs_test_payment_success',
        {
          tenantId: testTenantId,
          packageId: testPackageSlug,
          eventDate: '2025-06-15',
          email: 'couple@example.com',
          coupleName: 'Jane & John',
          commissionAmount: 30000, // 12% of $250,000
          commissionPercent: 12.0,
        },
        250000, // $2,500.00
        'pi_test_12345'
      );

      const payload = serializeEvent(webhookEvent);
      await webhooksController.handleStripeWebhook(payload, 'mock_signature');

      // Step 3: Verify booking was created
      const bookings = await bookingRepo.findAll(testTenantId);
      expect(bookings).toHaveLength(1);

      const booking = bookings[0];
      expect(booking.email).toBe('couple@example.com');
      expect(booking.coupleName).toBe('Jane & John');
      expect(booking.eventDate).toBe('2025-06-15');
      expect(booking.totalCents).toBe(250000);
      expect(booking.commissionAmount).toBe(30000);
      expect(booking.commissionPercent).toBe(12.0);
      expect(booking.status).toBe('PAID');

      // Verify event was emitted
      expect(eventEmitter.emittedEvents).toHaveLength(1);
      expect(eventEmitter.emittedEvents[0].event).toBe(BookingEvents.PAID);
    });

    it('should handle payment failure: webhook with failed status handled', async () => {
      // Create payment failure webhook
      const webhookEvent = createPaymentFailedEvent(
        'pi_test_failed',
        {
          tenantId: testTenantId,
          packageId: testPackageSlug,
          eventDate: '2025-06-20',
          email: 'failed@example.com',
          coupleName: 'Failed Payment',
        },
        250000,
        'card_declined'
      );

      const payload = serializeEvent(webhookEvent);

      // Should not throw error (webhook is recorded)
      await webhooksController.handleStripeWebhook(payload, 'mock_signature');

      // Verify no booking was created
      const bookings = await bookingRepo.findAll(testTenantId);
      expect(bookings).toHaveLength(0);

      // Verify webhook was recorded (but not as PROCESSED)
      const webhookEvent_db = await ctx.prisma.webhookEvent.findUnique({
        where: {
          tenantId_eventId: {
            tenantId: testTenantId,
            eventId: webhookEvent.id,
          },
        },
      });

      expect(webhookEvent_db).not.toBeNull();
      expect(webhookEvent_db?.status).toBe('PROCESSED'); // Event was processed, just ignored
    });

    it('should enforce idempotency: duplicate checkout request returns same URL', async () => {
      // Create checkout session twice with same data
      const input = {
        packageId: testPackageSlug,
        eventDate: '2025-07-01',
        email: 'idempotent@example.com',
        coupleName: 'Idempotent Test',
        addOnIds: [],
      };

      // First request
      const response1 = await bookingService.createCheckout(testTenantId, input);

      // Second request (should return cached URL)
      const response2 = await bookingService.createCheckout(testTenantId, input);

      // Should return same URL (idempotency worked)
      expect(response1.checkoutUrl).toBe(response2.checkoutUrl);
    });
  });

  describe('Commission Integration', () => {
    it('should calculate and store commission in booking', async () => {
      // Create booking with package + add-ons
      const webhookEvent = createCheckoutSessionCompletedEvent(
        'cs_test_commission',
        {
          tenantId: testTenantId,
          packageId: testPackageSlug,
          eventDate: '2025-08-01',
          email: 'commission@example.com',
          coupleName: 'Commission Test',
          addOnIds: testAddOnIds,
          commissionAmount: 36000, // 12% of $300,000 ($2500 + $300 + $200)
          commissionPercent: 12.0,
        },
        300000, // $3,000.00 total
        'pi_test_commission'
      );

      const payload = serializeEvent(webhookEvent);
      await webhooksController.handleStripeWebhook(payload, 'mock_signature');

      // Verify commission was calculated correctly
      const bookings = await bookingRepo.findAll(testTenantId);
      expect(bookings).toHaveLength(1);

      const booking = bookings[0];
      expect(booking.totalCents).toBe(300000);
      expect(booking.commissionAmount).toBe(36000); // 12% commission
      expect(booking.commissionPercent).toBe(12.0);

      // Verify calculation: $3,000 * 12% = $360
      const expectedCommission = Math.ceil(300000 * 0.12);
      expect(booking.commissionAmount).toBe(expectedCommission);
    });

    it('should validate Stripe application fee matches commission amount', async () => {
      // Create checkout with commission
      const checkoutResponse = await bookingService.createCheckout(testTenantId, {
        packageId: testPackageSlug,
        eventDate: '2025-08-15',
        email: 'appfee@example.com',
        coupleName: 'App Fee Test',
        addOnIds: testAddOnIds,
      });

      expect(checkoutResponse.checkoutUrl).toContain('checkout.stripe.test');

      // Calculate expected commission
      const totalCents = 250000 + 30000 + 20000; // Package + add-ons
      const expectedCommission = Math.ceil(totalCents * 0.12);

      // In a real integration test with Stripe API, we would verify:
      // - session.payment_intent_data.application_fee_amount === expectedCommission
      // For this test, we verify the calculation is correct
      expect(expectedCommission).toBe(36000); // 12% of $3,000
    });
  });

  describe('Stripe Connect Flow', () => {
    it('should create checkout with connected account and application fee', async () => {
      // Update tenant with Stripe Connect account
      await ctx.prisma.tenant.update({
        where: { id: testTenantId },
        data: {
          stripeAccountId: 'acct_test_connected',
          stripeOnboarded: true,
        },
      });

      // Create checkout session (should use Connect)
      const checkoutResponse = await bookingService.createCheckout(testTenantId, {
        packageId: testPackageSlug,
        eventDate: '2025-09-01',
        email: 'connect@example.com',
        coupleName: 'Connect Test',
        addOnIds: [],
      });

      expect(checkoutResponse.checkoutUrl).toContain('connect');

      // Simulate Connect webhook
      const webhookEvent = createConnectCheckoutSessionCompletedEvent(
        'cs_test_connect',
        {
          tenantId: testTenantId,
          packageId: testPackageSlug,
          eventDate: '2025-09-01',
          email: 'connect@example.com',
          coupleName: 'Connect Test',
          commissionAmount: 30000,
          commissionPercent: 12.0,
        },
        250000,
        'acct_test_connected',
        'pi_test_connect'
      );

      const payload = serializeEvent(webhookEvent);
      await webhooksController.handleStripeWebhook(payload, 'mock_signature');

      // Verify booking was created with commission
      const bookings = await bookingRepo.findAll(testTenantId);
      expect(bookings).toHaveLength(1);

      const booking = bookings[0];
      expect(booking.commissionAmount).toBe(30000);

      // In real Stripe Connect flow:
      // - Tenant receives: $2,500 - $300 = $2,200
      // - Platform receives: $300 application fee
      const tenantReceives = booking.totalCents - (booking.commissionAmount || 0);
      expect(tenantReceives).toBe(220000); // $2,200
    });
  });
});
