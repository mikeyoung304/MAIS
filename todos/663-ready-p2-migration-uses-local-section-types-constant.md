---
status: ready
priority: p2
issue_id: '663'
tags:
  - code-review
  - dry
  - migration
  - storefront-section-ids
dependencies: []
---

# Migration Script Uses Local SECTION_TYPES Constant

## Problem Statement

The migration script duplicates the section types list instead of importing from `@macon/contracts`. If a new section type is added, the migration won't recognize it.

**Why it matters:** DRY violation. Schema drift between migration and contracts could cause sections to be skipped during backfill.

## Findings

**Location:** `server/scripts/migrate-section-ids.ts` lines 33-44

**Current:**

```typescript
const VALID_SECTION_TYPES: ReadonlySet<string> = new Set([
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
]);
```

**Should Be:**

```typescript
import { SECTION_TYPES } from '@macon/contracts';
const VALID_SECTION_TYPES = new Set(SECTION_TYPES);
```

## Proposed Solutions

### Option A: Import from Contracts (Recommended)

**Pros:** Single source of truth, automatic sync
**Cons:** None
**Effort:** Tiny (10 minutes)
**Risk:** Very low

### Option B: Keep Local (Not Recommended)

**Pros:** No dependency change
**Cons:** Drift risk, maintenance burden
**Effort:** None
**Risk:** High

## Recommended Action

**Option A: Import from Contracts** - Replace local `VALID_SECTION_TYPES` with import from `@macon/contracts`. Single source of truth prevents schema drift. Tiny effort, zero risk.

## Technical Details

**Affected Files:**

- `server/scripts/migrate-section-ids.ts`

## Acceptance Criteria

- [ ] `SECTION_TYPES` imported from `@macon/contracts`
- [ ] Local constant removed
- [ ] Script still works with `--dry-run`

## Work Log

| Date       | Action                   | Learnings                                                                      |
| ---------- | ------------------------ | ------------------------------------------------------------------------------ |
| 2026-01-08 | Created from code review | Identified by data-integrity-guardian agent                                    |
| 2026-01-08 | Approved for work        | Quality triage: DRY violation with schema drift risk. Import, don't duplicate. |

## Resources

- `packages/contracts/src/landing-page.ts` - Source of truth
