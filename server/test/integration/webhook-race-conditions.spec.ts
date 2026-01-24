/**
 * Integration tests for webhook race conditions
 * Tests concurrent webhook processing and idempotency
 *
 * Setup: Requires test database
 * Run: npm run test:integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaWebhookRepository } from '../../src/adapters/prisma/webhook.repository';
import { WebhooksController } from '../../src/routes/webhooks.routes';
import { BookingService } from '../../src/services/booking.service';
import { PrismaBookingRepository } from '../../src/adapters/prisma/booking.repository';
import { PrismaCatalogRepository } from '../../src/adapters/prisma/catalog.repository';
import { FakeEventEmitter, FakePaymentProvider, buildMockConfig } from '../helpers/fakes';
import { CommissionService } from '../../src/services/commission.service';
import { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import type Stripe from 'stripe';
import { setupCompleteIntegrationTest } from '../helpers/integration-setup';

describe.sequential('Webhook Race Conditions - Integration Tests', () => {
  const ctx = setupCompleteIntegrationTest('webhook-race');
  let webhookRepo: PrismaWebhookRepository;
  let bookingRepo: PrismaBookingRepository;
  let catalogRepo: PrismaCatalogRepository;
  let bookingService: BookingService;
  let webhooksController: WebhooksController;
  let paymentProvider: FakePaymentProvider;
  let eventEmitter: FakeEventEmitter;
  let testTenantId: string;
  let testPackageId: string;
  let testPackageSlug: string;
  let tenantRepo: PrismaTenantRepository;

  beforeEach(async () => {
    // Setup tenant
    await ctx.tenants.cleanupTenants();
    await ctx.tenants.tenantA.create();
    testTenantId = ctx.tenants.tenantA.id;

    // Initialize repositories
    webhookRepo = new PrismaWebhookRepository(ctx.prisma);
    bookingRepo = new PrismaBookingRepository(ctx.prisma);
    catalogRepo = new PrismaCatalogRepository(ctx.prisma);
    tenantRepo = new PrismaTenantRepository(ctx.prisma);

    // Initialize fakes
    eventEmitter = new FakeEventEmitter();
    paymentProvider = new FakePaymentProvider();

    // Initialize services
    const commissionService = new CommissionService(catalogRepo);
    bookingService = new BookingService({
      bookingRepo,
      catalogRepo,
      eventEmitter,
      paymentProvider,
      commissionService,
      tenantRepo,
      idempotencyService: {
        generateCheckoutKey: () => 'test_key',
        checkAndStore: async () => true,
        getStoredResponse: async () => null,
        updateResponse: async () => {},
      } as any,
      config: buildMockConfig(),
    });

    webhooksController = new WebhooksController(paymentProvider, bookingService, webhookRepo);

    // Create test package using catalog repository
    const pkg = ctx.factories.package.create({ title: 'Test Package Webhook', priceCents: 250000 });
    const createdPkg = await catalogRepo.createPackage(testTenantId, pkg);
    testPackageId = createdPkg.id;
    testPackageSlug = createdPkg.slug;
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  /**
   * Helper to create a mock Stripe event
   */
  function createMockStripeEvent(eventId: string, eventDate: string): Stripe.Event {
    return {
      id: eventId,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_test_${eventId}`,
          object: 'checkout.session',
          amount_total: 250000,
          metadata: {
            tenantId: testTenantId,
            packageId: testPackageSlug, // Use slug, not database ID
            eventDate,
            email: `test-${eventId}@example.com`,
            coupleName: `Test Couple ${eventId}`,
            addOnIds: JSON.stringify([]),
          },
        } as any,
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: null,
        idempotency_key: null,
      },
    } as Stripe.Event;
  }

  describe('Duplicate Webhook Prevention', () => {
    it('should prevent duplicate webhook processing', async () => {
      const eventId = 'evt_duplicate_test_001';
      const eventDate = '2025-06-01';

      // Create mock webhook payload
      const stripeEvent = createMockStripeEvent(eventId, eventDate);
      const rawBody = JSON.stringify(stripeEvent);
      const signature = 'test_signature';

      // Mock payment provider to return the event
      paymentProvider.verifyWebhook = async () => stripeEvent;

      // Act: Process same webhook twice concurrently
      const results = await Promise.allSettled([
        webhooksController.handleStripeWebhook(rawBody, signature),
        webhooksController.handleStripeWebhook(rawBody, signature),
      ]);

      // Assert: Both should succeed (idempotency)
      expect(results[0]?.status).toBe('fulfilled');
      expect(results[1]?.status).toBe('fulfilled');

      // Verify only one booking was created
      const bookings = await ctx.prisma.booking.findMany({
        where: { tenantId: testTenantId, date: new Date(eventDate) },
      });
      expect(bookings).toHaveLength(1);

      // Verify webhook was recorded with proper status
      const webhookEvents = await ctx.prisma.webhookEvent.findMany({
        where: { tenantId: testTenantId, eventId },
      });
      expect(webhookEvents).toHaveLength(1);

      // Status should be either PROCESSED or DUPLICATE
      expect(['PROCESSED', 'DUPLICATE']).toContain(webhookEvents[0]?.status);
    });

    it('should handle high-concurrency duplicate webhooks (10 simultaneous)', async () => {
      const eventId = 'evt_high_concurrency_001';
      const eventDate = '2025-06-15';

      const stripeEvent = createMockStripeEvent(eventId, eventDate);
      const rawBody = JSON.stringify(stripeEvent);
      const signature = 'test_signature';

      paymentProvider.verifyWebhook = async () => stripeEvent;

      // Act: Process same webhook 10 times concurrently
      const requests = Array.from({ length: 10 }, () =>
        webhooksController.handleStripeWebhook(rawBody, signature)
      );

      const results = await Promise.allSettled(requests);

      // Assert: All should complete without throwing
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThan(0);

      // Verify only one booking was created
      const bookings = await ctx.prisma.booking.findMany({
        where: { tenantId: testTenantId, date: new Date(eventDate) },
      });
      expect(bookings).toHaveLength(1);

      // Verify webhook events
      const webhookEvents = await ctx.prisma.webhookEvent.findMany({
        where: { tenantId: testTenantId, eventId },
      });
      expect(webhookEvents).toHaveLength(1);
    });

    it('should detect duplicates at repository level', async () => {
      const eventId = 'evt_repo_duplicate_001';

      // Check for duplicate before recording (should be false)
      const isDupe0 = await webhookRepo.isDuplicate(testTenantId, eventId);
      expect(isDupe0).toBe(false);

      // Record webhook first time
      await webhookRepo.recordWebhook({
        tenantId: testTenantId,
        eventId,
        eventType: 'checkout.session.completed',
        rawPayload: JSON.stringify({ test: 'data' }),
      });

      // Check for duplicate after recording (should be true)
      const isDupe1 = await webhookRepo.isDuplicate(testTenantId, eventId);
      expect(isDupe1).toBe(true);

      // Try to record again (should return false for duplicate, not throw)
      const isNew = await webhookRepo.recordWebhook({
        tenantId: testTenantId,
        eventId,
        eventType: 'checkout.session.completed',
        rawPayload: JSON.stringify({ test: 'data' }),
      });
      expect(isNew).toBe(false); // Duplicate detected

      // Verify only one record exists (second call was gracefully ignored)
      const events = await ctx.prisma.webhookEvent.findMany({
        where: { tenantId: testTenantId, eventId },
      });
      expect(events).toHaveLength(1);

      // Status should be DUPLICATE (from isDuplicate call)
      expect(events[0]?.status).toBe('DUPLICATE');
    });

    it('should handle concurrent isDuplicate checks', async () => {
      const eventId = 'evt_concurrent_check_001';

      // Record webhook
      await webhookRepo.recordWebhook({
        tenantId: testTenantId,
        eventId,
        eventType: 'checkout.session.completed',
        rawPayload: JSON.stringify({ test: 'data' }),
      });

      // Check for duplicates concurrently
      const checks = await Promise.all([
        webhookRepo.isDuplicate(testTenantId, eventId),
        webhookRepo.isDuplicate(testTenantId, eventId),
        webhookRepo.isDuplicate(testTenantId, eventId),
        webhookRepo.isDuplicate(testTenantId, eventId),
        webhookRepo.isDuplicate(testTenantId, eventId),
      ]);

      // All should return true
      expect(checks.every((c) => c === true)).toBe(true);

      // Verify status is DUPLICATE
      const event = await ctx.prisma.webhookEvent.findUnique({
        where: { tenantId_eventId: { tenantId: testTenantId, eventId } },
      });
      expect(event?.status).toBe('DUPLICATE');
    });
  });

  describe('Race Conditions with Booking Creation', () => {
    it('should prevent double-booking from concurrent webhooks', async () => {
      const eventDate = '2025-07-01';
      const event1Id = 'evt_concurrent_booking_001';
      const event2Id = 'evt_concurrent_booking_002';

      const stripeEvent1 = createMockStripeEvent(event1Id, eventDate);
      const stripeEvent2 = createMockStripeEvent(event2Id, eventDate);

      const rawBody1 = JSON.stringify(stripeEvent1);
      const rawBody2 = JSON.stringify(stripeEvent2);
      const signature = 'test_signature';

      // Mock payment provider to return event based on rawBody content
      // Note: verifyWebhook is called twice per request (route + processor)
      // so we can't use a simple counter
      paymentProvider.verifyWebhook = async (rawBody: string) => {
        const parsed = JSON.parse(rawBody);
        return parsed.id === event1Id ? stripeEvent1 : stripeEvent2;
      };

      // Act: Process two different webhooks for same date concurrently
      const results = await Promise.allSettled([
        webhooksController.handleStripeWebhook(rawBody1, signature),
        webhooksController.handleStripeWebhook(rawBody2, signature),
      ]);

      // Assert: One should succeed, one should fail
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Verify only one booking was created
      const bookings = await ctx.prisma.booking.findMany({
        where: { tenantId: testTenantId, date: new Date(eventDate) },
      });
      expect(bookings).toHaveLength(1);

      // Verify both webhooks were recorded
      const webhookEvents = await ctx.prisma.webhookEvent.findMany({
        where: {
          tenantId: testTenantId,
          eventId: {
            in: [event1Id, event2Id],
          },
        },
      });
      expect(webhookEvents).toHaveLength(2);

      // One should be PROCESSED, one should be FAILED
      const statuses = webhookEvents.map((e) => e.status).sort();
      expect(statuses).toContain('PROCESSED');
      expect(statuses).toContain('FAILED');
    });

    it('should handle rapid sequential webhook processing', async () => {
      const eventDate = '2025-07-15';
      let successCount = 0;
      let failureCount = 0;

      // Process 5 webhooks sequentially for same date
      for (let i = 0; i < 5; i++) {
        const eventId = `evt_sequential_${i}`;
        const stripeEvent = createMockStripeEvent(eventId, eventDate);
        const rawBody = JSON.stringify(stripeEvent);
        const signature = 'test_signature';

        paymentProvider.verifyWebhook = async () => stripeEvent;

        try {
          await webhooksController.handleStripeWebhook(rawBody, signature);
          successCount++;
        } catch (error) {
          failureCount++;
        }
      }

      // Assert: Only one should succeed
      expect(successCount).toBe(1);
      expect(failureCount).toBe(4);

      // Verify only one booking exists
      const bookings = await ctx.prisma.booking.findMany({
        where: { tenantId: testTenantId, date: new Date(eventDate) },
      });
      expect(bookings).toHaveLength(1);

      // Verify all webhooks were recorded (query by specific eventIds, not time window)
      const webhookEvents = await ctx.prisma.webhookEvent.findMany({
        where: {
          tenantId: testTenantId,
          eventId: {
            in: Array.from({ length: 5 }, (_, i) => `evt_sequential_${i}`),
          },
        },
      });
      expect(webhookEvents).toHaveLength(5);
    });
  });

  describe('Idempotency Guarantees', () => {
    it('should return success for already-processed webhook', async () => {
      const eventId = 'evt_already_processed_001';
      const eventDate = '2025-08-01';

      const stripeEvent = createMockStripeEvent(eventId, eventDate);
      const rawBody = JSON.stringify(stripeEvent);
      const signature = 'test_signature';

      paymentProvider.verifyWebhook = async () => stripeEvent;

      // Process webhook first time
      await webhooksController.handleStripeWebhook(rawBody, signature);

      // Mark as processed
      await webhookRepo.markProcessed(testTenantId, eventId);

      // Process again (should return early without error)
      await expect(
        webhooksController.handleStripeWebhook(rawBody, signature)
      ).resolves.toBeUndefined();

      // Verify still only one booking
      const bookings = await ctx.prisma.booking.findMany({
        where: { tenantId: testTenantId, date: new Date(eventDate) },
      });
      expect(bookings).toHaveLength(1);

      // Verify webhook status remains PROCESSED (not changed to DUPLICATE)
      const event = await ctx.prisma.webhookEvent.findUnique({
        where: { tenantId_eventId: { tenantId: testTenantId, eventId } },
      });
      expect(event?.status).toBe('PROCESSED');
    });

    it('should handle webhook retries from Stripe gracefully', async () => {
      const eventId = 'evt_retry_001';
      const eventDate = '2025-08-15';

      const stripeEvent = createMockStripeEvent(eventId, eventDate);
      const rawBody = JSON.stringify(stripeEvent);
      const signature = 'test_signature';

      paymentProvider.verifyWebhook = async () => stripeEvent;

      // Simulate Stripe retry: Process webhook 3 times with delays
      await webhooksController.handleStripeWebhook(rawBody, signature);

      await new Promise((resolve) => setTimeout(resolve, 100));
      await webhooksController.handleStripeWebhook(rawBody, signature);

      await new Promise((resolve) => setTimeout(resolve, 100));
      await webhooksController.handleStripeWebhook(rawBody, signature);

      // Verify only one booking created
      const bookings = await ctx.prisma.booking.findMany({
        where: { tenantId: testTenantId, date: new Date(eventDate) },
      });
      expect(bookings).toHaveLength(1);

      // Verify webhook event exists
      const event = await ctx.prisma.webhookEvent.findUnique({
        where: { tenantId_eventId: { tenantId: testTenantId, eventId } },
      });
      expect(event).not.toBeNull();
      expect(['PROCESSED', 'DUPLICATE']).toContain(event?.status);
    });

    it('should maintain idempotency across different date bookings', async () => {
      // Process webhooks for different dates sequentially - all should succeed
      // Note: We process sequentially to avoid transaction timeouts under concurrent load.
      // The system's idempotency guarantees are tested separately in concurrent tests.
      const dates = ['2025-09-01', '2025-09-02', '2025-09-03'];

      // Create all events upfront
      const events = dates.map((date, i) => {
        const eventId = `evt_different_dates_${i}`;
        return {
          eventId,
          stripeEvent: createMockStripeEvent(eventId, date),
          date,
        };
      });

      // Mock verifyWebhook to return the correct event based on the raw body
      const eventMap = new Map(events.map((e) => [e.stripeEvent.id, e.stripeEvent]));
      paymentProvider.verifyWebhook = async (rawBody: string) => {
        const parsed = JSON.parse(rawBody);
        return eventMap.get(parsed.id) || parsed;
      };

      // Process all webhooks sequentially to avoid transaction contention
      for (const { stripeEvent } of events) {
        const rawBody = JSON.stringify(stripeEvent);
        const signature = 'test_signature';
        await webhooksController.handleStripeWebhook(rawBody, signature);
      }

      // Verify 3 bookings created
      const bookings = await ctx.prisma.booking.findMany({
        where: {
          tenantId: testTenantId,
          date: {
            in: dates.map((d) => new Date(d)),
          },
        },
      });
      expect(bookings).toHaveLength(3);

      // Verify 3 webhooks recorded
      const webhookEvents = await ctx.prisma.webhookEvent.findMany({
        where: {
          tenantId: testTenantId,
          eventType: 'checkout.session.completed',
          status: 'PROCESSED',
        },
      });
      expect(webhookEvents.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Webhook Status Transitions', () => {
    it('should transition from PENDING to PROCESSED on success', async () => {
      const eventId = 'evt_status_transition_001';
      const eventDate = '2025-10-01';

      const stripeEvent = createMockStripeEvent(eventId, eventDate);
      const rawBody = JSON.stringify(stripeEvent);
      const signature = 'test_signature';

      paymentProvider.verifyWebhook = async () => stripeEvent;

      // Process webhook
      await webhooksController.handleStripeWebhook(rawBody, signature);

      // Verify status transition
      const event = await ctx.prisma.webhookEvent.findUnique({
        where: { tenantId_eventId: { tenantId: testTenantId, eventId } },
      });
      expect(event?.status).toBe('PROCESSED');
      expect(event?.processedAt).not.toBeNull();
    });

    it('should transition from PENDING to FAILED on booking error', async () => {
      const eventId = 'evt_status_failure_001';
      const eventDate = '2025-10-15';
      const uniqueEmail = `preexisting-${Date.now()}@example.com`;

      // Pre-create a booking for this date to cause conflict
      await ctx.prisma.booking.create({
        data: {
          id: `pre-existing-booking-${Date.now()}`,
          tenant: {
            connect: { id: testTenantId },
          },
          package: {
            connect: { id: testPackageId },
          },
          date: new Date(eventDate),
          totalPrice: 250000,
          status: 'CONFIRMED',
          customer: {
            create: {
              email: uniqueEmail,
              name: 'Pre Existing',
              tenant: {
                connect: { id: testTenantId },
              },
            },
          },
        },
      });

      const stripeEvent = createMockStripeEvent(eventId, eventDate);
      const rawBody = JSON.stringify(stripeEvent);
      const signature = 'test_signature';

      paymentProvider.verifyWebhook = async () => stripeEvent;

      // Process webhook (should fail due to date conflict)
      await expect(webhooksController.handleStripeWebhook(rawBody, signature)).rejects.toThrow();

      // Verify status is FAILED
      const event = await ctx.prisma.webhookEvent.findUnique({
        where: { tenantId_eventId: { tenantId: testTenantId, eventId } },
      });
      expect(event?.status).toBe('FAILED');
      expect(event?.lastError).toBeTruthy();
      expect(event?.processedAt).toBeNull();
    });

    it('should handle concurrent status updates', async () => {
      const eventId = 'evt_concurrent_status_001';

      // Record webhook
      await webhookRepo.recordWebhook({
        tenantId: testTenantId,
        eventId,
        eventType: 'checkout.session.completed',
        rawPayload: JSON.stringify({ test: 'data' }),
      });

      // Try to mark as processed and failed concurrently
      const results = await Promise.allSettled([
        webhookRepo.markProcessed(testTenantId, eventId),
        webhookRepo.markFailed(testTenantId, eventId, 'Test error'),
      ]);

      // Both should complete
      expect(results[0]?.status).toBe('fulfilled');
      expect(results[1]?.status).toBe('fulfilled');

      // Final status should be one of them
      const event = await ctx.prisma.webhookEvent.findUnique({
        where: { tenantId_eventId: { tenantId: testTenantId, eventId } },
      });
      expect(['PROCESSED', 'FAILED']).toContain(event?.status);
    });
  });

  describe('Edge Cases', () => {
    it('should handle webhook with invalid booking data', async () => {
      const eventId = 'evt_invalid_data_001';

      // Create event with invalid package ID
      const stripeEvent: Stripe.Event = {
        id: eventId,
        object: 'event',
        api_version: '2023-10-16',
        created: Math.floor(Date.now() / 1000),
        type: 'checkout.session.completed',
        data: {
          object: {
            id: `cs_test_${eventId}`,
            object: 'checkout.session',
            amount_total: 250000,
            metadata: {
              tenantId: testTenantId,
              packageId: 'invalid-package-id',
              eventDate: '2025-11-01',
              email: 'invalid@example.com',
              coupleName: 'Invalid Test',
              addOnIds: '[]',
            },
          } as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: null,
          idempotency_key: null,
        },
      } as Stripe.Event;

      const rawBody = JSON.stringify(stripeEvent);
      const signature = 'test_signature';

      paymentProvider.verifyWebhook = async () => stripeEvent;

      // Should fail
      await expect(webhooksController.handleStripeWebhook(rawBody, signature)).rejects.toThrow();

      // Verify webhook was recorded as FAILED
      const event = await ctx.prisma.webhookEvent.findUnique({
        where: { tenantId_eventId: { tenantId: testTenantId, eventId } },
      });
      expect(event?.status).toBe('FAILED');
    });

    it('should handle very rapid webhook bursts', async () => {
      const eventId = 'evt_burst_test_001';
      const eventDate = '2025-11-15';

      const stripeEvent = createMockStripeEvent(eventId, eventDate);
      const rawBody = JSON.stringify(stripeEvent);
      const signature = 'test_signature';

      paymentProvider.verifyWebhook = async () => stripeEvent;

      // Fire 20 requests as fast as possible
      const requests = Array.from({ length: 20 }, () =>
        webhooksController.handleStripeWebhook(rawBody, signature)
      );

      const results = await Promise.allSettled(requests);

      // All should complete (some may succeed, some may return early for duplicates)
      expect(results.length).toBe(20);

      // Only one booking should exist
      const bookings = await ctx.prisma.booking.findMany({
        where: { tenantId: testTenantId, date: new Date(eventDate) },
      });
      expect(bookings).toHaveLength(1);
    });
  });
});
