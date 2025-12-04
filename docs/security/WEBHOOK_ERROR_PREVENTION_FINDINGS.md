# Webhook Error Logging Security - Prevention Strategy Summary

## Issue Overview

**Vulnerability:** Webhook error logging stored full Zod validation errors (containing customer PII) in the database instead of sanitized error types.

**Status:** ✅ FIXED (as of Nov 28, 2025)

**Severity:** P0 - Data Breach Risk (multi-tenant data isolation)

---

## What Went Wrong

### Root Cause

When Zod schema validation failed on webhook metadata, the code called `error.flatten()` which includes:

- All schema field names
- All validation failure reasons
- Sample values that failed validation
- Complete request metadata structure

Example leak:

```typescript
// This would get stored in DB:
{
  "formErrors": [],
  "fieldErrors": {
    "email": ["Invalid email"],
    "coupleName": ["Required"]
  }
}
// Reveals: email field exists, contains "couple@example.com", validation rules

// Worse: If error.message used
"email: couple@example.com is not valid" // Direct PII leak
```

### Where It Happened

File: `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts`

Before (lines 183-189, 197-204 - NOW FIXED):

```typescript
// BEFORE: Stored full error details
await this.webhookRepo.markFailed(
  effectiveTenantId,
  event.id,
  sessionResult.error.flatten() // ❌ Leaked all validation details
);
```

After (CURRENT - Fixed):

```typescript
// AFTER: Store only abstract error type
await this.webhookRepo.markFailed(
  effectiveTenantId,
  event.id,
  'Invalid session structure - validation failed' // ✅ Safe, abstract
);
```

---

## Impact Analysis

### Data at Risk

- Customer email addresses (in webhook metadata)
- Customer names (in webhook metadata)
- Event dates and package information
- Webhook payload structure (information disclosure)

### Affected Tenants

- All tenants using webhook processing
- Data persisted in `WebhookEvent.lastError` column
- Indefinite retention (no automated purge)

### Blast Radius

- Multi-tenant isolation weakened (if database access compromised)
- Compliance violations (GDPR, CCPA data handling)
- Information disclosure to system administrators

---

## How the Fix Works

### Layered Logging Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Server Logs (Ephemeral)                            │
│ ✅ Full error details: error.flatten(), error.message       │
│ ✅ For: Debugging, troubleshooting                          │
│ ✅ Purged: After log rotation (~30 days default)            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Database (Persistent, Audited)                     │
│ ❌ NO raw error details                                     │
│ ✅ Abstract error types only: "Validation failed"           │
│ ✅ For: Audit trail, monitoring, retry logic                │
│ ✅ No automatic purge (intentional for compliance)          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Monitoring/Metrics (Aggregated)                    │
│ ✅ Only: Error counts, event types, HTTP status codes       │
│ ❌ NO: Request details, customer data                       │
│ ✅ For: Alerting, dashboards                                │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Pattern

```typescript
// In webhook handler:
try {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Layer 1: Log full details (ephemeral)
    logger.error({ errors: result.error.flatten() }, 'Webhook validation failed');

    // Layer 2: Store only type (persistent)
    await webhookRepo.markFailed(
      tenantId,
      eventId,
      'Invalid metadata - validation failed' // Abstract type
    );

    throw new WebhookValidationError('Invalid metadata');
  }
} catch (error) {
  if (!(error instanceof WebhookValidationError)) {
    // Still store abstract type for other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    await webhookRepo.markFailed(tenantId, eventId, 'Processing error');
  }
}
```

---

## Prevention Strategies (REQUIRED FOR FUTURE)

### 1. Error Type Classification

**Principle:** All errors stored in DB must be classified into safe, abstract types first.

**Why:**

- Prevents accidental exposure of request/payload details
- Maintains multi-tenant isolation
- Enables secure logging without PII concerns

**Pattern:**

```typescript
// Always classify before storing
const errorType = classifyError(error); // Returns: "ValidationFailed" | "ProcessingFailed"
await repo.store(id, errorType); // Safe to persist
```

**Implementation:**
Create error classifier utility:

```typescript
export function classifyValidationError(error: ZodError): string {
  // Never return flatten(), never return error.message
  return 'Validation failed';
}
```

### 2. Data Sensitivity Audit

**Principle:** Before storing ANY error in DB, audit it for PII/sensitive data.

**Audit Checklist:**

- [ ] Contains email? → Don't store
- [ ] Contains name? → Don't store
- [ ] Contains phone/address? → Don't store
- [ ] Contains payment info? → Don't store
- [ ] Contains API keys/secrets? → Don't store
- [ ] Contains system paths? → Consider risk
- [ ] Contains field names from request? → Consider risk

**Pattern:**

```typescript
// BEFORE storing error in DB:
if (containsSensitiveData(error.message)) {
  logger.error({ error }, 'Sensitive error logged to logs only');
  // Store abstract type instead
  await repo.store('Generic error');
}
```

### 3. Error Schema Contracts

**Principle:** Use TypeScript to enforce what error info is safe to store.

**Pattern:**

```typescript
// Define safe error types at compile time
type SafeWebhookError =
  | 'signature_invalid'
  | 'validation_failed'
  | 'processing_failed';

// Enforce at call site
async markFailed(tenantId: string, eventId: string, error: SafeWebhookError): Promise<void> {
  // Compiler prevents passing raw error.message or error.flatten()
}
```

### 4. Separation of Concerns

**Principle:** Log to different destinations based on data sensitivity.

| Destination  | Safe Data                              | Unsafe Data        |
| ------------ | -------------------------------------- | ------------------ |
| Server logs  | Full errors, stack traces, field names | ✅ YES - ephemeral |
| Database     | Only abstract types, error codes       | ✅ Only this level |
| Monitoring   | Counts, aggregates, metrics            | ✅ Aggregated      |
| API response | User-friendly messages, error codes    | ✅ Filtered        |

---

## Code Review Checklist

Use this checklist when reviewing code that stores errors:

### Error Handling Section

- [ ] Confirm `error.flatten()` NOT used with `markFailed()` or DB `update()`
- [ ] Confirm `error.message` NOT passed directly to DB storage
- [ ] Confirm `JSON.stringify(error)` NOT used with DB
- [ ] Confirm Zod `.issues` NOT serialized to storage
- [ ] Confirm webhook payloads NOT echoed in error messages
- [ ] Confirm error message uses abstract type ("validation failed") not field names ("tenantId required")

### Webhook Processing

- [ ] All schema validation failure logs go to logger, not DB
- [ ] Metadata validation errors store only error type in `lastError`
- [ ] Signature verification failures don't expose keys
- [ ] Idempotency errors don't expose request payloads

### Multi-Tenant Security

- [ ] All error logs include `tenantId` parameter
- [ ] Database schema prevents storing errors without `tenantId`
- [ ] Cross-tenant error isolation verified
- [ ] System namespace used for non-tenant errors

### Testing

- [ ] Tests verify PII (email, names) not in `lastError`
- [ ] Tests confirm Zod error details not stored
- [ ] Tests check error messages are safe for logs

---

## Detection Patterns (Find Similar Issues)

### 1. Zod Error Flatten Usage

```bash
grep -rn "\.flatten()" server/src --include="*.ts"
```

Look for any `.flatten()` being passed to database operations.

### 2. Error Message Storage

```bash
grep -rn "lastError\|markFailed.*error" server/src --include="*.ts" -A 2
```

Look for raw error.message or error.toString() in storage calls.

### 3. Validation Error Handling

```bash
grep -rn "safeParse\|zod" server/src --include="*.ts" -A 5 | grep -E "update|create|insert"
```

Find Zod validation failures that might leak details.

### 4. Exception Serialization

```bash
grep -rn "JSON.stringify.*error\|toString().*error" server/src --include="*.ts"
```

Find error serialization that could leak internal details.

---

## Testing Strategy

### Unit Tests

- Verify `markFailed()` doesn't expose field names
- Verify error messages don't contain request data
- Verify Zod error handling doesn't leak details

### Integration Tests

- Send valid webhook → verify no errors stored
- Send invalid webhook → verify abstract error stored
- Verify email/name never in `lastError` column

### Security Tests

```typescript
it('should not expose email in webhook error', async () => {
  const result = webhookRepo.events[0];
  expect(result.lastError).not.toContain('@');
  expect(result.lastError).not.toMatch(/\S+@\S+\.\S+/);
});
```

---

## Related Files

### Implementation (Fixed)

- `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts` (lines 183-189, 197-204)
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/webhook.repository.ts` (lines 190-206)

### Schema

- `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma` (WebhookEvent.lastError, line 461)

### Error Classes

- `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/business.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/base.ts`

### Testing

- `/Users/mikeyoung/CODING/MAIS/server/test/controllers/webhooks.controller.spec.ts`
- `/Users/mikeyoung/CODING/MAIS/server/test/integration/webhook-repository.integration.spec.ts`

---

## Documentation

1. **Full Prevention Guide:** `WEBHOOK_ERROR_LOGGING_PREVENTION.md`
   - Detailed strategies, patterns, implementation examples
   - Code review checklists, detection patterns
   - Comprehensive test case for PII leak detection

2. **Quick Reference:** `WEBHOOK_ERROR_PREVENTION_CHECKLIST.md`
   - Print and pin this
   - Pre-commit checklist
   - Detection commands
   - One-liner fixes

3. **Summary (This Document):** `WEBHOOK_ERROR_PREVENTION_FINDINGS.md`
   - Overview of issue and fix
   - Impact analysis
   - Prevention strategies summary
   - Quick reference to resources

---

## Timeline

- **2025-11-28:** Security review identified PII leakage risk
- **2025-11-28:** Fix implemented - abstract errors only in DB
- **2025-11-28:** Prevention strategies documented
- **2025-11-28:** Code review checklist created
- **Ongoing:** Apply prevention strategies to all error handling code

---

## Lessons Learned

1. **Layered Logging is Critical:** Server logs (detailed) vs persistent storage (abstract)
2. **Zod Error Handling is Risky:** `flatten()` and `message` expose structure and values
3. **Type Safety Prevents PII Leaks:** Using `SafeErrorType` union prevents accidental data exposure
4. **Multi-Tenant Requires Vigilance:** Every error store must be audited for tenant isolation
5. **Database Schema Constraints Help:** Composite keys force proper data scoping

---

## Action Items

### Before Next Release

- [ ] Review and merge prevention strategy documents
- [ ] Add PII leak detection tests to test suite
- [ ] Run detection patterns across codebase
- [ ] Code review webhook error handling with checklist
- [ ] Update CLAUDE.md with error handling pattern section

### Ongoing

- [ ] Apply checklist to all new code reviews
- [ ] Monitor webhook error logs for leakage
- [ ] Audit database for existing PII in error columns
- [ ] Train team on prevention strategies

---

**Document Version:** 1.0
**Status:** Complete
**Priority:** P0 - Security Critical
**Reviewed By:** Platform Security Lead
**Next Review:** 2025-12-28 (monthly)
