---
title: 'Pino Logger Argument Order Error - Object Before Message Required'
slug: pino-logger-argument-order-ts2769
category: build-errors
tags:
  - typescript
  - pino
  - logger
  - argument-order
  - ts2769
  - type-error
  - prisma-adapter
  - tenant-repository
severity: medium
component: server/src/adapters/prisma/tenant.repository.ts
symptoms:
  - 'TS2769: No overload matches this call'
  - "Argument of type 'string' is not assignable to parameter of type 'LogDescriptor'"
  - TypeScript compilation failure
  - Logger.warn() call fails type checking
first_seen: 2025-12-02
root_cause: Pino logger requires object-first signature logger.warn({obj}, 'message') not logger.warn('message', {obj})
related_files:
  - server/src/lib/core/logger.ts
  - server/src/adapters/prisma/tenant.repository.ts
prevention_strategy: Always use logger.method({context}, 'message') pattern for Pino loggers
---

# Pino Logger Argument Order Error (TS2769)

## Problem Description

TypeScript compilation error `TS2769: No overload matches this call` when using Pino logger with incorrect argument order.

**Error Location:** `server/src/adapters/prisma/tenant.repository.ts`

**When Encountered:** While adding Zod safeParse validation for branding data in the tenant repository.

## Root Cause

Pino logger uses **structured logging** with an object-first signature pattern. Unlike traditional loggers that accept `(message, context)`, Pino requires `(context, message)` to ensure structured log data is properly formatted as JSON.

The error occurs when developers use the conventional logging pattern:

```typescript
logger.warn(message, contextObject); // Wrong - traditional pattern
```

Instead of Pino's required signature:

```typescript
logger.warn(contextObject, message); // Correct - Pino pattern
```

## The Fix

**Before (Incorrect):**

```typescript
logger.warn('Invalid tenant data during public lookup', {
  tenantId,
  slug,
  errors,
});
```

**After (Correct):**

```typescript
logger.warn(
  {
    tenantId: tenant.id,
    slug: tenant.slug,
    errorCount: validationResult.error.issues.length,
  },
  'Invalid tenant data during public lookup'
);
```

## Why This Pattern Exists

Pino is designed for high-performance structured logging with JSON output. By placing the context object **first**, Pino can:

1. **Efficiently serialize** structured data without parsing the message string
2. **Guarantee consistent** JSON output format across all log entries
3. **Enable better querying** in log aggregation systems (e.g., searching by `tenantId` field)
4. **Improve performance** by treating the message as a simple string label

**Example JSON output:**

```json
{
  "level": 40,
  "time": 1701234567890,
  "tenantId": "clx1234567890",
  "slug": "acme-corp",
  "errorCount": 3,
  "msg": "Invalid tenant data during public lookup"
}
```

## Verification Steps

1. **TypeScript compilation passes:**

   ```bash
   npm run typecheck
   # Should complete without TS2769 errors
   ```

2. **Log output is valid JSON:**

   ```bash
   # Run the application and trigger the log
   npm run dev:api

   # Verify the log entry contains structured fields
   # Look for JSON with tenantId, slug, errorCount fields
   ```

3. **Test the specific code path:**
   ```bash
   # Run tests that exercise tenant validation
   npm test -- tenant.repository.test.ts
   ```

## Prevention Strategy

### Pattern to Follow

```typescript
// Always use: logger.level(contextObject, message)
logger.info({ userId, action }, 'User action completed');
logger.error({ error, requestId }, 'Request failed');
logger.warn({ tenantId, resource }, 'Resource limit approaching');
```

### Pattern to Avoid

```typescript
// Never use: logger.level(message, contextObject)
logger.info('User action completed', { userId, action });
```

### Quick Validation

```bash
# Find potential incorrect usage (string literal as first arg)
grep -rn "logger\.\(info\|warn\|error\|debug\)(['\"]" server/src --include="*.ts"

# Verify correct usage (object literal as first arg)
grep -rn "logger\.\(info\|warn\|error\|debug\)({ " server/src --include="*.ts"
```

### Code Review Checklist

When reviewing PRs with logger calls:

- [ ] Are all logger calls using `(object, message)` order?
- [ ] Do logs include relevant context (tenantId, resourceId)?
- [ ] Is the object first when both object and message are present?
- [ ] Are error objects properly included in the context object?

## Related Documentation

- **Internal:** `server/src/lib/core/logger.ts` - Logger configuration
- **Internal:** `docs/solutions/security-issues/webhook-error-logging-pii-exposure.md` - Related PII logging issue
- **External:** [Pino API Documentation](https://github.com/pinojs/pino/blob/main/docs/api.md)

## Quick Reference

```
PINO LOGGER ARGUMENT ORDER
--------------------------
CORRECT:  logger.info({ tenantId }, 'Message')
WRONG:    logger.info('Message', { tenantId })

Remember: "Context first, message second"
```

## Work Log

| Date       | Action            | Notes                                               |
| ---------- | ----------------- | --------------------------------------------------- |
| 2025-12-02 | Issue encountered | While adding Zod validation to tenant.repository.ts |
| 2025-12-02 | Fixed             | Reversed argument order in logger.warn() call       |
| 2025-12-02 | Documented        | Created prevention documentation                    |
