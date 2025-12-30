# P3: Unbounded Orphan Recovery Query

## Status

**READY** - Approved 2025-12-29 via auto-triage

## Priority

**P3 - Nice to Have (Resilience)**

## Description

The startup orphan recovery has no `take` limit. After a catastrophic crash, if thousands of proposals were orphaned, this query could consume excessive memory or block startup.

## Location

- `server/src/jobs/cleanup.ts` (lines 85-89)

## Current Code

```typescript
const orphaned = await prisma.agentProposal.findMany({
  where: {
    status: 'CONFIRMED',
    updatedAt: { lt: orphanCutoff },
  },
  // No take: clause - fetches ALL orphaned proposals
});
```

## Expected Code

```typescript
const orphaned = await prisma.agentProposal.findMany({
  where: { status: 'CONFIRMED', updatedAt: { lt: orphanCutoff } },
  take: 100, // Process in batches
  orderBy: { updatedAt: 'asc' }, // Oldest first
});
```

## Impact

- **Memory**: Could exhaust memory with large result sets
- **Startup Time**: Could block startup for extended periods
- **Availability**: OOM crash during recovery

## Fix Steps

1. Add `take: 100` pagination
2. Add `orderBy: { updatedAt: 'asc' }` for oldest first
3. Consider iterating with cursor-based pagination
4. Add metrics for orphan recovery count

## Tags

resilience, performance, cleanup, pagination, code-review
