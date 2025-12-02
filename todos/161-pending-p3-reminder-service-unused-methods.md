---
status: pending
priority: p3
issue_id: "161"
tags: [code-review, quality, mvp-gaps, cleanup]
dependencies: []
---

# Unused Methods in ReminderService

## Problem Statement

ReminderService has 2 public methods that are not currently used anywhere in the codebase.

**Why This Matters:**
- 80+ lines of unused code
- YAGNI violation
- Maintenance overhead

## Findings

**Location:** `server/src/services/reminder.service.ts:175-219`

**Unused methods:**
- `getPendingReminderCount()` - No references found
- `getUpcomingReminders()` - No references found

## Proposed Solutions

Remove unused methods or mark as `@internal` if planned for future use.

## Acceptance Criteria

- [ ] Unused methods removed or documented
- [ ] 80 lines of dead code eliminated
