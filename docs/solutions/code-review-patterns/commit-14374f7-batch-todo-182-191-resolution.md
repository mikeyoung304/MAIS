# Code Review Batch Resolution: TODOs 182-191

## Metadata

```yaml
---
title: 'Security, Type Safety & Observability - TODO 182-191 Resolution'
category: code-review-patterns
commit: 14374f7
review_commit: 45024e6
tags: [security, type-safety, observability, memory-leaks, testing, documentation]
todos_resolved: [182, 183, 184, 185, 186, 187, 188, 189, 190, 191]
priority_breakdown:
  p2: 5 # 182-186
  p3: 5 # 187-191
date_resolved: 2025-12-03
changes_summary:
  files_changed: 23
  insertions: 847
  deletions: 46
---
```

## Problem Summary

During multi-agent code review of commit 45024e6 (initial security/type safety cleanup), 10 additional findings were identified across security, type safety, code quality, and documentation domains. These were documented as TODOs 182-191 and resolved using parallel agent processing.

### Priority Breakdown

| Priority          | Count | Categories                                        |
| ----------------- | ----- | ------------------------------------------------- |
| P2 (Important)    | 5     | Security (1), Type Safety (3), Data Integrity (1) |
| P3 (Nice-to-Have) | 5     | Documentation (2), Code Quality (2), Testing (1)  |

## Solutions by Category

### Security (1)

#### TODO-182: Remove version/environment from metrics

**Problem:** Metrics endpoint exposed `npm_package_version` and `NODE_ENV`, providing reconnaissance data.

**Solution:** Remove sensitive fields from response.

```typescript
// Before (server/src/routes/metrics.routes.ts)
const metrics = {
  timestamp: new Date().toISOString(),
  uptime_seconds: uptimeSeconds,
  memory_usage: process.memoryUsage(),
  cpu_usage: process.cpuUsage(),
  service: 'mais-api',
  version: process.env.npm_package_version || 'unknown', // ❌ Remove
  environment: process.env.NODE_ENV || 'development', // ❌ Remove
};

// After
const metrics = {
  timestamp: new Date().toISOString(),
  uptime_seconds: uptimeSeconds,
  memory_usage: process.memoryUsage(),
  cpu_usage: process.cpuUsage(),
  service: 'mais-api',
  // version and environment removed for security
};
```

---

### Type Safety (3)

#### TODO-184: EventEmitter unsubscribe

**Problem:** `subscribe()` returned `void`, preventing cleanup of individual handlers.

**Solution:** Return unsubscribe function.

```typescript
// server/src/lib/core/events.ts
export interface EventEmitter {
  subscribe<K extends keyof AllEventPayloads>(
    event: K,
    handler: EventHandler<AllEventPayloads[K]>
  ): () => void;  // Returns unsubscribe function
}

// Implementation
subscribe<K extends keyof AllEventPayloads>(
  event: K,
  handler: EventHandler<AllEventPayloads[K]>
): () => void {
  if (!this.handlers.has(event)) {
    this.handlers.set(event, []);
  }
  this.handlers.get(event)!.push(handler as EventHandler<unknown>);

  // Return unsubscribe function
  return () => {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const filtered = handlers.filter((h) => h !== handler);
      if (filtered.length > 0) {
        this.handlers.set(event, filtered);
      } else {
        this.handlers.delete(event);
      }
    }
  };
}
```

#### TODO-185: Import types from contracts

**Problem:** `BookingStatus` and `RefundStatus` manually duplicated from Zod schemas.

**Solution:** Derive types using `z.infer`.

```typescript
// Before (client/src/lib/utils.ts)
export type BookingStatus =
  | 'PENDING'
  | 'DEPOSIT_PAID'
  | 'PAID'
  | 'CONFIRMED'
  | 'CANCELED'
  | 'REFUNDED'
  | 'FULFILLED';
export type RefundStatus = 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

// After
import { BookingDtoSchema, BookingManagementDtoSchema } from '@macon/contracts';
import { z } from 'zod';

export type BookingStatus = z.infer<typeof BookingDtoSchema>['status'];
export type RefundStatus = NonNullable<z.infer<typeof BookingManagementDtoSchema>['refundStatus']>;
```

#### TODO-186: Exhaustiveness checks

**Problem:** Switch statements on union types silently returned undefined for unhandled cases.

**Solution:** Add `never` type exhaustiveness check.

```typescript
// client/src/lib/utils.ts
export function getStatusVariant(
  status: BookingStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'CONFIRMED':
    case 'FULFILLED':
      return 'default';
    case 'PAID':
    case 'DEPOSIT_PAID':
      return 'secondary';
    case 'CANCELED':
      return 'destructive';
    case 'REFUNDED':
      return 'secondary';
    case 'PENDING':
      return 'outline';
    default: {
      // Exhaustiveness check - TypeScript errors if case missing
      const _exhaustiveCheck: never = status;
      return 'outline';
    }
  }
}
```

---

### Data Integrity (1)

#### TODO-183: API keys inside transaction

**Problem:** API keys generated outside transaction but used inside; if transaction fails, keys are wasted.

**Solution:** Move key generation inside transaction callback.

```typescript
// server/prisma/seeds/demo.ts
let secretKeyForLogging: string | null = null;

await prisma.$transaction(
  async (tx) => {
    // Generate keys INSIDE transaction
    let secretKey: string | null = null;

    if (!existingTenant) {
      secretKey = `sk_live_${DEMO_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
    }

    const tenant = await createOrUpdateTenant(tx, {
      apiKeyPublic:
        existingTenant?.apiKeyPublic ??
        `pk_live_${DEMO_SLUG}_${crypto.randomBytes(8).toString('hex')}`,
      apiKeySecret: secretKey ?? undefined,
    });

    // Capture for logging after commit
    secretKeyForLogging = secretKey;
  },
  { timeout: 60000 }
);

// Log AFTER successful commit
if (secretKeyForLogging) {
  logger.warn({ secretKey: secretKeyForLogging }, 'New API keys generated');
}
```

---

### Code Quality (2)

#### TODO-188: useConfirmDialog cleanup

**Problem:** Promise resolve function stored in ref without unmount cleanup.

**Solution:** Add useEffect cleanup.

```typescript
// client/src/hooks/useConfirmDialog.tsx
import { useState, useCallback, useRef, useEffect } from 'react';

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resolveRef.current?.(false);
      resolveRef.current = null;
    };
  }, []);

  // ... rest unchanged
}
```

#### TODO-190: Seed transaction logging

**Problem:** Seed transactions had 60s timeouts but no visibility into timing.

**Solution:** Add start/commit logging with duration.

```typescript
// server/prisma/seeds/demo.ts (and e2e.ts, platform.ts)
logger.info({ slug: DEMO_SLUG, operations: 16 }, 'Starting seed transaction');
const startTime = Date.now();

await prisma.$transaction(
  async (tx) => {
    // ... seed operations
  },
  { timeout: 60000 }
);

logger.info(
  {
    slug: DEMO_SLUG,
    durationMs: Date.now() - startTime,
  },
  'Seed transaction committed successfully'
);
```

---

### Testing (1)

#### TODO-189: EventEmitter unit tests

**Problem:** `InProcessEventEmitter` had no dedicated unit tests.

**Solution:** Created 14 unit tests covering all behaviors.

```typescript
// server/test/lib/events.test.ts
describe('InProcessEventEmitter', () => {
  it('should call all handlers for an event', async () => {
    /* ... */
  });
  it('should handle async handlers', async () => {
    /* ... */
  });
  it('should isolate handler errors', async () => {
    /* ... */
  });
  it('should clear all handlers with clearAll()', () => {
    /* ... */
  });
  it('should unsubscribe individual handlers', async () => {
    /* ... */
  });
  it('should handle unsubscribing multiple times safely', () => {
    /* ... */
  });
  it('should remove event key when last handler unsubscribed', () => {
    /* ... */
  });
  // ... 7 more tests
});
```

---

### Documentation (2)

#### TODO-187: Advisory lock registry

**Problem:** Hardcoded lock ID `42424242` undocumented.

**Solution:** Created `docs/reference/ADVISORY_LOCKS.md` with:

- Lock ID registry table
- FNV-1a hash algorithm reference
- Guidelines for adding new locks
- Collision risk analysis
- Monitoring SQL queries

#### TODO-191: Move type verification file

**Problem:** Documentation file in `server/test/` directory.

**Solution:** Moved to `docs/examples/event-emitter-type-safety.ts` with updated header.

---

## Prevention Strategies

### Code Review Checklist

- [ ] **Information Disclosure**: Check unauthenticated endpoints for version/environment exposure
- [ ] **Transaction Atomicity**: Resource generation (keys, IDs) happens inside transactions
- [ ] **Event Subscriptions**: `subscribe()` returns unsubscribe function
- [ ] **Type DRY**: Types derived from Zod schemas, not duplicated
- [ ] **Exhaustiveness**: Switch statements on unions have `never` default case
- [ ] **React Cleanup**: useRef with callbacks has useEffect cleanup
- [ ] **Observability**: Long-running operations log start/end with duration
- [ ] **Test Coverage**: Infrastructure code has dedicated unit tests
- [ ] **File Organization**: Documentation in `docs/`, examples in `docs/examples/`

### ESLint Rules (Conceptual)

```javascript
// Detect missing exhaustiveness check
'switch-exhaustiveness-check': 'error',

// Detect duplicated type definitions
'no-duplicate-type-constituents': 'error',

// Require useEffect cleanup for refs storing callbacks
'react-hooks/exhaustive-deps': 'warn',
```

### Test Patterns

```typescript
// Test unsubscribe pattern
it('should unsubscribe handlers', async () => {
  const handler = vi.fn();
  const unsubscribe = emitter.subscribe(Event.TYPE, handler);

  unsubscribe();
  await emitter.emit(Event.TYPE, payload);

  expect(handler).not.toHaveBeenCalled();
});

// Test exhaustiveness at compile time
// Add new enum value → TypeScript error if switch incomplete
```

---

## Related Documentation

- **Multi-Agent Review Process**: [methodology/multi-agent-code-review-process.md](/docs/solutions/methodology/multi-agent-code-review-process.md)
- **Type Safety Prevention**: [PREVENTION-TS-REST-ANY-TYPE.md](/docs/solutions/PREVENTION-TS-REST-ANY-TYPE.md)
- **React Hooks Prevention**: [PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md](/docs/solutions/PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
- **Advisory Locks ADR**: [ADR-013-postgresql-advisory-locks.md](/docs/adrs/ADR-013-postgresql-advisory-locks.md)
- **EventEmitter Examples**: [event-emitter-type-safety.ts](/docs/examples/event-emitter-type-safety.ts)
- **Prevention Strategies Index**: [PREVENTION-STRATEGIES-INDEX.md](/docs/solutions/PREVENTION-STRATEGIES-INDEX.md)

## Related TODOs

| TODO | Relation                                               |
| ---- | ------------------------------------------------------ |
| 175  | Prior metrics cleanup (node_version, platform removed) |
| 176  | useConfirmDialog Promise fix (base for 188)            |
| 177  | EventEmitter type safety (base for 184, 189)           |
| 178  | Seed transaction wrapping (base for 183, 190)          |
| 180  | Typed status unions (base for 185, 186)                |

## Commits

- **45024e6**: Initial security/type safety cleanup (generated review findings)
- **a6c32e5**: Code review findings documented as TODOs 182-191
- **14374f7**: All 10 TODOs resolved (this document)
