# Webhook Error Logging Prevention Strategy

## Issue Summary

**P0 Security Vulnerability:** Webhook error logging stored full Zod validation errors (containing customer PII) in the database instead of sanitized error types.

**Impact:** Customer email addresses, personal names, and other sensitive metadata from webhook payloads could leak into the `WebhookEvent.lastError` database column, compromising multi-tenant data isolation.

**Root Cause:** When Zod validation failed, the code called `error.flatten()` which includes all schema field details and validation failure reasons, exposing the exact data that failed validation.

**Current Status:** FIXED in `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts` (lines 183-189, 197-204)

---

## Prevention Strategies

### 1. Adopt Error Type Classification Pattern

**Strategy:** Never log raw validation errors to persistent storage. Always classify errors into safe, abstract types first.

**Pattern:**

```typescript
// Log full details to server logs (ephemeral, for debugging)
logger.error({ errors: result.error.flatten() }, 'Validation failed');

// Store only error type in DB (secure, audit-safe)
await webhookRepo.markFailed(tenantId, eventId, 'Invalid metadata - validation failed');
```

**Why This Works:**

- Server logs are ephemeral and typically rotated/purged
- Database records persist indefinitely and are more likely to be accessed by humans
- Error types (not details) are sufficient for retry logic and monitoring

**When to Apply:**

- All webhook/API event processing
- External API responses
- User input validation errors
- Payment processor responses

---

### 2. Implement Data Sensitivity Audit

**Strategy:** Before storing ANY error message in the database, audit it for PII/sensitive data.

**Checklist:**

- [ ] Does the error message contain email addresses?
- [ ] Does it contain personal names?
- [ ] Does it contain addresses, phone numbers, or IDs?
- [ ] Does it contain payment card info?
- [ ] Does it contain API keys, secrets, or tokens?
- [ ] Could it expose internal system details?

**Pattern:**

```typescript
// Anti-pattern: DON'T do this
await webhookRepo.markFailed(tenantId, eventId, error.message); // ❌ Might contain PII

// Correct pattern: Always sanitize
const safeErrorType = extractErrorType(error); // "Invalid metadata"
await webhookRepo.markFailed(tenantId, eventId, safeErrorType); // ✅
```

**Implementation:**
Create a utility function:

```typescript
export function extractErrorType(error: unknown): string {
  if (error instanceof ZodError) {
    // Don't log flatten(), just the error code
    return 'Validation failed';
  }
  if (error instanceof ValidationError) {
    return 'Schema validation failed';
  }
  if (error instanceof PaymentError) {
    return 'Payment processing failed';
  }
  // Default: hide implementation details
  return 'Processing failed';
}
```

---

### 3. Enforce Error Schema Contracts

**Strategy:** Create explicit contracts for what error information is safe to store in each context.

**Pattern:**

```typescript
// Define what's safe to store in database
interface SafeWebhookError {
  type: 'validation_failed' | 'processing_failed' | 'signature_invalid';
  tenantId: string;
  eventId: string;
  // NO: rawDetails, metadata, payloadSample
  // NO: error.flatten(), error.issues
  // NO: any part of the original request
}

// Type-safe enforcement
async markFailed(tenantId: string, eventId: string, errorType: SafeWebhookError['type']): Promise<void> {
  // Compiler ensures we only pass safe error types
  await prisma.webhookEvent.update({
    where: { tenantId_eventId: { tenantId, eventId } },
    data: { lastError: errorType }
  });
}
```

**Benefits:**

- TypeScript compiler prevents accidental PII storage
- Clear intent: this error type is safe for DB
- Extends to all services with sensitive data

---

### 4. Implement Layered Logging Strategy

**Strategy:** Separate logging by destination: ephemeral (detailed, debugging) vs persistent (safe, audit).

**Pattern:**

```typescript
try {
  const result = ZodSchema.safeParse(data);
  if (!result.success) {
    // LAYER 1: Server logs (ephemeral, detailed, admin-only)
    logger.error(
      {
        errors: result.error.flatten(), // Full details for debugging
        context: 'webhook_validation',
        eventId: event.id,
      },
      'Webhook validation failed'
    );

    // LAYER 2: Database (persistent, safe, limited detail)
    await webhookRepo.markFailed(
      tenantId,
      event.id,
      'Invalid metadata - validation failed' // Abstract type only
    );

    // LAYER 3: Monitoring (metrics-only, no raw data)
    metrics.increment('webhook.validation_failed', {
      eventType: event.type,
      // NO: error details, no payload info
    });

    throw new WebhookValidationError('Invalid metadata');
  }
} catch (error) {
  // ...
}
```

**Why This Works:**

- Debugging capability (layer 1) preserved for developers
- Audit trail (layer 2) remains secure and compliant
- Metrics (layer 3) track patterns without exposing data

---

## Code Review Checklist

Use this checklist when reviewing code that handles external input, webhooks, or error handling:

### Error Handling

- [ ] **No Raw Error Details in DB:** Confirm `error.flatten()`, `error.message`, or `error.toString()` are NOT used in `markFailed()`, `update()`, or other persistent storage calls
- [ ] **No Zod Issues Serialization:** Confirm Zod `.issues` array is not stored or logged to database
- [ ] **No Payload Echoing:** Confirm webhook payloads or request bodies are not echoed in error messages
- [ ] **Error Type Abstract:** Confirm error messages stored in DB use abstract types ("validation failed") not field names ("tenantId is required")

### Webhook Processing

- [ ] **Validation Error Handling:** All `safeParse()` failures log details to server logs (OK) but store only error type in DB (required)
- [ ] **Metadata Validation:** Stripe metadata validation errors do not expose actual metadata in `lastError` field
- [ ] **Signature Verification:** Signature verification failures log safely (no secret keys exposed)
- [ ] **Idempotency Errors:** Idempotency conflict errors don't expose request payloads

### Multi-Tenant Isolation

- [ ] **TenantId in Query:** All error logging includes `tenantId` for proper isolation
- [ ] **Cross-Tenant Audit:** Database schema prevents storing errors without `tenantId` (composite keys)
- [ ] **System Namespace:** Non-tenant-specific errors use 'system' namespace (verified in code)

### Testing

- [ ] **PII Detection Test:** Tests verify error messages do NOT contain email, names, or other PII
- [ ] **Error Type Test:** Tests confirm only abstract error types (not details) are persisted
- [ ] **Zod Error Test:** Specific test for Zod validation errors (most common source of detail leakage)

---

## Detection Patterns

Use these grep patterns to find similar issues:

### 1. Find Zod Error.flatten() Usage

```bash
# Find all uses of .flatten() - flag those going to DB
grep -rn "\.flatten()" server/src --include="*.ts"
```

**Red flags:**

```
logger.error({ errors: sessionResult.error.flatten() }, ...);  // ✅ OK (logs only)
await repo.markFailed(tenantId, id, result.error.flatten());    // ❌ BAD (DB storage)
update({ lastError: result.error.flatten() });                  // ❌ BAD (DB storage)
```

### 2. Find Error Message Storage

```bash
# Find update/create calls storing error messages
grep -rn "lastError\|errorMessage\|errorDetails" server/src --include="*.ts" -A 2 -B 2
```

**Red flags:**

```
markFailed(tenantId, id, error.message)           // ❌ Might contain PII
markFailed(tenantId, id, JSON.stringify(error))   // ❌ Definitely contains PII
update({ lastError: error.toString() })           // ❌ Contains stack trace + details
```

**Good patterns:**

```
markFailed(tenantId, id, 'Validation failed')     // ✅ Abstract type
markFailed(tenantId, id, 'Payment processing failed')  // ✅ Generic type
```

### 3. Find Validation Error Handling

```bash
# Find all Zod schema validation
grep -rn "safeParse\|parse(" server/src --include="*.ts" -A 5 -B 2
```

**Red flags:**

```typescript
const result = schema.safeParse(data);
if (!result.success) {
  await db.update({ error: result.error.flatten() }); // ❌ BAD
}
```

**Good patterns:**

```typescript
const result = schema.safeParse(data);
if (!result.success) {
  logger.error({ errors: result.error.flatten() }, 'Validation failed'); // ✅ Logs only
  await db.update({ error: 'Validation failed' }); // ✅ Type only
}
```

### 4. Find Raw Error Serialization

```bash
# Find error serialization in database contexts
grep -rn "JSON.stringify.*error\|toString().*error" server/src --include="*.ts"
grep -rn "throw new.*Error.*error\." server/src --include="*.ts"
```

---

## Test Case: Webhook Validation Error PII Leak Detection

Add this test to `server/test/security/webhook-pii-leak.security.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WebhooksController } from '../../src/routes/webhooks.routes';
import {
  FakeWebhookRepository,
  FakePaymentProvider,
  FakeBookingRepository,
  FakeCatalogRepository,
  FakeEventEmitter,
} from '../helpers/fakes';
import { BookingService } from '../../src/services/booking.service';
import type Stripe from 'stripe';

describe('Security: Webhook Error Logging - PII Leak Prevention', () => {
  let controller: WebhooksController;
  let webhookRepo: FakeWebhookRepository;
  let paymentProvider: FakePaymentProvider;
  let bookingService: BookingService;

  beforeEach(() => {
    webhookRepo = new FakeWebhookRepository();
    paymentProvider = new FakePaymentProvider();
    const bookingRepo = new FakeBookingRepository();
    const catalogRepo = new FakeCatalogRepository();
    const eventEmitter = new FakeEventEmitter();
    const commissionService = {
      calculateCommission: () => ({ platformFeeCents: 500, vendorPayoutCents: 99500 }),
    };
    const tenantRepo = {
      findById: async () => ({ id: 'test-tenant', stripeAccountId: 'acct_test' }),
    };

    bookingService = new BookingService(
      bookingRepo,
      catalogRepo,
      eventEmitter,
      paymentProvider,
      commissionService,
      tenantRepo
    );
    controller = new WebhooksController(paymentProvider, bookingService, webhookRepo);
  });

  describe('Zod validation errors - email field', () => {
    it('should NOT expose customer email in lastError when validation fails', async () => {
      // Create webhook with invalid email in metadata
      const customerEmail = 'customer@example.com';
      const stripeEvent: Stripe.Event = {
        id: 'evt_test_invalid_email',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_invalid',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_test',
              eventDate: '2025-06-15',
              email: customerEmail, // Invalid: will fail Zod validation
              coupleName: 'Test Couple',
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

      // Mark email as invalid to trigger validation failure
      (stripeEvent.data.object as any).metadata.email = 'not-an-email';

      paymentProvider.verifyWebhook = async () => stripeEvent;

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow();

      // CRITICAL ASSERTION: Verify email is NOT in the stored error
      const failedEvent = webhookRepo.events[0];
      expect(failedEvent?.lastError).toBeDefined();
      expect(failedEvent?.lastError).not.toContain(customerEmail);
      expect(failedEvent?.lastError).not.toMatch(/\S+@\S+\.\S+/); // No email pattern
    });

    it('should NOT expose customer name in lastError when validation fails', async () => {
      const coupleName = 'John & Jane Smith';
      const stripeEvent: Stripe.Event = {
        id: 'evt_test_invalid_name',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_invalid_name',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_test',
              eventDate: '2025-06-15',
              email: 'couple@example.com',
              coupleName: coupleName, // Will fail validation
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

      // Make coupleName invalid (empty)
      (stripeEvent.data.object as any).metadata.coupleName = '';

      paymentProvider.verifyWebhook = async () => stripeEvent;

      await expect(
        controller.handleStripeWebhook(JSON.stringify(stripeEvent), 'valid_signature')
      ).rejects.toThrow();

      // CRITICAL ASSERTION: Verify name is NOT in the stored error
      const failedEvent = webhookRepo.events[0];
      expect(failedEvent?.lastError).toBeDefined();
      expect(failedEvent?.lastError).not.toContain(coupleName);
      expect(failedEvent?.lastError).not.toContain('John');
      expect(failedEvent?.lastError).not.toContain('Smith');
    });

    it('should NOT expose Zod flatten() output in lastError', async () => {
      const stripeEvent: Stripe.Event = {
        id: 'evt_test_zod_details',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_zod',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_test',
              eventDate: '2025-06-15',
              email: 'invalid-email', // Fails validation
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
      ).rejects.toThrow();

      // CRITICAL ASSERTION: Verify lastError is NOT a Zod flatten() output
      const failedEvent = webhookRepo.events[0];
      expect(failedEvent?.lastError).toBeDefined();

      // Zod flatten() produces JSON with "formErrors" and "fieldErrors" keys
      expect(failedEvent?.lastError).not.toContain('fieldErrors');
      expect(failedEvent?.lastError).not.toContain('formErrors');

      // Should be a plain string, not JSON
      expect(() => JSON.parse(failedEvent?.lastError || '')).toThrow();
    });
  });

  describe('Metadata validation errors', () => {
    it('should store abstract error type, not metadata details', async () => {
      const stripeEvent: Stripe.Event = {
        id: 'evt_test_metadata_abstract',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_metadata',
            metadata: {
              tenantId: 'test-tenant',
              packageId: 'pkg_test',
              // Missing required eventDate
              email: 'couple@example.com',
              coupleName: 'Test Couple',
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

      // CRITICAL ASSERTION: Error should be abstract type, not field-level details
      const failedEvent = webhookRepo.events[0];
      expect(failedEvent?.lastError).toBe('Invalid metadata - validation failed');
      expect(failedEvent?.lastError).not.toContain('eventDate');
      expect(failedEvent?.lastError).not.toMatch(/required|missing|invalid field/i);
    });
  });
});
```

Run the test:

```bash
npm test -- test/security/webhook-pii-leak.security.spec.ts
```

All assertions must pass. If any fail, it indicates PII is leaking into the `lastError` field.

---

## Related Files

- `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts` - Fixed implementation
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/webhook.repository.ts` - Safe error storage
- `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/business.ts` - Error class definitions
- `/Users/mikeyoung/CODING/MAIS/server/src/lib/sanitization.ts` - Sanitization utilities
- `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma` - WebhookEvent model (line 453+)

---

## References

- **ADR-003:** Webhook Error Logging (see DECISIONS.md)
- **Multi-Tenant Data Isolation:** docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
- **Security Best Practices:** docs/security/
- **Error Handling Patterns:** CLAUDE.md - "Error Handling Pattern" section

---

## Summary

This prevention strategy ensures that:

1. **Error logging is layered:** Detailed debugging (server logs) vs safe audit trail (database)
2. **PII is never persisted:** Only abstract error types stored in DB
3. **Multi-tenant isolation is maintained:** All errors scoped by tenantId
4. **Code reviews catch violations:** Checklist items and grep patterns for detection
5. **Tests verify compliance:** PII leak detection tests confirm safe practices

Apply these patterns proactively when implementing webhook handlers, API integrations, or any code storing error messages in persistent storage.
