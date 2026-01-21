---
status: resolved
priority: p2
issue_id: '5242'
tags: [code-review, performance, frontend, ux]
dependencies: []
created_at: 2026-01-21
resolved_at: 2026-01-21
pr: 31
---

# P2: Full Data Refetch After Single Action in Tenant Dashboard

> **Performance Review:** Approving one request refetches ALL data unnecessarily.

## Problem Statement

After approving or denying a single request, the entire dataset is refetched including all projects, all pending requests, and bootstrap data.

**File:** `apps/web/src/app/(protected)/tenant/projects/page.tsx`
**Lines:** 163, 199

**Evidence:**

```typescript
const handleApprove = async (requestId: string, version: number) => {
  // ... approve API call ...
  await fetchData(); // Refetches EVERYTHING: bootstrap + projects + requests
};
```

## Proposed Solution

Implement optimistic updates:

```typescript
const handleApprove = async (requestId: string, version: number) => {
  // Optimistically remove from pending list immediately
  setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

  // Update count in bootstrap
  setBootstrap((prev) =>
    prev
      ? {
          ...prev,
          pendingRequestCount: prev.pendingRequestCount - 1,
        }
      : null
  );

  try {
    await fetch('/api/tenant-admin/projects/requests/approve', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, expectedVersion: version }),
    });
    // Success - UI already updated
  } catch (err) {
    // Rollback on failure
    fetchData();
    setError(getErrorMessage(err));
  }
};
```

**Effort:** Medium (1 hour)
**Risk:** Low

## Resolution

Implemented optimistic updates for both `handleApprove` and `handleDeny` functions:

1. **Store previous state** before making any changes for potential rollback
2. **Optimistically update UI immediately** - remove the request from the pending list and decrement the count
3. **Make API call** in the background
4. **On success**: No action needed (UI already updated)
5. **On failure**: Rollback to previous state and show error message

Key improvements:

- Eliminated 3 unnecessary API calls (bootstrap, projects, pending requests) per action
- UI feels instant - request disappears immediately when clicking Approve/Deny
- Error handling includes proper rollback to restore previous state
- Used `Math.max(0, count - 1)` to prevent negative counts

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
