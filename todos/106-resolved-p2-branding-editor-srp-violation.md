---
status: pending
priority: p2
issue_id: "106"
tags: [code-review, architecture, refactoring, ui-redesign]
dependencies: []
---

# BrandingEditor Violates Single Responsibility Principle (172 lines)

## Problem Statement

BrandingEditor manages 6 form fields, validation logic, API calls, and success messages in a 172-line coordinator that should be a thin wrapper.

**Why it matters:** Difficult to test, prop drilling (11 props to BrandingForm), inconsistent with other managers.

## Findings

### From architecture-strategist agent:

**File:** `client/src/features/tenant-admin/BrandingEditor.tsx`

**Current issues:**
- 6 separate state variables for form fields
- 45 lines of validation and API logic
- 9 dependencies in useCallback
- 11 props passed to BrandingForm
- Inconsistent with PackagesManager, SegmentsManager pattern

## Proposed Solutions

### Solution 1: Extract to useBrandingManager Hook (Recommended)
**Pros:** Matches other manager patterns, testable
**Cons:** Refactoring effort
**Effort:** Medium (2-3 hours)
**Risk:** Low

```typescript
// hooks/useBrandingManager.ts
export function useBrandingManager({ branding, onBrandingChange }) {
  const [form, setForm] = useState({ primaryColor: "#1a365d", ... });
  const { successMessage, showSuccess } = useSuccessMessage();
  // Validation and API logic here
  return { form, setForm, isSaving, error, successMessage, handleSave };
}

// BrandingEditor.tsx (30 lines)
export function BrandingEditor({ branding, isLoading, onBrandingChange }) {
  const manager = useBrandingManager({ branding, onBrandingChange });
  return (
    <div className="space-y-6">
      <SuccessMessage message={manager.successMessage} />
      <BrandingForm {...manager} />
      <BrandingPreview {...manager.form} />
    </div>
  );
}
```

## Acceptance Criteria

- [ ] useBrandingManager hook created
- [ ] BrandingEditor reduced to ~40 lines
- [ ] Props passed as form object, not 11 individual props
- [ ] Unit tests for hook validation logic
- [ ] Visual behavior unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-30 | Created from code review | SRP violation identified |
