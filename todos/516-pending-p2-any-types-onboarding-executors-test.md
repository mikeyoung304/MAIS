---
status: pending
priority: p2
issue_id: '516'
tags:
  - code-review
  - typescript
  - tests
  - phase-5
dependencies: []
---

# Replace `any` Types in Onboarding Executors Test

## Problem Statement

The test file `server/test/agent/executors/onboarding-executors.test.ts` uses `any` types for mock objects, which violates TypeScript strictness standards established in the MAIS codebase.

**Why it matters:** Using `any` bypasses TypeScript's type checking, allowing type errors to slip through. This reduces test reliability and could mask API changes in the tested code.

## Findings

**Source:** Code Quality Review Agent

**Location:** `/Users/mikeyoung/CODING/MAIS/server/test/agent/executors/onboarding-executors.test.ts`

**Lines with `any`:**

- Line 30: `let mockPrisma: any;`
- Line 40-41: Mock transaction typing
- Line 106: Executor function signatures
- Line 478: Additional mock usage

**Evidence:** The test file declares mock objects without proper types:

```typescript
let mockPrisma: any;
let mockTx: any;
```

## Proposed Solutions

### Solution 1: Create Proper Mock Types (Recommended)

**Description:** Define explicit mock types for Prisma client and transaction

```typescript
type MockTransaction = {
  segment: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  package: { create: ReturnType<typeof vi.fn> };
  tenant: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

type MockPrismaClient = MockTransaction & {
  $transaction: ReturnType<typeof vi.fn>;
};

let mockPrisma: MockPrismaClient;
let mockTx: MockTransaction;
```

**Pros:**

- Full type safety
- IDE autocomplete for mock methods
- Catches API changes in tested code

**Cons:**

- More verbose setup
- Need to maintain mock types when Prisma schema changes

**Effort:** Small (1 hour)
**Risk:** Low

### Solution 2: Use `Partial<PrismaClient>` with Type Assertion

**Description:** Use Prisma's generated types with partials

```typescript
import type { PrismaClient } from '../../generated/prisma';

let mockPrisma: Partial<PrismaClient>;
```

**Pros:**

- Uses generated types
- Less maintenance

**Cons:**

- Partial allows any subset, still somewhat loose

**Effort:** Small (30 min)
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `server/test/agent/executors/onboarding-executors.test.ts`

**Components:** Test infrastructure

## Acceptance Criteria

- [ ] No `any` types in `onboarding-executors.test.ts`
- [ ] All mock objects have explicit types
- [ ] Tests still pass after type changes
- [ ] `npm run typecheck` passes

## Work Log

| Date       | Action                           | Learnings                        |
| ---------- | -------------------------------- | -------------------------------- |
| 2025-12-31 | Created from Phase 5 code review | Found during code quality review |

## Resources

- [Phase 5 Code Review](internal)
- [TypeScript strict mode docs](https://www.typescriptlang.org/tsconfig#strict)
