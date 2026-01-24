# P0 Remediation Sprint

**Priority:** BLOCKER - Must complete before production launch
**Estimated Effort:** 6-8 hours total
**Deadline:** Before any real customer payments

---

## Overview

The production readiness audit identified 5 P0 (critical) issues that must be resolved before launch. This plan provides the implementation details for each fix, ordered by dependency and risk.

**Current Score:** 72/100 (B-)
**After P0 Fixes:** 82/100 (B+)
**Verdict Change:** CONDITIONAL GO → FULL GO

---

## Issue 1: Redact API Keys in Logs

**Risk ID:** R-001 | **Effort:** 15 minutes | **Files:** 1

### Problem

Full API keys are logged in plaintext at two locations, creating a credential exposure risk if logs are compromised.

### Location

`server/src/middleware/tenant.ts` - Lines 85 and 112

### Current Code

```typescript
// Line 85
logger.warn({ apiKey, path: req.path }, 'Invalid API key format');

// Line 112
logger.warn({ apiKey, path: req.path }, 'Tenant not found for API key');
```

### Fix

```typescript
// Line 85
logger.warn(
  {
    apiKeyPeek: apiKey.slice(0, 8) + '...' + apiKey.slice(-4),
    path: req.path,
  },
  'Invalid API key format'
);

// Line 112
logger.warn(
  {
    apiKeyPeek: apiKey.slice(0, 8) + '...' + apiKey.slice(-4),
    path: req.path,
  },
  'Tenant not found for API key'
);
```

### Verification

```bash
# Should return 0 results after fix
grep -n "apiKey, path" server/src/middleware/tenant.ts
```

### Acceptance Criteria

- [ ] API keys are redacted to show only first 8 and last 4 characters
- [ ] Pattern matches existing redaction at line 151
- [ ] All tests pass

---

## Issue 2: Rotate All Exposed Credentials

**Risk ID:** R-004 | **Effort:** 1 hour | **Files:** 0 (external systems)

### Problem

Development credentials may have been exposed. All secrets must be rotated before production.

### Actions

#### 2.1 Supabase Console

1. Settings → Database → Change password
2. Settings → API → Regenerate anon and service keys

#### 2.2 Stripe Dashboard

1. Developers → Webhooks → Reveal signing secret → Roll secret

#### 2.3 Generate New Secrets

```bash
# JWT_SECRET (32 bytes = 64 hex chars)
openssl rand -hex 32

# BOOKING_TOKEN_SECRET
openssl rand -hex 32

# TENANT_SECRETS_ENCRYPTION_KEY
openssl rand -hex 32
```

#### 2.4 Update in Vercel

1. Project Settings → Environment Variables
2. Update all rotated values for Production environment
3. Trigger redeployment

#### 2.5 Update in Render

1. Service → Environment
2. Update all rotated values
3. Manual deploy

### Verification

- [ ] Login still works
- [ ] Booking flow completes (mock or test)
- [ ] Webhook events received from Stripe

### Acceptance Criteria

- [ ] All secrets rotated to new values
- [ ] Old secrets no longer work
- [ ] Application functions correctly with new secrets

---

## Issue 3: Add WebhookDelivery Cleanup Service

**Risk ID:** R-002 | **Effort:** 2 hours | **Files:** 2

### Problem

WebhookDelivery table has no retention policy. Will grow unbounded and eventually fill the database.

### Implementation

#### 3.1 Create Service

**File:** `server/src/services/webhook-delivery-cleanup.service.ts`

```typescript
/**
 * WebhookDelivery Cleanup Service
 *
 * Prevents unbounded table growth by cleaning up old webhook delivery records.
 * - Successful deliveries: 7 days retention
 * - Failed deliveries: 30 days retention (for debugging)
 *
 * Uses PostgreSQL advisory locks for multi-instance coordination.
 */

import type { PrismaClient } from '../generated/prisma';
import { logger } from '../lib/core/logger';

export class WebhookDeliveryCleanupService {
  private readonly RETENTION_DAYS_SUCCESSFUL = 7;
  private readonly RETENTION_DAYS_FAILED = 30;
  private readonly CLEANUP_DELAY_MS = 60000; // 60 seconds after startup
  private readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly ADVISORY_LOCK_ID = 42424243; // Unique lock ID

  private cleanupInterval: NodeJS.Timeout | null = null;
  private isCleanupRunning = false;
  private cleanupPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaClient) {
    logger.info('WebhookDeliveryCleanupService initialized');
  }

  /**
   * Start the cleanup scheduler
   *
   * Runs cleanup every 24 hours and once at startup (after 60 second delay).
   * Uses advisory locks to prevent concurrent cleanup across multiple instances.
   */
  public startCleanupScheduler(): void {
    if (this.cleanupInterval) {
      logger.warn('WebhookDelivery cleanup scheduler already running');
      return;
    }

    // Schedule regular cleanup
    this.cleanupInterval = setInterval(() => {
      void this.runCleanupWithLock();
    }, this.CLEANUP_INTERVAL_MS);

    // Run once at startup after delay
    setTimeout(() => {
      void this.runCleanupWithLock();
    }, this.CLEANUP_DELAY_MS);

    logger.info(
      { delayMs: this.CLEANUP_DELAY_MS },
      'WebhookDelivery cleanup scheduler started (runs every 24 hours)'
    );
  }

  /**
   * Stop the cleanup scheduler
   *
   * Waits for any in-progress cleanup to complete before stopping.
   */
  public async stopCleanupScheduler(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.cleanupPromise) {
      logger.info('Waiting for in-progress WebhookDelivery cleanup to complete...');
      await this.cleanupPromise;
    }

    logger.info('WebhookDelivery cleanup scheduler stopped');
  }

  /**
   * Run cleanup with PostgreSQL advisory lock
   */
  private async runCleanupWithLock(): Promise<void> {
    if (this.isCleanupRunning) {
      logger.debug('WebhookDelivery cleanup already in progress, skipping');
      return;
    }

    this.isCleanupRunning = true;
    this.cleanupPromise = (async () => {
      try {
        // Try to acquire advisory lock (non-blocking)
        const lockResult = await this.prisma.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>`
          SELECT pg_try_advisory_lock(${this.ADVISORY_LOCK_ID})
        `;

        const lockAcquired = lockResult[0]?.pg_try_advisory_lock;

        if (!lockAcquired) {
          logger.info('Another instance is running WebhookDelivery cleanup, skipping');
          return;
        }

        try {
          const count = await this.cleanupOldDeliveries();
          logger.info({ count }, 'WebhookDelivery cleanup completed successfully');
        } finally {
          // Always release lock
          await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${this.ADVISORY_LOCK_ID})`;
        }
      } catch (error) {
        logger.error({ err: error }, 'Failed to run WebhookDelivery cleanup');
      } finally {
        this.isCleanupRunning = false;
        this.cleanupPromise = null;
      }
    })();

    await this.cleanupPromise;
  }

  /**
   * Clean up old webhook delivery records
   *
   * @returns Number of records deleted
   */
  async cleanupOldDeliveries(): Promise<number> {
    const successfulCutoff = new Date();
    successfulCutoff.setDate(successfulCutoff.getDate() - this.RETENTION_DAYS_SUCCESSFUL);

    const failedCutoff = new Date();
    failedCutoff.setDate(failedCutoff.getDate() - this.RETENTION_DAYS_FAILED);

    const result = await this.prisma.webhookDelivery.deleteMany({
      where: {
        OR: [
          { status: 'delivered', createdAt: { lt: successfulCutoff } },
          { status: 'failed', createdAt: { lt: failedCutoff } },
        ],
      },
    });

    return result.count;
  }
}
```

#### 3.2 Update DI Container

**File:** `server/src/di.ts`

Add to imports:

```typescript
import { WebhookDeliveryCleanupService } from './services/webhook-delivery-cleanup.service';
```

Add in real mode initialization (after idempotencyService):

```typescript
// WebhookDelivery cleanup service
const webhookDeliveryCleanupService = new WebhookDeliveryCleanupService(prisma);
webhookDeliveryCleanupService.startCleanupScheduler();
```

Add to cleanup function:

```typescript
// Stop WebhookDelivery cleanup scheduler
await webhookDeliveryCleanupService.stopCleanupScheduler();
```

### Verification

```bash
npm test -- --grep "WebhookDeliveryCleanup"
```

### Acceptance Criteria

- [ ] Service created with same pattern as IdempotencyService
- [ ] Advisory lock prevents concurrent cleanup
- [ ] Scheduler starts on server boot
- [ ] Scheduler stops on shutdown
- [ ] 7-day retention for successful, 30-day for failed

---

## Issue 4: Add AgentSession Cleanup Service

**Risk ID:** R-003 | **Effort:** 2 hours | **Files:** 2

### Problem

AgentSession table stores chat histories with no retention policy. Will grow unbounded.

### Implementation

#### 4.1 Create Service

**File:** `server/src/services/agent-session-cleanup.service.ts`

```typescript
/**
 * AgentSession Cleanup Service
 *
 * Prevents unbounded table growth by cleaning up stale agent sessions.
 * - Sessions older than 90 days are deleted
 *
 * Uses PostgreSQL advisory locks for multi-instance coordination.
 */

import type { PrismaClient } from '../generated/prisma';
import { logger } from '../lib/core/logger';

export class AgentSessionCleanupService {
  private readonly RETENTION_DAYS = 90;
  private readonly CLEANUP_DELAY_MS = 90000; // 90 seconds after startup (stagger from webhook cleanup)
  private readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly ADVISORY_LOCK_ID = 42424244; // Unique lock ID

  private cleanupInterval: NodeJS.Timeout | null = null;
  private isCleanupRunning = false;
  private cleanupPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaClient) {
    logger.info('AgentSessionCleanupService initialized');
  }

  /**
   * Start the cleanup scheduler
   */
  public startCleanupScheduler(): void {
    if (this.cleanupInterval) {
      logger.warn('AgentSession cleanup scheduler already running');
      return;
    }

    this.cleanupInterval = setInterval(() => {
      void this.runCleanupWithLock();
    }, this.CLEANUP_INTERVAL_MS);

    setTimeout(() => {
      void this.runCleanupWithLock();
    }, this.CLEANUP_DELAY_MS);

    logger.info(
      { delayMs: this.CLEANUP_DELAY_MS },
      'AgentSession cleanup scheduler started (runs every 24 hours)'
    );
  }

  /**
   * Stop the cleanup scheduler
   */
  public async stopCleanupScheduler(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.cleanupPromise) {
      logger.info('Waiting for in-progress AgentSession cleanup to complete...');
      await this.cleanupPromise;
    }

    logger.info('AgentSession cleanup scheduler stopped');
  }

  /**
   * Run cleanup with PostgreSQL advisory lock
   */
  private async runCleanupWithLock(): Promise<void> {
    if (this.isCleanupRunning) {
      logger.debug('AgentSession cleanup already in progress, skipping');
      return;
    }

    this.isCleanupRunning = true;
    this.cleanupPromise = (async () => {
      try {
        const lockResult = await this.prisma.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>`
          SELECT pg_try_advisory_lock(${this.ADVISORY_LOCK_ID})
        `;

        const lockAcquired = lockResult[0]?.pg_try_advisory_lock;

        if (!lockAcquired) {
          logger.info('Another instance is running AgentSession cleanup, skipping');
          return;
        }

        try {
          const count = await this.cleanupOldSessions();
          logger.info({ count }, 'AgentSession cleanup completed successfully');
        } finally {
          await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${this.ADVISORY_LOCK_ID})`;
        }
      } catch (error) {
        logger.error({ err: error }, 'Failed to run AgentSession cleanup');
      } finally {
        this.isCleanupRunning = false;
        this.cleanupPromise = null;
      }
    })();

    await this.cleanupPromise;
  }

  /**
   * Clean up old agent sessions
   *
   * @returns Number of sessions deleted
   */
  async cleanupOldSessions(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.RETENTION_DAYS);

    const result = await this.prisma.agentSession.deleteMany({
      where: {
        updatedAt: { lt: cutoff },
      },
    });

    return result.count;
  }
}
```

#### 4.2 Update DI Container

Same pattern as Issue 3 - add initialization and shutdown.

### Acceptance Criteria

- [ ] Service created with same pattern as WebhookDeliveryCleanupService
- [ ] 90-day retention for sessions
- [ ] Staggered startup (90s delay vs 60s for webhook)
- [ ] Unique advisory lock ID (42424244)

---

## Issue 5: Fix Global Webhook Namespace

**Risk ID:** R-005 | **Effort:** 1 hour | **Files:** 1

### Problem

Webhook deduplication uses `'_global'` namespace for all events before tenantId extraction. This could cause:

1. Cross-tenant event collision (unlikely but possible)
2. Inconsistent deduplication (global check vs tenant-scoped record)

### Location

`server/src/routes/webhooks.routes.ts` - Lines 69-76

### Current Code

```typescript
// Line 69-76
const isGlobalDupe = await this.webhookRepo.isDuplicate('_global', event.id);
if (isGlobalDupe) {
  logger.info(
    { eventId: event.id },
    'Duplicate webhook (global check) - returning 200 OK to Stripe'
  );
  return;
}
```

### Analysis

The current flow:

1. Check `_global` namespace for duplicates (line 69)
2. Extract tenantId from event metadata (line 80-95)
3. Record event with `effectiveTenantId` (line 110)

**The Issue:** If event is first seen, it's recorded with tenant's ID. If seen again, the `_global` check won't find it because the record is tenant-scoped.

### Fix

Remove the pre-extraction global check. Move deduplication to AFTER tenantId extraction:

```typescript
// REMOVE lines 67-76 (global duplicate check)

// After extractTenantId (around line 95)
const tenantId = await this.extractTenantId(event);
const effectiveTenantId = tenantId || '_global';

// Add deduplication check HERE with the correct namespace
const isDuplicate = await this.webhookRepo.isDuplicate(effectiveTenantId, event.id);
if (isDuplicate) {
  logger.info(
    { eventId: event.id, tenantId: effectiveTenantId },
    'Duplicate webhook - returning 200 OK to Stripe'
  );
  return;
}

// For payment-critical events, require tenantId
if (this.isPaymentCriticalEvent(event.type) && !tenantId) {
  logger.error(
    { eventId: event.id, type: event.type },
    'Payment webhook missing tenantId - rejecting'
  );
  res.status(400).json({ error: 'Missing tenant metadata' });
  return;
}
```

Add helper method:

```typescript
private isPaymentCriticalEvent(type: string): boolean {
  return [
    'checkout.session.completed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'charge.refunded',
  ].includes(type);
}
```

### Verification

```bash
npm test -- --grep "webhook"
```

### Acceptance Criteria

- [ ] Global duplicate check removed
- [ ] Deduplication uses tenant-scoped namespace
- [ ] Payment events require tenantId
- [ ] Non-payment events fall back to `_global`
- [ ] All webhook tests pass

---

## Implementation Order

The fixes have no dependencies and can be done in parallel by different engineers, or sequentially:

| Order | Issue                   | Time   | Blocking?                          |
| ----- | ----------------------- | ------ | ---------------------------------- |
| 1     | API Key Redaction       | 15 min | Fastest win                        |
| 2     | Credential Rotation     | 1 hr   | Requires external systems          |
| 3     | WebhookDelivery Cleanup | 2 hr   | New service                        |
| 4     | AgentSession Cleanup    | 2 hr   | New service (copy pattern from #3) |
| 5     | Webhook Namespace       | 1 hr   | Careful code review needed         |

**Total: ~6.5 hours** (can be parallelized to ~3 hours with 2 engineers)

---

## Testing Strategy

### Unit Tests to Add

```typescript
// server/test/services/webhook-delivery-cleanup.service.test.ts
describe('WebhookDeliveryCleanupService', () => {
  it('should delete delivered records older than 7 days');
  it('should delete failed records older than 30 days');
  it('should preserve records within retention period');
  it('should use advisory lock for multi-instance coordination');
  it('should start and stop scheduler correctly');
});

// server/test/services/agent-session-cleanup.service.test.ts
describe('AgentSessionCleanupService', () => {
  it('should delete sessions older than 90 days');
  it('should preserve sessions within retention period');
  it('should use advisory lock for multi-instance coordination');
});
```

### Integration Tests

```bash
# Run all tests
npm test

# Run specific suites
npm test -- --grep "tenant middleware"
npm test -- --grep "webhook"
npm test -- --grep "cleanup"
```

### Manual Verification

1. **API Key Redaction:** Check server logs for redacted format
2. **Credentials:** Login and complete a test booking
3. **Cleanup Services:** Check logs for "cleanup scheduler started" messages
4. **Webhook Namespace:** Send test webhook and verify deduplication

---

## Post-Implementation Checklist

- [ ] All 5 P0 issues fixed
- [ ] All tests passing
- [ ] Logs show cleanup schedulers starting
- [ ] No full API keys in logs
- [ ] Credentials rotated and verified
- [ ] Code reviewed and merged
- [ ] Deployed to staging
- [ ] Smoke tests pass on staging
- [ ] Ready for production deployment

---

## References

- **Audit Executive Summary:** `audit_output/01_EXEC_SUMMARY.md`
- **Risk Register:** `audit_output/02_RISK_REGISTER.md`
- **Remediation Plan:** `audit_output/09_REMEDIATION_PLAN.md`
- **Cleanup Pattern Example:** `server/src/services/idempotency.service.ts`
- **DI Container:** `server/src/di.ts`
