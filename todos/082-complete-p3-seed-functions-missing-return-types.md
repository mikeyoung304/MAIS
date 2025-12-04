---
status: complete
priority: p3
issue_id: '082'
tags: [quality, code-review, typescript, testability]
dependencies: []
---

# P3: Seed Functions Return void Instead of Created Data

## Problem Statement

All seed functions return `Promise<void>` instead of the entities they create. This makes them untestable and non-composable.

**Why it matters:**

- Cannot verify what was created without additional queries
- Cannot chain seeds or use returned data
- Harder to write tests for seed logic

## Findings

**Current signatures:**

```typescript
export async function seedPlatform(prisma: PrismaClient): Promise<void>;
export async function seedE2E(prisma: PrismaClient): Promise<void>;
export async function seedDemo(prisma: PrismaClient): Promise<void>;
```

**Recommended:**

```typescript
export interface PlatformSeedResult {
  admin: { id: string; email: string; role: string };
}

export async function seedPlatform(prisma: PrismaClient): Promise<PlatformSeedResult>;
```

## Proposed Solutions

### Solution A: Add return types to all seed functions

**Pros:** Testable, composable, type-safe
**Cons:** Minor effort
**Effort:** Medium (1 hour)
**Risk:** None

## Recommended Action

<!-- To be filled during triage -->

## Acceptance Criteria

- [ ] All seed functions return created entity data
- [ ] Return types documented with interfaces
- [ ] Tests can verify seed output without extra queries

## Work Log

| Date       | Action                   | Learnings                       |
| ---------- | ------------------------ | ------------------------------- |
| 2025-11-29 | Created from code review | void returns reduce testability |

## Resources

- **Code Review:** Seed system refactoring review
