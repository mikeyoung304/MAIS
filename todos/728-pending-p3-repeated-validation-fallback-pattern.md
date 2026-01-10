---
status: pending
priority: p3
issue_id: '728'
tags:
  - code-review
  - dry
  - maintainability
dependencies:
  - '724'
---

# P3: Repeated Validation/Fallback Pattern in Landing Page Code

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

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/services/landing-page.service.ts`
- `server/src/agent/tools/utils.ts`
- `server/src/lib/landing-page-utils.ts` (new)

## Acceptance Criteria

- [ ] Single helper function for validation + fallback
- [ ] All 6+ locations use the helper
- [ ] Consistent log messages across all usages
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Learnings                                            |
| ---------- | ------------------------ | ---------------------------------------------------- |
| 2026-01-10 | Created from code review | Code-simplicity-reviewer identified repeated pattern |

## Resources

- Code simplicity review agent findings
- Related to #724, #725 (other DRY issues)
