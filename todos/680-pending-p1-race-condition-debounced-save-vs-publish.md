---
status: pending
priority: p1
issue_id: '680'
tags: [code-review, agent-first-architecture, data-integrity, race-condition]
dependencies: []
---

# P1: Race Condition - Pending Debounced Save During Publish/Discard

## Problem Statement

When `publishDraft()` or `discardDraft()` is called from `useDraftConfig`, there may be a pending debounced save in `useDraftAutosave` that could fire AFTER the publish/discard completes. This could:

- Overwrite just-published config with stale draft
- Re-create a draft immediately after discard

**Why This Matters:**

- User publishes changes, but stale draft overwrites live config seconds later
- User discards changes, but draft immediately reappears
- Silent data corruption with no user feedback
- Hard to debug because timing-dependent

## Findings

**Agent:** Data Integrity Guardian

**Locations:**

- `apps/web/src/hooks/useDraftAutosave.ts` (lines 199-214)
- `apps/web/src/hooks/useDraftConfig.ts` (lines 134-183)

**The Race:**

1. User makes edit → `useDraftAutosave.queueSave()` schedules debounced save (e.g., 2s delay)
2. User clicks "Publish" before debounce completes
3. `useDraftConfig.publishDraft()` runs, publishes current state
4. Debounced save fires, creates new draft from pre-publish state
5. User now has a draft that differs from published version

**Root Cause:** The two hooks don't coordinate - `useDraftAutosave` and `useDraftConfig` are separate instances with no shared cancellation mechanism.

## Proposed Solutions

### Option A: Cancel pending saves before publish/discard (Recommended)

```typescript
// In useDraftConfig or PreviewPanel
const { cancelPendingSave } = useDraftAutosave();

const handlePublish = async () => {
  cancelPendingSave(); // Clear any pending debounced save
  await publishDraft();
  // ...
};
```

- **Pros:** Simple, directly addresses race
- **Cons:** Requires exposing cancel function
- **Effort:** Small
- **Risk:** Low

### Option B: Use shared state to block saves during publish

- Add `isPublishing` flag to shared context/store
- Autosave checks flag before executing
- **Pros:** More robust coordination
- **Cons:** More complex, potential for stuck state
- **Effort:** Medium
- **Risk:** Medium

### Option C: Flush pending saves before publish

- Instead of canceling, flush any pending save immediately
- Then publish
- **Pros:** No data loss from pending edits
- **Cons:** Could publish unintended changes
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

**Option A** - Add `cancelPendingSave` to useDraftAutosave and call it before publish/discard operations.

## Technical Details

**Affected Files:**

- `apps/web/src/hooks/useDraftAutosave.ts` (add cancelPendingSave export)
- `apps/web/src/components/preview/PreviewPanel.tsx` (call before operations)

**Implementation:**

1. Export `cancelPendingSave` from useDraftAutosave
2. Call in `handlePublish` and `handleDiscard` before async operation
3. Add test for race condition scenario

## Acceptance Criteria

- [ ] Pending debounced saves are cancelled before publish
- [ ] Pending debounced saves are cancelled before discard
- [ ] No race condition when rapidly editing then publishing
- [ ] Test verifies cancellation behavior

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
- Files: `apps/web/src/hooks/useDraftAutosave.ts`, `apps/web/src/hooks/useDraftConfig.ts`
