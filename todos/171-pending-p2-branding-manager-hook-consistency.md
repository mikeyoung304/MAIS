---
status: pending
priority: p2
issue_id: "171"
tags: [code-review, consistency, react-hooks, batch-5-review]
dependencies: []
---

# Use Shared useSuccessMessage Hook in useBrandingManager

## Problem Statement

The newly extracted `useBrandingManager` hook implements its own success message timeout logic instead of using the existing shared `useSuccessMessage` hook pattern used elsewhere in the codebase.

**Why it matters:**
- Inconsistent patterns increase cognitive load
- Duplicate timeout management logic
- Existing hook already handles edge cases

## Findings

**Source:** Code Quality agent review

**File:** `client/src/features/tenant-admin/branding/hooks/useBrandingManager.ts`
**Lines:** ~85-95 (success message handling)

**Current code:**
```typescript
// Custom success message implementation
const [successMessage, setSuccessMessage] = useState<string | null>(null);

const showSuccess = (message: string) => {
  setSuccessMessage(message);
  setTimeout(() => setSuccessMessage(null), 3000);
};
```

## Proposed Solution

Import and use the shared hook:

```typescript
import { useSuccessMessage } from '../../../../hooks/useSuccessMessage';

// In hook body:
const { successMessage, showSuccess } = useSuccessMessage();

// Usage remains the same:
showSuccess('Branding saved successfully');
```

**Effort:** Small (10 minutes)
**Risk:** Low

## Acceptance Criteria

- [ ] useBrandingManager uses shared useSuccessMessage hook
- [ ] Remove custom success message state
- [ ] Behavior unchanged
- [ ] TypeScript passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From batch 5 code review |

## Resources

- Related TODO: 106 (useBrandingManager extraction)
- Shared hook: client/src/hooks/useSuccessMessage.ts
- Commit: 54cb64a
