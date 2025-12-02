---
title: "Visual Editor P3 Fixes: AlertDialog, useMemo, and Audit Logging Patterns"
date: 2025-12-02
category: code-review-patterns
severity: medium
component: visual-editor
tags:
  - react
  - alertdialog
  - usememo
  - memoization
  - audit-logging
  - accessibility
  - performance
  - code-review
related_files:
  - client/src/features/tenant-admin/visual-editor/VisualEditorDashboard.tsx
  - client/src/features/tenant-admin/visual-editor/components/EditablePackageCard.tsx
  - client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts
  - server/src/services/package-draft.service.ts
symptoms:
  - window.confirm blocks main thread and is inaccessible
  - Calculated values recalculated on every render
  - No audit trail for draft save/publish/discard operations
root_cause: |
  Three P3 issues from visual editor code review:
  1. Browser-native confirm() used instead of accessible AlertDialog
  2. Missing useMemo for derived values in frequently-rendering component
  3. No structured logging for important state-changing operations
---

# Visual Editor P3 Fixes: AlertDialog, useMemo, and Audit Logging Patterns

## Overview

This document captures three P3 fixes made to the visual editor feature during code review. Each fix represents a reusable pattern for future development.

## Pattern 1: Replace window.confirm with AlertDialog

### Problem

Using `window.confirm()` is an anti-pattern because:
- Blocks JavaScript execution
- Cannot be styled to match application design
- Poor accessibility (no ARIA labels, focus trap, or keyboard navigation)
- Cannot be tested with React Testing Library
- Poor mobile experience

### Detection

```bash
# Find all window.confirm usages
grep -r "window\.confirm" client/src/
grep -r "window\.alert" client/src/
grep -r "window\.prompt" client/src/
```

### Before (Problematic)

```typescript
// In useVisualEditor.ts
const discardAll = useCallback(async () => {
  // ❌ Browser-native blocking dialog
  if (!window.confirm(`Discard changes to ${draftCount} packages?`)) {
    return;
  }
  await api.tenantAdminDiscardDrafts({ body: {} });
}, [draftCount]);
```

### After (Fixed)

```typescript
// In VisualEditorDashboard.tsx
const [showDiscardDialog, setShowDiscardDialog] = useState(false);

const handleDiscardClick = useCallback(() => {
  if (draftCount === 0) return;
  setShowDiscardDialog(true);
}, [draftCount]);

const handleConfirmDiscard = useCallback(async () => {
  setShowDiscardDialog(false);
  await discardAll();
}, [discardAll]);

// In JSX
<AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to discard changes to {draftCount} package(s)?
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleConfirmDiscard}
        className="bg-destructive text-destructive-foreground"
      >
        Discard All
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Why It Works

1. **Separation of concerns**: UI confirmation in component, logic in hook
2. **Accessible**: Radix AlertDialog has proper ARIA, focus trap, Escape key
3. **Testable**: Can test with React Testing Library
4. **Themeable**: Matches application design system

---

## Pattern 2: Add useMemo for Calculated Values

### Problem

Recalculating derived values on every render:
- Wastes CPU cycles
- Creates new object references
- Can trigger unnecessary child re-renders

### Detection

Look for derived values calculated directly in component body:
```typescript
// Potential useMemo candidate
const effectiveValue = props.draft ?? props.live;
const hasChanges = props.draft !== null && props.draft !== props.live;
```

### Before (Problematic)

```typescript
function EditablePackageCard({ package: pkg }) {
  // ❌ Recalculated on EVERY render
  const effectiveTitle = pkg.draftTitle ?? pkg.title;
  const effectiveDescription = pkg.draftDescription ?? pkg.description ?? "";
  const effectivePriceCents = pkg.draftPriceCents ?? pkg.priceCents;
  const effectivePhotos = pkg.draftPhotos ?? pkg.photos ?? [];

  const hasTitleDraft = pkg.draftTitle !== null && pkg.draftTitle !== pkg.title;
  const hasDescriptionDraft = pkg.draftDescription !== null;
  // ... more calculations
}
```

### After (Fixed)

```typescript
function EditablePackageCard({ package: pkg }) {
  // ✅ Memoized - only recalculates when dependencies change
  const effectiveValues = useMemo(() => ({
    title: pkg.draftTitle ?? pkg.title,
    description: pkg.draftDescription ?? pkg.description ?? "",
    priceCents: pkg.draftPriceCents ?? pkg.priceCents,
    photos: pkg.draftPhotos ?? pkg.photos ?? [],
  }), [
    pkg.draftTitle, pkg.title,
    pkg.draftDescription, pkg.description,
    pkg.draftPriceCents, pkg.priceCents,
    pkg.draftPhotos, pkg.photos
  ]);

  const draftFlags = useMemo(() => ({
    hasTitle: pkg.draftTitle !== null && pkg.draftTitle !== pkg.title,
    hasDescription: pkg.draftDescription !== null,
    hasPrice: pkg.draftPriceCents !== null,
    hasPhotos: pkg.draftPhotos !== null,
  }), [
    pkg.draftTitle, pkg.title,
    pkg.draftDescription, pkg.description,
    pkg.draftPriceCents, pkg.priceCents,
    pkg.draftPhotos
  ]);
}
```

### When to Use useMemo

| Scenario | Use useMemo? |
|----------|--------------|
| Filtering/mapping arrays | ✅ Yes |
| Objects passed as props | ✅ Yes |
| Expensive calculations | ✅ Yes |
| Simple primitives | ❌ No |
| Single property access | ❌ No |

---

## Pattern 3: Add Audit Logging for Important Operations

### Problem

Without structured logging:
- Cannot debug user-reported issues
- No audit trail for compliance
- Cannot track what changed when

### Detection

```bash
# Find service methods without logging
grep -E "async (save|create|update|delete|publish|discard)" \
  server/src/services/*.ts -A 10 | grep -L "logger\."
```

### Before (Problematic)

```typescript
async saveDraft(tenantId: string, packageId: string, draft: UpdateInput) {
  const existing = await this.repository.getPackageById(tenantId, packageId);
  if (!existing) throw new NotFoundError(`Package not found`);

  // ❌ No audit trail
  return this.repository.updateDraft(tenantId, packageId, draft);
}
```

### After (Fixed)

```typescript
async saveDraft(tenantId: string, packageId: string, draft: UpdateInput) {
  const existing = await this.repository.getPackageById(tenantId, packageId);
  if (!existing) throw new NotFoundError(`Package not found`);

  const result = await this.repository.updateDraft(tenantId, packageId, draft);

  // ✅ Structured audit log
  logger.info({
    action: 'package_draft_saved',
    tenantId,
    packageId,
    packageSlug: existing.slug,
    changedFields: Object.keys(draft).filter(k => draft[k] !== undefined),
  }, 'Package draft saved');

  return result;
}

async discardDrafts(tenantId: string, packageIds?: string[]) {
  // ✅ Log BEFORE destructive operation
  const draftCount = await this.repository.countDrafts(tenantId);

  const discarded = await this.repository.discardDrafts(tenantId, packageIds);

  logger.info({
    action: 'package_drafts_discarded',
    tenantId,
    discardedCount: discarded,
    requestedPackageIds: packageIds ?? 'all',
    previousDraftCount: draftCount,
  }, `Discarded ${discarded} package draft(s)`);

  return { discarded };
}
```

### Key Fields for Audit Logs

| Field | Purpose |
|-------|---------|
| `action` | Searchable action type (e.g., `package_draft_saved`) |
| `tenantId` | Multi-tenant isolation |
| `resourceId` | Primary identifier |
| `resourceSlug` | Human-readable identifier |
| `changedFields` | What was modified |
| `count` | Number of affected items |

---

## Code Review Checklist

### React UI Patterns
- [ ] No `window.confirm/alert/prompt` - use AlertDialog
- [ ] Derived values wrapped in `useMemo()` when:
  - Passed as props to child components
  - Result of array filtering/mapping
  - Calculated from multiple props
- [ ] Event handlers wrapped in `useCallback()`

### Backend Logging Patterns
- [ ] All mutations have `logger.info()` calls
- [ ] Logs include: action, tenantId, resourceId, changedFields
- [ ] Log BEFORE destructive operations to capture state
- [ ] No `console.log` usage

---

## Self-Review Commands

```bash
# Check for window.confirm anti-pattern
grep -r "window\.confirm\|window\.alert\|window\.prompt" client/src/

# Find missing audit logs in services
grep -rL "logger\." server/src/services/*.ts

# Find useMemo candidates (derived from props)
grep -E "const .+ = props\..+ \?\?" client/src/
```

---

## Related Documentation

- [PR-12 React Hooks & Accessibility Prevention](../PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
- [React Hooks Performance & WCAG Review](./react-hooks-performance-wcag-review.md)
- [Webhook Error Logging PII Prevention](../security-issues/webhook-error-logging-pii-exposure.md)
- [Prevention Quick Reference](../PREVENTION-QUICK-REFERENCE.md)

---

## Commits

- `fix(visual-editor): replace window.confirm with AlertDialog, add useMemo`
- `feat(visual-editor): add audit logging for draft operations`
