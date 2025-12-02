---
status: pending
priority: p3
issue_id: "141"
tags: [code-review, visual-editor, accessibility, ux]
dependencies: []
---

# window.confirm() Used Instead of Modal Dialog

## Problem Statement

The useVisualEditor hook uses `window.confirm()` for the discard confirmation. This is inaccessible, not themeable, and provides a poor user experience.

**Why it matters**: Browser dialogs can't be styled to match the application, block the main thread, and have accessibility issues.

## Findings

### Discovery Source
Code Quality Review Agent - Code Review

### Evidence
Location: `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts` line 253

```typescript
const discardAll = useCallback(async () => {
  if (!window.confirm(`Are you sure you want to discard all ${draftCount} unsaved changes?`)) {
    return;  // User cancelled
  }
  // ... proceed with discard
}, [draftCount]);
```

## Proposed Solutions

### Option 1: Use AlertDialog from shadcn/ui (Recommended)
Replace with the existing AlertDialog component.

```typescript
// In VisualEditorDashboard.tsx
const [showDiscardDialog, setShowDiscardDialog] = useState(false);

<AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to discard all {draftCount} unsaved changes?
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmDiscard} className="bg-destructive">
        Discard All
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Pros**: Consistent with app design, accessible, themeable
**Cons**: More code, state management needed
**Effort**: Small
**Risk**: Low

### Option 2: Create Confirmation Hook
Create a reusable confirmation hook.

```typescript
const { confirm, ConfirmDialog } = useConfirmDialog();

const discardAll = async () => {
  const confirmed = await confirm({
    title: 'Discard Changes?',
    description: `Are you sure you want to discard all ${draftCount} unsaved changes?`,
    confirmLabel: 'Discard All',
    variant: 'destructive'
  });

  if (!confirmed) return;
  // ... proceed
};

return (
  <>
    <ConfirmDialog />
    {/* rest of component */}
  </>
);
```

**Pros**: Reusable pattern, cleaner API
**Cons**: New abstraction to maintain
**Effort**: Medium
**Risk**: Low

### Option 3: Accept Current Implementation
Leave as-is for MVP, document for future improvement.

**Pros**: No work required
**Cons**: Poor UX, accessibility issues remain
**Effort**: None
**Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Technical Details

### Affected Files
- `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`
- `client/src/features/tenant-admin/visual-editor/VisualEditorDashboard.tsx`

### Affected Components
- Discard confirmation flow
- Any future confirmation dialogs

### Database Changes Required
None

## Acceptance Criteria
- [ ] Discard confirmation uses styled modal dialog
- [ ] Dialog is keyboard accessible (Escape to close, Tab to navigate)
- [ ] Focus is trapped within dialog when open
- [ ] Dialog matches application theme
- [ ] Screen readers announce dialog properly

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources
- PR: feat(visual-editor) commit 0327dee
- shadcn/ui AlertDialog: https://ui.shadcn.com/docs/components/alert-dialog
