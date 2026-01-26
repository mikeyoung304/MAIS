---
status: closed
priority: p2
issue_id: '604'
tags: [code-review, performance, cli, yagni]
dependencies: []
triage_notes: "WON'T FIX: YAGNI - Current sequential processing handles 100 tenants in ~17 min which is acceptable for daily batch jobs. Parallelization adds complexity for minimal gain."
closed_at: '2026-01-26'
---

# P2: Sequential Tenant Processing in CLI Batch

**Status:** CLOSED - YAGNI
**Priority:** P2 (Important)
**Category:** Performance
**File:** `server/scripts/run-eval-batch.ts`
**Lines:** 161-237

## Problem

Tenants are processed sequentially in a `for...of` loop:

```typescript
for (const tenant of tenants) {
  const traceIds = await pipeline.getUnevaluatedTraces(tenant.id, maxPerTenant);
  await pipeline.processBatch(tenant.id, traceIds);
}
```

**Impact:** For 100 tenants with 50 traces each at 10s/tenant = ~17 minutes total.

## Fix

Add bounded parallelism with `--concurrency` flag:

```typescript
import pLimit from 'p-limit';

const concurrencyLimit = options.concurrency || 5;
const limit = pLimit(concurrencyLimit);

await Promise.all(
  tenants.map((tenant) =>
    limit(async () => {
      const traceIds = await pipeline.getUnevaluatedTraces(tenant.id, maxPerTenant);
      await pipeline.processBatch(tenant.id, traceIds);
      // ... result tracking
    })
  )
);
```

Also add CLI option:

```typescript
} else if (arg.startsWith('--concurrency=')) {
  const value = parseInt(arg.split('=')[1], 10);
  if (!isNaN(value) && value > 0 && value <= 20) {
    options.concurrency = value;
  }
}
```

## Source

Code review of commit b2cab182 - Performance reviewer finding
