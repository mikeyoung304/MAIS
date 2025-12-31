---
status: complete
priority: p3
issue_id: '039'
tags: [code-review, database, maintenance]
dependencies: []
---

# IdempotencyKey Cleanup Never Called

## Problem Statement

`cleanupExpired()` method exists but is never scheduled. Expired idempotency keys accumulate indefinitely.

**Why this matters:** After 90 days, table could grow to millions of rows, slowing queries.

## Findings

**Location:** `server/src/services/idempotency.service.ts:235-246`

Method exists but never invoked from scheduler or startup.

## Proposed Solutions

Schedule periodic cleanup (daily cron or startup task):

```typescript
setInterval(() => idempotencyService.cleanupExpired(), 24 * 60 * 60 * 1000);
```

## Acceptance Criteria

- [x] Cleanup runs daily
- [x] Logs number of deleted keys
- [x] No performance impact on regular operations

## Implementation

Added `startCleanupScheduler()` and `stopCleanupScheduler()` methods to IdempotencyService:

- Scheduler runs cleanup every 24 hours
- Initial cleanup runs 5 seconds after startup
- Cleanup is properly stopped during application shutdown to prevent memory leaks
- Both mock and real modes call the scheduler in DI container

Files modified:

- `server/src/services/idempotency.service.ts` - Added scheduler methods
- `server/src/di.ts` - Start scheduler after service instantiation, stop during cleanup

## Work Log

| Date       | Action    | Notes                                                          |
| ---------- | --------- | -------------------------------------------------------------- |
| 2025-11-27 | Created   | Found during data integrity review                             |
| 2025-12-02 | Completed | Implemented scheduled cleanup with proper lifecycle management |
