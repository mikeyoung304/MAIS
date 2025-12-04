---
status: complete
priority: p2
issue_id: "170"
tags: [code-review, performance, client-side-joins, frontend]
dependencies: []
resolved_date: 2025-12-02
---

# Replace N*M Client-Side Joins with Map Lookup in AppointmentsView

## Problem Statement

The `AppointmentsView` component performs N*M array operations when joining appointments with services. For each appointment, it searches through the entire services array with `find()`. This O(N*M) complexity degrades performance as data grows.

**Why it matters:**
- Performance scales poorly with appointment/service count
- Unnecessary iterations on every render
- Map-based lookup is O(N+M) instead

## Findings

**Source:** Performance Specialist agent code review

**File:** `client/src/features/tenant-admin/scheduling/AppointmentsView.tsx`
**Lines:** ~125-135 (approximate - join logic)

**Current code:**
```typescript
// O(N*M) - for each appointment, search all services
const enrichedAppointments = appointments.map(apt => ({
  ...apt,
  service: services.find(s => s.id === apt.serviceId),
}));
```

## Proposed Solution

Build a Map for O(1) lookups:

```typescript
// O(N+M) - build Map once, then constant-time lookups
const serviceMap = useMemo(
  () => new Map(services.map(s => [s.id, s])),
  [services]
);

const enrichedAppointments = useMemo(
  () => appointments.map(apt => ({
    ...apt,
    service: serviceMap.get(apt.serviceId),
  })),
  [appointments, serviceMap]
);
```

**Effort:** Small (15 minutes)
**Risk:** Low

## Acceptance Criteria

- [ ] Services converted to Map for O(1) lookup
- [ ] useMemo used for memoization
- [ ] No visual regression
- [ ] TypeScript passes
- [ ] Tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From code review |

## Resources

- File: client/src/features/tenant-admin/scheduling/AppointmentsView.tsx
