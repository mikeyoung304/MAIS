---
status: pending
priority: p2
issue_id: "168"
tags: [code-review, memory-leak, upload-service, batch-3-review]
dependencies: []
---

# Fix Upload Semaphore Memory Leak

## Problem Statement

The upload concurrency limiting implementation uses a `Map<string, number>` to track per-tenant upload counts, but entries are never removed when counts reach zero. Over time, this causes memory growth proportional to the number of unique tenants that have uploaded files.

**Why it matters:**
- Memory leak in long-running server process
- Map grows unbounded with each new tenant
- Production servers may eventually OOM

## Findings

**Source:** Performance Specialist agent code review

**File:** `server/src/adapters/upload.adapter.ts`
**Lines:** 12-15 (semaphore declaration), 45-55 (acquire/release)

**Current code:**
```typescript
const uploadSemaphores = new Map<string, number>();

export function releaseUploadConcurrency(tenantId: string): void {
  const current = uploadSemaphores.get(tenantId) || 1;
  uploadSemaphores.set(tenantId, Math.max(0, current - 1));
  // BUG: Entry remains in Map even when count is 0
}
```

## Proposed Solution

Clean up Map entries when count reaches zero:

```typescript
export function releaseUploadConcurrency(tenantId: string): void {
  const current = uploadSemaphores.get(tenantId) || 1;
  const newCount = Math.max(0, current - 1);

  if (newCount === 0) {
    uploadSemaphores.delete(tenantId); // Clean up
  } else {
    uploadSemaphores.set(tenantId, newCount);
  }
}
```

**Effort:** Small (10 minutes)
**Risk:** Low - simple cleanup logic

## Acceptance Criteria

- [ ] releaseUploadConcurrency deletes entry when count reaches 0
- [ ] Add unit test verifying Map cleanup
- [ ] TypeScript passes
- [ ] Tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From batch 3 code review |

## Resources

- Related TODO: 068 (concurrency limiting implementation)
- Commit introducing issue: f21391a
