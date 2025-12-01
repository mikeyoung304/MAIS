---
status: complete
priority: p1
issue_id: "124"
tags: [code-review, ux, accessibility, pr-12]
dependencies: []
resolution: Already implemented - stopPropagation wrapper exists on button container
---

# Accordion Button Clicks Toggle Accordion State Unexpectedly

## Problem Statement

The "Add Package" and "Manage Segments" buttons inside the accordion `<summary>` element propagate click events, causing the accordion to toggle when buttons are clicked. This creates confusing UX where clicking a button also opens/closes the accordion.

**Why it matters:**
- Users expect button clicks to only trigger the button action
- Accordion toggling on button click is unexpected behavior
- May cause users to accidentally collapse sections while trying to add packages
- Violates principle of least surprise

## Findings

**Source:** Frontend Architecture Expert agent review of PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx`
**Lines:** 210-224

**Current Code:**
```typescript
<summary className="...">
  <span>...</span>
  <div className="flex gap-2">
    <Button size="sm" onClick={handleAddToSegment}>
      + Add Package
    </Button>
    {/* Clicking these buttons toggles the accordion! */}
  </div>
</summary>
```

**Problem:** Buttons inside `<summary>` propagate click to the `<details>` element.

## Proposed Solutions

### Solution 1: Add stopPropagation to Button Clicks (Recommended)
```typescript
<Button
  size="sm"
  onClick={(e) => {
    e.stopPropagation();
    handleAddToSegment();
  }}
>
  + Add Package
</Button>
```

**Pros:** Simple fix, clear intent
**Cons:** Need to wrap all button handlers
**Effort:** Small (10 minutes)
**Risk:** Low

### Solution 2: Move Buttons Outside Summary
Place buttons in an absolutely positioned container outside the `<summary>`.

**Pros:** No event handling needed
**Cons:** More complex layout, accessibility concerns
**Effort:** Medium (30 minutes)
**Risk:** Medium

## Recommended Action

Implement Solution 1 immediately. Add `e.stopPropagation()` to all button click handlers inside summary elements.

## Technical Details

**Affected Files:**
- `client/src/features/tenant-admin/TenantPackagesManager.tsx` (lines 210-224)

**Buttons Affected:**
- "Add Package" button in each segment accordion
- "Manage Segments" button

## Acceptance Criteria

- [ ] Clicking "Add Package" does NOT toggle accordion
- [ ] Clicking "Manage Segments" does NOT toggle accordion
- [ ] Clicking accordion header text DOES toggle accordion
- [ ] All button functionality preserved

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | From PR #12 code review |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/12

