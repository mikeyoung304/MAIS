---
status: complete
priority: p2
issue_id: '632'
tags: [code-review, tenant-onboarding, auth, error-handling]
dependencies: []
---

# Stricter Signup Error Handling for Onboarding Failures

## Problem Statement

The auth signup flow catches onboarding errors and logs a warning but allows signup to complete successfully. This means a tenant can log in to an empty storefront with no packages, creating a broken user experience.

**Why it matters:**

- Tenant gets JWT and can login without packages
- Storefront catalog is empty - booking flow broken
- Silent degradation - tenant unaware of the issue
- May require manual intervention to fix

## Findings

### Evidence from Auth Routes Analysis

**Location:** `server/src/routes/auth.routes.ts` (lines 442-457)

**Current Code - Silent Degradation:**

```typescript
if (tenantOnboardingService) {
  try {
    await tenantOnboardingService.createDefaultData({ tenantId: tenant.id });
  } catch (defaultDataError) {
    // Don't fail signup if default data creation fails
    // The tenant can still create their own packages manually
    logger.warn(
      {
        tenantId: tenant.id,
        error: defaultDataError,
      },
      'Failed to create default segment/packages'
    );
  }
}
```

**Issue:** Comment says "tenant can create packages manually" but:

- New tenants don't know they need to
- Storefront is broken until they do
- No notification that anything went wrong

### Failure Scenario

```
1. Tenant signs up ✅
2. Segment creation succeeds ✅
3. Package creation fails (constraint violation?) ❌
4. Transaction rolls back (no segment or packages)
5. Error caught, warning logged ⚠️
6. Signup completes with JWT ✅
7. Tenant logs in, sees empty storefront 💔
```

## Proposed Solutions

### Option A: Fail Signup on Onboarding Error (Strict)

**Pros:** Guarantees complete setup, clear failure mode
**Cons:** Signup could fail for non-critical reasons
**Effort:** Small
**Risk:** Medium (may block legitimate signups)

```typescript
if (tenantOnboardingService) {
  try {
    await tenantOnboardingService.createDefaultData({ tenantId: tenant.id });
  } catch (defaultDataError) {
    // Roll back tenant creation
    await tenantRepo.delete(tenant.id);
    logger.error(
      { tenantId: tenant.id, error: defaultDataError },
      'Signup failed: could not create default packages'
    );
    return { status: 500, body: { error: 'Signup failed. Please try again.' } };
  }
}
```

### Option B: Retry with Exponential Backoff (Recommended)

**Pros:** Handles transient failures, maintains graceful degradation
**Cons:** Adds latency on failure
**Effort:** Small
**Risk:** Low

```typescript
const MAX_RETRIES = 3;
let lastError: Error | null = null;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    await tenantOnboardingService.createDefaultData({ tenantId: tenant.id });
    break; // Success
  } catch (error) {
    lastError = error;
    if (attempt < MAX_RETRIES) {
      await sleep(100 * Math.pow(2, attempt)); // 200ms, 400ms, 800ms
    }
  }
}

if (lastError) {
  logger.warn(
    { tenantId, retries: MAX_RETRIES, error: lastError },
    'Onboarding failed after retries - tenant has no packages'
  );
  // Could also: queue background job to retry later
}
```

### Option C: Background Retry Job

**Pros:** Non-blocking, eventual consistency
**Cons:** More complex, requires job queue
**Effort:** Medium
**Risk:** Low

On failure, queue a background job to retry onboarding:

```typescript
await jobQueue.add(
  'retry-tenant-onboarding',
  { tenantId },
  {
    attempts: 5,
    backoff: { type: 'exponential', delay: 60000 },
  }
);
```

### Option D: Add Health Check Alert (Monitoring)

**Pros:** Catches issues in production, no code path changes
**Cons:** Reactive not preventive
**Effort:** Small
**Risk:** Low

Add metric/alert for tenants without packages:

```typescript
// Cron job or health check
const tenantsWithoutPackages = await prisma.tenant.findMany({
  where: {
    packages: { none: {} },
    createdAt: { lt: subHours(new Date(), 1) }, // Created >1 hour ago
  },
});
if (tenantsWithoutPackages.length > 0) {
  alertOps('Tenants without packages found', tenantsWithoutPackages);
}
```

## Recommended Action

**Option A** - Fail signup atomically (use shared TenantProvisioningService from #630)

### Triage Notes (2026-01-05)

**Reviewer Split:**

- DHH: Option A (fail signup, atomic transaction)
- TypeScript: Option D+A (health check + graceful)
- Simplicity: Close as duplicate of #630

**Decision: Option A** - Merge with #630 implementation. Use same `TenantProvisioningService.createFullyProvisioned()` with transaction rollback.

**Implementation Guidance:**

- This is essentially the same fix as #630 applied to auth signup
- Refactor auth signup to use `TenantProvisioningService`
- Transaction ensures atomic: tenant + segment + packages all created or none
- No retry logic needed - if onboarding fails, transaction rolls back cleanly

**Key Quote (DHH):** "Fail fast, fail loud, fail atomically."

**Note:** If #630 is implemented correctly with shared service, this becomes a ~5 line change in auth.routes.ts

## Technical Details

**Affected Files:**

- `server/src/routes/auth.routes.ts` - Add retry logic
- `server/src/lib/monitoring/` - Add health check (new)

**Related Files:**

- `server/src/services/tenant-onboarding.service.ts` - Called service
- `server/src/di.ts` - Service injection

## Acceptance Criteria

- [x] Auth signup uses `TenantProvisioningService.createFromSignup()` (already done)
- [x] Signup wrapped in `prisma.$transaction()` (in TenantProvisioningService)
- [x] If onboarding fails, signup fails (no partial tenant)
- [x] Clear error message returned to user on failure
- [x] Existing signup tests pass
- [x] New test: signup fails cleanly if onboarding fails
- [x] New test: no tenant record exists after failed signup

## Work Log

| Date       | Action                                 | Learnings                                     |
| ---------- | -------------------------------------- | --------------------------------------------- |
| 2026-01-05 | Created from system review             | Silent degradation can create broken tenants  |
| 2026-01-05 | Triaged by 3 reviewers                 | Merge with #630, use shared service           |
| 2026-01-09 | Implemented TenantProvisioningError    | Added specific error type for atomic failures |
| 2026-01-09 | Updated provisioning service           | Errors now throw TenantProvisioningError      |
| 2026-01-09 | Improved auth.routes.ts error handling | Differentiates provisioning from other errors |
| 2026-01-09 | Added comprehensive test suite         | Tests for error handling and rollback         |

## Implementation Summary

### Changes Made

1. **New Error Type**: `TenantProvisioningError` (`server/src/lib/errors/business.ts`)
   - Specific error for atomic tenant provisioning failures
   - Includes original error as `cause` for debugging
   - Returns user-friendly message: "Failed to complete signup. Please try again."
   - HTTP status code 422 with code `TENANT_PROVISIONING_ERROR`

2. **Enhanced Provisioning Service** (`server/src/services/tenant-provisioning.service.ts`)
   - `createFromSignup()` now catches errors and throws `TenantProvisioningError`
   - Detailed error logging for debugging (slug, email, original error message/stack)
   - Transaction ensures atomic rollback on any failure

3. **Better Error Logging** (`server/src/routes/auth.routes.ts`)
   - Differentiates between critical (provisioning) and expected (validation) errors
   - Critical errors log at ERROR level with event `tenant_provisioning_failed`
   - Includes original cause for internal debugging
   - Clear message: "Tenant provisioning failed - signup aborted, no partial tenant created"

4. **Comprehensive Tests** (`server/test/services/tenant-provisioning.service.test.ts`)
   - Tests successful atomic creation (tenant + segment + 3 packages)
   - Tests that `TenantProvisioningError` is thrown on failure
   - Tests that original error is preserved as cause
   - Tests that no partial tenant data exists after failure
   - Tests error code for HTTP handler compatibility

## Resources

- System Review: Tenant Packages & Segments Architecture
- Pattern: Retry with exponential backoff
- Monitoring: Datadog/CloudWatch alert patterns
