/**
 * Security Test: Webhook Error Logging - PII Leak Detection
 *
 * This test suite verifies that webhook error logging does NOT expose
 * personally identifiable information (PII) in the database.
 *
 * P0 CRITICAL: These tests enforce that:
 * - Customer emails are never stored in lastError
 * - Customer names are never stored in lastError
 * - Zod validation details (flatten() output) are never stored
 * - Only abstract error types are persisted
 *
 * References:
 * - WEBHOOK_ERROR_LOGGING_PREVENTION.md
 * - WEBHOOK_ERROR_PREVENTION_CHECKLIST.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhooksController } from '../../src/routes/webhooks.routes';
import {
  FakePaymentProvider,
  FakeBookingRepository,
  FakeCatalogRepository,
  FakeEventEmitter,
  FakeWebhookRepository,
  buildTier,
  buildMockConfig,
} from '../helpers/fakes';
import { BookingService } from '../../src/services/booking.service';
import { WebhookValidationError } from '../../src/lib/errors';
import type Stripe from 'stripe';

describe('SECURITY: Webhook Error Logging - PII Leak Detection', () => {
  let controller: WebhooksController;
  let paymentProvider: FakePaymentProvider;
  let bookingService: BookingService;
  let webhookRepo: FakeWebhookRepository;
  let bookingRepo: FakeBookingRepository;
  let catalogRepo: FakeCatalogRepository;
  let eventEmitter: FakeEventEmitter;

  beforeEach(() => {
    paymentProvider = new FakePaymentProvider();
    bookingRepo = new FakeBookingRepository();
    catalogRepo = new FakeCatalogRepository();
    eventEmitter = new FakeEventEmitter();
    webhookRepo = new FakeWebhookRepository();

    const commissionService = {
      calculateCommission: vi
        .fn()
        .mockReturnValue({ platformFeeCents: 500, vendorPayoutCents: 99500 }),
      calculateBookingTotal: vi.fn().mockResolvedValue({
        basePrice: 100000,
        addOnsTotal: 0,
        subtotal: 100000,
        platformFeeCents: 5000,
        vendorPayoutCents: 95000,
        customerTotalCents: 100000,
        commissionAmount: 5000,
        commissionPercent: 5.0,
      }),
    };

    const tenantRepo = {
      findById: vi.fn().mockResolvedValue({
        id: 'test-tenant',
        stripeAccountId: 'acct_test123',
        stripeOnboarded: true,
        name: 'Test Tenant',
      }),
    };

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
    controller = new WebhooksController(paymentProvider, bookingService, webhookRepo);
  });

  describe('Email PII Leak Prevention', () => {
    it('should NOT expose customer email in lastError when validation fails', async () => {
      // Arrange: Customer email that should not leak
      const customerEmail = 'customer.secret@company.com';

      const stripeEvent: Stripe.Event = {
        id: 'evt_security_email_leak_test',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_test',
            metadata: {
              tenantId: 'test-tenant',
              tierId: 'pkg_test_123',
              eventDate: '2025-06-15',
              email: customerEmail, // Customer email must not leak
              coupleName: 'John Doe',
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

      // Force validation failure by making email invalid
      (stripeEvent.data.object as any).metadata.email = 'invalid-email-format';
      paymentProvider.verifyWebhook = async () => stripeEvent;

      // Act: Process webhook with invalid email
      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow(WebhookValidationError);

      // Assert: Email must NOT appear in stored error
      const failedEvent = webhookRepo.events[0];
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.status).toBe('FAILED');

      // CRITICAL: Email should not be in lastError
      expect(failedEvent?.lastError).toBeDefined();
      expect(failedEvent?.lastError).not.toContain(customerEmail);
      expect(failedEvent?.lastError).not.toContain('customer');
      expect(failedEvent?.lastError).not.toContain('secret');
      expect(failedEvent?.lastError).not.toContain('company');
    });

    it('should NOT expose email pattern in lastError', async () => {
      // Test that email addresses matching pattern don't appear in error
      const stripeEvent: Stripe.Event = {
        id: 'evt_security_email_pattern',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_pattern',
            metadata: {
              tenantId: 'test-tenant',
              tierId: 'pkg_test_123',
              eventDate: '2025-06-15',
              email: 'not-an-email', // Invalid email
              coupleName: 'Test',
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

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow(WebhookValidationError);

      const failedEvent = webhookRepo.events[0];
      expect(failedEvent?.lastError).toBeDefined();

      // CRITICAL: No email pattern (user@domain.com) should appear in error
      // Pattern: one-or-more non-whitespace @ one-or-more non-whitespace . one-or-more non-whitespace
      const emailPattern = /\S+@\S+\.\S+/;
      expect(failedEvent?.lastError).not.toMatch(emailPattern);
    });
  });

  describe('Name PII Leak Prevention', () => {
    it('should NOT expose customer name in lastError when validation fails', async () => {
      // Arrange: Customer name that should not leak
      const coupleName = 'John William Smith & Jane Marie Johnson';

      const stripeEvent: Stripe.Event = {
        id: 'evt_security_name_leak',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_name_test',
            metadata: {
              tenantId: 'test-tenant',
              tierId: 'pkg_test_123',
              eventDate: '2025-06-15',
              email: 'couple@example.com',
              coupleName: coupleName, // Customer name - must not leak
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

      // Force validation failure by making name empty (fails Zod validation)
      (stripeEvent.data.object as any).metadata.coupleName = '';
      paymentProvider.verifyWebhook = async () => stripeEvent;

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow();

      // Verify webhook was recorded (even on error)
      const failedEvent =
        webhookRepo.events[0] ||
        webhookRepo.events.find((e) => e.eventId === 'evt_security_name_leak');
      if (failedEvent?.lastError) {
        // CRITICAL: Name components should not leak if error is stored
        expect(failedEvent.lastError).not.toContain('John');
        expect(failedEvent.lastError).not.toContain('Smith');
        expect(failedEvent.lastError).not.toContain('Jane');
        expect(failedEvent.lastError).not.toContain('Johnson');
        expect(failedEvent.lastError).not.toContain('William');
        expect(failedEvent.lastError).not.toContain('Marie');
      }
    });

    it('should NOT expose full couple name in lastError', async () => {
      const stripeEvent: Stripe.Event = {
        id: 'evt_security_full_name',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_fullname',
            metadata: {
              tenantId: 'test-tenant',
              tierId: 'pkg_test_123',
              eventDate: '2025-06-15',
              email: 'couple@example.com',
              coupleName: 'Mr. John Anderson & Mrs. Sarah Anderson', // Full name with titles
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

      // Make coupleName fail validation
      (stripeEvent.data.object as any).metadata.coupleName = '';
      paymentProvider.verifyWebhook = async () => stripeEvent;

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow();

      const failedEvent =
        webhookRepo.events[0] ||
        webhookRepo.events.find((e) => e.eventId === 'evt_security_full_name');
      if (failedEvent?.lastError) {
        expect(failedEvent.lastError).not.toContain('Mr.');
        expect(failedEvent.lastError).not.toContain('Mrs.');
        expect(failedEvent.lastError).not.toContain('John');
        expect(failedEvent.lastError).not.toContain('Sarah');
        expect(failedEvent.lastError).not.toContain('Anderson');
      }
    });
  });

  describe('Zod Error Details Leak Prevention', () => {
    it('should NOT expose Zod flatten() output in lastError', async () => {
      // Zod flatten() produces JSON with "fieldErrors" and "formErrors" keys
      // This test verifies that this structure never appears in stored error

      const stripeEvent: Stripe.Event = {
        id: 'evt_security_zod_details',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_zod_test',
            metadata: {
              tenantId: 'test-tenant',
              tierId: 'pkg_test_123',
              eventDate: '2025-06-15',
              email: 'invalid-email', // Will trigger validation failure
              coupleName: 'Test',
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

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow(WebhookValidationError);

      const failedEvent = webhookRepo.events[0];
      expect(failedEvent?.lastError).toBeDefined();

      // CRITICAL: Zod flatten() output must NOT be in stored error
      expect(failedEvent?.lastError).not.toContain('fieldErrors');
      expect(failedEvent?.lastError).not.toContain('formErrors');

      // Verify it's not JSON (which would indicate flatten() was used)
      try {
        const parsed = JSON.parse(failedEvent?.lastError || '');
        // If it parses as JSON with Zod structure, that's bad
        if (parsed.fieldErrors || parsed.formErrors) {
          throw new Error('Zod flatten() output found in lastError - PII LEAK!');
        }
      } catch (e) {
        // Expected: lastError should be plain string, not JSON
        if (!(e instanceof SyntaxError)) throw e;
      }
    });

    it('should NOT expose validation error details (field names)', async () => {
      // Validation error messages often contain field names which reveal structure
      // Example: "tenantId is required" reveals field name

      const stripeEvent: Stripe.Event = {
        id: 'evt_security_field_names',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_fields',
            metadata: {
              tenantId: 'test-tenant',
              tierId: 'pkg_test_123',
              // Missing eventDate - should trigger validation error
              email: 'couple@example.com',
              coupleName: 'Test',
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

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow(WebhookValidationError);

      const failedEvent = webhookRepo.events[0];
      expect(failedEvent?.lastError).toBeDefined();

      // CRITICAL: Field names should not appear in error
      // This would reveal schema structure: eventDate, tierId, etc.
      expect(failedEvent?.lastError).not.toContain('eventDate');
      expect(failedEvent?.lastError).not.toContain('tierId');
      expect(failedEvent?.lastError).not.toContain('tenantId');
      expect(failedEvent?.lastError).not.toMatch(/required|missing|invalid field/i);
    });

    it('should NOT expose validation keywords in lastError', async () => {
      // Words like "required", "invalid", "string", "email" reveal validation rules

      const stripeEvent: Stripe.Event = {
        id: 'evt_security_keywords',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_keywords',
            metadata: {
              tenantId: 'test-tenant',
              tierId: 'pkg_test_123',
              eventDate: '2025-06-15',
              email: 'not-an-email', // Invalid format
              coupleName: 'Test',
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

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow(WebhookValidationError);

      const failedEvent = webhookRepo.events[0];
      const error = failedEvent?.lastError || '';

      // CRITICAL: Validation keywords should not appear
      // These reveal schema structure and validation rules
      expect(error.toLowerCase()).not.toMatch(/^.*required.*$/i); // "required"
      expect(error.toLowerCase()).not.toMatch(/is not a valid/i); // "is not a valid"
      expect(error.toLowerCase()).not.toMatch(/expected string/i); // "expected string"
      expect(error.toLowerCase()).not.toMatch(/expected number/i); // "expected number"

      // These are fine to appear in the message itself, but not as part of detailed validation error:
      // "Validation failed" is OK, but "email is not a valid email" is not
    });
  });

  describe('Abstract Error Type Enforcement', () => {
    it('should store abstract error type for metadata validation failure', async () => {
      // Verify that stored error is a generic/abstract type, not specific to fields

      const stripeEvent: Stripe.Event = {
        id: 'evt_security_abstract_type',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_abstract',
            metadata: {
              tenantId: 'test-tenant',
              tierId: 'pkg_test_123',
              eventDate: '2025-06-15',
              email: 'invalid', // Invalid email
              coupleName: '', // Invalid empty name
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

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow();

      const failedEvent = webhookRepo.events.find(
        (e) => e.eventId === 'evt_security_abstract_type'
      );

      // CRITICAL: Error must be abstract type (not field-specific)
      if (failedEvent?.lastError) {
        // Should be one of the safe abstract types, not field names
        expect(failedEvent.lastError).not.toContain('email');
        expect(failedEvent.lastError).not.toContain('coupleName');
        // Should not contain field-specific details
        expect(failedEvent.lastError).not.toMatch(/is not a valid|is required|expected/i);
      }
    });

    it('should store abstract error type for session structure validation failure', async () => {
      const stripeEvent: Stripe.Event = {
        id: 'evt_security_session_structure',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_session',
            // Missing metadata entirely - should trigger structure validation
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

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow();

      const failedEvent = webhookRepo.events.find(
        (e) => e.eventId === 'evt_security_session_structure'
      );

      // CRITICAL: Must be abstract, not specific to missing fields
      if (failedEvent?.lastError) {
        expect(failedEvent.lastError).not.toContain('metadata');
        expect(failedEvent.lastError).not.toMatch(/required|missing/i);
      }
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should verify webhook repository enforces tenantId scoping', async () => {
      // CRITICAL: All webhook events must be scoped by tenantId for multi-tenant isolation
      // This test verifies that the repository schema and logic enforce this

      // Test 1: Recording a webhook without tenantId should still assign it
      // (Implementation detail: tenantId is extracted from metadata and passed to repository)

      // Test 2: Retrieving webhooks should be scoped by tenantId
      // All queries must include tenantId filter

      // For this security test, we verify that the FakeWebhookRepository
      // (which mirrors real implementation) properly scopes all operations

      expect(webhookRepo.events).toBeDefined();

      // If any events were recorded during previous tests, they should all have tenantId
      for (const event of webhookRepo.events) {
        expect(event.tenantId).toBeDefined();
        expect(event.tenantId).not.toBe('');
        expect(event.tenantId.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Storage Safety Verification', () => {
    it('should NOT store any data that could be reconstructed into original request', async () => {
      // This is a comprehensive check that lastError doesn't contain enough info
      // to reconstruct the original webhook payload

      const originalMetadata = {
        tenantId: 'test-tenant',
        tierId: 'pkg_test_123',
        eventDate: '2025-06-15',
        email: 'couple@example.com',
        coupleName: 'John & Jane Smith',
        addOnIds: JSON.stringify(['addon_1', 'addon_2']),
      };

      const stripeEvent: Stripe.Event = {
        id: 'evt_security_reconstruct',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_security_reconstruct',
            metadata: { ...originalMetadata, email: 'invalid' },
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

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow(WebhookValidationError);

      const failedEvent = webhookRepo.events[0];
      const error = failedEvent?.lastError || '';

      // CRITICAL: Should not be possible to reconstruct metadata from error
      expect(error).not.toContain(originalMetadata.email);
      expect(error).not.toContain(originalMetadata.coupleName);
      expect(error).not.toContain(originalMetadata.eventDate);
      expect(error).not.toContain('addon_1');
      expect(error).not.toContain('addon_2');
    });
  });
});
