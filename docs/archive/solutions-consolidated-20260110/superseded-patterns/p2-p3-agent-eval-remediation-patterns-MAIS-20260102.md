---
title: P2/P3 Agent-Eval Remediation Patterns
slug: p2-p3-agent-eval-remediation-patterns
category: patterns
component: server/agent-eval
severity: P2
tags:
  - agent-eval
  - input-validation
  - test-coverage
  - lazy-evaluation
  - database-indexing
  - mock-patterns
  - zod
  - prisma
date_created: 2026-01-02
commit: 0ce7eac1
---

# P2/P3 Agent-Eval Remediation Patterns

Five production-ready patterns from the agent-eval code review remediation session.

## Quick Reference

| Issue   | Pattern              | One-Liner                                               |
| ------- | -------------------- | ------------------------------------------------------- |
| **612** | Zod input validation | `ReviewSubmissionSchema.parse(input)` before processing |
| **613** | Test coverage        | 68 tests for pipeline + PII redactor                    |
| **614** | Lazy config          | `getDefaultConfig()` function, not const                |
| **615** | Mock helper          | `createMockPrisma()` with $transaction pre-configured   |
| **616** | Database index       | `@@index([status, updatedAt])` for orphan recovery      |

---

## Pattern 1: Zod Input Validation (P2-612)

### Problem

`ReviewSubmission` interface had no field length/range validation, allowing:

- Extremely long `reviewedBy` strings
- Megabytes of text in `notes`
- `correctEvalScore` values outside 0-10

### Solution

```typescript
// server/src/agent/feedback/review-queue.ts
import { z } from 'zod';

export const ReviewSubmissionSchema = z.object({
  reviewedBy: z
    .string()
    .min(1, 'Reviewer identifier is required')
    .max(100, 'Reviewer identifier must be 100 characters or less'),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less'),
  correctEvalScore: z
    .number()
    .min(0, 'Score must be at least 0')
    .max(10, 'Score must be at most 10')
    .optional(),
  actionTaken: z.enum([
    'none', 'approve', 'reject', 'escalate',
    'prompt_updated', 'bug_filed', 'retrain',
  ]),
});

export type ReviewSubmission = z.infer<typeof ReviewSubmissionSchema>;

// In method:
async submitReview(tenantId: string, traceId: string, review: ReviewSubmission) {
  const validated = ReviewSubmissionSchema.parse(review); // Validates before processing
  // ... use validated instead of review
}
```

### Prevention Checklist

- [ ] All API inputs have Zod schemas
- [ ] String fields have max lengths
- [ ] Numeric fields have min/max ranges
- [ ] Validation happens before business logic

---

## Pattern 2: Comprehensive Test Coverage (P2-613)

### Problem

Missing tests for `cleanupPendingEvaluations()`, `drainCompleted()`, `shouldEvaluate()` paths, `redactMessagesForPreview()`, `redactToolCalls()`.

### Solution

Created `server/test/agent-eval/pipeline.test.ts` with 68 tests:

```typescript
// PII Redactor tests
describe('redactPII', () => {
  it('should redact email addresses', () => {
    expect(redactPII('Contact john@example.com')).toBe('Contact [EMAIL]');
  });

  it('should redact phone numbers', () => {
    expect(redactPII('Call 555-123-4567')).toBe('Call [PHONE]');
  });
});

describe('redactMessagesForPreview', () => {
  it('should redact and truncate to maxLength', () => {
    const messages = [{ role: 'user', content: 'test@example.com ' + 'a'.repeat(600) }];
    const result = redactMessagesForPreview(messages);
    expect(result[0].content).toContain('[EMAIL]');
    expect(result[0].content.length).toBe(500); // Default maxLength
  });
});

// Pipeline tests
describe('EvalPipeline', () => {
  describe('shouldEvaluate logic', () => {
    it('should always evaluate flagged traces', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        flagged: true,
        taskCompleted: true,
        evalScore: null,
      });
      const pipeline = new EvalPipeline(mockPrisma, mockEvaluator, {
        samplingRate: 0,
        evaluateFlagged: true,
        asyncProcessing: false,
      });
      await pipeline.submit('tenant-1', 'trace-1');
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });

    it('should always evaluate failed tasks', async () => {
      mockPrisma.conversationTrace.findFirst.mockResolvedValue({
        flagged: false,
        taskCompleted: false,
        evalScore: null,
      });
      const pipeline = new EvalPipeline(mockPrisma, mockEvaluator, {
        samplingRate: 0,
        evaluateFailedTasks: true,
        asyncProcessing: false,
      });
      await pipeline.submit('tenant-1', 'trace-1');
      expect(mockEvaluator.evaluate).toHaveBeenCalled();
    });
  });
});
```

### Prevention Checklist

- [ ] Every public function has direct tests
- [ ] All conditional branches tested (flagged, failed, sampled)
- [ ] Edge cases covered (empty arrays, null values, max lengths)
- [ ] Run `npx vitest --coverage` to verify >80%

---

## Pattern 3: Lazy Environment Variable Loading (P2-614)

### Problem

`DEFAULT_CONFIG` read `process.env.EVAL_MODEL` at module import time, before dotenv loads.

### Solution

```typescript
// BEFORE: ❌ Evaluated at import time
const DEFAULT_CONFIG: EvaluatorConfig = {
  model: process.env.EVAL_MODEL || DEFAULT_EVAL_MODEL,
  maxTokens: 2048,
  temperature: 0.1,
  timeoutMs: 30000,
};

// AFTER: ✅ Evaluated at call time
function getDefaultConfig(): EvaluatorConfig {
  return {
    model: process.env.EVAL_MODEL || DEFAULT_EVAL_MODEL, // Read when called
    maxTokens: 2048,
    temperature: 0.1,
    timeoutMs: 30000,
  };
}

// In constructor:
this.config = { ...getDefaultConfig(), ...config };
```

### Prevention Checklist

- [ ] No `process.env` reads in module-level constants
- [ ] Use getter functions for config objects
- [ ] Tests can override env vars without import order issues

---

## Pattern 4: Shared Mock Helper (P3-615)

### Problem

Inconsistent mocking: some tests used `mockDeep<PrismaClient>()`, others used `as any` manual mocks.

### Solution

```typescript
// server/test/helpers/mock-prisma.ts
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '../../src/generated/prisma';

export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  const mock = mockDeep<PrismaClient>();

  // Pre-configure $transaction to execute callback with mock
  mock.$transaction.mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
      return callback(mock as unknown as Parameters<typeof callback>[0]);
    }
    return [];
  });

  return mock;
}
```

**Usage:**

```typescript
import { createMockPrisma } from '../helpers/mock-prisma';

describe('ReviewQueue', () => {
  let mockPrisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    queue = createReviewQueue(mockPrisma);
  });

  it('should update trace', async () => {
    mockPrisma.conversationTrace.updateMany.mockResolvedValue({ count: 1 });
    await queue.submitReview('tenant-1', 'trace-1', { ... });
    expect(mockPrisma.conversationTrace.updateMany).toHaveBeenCalled();
  });
});
```

### Prevention Checklist

- [ ] All agent-eval tests use `createMockPrisma()`
- [ ] No `as any` casts for Prisma mocks
- [ ] $transaction works out-of-box (pre-configured)

---

## Pattern 5: Composite Database Index (P3-616)

### Problem

Orphan recovery query used `status + updatedAt` but index was `[status, expiresAt]`.

### Solution

```prisma
// server/prisma/schema.prisma
model AgentProposal {
  // ... fields ...

  @@index([status, expiresAt])   // Existing: cleanup job
  @@index([status, updatedAt])   // NEW: orphan recovery query
}
```

**Query that benefits:**

```typescript
// server/src/jobs/cleanup.ts
const orphaned = await prisma.agentProposal.findMany({
  where: {
    status: 'CONFIRMED',
    updatedAt: { lt: orphanCutoff }, // Now uses index
  },
  take: 100,
});
```

### Prevention Checklist

- [ ] Every multi-column WHERE has matching composite index
- [ ] Run `EXPLAIN ANALYZE` on production queries
- [ ] Add comment linking index to query location

---

## Related Documentation

- [P2 Agent-Eval Prevention Strategies](./P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md)
- [Phase 5 Testing and Caching Prevention](./phase-5-testing-and-caching-prevention-MAIS-20251231.md)
- [MAIS Critical Patterns](./mais-critical-patterns.md)

---

## Files Changed

| File                                        | Change                             |
| ------------------------------------------- | ---------------------------------- |
| `server/src/agent/feedback/review-queue.ts` | Added ReviewSubmissionSchema       |
| `server/src/agent/evals/evaluator.ts`       | getDefaultConfig() lazy loading    |
| `server/prisma/schema.prisma`               | Added @@index([status, updatedAt]) |
| `server/test/agent-eval/pipeline.test.ts`   | NEW: 68 tests                      |
| `server/test/helpers/mock-prisma.ts`        | NEW: createMockPrisma()            |
| `server/test/agent-eval/feedback.test.ts`   | Updated to use shared helper       |

**Commit:** `0ce7eac1` - fix(agent-eval): P2/P3 remediation - validation, tests, lazy config, mock helper, index

---

_Generated: 2026-01-02 | Session: P2/P3 Agent-Eval Remediation_
