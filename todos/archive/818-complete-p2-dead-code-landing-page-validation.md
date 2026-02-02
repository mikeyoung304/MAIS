---
status: pending
priority: p2
issue_id: 818
tags: [code-review, dead-code, cleanup]
dependencies: []
---

# Dead Code: Unused Landing Page Validation Utilities

## Problem Statement

The file `server/src/lib/landing-page-validation.ts` (224 lines) exports validation utilities that are never imported anywhere in the codebase. Additionally, `validateImageUrls()` in `tenant.repository.ts` is defined but never called.

**Why it matters:**

- Dead code increases maintenance burden
- Misleading - developers think these utilities are used
- ~280 lines that could be deleted

## Findings

**From Code Simplicity Review:**

```bash
grep -rn "landing-page-validation" server/src/  # No results
grep -rn "getIncompleteSections" server/src/    # Only in definition file
grep -rn "validateImageUrls" server/            # Only the definition, no calls
```

**Unused exports in `landing-page-validation.ts`:**

- `validateDraft()` - not imported anywhere
- `validateForPublish()` - not imported anywhere
- `getIncompleteSections()` - not imported anywhere

**Unused method in `tenant.repository.ts`:**

- `validateImageUrls()` (lines 847-904) - defined but never called

**Root Cause:**
The plan document specified creating these utilities, but the actual implementation directly uses `LenientLandingPageConfigSchema.safeParse()` in `tenant.repository.ts` instead of the wrapper functions.

## Proposed Solutions

### Option A: Delete Dead Code (Recommended)

**Pros:**

- Clean codebase
- No misleading code
- Direct `safeParse()` calls are simpler

**Cons:**

- Loses potentially useful utilities (but they're unused)

**Effort:** Small (15 minutes)
**Risk:** Low

```bash
# Delete the file
rm server/src/lib/landing-page-validation.ts

# Remove validateImageUrls method from tenant.repository.ts (lines 847-904)
```

### Option B: Wire Up Validation Utilities

**Pros:**

- Semantic clarity (`validateDraft()` vs `safeParse()`)
- `getIncompleteSections()` could provide better error messages

**Cons:**

- Extra abstraction layer for minimal benefit
- Repository already works correctly

**Effort:** Medium (1 hour)
**Risk:** Low

## Recommended Action

Implement Option A - delete the dead code. The current implementation works correctly without these wrappers.

## Technical Details

**Files to delete/modify:**

- DELETE: `server/src/lib/landing-page-validation.ts` (224 lines)
- MODIFY: `server/src/adapters/prisma/tenant.repository.ts` - remove `validateImageUrls()` method (lines 847-904, ~58 lines)

**Total cleanup:** ~280 lines

## Acceptance Criteria

- [ ] `landing-page-validation.ts` deleted
- [ ] `validateImageUrls()` method removed from tenant.repository.ts
- [ ] TypeScript compiles without errors
- [ ] All existing tests pass

## Work Log

| Date       | Action                           | Learnings                                                  |
| ---------- | -------------------------------- | ---------------------------------------------------------- |
| 2026-02-01 | Code review identified dead code | Plan specified utilities, implementation used direct calls |

## Resources

- PR: feat/realtime-storefront-preview branch
- Plan: docs/plans/2026-02-01-feat-realtime-storefront-preview-plan.md
