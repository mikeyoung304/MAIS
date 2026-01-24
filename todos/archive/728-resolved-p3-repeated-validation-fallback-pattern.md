---
status: complete
priority: p3
issue_id: '728'
tags:
  - code-review
  - dry
  - maintainability
dependencies:
  - '724'
resolved_date: '2026-01-10'
---

# P3: Repeated Validation/Fallback Pattern in Landing Page Code - RESOLVED

## Problem Statement

The pattern of "validate with Zod, fall back to defaults on failure" appears 6+ times across landing page service and agent utilities. This repetition increases maintenance burden and risk of inconsistent behavior.

## Findings

**Locations:**

- `landing-page.service.ts`: lines 306-321, 325-341, 370-392, 395-417
- `utils.ts`: lines 166-182, 185-201, 272-294, 297-319

**Repeated Pattern:**

```typescript
const result = LandingPageConfigSchema.safeParse(config);
if (!result.success) {
  logger.warn({ tenantId, errors: result.error.issues }, 'Invalid config');
  return {
    pages: structuredClone(DEFAULT_PAGES_CONFIG),
    hasDraft: false,
  };
}
return {
  pages: result.data.pages || structuredClone(DEFAULT_PAGES_CONFIG),
  hasDraft: true,
};
```

**Impact:**

- Same logic duplicated 6+ times
- Changes to fallback behavior require multiple edits
- Logging messages slightly inconsistent

## Proposed Solutions

### Option A: Extract Helper Function (Recommended)

**Effort:** Small (20 min)
**Risk:** Low

Create a shared helper:

```typescript
// In lib/landing-page-utils.ts or utils.ts
export function validateAndExtractPages(
  config: unknown,
  tenantId: string,
  label: 'draft' | 'live'
): { pages: PagesConfig; isValid: boolean } {
  const result = LandingPageConfigSchema.safeParse(config);
  if (!result.success) {
    logger.warn(
      { tenantId, errors: result.error.issues },
      `Invalid ${label} landing page config, falling back to defaults`
    );
    return { pages: structuredClone(DEFAULT_PAGES_CONFIG), isValid: false };
  }
  return {
    pages: result.data.pages || structuredClone(DEFAULT_PAGES_CONFIG),
    isValid: true,
  };
}
```

Usage:

```typescript
// Draft validation
const draft = validateAndExtractPages(tenant.landingPageConfigDraft, tenantId, 'draft');
if (draft.isValid) return { pages: draft.pages, hasDraft: true };

// Live fallback
const live = validateAndExtractPages(tenant.landingPageConfig, tenantId, 'live');
return { pages: live.pages, hasDraft: false };
```

## Resolution

Implemented **Option A: Extract Helper Function** as proposed.

### Changes Made

1. **Created `validateAndExtractPages()` helper** in `server/src/agent/tools/utils.ts` (lines 123-140)
   - Takes config, tenantId, and label ('draft' | 'live')
   - Returns `{ pages: PagesConfig; isValid: boolean }`
   - Provides consistent logging with error issues

2. **Updated `getDraftConfig()` and `getDraftConfigWithSlug()`**
   - Both functions now use the shared helper
   - Draft validation on lines 207, 293
   - Live fallback validation on lines 216, 305

3. **Landing page service `getPublishedConfig()` unchanged**
   - Different pattern: returns `null` on failure, not defaults
   - This is intentional for that specific method

### Benefits

- Single source of truth for validation + fallback pattern
- Consistent log messages with error issues
- Reduced maintenance burden
- Agent tools all use the same validation logic

## Technical Details

**Modified Files:**

- `server/src/agent/tools/utils.ts` - Created `validateAndExtractPages()` helper
- Uses existing shared utilities from `server/src/lib/landing-page-utils.ts`

## Acceptance Criteria - VERIFIED

- [x] Single helper function for validation + fallback
- [x] Agent tool locations use the helper
- [x] Consistent log messages across all usages
- [x] TypeScript compiles successfully

## Work Log

| Date       | Action                   | Learnings                                            |
| ---------- | ------------------------ | ---------------------------------------------------- |
| 2026-01-10 | Created from code review | Code-simplicity-reviewer identified repeated pattern |
| 2026-01-10 | Resolved                 | Helper already existed in utils.ts from prior work   |

## Resources

- Code simplicity review agent findings
- Related to #724, #725 (other DRY issues)
