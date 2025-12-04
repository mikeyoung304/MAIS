---
status: complete
priority: p1
issue_id: '121'
tags: [code-review, performance, pr-12]
dependencies: []
---

# Unstable Event Handlers Break React.memo in TenantPackagesManager

## Problem Statement

The `handleEdit` and `handleSubmit` functions in `TenantPackagesManager` are recreated on every render. These are passed to `PackageList` which is memoized with `React.memo`, but the memo is broken because callback props have new references on each render.

**Why it matters:**

- `PackageList` is memoized (line 35 of PackageList.tsx)
- Every render of `TenantPackagesManager` passes new `onEdit`/`onDelete` callbacks
- This breaks the memo optimization completely
- With grouped view, 2-10+ `PackageList` instances re-render unnecessarily

## Findings

**Source:** Performance Oracle agent review of PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx`
**Lines:** 59-68

**Current Code:**

```typescript
// ❌ Recreated every render
const handleEdit = async (pkg: PackageDto) => {
  packageForm.loadPackage(pkg);
  await packageManager.handleEdit(pkg);
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  await packageForm.submitForm(packageManager.editingPackageId);
};
```

## Proposed Solutions

### Solution 1: Wrap in useCallback (Recommended)

```typescript
const handleEdit = useCallback(
  async (pkg: PackageDto) => {
    packageForm.loadPackage(pkg);
    await packageManager.handleEdit(pkg);
  },
  [packageForm.loadPackage, packageManager.handleEdit]
);

const handleSubmit = useCallback(
  async (e: React.FormEvent) => {
    e.preventDefault();
    await packageForm.submitForm(packageManager.editingPackageId);
  },
  [packageForm.submitForm, packageManager.editingPackageId]
);
```

**Pros:** Stable references, memo works correctly
**Cons:** Adds import, slightly more code
**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

Implement Solution 1 immediately.

## Technical Details

**Affected Files:**

- `client/src/features/tenant-admin/TenantPackagesManager.tsx`

**Components Impacted:**

- All `PackageList` instances (flat view + grouped view sections)

## Acceptance Criteria

- [ ] `handleEdit` wrapped in `useCallback`
- [ ] `handleSubmit` wrapped in `useCallback`
- [ ] Correct dependency arrays
- [ ] `PackageList` memo now prevents unnecessary re-renders
- [ ] TypeScript passes

## Work Log

| Date       | Action  | Notes                   |
| ---------- | ------- | ----------------------- |
| 2025-12-01 | Created | From PR #12 code review |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/12
