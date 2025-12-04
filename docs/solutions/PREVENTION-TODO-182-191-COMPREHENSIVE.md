---
title: Prevention Strategies for TODOs 182-191
category: prevention
tags: [security, type-safety, architecture, observability, testing, documentation]
priority: P1
last_updated: 2025-12-03
---

# Prevention Strategies for TODOs 182-191

This document provides comprehensive prevention strategies for 10 critical categories identified and resolved in commit 14374f7. Each category includes code review checklists, ESLint rules, and test patterns to prevent regression.

---

## Table of Contents

1. [Information Disclosure Prevention (182)](#1-information-disclosure-prevention-182)
2. [Transaction Atomicity (183)](#2-transaction-atomicity-183)
3. [Memory Leak Prevention - Event Systems (184)](#3-memory-leak-prevention---event-systems-184)
4. [Type DRY Principle (185)](#4-type-dry-principle-185)
5. [Exhaustiveness Checking (186)](#5-exhaustiveness-checking-186)
6. [Documentation Requirements (187)](#6-documentation-requirements-187)
7. [React Hook Cleanup (188)](#7-react-hook-cleanup-188)
8. [Test Coverage - Infrastructure Code (189)](#8-test-coverage---infrastructure-code-189)
9. [Observability - Transaction Logging (190)](#9-observability---transaction-logging-190)
10. [File Organization (191)](#10-file-organization-191)

---

## 1. Information Disclosure Prevention (182)

**Issue:** Public endpoints exposing version/environment information aids reconnaissance by revealing:

- Application version (identifies known vulnerabilities)
- Environment type (development vs production)
- System information (Node.js version, architecture, PID)

**Category:** Security - Information Disclosure

### Code Review Checklist

- [ ] Unauthenticated endpoints don't expose `process.env.npm_package_version`
- [ ] Unauthenticated endpoints don't expose `process.env.NODE_ENV`
- [ ] Unauthenticated endpoints don't expose system info (node version, arch, PID)
- [ ] `/metrics` endpoint returns only operational metrics (uptime, memory, CPU)
- [ ] Admin-only endpoints can safely expose version info
- [ ] Error responses don't leak version information
- [ ] Health check endpoints don't expose environment details

### ESLint Rules

Create custom rule to catch version/environment exposure:

```javascript
// .eslintrc.json additions
{
  "custom/no-public-version-exposure": [
    "error",
    {
      "allowedRoutes": ["admin/*", "internal/*"],
      "bannedPatterns": [
        "process.env.npm_package_version",
        "process.env.NODE_ENV",
        "process.version",
        "process.arch",
        "process.pid"
      ]
    }
  ]
}
```

Grep to find violations:

```bash
# Find version/environment in route responses
rg 'npm_package_version|NODE_ENV' server/src/routes --type ts

# Find system info exposure
rg 'process\.version|process\.arch|process\.pid' server/src/routes --type ts

# Check for environment in error responses
rg 'process\.env\.' server/src/routes --type ts
```

### Test Patterns

```typescript
// server/test/integration/metrics.test.ts
describe('GET /metrics', () => {
  it('should not expose version or environment', async () => {
    const response = await request(app).get('/metrics');

    expect(response.body).not.toHaveProperty('version');
    expect(response.body).not.toHaveProperty('environment');
    expect(response.body).not.toHaveProperty('nodeVersion');
    expect(response.body).not.toHaveProperty('platform');
  });

  it('should expose only operational metrics', async () => {
    const response = await request(app).get('/metrics');

    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime_seconds');
    expect(response.body).toHaveProperty('memory_usage');
    expect(response.body).toHaveProperty('cpu_usage');
    expect(response.body).toHaveProperty('service', 'mais-api');
  });

  it('admin endpoint can expose version', async () => {
    const token = await createAdminToken();
    const response = await request(app)
      .get('/admin/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('environment');
  });
});
```

### Prevention Guidelines

1. **All unauthenticated endpoints:** Only expose operational data
2. **Error responses:** Never include system information
3. **Logs:** Version/environment OK in server logs (ephemeral), not in database logs
4. **Config:** Document which information is safe for public consumption

---

## 2. Transaction Atomicity (183)

**Issue:** Resources (API keys, tokens) generated outside transactions but used inside. If transaction fails after generation:

- Resources are wasted
- Sensitive data logged but not persisted
- Re-running seeds creates duplicates

**Category:** Data Integrity - Atomicity

### Code Review Checklist

- [ ] All resource generation happens inside transactions (not before)
- [ ] Sensitive data logged only after successful commit
- [ ] Transaction wraps generation + storage together
- [ ] Seed scripts have 60+ second timeout for large operations
- [ ] Error handling checks for transaction failures
- [ ] Rollback cleans up any partial state

### ESLint Rules

Create rule to prevent resource generation outside transactions:

```javascript
// .eslintrc.json additions
{
  "custom/transaction-atomicity": [
    "error",
    {
      "restrictedPatterns": [
        "crypto.randomBytes",
        "generateToken",
        "generateKey"
      ],
      "requireInsideTransactions": true
    }
  ]
}
```

Grep to find violations:

```bash
# Find resource generation outside transactions
rg 'crypto\.randomBytes|generateToken|generateKey' server/src/prisma/seeds --type ts -B 5 -A 5

# Find logs before transaction
rg 'logger\.(info|warn|error)' server/src/prisma/seeds --type ts -B 10 | grep -E '(randomBytes|generateToken|generateKey)'
```

### Test Patterns

```typescript
// server/test/seeds/demo-atomicity.test.ts
describe('Seed Transaction Atomicity', () => {
  it('should generate api keys inside transaction', async () => {
    const startTime = Date.now();
    await runDemoSeed();
    const duration = Date.now() - startTime;

    // Verify all resources created
    const tenant = await prisma.tenant.findUnique({
      where: { slug: DEMO_SLUG },
    });

    expect(tenant?.apiKeyPublic).toBeDefined();
    expect(tenant?.apiKeySecret).toBeDefined();

    // No orphaned keys in logs
    const logs = await fetchServerLogs({ pattern: 'Secret Key:', duration });
    const keyLogs = logs.filter((l) => tenant?.apiKeySecret && l.includes(tenant.apiKeySecret));
    expect(keyLogs.length).toBe(1); // Logged exactly once
  });

  it('should not log sensitive data on transaction failure', async () => {
    // Mock transaction failure
    prisma.$transaction = vi.fn().mockRejectedValueOnce(new Error('TX failed'));

    await expect(runDemoSeed()).rejects.toThrow('TX failed');

    // No secrets in logs
    const logs = await fetchServerLogs({ pattern: 'Secret Key:' });
    expect(logs).toHaveLength(0);
  });

  it('should use at least 60s timeout for bulk operations', async () => {
    const seedCode = await readFile('server/prisma/seeds/demo.ts');
    const transactionMatch = seedCode.match(/prisma\.\$transaction\([^}]+timeout:\s*(\d+)/);

    expect(parseInt(transactionMatch[1])).toBeGreaterThanOrEqual(60000);
  });
});
```

### Prevention Guidelines

1. **Seed scripts:** Generate resources inside `prisma.$transaction()` callback
2. **Transaction timeout:** Use 60+ seconds for seed operations (prevents premature timeout)
3. **Logging:** Only log secrets after transaction commits successfully
4. **Error handling:** Don't log or track secrets in error paths
5. **Validation:** Verify resource persisted before logging

---

## 3. Memory Leak Prevention - Event Systems (184)

**Issue:** `EventEmitter.subscribe()` doesn't return unsubscribe function. Handlers added dynamically can accumulate in memory if never removed.

**Category:** Architecture - Memory Management

### Code Review Checklist

- [ ] `subscribe()` returns unsubscribe function (not void)
- [ ] Pattern matches React useEffect cleanup
- [ ] Event handlers can be individually removed
- [ ] No `clearAll()` required for individual handler removal
- [ ] Long-running services unsubscribe on shutdown
- [ ] Tests verify handler removal works

### ESLint Rules

Create rule to enforce unsubscribe pattern:

```javascript
// .eslintrc.json additions
{
  "custom/require-event-unsubscribe": [
    "error",
    {
      "allowedWithoutUnsubscribe": ["di.ts", "config.ts"],
      "message": "Event subscriptions must be unsubscribed (use useEffect cleanup pattern or store returned unsubscribe function)"
    }
  ]
}
```

Grep to find violations:

```bash
# Find subscribe calls without unsubscribe
rg 'eventEmitter\.subscribe|emitter\.subscribe' server/src --type ts -B 2 -A 2

# Find files with long-running event listeners
rg 'subscribe\(' server/src/services --type ts
```

### Test Patterns

```typescript
// server/test/lib/events.test.ts
describe('EventEmitter Unsubscribe', () => {
  it('should return unsubscribe function from subscribe', async () => {
    const emitter = new InProcessEventEmitter();
    const handler = vi.fn();

    const unsubscribe = emitter.subscribe('booking:paid', handler);
    expect(typeof unsubscribe).toBe('function');

    await emitter.emit('booking:paid', {
      /* payload */
    });
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsubscribe();

    await emitter.emit('booking:paid', {
      /* payload */
    });
    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('should handle multiple unsubscribe calls safely', async () => {
    const emitter = new InProcessEventEmitter();
    const handler = vi.fn();
    const unsubscribe = emitter.subscribe('event', handler);

    unsubscribe();
    expect(() => unsubscribe()).not.toThrow(); // Idempotent
  });

  it('should allow selective handler removal', async () => {
    const emitter = new InProcessEventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsub1 = emitter.subscribe('event', handler1);
    const unsub2 = emitter.subscribe('event', handler2);

    unsub1(); // Remove only handler1

    await emitter.emit('event', {
      /* payload */
    });
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should prevent memory leak in long-running process', async () => {
    const emitter = new InProcessEventEmitter();

    // Simulate adding 1000 handlers dynamically
    const unsubscribers = [];
    for (let i = 0; i < 1000; i++) {
      const unsub = emitter.subscribe('event', vi.fn());
      unsubscribers.push(unsub);
    }

    // Unsubscribe all
    unsubscribers.forEach((unsub) => unsub());

    // Verify no handlers remain
    expect(emitter['handlers'].get('event')).toHaveLength(0);
  });
});

// server/test/integration/event-service-lifecycle.test.ts
describe('Event Emitter Service Lifecycle', () => {
  it('should unsubscribe handlers on service shutdown', async () => {
    const service = createService();
    const initialHandlers = getHandlerCount();

    await service.start();
    const afterStartHandlers = getHandlerCount();

    expect(afterStartHandlers).toBeGreaterThan(initialHandlers);

    await service.shutdown();
    const afterShutdownHandlers = getHandlerCount();

    expect(afterShutdownHandlers).toBe(initialHandlers);
  });
});
```

### Prevention Guidelines

1. **Interface design:** Always return unsubscribe function from `subscribe()`
2. **React pattern:** Use cleanup effect in React components
3. **Services:** Store unsubscriber and call on shutdown
4. **DI container:** Call unsubscribers during container cleanup
5. **Testing:** Verify handler count decreases after unsubscribe

---

## 4. Type DRY Principle (185)

**Issue:** Type unions (`BookingStatus`, `RefundStatus`) manually duplicated from Zod schemas. Changes to contracts become silent failures on client.

**Category:** Type Safety - DRY

### Code Review Checklist

- [ ] Types derived from Zod schemas (not manually defined)
- [ ] No type unions duplicated across client/server
- [ ] `z.infer<typeof Schema>` used for type extraction
- [ ] Contract changes automatically propagate to UI
- [ ] Type mismatch detected at compile time
- [ ] Union type test cases cover all contract values

### ESLint Rules

Create rule to prevent type duplication:

```javascript
// .eslintrc.json additions
{
  "custom/no-duplicated-types": [
    "error",
    {
      "allowDuplicateTypes": false,
      "requiredInferFrom": ["@macon/contracts"],
      "message": "Types should be derived from Zod schemas using z.infer, not manually duplicated"
    }
  ]
}
```

Grep to find violations:

```bash
# Find manually defined type unions (potential duplication)
rg "export type \w+ = '[A-Z_]+'.*\|" client/src --type ts

# Find mismatches between contract and client
rg "z\.enum\(" packages/contracts --type ts | wc -l
rg "type \w+ = .*\|" client/src --type ts | wc -l
```

### Test Patterns

```typescript
// client/test/type-safety/status-types.test.ts
import { z } from 'zod';
import { BookingDtoSchema } from '@macon/contracts';
import { BookingStatus, RefundStatus } from '@/lib/utils';

describe('Status Type Synchronization', () => {
  it('should derive BookingStatus from contract schema', () => {
    const contractStatus = z.infer < typeof BookingDtoSchema > ['status'];

    // Compile-time check (TypeScript)
    const _: BookingStatus extends typeof contractStatus ? true : false = true;
  });

  it('BookingStatus should include all contract values', () => {
    const contractValues = z.infer < typeof BookingDtoSchema > ['status'];
    const utilityValues: BookingStatus[] = [
      'PENDING',
      'DEPOSIT_PAID',
      'PAID',
      'CONFIRMED',
      'CANCELED',
      'REFUNDED',
      'FULFILLED',
    ];

    // Each contract value should be representable
    contractValues.forEach((value) => {
      expect(utilityValues).toContain(value);
    });
  });

  it('should catch type mismatches when contract changes', () => {
    // If contract adds new status, this test will need update
    const contract = BookingDtoSchema;
    const utilFunction = getStatusVariant('PENDING' as BookingStatus);

    expect(utilFunction).toBeDefined();
  });
});

// Integration test: UI respects all contract values
describe('UI Status Handling', () => {
  it('should have UI variant for every contract status', () => {
    const contractStatuses: BookingStatus[] = [
      'PENDING',
      'DEPOSIT_PAID',
      'PAID',
      'CONFIRMED',
      'CANCELED',
      'REFUNDED',
      'FULFILLED',
    ];

    contractStatuses.forEach((status) => {
      const variant = getStatusVariant(status);
      expect(['default', 'secondary', 'destructive', 'outline']).toContain(variant);
    });
  });
});
```

### Prevention Guidelines

1. **Source of truth:** Define enums in Zod schemas (contracts package)
2. **Derivation:** Use `z.infer<typeof Schema>` in client code
3. **Import path:** `import { z } from 'zod'` in client if needed
4. **No duplication:** Don't manually type union values
5. **Testing:** Verify all contract values handled in switch statements

---

## 5. Exhaustiveness Checking (186)

**Issue:** Switch statements on union types lack exhaustiveness checks. New status values added to contract aren't caught at compile time.

**Category:** Type Safety - Exhaustiveness

### Code Review Checklist

- [ ] All switch statements on union types have exhaustiveness checks
- [ ] Default case assigns to `never` type: `const _: never = value`
- [ ] TypeScript errors if case is missing
- [ ] Fallback value provided after never assignment
- [ ] Type narrowing doesn't prevent exhaustiveness check
- [ ] Tests verify new union values cause compile errors

### ESLint Rules

```javascript
// .eslintrc.json additions
{
  "custom/require-exhaustive-switch": [
    "error",
    {
      "allowDefaultFallback": true,
      "requireNeverType": true,
      "message": "Switch on union types must have exhaustiveness check (default case with never type)"
    }
  ]
}
```

Grep to find violations:

```bash
# Find switch statements without default case
rg 'switch\s*\([^)]+\)\s*\{' client/src --type ts -A 20 | grep -v 'default:'

# Find switch statements on status/enum types
rg 'switch\s*\(.*status\)' client/src --type ts -A 20
```

### Test Patterns

```typescript
// client/test/unit/utils.test.ts
describe('Exhaustive Status Handling', () => {
  it('getStatusVariant should handle all BookingStatus values', () => {
    const allStatuses: BookingStatus[] = [
      'PENDING',
      'DEPOSIT_PAID',
      'PAID',
      'CONFIRMED',
      'CANCELED',
      'REFUNDED',
      'FULFILLED'
    ];

    allStatuses.forEach(status => {
      const variant = getStatusVariant(status);
      expect(['default', 'secondary', 'destructive', 'outline']).toContain(variant);
    });
  });

  it('getRefundStatusText should handle all RefundStatus values', () => {
    const allStatuses: (RefundStatus | undefined)[] = [
      undefined,
      'NONE',
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'PARTIAL',
      'FAILED'
    ];

    allStatuses.forEach(status => {
      const text = getRefundStatusText(status);
      // Should return string, null, or sensible value
      expect(text === null || typeof text === 'string').toBe(true);
    });
  });

  it('should compile error if new status added without handling', () => {
    // This is a TypeScript compile-time test
    // If contract adds 'ARCHIVED' status and function doesn't handle it,
    // the exhaustiveness check will cause compile error

    type CompileTest = () => {
      const status: BookingStatus = 'PENDING';
      const _: never = status; // Would fail if status could be unhandled value
    };
  });

  it('switch statement must have never type in default', () => {
    const code = `
      function getStatusVariant(status: BookingStatus) {
        switch(status) {
          case 'PENDING': return 'outline';
          default: {
            const _: never = status;
            return 'outline';
          }
        }
      }
    `;
    expect(code).toContain('const _: never = status');
  });
});
```

### Prevention Guidelines

1. **Pattern:** Always add `default: { const _: never = value; return fallback; }`
2. **Compile-time check:** TypeScript errors on missing cases
3. **Fallback:** Provide sensible return value after never assignment
4. **Testing:** Verify all union values handled
5. **Documentation:** Comment why exhaustiveness check is needed

---

## 6. Documentation Requirements (187)

**Issue:** Magic numbers, lock IDs, and resource identifiers lack documentation. Advisory lock ID `42424242` has no registry preventing collisions.

**Category:** Documentation - Resource Registry

### Code Review Checklist

- [ ] Magic numbers have inline documentation
- [ ] Advisory lock IDs registered in `docs/reference/ADVISORY_LOCKS.md`
- [ ] New lock IDs added to registry before commit
- [ ] Shared resource IDs (ports, timeouts, limits) documented
- [ ] Why magic number chosen is explained
- [ ] Registry includes scope (global, per-tenant, per-resource)

### ESLint Rules

```javascript
// .eslintrc.json additions
{
  "custom/require-magic-number-docs": [
    "warn",
    {
      "bannedMagicNumbers": [
        42424242, // Advisory lock ID
        // Add other magic numbers to document
      ],
      "exemptions": ["0", "1", "-1"], // Common numbers OK
      "message": "Magic numbers must be documented and registered in ADVISORY_LOCKS.md"
    }
  ]
}
```

Grep to find violations:

```bash
# Find magic numbers without context
rg '\b\d{4,}\b' server/src --type ts

# Find hardcoded IDs
rg 'const.*=\s*\d+;' server/src --type ts

# Find advisory locks without docs
rg 'pgAdvisoryLock|advisoryLock' server/src --type ts
```

### Test Patterns

```typescript
// server/test/integration/advisory-locks.test.ts
describe('Advisory Lock Registry', () => {
  it('should document all advisory lock IDs used', () => {
    const registryContent = readFileSync('docs/reference/ADVISORY_LOCKS.md', 'utf8');

    // Find all lock IDs in code
    const lockIds = [42424242]; // Add dynamically

    lockIds.forEach((id) => {
      expect(registryContent).toContain(id.toString());
    });
  });

  it('should prevent lock ID collisions', () => {
    const registryContent = readFileSync('docs/reference/ADVISORY_LOCKS.md', 'utf8');
    const lines = registryContent.split('\n');
    const idPattern = /^\|\s*(\d+)\s*\|/;
    const ids = new Set<number>();

    lines.forEach((line) => {
      const match = line.match(idPattern);
      if (match) {
        const id = parseInt(match[1]);
        expect(ids.has(id)).toBe(false); // No duplicates
        ids.add(id);
      }
    });
  });

  it('should use FNV-1a for hashed lock IDs', () => {
    const code = readFileSync('server/src/services/booking.repository.ts', 'utf8');

    // Verify consistent hashing approach
    expect(code).toContain('hashString') || expect(code).toContain('fnv1a');
  });
});
```

### Prevention Guidelines

1. **Advisory locks:** Document all IDs with purpose and scope
2. **Registry format:** File = `docs/reference/ADVISORY_LOCKS.md`, Table with ID/Component/Purpose/Scope
3. **Hashing:** Use FNV-1a for resource-scoped locks (per-booking, per-payment)
4. **Hardcoded:** Use for global locks (easier to debug)
5. **Collision prevention:** Add test to verify no duplicate IDs

### Documentation Template

```markdown
# PostgreSQL Advisory Locks Registry

| Lock ID  | Component          | Purpose            | Scope       | Notes                           |
| -------- | ------------------ | ------------------ | ----------- | ------------------------------- |
| 42424242 | IdempotencyService | Cleanup scheduling | Global      | Used for scheduler coordination |
| FNV-1a   | BookingRepository  | Race prevention    | Per booking | Hash of tenantId:date           |
```

---

## 7. React Hook Cleanup (188)

**Issue:** `useConfirmDialog` hook stores Promise resolver in ref without unmount cleanup. Pending promises hang in memory if component unmounts while dialog open.

**Category:** React - Memory Management

### Code Review Checklist

- [ ] `useRef` with Promise resolvers has cleanup effect
- [ ] `useEffect` with empty dependency array runs on unmount
- [ ] Cleanup resolves pending promises with sensible value
- [ ] Resolver ref set to null after cleanup
- [ ] Tests verify cleanup on unmount
- [ ] No console warnings about unresolved promises
- [ ] Memory leak tests verify handler cleanup

### ESLint Rules

```javascript
// .eslintrc.json additions
{
  "custom/require-ref-cleanup": [
    "error",
    {
      "refTypes": ["Promise", "function"],
      "requireCleanupEffect": true,
      "message": "useRef with Promise/function must have cleanup effect in useEffect"
    }
  ]
}
```

Grep to find violations:

```bash
# Find useRef without cleanup
rg 'useRef<.*function|Promise' client/src --type ts -A 5 | grep -v 'useEffect'

# Find refs to handler/resolver without null assignment
rg 'resolverRef\.|handlerRef\.' client/src --type ts | grep -v '= null'
```

### Test Patterns

```typescript
// client/test/hooks/useConfirmDialog.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

describe('useConfirmDialog Cleanup', () => {
  it('should cleanup resolver on unmount', async () => {
    const { unmount, result } = renderHook(() => useConfirmDialog());

    const confirmPromise = result.current.confirm({
      title: 'Test',
      description: 'Test',
    });

    // Unmount while promise pending
    unmount();

    // Promise should resolve with false (cleanup default)
    const resolved = await Promise.race([
      confirmPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
    ]);

    expect(resolved).toBe(false);
  });

  it('should not cause memory leaks with multiple unmounts', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 100; i++) {
      const { unmount, result } = renderHook(() => useConfirmDialog());

      result.current.confirm({
        title: 'Test',
        description: 'Test',
      });

      unmount();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const increase = finalMemory - initialMemory;

    // Memory increase should be modest (not accumulating)
    expect(increase).toBeLessThan(1024 * 1024); // < 1MB
  });

  it('should have useEffect cleanup in component', () => {
    const source = readFileSync('client/src/hooks/useConfirmDialog.tsx', 'utf8');

    expect(source).toContain('useEffect');
    expect(source).toContain('return () => {');
    expect(source).toContain('resolverRef.current');
  });

  it('should resolve false on unmount by default', async () => {
    const { unmount, result } = renderHook(() => useConfirmDialog());

    const promise = result.current.confirm({
      title: 'Confirm?',
      description: 'Really?',
    });

    unmount();

    await waitFor(() => {
      expect(promise).resolves.toBe(false);
    });
  });
});
```

### Prevention Guidelines

1. **Pattern:** Every `useRef` with Promise/function needs cleanup effect
2. **Cleanup effect:** `useEffect(() => { return () => { resolver?.(false); ref.current = null; }; }, [])`
3. **Default value:** Resolve with `false` (conservative default for confirmations)
4. **Testing:** Verify unmount resolves promise and prevents hangs
5. **Documentation:** Comment why cleanup is needed

---

## 8. Test Coverage - Infrastructure Code (189)

**Issue:** `InProcessEventEmitter` class has no dedicated unit tests. Event behavior only covered by integration tests in services.

**Category:** Testing - Coverage

### Code Review Checklist

- [ ] Infrastructure classes have dedicated unit test files
- [ ] Unit tests cover: initialization, error handling, edge cases
- [ ] Integration tests don't duplicate unit test coverage
- [ ] Mock adapters have unit tests (not just integration)
- [ ] Event emitter tests: multiple handlers, error isolation, clearAll
- [ ] Coverage report shows infrastructure code tested

### ESLint Rules

Create rule to require test files for infrastructure:

```javascript
// .eslintrc.json additions
{
  "custom/require-infrastructure-tests": [
    "warn",
    {
      "infrastructurePatterns": [
        "*/core/*",
        "*/lib/core/*",
        "*/ports.ts",
        "*adapter.ts"
      ],
      "exemptions": ["docs/", "examples/"],
      "message": "Infrastructure code should have dedicated unit tests in test/lib/ or test/adapters/"
    }
  ]
}
```

Grep to find violations:

```bash
# Find infrastructure files without tests
rg 'server/src/lib/core/.*\.ts$' server/src --type ts | while read f; do
  testFile="server/test/lib/$(basename $f .ts).test.ts"
  [ ! -f "$testFile" ] && echo "Missing: $testFile"
done

# Find EventEmitter usage without unit tests
rg 'EventEmitter' server/src --type ts -l | xargs -I {} sh -c 'basename {} | xargs -I FILE find server/test -name "*FILE*" || echo "Missing test for {}"'
```

### Test Patterns

```typescript
// server/test/lib/events.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InProcessEventEmitter, BookingEvents } from '../../src/lib/core/events';

describe('InProcessEventEmitter - Unit Tests', () => {
  let emitter: InProcessEventEmitter;

  beforeEach(() => {
    emitter = new InProcessEventEmitter();
  });

  describe('subscribe() and emit()', () => {
    it('should call all handlers for an event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.subscribe(BookingEvents.PAID, handler1);
      emitter.subscribe(BookingEvents.PAID, handler2);

      await emitter.emit(BookingEvents.PAID, {
        bookingId: 'test-id',
        email: 'test@test.com',
        // ... required fields
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should maintain handler execution order', async () => {
      const order = [];

      emitter.subscribe(BookingEvents.PAID, () => order.push(1));
      emitter.subscribe(BookingEvents.PAID, () => order.push(2));
      emitter.subscribe(BookingEvents.PAID, () => order.push(3));

      await emitter.emit(BookingEvents.PAID, {
        /* payload */
      });

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('Error Isolation', () => {
    it('should isolate handler errors', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const successHandler = vi.fn();

      emitter.subscribe(BookingEvents.PAID, errorHandler);
      emitter.subscribe(BookingEvents.PAID, successHandler);

      // Should not throw despite handler error
      await emitter.emit(BookingEvents.PAID, {
        /* payload */
      });

      expect(successHandler).toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should log handler errors', async () => {
      const logger = vi.fn();
      const handler = vi.fn().mockRejectedValue(new Error('Test error'));

      emitter.subscribe(BookingEvents.PAID, handler);

      await expect(
        emitter.emit(BookingEvents.PAID, {
          /* payload */
        })
      ).rejects.toThrow(); // Or resolves if error isolated

      // Verify error logged
      expect(logger).toHaveBeenCalledWith(expect.stringMatching(/error|failed/i));
    });
  });

  describe('clearAll()', () => {
    it('should remove all handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.subscribe(BookingEvents.PAID, handler1);
      emitter.subscribe(BookingEvents.CREATED, handler2);

      emitter.clearAll();

      await emitter.emit(BookingEvents.PAID, {
        /* payload */
      });
      await emitter.emit(BookingEvents.CREATED, {
        /* payload */
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('Type Safety', () => {
    it('should only accept valid event names', () => {
      // This is a TypeScript compile-time test
      const validEvents: (keyof typeof BookingEvents)[] = [
        BookingEvents.PAID,
        BookingEvents.CREATED,
        // ...
      ];

      validEvents.forEach((event) => {
        expect(() => {
          emitter.subscribe(event, vi.fn());
        }).not.toThrow();
      });
    });

    it('should enforce payload type safety', () => {
      // Compile-time test - TypeScript errors on wrong payload type
      const testType = (): void => {
        emitter.emit(BookingEvents.PAID, {
          bookingId: 'test',
          // Missing required fields would be compile error
        });
      };
    });
  });
});
```

### Prevention Guidelines

1. **Infrastructure coverage:** Core/, adapters/, lib/ should have unit tests
2. **Test location:** `test/lib/` mirrors `src/lib/`
3. **Not integration:** Don't rely only on service integration tests
4. **Edge cases:** Test error handling, empty states, cleanup
5. **Coverage target:** 80%+ for infrastructure code

---

## 9. Observability - Transaction Logging (190)

**Issue:** Seed transactions have 60-second timeouts but no logging of start/completion. Transaction failures invisible in production/CI.

**Category:** Observability - Logging

### Code Review Checklist

- [ ] All transactions log start (timestamp, operation count)
- [ ] All transactions log completion (duration, success/failure)
- [ ] Log includes tenant slug and context (demo, e2e, platform)
- [ ] Failed transactions log error details (not in production response)
- [ ] Duration metric tracked for performance monitoring
- [ ] Seed logs searchable by tenant slug
- [ ] No sensitive data in transaction logs

### ESLint Rules

```javascript
// .eslintrc.json additions
{
  "custom/require-transaction-logging": [
    "warn",
    {
      "requireStartLog": true,
      "requireEndLog": true,
      "message": "Database transactions should log start and end with duration"
    }
  ]
}
```

Grep to find violations:

```bash
# Find transactions without logging
rg 'prisma\.\$transaction' server/src/prisma/seeds --type ts -B 2 -A 2 | grep -v 'logger\.'

# Find long-running operations without timing
rg 'timeout.*60000' server/src --type ts | grep -v 'logger'
```

### Test Patterns

```typescript
// server/test/integration/seed-logging.test.ts
describe('Seed Transaction Logging', () => {
  it('should log transaction start', async () => {
    const logs = captureLogOutput();

    await runDemoSeed();

    const startLog = logs.find((l) => l.includes('Starting seed transaction'));
    expect(startLog).toBeDefined();
    expect(startLog).toMatch(/slug:.*demo/i);
    expect(startLog).toMatch(/operations:\s*\d+/i);
  });

  it('should log transaction completion with duration', async () => {
    const logs = captureLogOutput();

    await runDemoSeed();

    const endLog = logs.find((l) => l.includes('committed successfully'));
    expect(endLog).toBeDefined();
    expect(endLog).toMatch(/durationMs:\s*\d+/i);
  });

  it('should measure transaction duration accurately', async () => {
    const logs = captureLogOutput();
    const startTime = Date.now();

    await runDemoSeed();

    const endLog = logs[logs.length - 1];
    const durationMatch = endLog.match(/durationMs:\s*(\d+)/);
    const loggedDuration = parseInt(durationMatch[1]);
    const actualDuration = Date.now() - startTime;

    // Duration within 10% of actual
    expect(Math.abs(loggedDuration - actualDuration)).toBeLessThan(actualDuration * 0.1);
  });

  it('should log errors without sensitive data', async () => {
    const logs = captureLogOutput();

    // Mock transaction failure
    prisma.$transaction = vi.fn().mockRejectedValueOnce(new Error('Unique constraint violation'));

    await expect(runDemoSeed()).rejects.toThrow();

    const errorLog = logs.find((l) => l.includes('error') || l.includes('failed'));
    expect(errorLog).toBeDefined();
    expect(errorLog).toContain('slug');
    expect(errorLog).not.toContain('password');
    expect(errorLog).not.toContain('secret');
  });

  it('seed file must use logger for transaction lifecycle', () => {
    const seedCode = readFileSync('server/prisma/seeds/demo.ts', 'utf8');

    expect(seedCode).toContain('logger.info');
    expect(seedCode).toMatch(/logger\.info.*Starting seed/);
    expect(seedCode).toMatch(/logger\.info.*committed/);
    expect(seedCode).toMatch(/Duration|durationMs/);
  });
});
```

### Prevention Guidelines

1. **Start log:** Before transaction begins - timestamp, slug, operation count
2. **End log:** After commit - duration, operation count, status
3. **Metric:** Track duration for performance monitoring
4. **Error handling:** Log error details server-side (not client response)
5. **Context:** Include tenant slug for easy filtering

### Logging Template

```typescript
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

## 10. File Organization (191)

**Issue:** Type verification documentation file (`server/test/type-safety-verification.ts`) placed in `test/` directory but isn't runnable test. Confuses developers about test vs documentation.

**Category:** Organization - File Structure

### Code Review Checklist

- [ ] Documentation files in `docs/`, not `test/`
- [ ] Test files have vitest imports and test runner calls
- [ ] Example code in `docs/examples/`, not `test/`
- [ ] File location matches file purpose
- [ ] Documentation references updated if file moves
- [ ] No broken imports after move
- [ ] README updated with new file location

### ESLint Rules

Create rule to enforce file organization:

```javascript
// .eslintrc.json additions
{
  "custom/correct-file-location": [
    "warn",
    {
      "testDirectory": "test/",
      "docsDirectory": "docs/",
      "examplesDirectory": "docs/examples/",
      "require": {
        "test/*.ts": ["describe(", "it(", "vitest"],
        "docs/examples/*.ts": ["// Example:", "// Usage:"],
        "docs/**/*.md": ["---", "title:", "---"]
      },
      "message": "File location should match purpose: tests in test/, docs in docs/, examples in docs/examples/"
    }
  ]
}
```

Grep to find violations:

```bash
# Find documentation in test/ directory
find server/test -name "*.ts" -exec grep -l "Example\|Documentation\|Usage" {} \;

# Find tests without describe/it
find server/test -name "*.ts" ! -exec grep -q "describe\|it(" {} \;

# Find example code not in docs/examples
find . -path ./docs/examples -prune -o -name "*example*" -type f -print
```

### Test Patterns

```typescript
// test/file-organization.test.ts
describe('File Organization Rules', () => {
  it('should not have documentation in test/ directory', () => {
    const testFiles = glob.sync('server/test/**/*.ts');

    testFiles.forEach((file) => {
      const content = readFileSync(file, 'utf8');

      // Test files should have actual test code
      expect(content).toMatch(/describe\(|it\(/);

      // Not documentation
      expect(content).not.toMatch(/^# /m); // Markdown headers
      expect(content).not.toMatch(/^\/\*\*[\s\S]*?Usage:/); // Doc comments
    });
  });

  it('should have example code in docs/examples', () => {
    const exampleFile = 'docs/examples/event-emitter-type-safety.ts';

    expect(existsSync(exampleFile)).toBe(true);

    const content = readFileSync(exampleFile, 'utf8');
    expect(content).toContain('Example'); // Documented as example
    expect(content).not.toContain('describe('); // Not a test
  });

  it('should have documentation files in docs/', () => {
    const docFiles = glob.sync('docs/**/*.md');

    docFiles.forEach((file) => {
      const content = readFileSync(file, 'utf8');

      // Should have frontmatter
      expect(content).toMatch(/^---\s*title:/);
    });
  });

  it('should have no broken references after file moves', () => {
    const references = grep('type-safety-verification', ['server/', 'docs/', '*.md']);

    // Old location should not be referenced
    expect(references).not.toContain('server/test/type-safety-verification.ts');

    // New location should be referenced in docs
    expect(references).toContain('docs/examples/event-emitter-type-safety.ts');
  });
});
```

### Prevention Guidelines

1. **Test files:** Live in `server/test/`, contain vitest code
2. **Documentation:** Lives in `docs/`, markdown or commented code examples
3. **Examples:** Lives in `docs/examples/`, clear purpose comment at top
4. **README:** Reference files by new location after move
5. **No imports:** Documentation shouldn't be imported in application code

### Directory Structure

```
server/
├── src/
│   ├── routes/
│   ├── services/
│   └── lib/
├── test/                    # Only test files here
│   ├── integration/
│   ├── services/
│   └── lib/
└── prisma/

docs/
├── solutions/
├── reference/
├── examples/                # Example code (not tests)
│   └── event-emitter-type-safety.ts
├── guides/
└── README.md

packages/
├── contracts/
└── shared/
```

---

## Summary: Prevention Implementation Roadmap

### Phase 1: Code Review Templates (Day 1-2)

1. Add 10 new categories to PR template
2. Train engineers on checklist
3. Update PREVENTION-QUICK-REFERENCE.md

### Phase 2: ESLint Rules (Day 3-5)

1. Implement custom ESLint rules
2. Add to CI/CD gates
3. False positive report process

### Phase 3: Test Infrastructure (Week 2)

1. Create test templates for each category
2. Add to test helpers
3. Document in TESTING.md

### Phase 4: Documentation (Week 2-3)

1. Create category-specific guides
2. Add examples to docs/examples/
3. Cross-reference in CLAUDE.md

### Phase 5: Monitoring (Week 3)

1. Dashboard for violations per category
2. Trend analysis
3. Monthly review process

---

## Quick Reference: Which Category?

| Issue                          | Category                    | Checklist | ESLint | Test |
| ------------------------------ | --------------------------- | --------- | ------ | ---- |
| Exposed version/env            | Info Disclosure (182)       | ✓         | ✓      | ✓    |
| Resource generation outside TX | Transaction Atomicity (183) | ✓         | ✓      | ✓    |
| Event handler memory leak      | Memory Leak (184)           | ✓         | ✓      | ✓    |
| Duplicated types from schema   | Type DRY (185)              | ✓         | ✓      | ✓    |
| Switch missing cases           | Exhaustiveness (186)        | ✓         | ✓      | ✓    |
| Undocumented IDs               | Documentation (187)         | ✓         | ✓      | ✓    |
| Ref without cleanup            | Hook Cleanup (188)          | ✓         | ✓      | ✓    |
| Missing infrastructure tests   | Test Coverage (189)         | ✓         | ✓      | ✓    |
| No transaction logging         | Observability (190)         | ✓         | ✓      | ✓    |
| Docs in test/ directory        | File Organization (191)     | ✓         | ✓      | ✓    |

---

## Implementation Checklist

- [ ] Read this entire document (target: 1 hour)
- [ ] Add categories to code review template
- [ ] Implement custom ESLint rules (if possible)
- [ ] Create test templates for each category
- [ ] Update PREVENTION-QUICK-REFERENCE.md
- [ ] Schedule team training on new categories
- [ ] Add to CI/CD validation gates
- [ ] Create category-specific grep commands
- [ ] Set up metrics dashboard
- [ ] Plan monthly review process

---

**Document Status:** Complete (2025-12-03)
**Related Files:** PREVENTION-QUICK-REFERENCE.md, PREVENTION-IMPLEMENTATION-ROADMAP.md
**Next Review:** After 1 sprint of implementation (1 week)
**Maintainer:** Tech Lead
