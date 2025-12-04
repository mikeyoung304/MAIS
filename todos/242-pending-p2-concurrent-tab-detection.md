---
status: deferred
priority: p2
issue_id: "242"
tags: [ux, landing-page, concurrency]
dependencies: ["237", "frontend-landing-page-editor"]
source: "code-review-pr-14"
---

# TODO-242: Add Concurrent Edit Detection for Landing Page Editor

## Priority: P2 (Important - UX Enhancement)

## Status: Deferred (Blocked on Frontend)

## Source: Code Review - PR #14 (Data Integrity Guardian)

## Problem Statement

When a tenant admin has the landing page editor open in multiple tabs or browsers, concurrent edits can silently overwrite each other. The transaction fix (TODO-237) prevents data corruption, but users still won't know their changes were overwritten.

**Why It Matters:**
- User in Tab A makes changes
- User in Tab B (forgot it was open) makes different changes
- Tab B saves, overwriting Tab A's work
- User discovers later that changes are missing

## Proposed Solution

**Option A: Optimistic Locking with Version Field**

Add a `landingPageConfigVersion` column and check it on save:

```typescript
async saveLandingPageDraft(tenantId: string, config: LandingPageConfig, expectedVersion: number) {
  const result = await this.prisma.tenant.updateMany({
    where: { id: tenantId, landingPageConfigVersion: expectedVersion },
    data: {
      landingPageConfig: newWrapper,
      landingPageConfigVersion: { increment: 1 }
    }
  });

  if (result.count === 0) {
    throw new ConcurrentEditError('Draft was modified by another session');
  }
}
```

**Option B: Last-Write-Wins with Warning**

Keep current behavior but show warning when opening second tab:

```typescript
// Frontend: Check for active sessions via localStorage
const editorLock = localStorage.getItem('landingPageEditorLock');
if (editorLock && Date.now() - parseInt(editorLock) < 30000) {
  showWarning('Another tab may be editing this page');
}
```

**Option C: Real-time Sync (Complex)**

Use WebSockets to sync state across tabs. Overkill for current needs.

## Acceptance Criteria

- [x] Decide: Version field OR warning OR defer
- [ ] If version field: Add migration, update repository, update client
- [ ] If warning: Add localStorage check in editor component
- [ ] User informed when concurrent edit detected

## Resolution

**Decision: Defer - Blocked on Frontend**

The frontend landing page editor component has not been built yet. Only the backend API exists (`/v1/tenant-admin/landing-page/*`).

**When frontend is built, implement Option B (localStorage warning):**

```typescript
// In landing page editor component
useEffect(() => {
  const EDITOR_LOCK_KEY = 'mais:landingPageEditor:active';
  const LOCK_TIMEOUT = 30000; // 30 seconds

  const existingLock = localStorage.getItem(EDITOR_LOCK_KEY);
  if (existingLock && Date.now() - parseInt(existingLock) < LOCK_TIMEOUT) {
    toast.warning(
      'This page may be open in another tab. Changes from multiple tabs can overwrite each other.',
      { duration: 8000 }
    );
  }

  localStorage.setItem(EDITOR_LOCK_KEY, Date.now().toString());
  const interval = setInterval(() => {
    localStorage.setItem(EDITOR_LOCK_KEY, Date.now().toString());
  }, 10000);

  return () => {
    clearInterval(interval);
    localStorage.removeItem(EDITOR_LOCK_KEY);
  };
}, []);
```

**Rationale:**
- Simple frontend-only solution (no database changes)
- Handles 90% of cases (user forgot they had tab open)
- Can add optimistic locking later if real users report issues

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Code review of PR #14 |
| 2025-12-04 | Deferred | Frontend landing page editor not yet built |

## Tags

ux, landing-page, concurrency
