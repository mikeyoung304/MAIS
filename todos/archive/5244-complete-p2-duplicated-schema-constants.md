---
status: pending
priority: p2
issue_id: 5244
tags: [code-review, duplication, pr-44]
dependencies: []
---

# Duplicated Schema Constants Across Files

## Problem Statement

`SECTION_TYPES` and `PAGE_NAMES` constants are copy-pasted across multiple route files instead of exported from the shared module. When section types change (e.g., add "video" type), you must update 2+ files.

**Why this matters:** The comment "NOTE: Keep in sync with" in `discovery.routes.ts:39` reveals this is a known duplication risk. Any future section type addition requires remembering to update multiple locations.

**Impact:** P2 IMPORTANT - Maintenance burden and schema drift risk.

## Findings

### Code Simplicity Review

**Files:**

- `internal-agent-marketing.routes.ts:25-35` - `SECTION_TYPES` array (10 types)
- `internal-agent-storefront.routes.ts:35-45` - `SECTION_TYPES` array (identical)
- `internal-agent-discovery.routes.ts:39` - Comment: "NOTE: Keep in sync with"

**Duplicated constant:**

```typescript
const SECTION_TYPES = [
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
] as const;
```

### TypeScript Review

**Issue:** Redundant type assertion in storefront routes

```typescript
// internal-agent-storefront.routes.ts:149-157
const result = await sectionContentService.getPageStructure(tenantId, {
  pageName: pageName as
    | 'home'
    | 'about'
    | 'services'
    | 'faq'
    | 'contact'
    | 'gallery'
    | 'testimonials'
    | undefined,
});
```

The `pageName` is already validated by Zod schema as `z.enum(PAGE_NAMES).optional()`, making the type assertion redundant. This suggests `PAGE_NAMES` should also be extracted to shared module.

## Proposed Solutions

### Solution 1: Extract to Shared Module (RECOMMENDED)

**Pros:**

- Single source of truth
- Type safety across all consumers
- Eliminates "keep in sync" comments
  **Cons:** None
  **Effort:** Small (15 minutes)
  **Risk:** Very Low - constants are readonly

**Implementation:**

```typescript
// server/src/routes/internal-agent-shared.ts
export const SECTION_TYPES = [
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
] as const;

export const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'faq',
  'contact',
  'gallery',
  'testimonials',
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];
export type PageName = (typeof PAGE_NAMES)[number];

// Update consumers:
// internal-agent-marketing.routes.ts
import { SECTION_TYPES } from './internal-agent-shared';

// internal-agent-storefront.routes.ts
import { SECTION_TYPES, PAGE_NAMES } from './internal-agent-shared';

// internal-agent-discovery.routes.ts
import { SECTION_TYPES } from './internal-agent-shared';
```

### Solution 2: Keep Duplicated (Current State)

**Pros:**

- No changes needed
- Each file is self-contained
  **Cons:**
- Must update 2-3 files when adding section types
- "Keep in sync" comment is a code smell
- Type assertion redundancy in storefront routes
  **Effort:** Zero
  **Risk:** Medium - schema drift on future changes

## Recommended Action

**Use Solution 1** - Extract to shared module. The "NOTE: Keep in sync" comment is evidence that this duplication is already a known pain point.

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent-shared.ts` (add constants)
- `server/src/routes/internal-agent-discovery.routes.ts:39` (import, remove comment)
- `server/src/routes/internal-agent-marketing.routes.ts:25-35` (remove local const, import)
- `server/src/routes/internal-agent-storefront.routes.ts:35-45` (remove local const, import)
- `server/src/routes/internal-agent-storefront.routes.ts:149-157` (remove type assertion)

**Line count impact:** -30 lines (remove 3 duplicated arrays, add 1 canonical definition)

**Related Pattern:** DRY (Don't Repeat Yourself) principle

## Acceptance Criteria

- [ ] `SECTION_TYPES` exported from `internal-agent-shared.ts`
- [ ] `PAGE_NAMES` exported from `internal-agent-shared.ts`
- [ ] `SectionType` and `PageName` types exported
- [ ] All 3 consumer files import from shared module
- [ ] "Keep in sync" comment deleted from discovery routes
- [ ] Redundant type assertion removed from storefront routes
- [ ] `npm run --workspace=server typecheck` passes
- [ ] Zod schemas still validate correctly

## Work Log

**2026-02-09 - Initial Assessment (Code Review PR #44)**

- Code Simplicity Review identified 3 occurrences
- TypeScript Review identified redundant type assertion
- Confirmed "Keep in sync" comment reveals known pain point
- Verified constants are identical across files

## Resources

- **PR:** https://github.com/mikeyoung304/MAIS/pull/44
- **Related Files:**
  - `internal-agent-discovery.routes.ts:39` (sync comment)
  - `internal-agent-marketing.routes.ts:25-35` (duplication)
  - `internal-agent-storefront.routes.ts:35-45` (duplication)
- **DRY Principle:** https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
