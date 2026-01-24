---
status: ready
priority: p2
issue_id: '5181'
tags: [code-review, testing, typescript, quality]
dependencies: []
---

# Storefront Tools Tests - Type Safety Improvements

## Problem Statement

The storefront-tools.test.ts file has extensive use of `any` types and `as any` casts that bypass TypeScript's type checking. This reduces the tests' ability to catch type-related bugs and makes maintenance harder.

**Why it matters:** Test files should exemplify good typing practices. Bypassing types in tests means type errors in the actual implementation might not be caught during test development.

## Findings

### 1. `mockPrisma: any` (Line 146)

```typescript
let mockPrisma: any;
```

The Prisma mock should be properly typed to match expected interface.

### 2. `(result as any).data` pattern (~40 occurrences)

Throughout the file, results are cast to `any` to access `.data`:

```typescript
const data = (result as any).data;
```

### 3. `(result as any).error` pattern (~15 occurrences)

Error results similarly bypass typing:

```typescript
expect((result as any).error).toContain('not found');
```

### 4. Context mock type casting

```typescript
mockContext.draftConfig = {
  pages: mockConfig.pages as any,
  // ...
};
```

## Proposed Solutions

### Option 1: Type Guards and Assertion Helpers (Recommended)

**Create assertion helpers for result types:**

```typescript
import type { AgentToolResult, ReadToolResult, ToolError } from '../../../src/agent/tools/types';

function assertReadToolResult<T>(result: AgentToolResult): asserts result is ReadToolResult<T> {
  expect(result.success).toBe(true);
  expect('data' in result).toBe(true);
}

function assertToolError(result: AgentToolResult): asserts result is ToolError {
  expect(result.success).toBe(false);
  expect('error' in result).toBe(true);
}

// Usage:
const result = await listSectionIdsTool.execute(mockContext, {});
assertReadToolResult<{ sections: SectionSummary[] }>(result);
expect(result.data.sections).toBeDefined(); // Now properly typed!
```

**Pros:** Preserves type safety, self-documenting, reusable
**Cons:** Requires upfront work
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option 2: Generic Result Type Factory

```typescript
type TestResult<T> = { success: true; data: T } | { success: false; error: string };

function expectSuccess<T>(result: unknown): T {
  const r = result as TestResult<T>;
  expect(r.success).toBe(true);
  if (!r.success) throw new Error('Expected success');
  return r.data;
}
```

**Pros:** Simple, one function handles all cases
**Cons:** Less explicit about expected types
**Effort:** Small (1 hour)
**Risk:** Low

### Option 3: Typed Mock Factory

```typescript
type MockPrisma = {
  tenant: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

let mockPrisma: MockPrisma;
```

**Pros:** Full type safety for mocks
**Cons:** Requires maintaining mock types
**Effort:** Medium (2 hours)
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/test/agent/tools/storefront-tools.test.ts`

**Components:**

- Test file type safety
- Mock typing

## Acceptance Criteria

- [ ] `mockPrisma` has proper TypeScript type
- [ ] Result assertions use type guards instead of `as any`
- [ ] No `as any` casts in test assertions
- [ ] All tests still pass after refactoring

## Work Log

| Date       | Action                   | Learnings                                |
| ---------- | ------------------------ | ---------------------------------------- |
| 2026-01-15 | Created from code review | Identified ~55 `any` usages in test file |

## Resources

- Test file: `server/test/agent/tools/storefront-tools.test.ts`
- Types: `server/src/agent/tools/types.ts`
- Similar pattern: `server/test/agent/tools/write-tools.test.ts`
