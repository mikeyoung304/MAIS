---
status: pending
priority: p2
issue_id: '5240'
tags: [code-review, quality, dry, backend]
dependencies: []
created_at: 2026-01-21
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

## Proposed Solution

Extract helper methods:

```typescript
private async getNextEventVersion(
  tx: TransactionClient,
  projectId: string
): Promise<number> {
  const lastEvent = await tx.projectEvent.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return (lastEvent?.version ?? 0) + 1;
}

private async validateAndLockRequest(
  tx: TransactionClient,
  tenantId: string,
  requestId: string,
  expectedVersion: number
): Promise<ProjectRequestWithProject> {
  const request = await tx.projectRequest.findFirst({
    where: { id: requestId, tenantId },
    include: { project: true },
  });

  if (!request) {
    throw new NotFoundError(`Request ${requestId} not found`);
  }
  if (request.status !== 'PENDING') {
    throw new ValidationError('Request has already been resolved');
  }
  if (request.version !== expectedVersion) {
    throw new ConcurrentModificationError(
      'Request was modified',
      request.version
    );
  }

  return request;
}
```

**Effort:** Small (45 minutes)
**Risk:** Low

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
