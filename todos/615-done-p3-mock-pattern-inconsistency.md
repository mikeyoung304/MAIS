---
status: complete
priority: p3
issue_id: 615
tags: [code-review, testing, agent-eval]
dependencies: []
created: 2026-01-02
---

# Inconsistent Mock Patterns Between Test Files

## Problem Statement

Different test files use different mocking approaches for PrismaClient, leading to inconsistent type safety and maintenance overhead.

## Findings

**Source:** code-simplicity-reviewer

**Evidence:**

```typescript
// tracer.test.ts - GOOD: mockDeep pattern
let mockPrisma: DeepMockProxy<PrismaClient>;
mockPrisma = mockDeep<PrismaClient>();

// feedback.test.ts - INCONSISTENT: manual mock with `as any`
const mockPrisma = {
  conversationTrace: { findMany: vi.fn(), ... },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
} as any;
```

**Issues:**

- `as any` defeats type safety
- Manual mocks require maintenance when Prisma schema changes
- Inconsistent patterns make codebase harder to understand

## Proposed Solutions

### Option 1: Create shared mock helper (Recommended)

**Pros:** DRY, consistent, type-safe
**Cons:** Initial refactor effort
**Effort:** Medium
**Risk:** Very low

```typescript
// test/helpers/mock-prisma.ts
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '../../src/generated/prisma';

export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  const mock = mockDeep<PrismaClient>();
  // Configure $transaction to pass through
  mock.$transaction.mockImplementation((cb) => cb(mock));
  return mock;
}
```

### Option 2: Update feedback.test.ts to use mockDeep

**Pros:** Quick fix for one file
**Cons:** Doesn't prevent future inconsistency
**Effort:** Small
**Risk:** Very low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/test/agent-eval/feedback.test.ts`
- `server/test/helpers/` (create mock-prisma.ts)

## Acceptance Criteria

- [ ] All agent-eval tests use `mockDeep<PrismaClient>()`
- [ ] No `as any` casts for Prisma mocks
- [ ] Shared helper exists for common mock setup

## Work Log

| Date       | Action                           | Learnings                                    |
| ---------- | -------------------------------- | -------------------------------------------- |
| 2026-01-02 | Created during /workflows:review | Identified by code-simplicity-reviewer agent |

## Resources

- [vitest-mock-extended docs](https://github.com/eratio08/vitest-mock-extended)
