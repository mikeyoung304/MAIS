# Booking Links Phase 0: Prevention Strategies

**Date:** 2026-01-05
**Issues Fixed:** 617-620 (4 P1 issues)
**Categories:** Multi-tenant isolation, startup validation, code duplication, race conditions

---

## Executive Summary

The Booking Links Phase 0 implementation introduced 4 critical P1 issues that were discovered and fixed during code review:

| ID  | Issue | Category | Pattern |
|-----|-------|----------|---------|
| 617 | Missing tenantId in delete/update mutations | Security | Defense-in-depth |
| 618 | Tools not in REQUIRED_EXECUTOR_TOOLS | Architecture | Validation |
| 619 | Duplicate getTenantInfo function | Maintainability | DRY |
| 620 | TOCTOU race condition on service delete | Data integrity | Atomicity |

This document captures **prevention strategies** to avoid repeating these patterns in future agent tool implementations.

---

## Prevention Strategy 1: Multi-Tenant Isolation Checklist

### Problem
Services were deleted/updated using only `id` in the where clause, missing the `tenantId` filter. While prior ownership checks existed, they created a TOCTOU race condition window.

### Root Cause
- Ownership checks done outside the mutation operation
- Assumption that initial check is sufficient for security
- Not following defense-in-depth principle (validate at multiple layers)

### Prevention Checklist

Use this checklist **before opening a PR** with new agent tools:

```markdown
## Tenant Isolation Verification (CRITICAL)

### For DELETE operations:
- [ ] Using `deleteMany()` with `where: { id, tenantId }`
- [ ] NOT using `delete()` with only `id`
- [ ] Checking deleted.count to verify success
- [ ] Wrapped in transaction if doing prior checks
- [ ] Error message doesn't leak internal details

### For UPDATE operations:
- [ ] Using `updateMany()` with `where: { id, tenantId }`
- [ ] NOT using `update()` with only `id`
- [ ] Checking result.count to verify success
- [ ] Fetching updated record within same transaction if needed
- [ ] All where clauses include tenantId (defense-in-depth)

### For SELECT operations:
- [ ] Using `findFirst()` or `findMany()` with tenantId
- [ ] Using `select()` to limit exposed fields
- [ ] Not returning full record if only reading a field

### Pattern Template (DELETE):
```typescript
// WRONG - Missing tenantId
await prisma.service.delete({ where: { id: serviceId } });

// CORRECT - Defense-in-depth with transaction + lock
await prisma.$transaction(async (tx) => {
  // Lock prevents concurrent modifications
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;

  // Check constraints within transaction
  const hasDependents = await tx.booking.count({ where: { serviceId } });
  if (hasDependents > 0) throw new ValidationError(...);

  // Delete with tenant isolation
  const deleted = await tx.service.deleteMany({
    where: { id: serviceId, tenantId }
  });

  if (deleted.count === 0) throw new ResourceNotFoundError(...);
});
```

### Pattern Template (UPDATE):
```typescript
// WRONG - Missing tenantId
const updated = await prisma.service.update({
  where: { id: serviceId },
  data: updateData,
});

// CORRECT - Transaction + updateMany + tenant scope
const updated = await prisma.$transaction(async (tx) => {
  const result = await tx.service.updateMany({
    where: { id: serviceId, tenantId },
    data: updateData,
  });

  if (result.count === 0) throw new ResourceNotFoundError(...);

  return tx.service.findFirstOrThrow({
    where: { id: serviceId, tenantId }
  });
});
```

### Code Review Verification
Reviewers should:
- [ ] Check every `delete()`, `deleteMany()`, `update()`, `updateMany()` call
- [ ] Verify tenantId is in the where clause (not just in prior check)
- [ ] Look for deleteMany/updateMany missing count checks
- [ ] Verify operations are in same transaction as checks

---

## Prevention Strategy 2: Executor Registry Validation

### Problem
New booking link tools were implemented but NOT added to `REQUIRED_EXECUTOR_TOOLS`, meaning server startup wouldn't catch if executors failed to register. Proposals would silently fail to execute.

### Root Cause
- New tools added to tools file but registry not updated
- No single source of truth for "what tools need executors"
- No compile-time check (all strings)

### Prevention Checklist

When adding new write tools:

```markdown
## Executor Registry Verification (STARTUP VALIDATION)

### Step 1: Add to REQUIRED_EXECUTOR_TOOLS
In `server/src/agent/proposals/executor-registry.ts`:
- [ ] Tool name added to REQUIRED_EXECUTOR_TOOLS array
- [ ] Grouped with related tools (comments for organization)
- [ ] Tool is a T2 or T3 (read-only T1 tools don't need executors)

### Step 2: Register Executor
In `server/src/agent/executors/index.ts` or dedicated executor file:
- [ ] `registerProposalExecutor(toolName, executorFn)` called
- [ ] Executor validates tenantId on all mutations
- [ ] Executor throws clear errors on validation failure

### Step 3: Verify Startup
In `server/src/server.ts` or initialization:
- [ ] `validateExecutorRegistry()` called during startup
- [ ] Server fails to start if any executor missing (not graceful)
- [ ] Error message lists which tools are missing

### Step 4: Test Registration
- [ ] Unit test calls `validateExecutorRegistry()` with all tools
- [ ] Test would fail if executor is missing
- [ ] Integration test creates proposal + executes it

### Executor Registration Pattern:
```typescript
// File: server/src/agent/executors/booking-link-executors.ts

export function registerBookingLinkExecutors(prisma: PrismaClient): void {
  registerProposalExecutor('manage_bookable_service', async (tenantId, payload) => {
    // Implementation
  });

  registerProposalExecutor('manage_working_hours', async (tenantId, payload) => {
    // Implementation
  });

  registerProposalExecutor('manage_date_overrides', async (tenantId, payload) => {
    // Implementation
  });
}
```

### Registry Entry Pattern:
```typescript
// File: server/src/agent/proposals/executor-registry.ts

const REQUIRED_EXECUTOR_TOOLS = [
  // ... existing tools ...

  // Booking link management (Phase 0)
  'manage_bookable_service',
  'manage_working_hours',
  'manage_date_overrides',
] as const;
```

### Code Review Verification
Reviewers should:
- [ ] Search for all `registerProposalExecutor()` calls in new code
- [ ] Verify each call's tool name is in REQUIRED_EXECUTOR_TOOLS
- [ ] Verify REQUIRED_EXECUTOR_TOOLS tool name matches executor registration
- [ ] Confirm validateExecutorRegistry() is called at startup

---

## Prevention Strategy 3: Code Duplication (DRY Violations)

### Problem
`getTenantInfo()` implemented identically in both tools and executors, causing:
- 2 database queries per operation (N+1 pattern)
- Maintenance burden (changes in 2 places)
- Potential divergence (tools included timezone, executors didn't)

### Root Cause
- Utility not extracted early in implementation
- No code review gate catching duplication
- Each file developed independently

### Prevention Checklist

```markdown
## DRY Verification (MAINTAINABILITY)

### Identify Duplication
- [ ] Search for shared patterns: `getTenant`, `loadContext`, etc.
- [ ] Look for >5 lines duplicated across files
- [ ] Check if multiple files query same database tables
- [ ] Verify function signatures match (except parameter names)

### Extract to Shared Utility
Location: `server/src/agent/utils/` (new module for agent utilities)

```typescript
// server/src/agent/utils/tenant-info.ts

export interface TenantInfo {
  slug: string;
  customDomain?: string;
  timezone?: string; // Optional, fetched if requested
}

export interface GetTenantInfoOptions {
  includeTimezone?: boolean;
}

export async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string,
  options?: GetTenantInfoOptions
): Promise<TenantInfo | null> {
  // Single source of truth
}
```

### Update Consumers
- [ ] Tools import from utils: `import { getTenantInfo } from '../utils/tenant-info'`
- [ ] Executors import from utils: `import { getTenantInfo } from '../utils/tenant-info'`
- [ ] Delete original duplicates
- [ ] Verify all consumers use same signature

### Test the Utility
- [ ] Unit test `getTenantInfo()` in isolation
- [ ] Test with/without includeTimezone option
- [ ] Test null case (tenant not found)
- [ ] Verify database query optimization (using select)

### Common Duplication Patterns in Agent Code

1. **Tenant Info Fetching**
   - Used in: tools (for previews), executors (for final URLs)
   - Solution: Extract to `getTenantInfo()`

2. **Proposal Creation**
   - Used in: multiple tool implementations
   - Solution: Extract to `createProposal()` helper
   - Reference: `booking-link-tools.ts:44-73`

3. **Error Handling**
   - Used in: all tools when operation fails
   - Solution: Extract to `handleToolError()`
   - Reference: `booking-link-tools.ts` uses shared `handleToolError` from utils

4. **Permission Checks**
   - Used in: multiple executors
   - Solution: Extract to `verifyTenantOwnership()`
   - Pattern: `where: { id, tenantId }` used as verification

### Code Review Verification
Reviewers should:
- [ ] Search codebase for similar function names (getTenant, getTenantInfo, etc.)
- [ ] Check if >1 file implements same logic
- [ ] Look for database queries executed multiple times for same data
- [ ] Suggest extraction if code is duplicated (>5 lines)
- [ ] Verify imports are from single shared location

---

## Prevention Strategy 4: Race Condition Detection (TOCTOU)

### Problem
Service delete checked for bookings then deleted in separate operations, allowing a race condition:
1. Check for bookings (count = 0)
2. Another process creates a booking (race window)
3. Delete succeeds, orphaning the booking

### Root Cause
- Check and mutation operations not atomic
- No row-level locking between check and mutation
- Assumption that quick succession prevents race

### Prevention Checklist

```markdown
## Race Condition Prevention (DATA INTEGRITY)

### Identify TOCTOU Patterns
- [ ] Look for check followed by mutation (not in same transaction)
- [ ] Verify existence check followed by use of resource
- [ ] Check for count() followed by deleteMany/updateMany
- [ ] Look for findFirst/findUnique not in same transaction as mutation

### Pattern: Check-Then-Act
WRONG - Race condition window between check and mutation:
```typescript
// VULNERABLE to race condition
const existing = await prisma.booking.count({ where: { serviceId } });
if (existing > 0) throw new Error(...);

// Another process could create a booking here (race window)

await prisma.service.delete({ where: { id: serviceId } });
```

CORRECT - Atomic with transaction + lock:
```typescript
await prisma.$transaction(async (tx) => {
  // Step 1: Acquire row-level lock (prevents other transactions from modifying)
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;

  // Step 2: Check constraint (now safe, row is locked)
  const existing = await tx.booking.count({ where: { serviceId } });
  if (existing > 0) throw new Error(...);

  // Step 3: Mutate (row still locked)
  await tx.service.delete({ where: { id: serviceId } });
});
```

### Lock Types Available

1. **Row-level lock (FOR UPDATE)**
   - Use for: Single resource operations (delete service, update record)
   - Duration: Held until transaction commits
   - Cost: Moderate (1-2 queries to acquire)
   - Pattern: `SELECT id FROM "Table" WHERE id = ${id} FOR UPDATE`

2. **Advisory locks**
   - Use for: Cross-table coordination (booking coordination across tables)
   - Duration: Held until transaction commits
   - Cost: Low (virtual lock, no table contention)
   - Pattern: `SELECT pg_advisory_xact_lock(hashValue)`
   - Reference: `booking.service.ts` uses for double-booking prevention

3. **Transaction isolation level**
   - Use for: Entire transaction consistency
   - Duration: Until transaction commits
   - Cost: Varies by isolation level
   - Default: READ_COMMITTED (sufficient for most cases)

### Apply to Common Patterns

**Pattern: Delete with dependent check**
```typescript
// Apply: Row lock
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT id FROM "Table" WHERE id = ${id} FOR UPDATE`;
  const dependents = await tx.dependent.count({ where: { parentId: id } });
  if (dependents > 0) throw new Error(...);
  await tx.table.delete({ where: { id } });
});
```

**Pattern: Update with concurrent modification check**
```typescript
// Apply: Version field + row lock
await prisma.$transaction(async (tx) => {
  const current = await tx.table.findFirst({ where: { id } });
  const updated = await tx.table.updateMany({
    where: { id, version: current.version },
    data: { ...updates, version: current.version + 1 }
  });
  if (updated.count === 0) throw new ConflictError('Modified by another process');
  return updated;
});
```

### Code Review Verification
Reviewers should:
- [ ] Find all `await prisma.X.count()` calls
- [ ] Check if followed by delete/update in same transaction
- [ ] Verify transactions use locking (FOR UPDATE or advisory)
- [ ] Look for comments documenting lock strategy
- [ ] Check error messages explain the constraint clearly

---

## Prevention Strategy 5: Code Review Patterns

### Multi-Tier Code Review for Agent Tools

Use `/workflows:review` to run automated reviewers before manual review:

```bash
npm run workflow -- review \
  --focus "agent-tools" \
  --checklist multi-tenant \
  --checklist executor-registry \
  --checklist dry-violations \
  --checklist race-conditions
```

### Reviewer Checklist

**Security Reviewer** (multi-tenant isolation):
```markdown
- [ ] Every mutation has tenantId in where clause
- [ ] Mutations use deleteMany/updateMany (not delete/update)
- [ ] Ownership checks are IN SAME TRANSACTION as mutation
- [ ] Error messages don't leak cross-tenant data
- [ ] SELECT queries use select() to limit fields
```

**Architecture Reviewer** (system patterns):
```markdown
- [ ] New tools added to REQUIRED_EXECUTOR_TOOLS
- [ ] Executors registered in registerAllExecutors()
- [ ] No circular dependencies (check: madge --circular)
- [ ] Tools follow trust tier pattern (T1=read, T2=soft-confirm, T3=user-confirm)
- [ ] Error types are domain-specific (not generic)
```

**Performance Reviewer** (efficiency):
```markdown
- [ ] No N+1 query patterns (e.g., getTenantInfo called twice)
- [ ] Shared utilities used (not duplicated)
- [ ] Batch operations used for multiple records
- [ ] Database queries use select() to limit fields
- [ ] No unnecessary transactions (only for atomicity)
```

**Data Integrity Reviewer** (consistency):
```markdown
- [ ] Check-then-act patterns use row locks
- [ ] Deletes with constraints wrapped in transactions
- [ ] Foreign key relationships maintained
- [ ] Concurrent modification handled gracefully
- [ ] Error recovery is safe (no partial updates)
```

---

## Prevention Strategy 6: Test Patterns

### Unit Tests for Agent Tools

```typescript
// server/src/agent/tools/__tests__/booking-link-tools.test.ts

describe('manageBookableServiceTool', () => {
  describe('tenant isolation', () => {
    it('should fail if service belongs to different tenant', async () => {
      const result = await tool.invoke({
        operation: 'update',
        serviceId: otherTenantService.id,
        // ... updates
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Service not found', // Don't leak "belongs to other tenant"
      });
    });
  });

  describe('error handling', () => {
    it('should return clear user message for validation errors', async () => {
      const result = await tool.invoke({
        operation: 'delete',
        serviceId: serviceWithBookings.id,
      });

      expect(result.error).toContain('upcoming booking');
      expect(result.error).not.toContain('internal'); // No stack traces
    });
  });
});
```

### Integration Tests for Executors

```typescript
// server/src/agent/executors/__tests__/booking-link-executors.test.ts

describe('manage_bookable_service executor', () => {
  describe('tenant isolation', () => {
    it('should not update service from different tenant', async () => {
      const result = await executor(otherTenantId, {
        operation: 'update',
        serviceId: myService.id,
        updates: { name: 'Hacked' }
      });

      expect(result).toMatchObject({
        success: false,
        error: 'Service not found'
      });

      // Verify service NOT modified
      const service = await prisma.service.findUnique({ where: { id: myService.id } });
      expect(service.name).toBe('Original Name');
    });
  });

  describe('race condition prevention', () => {
    it('should prevent delete if booking created during operation', async () => {
      // This is hard to test directly, but can verify:
      // 1. Delete wrapped in transaction
      // 2. Row lock applied
      // 3. Check and delete are atomic

      const deletePromise = executor(tenantId, {
        operation: 'delete',
        serviceId: service.id,
      });

      // Would need to test actual concurrency, often skipped as "integration test complexity"
    });
  });

  describe('executor registry', () => {
    it('should be registered at startup', () => {
      const executor = getProposalExecutor('manage_bookable_service');
      expect(executor).toBeDefined();
    });
  });
});
```

### Startup Validation Test

```typescript
// server/src/agent/proposals/__tests__/executor-registry.test.ts

describe('Executor Registry Validation', () => {
  it('should have all required executors registered', () => {
    // Call registerAllExecutors() first
    registerAllExecutors(prisma);
    registerBookingLinkExecutors(prisma);

    // This should not throw
    expect(() => validateExecutorRegistry()).not.toThrow();
  });

  it('should fail if executor missing', () => {
    // Don't register booking link executors
    registerAllExecutors(prisma);

    expect(() => validateExecutorRegistry()).toThrow(/manage_bookable_service/);
  });
});
```

### Cross-Tenant Security Test

```typescript
// server/test/integration/booking-links-tenant-isolation.spec.ts

test('should prevent cross-tenant service manipulation', async () => {
  // Create two tenants
  const tenant1 = await createTestTenant();
  const tenant2 = await createTestTenant();

  // Create service in tenant1
  const service = await prisma.service.create({
    data: {
      tenantId: tenant1.id,
      name: 'Tenant 1 Service',
      slug: 'service-1',
      // ...
    },
  });

  // Try to update service with tenant2 credentials
  const result = await executor(tenant2.id, {
    operation: 'update',
    serviceId: service.id,
    updates: { name: 'Hacked by Tenant 2' }
  });

  expect(result.success).toBe(false);
  expect(result.error).toContain('not found');

  // Verify actual database wasn't modified
  const unchanged = await prisma.service.findUnique({ where: { id: service.id } });
  expect(unchanged.name).toBe('Tenant 1 Service');
});
```

---

## Reference Implementation

See committed fixes in booking-links branch:

**File: booking-link-executors.ts**
- Lines 127-141: Update with updateMany + tenantId
- Lines 178-208: Delete with transaction + FOR UPDATE lock
- Lines 201-203: deleteMany with tenantId in where clause

**File: executor-registry.ts**
- Lines 84-87: Booking link tools in REQUIRED_EXECUTOR_TOOLS
- Lines 51-88: Full registry with grouping comments

**File: tenant-info.ts** (NEW)
- Extracted shared utility pattern
- Single source of truth
- Options pattern for optional fields

---

## Checklist for Future Agent Tool Implementation

Copy this checklist when implementing new agent write tools:

```markdown
## Pre-Implementation Planning
- [ ] Identify all write operations (create/update/delete)
- [ ] Plan trust tier (T1/T2/T3) for each operation
- [ ] Identify race condition windows (check-then-act)
- [ ] Plan error handling and user messages

## Implementation
- [ ] All mutations include tenantId in where clause
- [ ] All mutations use deleteMany/updateMany (not delete/update)
- [ ] Check-then-act patterns wrapped in transactions
- [ ] Shared utilities extracted (getTenantInfo, etc.)
- [ ] Error types are domain-specific
- [ ] Error messages don't leak cross-tenant data

## Integration
- [ ] Tool added to tool definitions
- [ ] Tool name added to REQUIRED_EXECUTOR_TOOLS
- [ ] Executor registered in registerBookingLinkExecutors
- [ ] validateExecutorRegistry() called at startup

## Testing
- [ ] Unit tests for tool invocation
- [ ] Integration tests for executor
- [ ] Cross-tenant isolation test
- [ ] Race condition verification (at least documented)
- [ ] Error handling test with unclear input

## Code Review
- [ ] Checked by security-sentinel (multi-tenant)
- [ ] Checked by data-integrity-guardian (race conditions)
- [ ] Checked by architecture-strategist (patterns)
- [ ] Checked by performance-oracle (N+1 queries)

## Pre-Merge
- [ ] Tests passing (npm test)
- [ ] TypeScript strict mode (npm run typecheck)
- [ ] No circular dependencies (npx madge --circular server/src/)
- [ ] Documentation updated (CLAUDE.md, ADRs)
```

---

## Quick Reference Cards

### Tenant Isolation
```typescript
// WRONG
where: { id }

// CORRECT
where: { id, tenantId }
```

### Update Operation
```typescript
// WRONG
await prisma.service.update({ where: { id }, data });

// CORRECT
await prisma.$transaction(async (tx) => {
  const result = await tx.service.updateMany({
    where: { id, tenantId },
    data,
  });
  if (result.count === 0) throw new ResourceNotFoundError(...);
  return tx.service.findFirstOrThrow({ where: { id, tenantId } });
});
```

### Delete Operation
```typescript
// WRONG
await prisma.service.delete({ where: { id } });

// CORRECT
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${id} FOR UPDATE`;
  const deleted = await tx.service.deleteMany({
    where: { id, tenantId },
  });
  if (deleted.count === 0) throw new ResourceNotFoundError(...);
});
```

### Executor Registry
```typescript
// Step 1: Add to REQUIRED_EXECUTOR_TOOLS
const REQUIRED_EXECUTOR_TOOLS = [
  // ...
  'new_tool_name',
];

// Step 2: Register executor
registerProposalExecutor('new_tool_name', async (tenantId, payload) => {
  // implementation
});

// Step 3: Validate at startup
validateExecutorRegistry(); // Throws if missing
```

---

## Related Documentation

- **ADR-013**: Advisory locks and double-booking prevention
- **PREVENTION_STRATEGIES_INDEX.md**: All prevention strategies across MAIS
- **booking-link-executors.ts**: Reference implementation of all patterns
- **executor-registry.ts**: Startup validation pattern
- **tenant-info.ts**: Code extraction pattern

