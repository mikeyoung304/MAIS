# TODO-179: Idempotency Cleanup Scheduler Race Conditions

**Priority:** P2 (Data Integrity)
**Status:** pending
**Created:** 2025-12-03
**Source:** Code Review (Data Integrity Guardian)

## Issue

The new idempotency cleanup scheduler has potential race conditions and timing issues:

1. **Initial delay too short**: 5-second delay may run cleanup before server is fully initialized
2. **No lock on cleanup**: Multiple server instances could run cleanup simultaneously
3. **No completion guarantee on shutdown**: `stopCleanupScheduler()` clears interval but doesn't wait for in-progress cleanup

## Location

- `server/src/services/idempotency.service.ts`

## Current Implementation

```typescript
private cleanupInterval: NodeJS.Timeout | null = null;

startCleanupScheduler() {
  // Initial cleanup after 5 seconds - may be too early
  setTimeout(() => this.cleanupExpiredKeys(), 5000);

  // Runs every 24 hours
  this.cleanupInterval = setInterval(
    () => this.cleanupExpiredKeys(),
    24 * 60 * 60 * 1000
  );
}

stopCleanupScheduler() {
  if (this.cleanupInterval) {
    clearInterval(this.cleanupInterval);
    this.cleanupInterval = null;
  }
  // Doesn't wait for in-progress cleanup to complete
}
```

## Recommended Implementation

```typescript
private cleanupInterval: NodeJS.Timeout | null = null;
private isCleanupRunning = false;
private cleanupPromise: Promise<void> | null = null;

async startCleanupScheduler() {
  // Wait for server to be fully ready
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Acquire advisory lock before cleanup (multi-instance safety)
  await this.runCleanupWithLock();

  this.cleanupInterval = setInterval(
    () => this.runCleanupWithLock(),
    24 * 60 * 60 * 1000
  );
}

private async runCleanupWithLock() {
  if (this.isCleanupRunning) return;

  this.isCleanupRunning = true;
  this.cleanupPromise = this.prisma.$executeRaw`
    SELECT pg_advisory_lock(42424242) -- Cleanup lock
  `.then(() => this.cleanupExpiredKeys())
    .finally(async () => {
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(42424242)`;
      this.isCleanupRunning = false;
    });

  await this.cleanupPromise;
}

async stopCleanupScheduler() {
  if (this.cleanupInterval) {
    clearInterval(this.cleanupInterval);
    this.cleanupInterval = null;
  }
  // Wait for in-progress cleanup to complete
  if (this.cleanupPromise) {
    await this.cleanupPromise;
  }
}
```

## Risk Assessment

- **Impact**: Medium (duplicate cleanup operations, data inconsistency on shutdown)
- **Likelihood**: Low (requires specific timing of multi-instance deployments)
- **Overall**: P2 - Should be addressed before horizontal scaling

## Acceptance Criteria

- [ ] Initial cleanup delay increased to 30 seconds (or configurable)
- [ ] Advisory lock prevents concurrent cleanup across instances
- [ ] `stopCleanupScheduler` awaits in-progress cleanup
- [ ] Add test for multi-instance cleanup coordination
- [ ] Add test for graceful shutdown during cleanup

## Related

- TODO-039: Completed idempotency cleanup implementation (foundation for this work)
- TODO-040: Completed graceful shutdown timeout configuration
- `server/src/lib/shutdown.ts` - Graceful shutdown orchestration
