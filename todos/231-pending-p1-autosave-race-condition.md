---
status: resolved
priority: p1
issue_id: "231"
tags: [data-integrity, code-review, landing-page, race-conditions]
dependencies: []
source: "code-review-landing-page-visual-editor"
resolved_at: "2025-12-04"
resolved_by: "feat/landing-page-editor-p1-security branch (documentation in plan)"
---

# TODO-231: Flush Auto-Save Before Publish to Prevent Race Condition

## Priority: P1 (Critical - Blocks Merge)

## Status: Pending

## Source: Data Integrity Review - Landing Page Visual Editor Plan

## Problem Statement

The plan specifies 1s debounced auto-save, but if user clicks Publish before debounce timer fires, the stale auto-save could overwrite published content after the publish completes.

**Why It Matters:**
- User's latest edits silently lost
- Published content reverted to older draft
- No error message shown, corruption undetected

## Findings

**Race Condition Scenario:**
1. User edits hero headline at T=0
2. Auto-save debounce timer starts (will fire at T=1000ms)
3. User clicks Publish at T=800ms
4. Publish sends current draft, clears draft state
5. Auto-save fires at T=1000ms with OLD draft
6. Old draft overwrites just-published content

**Evidence:**
- Plan (line 270): "auto-save with 1s debounce"
- useVisualEditor.ts (lines 226-229): Similar debounce pattern exists
- Plan doesn't address race between auto-save and publish

## Proposed Solutions

### Option A: Flush Debounce Before Publish (Recommended)
Cancel pending auto-save and flush immediately before publish.

**Pros:** Simple, deterministic, no lost edits
**Cons:** Slightly longer publish time
**Effort:** Small (20 min)
**Risk:** Low

```typescript
const publishChanges = useCallback(async () => {
  // Cancel any pending auto-save
  cancelDebounce();

  // Flush current draft immediately
  if (hasChanges) {
    await saveDraftImmediate(draftConfig);
  }

  // Now publish
  setIsPublishing(true);
  try {
    await apiClient.publishLandingPageDraft();
    setPublishedConfig(draftConfig);
    setDraftConfig(null);
    setHasChanges(false);
  } finally {
    setIsPublishing(false);
  }
}, [draftConfig, hasChanges, cancelDebounce, saveDraftImmediate]);
```

### Option B: Optimistic Locking with Version Numbers
Track version numbers and reject stale saves.

**Pros:** Catches all race conditions
**Cons:** More complex, requires schema change
**Effort:** Medium (1-2 hours)
**Risk:** Medium

## Recommended Action

**Option A** - Flush debounce before publish is simpler and sufficient for MVP.

## Technical Details

**Affected Files:**
- `client/src/features/tenant-admin/landing-page-editor/hooks/useLandingPageEditor.ts` - Add flush logic

## Acceptance Criteria

- [ ] Pending auto-save cancelled before publish
- [ ] Current draft saved immediately before publish
- [ ] No stale auto-save fires after publish completes
- [ ] E2E test: Rapid edit → publish preserves all changes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Data integrity review of landing page visual editor plan |

## Tags

data-integrity, code-review, landing-page, race-conditions
