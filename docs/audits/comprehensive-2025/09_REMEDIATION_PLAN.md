# MAIS Remediation Plan

**Date:** 2025-12-28
**Total Findings:** 52
**Timeline:** 6 weeks

---

## Executive Summary

This remediation plan prioritizes 52 audit findings into three phases:

- **NOW:** 5 P0 fixes (blockers) - Days 1-3
- **NEXT:** 15 P1 fixes (launch readiness) - Days 4-14
- **LATER:** 32 P2/P3 fixes (optimization) - Weeks 3-6

---

## Phase 1: NOW (Days 1-3) - Blockers

### Day 1: Critical Security Fixes

#### 1.1 Redact API Keys in Logs

**Risk ID:** R-001 | **Priority:** P0 | **Effort:** 30 min

**File:** `server/src/middleware/tenant.ts`

**Current (Line 85):**

```typescript
logger.warn({ apiKey, path: req.path }, 'Invalid API key format');
```

**Fixed:**

```typescript
logger.warn(
  {
    apiKeyPeek: apiKey.slice(0, 8) + '...' + apiKey.slice(-4),
    path: req.path,
  },
  'Invalid API key format'
);
```

**Current (Line 112):**

```typescript
logger.warn({ apiKey, path: req.path }, 'Tenant not found for API key');
```

**Fixed:**

```typescript
logger.warn(
  {
    apiKeyPeek: apiKey.slice(0, 8) + '...' + apiKey.slice(-4),
    path: req.path,
  },
  'Tenant not found for API key'
);
```

**Verification:**

```bash
grep -n "apiKey, path" server/src/middleware/tenant.ts
# Should return 0 results after fix
```

---

#### 1.2 Rotate All Exposed Credentials

**Risk ID:** R-004 | **Priority:** P0 | **Effort:** 1 hour

**Actions:**

1. **Supabase Console:**
   - Settings → Database → Change password
   - Settings → API → Regenerate anon and service keys

2. **Stripe Dashboard:**
   - Developers → Webhooks → Reveal signing secret → Roll secret

3. **Generate New Secrets:**

   ```bash
   # JWT_SECRET
   openssl rand -hex 32

   # BOOKING_TOKEN_SECRET
   openssl rand -hex 32

   # TENANT_SECRETS_ENCRYPTION_KEY
   openssl rand -hex 32
   ```

4. **Update in Vercel:**
   - Project Settings → Environment Variables
   - Update all rotated values
   - Trigger redeployment

5. **Update in Render:**
   - Service → Environment
   - Update all rotated values
   - Manual deploy

**Verification:**

- Login still works
- Booking flow completes
- Webhook events received

---

### Day 2: Data Cleanup Services

#### 2.1 Add WebhookDelivery Cleanup

**Risk ID:** R-002 | **Priority:** P0 | **Effort:** 2 hours

**Create:** `server/src/services/webhook-delivery-cleanup.service.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/core/logger';

export class WebhookDeliveryCleanupService {
  private cleanupIntervalId?: NodeJS.Timeout;
  private readonly RETENTION_DAYS_SUCCESSFUL = 7;
  private readonly RETENTION_DAYS_FAILED = 30;

  constructor(private prisma: PrismaClient) {}

  async cleanupOldDeliveries(): Promise<{ deleted: number }> {
    const successfulCutoff = new Date();
    successfulCutoff.setDate(successfulCutoff.getDate() - this.RETENTION_DAYS_SUCCESSFUL);

    const failedCutoff = new Date();
    failedCutoff.setDate(failedCutoff.getDate() - this.RETENTION_DAYS_FAILED);

    const { count } = await this.prisma.webhookDelivery.deleteMany({
      where: {
        OR: [
          { status: 'delivered', createdAt: { lt: successfulCutoff } },
          { status: 'failed', createdAt: { lt: failedCutoff } },
        ],
      },
    });

    logger.info({ deleted: count }, 'WebhookDelivery cleanup completed');
    return { deleted: count };
  }

  startCleanupScheduler(): void {
    // Run daily at 3 AM
    const INTERVAL_MS = 24 * 60 * 60 * 1000;

    // Run once at startup (delayed 60s)
    setTimeout(() => this.cleanupOldDeliveries(), 60000);

    // Schedule daily runs
    this.cleanupIntervalId = setInterval(() => this.cleanupOldDeliveries(), INTERVAL_MS);

    logger.info('WebhookDelivery cleanup scheduler started');
  }

  stopCleanupScheduler(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      logger.info('WebhookDelivery cleanup scheduler stopped');
    }
  }
}
```

**Update:** `server/src/di.ts`

```typescript
// In container initialization (real mode)
const webhookDeliveryCleanupService = new WebhookDeliveryCleanupService(prisma);
webhookDeliveryCleanupService.startCleanupScheduler();

// In cleanup function
await webhookDeliveryCleanupService.stopCleanupScheduler();
```

---

#### 2.2 Add AgentSession Cleanup

**Risk ID:** R-003 | **Priority:** P0 | **Effort:** 2 hours

**Create:** `server/src/services/agent-session-cleanup.service.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/core/logger';

export class AgentSessionCleanupService {
  private cleanupIntervalId?: NodeJS.Timeout;
  private readonly RETENTION_DAYS = 90;

  constructor(private prisma: PrismaClient) {}

  async cleanupOldSessions(): Promise<{ deleted: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.RETENTION_DAYS);

    const { count } = await this.prisma.agentSession.deleteMany({
      where: {
        updatedAt: { lt: cutoff },
      },
    });

    logger.info({ deleted: count }, 'AgentSession cleanup completed');
    return { deleted: count };
  }

  startCleanupScheduler(): void {
    const INTERVAL_MS = 24 * 60 * 60 * 1000;

    setTimeout(() => this.cleanupOldSessions(), 90000);

    this.cleanupIntervalId = setInterval(() => this.cleanupOldSessions(), INTERVAL_MS);

    logger.info('AgentSession cleanup scheduler started');
  }

  stopCleanupScheduler(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
  }
}
```

---

### Day 3: Payment Integrity Fixes

#### 3.1 Fix Global Webhook Namespace

**Risk ID:** R-005 | **Priority:** P0 | **Effort:** 1 hour

**File:** `server/src/routes/webhooks.routes.ts`

**Current (Lines 67-76):**

```typescript
const isGlobalDupe = await this.webhookRepo.isDuplicate('_global', event.id);
if (isGlobalDupe) {
  logger.info({ eventId: event.id }, 'Duplicate webhook (global check)');
  return;
}
```

**Fixed:**

```typescript
// Extract tenantId first for payment-critical events
const tenantId = this.extractTenantId(event);

// For payment events, require tenantId
if (this.isPaymentEvent(event.type) && !tenantId) {
  logger.error({ eventId: event.id, type: event.type },
    'Payment webhook missing tenantId - rejecting');
  res.status(400).json({ error: 'Missing tenant metadata' });
  return;
}

// Use tenantId for duplicate check (fallback to _global for non-payment)
const checkTenantId = tenantId || '_global';
const isDupe = await this.webhookRepo.isDuplicate(checkTenantId, event.id);
if (isDupe) {
  logger.info({ eventId: event.id, tenantId: checkTenantId }, 'Duplicate webhook');
  return;
}

// Helper methods
private isPaymentEvent(type: string): boolean {
  return [
    'checkout.session.completed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'charge.refunded',
  ].includes(type);
}
```

---

#### 3.2 Enforce Advisory Lock Timeout

**Risk ID:** R-010 | **Priority:** P0 | **Effort:** 30 min

**File:** `server/src/adapters/prisma/booking.repository.ts`

**Current (Lines 60-65):**

```typescript
return await this.prisma.$transaction(async (tx) => {
  // ... transaction logic
});
```

**Fixed:**

```typescript
return await this.prisma.$transaction(
  async (tx) => {
    // ... transaction logic
  },
  {
    timeout: BOOKING_TRANSACTION_TIMEOUT_MS, // 5000ms
    maxWait: 2000, // Max time to wait for connection
  }
);
```

---

## Phase 2: NEXT (Days 4-14) - Launch Readiness

### Week 1 (Days 4-7)

| Day | Fix                               | File                               | Effort |
| --- | --------------------------------- | ---------------------------------- | ------ |
| 4   | Restrict CORS origins             | `app.ts:132-134`                   | 30 min |
| 4   | Add error.tsx to booking routes   | `apps/web/.../book/[packageSlug]/` | 30 min |
| 5   | Add Next.js API timeout           | `api.ts:90-95,121-129`             | 30 min |
| 5   | Add Google Calendar timeout       | `gcal.adapter.ts:156-167`          | 30 min |
| 6   | Reduce impersonation token expiry | `identity.service.ts:66`           | 15 min |
| 6   | Add AgentProposal cleanup         | New service                        | 1 hour |
| 7   | Schedule AgentAuditLog cleanup    | `scheduler.ts`                     | 30 min |

### Week 2 (Days 8-14)

| Day   | Fix                               | File                           | Effort  |
| ----- | --------------------------------- | ------------------------------ | ------- |
| 8     | Add webhook delivery retry        | `webhook-delivery.service.ts`  | 2 hours |
| 9     | Validate metadata tenantId        | `webhook-processor.ts`         | 1 hour  |
| 10    | Make refund idempotent            | `refund-processing.service.ts` | 1 hour  |
| 11    | Add error.tsx to remaining routes | Multiple                       | 1 hour  |
| 12    | Add database health check         | `health-check.service.ts`      | 30 min  |
| 13-14 | Integration testing               | All fixes                      | 4 hours |

---

## Phase 3: LATER (Weeks 3-6) - Optimization

### Week 3: Code Quality

| Fix                        | Files                             | Effort  |
| -------------------------- | --------------------------------- | ------- |
| Extract useAgentChat hook  | AgentChat.tsx, PanelAgentChat.tsx | 4 hours |
| Create tenantId helper     | tenant-admin.routes.ts            | 1 hour  |
| Create DTO mapper          | tenant-admin.routes.ts            | 1 hour  |
| Standardize error handling | Multiple                          | 2 hours |

### Week 4: Architecture

| Fix                              | Files         | Effort  |
| -------------------------------- | ------------- | ------- |
| Split tenant-admin.routes.ts     | Route files   | 4 hours |
| Refactor scheduling-availability | Service files | 8 hours |
| Add circuit breaker              | Adapter files | 4 hours |

### Week 5: Testing

| Fix                        | Files                 | Effort  |
| -------------------------- | --------------------- | ------- |
| Implement 12 webhook tests | webhooks.http.spec.ts | 4 hours |
| Fix 30 flaky E2E tests     | E2E files             | 8 hours |
| Add tenant isolation tests | New tests             | 4 hours |

### Week 6: Documentation & Cleanup

| Fix                         | Files           | Effort  |
| --------------------------- | --------------- | ------- |
| Consolidate prevention docs | docs/solutions/ | 4 hours |
| Audit TODO files            | todos/          | 2 hours |
| Remove backup files         | Root            | 15 min  |
| Update architecture docs    | docs/           | 2 hours |

---

## Verification Checklist

### After Phase 1 (Day 3)

- [ ] API keys no longer appear in logs
- [ ] All credentials rotated and working
- [ ] WebhookDelivery cleanup running
- [ ] AgentSession cleanup running
- [ ] Payment webhooks require tenantId
- [ ] Advisory lock has timeout

### After Phase 2 (Day 14)

- [ ] CORS restricted to production domains
- [ ] All dynamic routes have error boundaries
- [ ] API calls have timeouts
- [ ] Impersonation tokens expire in 4 hours
- [ ] All cleanup schedulers running
- [ ] Webhook delivery retries working
- [ ] Refund processing is idempotent

### After Phase 3 (Week 6)

- [ ] No files > 500 lines (except contracts)
- [ ] Chat duplication eliminated
- [ ] 12 webhook tests passing
- [ ] E2E tests un-skipped and passing
- [ ] Prevention docs consolidated
- [ ] TODO files audited

---

## Resource Requirements

### Personnel

| Role              | Phase 1  | Phase 2 | Phase 3 |
| ----------------- | -------- | ------- | ------- |
| Backend Engineer  | 2 days   | 5 days  | 10 days |
| Frontend Engineer | 0        | 2 days  | 4 days  |
| DevOps            | 0.5 days | 0       | 0       |
| QA                | 0.5 days | 2 days  | 4 days  |

### Estimated Total

```
Phase 1: 3 days (critical path)
Phase 2: 11 days (can parallelize)
Phase 3: 20 days (can stagger)

Total calendar time: 6 weeks
Total effort: ~35 person-days
```

---

## Risk Mitigation

### If Phase 1 Delayed

- Do NOT launch until complete
- P0 issues are blockers
- No exceptions

### If Phase 2 Delayed

- Launch possible with monitoring
- Accept higher risk profile
- Prioritize timeout and error boundary fixes

### If Phase 3 Delayed

- Technical debt accumulates
- Schedule for next quarter
- Document in backlog

---

## Sign-Off

| Phase   | Completed | Verified By | Date |
| ------- | --------- | ----------- | ---- |
| Phase 1 | [ ]       |             |      |
| Phase 2 | [ ]       |             |      |
| Phase 3 | [ ]       |             |      |

---

_Remediation plan owned by Engineering Lead. Update weekly until completion._
