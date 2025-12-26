---
status: complete
priority: p1
issue_id: "407"
tags:
  - code-review
  - data-integrity
  - migration
  - locked-template-system
dependencies: []
---

# Migration Script Data Integrity Issues

## Problem Statement

The `migrate-to-page-config.ts` script has multiple data integrity issues that could cause data loss or runtime validation failures during migration.

**Why This Matters:**
- Migration script is the path for existing tenants to new system
- Data loss or validation failures will break tenant storefronts
- Issues may not be caught until production migration

## Findings

### Finding 1: Home Page Sections Overwritten

**Location:** `server/scripts/migrate-to-page-config.ts` (line 121)

**Evidence:**
```typescript
pages.home.sections = [heroSection];
```

This completely replaces home sections instead of merging with defaults. If `DEFAULT_PAGES_CONFIG` adds more home sections, migrated tenants miss them.

### Finding 2: Empty Content Validation Gap

**Location:** `server/scripts/migrate-to-page-config.ts` (line 140)

**Evidence:**
```typescript
content: legacy.about.content || '',  // Empty string fallback
```

But `TextSectionSchema` requires `content: z.string().min(1)`. Migration creates invalid config that fails Zod validation at runtime.

### Finding 3: Rating Type Inconsistency

**Location:** `packages/contracts/src/landing-page.ts`

**Evidence:**
- Legacy schema (line 148): `z.number().int().min(1).max(5)` - integers only
- New schema (line 280): `z.number().min(1).max(5).default(5)` - allows floats

Migrated data could have `3.5` ratings which is inconsistent.

**Agent:** Data Integrity Guardian

## Proposed Solutions

### Solution 1: Fix All Three Issues (Recommended)

1. **Home sections**: Spread existing default sections before adding hero
2. **Empty content**: Provide meaningful fallback or skip migration for empty about
3. **Rating**: Add `.int()` constraint to new schema

```typescript
// Fix 1: Preserve default home sections
pages.home.sections = [...DEFAULT_PAGES_CONFIG.home.sections, heroSection];

// Fix 2: Skip about if empty content
if (legacy?.about?.content && legacy.about.content.trim()) {
  // Create text section
}

// Fix 3: In landing-page.ts
rating: z.number().int().min(1).max(5).default(5),
```

**Pros:**
- Prevents data loss
- Ensures valid configs
- Consistent data model

**Cons:**
- Slightly more complex migration logic

**Effort:** Small
**Risk:** Low

### Solution 2: Add Validation Before Storage

Run migrated config through `LandingPageConfigSchema.safeParse()` before storing.

**Pros:**
- Catches any validation issues
- Fail-fast approach

**Cons:**
- Doesn't fix root causes

**Effort:** Small
**Risk:** Low

## Recommended Action

**APPROVED**: Solution 1 - Fix all three issues (home sections merge, empty content handling, rating int constraint).

## Technical Details

**Affected Files:**
- `server/scripts/migrate-to-page-config.ts`
- `packages/contracts/src/landing-page.ts` (rating schema)

**Database Changes:** None (prevents bad data)

## Acceptance Criteria

- [ ] Home sections merge with defaults instead of replacing
- [ ] Empty about content handled gracefully (skip or use default)
- [ ] Rating schema includes `.int()` constraint
- [ ] Migration script validates output with Zod before storing
- [ ] Test cases added for edge cases: empty content, missing images, float ratings
- [ ] TypeScript passes (`npm run typecheck`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from code review | Multiple data integrity issues found in migration path |

## Resources

- Migration script: `server/scripts/migrate-to-page-config.ts`
- Schema: `packages/contracts/src/landing-page.ts`
