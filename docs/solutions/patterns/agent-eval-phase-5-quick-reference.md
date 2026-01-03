# Agent Eval Phase 5: Quick Reference (P2-612 to P3-616)

**Single-page summary of 5 infrastructure fixes** | Copy-paste patterns for future features

---

## 1. Zod Validation (P2-612)

Input validation with field constraints + type inference.

```typescript
// Define schema
export const ReviewSubmissionSchema = z.object({
  reviewedBy: z.string().min(1).max(100),
  notes: z.string().max(2000),
  correctEvalScore: z.number().min(0).max(10).optional(),
  actionTaken: z.enum(['none', 'approve', 'reject', 'escalate']),
});

export type ReviewSubmission = z.infer<typeof ReviewSubmissionSchema>;

// Use in function
async submitReview(review: ReviewSubmission) {
  const validated = ReviewSubmissionSchema.parse(review); // Parse + validate
  // Use validated.* fields with confidence
}
```

**When to use:** Input validation, API contracts, form submissions

---

## 2. Test Coverage (P2-613)

Systematic test structure: units (functions) → integration (classes) → behavior (scenarios).

```typescript
import { createMockPrisma } from '../helpers/mock-prisma';

describe('Component', () => {
  let mockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma(); // ✅ Single setup
  });

  describe('method name', () => {
    it('should [action] when [condition]', () => {
      // Arrange: Set up test data
      mockPrisma.model.findMany.mockResolvedValue([...]);

      // Act: Call method
      const result = await service.method();

      // Assert: Check behavior
      expect(result).toEqual(...);
    });
  });
});
```

**Coverage target:** 70%+ (focus on critical paths)

---

## 3. Lazy Config (P2-614)

Read environment at runtime, not import time.

```typescript
// ❌ Wrong: Evaluates at import
const CONFIG = {
  model: process.env.MODEL || 'default',
};

// ✅ Right: Evaluates at call time
function getConfig() {
  return {
    model: process.env.MODEL || 'default',
  };
}

// Use in factory
export function createService() {
  const config = getConfig(); // Read now, not at import
  return new Service(config);
}
```

**When to use:** Environment-dependent defaults, dynamic configuration

---

## 4. Mock Helper (P3-615)

Centralized Prisma mock factory with $transaction pre-configured.

```typescript
// File: test/helpers/mock-prisma.ts
export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  const mock = mockDeep<PrismaClient>();

  mock.$transaction.mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
      return callback(mock as unknown as Parameters<typeof callback>[0]);
    }
    return [];
  });

  return mock;
}

// Usage
const mockPrisma = createMockPrisma();
mockPrisma.conversationTrace.findMany.mockResolvedValue([...]);
```

**Benefits:** Consistent setup, $transaction works out-of-box, type-safe

---

## 5. Database Index (P3-616)

Index high-cardinality filter columns for O(log n) lookup instead of O(n) scan.

```typescript
// Prisma schema
model AgentProposal {
  id        String
  status    AgentProposalStatus
  updatedAt DateTime

  // Query: WHERE status IN (...) AND updatedAt < ?
  @@index([status, updatedAt]) // ✅ Index matches WHERE clause
}

// Migration
npm exec prisma migrate dev --name "add_agent_proposal_orphan_index"

// Query (auto-optimized with index)
const old = await prisma.agentProposal.findMany({
  where: {
    status: { in: ['FAILED', 'CONFIRMED'] },
    updatedAt: { lt: thirtyDaysAgo },
  },
});
```

**Index strategy:**

- Exact match columns first (status)
- Range columns second (updatedAt)
- High-cardinality columns (filter many rows)
- Skip low-cardinality (enum with 3 values)

---

## Common Patterns Table

| Issue            | Pattern                                       | File             |
| ---------------- | --------------------------------------------- | ---------------- |
| Input validation | `z.object({ field: z.string().max(N) })`      | review-queue.ts  |
| Testing          | `createMockPrisma()` in beforeEach            | pipeline.test.ts |
| Env config       | `function getConfig()` called at factory time | evaluator.ts     |
| Mocking          | `createMockPrisma()` from helpers             | All tests        |
| Performance      | `@@index([high_cardinality, range])`          | schema.prisma    |

---

## When to Apply Each Fix

| Scenario                       | Use                            |
| ------------------------------ | ------------------------------ |
| Adding user input endpoint     | P2-612 (Zod)                   |
| Writing service tests          | P2-613 (Tests) + P3-615 (Mock) |
| Reading ENV vars               | P2-614 (Lazy config)           |
| Slow query on filtered results | P3-616 (Index)                 |
| Running existing tests         | P3-615 (Mock)                  |

---

## Gotchas

**P2-612 (Zod):** Don't forget `z.infer<typeof Schema>` for type

**P2-613 (Tests):** Use `vi.fn().mockResolvedValue(...)` for async, `mockReturnValue(...)` for sync

**P2-614 (Config):** Wrap in function, not arrow function (easier to mock)

**P3-615 (Mock):** Pre-configure $transaction or tests with TX will hang

**P3-616 (Index):** Don't index every column — focus on WHERE filters with high cardinality

---

## References

- Full guide: `agent-eval-phase-5-session-closure-MAIS-20260102.md`
- Testing patterns: `phase-5-testing-and-caching-prevention.md`
- Critical patterns: `mais-critical-patterns.md`
