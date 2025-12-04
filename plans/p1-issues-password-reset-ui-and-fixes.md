# P1 Issues: Password Reset UI & Critical Fixes

## Overview

This plan addresses 4 P1 issues discovered during the scheduling platform code review. Issues are prioritized by user impact and security risk.

| #   | Issue                           | Priority | Impact                  | Effort | Status         |
| --- | ------------------------------- | -------- | ----------------------- | ------ | -------------- |
| 7   | Password Reset UI Missing       | P1       | High (User-blocking)    | 5 min  | **Verify E2E** |
| 8   | Customer Email Normalization    | P1       | Medium (Data integrity) | 5 min  | Ready          |
| 9   | Webhook Idempotency Race        | P1       | High (Security/data)    | 15 min | Ready          |
| 10  | Multiple PrismaClient Instances | P1       | Medium (Performance)    | 10 min | Ready          |

---

## Review Summary

**Reviewed by:** DHH-style, Security, and Simplicity reviewers (2025-11-28)

### Decisions Made:

1. **Issue #9:** Use fail-fast approach (return 400 to Stripe) for `checkout.session.completed` without tenantId
2. **Issue #7:** Verify E2E tests pass before closing (link already exists)
3. **DB Constraint:** Skip - application-level validation is sufficient
4. **Scope:** Approved - proceed with all 4 issues

### Reviewer Verdicts:

| Issue | DHH        | Security           | Simplicity                |
| ----- | ---------- | ------------------ | ------------------------- |
| #7    | ✅ APPROVE | ✅ SECURE          | 5/5                       |
| #8    | ✅ APPROVE | ✅ SECURE          | 4/5                       |
| #9    | ✅ APPROVE | ⚠️ NEEDS_HARDENING | 4/5 (after clarification) |
| #10   | ✅ APPROVE | ✅ SECURE          | 4/5                       |

---

## Issue #7: Password Reset UI Missing

### Status: ✅ ALREADY IMPLEMENTED - Verify E2E

**Discovery:** Research reveals the frontend pages **already exist**:

| Component          | File                                              | Status                                                    |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------- |
| ForgotPasswordPage | `client/src/features/auth/ForgotPasswordPage.tsx` | ✅ Complete (210 lines)                                   |
| ResetPasswordPage  | `client/src/features/auth/ResetPasswordPage.tsx`  | ✅ Complete (279 lines)                                   |
| Routes             | `client/src/router.tsx`                           | ✅ Configured at `/forgot-password` and `/reset-password` |
| Login Link         | `client/src/pages/Login.tsx:187-189`              | ✅ "Forgot Password?" link exists                         |

**Features Already Implemented:**

- Email validation and submission
- Success/error states with appropriate icons
- Token validation from URL query parameter
- Password requirements (8 chars, uppercase, lowercase, number)
- Password visibility toggle
- Back to login navigation
- Postmark email integration (backend)
- "Forgot Password?" link on login page

### Required Action: Verify E2E Tests Pass

```bash
# Run password reset E2E tests to confirm flow works
npm run test:e2e -- e2e/tests/password-reset.spec.ts

# If tests pass, close the todo
# No code changes needed - just verification
```

---

## Issue #8: Customer Email Normalization

### Problem

**File:** `server/src/adapters/prisma/booking.repository.ts:164`

Customer upsert doesn't normalize email to lowercase:

```typescript
// CURRENT (INCORRECT)
const customer = await tx.customer.upsert({
  where: {
    tenantId_email: {
      tenantId,
      email: booking.email, // ❌ Not normalized
    },
  },
  create: {
    tenantId,
    email: booking.email, // ❌ Not normalized
    // ...
  },
});
```

**Impact:** Same customer with `John@Example.com` and `john@example.com` creates duplicate records, violating the intent of `@@unique([tenantId, email])`.

### Solution

Add `.toLowerCase().trim()` to email in upsert (defensive coding per reviewer feedback):

```typescript
// FIXED - normalize email before upsert (line ~162)
const normalizedEmail = booking.email.toLowerCase().trim();
const customer = await tx.customer.upsert({
  where: {
    tenantId_email: {
      tenantId,
      email: normalizedEmail, // ✅ Normalized
    },
  },
  update: {
    name: booking.coupleName,
    phone: booking.phone,
  },
  create: {
    tenantId,
    email: normalizedEmail, // ✅ Normalized
    name: booking.coupleName,
    phone: booking.phone,
  },
});
```

### Test Addition

Add test case in `server/test/integration/booking-repository.integration.spec.ts`:

```typescript
it('should treat email case-insensitively for customer upsert', async () => {
  // Create booking with uppercase email
  const booking1 = createBooking({ email: 'John@Example.com' });
  await repository.create(testTenantId, booking1);

  // Create booking with lowercase email - should find same customer
  const booking2 = createBooking({ email: 'john@example.com' });
  await repository.create(testTenantId, booking2);

  // Verify only 1 customer exists
  const customers = await prisma.customer.findMany({
    where: { tenantId: testTenantId },
  });
  expect(customers).toHaveLength(1);
  expect(customers[0].email).toBe('john@example.com');
});
```

---

## Issue #9: Webhook Idempotency Race Condition

### Problem

**File:** `server/src/routes/webhooks.routes.ts:128-129`

```typescript
let tenantId = 'unknown'; // ❌ Default to 'unknown'
```

When `tenantId` cannot be extracted from webhook metadata:

1. Multiple unidentified webhooks use same key `('unknown', eventId)`
2. Cross-tenant data collision possible
3. Idempotency check fails to isolate tenants

### Solution: Fail Fast for Critical Events

For `checkout.session.completed` events, `tenantId` is **required**. Instead of defaulting to 'unknown', reject the webhook:

```typescript
// Extract tenantId from metadata
const tempSession = event.data.object as Stripe.Checkout.Session;
const tenantId = tempSession?.metadata?.tenantId;

// For checkout completion, tenantId is CRITICAL - fail fast
if (!tenantId && event.type === 'checkout.session.completed') {
  logger.error(
    { eventId: event.id, type: event.type, metadata: tempSession?.metadata },
    'CRITICAL: checkout.session.completed webhook missing tenantId in metadata'
  );
  // Return 400 - Stripe will retry, giving us time to fix metadata bug
  throw new ValidationError('Webhook missing required tenantId in metadata', 'MISSING_TENANT_ID');
}

// For non-critical events (payment_intent.created, etc.), use 'system' namespace
const effectiveTenantId = tenantId || 'system';

// Continue with idempotency check using validated tenantId
const isDupe = await this.webhookRepo.isDuplicate(effectiveTenantId, event.id);
```

### Why This Works

1. **Critical events fail fast:** `checkout.session.completed` without `tenantId` returns 400, Stripe retries
2. **Non-critical events isolated:** Use `'system'` namespace instead of `'unknown'` to be explicit
3. **No cross-tenant collision:** `tenantId` is always validated for booking-creating events

### Test Addition

Add test case in `server/test/integration/webhook-race-conditions.spec.ts`:

```typescript
it('should reject checkout.session.completed without tenantId', async () => {
  const event = {
    id: 'evt_test_no_tenant',
    type: 'checkout.session.completed',
    data: {
      object: {
        metadata: {}, // Missing tenantId
      },
    },
  };

  await expect(
    webhooksController.handleStripeWebhook(JSON.stringify(event), validSignature)
  ).rejects.toThrow('MISSING_TENANT_ID');
});

it('should allow non-critical events without tenantId using system namespace', async () => {
  const event = {
    id: 'evt_test_system',
    type: 'payment_intent.created',
    data: { object: { metadata: {} } },
  };

  // Should not throw - uses 'system' namespace
  await webhooksController.handleStripeWebhook(JSON.stringify(event), validSignature);

  // Verify recorded with 'system' tenantId
  const recorded = await prisma.webhookEvent.findFirst({
    where: { eventId: 'evt_test_system' },
  });
  expect(recorded?.tenantId).toBe('system');
});
```

### Database Migration: SKIPPED

Per decision, application-level validation is sufficient. No database constraint needed.

---

## Issue #10: Multiple PrismaClient Instances

### Problem

**Files with duplicate PrismaClient creation:**

| File                                        | Line | Pattern                                   |
| ------------------------------------------- | ---- | ----------------------------------------- |
| `server/src/routes/admin/tenants.routes.ts` | 264  | `const legacyPrisma = new PrismaClient()` |
| `server/src/routes/admin/stripe.routes.ts`  | 213  | `const legacyPrisma = new PrismaClient()` |
| `server/src/routes/index.ts`                | 78   | `prisma ?? new PrismaClient()` (fallback) |

**Impact:**

- Connection pool exhaustion (each instance has separate pool)
- Wasted memory and database connections
- Higher latency from connection initialization

### Solution

#### Step 1: Remove Legacy Exports

**File:** `server/src/routes/admin/tenants.routes.ts`

```typescript
// DELETE these lines (264-265):
// const legacyPrisma = new PrismaClient();
// export default createAdminTenantsRoutes(legacyPrisma);

// KEEP only the factory function export (already exists)
export { createAdminTenantsRoutes };
```

**File:** `server/src/routes/admin/stripe.routes.ts`

```typescript
// DELETE these lines (213-214):
// const legacyPrisma = new PrismaClient();
// export default createAdminStripeRoutes(legacyPrisma);

// KEEP only the factory function export (already exists)
export { createAdminStripeRoutes };
```

#### Step 2: Remove Fallback in index.ts

**File:** `server/src/routes/index.ts:78`

```typescript
// BEFORE
const prismaClient = prisma ?? new PrismaClient();

// AFTER - Require prisma parameter (fail fast if misconfigured)
if (!prisma) {
  throw new Error('PrismaClient is required - ensure DI container provides it');
}
const prismaClient = prisma;
```

#### Step 3: Verify DI Container Provides PrismaClient

**File:** `server/src/di.ts:438`

Already correct - returns `prisma` in container:

```typescript
return { controllers, services, repositories, mailProvider, cacheAdapter, prisma };
```

#### Step 4: Update Any Imports

Search for any imports using the removed default exports:

```bash
grep -r "import.*from.*tenants.routes" server/src/
grep -r "import.*from.*stripe.routes" server/src/
```

Update to use factory function pattern if found.

---

## Implementation Order

### Phase 1: Verification (5 min)

1. **#7 Password Reset** - Run E2E tests to verify existing implementation

### Phase 2: Quick Wins (5 min)

2. **#8 Email Normalization** - Add `.toLowerCase().trim()` to booking email

### Phase 3: Security Fix (15 min)

3. **#9 Webhook Race** - Fail-fast validation for checkout events

### Phase 4: Cleanup (10 min)

4. **#10 PrismaClient** - Remove legacy exports

---

## Acceptance Criteria

### Issue #7: Password Reset UI

- [ ] E2E password reset tests pass (`npm run test:e2e -- e2e/tests/password-reset.spec.ts`)
- [ ] "Forgot Password?" link visible on login page (already exists)
- [ ] Link navigates to `/forgot-password`
- [ ] Full flow works: forgot → email → reset → login

### Issue #8: Email Normalization

- [ ] `booking.email.toLowerCase().trim()` in upsert
- [ ] Test case for case-insensitive customer matching
- [ ] All tests pass

### Issue #9: Webhook Race

- [ ] `checkout.session.completed` without `tenantId` returns error
- [ ] Non-critical events use `'system'` namespace
- [ ] Existing webhook tests pass
- [ ] Add test for missing tenantId scenario

### Issue #10: PrismaClient

- [ ] Legacy exports removed from tenants.routes.ts
- [ ] Legacy exports removed from stripe.routes.ts
- [ ] Fallback in index.ts replaced with assertion
- [ ] All tests pass
- [ ] No duplicate PrismaClient instances in production

---

## Test Plan

```bash
# Run all server tests
npm test

# Run specific integration tests
npm test -- test/integration/booking-repository.integration.spec.ts
npm test -- test/integration/webhook-race-conditions.spec.ts

# Run E2E tests for password reset flow
npm run test:e2e -- e2e/tests/password-reset.spec.ts

# Verify no duplicate PrismaClient in logs
ADAPTERS_PRESET=real npm run dev:api 2>&1 | grep -i "prisma"
```

---

## Files Modified

| File                                                             | Changes                        |
| ---------------------------------------------------------------- | ------------------------------ |
| `client/src/pages/Login.tsx`                                     | Add "Forgot Password?" link    |
| `server/src/adapters/prisma/booking.repository.ts`               | Add `.toLowerCase()` to email  |
| `server/src/routes/webhooks.routes.ts`                           | Fail-fast for missing tenantId |
| `server/src/routes/admin/tenants.routes.ts`                      | Remove legacy export           |
| `server/src/routes/admin/stripe.routes.ts`                       | Remove legacy export           |
| `server/src/routes/index.ts`                                     | Remove fallback PrismaClient   |
| `server/test/integration/booking-repository.integration.spec.ts` | Add email normalization test   |
| `server/test/integration/webhook-race-conditions.spec.ts`        | Add missing tenantId test      |

---

## References

- Todo: `todos/024-pending-p1-password-reset-ui-missing.md`
- Todo: `todos/022-pending-p1-customer-email-normalization.md`
- Todo: `todos/023-pending-p1-webhook-idempotency-race.md`
- Todo: `todos/025-pending-p1-multiple-prisma-instances.md`
- ADR-002: Webhook Idempotency (DECISIONS.md)
- Multi-tenant patterns: `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`
