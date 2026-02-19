# 11005 — Extract Grazing Constant + Use BlockType Enum in Seed

**Status:** pending
**Priority:** P2
**Created:** 2026-02-17
**Source:** code-review (kieran-typescript-reviewer P2-1, P2-3)

## Problem

Two related type safety / consistency issues in `server/prisma/seeds/little-bit-horse-farm.ts`:

### 1. Grazing rate is an inline magic number (line 332)

```typescript
perPersonCents: 2500, // $25/person
```

The dinner rate has `DINNER_PER_PERSON_CENTS = 7500` and Airbnb has `AIRBNB_COST_CENTS = 20000`, but the grazing rate has no named constant. If it changes, you must search for `2500` in the file.

### 2. Section content uses string literals for blockType

```typescript
blockType: 'HERO',
blockType: 'FEATURES',
```

The `handled.ts` seed imports `BlockType` from Prisma client for compile-time safety. A typo like `'FEATURSE'` would only fail at runtime.

## Proposed Solution

```typescript
// Add constant
const GRAZING_PER_PERSON_CENTS = 2500; // $25/person

// Import enum
import type { PrismaClient, Segment, Tier, BlockType } from '../../src/generated/prisma/client';

// Use in section creation
blockType: 'HERO' satisfies BlockType,
```

**Effort:** Small (10 min)

## Acceptance Criteria

- [ ] `GRAZING_PER_PERSON_CENTS` constant extracted and used
- [ ] All `blockType` values use `satisfies BlockType` or equivalent type check
- [ ] No `any` casts introduced
- [ ] Tests pass

## Work Log

- 2026-02-17: Created from code review. Bundled two small fixes into one todo.
