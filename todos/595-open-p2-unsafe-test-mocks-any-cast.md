---
status: open
priority: p2
issue_id: '595'
tags: [code-review, code-quality, typescript, testing]
dependencies: []
created_at: 2026-01-02
---

# P2: Unsafe Type Casting in Test Mocks

> **Code Quality Review:** Using `as any` to mock Prisma client loses type safety and could allow tests to pass with incorrect mock structures.

## Problem Statement

Test files use `as any` to mock Prisma client, bypassing TypeScript's type checking.

**File:** `/server/test/agent-eval/feedback.test.ts` (lines 335-348)

**Evidence:**

```typescript
const mockPrisma = {
  conversationTrace: {
    findMany: vi.fn(),
    // ... more mocks
  },
} as any; // <-- Unsafe cast
```

**Impact:** Tests could pass even if mock structure doesn't match actual Prisma client interface.

## Findings

| Reviewer            | Finding                               |
| ------------------- | ------------------------------------- |
| Code Quality Review | P1: Unsafe type casting in test mocks |

## Proposed Solution

Use Vitest's type-safe mock utilities:

```typescript
import type { PrismaClient } from '../../../src/generated/prisma';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

const mockPrisma = mockDeep<PrismaClient>();

// Configure mock
mockPrisma.conversationTrace.findMany.mockResolvedValue([...]);
```

Or create a properly typed mock helper:

```typescript
// test/helpers/mock-prisma.ts
import type { PrismaClient } from '../../src/generated/prisma';
import { vi } from 'vitest';

export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  return mockDeep<PrismaClient>();
}
```

## Acceptance Criteria

- [ ] Replace `as any` with type-safe mocks
- [ ] Install vitest-mock-extended if needed
- [ ] All tests still pass
- [ ] TypeScript catches mock structure errors

## Work Log

| Date       | Action                         | Learnings                                    |
| ---------- | ------------------------------ | -------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Code Quality reviewer identified unsafe cast |
