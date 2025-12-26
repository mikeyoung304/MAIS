---
status: complete
priority: p3
issue_id: "393"
tags:
  - cleanup
  - dead-code
  - code-review
dependencies: []
---

# Delete Unused Code from Next.js Migration

## Problem Statement

Several utility functions were created during the Next.js migration but are not used - the logic was duplicated inline instead. These should be deleted to reduce maintenance burden.

## Findings

**Dead Code Identified:**

### 1. `apps/web/src/lib/format.ts`
- **Function:** `formatPrice()`
- **Status:** UNUSED
- **Reason:** Shadowed by local implementations in components
- **Action:** Delete function (keep file if other exports exist)

### 2. `apps/web/src/lib/packages.ts`
- **Function:** `sortPackagesByTier()`
- **Status:** UNUSED
- **Reason:** Logic duplicated inline in 3 pages
- **Action:** Delete function

- **Function:** `getTierOrder()`
- **Status:** UNUSED
- **Reason:** Never called
- **Action:** Delete function

- **Constant:** `TIER_ORDER`
- **Status:** STILL USED in 3 locations
- **Action:** KEEP

### 3. `client/` directory (entire workspace)
- **Status:** Legacy Vite SPA, fully migrated to Next.js
- **Reason:** Zero imports from `client/` in `apps/web/`
- **Action:** Archive or delete (separate decision)

## Proposed Solutions

### Option 1: Delete dead functions, archive client/ (Recommended)
- Remove unused functions from lib files
- Move `client/` to `archive/` or delete

**Pros:** Clean codebase, clear migration complete
**Cons:** Need to verify no hidden dependencies
**Effort:** Small
**Risk:** Low

### Option 2: Just delete functions, keep client/
- Remove unused functions only
- Keep client/ for reference

**Pros:** Lower risk
**Cons:** Client/ adds confusion
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 1 - Full cleanup

## Technical Details

**Files to modify:**
- `apps/web/src/lib/format.ts` - Delete `formatPrice` or entire file
- `apps/web/src/lib/packages.ts` - Delete functions, keep `TIER_ORDER`

**Verification commands:**
```bash
# Check for any usage before deleting
grep -r "formatPrice" apps/web/src --include="*.ts" --include="*.tsx"
grep -r "sortPackagesByTier" apps/web/src --include="*.ts" --include="*.tsx"
grep -r "getTierOrder" apps/web/src --include="*.ts" --include="*.tsx"
```

## Acceptance Criteria

- [x] `formatPrice` - KEPT (actually in use in 3 locations)
- [x] `sortPackagesByTier` deleted from packages.ts
- [x] `getTierOrder` deleted from packages.ts
- [x] `TIER_ORDER` still works in 3 locations
- [x] TypeScript compiles without errors
- [ ] Decision made on client/ directory (deferred - separate issue)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from multi-agent scan | Found during dead code analysis |
| 2025-12-25 | Completed | formatPrice was in use, kept; deleted sortPackagesByTier and getTierOrder |

## Resources

- Dead code scan agent report
- Next.js migration ADR-014
