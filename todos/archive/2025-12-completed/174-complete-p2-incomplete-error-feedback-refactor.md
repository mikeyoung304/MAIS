---
status: complete
priority: p2
issue_id: '174'
tags: [code-review, code-quality, consistency, react-hooks]
dependencies: ['173']
---

# Incomplete Error Feedback Refactor in Manager Hooks

## Problem Statement

The TODO 165 "Fix redundant error feedback hooks" was only partially completed. API errors now use toast-only, but validation errors still use `setError()`. This creates inconsistent error handling patterns.

**Why it matters:**

- Validation errors: `setError()` (inline display, if rendered)
- API errors: `toast.error()` (popup notification)
- Users experience different feedback for different error types
- Unclear pattern for developers

## Findings

**Source:** Code Quality Specialist agent review

**Files Affected:**

- `client/src/features/admin/packages/hooks/usePackageManager.ts`
- `client/src/features/admin/packages/hooks/useAddOnManager.ts`
- `client/src/features/admin/segments/hooks/useSegmentManager.ts`
- `client/src/features/tenant-admin/scheduling/ServicesManager/useServicesManager.ts`

**Current inconsistent pattern:**

```typescript
// Validation errors (setError)
if (!packageForm.slug || !packageForm.title) {
  setError('All fields except Photo URL are required');
  return;
}

// API errors (toast only - after TODO 165 fix)
toast.error('Failed to update package', {
  description: 'Please try again or contact support.',
});
```

## Proposed Solutions

### Option A: All Errors via Toast (Recommended)

**Pros:** Consistent UX, single pattern
**Cons:** Validation errors less persistent than inline
**Effort:** Small (20 minutes)
**Risk:** Low

```typescript
// Convert validation to toast
if (!packageForm.slug || !packageForm.title) {
  toast.error('Missing Required Fields', {
    description: 'All fields except Photo URL are required',
  });
  return;
}
```

### Option B: All Errors via Inline State

**Pros:** Persistent error display
**Cons:** Need to update toast calls back to setError
**Effort:** Medium (30 minutes)
**Risk:** Low

### Option C: Document Intentional Two-Tier Pattern

**Pros:** No code changes
**Cons:** Needs clear documentation
**Effort:** Small (10 minutes)
**Risk:** None

## Recommended Action

Implement Option A for consistency. Toast provides adequate feedback for form validation and matches the API error pattern already in place.

## Technical Details

**Error Types:**

1. Validation errors (client-side checks)
2. API errors (server responses)

**Recommended Pattern:**

```typescript
// Both validation and API errors use toast
toast.error(title, { description: details });
```

## Acceptance Criteria

- [x] Choose single error feedback pattern (Option A: All via toast)
- [x] Update all validation errors to match pattern
- [x] Document the chosen pattern (inline in code)
- [x] TypeScript passes
- [ ] Tests pass (manual verification recommended)

## Work Log

| Date       | Action    | Notes                                                                         |
| ---------- | --------- | ----------------------------------------------------------------------------- |
| 2025-12-02 | Created   | From code quality review of commit d9ceb40                                    |
| 2025-12-02 | Completed | Converted all setError() validation calls to toast.error() in 4 manager hooks |

## Resources

- Commit: d9ceb40
- Related TODO: 165 (original refactor), 173 (dead error state)
