---
status: complete
priority: p2
issue_id: "138"
tags: [code-review, visual-editor, react, data-integrity]
dependencies: []
---

# Optimistic Updates Without Rollback on Failure

## Problem Statement

The useVisualEditor hook performs optimistic UI updates immediately when the user edits a field, but if the debounced save fails, the UI state is not rolled back. This leaves the UI showing data that wasn't actually saved.

**Why it matters**: Users may think their changes were saved when they weren't, leading to data loss and confusion.

## Findings

### Discovery Source
Code Quality Review Agent & Data Integrity Review Agent - Code Review

### Evidence
Location: `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts` lines 143-194

```typescript
const updateDraft = useCallback((packageId: string, update: DraftUpdate) => {
  // Optimistic update - happens immediately
  setPackages((prev) =>
    prev.map((pkg) =>
      pkg.id === packageId
        ? {
            ...pkg,
            draftTitle: update.title ?? pkg.draftTitle,
            draftDescription: update.description ?? pkg.draftDescription,
            // ... updates applied
            hasDraft: true,
          }
        : pkg
    )
  );

  // Debounced save happens 1 second later
  const timeout = setTimeout(async () => {
    try {
      // ... fetch to save
    } catch (err) {
      toast.error("Failed to save changes", { description: ... });
      // NO ROLLBACK - UI still shows the optimistic update!
    }
  }, 1000);
}, []);
```

**Scenario:**
1. User edits package title from "Original" to "New Title"
2. Optimistic update: UI shows "New Title"
3. Network fails, save request errors
4. Toast shows "Failed to save changes"
5. UI STILL shows "New Title" even though server has "Original"

## Proposed Solutions

### Option 1: Store Original State for Rollback (Recommended)
Store the original values before optimistic update and restore on failure.

```typescript
const updateDraft = useCallback((packageId: string, update: DraftUpdate) => {
  // Store original state
  const originalPackage = packages.find(p => p.id === packageId);

  // Optimistic update
  setPackages(prev => prev.map(pkg =>
    pkg.id === packageId ? { ...pkg, ...optimisticUpdate } : pkg
  ));

  // Debounced save with rollback
  const timeout = setTimeout(async () => {
    try {
      await saveDraft(packageId, update);
    } catch (err) {
      // ROLLBACK: Restore original state
      setPackages(prev => prev.map(pkg =>
        pkg.id === packageId ? originalPackage : pkg
      ));
      toast.error("Failed to save changes. Your edit has been reverted.");
    }
  }, 1000);
}, [packages]);
```

**Pros**: Complete data consistency, clear user feedback
**Cons**: Need to track original state
**Effort**: Medium
**Risk**: Low

### Option 2: Use React Query Mutations
Leverage React Query's built-in optimistic update and rollback.

```typescript
const mutation = useMutation({
  mutationFn: saveDraft,
  onMutate: async (update) => {
    await queryClient.cancelQueries(['packages']);
    const previous = queryClient.getQueryData(['packages']);
    queryClient.setQueryData(['packages'], optimisticUpdate);
    return { previous };
  },
  onError: (err, update, context) => {
    queryClient.setQueryData(['packages'], context.previous);
  },
});
```

**Pros**: Battle-tested pattern, automatic rollback
**Cons**: Requires refactoring to use React Query
**Effort**: Large
**Risk**: Medium

### Option 3: Refetch on Error
On save failure, refetch packages from server to restore correct state.

```typescript
catch (err) {
  toast.error("Failed to save. Refreshing...");
  await loadPackages(); // Refetch from server
}
```

**Pros**: Simple implementation
**Cons**: Loses any unsaved changes, slow
**Effort**: Small
**Risk**: Medium (user loses work)

## Recommended Action
<!-- Filled during triage -->

## Technical Details

### Affected Files
- `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`

### Affected Components
- Package editing in visual editor
- All fields: title, description, price, photos

### Database Changes Required
None

## Acceptance Criteria
- [ ] Failed saves trigger rollback of optimistic update
- [ ] User clearly notified when rollback occurs
- [ ] UI state always reflects actual server state
- [ ] No data loss scenarios
- [ ] Works correctly with rapid edits and race conditions

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources
- PR: feat(visual-editor) commit 0327dee
- React Query optimistic updates: https://tanstack.com/query/latest/docs/guides/optimistic-updates
