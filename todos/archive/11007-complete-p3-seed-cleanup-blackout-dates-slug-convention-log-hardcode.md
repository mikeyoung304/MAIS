# 11007 — Seed Cleanup: Blackout Dates, Slug Convention, Log Hardcode

**Status:** pending
**Priority:** P3
**Created:** 2026-02-17
**Source:** code-review (data-integrity-guardian P2-1/P3-3, kieran-typescript-reviewer P3-2/P3-4)

## Problem

Three minor cleanup items in `server/prisma/seeds/little-bit-horse-farm.ts`:

### 1. Blackout dates hardcoded to 2026 (lines 804-811)

Mock data — tenant will manage her own blackout dates via dashboard. The hardcoded 2026 dates will go stale but are harmless. Consider either:

- Making them dynamic (`new Date().getFullYear()`)
- Removing them entirely (tenant self-manages)
- Adding a comment that these are placeholder data

### 2. Segment slug naming inconsistency

Segments use underscores (`corporate_retreats`, `weekend_getaway`), tiers use hyphens (`simple-ceremony`, `focused-day`). This is consistent within entity type but differs from `plate.ts` which uses hyphens for segments too. Cosmetic — URLs prefer hyphens for SEO.

### 3. Hardcoded `${6}` in summary log (line 857)

```typescript
logger.info(`Blackout dates: ${6}`);
```

Template literal wrapping a literal is unnecessary. Should reference `holidays.length` or just use a string literal.

## Proposed Solution

Bundle all three into one small commit:

1. Add comment to blackout dates: `// Placeholder — tenant manages via dashboard`
2. Leave slug convention as-is (changing slugs would break existing URLs if any exist)
3. Fix log to use `holidays.length`

**Effort:** Small (5 min)

## Acceptance Criteria

- [ ] Blackout dates have clarifying comment
- [ ] Log uses `holidays.length` instead of hardcoded `6`
- [ ] Tests pass

## Work Log

- 2026-02-17: Created from code review. Triage: blackout dates are mock data, tenant self-manages.
