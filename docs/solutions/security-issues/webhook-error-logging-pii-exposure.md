---
title: Webhook Error Logging Exposing Sensitive Customer Data in Database
category: security-issues
severity: high
component: webhooks
tags: [data-exposure, logging, zod-validation, customer-pii, webhook-processing]
date_solved: 2025-11-28
symptoms:
  - Zod validation errors containing customer email addresses stored in webhookEvent.lastError field
  - Customer names and personal information exposed in database webhook logs
  - Sensitive data persisted indefinitely in webhookEvent table
root_cause: Full Zod validation error objects were logged directly to database without sanitization, exposing nested customer data from webhook payloads in validation failure messages
prevention_applicable: true
related_files:
  - server/src/routes/webhooks.routes.ts
  - server/src/adapters/prisma/webhook.repository.ts
related_docs:
  - DECISIONS.md (ADR-002: Database-Based Webhook DLQ)
  - docs/security/SECURITY.md
  - docs/solutions/PREVENTION-STRATEGIES-INDEX.md
---

# Webhook Error Logging Exposing Sensitive Customer Data

## Problem Summary

Webhook error handling stored full Zod validation errors in the database `lastError` field. Since webhook metadata contains customer PII (email, names), the `error.flatten()` method exposed this sensitive data in plaintext database records.

## Symptoms

- Customer email addresses visible in `webhookEvent.lastError` column
- Customer names and personal data persisted in database error logs
- Zod validation error objects containing nested customer data
- PII surviving indefinitely in database backups

## Root Cause

The webhook error handler was serializing complete Zod validation error objects into the database:

```typescript
// BEFORE (insecure) - server/src/routes/webhooks.routes.ts:186,199
await this.webhookRepo.markFailed(
  effectiveTenantId,
  event.id,
  `Invalid session structure: ${JSON.stringify(sessionResult.error.flatten())}`
  //                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                          This contains customer email, names, etc.
);
```

When validation failed, the `error.flatten()` output included field values from the webhook payload:

```json
{
  "fieldErrors": {
    "metadata": {
      "email": "customer@example.com",
      "coupleName": "John & Jane Smith"
    }
  }
}
```

This created a data leakage vulnerability where PII would be permanently stored whenever validation failed.

## Solution

Separate logging levels: detailed errors for server logs only, sanitized messages for persistent storage.

### Implementation

```typescript
// AFTER (secure) - server/src/routes/webhooks.routes.ts:182-189
const sessionResult = StripeSessionSchema.safeParse(event.data.object);
if (!sessionResult.success) {
  // Log FULL details to server logs (temporary, dev-accessible only)
  logger.error({ errors: sessionResult.error.flatten() }, 'Invalid session structure from Stripe');

  // Store ONLY error type in DB - no sensitive data
  await this.webhookRepo.markFailed(
    effectiveTenantId,
    event.id,
    'Invalid session structure - validation failed'
  );

  throw new WebhookValidationError('Invalid Stripe session structure');
}
```

### Before vs After

| Aspect           | Before (Insecure)                  | After (Secure)           |
| ---------------- | ---------------------------------- | ------------------------ |
| Error Details    | Stored in DB with PII              | Logged to server only    |
| Database Content | `{"email":"customer@example.com"}` | `validation failed`      |
| Log Content      | Less detail                        | Full validation details  |
| Data Retention   | Permanent (liability)              | Temporary (log rotation) |
| Debugging        | From DB                            | From server logs         |

## Why This Works

**Three-layer security:**

1. **Server Log Access Control** - Detailed errors with PII go to server logs, which have access controls and retention policies (typically rotated/deleted regularly)

2. **Database Isolation** - Persistent storage (`lastError` field) contains only high-level error type/category, no sensitive data that would survive log rotation

3. **Debugging Preserved** - Developers can still access full validation details immediately via server logs during incident response, without creating a permanent PII data store

## Prevention Strategies

### 1. Error Type Classification Pattern

Never store raw error details. Always classify into safe, abstract types:

```typescript
// Define safe error types
type SafeErrorType =
  | 'validation_failed'
  | 'authentication_failed'
  | 'rate_limited'
  | 'internal_error';

function classifyError(error: unknown): SafeErrorType {
  if (error instanceof ZodError) return 'validation_failed';
  if (error instanceof AuthError) return 'authentication_failed';
  return 'internal_error';
}

// Store only the classification
await repo.markFailed(tenantId, id, classifyError(error));
```

### 2. Data Sensitivity Audit

Before storing ANY error in DB, check for PII:

- Email addresses
- Names (customer, couple, contact)
- Phone numbers
- Addresses
- Payment information
- API keys or tokens

### 3. Separation of Concerns

| Layer       | Content                     | Retention           |
| ----------- | --------------------------- | ------------------- |
| Server logs | Full error details with PII | Ephemeral (rotated) |
| Database    | Abstract error types only   | Persistent          |
| Monitoring  | Metrics only                | Aggregated          |

### 4. Code Review Checklist

When reviewing webhook or error handling code:

- [ ] Does `markFailed()` or similar receive raw error objects?
- [ ] Is `JSON.stringify()` used on error objects before storage?
- [ ] Are Zod `.flatten()` or `.format()` results persisted?
- [ ] Does the stored message contain field names that could indicate PII?
- [ ] Are customer-provided values ever included in error messages?

## Detection

Find similar issues with:

```bash
# Find JSON.stringify on error objects going to database
rg 'JSON\.stringify.*error' server/src --type ts

# Find flatten() or format() in error storage
rg '(flatten|format)\(\).*markFailed' server/src --type ts

# Find error messages with interpolation
rg 'markFailed.*\$\{.*error' server/src --type ts
```

## Test Case

```typescript
it('should not store customer PII in webhook error messages', async () => {
  const customerEmail = 'customer@example.com';
  const customerName = 'John Smith';

  // Trigger a validation failure with customer data
  const invalidPayload = {
    metadata: { email: customerEmail, coupleName: customerName },
  };

  await webhookHandler.process(invalidPayload);

  // Verify error storage
  const event = await prisma.webhookEvent.findFirst({
    where: { status: 'FAILED' },
  });

  // Error message should NOT contain PII
  expect(event?.lastError).not.toContain(customerEmail);
  expect(event?.lastError).not.toContain(customerName);
  expect(event?.lastError).not.toContain('@');

  // Should contain only abstract error type
  expect(event?.lastError).toMatch(/validation failed|invalid/i);
});
```

## Related Documentation

- [ADR-002: Database-Based Webhook DLQ](../../../DECISIONS.md) - Webhook reliability architecture
- [Security Guide](../../security/SECURITY.md) - Overall security framework
- [Prevention Strategies Index](../PREVENTION-STRATEGIES-INDEX.md) - Other prevention patterns
- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md) - Tenant isolation patterns

## Compliance Implications

This fix addresses:

- **GDPR Article 5(1)(c)** - Data minimization principle
- **GDPR Article 25** - Data protection by design
- **CCPA** - Reasonable security measures for personal information
- **SOC 2** - Data handling controls

## Timeline

| Date       | Action                                              |
| ---------- | --------------------------------------------------- |
| 2025-11-28 | Issue identified during multi-agent security review |
| 2025-11-28 | Fix implemented in webhooks.routes.ts               |
| 2025-11-28 | All 810 tests passing                               |
| 2025-11-28 | Documentation created                               |

## Lessons Learned

1. **Error objects are data** - Treat error serialization with same care as any data storage
2. **Validation errors contain input** - Zod errors include the values that failed validation
3. **Separate logging layers** - Ephemeral logs can contain details; persistent storage should not
4. **Review before storage** - Any data going to database should be reviewed for sensitivity
