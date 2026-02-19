# 11008 — Seed Helper Duplication + PrismaOrTransaction Type Drift

**Status:** pending
**Priority:** P3
**Created:** 2026-02-17
**Source:** code-review (kieran-typescript-reviewer P3-1/P3-3, data-integrity-guardian P3-2)

## Problem

### 1. Duplicated helper functions across seed files

`createOrUpdateSegment` and `createOrUpdateTierWithSegment` are defined independently in:

- `little-bit-horse-farm.ts` (most complete — supports displayPriceCents, maxGuests, scalingRules, features)
- `plate.ts` (missing some fields)
- `la-petit-mariage.ts` (older version)

The shared `utils.ts` has a `createOrUpdateTier` but it uses the old `{ name: string; included: boolean }` features schema and `JSON.stringify()` encoding. Newer seeds correctly bypass it.

### 2. PrismaOrTransaction type drift

Defined in 4 files with minor differences:

- `utils.ts` — omits `$transaction | $connect | $disconnect | $on | $use`
- `little-bit-horse-farm.ts`, `plate.ts`, `la-petit-mariage.ts` — additionally omit `$extends` (Prisma 7)

The `utils.ts` version is stale (missing `$extends`).

## Proposed Solution

1. Promote `little-bit-horse-farm.ts` helpers to `utils.ts` as the canonical versions
2. Export `PrismaOrTransaction` from `utils.ts` (with `$extends`)
3. Import in all seed files instead of defining locally
4. Deprecate old `createOrUpdateTier` in utils

**Effort:** Medium (touches 4 files, needs test verification)

## Acceptance Criteria

- [ ] Single `PrismaOrTransaction` definition in `utils.ts`
- [ ] `createOrUpdateSegment` and `createOrUpdateTierWithSegment` in `utils.ts`
- [ ] All 3 tenant seeds import from utils
- [ ] All seed tests pass

## Work Log

- 2026-02-17: Created from code review. Known tech debt, not blocking.
