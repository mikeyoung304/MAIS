# Webhook Error Logging - Quick Reference Checklist

## Print and Pin This! ⭐

Quick checklist for code review and development. See `WEBHOOK_ERROR_LOGGING_PREVENTION.md` for full details.

---

## Golden Rule

**NEVER store raw validation errors in the database. Only store abstract error types.**

```typescript
// ❌ BAD - Exposes PII
await webhookRepo.markFailed(tenantId, eventId, error.flatten());
await webhookRepo.markFailed(tenantId, eventId, error.message);

// ✅ GOOD - Safe, abstract
await webhookRepo.markFailed(tenantId, eventId, 'Validation failed');
```

---

## Error Storage Rules

### Where PII Leaks Can Happen

| Location              | Safe?  | Why                             |
| --------------------- | ------ | ------------------------------- |
| `logger.error()`      | ✅ YES | Server logs are ephemeral       |
| `DB lastError column` | ❌ NO  | Persists forever, accessible    |
| `metrics/monitoring`  | ❌ NO  | Likely logged or archived       |
| `API response`        | ❌ NO  | Visible to client/network       |
| Stack traces in DB    | ❌ NO  | Contains implementation details |

### What Can Go In DB Error Fields

✅ **Abstract error types:**

- "Validation failed"
- "Invalid metadata"
- "Processing failed"
- "Payment failed"

❌ **NOT allowed:**

- "email is not valid"
- "tenantId field missing"
- `error.flatten()` output
- `error.message` (raw)
- `JSON.stringify(error)`

---

## Code Patterns to Check

### Pattern 1: Zod Validation (Most Common)

```typescript
// ❌ DANGEROUS - Flatten contains field details and values
const result = schema.safeParse(data);
if (!result.success) {
  await db.update({ error: result.error.flatten() }); // PII LEAK!
}

// ✅ CORRECT - Log details, store type
const result = schema.safeParse(data);
if (!result.success) {
  logger.error({ errors: result.error.flatten() }, 'Validation failed'); // OK - logs only
  await db.update({ error: 'Validation failed' }); // Safe - type only
}
```

### Pattern 2: Exception Error Message

```typescript
// ❌ BAD - error.message might contain request data
try {
  await bookingService.create(data);
} catch (error) {
  await db.update({ lastError: error.message }); // LEAK!
}

// ✅ GOOD - Extract error type
try {
  await bookingService.create(data);
} catch (error) {
  const errorType = error instanceof BookingError ? 'Booking creation failed' : 'Unknown error';
  await db.update({ lastError: errorType }); // Safe
}
```

### Pattern 3: API Response Errors

```typescript
// ❌ BAD - Stripe/external error contains details
try {
  const session = await stripe.checkout.sessions.create({...});
} catch (error) {
  await db.update({ lastError: error.message }); // May expose Stripe details
}

// ✅ GOOD - Abstract to error type
try {
  const session = await stripe.checkout.sessions.create({...});
} catch (error) {
  const errorType = error.code === 'StripeInvalidRequestError' ? 'Payment creation failed' : 'Payment error';
  await db.update({ lastError: errorType }); // Safe
}
```

---

## Pre-Commit Checklist

Before committing code that handles errors:

- [ ] No `error.flatten()` passed to DB update/create
- [ ] No `error.message` passed to DB without sanitization
- [ ] No `JSON.stringify(error)` used with DB
- [ ] No field names or validation details in stored error messages
- [ ] All DB errors are abstract types (not field-specific)
- [ ] Logger calls (server logs) can have `flatten()` or raw errors ✅
- [ ] All webhook errors scoped to `tenantId`
- [ ] Error table uses `TEXT` column for future-proofing (not `VARCHAR(255)`)

---

## Detection Commands

Run these to find risky patterns:

### Find Zod flatten() in DB context

```bash
grep -rn "markFailed\|lastError.*flatten\|error.*flatten" server/src --include="*.ts"
```

### Find raw error storage

```bash
grep -rn "lastError.*error\." server/src --include="*.ts"
grep -rn "update.*error.*message" server/src --include="*.ts"
```

### Find email patterns that might leak

```bash
grep -rn "safeParse.*email\|validate.*email" server/src --include="*.ts" -B 5 -A 5
```

---

## Testing Checklist

When writing tests for error handling:

- [ ] Test that Zod validation failure doesn't expose field names
- [ ] Test that customer email is not in `lastError`
- [ ] Test that personal names are not in `lastError`
- [ ] Test that no email pattern (`\S+@\S+\.\S+`) appears in `lastError`
- [ ] Test that `lastError` doesn't contain "fieldErrors" or "formErrors" (Zod flatten output)
- [ ] Test that error messages can be safely logged (no secrets exposed)

### Quick Test

```typescript
it('should not expose email in webhook error', async () => {
  const result = webhookRepo.events[0];
  expect(result.lastError).not.toContain('customer@example.com');
  expect(result.lastError).not.toMatch(/\S+@\S+\.\S+/);
});
```

---

## File Paths to Review

**Webhook Implementation:**

- `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts` (lines 183-189, 197-204)

**Repository Layer:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/webhook.repository.ts` (lines 190-206)

**Schema:**

- `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma` (model WebhookEvent, line 461: `lastError`)

**Error Classes:**

- `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/business.ts` (WebhookValidationError, WebhookProcessingError)

---

## When in Doubt

Ask these questions:

1. **Could a human reading this error message see customer data?**
   - If YES → Don't store in DB ❌
   - If NO → Safe to store ✅

2. **Is this error type reusable/generic across requests?**
   - If YES → Safe to store ✅
   - If NO → Too specific, might expose details ❌

3. **Would I put this error in a customer-facing UI?**
   - If YES → Safe to store ✅
   - If NO → Too detailed, use logs instead ❌

4. **Could this error be used to reconstruct the request?**
   - If YES → Don't store in DB ❌
   - If NO → Safe to store ✅

---

## One-Liner Fix Pattern

If you find a PII leak in error storage:

**Old (Leaky):**

```typescript
await webhookRepo.markFailed(tenantId, eventId, result.error.flatten());
```

**New (Fixed):**

```typescript
logger.error({ errors: result.error.flatten() }, 'Validation failed');
await webhookRepo.markFailed(tenantId, eventId, 'Invalid metadata - validation failed');
```

---

## Related Docs

- Full guide: `WEBHOOK_ERROR_LOGGING_PREVENTION.md`
- ADR-003: Webhook Error Logging (in DECISIONS.md)
- Multi-tenant guide: `MULTI_TENANT_IMPLEMENTATION_GUIDE.md`
- General security: `../security/` folder

---

**Last Updated:** 2025-11-28
**Priority:** P0 - Security Critical
**Contact:** Review with Platform Security Lead
