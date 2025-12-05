---
status: ready
priority: p2
issue_id: "260"
tags: [code-review, performance, react-query, tenant-dashboard]
dependencies: ["258"]
---

# Missing React Query Integration for Dashboard Components

## Problem Statement

All three new dashboard components use `useEffect` with manual `fetch` calls instead of React Query, despite the project having a configured `queryClient` with optimal caching. This causes duplicate API calls on tab switches and slower perceived performance.

**Why it matters:**
- Duplicate API calls when switching tabs (no caching)
- 200-500ms delay on every tab switch
- Inconsistent data across components
- Wasted network bandwidth

## Findings

### Agent: performance-oracle
- **Location:** CalendarConfigCard:98-127, DepositSettingsCard:70-104, RemindersCard:50-73
- **Evidence:** All use `useEffect` + `fetch` instead of `useQuery`
- **Impact:** HIGH - Each tab switch triggers new API calls, no cache

### Agent: architecture-strategist
- **Evidence:** React Query already configured in project but not used here
- **Impact:** MEDIUM - Inconsistent patterns

## Proposed Solutions

### Option A: Full React Query Migration (Recommended)
**Description:** Replace all useEffect/fetch patterns with useQuery/useMutation

**Pros:**
- Automatic caching (5 min stale time)
- Built-in loading/error states
- Tab switches become instant
- Reduces component code by ~40%

**Cons:**
- Larger refactor
- Requires contracts first (todo 258)

**Effort:** Medium (4-6 hours)
**Risk:** Low

### Option B: Add Manual Caching
**Description:** Keep fetch but add localStorage caching

**Pros:**
- Works without contracts
- Quick to implement

**Cons:**
- Reinventing React Query
- Cache invalidation complexity

**Effort:** Medium
**Risk:** Medium - custom caching is error-prone

## Recommended Action

**Choose Option A** after completing todos 257-258. React Query is already in the project.

## Technical Details

### Affected Files
- `client/src/features/tenant-admin/TenantDashboard/CalendarConfigCard.tsx`
- `client/src/features/tenant-admin/TenantDashboard/DepositSettingsCard.tsx`
- `client/src/features/tenant-admin/TenantDashboard/RemindersCard.tsx`

### Example Refactor
```typescript
const { data: status, isLoading, error } = useQuery({
  queryKey: ['tenant-admin', 'calendar', 'status'],
  queryFn: () => api.tenantAdminGetCalendarStatus(),
  staleTime: 5 * 60 * 1000,
});
```

## Acceptance Criteria

- [ ] All three components use React Query
- [ ] Tab switches are instant (cache hit)
- [ ] Loading states work correctly
- [ ] Error handling works correctly
- [ ] Cache invalidates on mutations

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from code review | React Query already configured, just needs adoption |

## Resources

- **React Query Docs:** https://tanstack.com/query/latest
- **Existing queryClient:** Check main.tsx or App.tsx for configuration
