---
status: complete
priority: p2
issue_id: "173"
tags: [code-review, code-quality, dead-code, react-hooks]
dependencies: []
---

# Dead `error` State Variable in Manager Hooks

## Problem Statement

The `error` state variable is defined and exported from 3 manager hooks but is never consumed by any UI component. This creates dead code and potential confusion about error handling patterns.

**Why it matters:**
- Dead code increases maintenance burden
- Unclear whether error state should be used
- Inconsistent with toast-only error pattern applied elsewhere

## Findings

**Source:** Code Quality Specialist agent review

**Files Affected:**
- `client/src/features/admin/packages/hooks/useAddOnManager.ts` (line 21)
- `client/src/features/admin/packages/hooks/usePackageManager.ts` (line 21)
- `client/src/features/admin/segments/hooks/useSegmentManager.ts` (line 21)

**Current code:**
```typescript
// Defined but potentially never used
const [error, setError] = useState<string | null>(null);

// Exported in return value
return {
  error,  // Not consumed by UI?
  // ...
}
```

**Validation errors still use setError:**
```typescript
if (!addOnForm.title || !addOnForm.priceCents) {
  setError("Title and price are required");
  return;
}
```

## Proposed Solutions

### Option A: Remove `error` State Entirely (Recommended)
**Pros:** Consistent with toast-only pattern, removes dead code
**Cons:** Need to convert validation errors to toast
**Effort:** Small (20 minutes)
**Risk:** Low (if verified unused)

```typescript
// Replace setError with toast
if (!addOnForm.title || !addOnForm.priceCents) {
  toast.error("Title and price are required");
  return;
}
```

### Option B: Verify and Document Intentional Dual Pattern
**Pros:** No code changes if intentional
**Cons:** Need documentation
**Effort:** Small (10 minutes)
**Risk:** None

### Option C: Wire Up Error State in UI
**Pros:** Makes error state useful
**Cons:** More changes, may not match UX intent
**Effort:** Medium (30 minutes)
**Risk:** Low

## Recommended Action

First verify error state is unused:
```bash
grep -r "packageManager.*error\|addOnManager.*error\|segmentManager.*error" client/src/
```

If unused, implement Option A for consistency.

## Technical Details

**Affected Components (to check):**
- `TenantPackagesManager.tsx`
- `TenantDashboard/` components

## Acceptance Criteria

- [x] Verify error state is not consumed in UI
- [x] Remove error state if unused
- [x] Convert validation errors to toast
- [x] TypeScript passes
- [ ] Tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From code quality review of commit d9ceb40 |
| 2025-12-02 | Completed | Removed error state from all 3 hooks and updated 6 consuming components. Validation errors were already converted to toast. TypeScript compilation passes. |

## Resources

- Commit: d9ceb40
- Related TODO: 165 (redundant error feedback)
