# Todo Tests Catalog - MAIS Platform

## Summary

Found **12 todo tests** in the codebase, all located in a single test file.

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts`

**Test Framework:** Vitest with supertest for HTTP integration testing

---

## Complete Todo Test Inventory

### Category 1: Signature Verification (3 tests)

#### 1. Webhook Signature Validation - Missing Header

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:36-44`
- **Test Name:** "should reject webhook without signature header"
- **Feature Area:** Stripe webhook security - authentication
- **Expected Behavior:**
  - POST to `/v1/webhooks/stripe` without `stripe-signature` header
  - Should return HTTP 400
  - Response should indicate signature missing
- **Implementation Hints:**
  - Use supertest to make HTTP POST request
  - Omit the `stripe-signature` header
  - Validate error message contains "signature"
  - Test payload: `{ type: 'checkout.session.completed', data: {} }`
- **Complexity:** Simple
- **Related Tests:** Tests 2, 3 (signature verification suite)
- **Error Handling:** WebhookValidationError should map to 400 response

#### 2. Webhook Signature Validation - Invalid Signature

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:46-55`
- **Test Name:** "should reject webhook with invalid signature"
- **Feature Area:** Stripe webhook security - signature verification
- **Expected Behavior:**
  - POST to `/v1/webhooks/stripe` with invalid signature header value
  - Should return HTTP 401 (Unauthorized)
  - Response should indicate "Invalid signature"
  - Payload should NOT be processed
- **Implementation Hints:**
  - Use supertest with `stripe-signature: 'invalid_signature'`
  - Send valid JSON payload structure
  - PaymentProvider.verifyWebhook() should throw error
  - Verify no database records created
- **Complexity:** Simple
- **Related Tests:** Tests 1, 3 (signature verification suite)
- **Key Code:** WebhooksController.handleStripeWebhook() lines 117-122

#### 3. Webhook Signature Validation - Valid Signature

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:57-72`
- **Test Name:** "should accept webhook with valid signature"
- **Feature Area:** Stripe webhook security - successful validation
- **Expected Behavior:**
  - Generate valid Stripe signature from payload and webhook secret
  - POST to `/v1/webhooks/stripe` with valid signature
  - Should return HTTP 200
  - Response body should include `received: true`
  - Webhook should proceed to processing
- **Implementation Hints:**
  - Use HMAC-SHA256 with webhook secret (from env var `STRIPE_WEBHOOK_SECRET`)
  - Format: `t={timestamp},v1={signature}`
  - Payload: `{ type: 'checkout.session.completed', data: { object: { id: 'cs_test_123' } } }`
  - Helper function `generateTestSignature()` already stubbed (lines 298-308)
  - Needs real implementation using crypto module
- **Complexity:** Medium
- **Related Tests:** Tests 1, 2 (signature verification suite)
- **Dependencies:** Valid STRIPE_WEBHOOK_SECRET in test environment

---

### Category 2: Idempotency & Duplicate Handling (2 tests)

#### 4. Idempotency - Duplicate Webhook Returns 200

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:76-100`
- **Test Name:** "should return 200 for duplicate webhook"
- **Feature Area:** Webhook idempotency - duplicate detection
- **Expected Behavior:**
  - Send same webhook payload twice with identical signature
  - First request should return HTTP 200 and process normally
  - Second request (duplicate) should return HTTP 200
  - Response to duplicate should include `duplicate: true`
  - Database should only record webhook ONCE
- **Implementation Hints:**
  - Use event ID `evt_duplicate_test` (must be consistent across both requests)
  - Webhook repository checks `isDuplicate()` before processing (repository.ts:36)
  - Early return on duplicate without throwing (webhooks.routes.ts:139-143)
  - First webhook should be PENDING → PROCESSED
  - Second webhook should be marked DUPLICATE
  - Check `WebhookEvent` table for status progression
- **Complexity:** Medium
- **Related Tests:** Test 5 (idempotency suite)
- **Key Code:** WebhooksController.handleStripeWebhook() lines 137-143, PrismaWebhookRepository.isDuplicate() lines 36-68

#### 5. Idempotency - Duplicate Webhook Not Reprocessed

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:102-129`
- **Test Name:** "should not process duplicate webhook"
- **Feature Area:** Webhook idempotency - business logic isolation
- **Expected Behavior:**
  - Send checkout.session.completed webhook (creates booking)
  - Count bookings in database (should be 1)
  - Send same webhook again (duplicate)
  - Count bookings again (should still be 1, not 2)
  - Verify no duplicate booking was created from second webhook
- **Implementation Hints:**
  - Use event ID `evt_no_reprocess` for tracking
  - First webhook: `checkout.session.completed` event with valid metadata
  - Metadata must include all required fields (lines 49-58 of routes)
  - Query `Booking` table to verify count doesn't increase
  - Use same signature for both requests
  - First: Create booking via `bookingService.onPaymentCompleted()`
  - Second: Early return in `handleStripeWebhook()` before processing
- **Complexity:** Medium
- **Related Tests:** Test 4 (idempotency suite)
- **Key Code:** WebhooksController.handleStripeWebhook() lines 137-143, PrismaWebhookRepository.isDuplicate() lines 45-64

---

### Category 3: Error Handling (3 tests)

#### 6. Error Handling - Invalid JSON Payload

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:133-141`
- **Test Name:** "should return 400 for invalid JSON"
- **Feature Area:** Webhook validation - malformed request handling
- **Expected Behavior:**
  - POST malformed JSON body `'invalid json{'` to `/v1/webhooks/stripe`
  - Include valid `stripe-signature` header (but will fail before signature check)
  - Should return HTTP 400
  - Should NOT create webhook event record in database
  - Should NOT attempt to process
- **Implementation Hints:**
  - Body parsing should happen before signature verification
  - Express middleware may reject before reaching controller
  - Alternatively, controller receives empty/null body
  - Test both scenarios based on middleware setup
  - Payload: `'invalid json{'` (not valid JSON)
  - Verify no WebhookEvent record created
- **Complexity:** Simple
- **Related Tests:** Tests 7, 8 (error handling suite)
- **Note:** Implementation depends on Express middleware configuration for raw body parsing

#### 7. Error Handling - Missing Required Fields

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:143-156`
- **Test Name:** "should return 422 for missing required fields"
- **Feature Area:** Webhook validation - schema validation
- **Expected Behavior:**
  - Send valid JSON but missing required metadata fields (e.g., missing `data` field)
  - Include valid signature
  - Should return HTTP 422 (Unprocessable Entity)
  - WebhooksController receives event but Zod validation fails
  - Should mark webhook as FAILED in database
  - Error should include validation details
- **Implementation Hints:**
  - Zod schemas defined in routes:
    - StripeSessionSchema (lines 18-31)
    - MetadataSchema (lines 49-58)
  - Payload missing required field: `{ type: 'checkout.session.completed' }` (no `data`)
  - StripeSessionSchema.safeParse() fails at line 158
  - Controller catches at lines 159-167
  - Calls `webhookRepo.markFailed()` with validation error
  - Error middleware should map to 422 response
- **Complexity:** Medium
- **Related Tests:** Tests 6, 8 (error handling suite)
- **Key Code:** WebhooksController.handleStripeWebhook() lines 158-167, route-level error mapping

#### 8. Error Handling - Internal Server Error (Database Failure)

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:158-178`
- **Test Name:** "should return 500 for internal server errors"
- **Feature Area:** Webhook resilience - graceful degradation
- **Expected Behavior:**
  - Send valid webhook with valid signature
  - Simulate database connection failure
  - Should return HTTP 500
  - Should mark webhook as FAILED in database (if possible)
  - Response should include error description
  - No partial state changes (transactional safety)
- **Implementation Hints:**
  - Test setup: Disconnect Prisma before webhook processing
  - Payload: Valid checkout.session.completed with all metadata
  - Error should be caught at line 252 (WebhookProcessingError)
  - Controller calls `markFailed()` but may itself fail if DB is down
  - May need to test recovery/reconnection logic
  - Verify error response has `error` field defined
- **Complexity:** Complex
- **Related Tests:** Tests 6, 7 (error handling suite)
- **Key Code:** WebhooksController.handleStripeWebhook() lines 252-268

---

### Category 4: Event Type Handling (2 tests)

#### 9. Event Type Processing - Checkout Completion

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:182-216`
- **Test Name:** "should handle checkout.session.completed events"
- **Feature Area:** Webhook event processing - booking creation flow
- **Expected Behavior:**
  - Send `checkout.session.completed` event with complete metadata
  - Include valid signature
  - Should return HTTP 200
  - Booking should be created in database with correct details
  - Webhook should be marked PROCESSED
  - Event should NOT be marked DUPLICATE or FAILED
- **Implementation Hints:**
  - Event ID: `evt_completed`
  - Session ID: `cs_test_completed`
  - Required metadata fields (all must be present):
    - tenantId: string
    - packageId: 'classic'
    - eventDate: '2026-12-25'
    - coupleName: 'Test Couple'
    - email: 'test@example.com'
    - addOnIds: '[]' (JSON stringified)
  - Optional metadata:
    - commissionAmount
    - commissionPercent
  - amount_total: 250000 (in cents)
  - Verify booking created with query: `await prisma.booking.findFirst({ where: { id: 'cs_test_completed' } })`
  - BookingService.onPaymentCompleted() called with extracted metadata
  - Flow: Signature verify → Check duplicate → Record webhook → Validate Zod → Create booking → Mark processed
- **Complexity:** Complex
- **Related Tests:** Test 10 (event type handling suite)
- **Key Code:** WebhooksController.handleStripeWebhook() lines 155-245

#### 10. Event Type Processing - Unsupported Event Types

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:218-234`
- **Test Name:** "should ignore unsupported event types"
- **Feature Area:** Webhook event processing - graceful ignoring
- **Expected Behavior:**
  - Send event with type `payment_intent.created` (unsupported)
  - Include valid signature
  - Should return HTTP 200 (don't reject unsupported types)
  - Response body should include `ignored: true`
  - No booking should be created
  - Webhook should be marked PROCESSED (not FAILED)
  - Event should be recorded but not processed
- **Implementation Hints:**
  - Event ID: `evt_unsupported`
  - Event type: `payment_intent.created` (not `checkout.session.completed`)
  - Event still goes through full validation pipeline but no handler
  - At line 246-248: Check `event.type` and log "Ignoring unhandled webhook event type"
  - Still calls `markProcessed()` for record-keeping
  - No booking created
  - Verify `Booking` count unchanged
- **Complexity:** Medium
- **Related Tests:** Test 9 (event type handling suite)
- **Key Code:** WebhooksController.handleStripeWebhook() lines 246-251

---

### Category 5: Webhook Recording & Audit Trail (2 tests)

#### 11. Webhook Recording - Complete Event Audit Trail

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:238-260`
- **Test Name:** "should record all webhook events in database"
- **Feature Area:** Webhook audit trail - event tracking
- **Expected Behavior:**
  - Send valid `checkout.session.completed` webhook
  - Include valid signature
  - Should return HTTP 200
  - WebhookEvent record created with:
    - eventId: `evt_record_test`
    - eventType: `checkout.session.completed`
    - status: `PROCESSED`
    - Raw payload stored exactly as received
  - Record should be queryable and complete
- **Implementation Hints:**
  - Event ID: `evt_record_test`
  - Session ID: `cs_test_record`
  - Full metadata required (see test 9 for structure)
  - Query: `await prisma.webhookEvent.findUnique({ where: { eventId: 'evt_record_test' } })`
  - Verify fields:
    - `eventId` = 'evt_record_test'
    - `eventType` = 'checkout.session.completed'
    - `status` = 'PROCESSED'
    - `rawPayload` matches sent JSON
    - `attempts` >= 1
    - `processedAt` is set
  - Repository stores at line 99-108, updates at line 147-162
- **Complexity:** Medium
- **Related Tests:** Test 12 (webhook recording suite)
- **Key Code:** PrismaWebhookRepository.recordWebhook() lines 92-129, markProcessed() lines 147-162

#### 12. Webhook Recording - Failed Event Tracking

- **File:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts:262-290`
- **Test Name:** "should mark failed webhooks in database"
- **Feature Area:** Webhook audit trail - error tracking
- **Expected Behavior:**
  - Send `checkout.session.completed` webhook with invalid metadata
  - Include valid signature
  - Should return HTTP 500 (processing failed)
  - WebhookEvent record should be marked FAILED with:
    - status: `FAILED`
    - lastError: contains error message about invalid package
    - attempts: incremented
  - Error message should be descriptive for debugging
  - Record should preserve raw payload for retry/analysis
- **Implementation Hints:**
  - Event ID: `evt_fail_record`
  - Session ID: `cs_test_fail`
  - Metadata includes `packageId: 'invalid_package'` (doesn't exist)
  - Full metadata structure required but packageId is intentionally bad
  - BookingService.onPaymentCompleted() should throw PackageNotFound or similar
  - Controller catches at line 252-268
  - Calls `markFailed(tenantId, eventId, errorMessage)` at line 256
  - Query: `await prisma.webhookEvent.findUnique({ where: { eventId: 'evt_fail_record' } })`
  - Verify fields:
    - `status` = 'FAILED'
    - `lastError` is not null and contains useful error info
    - `attempts` >= 1
    - `rawPayload` preserved exactly
  - No booking should be created
- **Complexity:** Complex
- **Related Tests:** Test 11 (webhook recording suite)
- **Key Code:** PrismaWebhookRepository.markFailed() lines 185-201, WebhooksController error handling lines 252-268

---

## Implementation Priority & Complexity

### Quick Wins (Simple - 2 tests)

1. Test 1: Missing signature header (40 lines of code)
2. Test 6: Invalid JSON error (20 lines of code)

### Medium Priority (Medium - 6 tests)

3. Test 2: Invalid signature (30 lines)
4. Test 4: Duplicate webhook returns 200 (50 lines)
5. Test 5: Duplicate not reprocessed (60 lines)
6. Test 7: Missing fields validation (40 lines)
7. Test 10: Unsupported event types (35 lines)
8. Test 11: Webhook event recording (45 lines)

### Complex Implementation (Complex - 4 tests)

9. Test 3: Valid signature (80 lines - needs crypto HMAC)
10. Test 8: Database failure handling (70 lines - needs DB mocking)
11. Test 9: Checkout completion (100 lines - full flow)
12. Test 12: Failed event tracking (90 lines - error scenario)

---

## Test File Structure

```
webhooks.http.spec.ts
├── Setup (lines 1-30)
│   └── beforeEach/afterEach with Prisma client
│
├── Signature Verification (lines 35-73)
│   ├── Test 1: Missing header
│   ├── Test 2: Invalid signature
│   └── Test 3: Valid signature
│
├── Idempotency (lines 75-130)
│   ├── Test 4: Duplicate returns 200
│   └── Test 5: Duplicate not processed
│
├── Error Handling (lines 132-179)
│   ├── Test 6: Invalid JSON
│   ├── Test 7: Missing fields
│   └── Test 8: Internal error
│
├── Event Types (lines 181-235)
│   ├── Test 9: Checkout completion
│   └── Test 10: Unsupported types
│
├── Webhook Recording (lines 237-291)
│   ├── Test 11: Record all events
│   └── Test 12: Mark failed events
│
└── Helper (lines 294-309)
    └── generateTestSignature() - needs crypto implementation
```

---

## Key Dependencies & Helpers

### Required Test Setup

- Supertest for HTTP testing
- Test database connection via Prisma
- Mock or real Stripe secret for signature generation
- Tenant record in test database

### Helper Function Needed

- `generateTestSignature(payload: string): string` (line 298)
  - Current: Returns placeholder
  - Needs: HMAC-SHA256 with STRIPE_WEBHOOK_SECRET
  - Format: `t={timestamp},v1={signature}`

### Environment Variables Required

- `STRIPE_WEBHOOK_SECRET` - For signature generation/verification
- `DATABASE_URL` - Test database connection
- `ADAPTERS_PRESET=mock` - For isolated testing (optional)

---

## Test Execution Command

```bash
# Run webhook tests
npm test -- server/test/http/webhooks.http.spec.ts

# Run with coverage
npm run test:coverage -- server/test/http/webhooks.http.spec.ts

# Watch mode
npm run test:watch -- server/test/http/webhooks.http.spec.ts
```

---

## Related Source Code References

### Main Implementation Files

1. **WebhooksController** - `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts`
   - Handles signature verification (lines 117-122)
   - Duplicate detection (lines 137-143)
   - Zod validation (lines 158-181)
   - Event processing (lines 155-248)
   - Error handling (lines 252-272)

2. **PrismaWebhookRepository** - `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/webhook.repository.ts`
   - isDuplicate() - Idempotency check (lines 36-68)
   - recordWebhook() - Create audit record (lines 92-129)
   - markProcessed() - Update status to PROCESSED (lines 147-162)
   - markFailed() - Update status to FAILED with error (lines 185-201)

3. **Prisma Schema** - WebhookEvent model
   - Unique constraint: `tenantId_eventId`
   - Statuses: PENDING, PROCESSED, DUPLICATE, FAILED
   - Fields: eventId, eventType, status, rawPayload, lastError, attempts, processedAt

### Error Classes

- `WebhookValidationError` - Signature/schema validation failures (400/422)
- `WebhookProcessingError` - Processing failures (500)

### Service Dependencies

- `PaymentProvider.verifyWebhook(rawBody, signature)` - Stripe signature verification
- `BookingService.onPaymentCompleted(tenantId, data)` - Create booking from webhook
