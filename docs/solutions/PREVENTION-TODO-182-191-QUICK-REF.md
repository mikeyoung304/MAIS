---
title: Quick Reference - TODO 182-191 Prevention Strategies
category: prevention
tags: [cheat-sheet, quick-ref, 182-191]
priority: P1
last_updated: 2025-12-03
---

# Quick Reference: TODO 182-191 Prevention Strategies

**Print this and keep it handy!**

---

## 1. Information Disclosure (182)

**Rule:** Never expose version/environment in public endpoints

```typescript
// ❌ WRONG
const metrics = {
  version: process.env.npm_package_version, // Version leak!
  environment: process.env.NODE_ENV, // Environment leak!
  nodeVersion: process.version, // System info leak!
};

// ✅ RIGHT
const metrics = {
  timestamp: new Date().toISOString(),
  uptime_seconds: process.uptime(),
  memory_usage: process.memoryUsage(),
  cpu_usage: process.cpuUsage(),
  service: 'mais-api',
};
```

**Grep:** `rg 'npm_package_version|NODE_ENV|process\.version' server/src/routes`

**Test:** Verify `/metrics` endpoint doesn't expose version, environment, or system info

---

## 2. Transaction Atomicity (183)

**Rule:** Generate resources inside transactions, not before

```typescript
// ❌ WRONG - Key generated outside, used inside
let secretKey = `sk_live_${SLUG}_${crypto.randomBytes(16).toString('hex')}`;
await prisma.$transaction(async (tx) => {
  await tx.tenant.create({ data: { apiKeySecret: secretKey } });
  // If TX fails: key wasted, logged but not stored
});
logger.warn(`Secret Key: ${secretKey}`);

// ✅ RIGHT - Everything inside transaction
await prisma.$transaction(
  async (tx) => {
    const secretKey = `sk_live_${SLUG}_${crypto.randomBytes(16).toString('hex')}`;
    await tx.tenant.create({ data: { apiKeySecret: secretKey } });
    // Store for logging after commit
    return secretKey;
  },
  { timeout: 60000 }
);
// Log only after commit succeeds
if (secretKey) logger.warn(`Secret Key: ${secretKey}`);
```

**Grep:** `rg 'crypto\.randomBytes|generateToken' server/src/prisma/seeds -B 5 | grep -v '\$transaction'`

**Test:** Create test that verifies no orphaned secrets on transaction failure

---

## 3. Memory Leak - Event Systems (184)

**Rule:** subscribe() must return unsubscribe function

```typescript
// ❌ WRONG - No way to unsubscribe
const subscribe = (event: string, handler: Function): void => {
  handlers[event] = handler;
};

// ✅ RIGHT - Return unsubscribe function
const subscribe = (event: string, handler: Function): (() => void) => {
  if (!handlers[event]) handlers[event] = [];
  handlers[event].push(handler);

  return () => {
    const idx = handlers[event].indexOf(handler);
    if (idx > -1) handlers[event].splice(idx, 1);
  };
};

// Usage
const unsub = emitter.subscribe('event', handler);
unsub(); // Clean removal
```

**Grep:** `rg 'subscribe.*:\s*void' server/src --type ts`

**Test:** Verify unsubscribe removes specific handler and prevents re-firing

---

## 4. Type DRY Principle (185)

**Rule:** Derive types from Zod schemas, never duplicate

```typescript
// ❌ WRONG - Duplicated type definition
export type BookingStatus = 'PENDING' | 'PAID' | 'CONFIRMED' | 'CANCELED';

// From contract
status: z.enum([
  'PENDING',
  'DEPOSIT_PAID',
  'PAID',
  'CONFIRMED',
  'CANCELED',
  'REFUNDED',
  'FULFILLED',
]);

// ✅ RIGHT - Derived from schema
import { BookingDtoSchema } from '@macon/contracts';
export type BookingStatus = z.infer<typeof BookingDtoSchema>['status'];
```

**Grep:** `rg "export type \w+ = '[A-Z_]+'.*\|" client/src --type ts`

**Test:** Verify compile error if contract changes type but client doesn't update

---

## 5. Exhaustiveness Checking (186)

**Rule:** Default case must assign to never type

```typescript
// ❌ WRONG - Missing exhaustiveness check
function getStatusVariant(status: BookingStatus) {
  switch (status) {
    case 'PENDING':
      return 'outline';
    case 'PAID':
      return 'secondary';
    // Missing case: CONFIRMED, CANCELED, etc.
  }
  // Silent return undefined if new status added!
}

// ✅ RIGHT - Compile-time guarantee
function getStatusVariant(status: BookingStatus): string {
  switch (status) {
    case 'PENDING':
      return 'outline';
    case 'PAID':
      return 'secondary';
    // ... all cases
    default: {
      const _: never = status; // ← TypeScript errors if case missing!
      return 'outline';
    }
  }
}
```

**Grep:** `rg 'switch\s*\([^)]+status' client/src --type ts -A 30 | grep -v 'default:'`

**Test:** Verify TypeScript compile error if union type adds value without handling

---

## 6. Documentation Requirements (187)

**Rule:** All advisory lock IDs and magic numbers must be registered

```typescript
// ❌ WRONG - Hardcoded without documentation
private readonly advisoryLockId = 42424242; // What is this?

// ✅ RIGHT - Documented in registry
private readonly advisoryLockId = 42424242; // See docs/reference/ADVISORY_LOCKS.md
```

**Registry file:** `docs/reference/ADVISORY_LOCKS.md`

```markdown
| Lock ID  | Component          | Purpose            | Scope       |
| -------- | ------------------ | ------------------ | ----------- |
| 42424242 | IdempotencyService | Cleanup scheduling | Global      |
| FNV-1a   | BookingRepository  | Race prevention    | Per booking |
```

**Test:** Verify all lock IDs in code appear in registry, no duplicates

---

## 7. React Hook Cleanup (188)

**Rule:** useRef with Promise/function needs cleanup effect

```typescript
// ❌ WRONG - No cleanup, Promise hangs on unmount
export function useConfirmDialog() {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  // ... rest of hook
}

// ✅ RIGHT - Cleanup on unmount
export function useConfirmDialog() {
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup: resolve pending promise
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  // ... rest of hook
}
```

**Grep:** `rg 'useRef<.*Promise|Function' client/src --type ts -A 10 | grep -v 'useEffect'`

**Test:** Verify Promise resolves with false on component unmount

---

## 8. Test Coverage - Infrastructure (189)

**Rule:** Core/, lib/, adapters/ code needs dedicated unit tests

```
✅ Should exist:
server/test/lib/events.test.ts
server/test/adapters/mock-calendar.test.ts

❌ Should NOT exist:
server/test/type-safety-verification.ts (this is documentation, not a test!)
```

**Test checklist:**

- [ ] Error isolation (one handler error doesn't crash emitter)
- [ ] Multiple handlers for same event
- [ ] Async handler execution
- [ ] Handler registration and cleanup

**Grep:** `find server/test -name "*.ts" ! -exec grep -q "describe\|it(" {} \; -print`

---

## 9. Observability - Transaction Logging (190)

**Rule:** All transactions log start and completion with duration

```typescript
// ❌ WRONG - No visibility
await prisma.$transaction(
  async (tx) => {
    // ... 16 operations
  },
  { timeout: 60000 }
);

// ✅ RIGHT - Full observability
logger.info({ slug: DEMO_SLUG, operations: 16 }, 'Starting seed transaction');
const startTime = Date.now();

await prisma.$transaction(
  async (tx) => {
    // ... 16 operations
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

**Test:** Parse logs and verify start log exists, duration tracked

**Grep:** `rg '\$transaction' server/src/prisma/seeds -A 2 | grep -v logger`

---

## 10. File Organization (191)

**Rule:** File location must match file purpose

```
✅ Correct location:
- Tests: server/test/.../*.test.ts (must have describe/it)
- Documentation: docs/**/*.md
- Examples: docs/examples/*.ts (demonstration code)

❌ Wrong location:
- Documentation in test/ directory
- Example code in src/ directory
- Tests in docs/ directory
```

**Check:**

- [ ] Moved `server/test/type-safety-verification.ts` → `docs/examples/event-emitter-type-safety.ts`
- [ ] Updated file header comments
- [ ] No broken references

---

## Testing Each Category

### Minimal Test Template

```typescript
describe('TODO 182-191 Prevention', () => {
  // 182: Info Disclosure
  it('should not expose version in metrics', () => {
    const metrics = getMetrics();
    expect(metrics).not.toHaveProperty('version');
  });

  // 183: Transaction Atomicity
  it('should create api keys inside transaction', () => {
    const code = readFileSync('server/prisma/seeds/demo.ts', 'utf8');
    expect(code).toContain('await prisma.$transaction(async (tx) => {');
    expect(code).toMatch(/randomBytes.*tx\./);
  });

  // 184: Memory Leak
  it('should return unsubscribe from subscribe', () => {
    const unsub = emitter.subscribe('event', () => {});
    expect(typeof unsub).toBe('function');
  });

  // 185: Type DRY
  it('should derive types from schemas', () => {
    const code = readFileSync('client/src/lib/utils.ts', 'utf8');
    expect(code).toContain('z.infer');
    expect(code).not.toMatch(/export type \w+ = '[A-Z_]+'.*\|/);
  });

  // 186: Exhaustiveness
  it('switch statements should have never type', () => {
    const code = readFileSync('client/src/lib/utils.ts', 'utf8');
    const switches = code.match(/switch\s*\([^)]+\)/g);
    switches?.forEach((s) => {
      const startIdx = code.indexOf(s);
      const endIdx = code.indexOf('}', startIdx);
      const switchBlock = code.substring(startIdx, endIdx);
      expect(switchBlock).toContain('never');
    });
  });

  // 187: Documentation
  it('should document all advisory lock IDs', () => {
    const registry = readFileSync('docs/reference/ADVISORY_LOCKS.md', 'utf8');
    expect(registry).toContain('42424242');
  });

  // 188: React Cleanup
  it('should cleanup useRef on unmount', () => {
    const code = readFileSync('client/src/hooks/useConfirmDialog.tsx', 'utf8');
    expect(code).toContain('useEffect');
    expect(code).toContain('resolverRef.current = null');
  });

  // 189: Test Coverage
  it('should have unit tests for infrastructure', () => {
    expect(existsSync('server/test/lib/events.test.ts')).toBe(true);
  });

  // 190: Observability
  it('should log transaction start and duration', () => {
    const code = readFileSync('server/prisma/seeds/demo.ts', 'utf8');
    expect(code).toMatch(/logger\.info.*Starting/);
    expect(code).toMatch(/logger\.info.*durationMs/);
  });

  // 191: File Organization
  it('should move docs out of test directory', () => {
    expect(existsSync('docs/examples/event-emitter-type-safety.ts')).toBe(true);
    expect(existsSync('server/test/type-safety-verification.ts')).toBe(false);
  });
});
```

---

## Code Review Checklist (Copy-Paste)

```markdown
## TODO 182-191 Prevention Checks

### 182: Information Disclosure

- [ ] No version exposure in public endpoints
- [ ] No environment exposure in /metrics
- [ ] No system info (Node.js version, arch, PID)

### 183: Transaction Atomicity

- [ ] Resource generation inside transactions
- [ ] Sensitive data logged after commit only
- [ ] 60+ second timeout for bulk operations

### 184: Memory Leak - Events

- [ ] subscribe() returns unsubscribe function
- [ ] Handlers can be individually removed
- [ ] Tests verify handler removal

### 185: Type DRY

- [ ] No type unions manually duplicated from contracts
- [ ] Types derived with z.infer
- [ ] Contract changes auto-propagate

### 186: Exhaustiveness

- [ ] All switch statements have exhaustiveness checks
- [ ] Default case assigns to never type
- [ ] TypeScript errors on missing cases

### 187: Documentation

- [ ] All magic numbers documented
- [ ] Advisory lock IDs registered
- [ ] Registry has no duplicates

### 188: React Cleanup

- [ ] useRef with Promise/function has cleanup
- [ ] useEffect runs on unmount
- [ ] Pending promises resolved on unmount

### 189: Test Coverage

- [ ] Infrastructure code has unit tests
- [ ] Not just integration test coverage
- [ ] Error isolation tested

### 190: Observability

- [ ] Transaction start logged
- [ ] Transaction completion logged
- [ ] Duration tracked

### 191: File Organization

- [ ] Tests in test/ with describe/it
- [ ] Documentation in docs/
- [ ] Examples in docs/examples/
```

---

## Common Violations

### 182: Info Disclosure

```bash
# Check for version exposure
rg 'npm_package_version' server/src/routes
```

### 183: Transaction Atomicity

```bash
# Find secrets generated before transaction
rg 'crypto\.randomBytes' server/src/prisma/seeds -B 5 | grep -v '\$transaction'
```

### 184: Memory Leak

```bash
# Find subscribe without unsubscribe
rg '\.subscribe\(' server/src -A 3 | grep -v 'return\|unsub\|off('
```

### 185: Type DRY

```bash
# Find manually defined unions
rg "export type \w+ = '[A-Z_]+'.*\|" client/src
```

### 186: Exhaustiveness

```bash
# Find switch without default
rg 'switch.*status' client/src -A 20 | grep -v 'default:'
```

### 187: Documentation

```bash
# Find undocumented lock IDs
rg 'advisoryLock.*=.*\d+' server/src | grep -v '//'
```

### 188: React Cleanup

```bash
# Find useRef without cleanup
rg 'useRef<.*function|Promise' client/src | grep -v 'useEffect'
```

### 189: Test Coverage

```bash
# Find infrastructure without tests
ls server/src/lib/core/*.ts | while read f; do [ ! -f "server/test/lib/$(basename $f .ts).test.ts" ] && echo $f; done
```

### 190: Observability

```bash
# Find transactions without logging
rg '\$transaction' server/src/prisma/seeds -A 2 | grep -v logger
```

### 191: File Organization

```bash
# Find docs in test directory
find server/test -name "*.ts" -exec grep -l "Example\|Documentation" {} \;
```

---

## Implementation Timeline

**Day 1:** Code review training (30 min) + add to template
**Day 2:** Run grep checks, find violations
**Day 3:** Create ESLint rules (if time permits)
**Week 2:** Create test templates
**Week 3:** Documentation + examples

---

**Print this out and keep it on your desk!**

**Last Updated:** 2025-12-03
