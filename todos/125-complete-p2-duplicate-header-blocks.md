---
status: complete
priority: p2
issue_id: '125'
tags: [code-review, code-quality, dry, pr-12]
dependencies: []
resolution: FALSE POSITIVE - Headers are intentionally different for flat vs grouped views
---

# Duplicate Header Block Rendering Logic

## Problem Statement

The header section with "Manage Segments" button is duplicated in both flat view and grouped view render paths. This violates DRY principle and increases maintenance burden.

**Why it matters:**

- Changes to header need to be made in two places
- Risk of divergence between the two versions
- Increases code size unnecessarily
- Makes refactoring more error-prone

## Findings

**Source:** Code Simplicity Reviewer agent review of PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx`
**Lines:** ~150-160 and ~180-190 (approximate)

**Current Pattern:**

```typescript
// In flat view section:
<div className="flex justify-between items-center mb-6">
  <h2 className="text-2xl font-bold">Packages</h2>
  {segments.length >= 2 && (
    <Button onClick={() => setShowSegmentModal(true)}>
      Manage Segments
    </Button>
  )}
</div>

// In grouped view section (duplicated):
<div className="flex justify-between items-center mb-6">
  <h2 className="text-2xl font-bold">Packages</h2>
  <Button onClick={() => setShowSegmentModal(true)}>
    Manage Segments
  </Button>
</div>
```

## Proposed Solutions

### Solution 1: Extract to Shared Variable (Recommended)

```typescript
const headerBlock = (
  <div className="flex justify-between items-center mb-6">
    <h2 className="text-2xl font-bold">Packages</h2>
    {showGroupedView && (
      <Button onClick={() => setShowSegmentModal(true)}>
        Manage Segments
      </Button>
    )}
  </div>
);

// Then use {headerBlock} in both render paths
```

**Pros:** Single source of truth, easy maintenance
**Cons:** None
**Effort:** Small (5 minutes)
**Risk:** Low

### Solution 2: Extract PackagesHeader Component

Create a small sub-component for the header.

**Pros:** Reusable, testable
**Cons:** Slight over-engineering for simple header
**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

Implement Solution 1 - extract to shared variable. Component extraction not needed for simple header.

## Technical Details

**Affected Files:**

- `client/src/features/tenant-admin/TenantPackagesManager.tsx`

## Acceptance Criteria

- [ ] Single header definition used in both render paths
- [ ] "Manage Segments" button shows only in grouped view
- [ ] No visual changes to UI
- [ ] TypeScript passes

## Work Log

| Date       | Action  | Notes                   |
| ---------- | ------- | ----------------------- |
| 2025-12-01 | Created | From PR #12 code review |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/12
