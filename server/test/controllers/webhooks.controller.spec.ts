/**
 * Unit tests for WebhooksController
 * Tests webhook processing, idempotency, error handling, and validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhooksController } from '../../src/routes/webhooks.routes';
import { BookingEvents } from '../../src/lib/core/events';
import {
  FakePaymentProvider,
  FakeBookingRepository,
  FakeCatalogRepository,
  FakeEventEmitter,
  FakeWebhookRepository,
  buildPackage,
} from '../helpers/fakes';
import { BookingService } from '../../src/services/booking.service';
import {
  WebhookDuplicateError,
  WebhookValidationError
} from '../../src/lib/errors';
import type Stripe from 'stripe';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let paymentProvider: FakePaymentProvider;
  let bookingService: BookingService;
  let webhookRepo: FakeWebhookRepository;
  let bookingRepo: FakeBookingRepository;
  let catalogRepo: FakeCatalogRepository;
  let eventEmitter: FakeEventEmitter;
  let commissionService: any;
  let tenantRepo: any;

  beforeEach(() => {
    paymentProvider = new FakePaymentProvider();
    bookingRepo = new FakeBookingRepository();
    catalogRepo = new FakeCatalogRepository();
    eventEmitter = new FakeEventEmitter();
    webhookRepo = new FakeWebhookRepository();

    // Create simple mocks for multi-tenancy dependencies
    commissionService = {
      calculateCommission: vi.fn().mockReturnValue({ platformFeeCents: 500, vendorPayoutCents: 99500 }),
      calculateBookingTotal: vi.fn().mockResolvedValue({
        basePrice: 100000,
        addOnsTotal: 0,
        subtotal: 100000,
        platformFeeCents: 5000,
        vendorPayoutCents: 95000,
        customerTotalCents: 100000,
        commissionAmount: 5000,
        commissionPercent: 5.0
      })
    };

    tenantRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'test-tenant',
        stripeAccountId: 'acct_test123',
        stripeOnboarded: true,
        name: 'Test Tenant'
      })
    };

    bookingService = new BookingService(bookingRepo, catalogRepo, eventEmitter, paymentProvider, commissionService, tenantRepo);
    controller = new WebhooksController(paymentProvider, bookingService, webhookRepo);
  });

  describe('handleStripeWebhook', () => {
    it('should process valid checkout.session.completed webhook', async () => {
      // Arrange: Add package to catalog
      const pkg = buildPackage({ id: 'pkg_test_123', slug: 'pkg_test_123', priceCents: 100000 });
      catalogRepo.addPackage(pkg);

      // Mock Stripe event
      const stripeEvent: Stripe.Event = {
        id: 'evt_test_123',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_123',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_test_123',
              eventDate: '2025-06-15',
              email: 'couple@example.com',
              coupleName: 'John & Jane',
            },
            amount_total: 100000,
          } as unknown as Stripe.CheckoutSession,
        },
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      // Mock payment provider to return the event
      paymentProvider.verifyWebhook = async () => stripeEvent;

      const rawBody = JSON.stringify(stripeEvent);

      // Act
      await controller.handleStripeWebhook(rawBody, 'valid_signature');

      // Assert: Booking created
      const bookings = await bookingRepo.findAll();
      expect(bookings.length).toBe(1);
      expect(bookings[0]?.eventDate).toBe('2025-06-15');
      expect(bookings[0]?.email).toBe('couple@example.com');
      expect(bookings[0]?.status).toBe('PAID');
    });

    it('should ignore duplicate webhook gracefully (idempotency)', async () => {
      // Arrange: Process webhook first time
      const pkg = buildPackage({ id: 'pkg_dup_test', slug: 'pkg_dup_test', priceCents: 100000 });
      catalogRepo.addPackage(pkg);

      const stripeEvent: Stripe.Event = {
        id: 'evt_test_duplicate',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_dup',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_dup_test',
              eventDate: '2025-06-20',
              email: 'couple@example.com',
              coupleName: 'John & Jane',
            },
            amount_total: 100000,
          } as unknown as Stripe.CheckoutSession,
        },
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      paymentProvider.verifyWebhook = async () => stripeEvent;
      const rawBody = JSON.stringify(stripeEvent);

      // Process first time
      await controller.handleStripeWebhook(rawBody, 'valid_signature');

      const bookingsAfterFirst = await bookingRepo.findAll();
      expect(bookingsAfterFirst.length).toBe(1);

      // Act: Process same webhook again (duplicate) - should not throw
      await expect(
        controller.handleStripeWebhook(rawBody, 'valid_signature')
      ).resolves.toBeUndefined();

      // Assert: Still only one booking (webhook deduplication prevented second booking)
      const bookingsAfterDuplicate = await bookingRepo.findAll();
      expect(bookingsAfterDuplicate.length).toBe(1);

      // Webhook should be recorded only once
      expect(webhookRepo.events.length).toBe(1);
      expect(webhookRepo.events[0]?.status).toBe('PROCESSED');
    });

    it('should throw WebhookValidationError on invalid signature', async () => {
      // Arrange: Mock payment provider to reject invalid signature
      paymentProvider.verifyWebhook = async () => {
        throw new Error('Invalid signature');
      };

      const rawBody = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' });

      // Act & Assert
      await expect(
        controller.handleStripeWebhook(rawBody, 'invalid_signature')
      ).rejects.toThrow(WebhookValidationError);

      await expect(
        controller.handleStripeWebhook(rawBody, 'invalid_signature')
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should handle malformed metadata gracefully', async () => {
      // Arrange: Event with missing required metadata fields
      const stripeEvent: Stripe.Event = {
        id: 'evt_test_malformed',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_malformed',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_malformed',
              // Missing eventDate, email, coupleName
            },
            amount_total: 100000,
          } as unknown as Stripe.CheckoutSession,
        },
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      paymentProvider.verifyWebhook = async () => stripeEvent;
      const rawBody = JSON.stringify(stripeEvent);

      // Act & Assert: Should throw validation error
      await expect(
        controller.handleStripeWebhook(rawBody, 'valid_signature')
      ).rejects.toThrow(WebhookValidationError);

      // Webhook should be recorded but marked as FAILED (validation error)
      expect(webhookRepo.events.length).toBe(1);
      expect(webhookRepo.events[0]?.status).toBe('FAILED');
      expect(webhookRepo.events[0]?.lastError).toContain('Invalid session structure');
    });

    it('should handle database failure and mark webhook as failed', async () => {
      // Arrange
      const pkg = buildPackage({ id: 'pkg_db_test', slug: 'pkg_db_test', priceCents: 100000 });
      catalogRepo.addPackage(pkg);

      // Mock repository to throw error
      bookingRepo.create = async () => {
        throw new Error('Database connection failed');
      };

      const stripeEvent: Stripe.Event = {
        id: 'evt_test_db_fail',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_db',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_db_test',
              eventDate: '2025-07-01',
              email: 'couple@example.com',
              coupleName: 'John & Jane',
            },
            amount_total: 100000,
          } as unknown as Stripe.CheckoutSession,
        },
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      paymentProvider.verifyWebhook = async () => stripeEvent;
      const rawBody = JSON.stringify(stripeEvent);

      // Act & Assert: Should throw WebhookProcessingError
      await expect(
        controller.handleStripeWebhook(rawBody, 'valid_signature')
      ).rejects.toThrow('Webhook processing failed');

      // Webhook should be marked as failed
      expect(webhookRepo.events.length).toBe(1);
      expect(webhookRepo.events[0]?.status).toBe('FAILED');
      expect(webhookRepo.events[0]?.lastError).toContain('Database connection failed');
    });

    it('should ignore unknown event types without error', async () => {
      // Arrange: Unknown event type
      const stripeEvent: Stripe.Event = {
        id: 'evt_test_unknown',
        object: 'event',
        type: 'payment_intent.succeeded', // Different event type
        data: {
          object: {} as Stripe.PaymentIntent,
        },
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      paymentProvider.verifyWebhook = async () => stripeEvent;
      const rawBody = JSON.stringify(stripeEvent);

      // Act: Should not throw
      await expect(
        controller.handleStripeWebhook(rawBody, 'valid_signature')
      ).resolves.toBeUndefined();

      // Assert: No bookings created
      const bookings = await bookingRepo.findAll();
      expect(bookings.length).toBe(0);
    });

    it('should process webhook with add-ons correctly', async () => {
      // Arrange
      const pkg = buildPackage({ id: 'pkg_addon_test', slug: 'pkg_addon_test', priceCents: 100000 });
      catalogRepo.addPackage(pkg);
      catalogRepo.addAddOn({
        id: 'addon_1',
        packageId: 'pkg_addon_test',
        title: 'Extra Hour',
        priceCents: 20000
      });

      const stripeEvent: Stripe.Event = {
        id: 'evt_test_addons',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_addons',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_addon_test',
              eventDate: '2025-08-01',
              email: 'couple@example.com',
              coupleName: 'John & Jane',
              addOnIds: JSON.stringify(['addon_1']),
            },
            amount_total: 120000, // 100000 + 20000
          } as unknown as Stripe.CheckoutSession,
        },
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      paymentProvider.verifyWebhook = async () => stripeEvent;
      const rawBody = JSON.stringify(stripeEvent);

      // Act
      await controller.handleStripeWebhook(rawBody, 'valid_signature');

      // Assert
      const bookings = await bookingRepo.findAll();
      expect(bookings.length).toBe(1);
      expect(bookings[0]?.addOnIds).toEqual(['addon_1']);
      expect(bookings[0]?.totalCents).toBe(120000);
    });

    it('should emit BookingPaid event after successful processing', async () => {
      // Arrange
      const pkg = buildPackage({ id: 'pkg_event_test', slug: 'pkg_event_test', priceCents: 100000, title: 'Basic Package' });
      catalogRepo.addPackage(pkg);

      const stripeEvent: Stripe.Event = {
        id: 'evt_test_event_emission',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_event',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_event_test',
              eventDate: '2025-09-01',
              email: 'couple@example.com',
              coupleName: 'John & Jane',
            },
            amount_total: 100000,
          } as unknown as Stripe.CheckoutSession,
        },
        api_version: '2023-10-16',
        created: Date.now(),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      };

      paymentProvider.verifyWebhook = async () => stripeEvent;
      const rawBody = JSON.stringify(stripeEvent);

      // Act
      await controller.handleStripeWebhook(rawBody, 'valid_signature');

      // Assert: Event emitted
      expect(eventEmitter.emittedEvents.length).toBe(1);
      expect(eventEmitter.emittedEvents[0]?.event).toBe(BookingEvents.PAID);
      expect(eventEmitter.emittedEvents[0]?.payload).toMatchObject({
        email: 'couple@example.com',
        coupleName: 'John & Jane',
        eventDate: '2025-09-01',
        packageTitle: 'Basic Package',
      });
    });
  });
});
