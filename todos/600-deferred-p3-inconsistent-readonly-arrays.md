---
status: deferred
priority: p3
issue_id: '600'
tags: [code-review, typescript, immutability, consistency]
dependencies: []
created_at: 2026-01-02
---

# P3: Inconsistent Use of Readonly for Constant Arrays

> **TypeScript Review:** Some constant arrays use readonly while others don't, creating inconsistency.

## Problem Statement

Constant arrays are inconsistently defined with/without `readonly`.

**Good (uses readonly):**

```typescript
// tracing/types.ts
export const AGENT_TYPES: readonly AgentType[] = ['customer', 'onboarding', 'admin'] as const;
```

**Inconsistent (mutable array):**

```typescript
// evals/rubrics/index.ts
export const EVAL_DIMENSIONS: EvalDimension[] = [EFFECTIVENESS, EXPERIENCE, SAFETY];
```

**Impact:** Without `readonly`, these "constants" can be accidentally mutated at runtime.

## Findings

| Reviewer          | Finding                                              |
| ----------------- | ---------------------------------------------------- |
| TypeScript Review | P3: Inconsistent use of readonly for constant arrays |

## Proposed Solution

Use `readonly` consistently for all constant arrays:

```typescript
// evals/rubrics/index.ts
export const EVAL_DIMENSIONS: readonly EvalDimension[] = [
  EFFECTIVENESS,
  EXPERIENCE,
  SAFETY,
] as const;

// feedback/implicit.ts
const POSITIVE_WORDS: readonly string[] = [
  'thanks',
  'thank you',
  'great',
  'perfect',
  'awesome',
] as const;
```

## Acceptance Criteria

- [ ] All constant arrays use `readonly` modifier
- [ ] Add `as const` for compile-time immutability
- [ ] Typecheck passes
- [ ] Document pattern in coding standards

## Work Log

| Date       | Action                         | Learnings                                    |
| ---------- | ------------------------------ | -------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | TypeScript reviewer identified inconsistency |
