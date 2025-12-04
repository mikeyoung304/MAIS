# Todo Tests - Quick Reference Table

## All 12 Todo Tests at a Glance

| #   | Test Name                                         | Category               | Lines   | Complexity | Status        |
| --- | ------------------------------------------------- | ---------------------- | ------- | ---------- | ------------- |
| 1   | "should reject webhook without signature header"  | Signature Verification | 36-44   | Simple     | Unimplemented |
| 2   | "should reject webhook with invalid signature"    | Signature Verification | 46-55   | Simple     | Unimplemented |
| 3   | "should accept webhook with valid signature"      | Signature Verification | 57-72   | Medium     | Unimplemented |
| 4   | "should return 200 for duplicate webhook"         | Idempotency            | 76-100  | Medium     | Unimplemented |
| 5   | "should not process duplicate webhook"            | Idempotency            | 102-129 | Medium     | Unimplemented |
| 6   | "should return 400 for invalid JSON"              | Error Handling         | 133-141 | Simple     | Unimplemented |
| 7   | "should return 422 for missing required fields"   | Error Handling         | 143-156 | Medium     | Unimplemented |
| 8   | "should return 500 for internal server errors"    | Error Handling         | 158-178 | Complex    | Unimplemented |
| 9   | "should handle checkout.session.completed events" | Event Processing       | 182-216 | Complex    | Unimplemented |
| 10  | "should ignore unsupported event types"           | Event Processing       | 218-234 | Medium     | Unimplemented |
| 11  | "should record all webhook events in database"    | Webhook Recording      | 238-260 | Medium     | Unimplemented |
| 12  | "should mark failed webhooks in database"         | Webhook Recording      | 262-290 | Complex    | Unimplemented |

---

## Implementation Roadmap

### Phase 1: Quick Wins (Start Here)

- [ ] Test 1: Missing signature header
- [ ] Test 6: Invalid JSON error
- [ ] Test 2: Invalid signature

### Phase 2: Core Functionality

- [ ] Test 3: Valid signature (needs crypto helper)
- [ ] Test 4: Duplicate webhook returns 200
- [ ] Test 5: Duplicate not processed
- [ ] Test 7: Missing fields validation
- [ ] Test 10: Unsupported event types

### Phase 3: Advanced Features

- [ ] Test 11: Webhook event recording
- [ ] Test 8: Database failure handling
- [ ] Test 9: Checkout completion
- [ ] Test 12: Failed event tracking

---

## Key Implementation Notes

### Helper Function (Critical)

Location: Line 298-308 in webhooks.http.spec.ts

```typescript
function generateTestSignature(payload: string): string {
  // TODO: Implement HMAC-SHA256
  // const timestamp = Math.floor(Date.now() / 1000);
  // const signature = crypto
  //   .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET!)
  //   .update(`${timestamp}.${payload}`)
  //   .digest('hex');
  // return `t=${timestamp},v1=${signature}`;

  return 'test_signature_placeholder'; // NEEDS IMPLEMENTATION
}
```

### Required Setup

- App instance passed to supertest
- Raw body parsing middleware configured
- Prisma test database connection
- STRIPE_WEBHOOK_SECRET in environment

### Common Test Patterns

#### Pattern 1: HTTP Request with Response Check

```typescript
const response = await request(app)
  .post('/v1/webhooks/stripe')
  .set('stripe-signature', signature)
  .send(payload)
  .expect(200);

expect(response.body.field).toBe(expectedValue);
```

#### Pattern 2: Database Assertion

```typescript
const record = await prisma.webhookEvent.findUnique({
  where: { tenantId_eventId: { tenantId, eventId } },
});

expect(record).not.toBeNull();
expect(record?.status).toBe('PROCESSED');
```

#### Pattern 3: Duplicate Detection

```typescript
// First request
await request(app).post('/v1/webhooks/stripe')...expect(200);

// Duplicate request - same event ID
await request(app).post('/v1/webhooks/stripe')...expect(200);

// Verify only one webhook event record
const count = await prisma.webhookEvent.count({
  where: { eventId: 'evt_test' }
});
expect(count).toBe(1);
```

---

## Test Data Templates

### Valid Webhook Payload

```typescript
{
  id: 'evt_test_id',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_123',
      amount_total: 250000,
      metadata: {
        tenantId: 'tenant_123',
        packageId: 'classic',
        eventDate: '2026-12-25',
        coupleName: 'Test Couple',
        email: 'test@example.com',
        addOnIds: '[]'
      }
    }
  }
}
```

### Invalid Payloads (for error tests)

- **Invalid JSON:** `'invalid json{'`
- **Missing data field:** `{ id: 'evt_123', type: 'checkout.session.completed' }`
- **Invalid packageId:** `packageId: 'nonexistent_package'`
- **Unsupported event:** `type: 'payment_intent.created'`

---

## Coverage Goals

When all 12 tests are implemented:

- Signature verification: 3 tests covering all scenarios
- Idempotency: 2 tests for duplicate detection and replay protection
- Error handling: 3 tests for validation, invalid input, and server errors
- Event processing: 2 tests for supported and unsupported events
- Webhook recording: 2 tests for audit trail and error tracking

**Target:** Increase test coverage from 60% to 75%+
