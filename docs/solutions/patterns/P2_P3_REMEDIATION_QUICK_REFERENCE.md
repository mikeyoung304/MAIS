# P2/P3 Remediation - Quick Reference

**Print and pin this!** Prevention checklist for the 5 P2/P3 issues.

---

## Issue 1: Missing Input Validation

**What to check:**

```typescript
// WRONG - No validation
export interface ReviewSubmission {
  reviewedBy: string; // Any length!
  notes: string; // Any length!
  score?: number; // Any value!
}

// RIGHT - Zod schema with constraints
export const ReviewSubmissionSchema = z.object({
  reviewedBy: z.string().min(1).max(100),
  notes: z.string().max(2000),
  score: z.number().min(0).max(10).optional(),
});
```

**Code review checklist:**

- [ ] POST/PUT endpoints have Zod schemas
- [ ] Strings: `.min()` and `.max()` specified
- [ ] Numbers: `.min()` and `.max()` specified
- [ ] Enums: Use `z.enum()`, not free strings
- [ ] Error messages: User-friendly
- [ ] Tests: Cover boundary cases

**When you see this pattern, flag it:**

```typescript
// DANGER SIGN
interface UnvalidatedInput {
  longTextField: string; // ← No max()
  priceInCents: number; // ← No min/max
  status: string; // ← Not an enum!
}
```

---

## Issue 2: Test Coverage Gaps

**What to check:**

```typescript
// BEFORE: No tests for this function
export async function cleanupPendingEvaluations(prisma: PrismaClient) {
  const pending = await countPending(prisma);
  if (pending > 50) {
    await drain(prisma); // ← What if this branch fails?
  }
}

// AFTER: All branches tested
describe('cleanupPendingEvaluations', () => {
  it('should trigger drain when pending > 50', async () => {
    mockPrisma.count.mockResolvedValue(51);
    await cleanup(mockPrisma);
    expect(drain).toHaveBeenCalled();
  });

  it('should NOT drain when pending <= 50', async () => {
    mockPrisma.count.mockResolvedValue(50);
    await cleanup(mockPrisma);
    expect(drain).not.toHaveBeenCalled();
  });
});
```

**Code review checklist:**

- [ ] Every exported function has ≥1 test
- [ ] All branches tested (if/else/try/catch)
- [ ] Async error paths tested
- [ ] Boundary conditions tested
- [ ] Coverage report included in PR

**When you see this pattern, flag it:**

```typescript
// DANGER SIGN
export async function importantFunction(prisma: PrismaClient) {
  // No test file exists!
  if (condition1) {
    /* never tested */
  }
  if (condition2) {
    /* never tested */
  }
  try {
    /* tested */
  } catch (e) {
    /* not tested */
  }
}
```

---

## Issue 3: Environment Variable Load-Time Issues

**What to check:**

```typescript
// WRONG - Reads env at module import time
const DEFAULT_CONFIG = {
  model: process.env.EVAL_MODEL || 'default', // ← Read at import!
};

// RIGHT - Reads env at function call time
function getDefaultConfig() {
  return {
    model: process.env.EVAL_MODEL || 'default', // ← Read at call time
  };
}
```

**Code review checklist:**

- [ ] No `process.env` reads at module scope
- [ ] Config in functions/constructors
- [ ] Tests use `vi.stubEnv()` for isolation
- [ ] Each test can set different env values
- [ ] No global config mutations

**When you see this pattern, flag it:**

```typescript
// DANGER SIGN
// At module scope:
const apiKey = process.env.API_KEY; // ← BAD!
const enabled = process.env.FEATURE_FLAG === 'true'; // ← BAD!

// This reads env ONCE when module loads.
// Tests can't override it without affecting other tests.
```

**Fix:**

```typescript
// In a function:
function getApiKey() {
  return process.env.API_KEY; // ← GOOD! Read at call time
}

function isFeatureEnabled() {
  return process.env.FEATURE_FLAG === 'true'; // ← GOOD!
}
```

---

## Issue 4: Inconsistent Mock Patterns

**What to check:**

```typescript
// WRONG - Manual mock with `as any`
const mockPrisma = {
  user: { findMany: vi.fn() },
} as any; // ← No type safety!

// RIGHT - Use shared helper
import { createMockPrisma } from '../helpers/mock-prisma';
const mockPrisma = createMockPrisma(); // ← Type-safe!
```

**Code review checklist:**

- [ ] All mocks use `createMockPrisma()` helper
- [ ] No `as any` for Prisma mocks
- [ ] `mockDeep<PrismaClient>()` consistently used
- [ ] `$transaction` callback configured
- [ ] Mocks reset between tests

**When you see this pattern, flag it:**

```typescript
// DANGER SIGN
const mockPrisma = {
  conversationTrace: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  user: { ... },
} as any;  // ← This defeats type safety!
           // ← IDE won't help with autocomplete
           // ← Changes to schema break silently

// BETTER
const mockPrisma = createMockPrisma();
// Now fully typed, IDE helps with autocomplete
mockPrisma.conversationTrace.findMany.mockResolvedValue([]);
```

---

## Issue 5: Missing Database Indexes

**What to check:**

```typescript
// WRONG - Query exists but no index documented
const orphaned = await prisma.agentProposal.findMany({
  where: {
    status: 'CONFIRMED',
    updatedAt: { lt: cutoff },
  },
});

// RIGHT - Index documented and exists in schema
// Uses index: [status, updatedAt]
const orphaned = await prisma.agentProposal.findMany({
  where: {
    status: 'CONFIRMED',
    updatedAt: { lt: cutoff },
  },
});

// In schema.prisma:
// @@index([status, updatedAt])
```

**Code review checklist:**

- [ ] Complex queries have `// Uses index: [...]` comments
- [ ] Composite indexes listed in schema in correct order
- [ ] Tenant-scoped queries use `@@index([tenantId, ...])`
- [ ] EXPLAIN ANALYZE run for new queries
- [ ] Index names descriptive

**When you see this pattern, flag it:**

```typescript
// DANGER SIGN
const results = await prisma.table.findMany({
  where: {
    field1: value1,
    field2: value2,
    field3: value3,
  },
});
// No comment about indexes!
// No EXPLAIN ANALYZE result!
// Index may not exist or may not cover this query!

// In schema.prisma:
// No comment explaining which queries use which indexes
// @@index([field2, field3])  // ← No comment!
```

---

## Prevention Checklist (Before PR)

```
VALIDATION
[ ] All POST/PUT have Zod schemas
[ ] String fields have .min().max()
[ ] Number fields have .min().max()
[ ] Tests cover boundary cases

TEST COVERAGE
[ ] npm run test:coverage > 80%
[ ] All exported functions tested
[ ] All branches covered
[ ] Async errors tested

ENV VARIABLES
[ ] No process.env at module scope
[ ] Config in functions/constructors
[ ] Tests use vi.stubEnv()

MOCKING
[ ] Use createMockPrisma() helper
[ ] No as any casts
[ ] Mocks reset between tests

DATABASE INDEXES
[ ] Complex queries have // Uses index:
[ ] Indexes exist in schema.prisma
[ ] EXPLAIN ANALYZE run for new queries
```

---

## Common Mistakes to Avoid

| Mistake                                               | Fix                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `const CONFIG = { model: process.env.EVAL_MODEL }`    | Move to function: `function getConfig() { ... }`              |
| `const mockPrisma = { ... } as any`                   | Use `createMockPrisma()` helper                               |
| `export interface X { name: string }` (no validation) | Add `const XSchema = z.object({ name: z.string().max(100) })` |
| Query with no index comment                           | Add `// Uses index: [status, date]` above query               |
| Test with no cleanup                                  | Add `afterEach(() => vi.clearAllMocks())`                     |
| Database field with no length constraint              | Add constraints to both Zod schema AND Prisma model           |

---

## Quick Links

Full detailed strategies:

- [P2/P3 Remediation Prevention Strategies](./P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md) (5000+ words with code examples)
- [MAIS Critical Patterns](./MAIS_CRITICAL_PATTERNS.md)
- [Prevention Strategies Index](./PREVENTION_STRATEGIES_INDEX.md)

Testing:

- [Vitest Patterns](https://vitest.dev)
- [vitest-mock-extended](https://github.com/eratio08/vitest-mock-extended)

Database:

- [Prisma Indexes](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)

Validation:

- [Zod Documentation](https://zod.dev)
