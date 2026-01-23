---
status: complete
priority: p2
issue_id: '5240'
tags: [code-review, quality, dry, backend]
dependencies: []
created_at: 2026-01-21
completed_at: 2026-01-21
pr: 31
---

# P2: Duplicated Event Version Logic and Optimistic Locking Pattern

> **Code Simplicity Review:** Same patterns repeated 3x should be extracted.

## Problem Statement

Two patterns are duplicated multiple times in `ProjectHubService`:

### 1. Event Version Calculation (3 occurrences)

**Lines:** 486-491, 574-580, 666-671

```typescript
const lastEvent = await tx.projectEvent.findFirst({
  where: { projectId },
  orderBy: { version: 'desc' },
  select: { version: true },
});
const nextVersion = (lastEvent?.version ?? 0) + 1;
```

### 2. Optimistic Locking Validation (2 occurrences)

**Lines:** 539-560 (approveRequest), 631-653 (denyRequest)

Both have identical logic for:

- Fetch request with tenant scope
- Check if not found
- Check if already resolved
- Check version mismatch

**File:** `server/src/services/project-hub.service.ts`

## Solution Implemented

Extracted two private helper methods in `ProjectHubService`:

### 1. `getNextEventVersion(tx, projectId)` - Lines 196-203

Encapsulates the event version calculation logic. Finds the highest existing event version for a project and returns the next one.

### 2. `validateAndLockRequest(tx, tenantId, requestId, expectedVersion)` - Lines 219-256

Encapsulates the optimistic locking validation pattern:

- Tenant-scoped lookup (maintains CRITICAL security)
- Status validation (request must be PENDING)
- Version check with proper error types

Also added supporting types:

- `TransactionClient` type alias for Prisma transaction client (line 153)
- `ValidatedRequest` interface for the validated request return type (lines 158-167)

### Methods Updated

- `createRequest()` - Now uses `getNextEventVersion()`
- `approveRequest()` - Now uses both `validateAndLockRequest()` and `getNextEventVersion()`
- `denyRequest()` - Now uses both `validateAndLockRequest()` and `getNextEventVersion()`

**Net reduction:** ~45 lines of duplicated code across 3 methods.

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
