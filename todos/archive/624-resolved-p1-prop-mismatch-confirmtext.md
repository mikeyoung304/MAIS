---
status: complete
priority: p1
issue_id: '624'
tags: [code-review, bug, build-mode, typescript]
dependencies: []
---

# Prop Mismatch: confirmText vs confirmLabel in ConfirmDialog

## Problem Statement

The BuildModePage passes `confirmText` prop to ConfirmDialog, but the component expects `confirmLabel`. This prop is silently ignored, causing all dialog buttons to display "Confirm" instead of the intended text.

**What's broken:** Dialog buttons show wrong text
**Why it matters:** Confusing UX - user sees "Confirm" instead of "Publish", "Discard", or "Exit"

## Findings

### Source: TypeScript Reviewer (Kieran)

**Files:**

- `/apps/web/src/app/(protected)/tenant/build/page.tsx` (lines 177-205)
- `/apps/web/src/components/build-mode/ConfirmDialog.tsx` (line 29)

**Usage (WRONG):**

```typescript
<ConfirmDialog
  confirmText="Publish"  // WRONG: should be confirmLabel
  ...
/>
```

**Interface (expects confirmLabel):**

```typescript
interface ConfirmDialogProps {
  confirmLabel?: string; // Not confirmText
  // ...
}
```

**Result:** Button always shows "Confirm" (the default) instead of "Publish", "Discard", "Exit"

## Proposed Solutions

### Option A: Fix prop name in page.tsx (Recommended)

**Description:** Update all usages to use `confirmLabel`

```typescript
// Line 177
<ConfirmDialog
  confirmLabel="Publish"  // was confirmText
  ...
/>

// Line 188
<ConfirmDialog
  confirmLabel="Discard"  // was confirmText
  ...
/>

// Line 200
<ConfirmDialog
  confirmLabel="Exit"  // was confirmText
  ...
/>
```

- **Pros:** Simple 3-line fix
- **Cons:** None
- **Effort:** Small (2 minutes)
- **Risk:** None

## Technical Details

**Affected Files:**

- `apps/web/src/app/(protected)/tenant/build/page.tsx` (3 locations)

## Acceptance Criteria

- [ ] Publish dialog shows "Publish" button
- [ ] Discard dialog shows "Discard" button
- [ ] Exit dialog shows "Exit" button
- [ ] TypeScript compiles without errors

## Work Log

| Date       | Action                               | Learnings                                               |
| ---------- | ------------------------------------ | ------------------------------------------------------- |
| 2026-01-05 | Created from multi-agent code review | TypeScript didn't catch this because props are optional |

## Resources

- ConfirmDialog component: `apps/web/src/components/build-mode/ConfirmDialog.tsx`
