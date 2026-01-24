# P2: Missing tenantId in CLI Flagged Count Query

**Status:** open
**Priority:** P2 (Important)
**Category:** Data Integrity
**File:** `server/scripts/run-eval-batch.ts`
**Lines:** 200-205

## Problem

The flagged count query does not include `tenantId` in the WHERE clause:

```typescript
// Current (missing tenantId)
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    id: { in: traceIds },
    flagged: true,
  },
});
```

While `traceIds` is already tenant-scoped, this violates the "always include tenantId" defensive pattern documented in `mais-critical-patterns.md`.

## Fix

Add `tenantId` for defense-in-depth:

```typescript
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    tenantId: tenant.id, // Always include tenantId
    id: { in: traceIds },
    flagged: true,
  },
});
```

## Source

Code review of commit b2cab182 - Data Integrity reviewer finding
