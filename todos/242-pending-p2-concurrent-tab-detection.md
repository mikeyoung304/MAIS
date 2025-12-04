---
status: pending
priority: p2
issue_id: "242"
tags: [ux, landing-page, concurrency]
dependencies: ["237"]
source: "code-review-pr-14"
---

# TODO-242: Add Concurrent Edit Detection for Landing Page Editor

## Priority: P2 (Important - UX Enhancement)

## Status: Pending

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

- [ ] Decide: Version field OR warning OR defer
- [ ] If version field: Add migration, update repository, update client
- [ ] If warning: Add localStorage check in editor component
- [ ] User informed when concurrent edit detected

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Code review of PR #14 |

## Tags

ux, landing-page, concurrency
