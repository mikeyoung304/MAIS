---
status: complete
priority: p2
issue_id: '269'
tags: [code-review, backend-audit, reminders, cron, scheduling]
dependencies: []
---

# Verify Reminder Service Cron Job Configuration

## Problem Statement

The `ReminderService` exists with a `findBookingsNeedingReminders()` method in the `BookingRepository`, but there's no visible cron job or scheduler triggering the reminder evaluation. Reminders may not be sent in production.

**Why it matters:**

- Booking reminders may never be sent
- Customers miss important event notifications
- Silent failure - no errors to indicate reminders aren't working

## Findings

### Agent: backend-audit

- **Location:** `server/src/services/reminder.service.ts`, `server/src/di.ts`
- **Evidence:**
  - `ReminderService` initialized in DI container
  - `BookingEvents.REMINDER_DUE` subscription exists for email sending
  - No visible cron job or scheduler calling `reminderService` methods
- **Impact:** MEDIUM - Reminders likely not being sent

## Proposed Solutions

### Option A: Add Node-Cron Scheduler (Recommended)

**Description:** Add cron job to evaluate and trigger reminders daily

```typescript
// In server/src/index.ts or dedicated scheduler file
import cron from 'node-cron';

// Run daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  logger.info('Running daily reminder evaluation');

  // Get all tenants and process reminders
  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    try {
      await container.services.reminder.processReminders(tenant.id);
    } catch (error) {
      logger.error({ tenantId: tenant.id, error }, 'Reminder processing failed');
    }
  }
});
```

**Effort:** Small (2-3 hours)
**Risk:** Low

### Option B: External Scheduler (Render Cron Job)

**Description:** Use Render's cron job feature to hit a protected endpoint

```typescript
// POST /v1/admin/reminders/process (platform admin only)
router.post('/reminders/process', async (req, res) => {
  // Process all tenant reminders
});
```

**Pros:**

- No in-process scheduler
- Better for serverless deployments

**Cons:**

- Requires Render configuration
- Additional endpoint to secure

**Effort:** Medium (3-4 hours)
**Risk:** Low

## Recommended Action

First verify if there's an existing scheduler mechanism not visible in the code (check Render dashboard, external cron, etc.). If none exists, implement Option A.

## Technical Details

**Affected Files:**

- `server/src/index.ts` or new `server/src/scheduler.ts`
- `server/src/services/reminder.service.ts`

**Dependencies:**

- `node-cron` package (may already be installed)

**Verification Steps:**

1. Check Render dashboard for existing cron jobs
2. Search codebase for `cron`, `schedule`, `setInterval` patterns
3. Check if reminders are currently being sent in production logs

## Acceptance Criteria

- [x] Verify current reminder delivery status
- [x] Implement scheduler if not present
- [x] Reminders triggered daily at appropriate time
- [x] Logging for scheduler runs
- [x] Error handling for individual tenant failures

## Work Log

| Date       | Action                           | Learnings                                                      |
| ---------- | -------------------------------- | -------------------------------------------------------------- |
| 2025-12-05 | Created from backend audit       | Needs investigation before implementation                      |
| 2025-12-06 | Implemented Option A (node-cron) | Successfully added scheduler with configurable cron expression |

## Implementation Summary

**Implemented Option A:** Node-Cron Scheduler

**Changes Made:**

1. **Installed Dependencies:**
   - Added `node-cron` and `@types/node-cron` packages

2. **Created `/Users/mikeyoung/CODING/MAIS/server/src/scheduler.ts`:**
   - Exports `initializeScheduler()` function
   - Uses configurable cron schedule (default: daily at 9 AM)
   - Fetches all active tenants from database
   - Processes up to 50 reminders per tenant per run
   - Individual tenant error isolation (one tenant failure doesn't affect others)
   - Comprehensive logging (start, per-tenant, and summary)

3. **Updated `/Users/mikeyoung/CODING/MAIS/server/src/index.ts`:**
   - Imported `initializeScheduler`
   - Initializes scheduler after server startup (real mode only)
   - Respects `REMINDER_CRON_SCHEDULE` environment variable

4. **Added Environment Configuration:**
   - Updated `.env.example` with `REMINDER_CRON_SCHEDULE` variable
   - Updated `server/.env.example` with cron schedule documentation
   - Provided examples: daily at 9 AM, every 6 hours, twice daily

5. **Created Tests:**
   - `/Users/mikeyoung/CODING/MAIS/server/test/scheduler.test.ts`
   - 4 test cases covering validation, registration, fallback, and graceful degradation
   - All tests passing

**How It Works:**

1. Server starts up in real mode (with database connection)
2. Scheduler initializes with cron expression from env or default
3. At scheduled time (default 9 AM daily):
   - Queries database for all active tenants
   - Calls `reminderService.processOverdueReminders()` for each tenant
   - Processes up to 50 reminders per tenant
   - Emits `BookingEvents.REMINDER_DUE` events
   - Event handler sends reminder emails via Postmark
   - Logs results with counts of processed/failed reminders

**Production Configuration:**

```bash
# Default: Daily at 9 AM
REMINDER_CRON_SCHEDULE=0 9 * * *

# Alternative: Every 6 hours
REMINDER_CRON_SCHEDULE=0 */6 * * *

# Alternative: Twice daily (8 AM and 8 PM)
REMINDER_CRON_SCHEDULE=0 8,20 * * *
```

**Verification:**

- Scheduler only runs in `ADAPTERS_PRESET=real` mode
- Mock mode skips scheduler initialization (no external dependencies)
- Structured logging at all levels for monitoring
- Individual tenant failures don't affect other tenants
- Tests verify scheduler registration and configuration

## Resources

- Implemented: `server/src/scheduler.ts`
- Modified: `server/src/index.ts`
- Modified: `.env.example`, `server/.env.example`
- Tests: `server/test/scheduler.test.ts`
- Related: `server/src/services/reminder.service.ts`
- Related: `server/src/adapters/prisma/booking.repository.ts:findBookingsNeedingReminders`
