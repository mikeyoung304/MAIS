# Working Solutions: TODO Resolutions 182-191

**Date:** 2025-12-03
**Total Resolutions:** 10 TODOs
**Categories:** Security (1), Type Safety (3), Code Quality (4), Documentation (2)

This document extracts working solutions from recent TODO resolutions for reuse across the codebase and future reference.

---

## Security

### TODO-182: Remove Version/Environment from Metrics Endpoint

**Problem:** Metrics endpoint was exposing `version` and `environment` fields, creating information disclosure vulnerability.

**Solution:** Remove sensitive metadata from metrics output while preserving monitoring capabilities.

**Files Modified:**
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/metrics.routes.ts`

**Code:**

```typescript
// BEFORE: Exposed sensitive information
const metrics = {
  version: process.env.APP_VERSION,
  environment: process.env.NODE_ENV,
  timestamp: new Date().toISOString(),
  uptime_seconds: uptimeSeconds,
  // ... rest of metrics
};

// AFTER: Removed sensitive fields, kept operational metrics
const metrics = {
  // Timestamp
  timestamp: new Date().toISOString(),
  timestamp_ms: now,

  // Process metrics
  uptime_seconds: uptimeSeconds,
  memory_usage: process.memoryUsage(),

  // CPU usage
  cpu_usage: process.cpuUsage(),

  // Service metadata
  service: 'mais-api', // Static identifier only
};
```

**Benefits:**
- Prevents fingerprinting attacks from exposed version/environment info
- Maintains monitoring capability for uptime, memory, and CPU metrics
- Follows principle of least privilege: metrics endpoint returns only operational data needed for monitoring tools (Prometheus, Datadog)

**Key Principle:** Monitoring endpoints should expose system health metrics only, never revealing deployment or version information to external scrapers.

---

## Type Safety

### TODO-184: EventEmitter Unsubscribe Function

**Problem:** The `subscribe()` method returned `void`, making it impossible to unsubscribe from events without manual handler tracking. This pattern required callers to maintain handler references and use WeakMaps or other workarounds.

**Solution:** Return an unsubscribe function that encapsulates handler removal logic.

**Files Modified:**
- `/Users/mikeyoung/CODING/MAIS/server/src/lib/core/events.ts`

**Code:**

```typescript
// BEFORE: No way to unsubscribe
subscribe<K extends keyof AllEventPayloads>(
  event: K,
  handler: EventHandler<AllEventPayloads[K]>
): void {
  const existing = this.handlers.get(event as string) || [];
  this.handlers.set(event as string, [...existing, handler as EventHandler]);
}

// AFTER: Returns unsubscribe function
subscribe<K extends keyof AllEventPayloads>(
  event: K,
  handler: EventHandler<AllEventPayloads[K]>
): () => void {  // Changed return type
  const existing = this.handlers.get(event as string) || [];
  this.handlers.set(event as string, [...existing, handler as EventHandler]);

  // Return unsubscribe function that removes this specific handler
  return () => {
    const handlers = this.handlers.get(event as string) || [];
    const filtered = handlers.filter((h) => h !== handler);
    if (filtered.length > 0) {
      this.handlers.set(event as string, filtered);
    } else {
      this.handlers.delete(event as string);
    }
  };
}
```

**Usage Pattern:**

```typescript
const emitter = new InProcessEventEmitter();

// Subscribe and capture unsubscribe function
const unsubscribe = emitter.subscribe(BookingEvents.PAID, (payload) => {
  console.log(`Booking ${payload.bookingId} paid`);
});

// Later: unsubscribe without maintaining handler reference
unsubscribe();
```

**Benefits:**
- Memory safety: No handler references leak into closure
- Simplifies cleanup in React effects and lifecycle methods
- Type-safe: TypeScript enforces return type
- Follows standard event emitter pattern (Node.js EventEmitter, RxJS, etc.)

**Related Pattern:**

```typescript
// useEffect with auto-cleanup
useEffect(() => {
  const unsubscribe = emitter.subscribe(BookingEvents.PAID, handleBookingPaid);
  return () => unsubscribe(); // Clean up on unmount
}, []);
```

---

### TODO-185: Import Types from Contracts

**Problem:** Types were manually defined in utilities, creating duplication and sync issues with contract definitions.

**Solution:** Derive types directly from Zod schemas in contracts package using `z.infer<typeof Schema>`.

**Files Modified:**
- `/Users/mikeyoung/CODING/MAIS/client/src/lib/utils.ts`

**Code:**

```typescript
// BEFORE: Manual type definition (duplicated)
interface BookingStatus {
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  variant: 'default' | 'success' | 'warning' | 'error';
}

// AFTER: Import Zod schema from contracts, derive type
import { BookingStatusSchema } from '@macon/contracts';

// Type derived from Zod schema - always in sync
type BookingStatus = z.infer<typeof BookingStatusSchema>;

// Or for specific fields from a larger schema:
type BookingStatus = z.infer<typeof BookingSchema>['status'];
```

**Benefits:**
- Single source of truth: Schema is in contracts, types are derived
- Prevents sync issues when schemas change
- Compile-time verification: If schema changes break types, TypeScript errors immediately
- Reduces boilerplate: No need to duplicate type definitions

**Key Pattern:** Always prefer `z.infer<typeof Schema>` over manual type definitions.

---

### TODO-186: Exhaustiveness Checks

**Problem:** Switch/case statements on enums could silently fail if new enum values were added without updating the switch.

**Solution:** Add default case with exhaustiveness check using `never` type.

**Files Modified:**
- `/Users/mikeyoung/CODING/MAIS/client/src/lib/utils.ts`

**Code:**

```typescript
// BEFORE: Missing enum values silently ignored
function getStatusVariant(status: BookingStatus): BadgeVariant {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'paid':
      return 'success';
    // Missing 'refunded' and 'cancelled' - no error!
  }
}

// AFTER: Exhaustiveness check ensures all cases handled
function getStatusVariant(status: BookingStatus): BadgeVariant {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'paid':
      return 'success';
    case 'refunded':
      return 'info';
    case 'cancelled':
      return 'error';
    default:
      // If a new status is added to the enum, TypeScript will error here
      const _exhaustiveCheck: never = status;
      return _exhaustiveCheck;
  }
}

// Applied to multiple functions
function getRefundStatusText(status: RefundStatus): string {
  switch (status) {
    case 'pending':
      return 'Refund Pending';
    case 'completed':
      return 'Refunded';
    case 'failed':
      return 'Refund Failed';
    default:
      const _exhaustiveCheck: never = status;
      return _exhaustiveCheck;
  }
}
```

**Benefits:**
- Compile-time safety: TypeScript prevents missing cases
- Prevents silent failures when enums change
- Self-documenting: Code shows all possible values
- Catches schema changes early in development

**How It Works:**
1. If all cases are handled, `status` has type `never` (unreachable)
2. If a case is missing, `status` has that case's type, causing type error
3. Assigning to `never` variable makes the error visible

---

## Code Quality

### TODO-183: API Keys Inside Transaction

**Problem:** API keys were generated outside the transaction and logged before commit, wasting entropy if the transaction failed and keys weren't stored.

**Solution:** Generate keys inside the transaction, only log after successful commit.

**Files Modified:**
- `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/demo.ts`

**Code:**

```typescript
// BEFORE: Keys generated outside transaction
let publicKey: string;
let secretKey: string | null = null;

// Generate keys BEFORE transaction - wasted if rollback
publicKey = `pk_live_${DEMO_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
secretKey = `sk_live_${DEMO_SLUG}_${crypto.randomBytes(16).toString('hex')}`;

await prisma.$transaction(async (tx) => {
  const tenant = await createOrUpdateTenant(tx, {
    // ...
    apiKeyPublic: publicKey,
    apiKeySecret: secretKey,
  });
  // If transaction rolls back, keys are wasted
});

logger.warn(`Secret Key: ${secretKey}`); // Logged even on failure

// AFTER: Keys generated inside transaction, logged after commit
let publicKeyForLogging: string;
let secretKeyForLogging: string | null = null;

await prisma.$transaction(async (tx) => {
  // Generate keys INSIDE transaction - only created if commit succeeds
  let publicKey: string;
  let secretKey: string | null = null;

  if (existingTenant) {
    publicKey = existingTenant.apiKeyPublic;
  } else {
    publicKey = `pk_live_${DEMO_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
    secretKey = `sk_live_${DEMO_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
  }

  const tenant = await createOrUpdateTenant(tx, {
    // ...
    apiKeyPublic: publicKey,
    apiKeySecret: secretKey,
  });

  // Capture keys for logging AFTER transaction succeeds
  publicKeyForLogging = publicKey;
  secretKeyForLogging = secretKey;
}, { timeout: 60000 });

// Log ONLY after transaction commits successfully
if (existingTenant) {
  logger.info(`Public Key: ${publicKeyForLogging}`);
  logger.info('Secret key unchanged - using existing value');
} else {
  logger.info(`Public Key: ${publicKeyForLogging}`);
  logger.warn(`Secret Key: ${secretKeyForLogging}`);
  logger.warn('SAVE THESE KEYS - they will not be regenerated on subsequent seeds!');
}
```

**Pattern Applied to:** `demo.ts`, `e2e.ts`, `platform.ts`

**Benefits:**
- No wasted entropy: Keys only generated if they'll be stored
- Clearer intent: Logging happens after successful commit
- Transactional consistency: Keys and logging are atomically paired
- Prevents confusion: Don't log keys that weren't actually saved

**Key Principle:** Operations with side effects (logging) should happen AFTER transaction commits, not before.

---

### TODO-188: useConfirmDialog Cleanup

**Problem:** The `useConfirmDialog` hook created a Promise that could hang indefinitely if the component unmounted before the user confirmed or cancelled. This caused memory leaks and lingering promises in the React runtime.

**Solution:** Add useEffect cleanup that resolves the pending promise with false on unmount.

**Files Modified:**
- `/Users/mikeyoung/CODING/MAIS/client/src/hooks/useConfirmDialog.tsx`

**Code:**

```typescript
// BEFORE: No cleanup - promise can hang on unmount
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogState({
        ...options,
        isOpen: true,
        onConfirm: () => {
          setDialogState(null);
          resolveRef.current?.(true);
          resolveRef.current = null;
        },
      });
    });
  }, []);

  return { confirm, dialogState };
}

// AFTER: useEffect cleanup resolves pending promise
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  // Cleanup on unmount: resolve Promise with false to prevent memory leak
  useEffect(() => {
    return () => {
      resolveRef.current?.(false);
      resolveRef.current = null;
    };
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogState({
        ...options,
        isOpen: true,
        onConfirm: () => {
          setDialogState(null);
          resolveRef.current?.(true);
          resolveRef.current = null;
        },
      });
    });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      resolveRef.current?.(false);
      resolveRef.current = null;
      setDialogState(null);
    }
  }, []);

  return { confirm, dialogState, handleOpenChange };
}
```

**Benefits:**
- Prevents memory leaks: All promises are resolved before component unmounts
- Cleaner cleanup: React DevTools will show no lingering promises
- Graceful degradation: Cancelled dialogs resolve to false (safe for callers)
- Standard React pattern: cleanup function in useEffect

**Related Pattern: Promise Cancellation**
This is a general React pattern for promise-based hooks:

```typescript
useEffect(() => {
  return () => {
    // Resolve/reject any pending promises created by this hook
    if (resolveRef.current) {
      resolveRef.current(defaultValue);
      resolveRef.current = null;
    }
  };
}, []);
```

---

### TODO-189: EventEmitter Unit Tests

**Problem:** EventEmitter lacked comprehensive test coverage, making it risky to refactor or modify.

**Solution:** Create 14 unit tests covering core behaviors, edge cases, and error isolation.

**Files Created:**
- `/Users/mikeyoung/CODING/MAIS/server/test/lib/events.test.ts`

**Test Coverage:**

```typescript
// Test suite breakdown (14 tests):

describe('InProcessEventEmitter', () => {
  // 1. Basic subscribe/emit (3 tests)
  // - Multiple handlers for same event
  // - Async handler execution
  // - Event type isolation

  // 2. Error handling (2 tests)
  // - Sync and async handler errors don't affect other handlers
  // - Promise.allSettled ensures all handlers execute

  // 3. clearAll() behavior (2 tests)
  // - Clears all subscriptions
  // - Allows re-subscription after clear

  // 4. unsubscribe() function (4 tests)
  // - Individual handler unsubscription
  // - Safe to call multiple times
  // - Handler instance-specific removal
  // - Event key cleanup from map
});
```

**Key Test Patterns:**

```typescript
// Test error isolation
it('should isolate handler errors', async () => {
  const handler1 = vi.fn(() => {
    throw new Error('Handler 1 failed');
  });
  const handler2 = vi.fn();

  emitter.subscribe(BookingEvents.PAID, handler1);
  emitter.subscribe(BookingEvents.PAID, handler2);

  // Should not throw despite handler1 error
  await expect(emitter.emit(BookingEvents.PAID, payload)).resolves.toBeUndefined();

  // Both handlers executed (error isolated)
  expect(handler1).toHaveBeenCalledOnce();
  expect(handler2).toHaveBeenCalledOnce();
});

// Test unsubscribe function
it('should unsubscribe individual handlers', async () => {
  const handler1 = vi.fn();
  const handler2 = vi.fn();

  const unsubscribe1 = emitter.subscribe(BookingEvents.PAID, handler1);
  emitter.subscribe(BookingEvents.PAID, handler2);

  unsubscribe1();
  await emitter.emit(BookingEvents.PAID, payload);

  expect(handler1).not.toHaveBeenCalled();
  expect(handler2).toHaveBeenCalledOnce();
});
```

**Benefits:**
- Comprehensive coverage: All public methods tested
- Edge cases covered: Errors, cleanup, unsubscribe
- Regression prevention: Tests lock in expected behavior
- Documentation: Tests show how to use the API correctly

**Testing Pattern:** Use `vi.fn()` with `toHaveBeenCalledOnce()` for spy-based testing of event emission.

---

### TODO-190: Seed Transaction Logging

**Problem:** Seed operations lacked visibility into transaction timing and success/failure points.

**Solution:** Add logger calls before and after transaction with elapsed duration.

**Files Modified:**
- `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/demo.ts`
- `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/e2e.ts`
- `/Users/mikeyoung/CODING/MAIS/server/prisma/seeds/platform.ts`

**Code Pattern:**

```typescript
// BEFORE: Silent execution
await prisma.$transaction(async (tx) => {
  // Many operations...
});
logger.info('Seed completed');

// AFTER: Logged transaction boundaries with timing
const startTime = Date.now();

logger.info({ operations: 16, slug: DEMO_SLUG }, 'Starting seed transaction');

await prisma.$transaction(async (tx) => {
  // ... create tenant
  logger.info(`Demo tenant created: ${tenant.name}`);

  // ... create packages
  logger.info(`Demo packages created: ${packages.length}`);

  // ... link relationships
  logger.info(`Demo add-ons created and linked`);
}, { timeout: 60000 });

logger.info({
  slug: DEMO_SLUG,
  durationMs: Date.now() - startTime
}, 'Seed transaction committed successfully');

logger.info('Demo seed completed successfully (all operations committed)');
```

**Applied to All Seed Files:**
- `demo.ts`: Creates rich demo data
- `e2e.ts`: Creates test tenant with fixed keys
- `platform.ts`: Creates platform admin user

**Benefits:**
- Visibility: Track how long seed operations take
- Debugging: Identify where seed fails with precise logs
- Performance: Monitor seed duration across environments
- Compliance: Audit trail of database modifications

**Log Levels:**
- `logger.info()`: Transaction start/end, successes
- `logger.warn()`: Sensitive data (API keys, passwords)
- `logger.error()`: Transaction failures

---

## Documentation

### TODO-187: Advisory Lock Registry

**Problem:** PostgreSQL advisory locks were used without central documentation, creating collision risk and confusion about lock ID allocation.

**Solution:** Create comprehensive registry documenting all lock IDs, patterns, and guidelines.

**Files Created:**
- `/Users/mikeyoung/CODING/MAIS/docs/reference/ADVISORY_LOCKS.md`

**Documentation Sections:**

1. **Lock ID Registry**: Table of all hardcoded and dynamically generated lock IDs
2. **Lock Types**: Session vs. transaction locks explained
3. **FNV-1a Algorithm**: Hash function for deterministic lock ID generation
4. **Guidelines**: When to use locks, choosing ID strategy
5. **Lock Patterns**: Code examples for transaction and session locks
6. **Collision Analysis**: Risk assessment for lock ID space
7. **Testing**: How to test advisory locks in unit/integration tests
8. **Debugging**: SQL queries to monitor locks in production

**Key Content - Lock Registry:**

```markdown
| Lock ID | Component | Purpose | Scope |
|---------|-----------|---------|-------|
| 42424242 | IdempotencyService | Cleanup scheduler coordination | Global |
| FNV-1a({tenantId}:{date}) | BookingRepository | Race prevention | Per tenant+date |
| FNV-1a({tenantId}:balance:{bookingId}) | BookingRepository | Balance coordination | Per tenant+booking |
```

**Key Content - Adding New Locks:**

```markdown
### Use Hardcoded IDs When:
- Lock coordinates global operations (all tenants)
- Lock ID is feature-specific and unique
- No resource-specific scoping needed

### Use FNV-1a Hashing When:
- Lock is scoped to specific tenant/resource
- Lock ID must be deterministic from runtime values
- Many lock IDs needed (thousands of combinations)
```

**Benefits:**
- Central reference: All lock IDs documented in one place
- Collision prevention: Manual review prevents ID reuse
- Best practices: Guidelines for adding new locks
- Debugging aid: SQL queries for monitoring lock health

---

### TODO-191: Move Type Verification File to Examples

**Problem:** Type verification file was in test directory but wasn't a test - just documentation.

**Solution:** Move to `docs/examples/` directory with clear documentation comments.

**Files Moved:**
- `server/test/event-emitter-type-safety.ts` → `docs/examples/event-emitter-type-safety.ts`

**File Content:**

```typescript
/**
 * EventEmitter Type Safety Examples
 *
 * This file demonstrates how the EventEmitter enforces type safety at compile time.
 * It is NOT a test file - it's documentation through code examples.
 *
 * Location: docs/examples/event-emitter-type-safety.ts
 * Related: server/src/lib/core/events.ts
 *
 * Purpose:
 * - Show valid usage patterns for typed event emission and subscription
 * - Demonstrate compile-time type errors (via commented-out invalid examples)
 * - Serve as reference for developers working with the event system
 *
 * Usage:
 * 1. Read this file to understand type-safe event patterns
 * 2. Uncomment any invalid examples to see TypeScript errors
 * 3. Use valid patterns as templates for new event emissions
 */

// ✅ VALID: Correct event name with correct payload type
emitter.emit(BookingEvents.PAID, {
  bookingId: 'test-id',
  email: 'test@example.com',
  coupleName: 'Test Couple',
  eventDate: '2024-01-15',
  packageTitle: 'Test Package',
  addOnTitles: [],
  totalCents: 10000,
});

// ✅ VALID: Subscribe with correct handler type
emitter.subscribe(BookingEvents.PAID, (payload) => {
  console.log(payload.bookingId);
});

// ❌ INVALID: Wrong payload type (uncomment to verify TypeScript error)
/*
emitter.emit(BookingEvents.PAID, {
  wrongField: 'test',
});
*/

// ❌ INVALID: Missing required fields
/*
emitter.emit(BookingEvents.PAID, {
  bookingId: 'test-id',
  email: 'test@example.com',
  // Missing coupleName, eventDate, etc.
});
*/
```

**Benefits:**
- Clearer intent: Examples are in docs, not tests
- Better organization: Tests folder contains only runnable tests
- Easier discovery: Developers find examples in docs directory
- No impact on test suite: Not counted as a test file anymore

**Directory Structure After Move:**
```
docs/examples/
  event-emitter-type-safety.ts    (Type safety documentation)
  advisory-locks-query.sql         (Optional: SQL examples)

server/test/
  lib/events.test.ts               (Actual unit tests)
  integration/                     (Integration tests)
```

---

## Summary

| Category | Count | Key Solutions |
|----------|-------|---|
| Security | 1 | Removed version/environment from metrics |
| Type Safety | 3 | Unsubscribe functions, contract-derived types, exhaustiveness checks |
| Code Quality | 4 | Keys in transactions, hook cleanup, unit tests, transaction logging |
| Documentation | 2 | Advisory locks registry, type safety examples moved to docs |

## Reusable Patterns

1. **Unsubscribe Functions**: Return `() => void` from subscribe methods
2. **Type Derivation**: Use `z.infer<typeof Schema>` for consistency
3. **Exhaustiveness Checks**: Add `never` default case for enum switches
4. **Transaction Safety**: Generate data inside transactions, not before
5. **Promise Cleanup**: Resolve pending promises in useEffect cleanup
6. **Spy Testing**: Use `vi.fn()` with `toHaveBeenCalledOnce()` for verification
7. **Transaction Logging**: Log before/after with elapsed time
8. **Lock Registries**: Document all lock IDs in central reference

## See Also

- [ADVISORY_LOCKS.md](/Users/mikeyoung/CODING/MAIS/docs/reference/ADVISORY_LOCKS.md)
- [events.test.ts](/Users/mikeyoung/CODING/MAIS/server/test/lib/events.test.ts)
- [events.ts](/Users/mikeyoung/CODING/MAIS/server/src/lib/core/events.ts)
- [useConfirmDialog.tsx](/Users/mikeyoung/CODING/MAIS/client/src/hooks/useConfirmDialog.tsx)
