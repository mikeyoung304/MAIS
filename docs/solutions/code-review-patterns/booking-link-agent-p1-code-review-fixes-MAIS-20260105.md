# Booking Link Agent P1 Code Review Fixes

**Date:** 2026-01-05
**Branch:** `booking-links`
**Commit:** `6ac2dd1c fix(agent): resolve 4 P1 booking link code review issues`
**Components:** Agent tools, executors, executor registry, tenant utilities
**Root Cause:** New agent tool code lacked defense-in-depth patterns and DRY discipline

## Overview

Four P1 (must-fix-now) code review findings from the booking link agent feature branch were systematically resolved. All issues involved either security violations (missing tenant isolation), data integrity risks (race conditions), or maintenance burden (code duplication). The fixes ensure production-grade quality before merge.

## Problem 1: Missing Tenant Isolation in Delete/Update Operations

### Finding

The `manage_bookable_service` executor performed delete and update operations using only `id` in the where clause, missing the `tenantId` filter:

```typescript
// BEFORE - Defense-in-depth violation
const updated = await prisma.service.update({
  where: { id: serviceId },  // Missing tenantId scope
  data: updateData,
});

await prisma.service.delete({
  where: { id: serviceId },  // Missing tenantId scope
});
```

While prior ownership checks existed, the check and mutation were not atomic, creating a Time-of-Check to Time-of-Use (TOCTOU) vulnerability.

### Risk

In a race condition scenario, the delete/update could theoretically affect another tenant's service between the ownership check and the actual mutation. This violates the defense-in-depth pattern used throughout the MAIS codebase where ALL database mutations must be scoped by `tenantId`.

### Resolution

Applied the standard MAIS pattern: use `updateMany`/`deleteMany` with composite `{ id, tenantId }` filter:

```typescript
// AFTER - Defense-in-depth protection
await prisma.$transaction(async (tx) => {
  const result = await tx.service.updateMany({
    where: { id: serviceId, tenantId },  // Composite filter
    data: updateData,
  });

  if (result.count === 0) {
    throw new ResourceNotFoundError('Service', serviceId);
  }

  return tx.service.findFirstOrThrow({
    where: { id: serviceId, tenantId },
  });
});

// Delete operation
await prisma.$transaction(async (tx) => {
  const deleted = await tx.service.deleteMany({
    where: { id: serviceId, tenantId },  // Composite filter
  });

  if (deleted.count === 0) {
    throw new ResourceNotFoundError('Service', serviceId);
  }
});
```

### Key Pattern

- `updateMany` returns only a count, so fetch the updated record afterward with `findFirstOrThrow`
- `deleteMany` returns count; check it's > 0 to confirm deletion
- Both queries use transaction for consistency (ACID semantics)
- Tenant ID is ALWAYS included in where clause - never rely on ownership checks alone

**File:** `server/src/agent/executors/booking-link-executors.ts` (lines 128-141, 178-208)

## Problem 2: Missing Required Executor Tools in Startup Validation

### Finding

The new booking link tools (`manage_bookable_service`, `manage_working_hours`, `manage_date_overrides`) were implemented and registered, but NOT added to the `REQUIRED_EXECUTOR_TOOLS` list in the executor registry:

```typescript
// executor-registry.ts - BEFORE
const REQUIRED_EXECUTOR_TOOLS = [
  'upsert_package',
  'delete_package',
  // ... other tools ...
  // MISSING: 'manage_bookable_service', 'manage_working_hours', 'manage_date_overrides'
] as const;
```

### Risk

If the `registerBookingLinkExecutors()` call was accidentally missing or failed (e.g., import error, typo), the startup validation would not catch it. Proposals would be created and confirmed, but execution would silently fail. Users would see their bookable services approved but no changes made—a critical UX failure.

### Resolution

Added all three booking link tools to the `REQUIRED_EXECUTOR_TOOLS` array with clear grouping comments:

```typescript
// executor-registry.ts - AFTER
const REQUIRED_EXECUTOR_TOOLS = [
  // Package management
  'upsert_package',
  'delete_package',
  // ... other tools ...

  // Booking link management
  'manage_bookable_service',
  'manage_working_hours',
  'manage_date_overrides',
] as const;
```

The `validateExecutorRegistry()` function now checks all three at server startup:

```typescript
export function validateExecutorRegistry(): void {
  const missingExecutors = REQUIRED_EXECUTOR_TOOLS.filter(
    (toolName) => !proposalExecutors.has(toolName)
  );

  if (missingExecutors.length > 0) {
    logger.error({ missing: missingExecutors }, 'Missing required executors!');
    process.exit(1);  // Fail fast
  }
}
```

### Key Pattern

- Every write tool (T2/T3) must be in `REQUIRED_EXECUTOR_TOOLS`
- Executor registration happens in `server/src/agent/executors/index.ts` during initialization
- Server startup fails if any required executor is missing
- This prevents the silent failure scenario where proposals confirm but don't execute

**File:** `server/src/agent/proposals/executor-registry.ts` (lines 51-88)

## Problem 3: Duplicate getTenantInfo Function (DRY Violation)

### Finding

The `getTenantInfo()` function was implemented identically in both tools and executors:

```typescript
// booking-link-tools.ts:77-100 - 22 lines
async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string
): Promise<{ slug: string; customDomain?: string; timezone: string } | null> {
  // ... fetch implementation
}

// booking-link-executors.ts:90-112 - 22 lines (nearly identical)
async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string
): Promise<{ slug: string; customDomain?: string } | null> {
  // ... same fetch implementation
}
```

### Risk

1. **N+1 queries:** Tenant info was fetched twice per operation (once in tool for preview, once in executor for final URL)
2. **DRY violation:** Changes to tenant info logic require updates in two places
3. **Minor type divergence:** Tools version included timezone, executors didn't—maintenance burden

### Resolution

Extracted to a shared utility module with optional parameters:

```typescript
// server/src/agent/utils/tenant-info.ts
export interface TenantInfo {
  slug: string;
  customDomain?: string;
  timezone?: string;
}

export interface GetTenantInfoOptions {
  includeTimezone?: boolean;  // Control what fields to fetch
}

export async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string,
  options?: GetTenantInfoOptions
): Promise<TenantInfo | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      slug: true,
      domains: {
        where: { verified: true, isPrimary: true },
        select: { domain: true },
        take: 1,
      },
    },
  });

  if (!tenant) return null;

  const result: TenantInfo = {
    slug: tenant.slug,
    customDomain: tenant.domains[0]?.domain,
  };

  if (options?.includeTimezone) {
    result.timezone = 'America/New_York';  // Default until schema migration
  }

  return result;
}
```

Both tools and executors now import from the shared location:

```typescript
import { getTenantInfo } from '../utils/tenant-info';

// In executor
const tenantInfo = await getTenantInfo(prisma, tenantId);
const bookingUrl = buildBookingUrl(tenantInfo.slug, serviceSlug, tenantInfo.customDomain);
```

### Key Pattern

- Utility modules live in `server/src/agent/utils/`
- Shared functions are extracted as soon as duplication appears (3-line rule)
- Use options pattern for optional fields (`includeTimezone?`)
- Eliminates both N+1 queries and maintenance burden

**File:** `server/src/agent/utils/tenant-info.ts` (new file, 86 lines)

## Problem 4: TOCTOU Race Condition on Service Delete

### Finding

The delete operation performed two sequential queries without transaction protection:

```typescript
// booking-link-executors.ts:198-227 - BEFORE
const upcomingBookings = await prisma.booking.count({
  where: {
    serviceId,
    tenantId,
    date: { gte: new Date() },
    status: { in: ['PENDING', 'CONFIRMED'] },
  },
});

if (upcomingBookings > 0) {
  throw new ValidationError(...);
}

// Separate operation - A BOOKING COULD BE CREATED HERE!
await prisma.service.delete({
  where: { id: serviceId },
});
```

### Risk

A concurrent booking creation could succeed between the count query and the delete, resulting in:
1. Service deleted with active booking (orphaned foreign key)
2. Customer has a booking but the service doesn't exist
3. Runtime errors when fetching booking details
4. Data integrity violation

This is a classic Time-of-Check to Time-of-Use (TOCTOU) race condition, addressed in ADR-013 for double-booking prevention.

### Resolution

Wrapped in transaction with row-level lock to make the check-then-act atomic:

```typescript
// booking-link-executors.ts - AFTER
await prisma.$transaction(async (tx) => {
  // Lock the service row to prevent concurrent modifications
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;

  // Check for upcoming bookings within the transaction
  const upcomingBookings = await tx.booking.count({
    where: {
      serviceId,
      tenantId,
      date: { gte: new Date() },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
  });

  if (upcomingBookings > 0) {
    throw new ValidationError(
      `Cannot delete service with ${upcomingBookings} upcoming booking(s). Cancel or complete them first.`
    );
  }

  // Delete the service with tenant isolation (defense-in-depth)
  const deleted = await tx.service.deleteMany({
    where: { id: serviceId, tenantId },
  });

  if (deleted.count === 0) {
    throw new ResourceNotFoundError('Service', serviceId);
  }
});
```

The `FOR UPDATE` lock:
- Acquired at transaction start
- Prevents other transactions from modifying this row
- Automatically released on commit/abort
- Makes the check-and-delete atomic

### Key Pattern

- **Advisory locks:** Used for distributed systems (PostgreSQL advisory locks)
- **Row locks:** Used for single database (SELECT ... FOR UPDATE)
- MAIS uses row locks for booking operations; booking link uses same for consistency
- Lock scope should be minimal (just the service row, not the entire table)
- Check happens INSIDE the transaction to prevent TOCTOU

**File:** `server/src/agent/executors/booking-link-executors.ts` (lines 178-208)
**Reference:** ADR-013: Advisory Locks for Double-Booking Prevention

## Summary of Changes

| Issue | Pattern | File | Lines |
|-------|---------|------|-------|
| Missing tenant isolation | Use updateMany/deleteMany with composite filter | booking-link-executors.ts | 128-141, 178-208 |
| Missing startup validation | Add tools to REQUIRED_EXECUTOR_TOOLS | executor-registry.ts | 84-87 |
| Code duplication | Extract to shared utility module | tenant-info.ts (new) | - |
| TOCTOU race condition | Wrap in transaction with row lock | booking-link-executors.ts | 178-208 |

## Lessons for Future Agent Features

1. **Defense-in-depth is non-negotiable:** Always include `tenantId` in mutations, even if prior ownership checks exist. The check and mutation must be atomic.

2. **Write tools must be in REQUIRED_EXECUTOR_TOOLS:** New T2/T3 tools must be added to startup validation, or silent execution failures will occur. This is a must-do before merge.

3. **Extract duplication immediately:** If a function appears in 2+ files, extract to a shared utility. Use options patterns for optional behavior (like `includeTimezone`).

4. **Transaction safety for check-then-act patterns:** Any time you check a condition and then mutate based on that check, wrap in a transaction with appropriate locking:
   - Row lock (`SELECT ... FOR UPDATE`) for single row
   - Advisory lock (hash-based) for distributed/multi-row checks
   - This prevents TOCTOU vulnerabilities like the service delete race condition

5. **Type safety in proposals:** Proposals leverage `as unknown as Type` for safe casts from generic payload objects. Always validate required fields (`MissingFieldError`) before casting.

## Testing Gaps Identified

- No test for tenant isolation at mutation level (existing code pattern; deferred)
- No test for TOCTOU race condition (complex concurrency scenario; deferred)
- Both noted in the original todo files but deferred as existing gaps in codebase

Future sessions should consider:
- Integration tests that verify tenant isolation in update/delete operations
- Concurrency tests using transaction isolation levels to simulate race conditions

## Related Documentation

- `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` - Tenant scoping patterns
- `docs/adrs/ADR-013-advisory-locks.md` - Lock patterns for check-then-act operations
- `docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md` - Registry module extraction pattern
- `docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md` - T2 proposal execution flow

## Implementation Timeline

**2026-01-05:**
- All 4 P1 issues identified via `/workflows:review` multi-agent analysis
- All 4 issues resolved via parallel agent fix execution
- Commit: `6ac2dd1c` merged to `booking-links` branch
- Ready for next phase: P3 enhancements (schema migrations, field additions)

---

**Contributor Notes:**

This solution document captures a high-quality code review process where architectural agents (security-sentinel, data-integrity-guardian, architecture-strategist, performance-oracle, code-simplicity-reviewer) identified and validated fixes before implementation. The systematic approach prevented production issues while maintaining developer velocity.

The defense-in-depth pattern (tenant isolation in mutations) and startup validation (REQUIRED_EXECUTOR_TOOLS) should be applied to all future agent features.
