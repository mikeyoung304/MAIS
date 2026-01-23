---
status: deferred
priority: p3
issue_id: 748
deferred_reason: 'Low priority DRY improvement - not blocking. Defer until next refactoring sprint.'
tags: [code-review, dry-violation, database, pr-27]
dependencies: []
---

# P3: Advisory Lock Pattern Repeated in 6 Executors

## Problem Statement

The advisory lock acquisition pattern is duplicated across 6 storefront executors. While consistent, this could be extracted to a utility for DRY compliance.

**Impact:** ~30 lines of repetition, easier to modify lock strategy centrally.

## Findings

**Reviewer:** code-simplicity-reviewer

**Location:** `server/src/agent/executors/storefront-executors.ts` (lines 136-141, 276-280, 376-380, 481-485, 626-630, 713-717)

**Current Pattern (repeated 6 times):**

```typescript
return await prisma.$transaction(
  async (tx) => {
    const lockId = hashTenantStorefront(tenantId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
    // ... business logic
  },
  {
    timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
    isolationLevel: STOREFRONT_ISOLATION_LEVEL,
  }
);
```

## Proposed Solutions

### Solution A: Create Transaction Wrapper Utility (Recommended)

- **Pros:** DRY, centralized lock configuration, easier testing
- **Cons:** Slight indirection
- **Effort:** Medium (30 minutes)
- **Risk:** Low

```typescript
// lib/transaction-utils.ts
export async function withStorefrontLock<T>(
  prisma: PrismaClient,
  tenantId: string,
  operation: (tx: PrismaTransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      const lockId = hashTenantStorefront(tenantId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
      return operation(tx);
    },
    {
      timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS,
      isolationLevel: STOREFRONT_ISOLATION_LEVEL,
    }
  );
}

// Usage in executors:
return withStorefrontLock(prisma, tenantId, async (tx) => {
  const { pages, slug } = await getDraftConfigWithSlug(tx, tenantId);
  // ... business logic
});
```

## Recommended Action

Solution A - Extract to utility in follow-up PR (not blocking for current PR).

## Technical Details

**Affected Files:**

- `server/src/agent/executors/storefront-executors.ts`
- New: `server/src/lib/transaction-utils.ts`

**Lines Saved:** ~30 lines of boilerplate

## Acceptance Criteria

- [ ] `withStorefrontLock` utility created
- [ ] All 6 executors refactored to use utility
- [ ] Tests updated/passing
- [ ] Lock behavior unchanged

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-01-11 | Created | From PR #27 multi-agent review |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
