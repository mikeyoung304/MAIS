---
status: complete
priority: p2
issue_id: '109'
tags: [code-review, architecture, duplication, ui-redesign]
dependencies: []
---

# Empty State Pattern Duplicated Instead of Using Existing Component

## Problem Statement

PackageList, SegmentsList, and BlackoutsList manually implement identical empty state patterns instead of using the existing `EmptyState` component.

**Why it matters:** Code duplication, inconsistent styling, harder to maintain design changes.

## Findings

### From pattern-recognition agent:

**Files with duplication:**

- `client/src/features/tenant-admin/packages/PackageList.tsx` (lines 59-75)
- `client/src/features/admin/segments/SegmentsList.tsx` (lines 38-54)
- `client/src/features/tenant-admin/BlackoutsManager/BlackoutsList.tsx` (lines 39-55)

**Existing component:**

- `client/src/components/ui/empty-state.tsx` (uses macon-navy, needs sage theme)

**Duplicated pattern:**

```tsx
<div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center">
  <div className="max-w-sm mx-auto space-y-4">
    <div className="w-16 h-16 bg-sage/10 rounded-2xl ...">
      <Icon className="w-8 h-8 text-sage" />
    </div>
    <h3 className="font-serif text-xl ...">Title</h3>
    <p className="text-text-muted ...">Description</p>
  </div>
</div>
```

## Proposed Solutions

### Solution 1: Update EmptyState Component + Migrate (Recommended)

**Pros:** Single source of truth
**Cons:** Need to update existing component
**Effort:** Medium (2 hours)
**Risk:** Low

Add variant prop to EmptyState for sage theme, then migrate all instances.

## Acceptance Criteria

- [ ] EmptyState component supports sage variant
- [ ] All 3 manual implementations replaced
- [ ] Visual appearance matches current design
- [ ] LoadingState component also created (similar pattern)

## Work Log

| Date       | Action                   | Learnings                 |
| ---------- | ------------------------ | ------------------------- |
| 2025-11-30 | Created from code review | Pattern duplication found |
