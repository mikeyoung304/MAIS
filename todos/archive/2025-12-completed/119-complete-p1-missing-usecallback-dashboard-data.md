---
status: complete
priority: p1
issue_id: '119'
tags: [code-review, performance, pr-12]
dependencies: []
---

# Missing useCallback for Load Functions in useDashboardData

## Problem Statement

All data loading functions (`loadPackagesAndSegments`, `loadBlackouts`, `loadBookings`, `loadBranding`) in `useDashboardData.ts` are recreated on every render. These functions are passed as callbacks to child components, causing unnecessary re-renders of the entire component tree.

**Why it matters:**

- `TenantPackagesManager` re-renders on every parent render
- All 3 custom hooks inside `TenantPackagesManager` re-initialize
- Grouped view with multiple segments causes cascading re-renders of all `PackageList` components
- With 10 segments and 50 packages, every state change triggers a full re-render cascade

## Findings

**Source:** Performance Oracle agent review of PR #12

**File:** `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`
**Lines:** 46-153

**Current Pattern (Lines 46-65):**

```typescript
const loadPackagesAndSegments = async () => {
  setIsLoading(true);
  try {
    const [packagesResult, segmentsResult] = await Promise.all([
      api.tenantAdminGetPackages(),
      api.tenantAdminGetSegments(),
    ]);
    // ...
  } finally {
    setIsLoading(false);
  }
};

return {
  loadPackages: loadPackagesAndSegments, // ❌ New reference every render
  // ...
};
```

## Proposed Solutions

### Solution 1: Wrap functions in useCallback (Recommended)

```typescript
const loadPackagesAndSegments = useCallback(async () => {
  setIsLoading(true);
  try {
    const [packagesResult, segmentsResult] = await Promise.all([
      api.tenantAdminGetPackages(),
      api.tenantAdminGetSegments(),
    ]);
    // ... rest of implementation
  } finally {
    setIsLoading(false);
  }
}, []); // No dependencies - API client is stable

const loadBlackouts = useCallback(async () => {
  /* ... */
}, []);
const loadBookings = useCallback(async () => {
  /* ... */
}, []);
const loadBranding = useCallback(async () => {
  /* ... */
}, []);
```

**Pros:** Minimal change, stable references, prevents re-renders
**Cons:** None
**Effort:** Small (15 minutes)
**Risk:** Low

### Solution 2: Refactor to TanStack Query

Use `useQuery` hooks instead of manual state management (matches existing codebase pattern).

**Pros:** Better caching, automatic refetch, error handling
**Cons:** Larger refactor, changes API
**Effort:** Large (2-3 hours)
**Risk:** Medium

## Recommended Action

Implement Solution 1 immediately to fix performance regression.

## Technical Details

**Affected Files:**

- `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`

**Components Impacted:**

- `TenantDashboard`
- `TenantPackagesManager`
- `PackageList` (multiple instances in grouped view)

## Acceptance Criteria

- [ ] All load functions wrapped in `useCallback`
- [ ] Functions have correct empty dependency arrays
- [ ] No new lint warnings
- [ ] TypeScript passes
- [ ] Component re-renders only when data actually changes

## Work Log

| Date       | Action  | Notes                   |
| ---------- | ------- | ----------------------- |
| 2025-12-01 | Created | From PR #12 code review |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/12
- Related: #120 (useEffect dependency array)
