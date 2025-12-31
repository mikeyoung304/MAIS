---
status: complete
priority: p3
issue_id: '161'
tags: [code-review, quality, mvp-gaps, cleanup]
dependencies: []
completed_date: 2025-12-02
resolution: false-positive
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

**Originally flagged as unused:**

- `getPendingReminderCount()` - No references found
- `getUpcomingReminders()` - No references found

## Resolution

**Status:** FALSE POSITIVE - Methods ARE actively used

Upon investigation, both methods are actively used by the tenant admin reminder routes:

**File:** `server/src/routes/tenant-admin-reminders.routes.ts`

**Usage:**

- Line 45: `getPendingReminderCount()` - Used in `GET /v1/tenant-admin/reminders/status` to provide dashboard badge count
- Line 48: `getUpcomingReminders()` - Used in same endpoint to provide preview of upcoming reminders

**Route Registration:**

- Routes are registered in `server/src/routes/index.ts:439`
- Part of active tenant admin dashboard functionality

## Acceptance Criteria

- [x] Verified methods ARE used in production routes
- [x] Confirmed routes are registered in main router
- [x] Methods provide essential dashboard functionality
- [x] No action needed - false positive
