# ADR-012: Full Test Coverage Requirement for Webhook Handler

**Date:** 2025-10-29
**Status:** Accepted
**Decision Makers:** Engineering Team
**Category:** Testing & Quality
**Related Issues:** Phase 2B - Testing & Quality

## Context

The webhook handler (`WebhooksController.handleStripeWebhook`) is the most critical code path in our application:

- Handles payment → booking link
- Failure results in customer charged but no booking
- No manual intervention possible if webhook processing is broken
- Errors are difficult to reproduce (require real Stripe webhooks)

**Current Test Coverage:**

- Webhook handler: **0% coverage** (no tests written yet)
- Booking service: 95% coverage
- Payment adapter: 0% coverage (stub only)

This is a **critical gap** identified in Phase 2 Assessment.

## Decision

We have decided to require **100% test coverage** for webhook handler and related payment flows.

**Testing Strategy:**

1. **Unit Tests** (Webhook Handler Logic)
   - Signature verification (valid/invalid)
   - Metadata parsing (valid/malformed)
   - Idempotency (duplicate webhooks)
   - Error handling (booking creation fails)

2. **Integration Tests** (End-to-End Webhook Flow)
   - Real Stripe webhook signature generation
   - Database transaction rollback on failure
   - Email notification triggered correctly

3. **Contract Tests** (Stripe Webhook Schema)
   - Validate webhook payload structure
   - Ensure metadata fields are present
   - Detect breaking changes in Stripe API

**Test Coverage Targets:**

- `WebhooksController`: 100% line coverage, 100% branch coverage
- `BookingService.onPaymentCompleted()`: 100% coverage
- `StripePaymentAdapter.verifyWebhook()`: 100% coverage

## Consequences

**Positive:**

- **Confidence:** Can deploy webhook changes without fear
- **Regression prevention:** Tests catch breaking changes
- **Documentation:** Tests serve as executable documentation
- **Faster debugging:** Tests reproduce error scenarios
- **Quality gate:** CI blocks deploy if tests fail

**Negative:**

- **Initial effort:** Writing tests takes 4-6 hours
- **Maintenance:** Tests must be updated when webhook logic changes
- **Complexity:** Mocking Stripe signatures requires setup

**Justification for 100% Target:**

- Wedding bookings are mission-critical (reputation risk)
- Webhook failures are expensive (manual reconciliation)
- Errors are hard to reproduce in production
- This is a small, focused code path (not entire app)

## Alternatives Considered

### Alternative 1: 80% Coverage Target

**Approach:** Aim for 80% coverage (industry standard), skip edge cases.

**Why Rejected:**

- Webhook handler is too critical for "good enough" testing
- Edge cases (signature errors, malformed metadata) are exactly what we need to test
- 80% coverage means 20% of code is untested (unacceptable for payment flows)

### Alternative 2: Manual Testing Only

**Approach:** Test webhook handler manually with Stripe CLI before each deploy.

**Why Rejected:**

- Manual testing is error-prone (humans forget steps)
- Can't test concurrent webhooks or race conditions
- No regression detection (changes can break old functionality)
- Doesn't scale (slows down development)

### Alternative 3: Integration Tests Only (No Unit Tests)

**Approach:** Only write end-to-end tests, skip unit-level tests.

**Why Rejected:**

- Integration tests are slower (run full app + database)
- Harder to test error scenarios (requires complex mocking)
- Less precise (don't pinpoint which line failed)
- Unit tests provide faster feedback during development

## Implementation Details

**Test Files:**

- `server/test/routes/webhooks.controller.spec.ts` - Unit tests
- `server/test/integration/webhook-flow.test.ts` - Integration tests
- `server/test/adapters/stripe.adapter.spec.ts` - Payment adapter tests

**Testing Tools:**

- Vitest (test runner)
- Stripe Mock (for signature generation)
- Supertest (HTTP testing)
- Test database (isolated from development)

**Example Test:**

```typescript
describe('WebhooksController', () => {
  describe('handleStripeWebhook', () => {
    it('verifies webhook signature', async () => {
      const invalidSignature = 'invalid_signature';

      const response = await request(app)
        .post('/v1/webhooks/stripe')
        .set('stripe-signature', invalidSignature)
        .send(validWebhookPayload)
        .expect(401);

      expect(response.body.error).toBe('Invalid signature');
    });

    it('handles duplicate webhooks (idempotency)', async () => {
      // First webhook succeeds
      await request(app)
        .post('/v1/webhooks/stripe')
        .set('stripe-signature', validSignature)
        .send(webhookPayload)
        .expect(200);

      // Second webhook (duplicate) also succeeds but doesn't create booking
      const response = await request(app)
        .post('/v1/webhooks/stripe')
        .set('stripe-signature', validSignature)
        .send(webhookPayload)
        .expect(200);

      expect(response.body.duplicate).toBe(true);

      // Verify only one booking created
      const bookings = await bookingRepo.findAll();
      expect(bookings.length).toBe(1);
    });

    it('returns 500 on booking creation failure', async () => {
      // Mock booking service to fail
      jest
        .spyOn(bookingService, 'onPaymentCompleted')
        .mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/v1/webhooks/stripe')
        .set('stripe-signature', validSignature)
        .send(webhookPayload)
        .expect(500);

      expect(response.body.error).toContain('Webhook processing failed');
    });
  });
});
```

**CI/CD Integration:**

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage

- name: Enforce 100% coverage for webhooks
  run: |
    coverage=$(npx nyc report --reporter=json | jq '.total.lines.pct')
    if [ "$coverage" -lt 100 ]; then
      echo "Webhook coverage is $coverage% (required: 100%)"
      exit 1
    fi
```

**Rollback Plan:**
If 100% coverage proves too burdensome:

1. Reduce to 90% coverage for non-critical paths
2. Maintain 100% coverage for signature verification and idempotency
3. Add manual testing checklist for deploys

## References

- Martin Fowler: [Test Coverage](https://martinfowler.com/bliki/TestCoverage.html)
- Google Testing Blog: [Code Coverage Best Practices](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)
- Stripe: [Testing Webhooks](https://stripe.com/docs/webhooks/test)

## Related ADRs

- ADR-009: Database-Based Webhook Dead Letter Queue
- ADR-011: PaymentProvider Interface
