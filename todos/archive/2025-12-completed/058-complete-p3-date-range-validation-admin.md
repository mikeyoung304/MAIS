---
status: complete
priority: p3
issue_id: '058'
tags: [code-review, scheduling, validation, performance]
dependencies: []
---

# Missing Date Range Validation on Admin Appointments Query

## Problem Statement

The admin appointments endpoint accepts arbitrary date ranges. A request for 200 years of bookings would load excessive data.

## Findings

**Location:** `server/src/routes/tenant-admin-scheduling.routes.ts:487-495`

```typescript
// No validation that date range is reasonable
const { status, serviceId, startDate, endDate } = req.query;
```

## Proposed Solutions

Add date range limit:

```typescript
const daysDiff = Math.floor(
  (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
);

if (daysDiff > 90) {
  res.status(400).json({ error: 'Date range cannot exceed 90 days' });
  return;
}
```

## Acceptance Criteria

- [ ] Date range limited to 90 days
- [ ] Clear error message when exceeded
- [ ] Documentation updated

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2025-11-27 | Created | Found during Security Sentinel review |
