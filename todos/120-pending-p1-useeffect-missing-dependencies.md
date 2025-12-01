---
status: complete
priority: p1
issue_id: "120"
tags: [code-review, react-hooks, pr-12]
dependencies: ["119"]
---

# useEffect Missing Dependency Array Functions

## Problem Statement

The `useEffect` in `useDashboardData.ts` has `activeTab` as its only dependency, but it calls unwrapped async functions that change reference on every render. This creates ESLint exhaustive-deps warnings and potential stale closure bugs.

**Why it matters:**
- React Hook exhaustive-deps ESLint rule will fail
- Functions can become stale (use old state values)
- Potential infinite loop risks in future changes
- Violates React best practices

## Findings

**Source:** Performance Oracle & Pattern Recognition agents, PR #12

**File:** `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`
**Lines:** 110-120

**Current Code:**
```typescript
useEffect(() => {
  if (activeTab === "packages") {
    loadPackagesAndSegments();  // ❌ Different reference every render
  } else if (activeTab === "blackouts") {
    loadBlackouts();              // ❌ Different reference every render
  }
  // ...
}, [activeTab]);  // ❌ Missing dependencies (ESLint will warn)
```

## Proposed Solutions

### Solution 1: Add Dependencies After useCallback Fix (Recommended)
After wrapping functions in `useCallback` (see #119), add them to dependency array:

```typescript
useEffect(() => {
  if (activeTab === "packages") {
    loadPackagesAndSegments();
  } else if (activeTab === "blackouts") {
    loadBlackouts();
  } else if (activeTab === "bookings") {
    loadBookings();
  } else if (activeTab === "branding") {
    loadBranding();
  }
}, [activeTab, loadPackagesAndSegments, loadBlackouts, loadBookings, loadBranding]);
```

**Pros:** Correct dependency array, no stale closures
**Cons:** Requires #119 to be fixed first
**Effort:** Small (5 minutes after #119)
**Risk:** Low

## Recommended Action

Fix after #119 is complete.

## Technical Details

**Affected Files:**
- `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`

**Dependency:** Must complete #119 first (useCallback wrapping)

## Acceptance Criteria

- [ ] All load functions in dependency array
- [ ] No ESLint exhaustive-deps warnings
- [ ] TypeScript passes
- [ ] Data fetches correctly on tab change

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | From PR #12 code review |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/12
- Depends on: #119
