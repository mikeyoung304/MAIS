---
status: pending
priority: p3
issue_id: "163"
tags: [code-review, quality, mvp-gaps, typescript]
dependencies: []
---

# Magic Strings for Event Names

## Problem Statement

Event names are hardcoded strings throughout the codebase. Typos cause silent event delivery failures.

**Why This Matters:**
- No compile-time safety
- Typos cause silent failures
- Hard to refactor

## Findings

**Examples:** `'BookingPaid'`, `'BookingRescheduled'`, `'BookingCancelled'`, `'BookingReminderDue'`

## Proposed Solutions

Create const object for event names:

```typescript
export const BookingEvents = {
  PAID: 'BookingPaid',
  RESCHEDULED: 'BookingRescheduled',
  CANCELLED: 'BookingCancelled',
  REMINDER_DUE: 'BookingReminderDue',
} as const;
```

## Acceptance Criteria

- [ ] Event name constants created
- [ ] All emitters use constants
- [ ] All subscribers use constants
