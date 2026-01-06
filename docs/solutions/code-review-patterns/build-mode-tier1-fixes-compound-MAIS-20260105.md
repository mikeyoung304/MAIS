---
title: Build Mode Tier 1 Fixes - 6 Critical Patterns
date: 2026-01-05
category: code-review-patterns
tags:
  - agent-tools
  - executor-registry
  - react-hooks
  - memory-leaks
  - tailwind-jit
  - prop-validation
  - build-mode
severity: p1
components:
  - apps/web/src/app/(protected)/tenant/build/page.tsx
  - apps/web/src/hooks/useDraftAutosave.ts
  - apps/web/src/components/build-mode/BuildModePreview.tsx
  - server/src/agent/proposals/executor-registry.ts
related_todos:
  - '622'
  - '623'
  - '624'
  - '625'
  - '626'
---

# Build Mode Tier 1 Fixes - 6 Critical Patterns

This document captures the patterns and solutions from resolving 6 P1 code review issues in the Build Mode storefront editor. All reviewers (DHH, Kieran, Code Simplicity) reached unanimous agreement that these were blockers.

## Problem Summary

The Build Mode feature shipped looking complete but functionally incomplete. The buttons existed, dialogs appeared, but clicking "Publish" did nothing except `console.log()`.

**Meta-lesson:** Console.log stubs are not bugs - they're lies the codebase tells itself.

---

## Pattern 1: Console.log Stub Anti-Pattern (#623)

### Problem

```typescript
// WRONG: UI looks complete but does nothing
const handlePublishClick = () => console.log('publish');

onConfirm={() => {
  console.log('Publishing...');  // User clicks, nothing happens
  setShowPublishDialog(false);
}}
```

### Root Cause

Developer created the UI flow (button → dialog → confirm) but never wired the confirm handler to the actual API. The `useDraftAutosave` hook already had `publishDraft()` and `discardDraft()` methods - they just weren't connected.

### Solution

```typescript
// CORRECT: Wire to real API via hook
const { publishDraft, discardDraft } = useDraftAutosave({
  initialConfig: draftConfig,
  onError: (err) => logger.error('Draft operation failed', { error: err.message }),
});

const handlePublishConfirm = async () => {
  setIsPublishing(true);
  setShowPublishDialog(false);
  try {
    const success = await publishDraft();
    if (success) {
      setIsDirty(false);
      await fetchDraftConfig();
      setShowSuccessToast(true);
    }
  } catch (err) {
    logger.error('Failed to publish', err);
    setShowErrorToast('Failed to publish changes');
  } finally {
    setIsPublishing(false);
  }
};
```

### Prevention

- **Code Review Checklist:** Every `onConfirm` handler must call a real function, not log
- **Pre-commit Hook:** Flag `console.log` in production dialog handlers
- **Definition of Done:** "All UI actions call real backends"

---

## Pattern 2: Optional Prop Name Mismatch (#624)

### Problem

```typescript
// WRONG: confirmText doesn't exist on interface
<ConfirmDialog
  confirmText="Publish"  // Silently ignored!
  ...
/>

// Interface expects confirmLabel
interface ConfirmDialogProps {
  confirmLabel?: string;  // Default: "Confirm"
}
```

### Root Cause

Optional props with default values don't cause TypeScript errors when you use the wrong name. The prop is simply ignored, and the default is used.

### Solution

```typescript
// CORRECT: Use the actual prop name
<ConfirmDialog
  confirmLabel="Publish"
  ...
/>
```

### Prevention

- **Prefer Required Props:** Make critical props required, not optional with defaults
- **TypeScript Exact Types:** Consider `Exact<T>` pattern for stricter checking
- **Visual Testing:** Would catch "Confirm" showing instead of "Publish"

---

## Pattern 3: Missing Executor Registry Entry (#622)

### Problem

```typescript
// Executors were registered...
registerProposalExecutor('publish_draft', publishDraftExecutor);
registerProposalExecutor('discard_draft', discardDraftExecutor);

// ...but NOT in validation list
const REQUIRED_EXECUTOR_TOOLS = [
  'update_page_section',
  'remove_page_section',
  // MISSING: 'publish_draft', 'discard_draft'
];
```

### Root Cause

New tools added but validation list not updated. The safety net was broken.

### Solution

```typescript
const REQUIRED_EXECUTOR_TOOLS = [
  // Storefront Build Mode
  'update_page_section',
  'remove_page_section',
  'reorder_page_sections',
  'toggle_page_enabled',
  'update_storefront_branding',
  'publish_draft', // ADD
  'discard_draft', // ADD
] as const;
```

### Prevention

- **Checklist:** When adding agent write tool, MUST add to REQUIRED_EXECUTOR_TOOLS
- **Server Startup:** `validateExecutorRegistry()` catches missing executors at boot
- **Document in CLAUDE.md:** Already listed in "Common Pitfalls" section

---

## Pattern 4: React Timeout Memory Leak (#625)

### Problem

```typescript
// WRONG: Timeout not tracked, not cleaned up
setTimeout(() => {
  setSaveStatus('idle'); // Fires on unmounted component!
}, 2000);
```

### Root Cause

`setTimeout` returns a timer ID that must be tracked and cleared. Without cleanup:

- React warning: "Can't perform state update on unmounted component"
- Memory leak in long-running sessions
- Multiple rapid saves create orphaned timeouts

### Solution

```typescript
// CORRECT: Track with ref, clear previous, cleanup on unmount
const statusResetRef = useRef<ReturnType<typeof setTimeout>>();

// In saveDraft:
if (statusResetRef.current) clearTimeout(statusResetRef.current);
statusResetRef.current = setTimeout(() => {
  setSaveStatus('idle');
}, 2000);

// In cleanup effect:
useEffect(() => {
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (statusResetRef.current) clearTimeout(statusResetRef.current);
  };
}, []);
```

### Prevention

- **Pattern:** ALWAYS use `useRef` to track timeout IDs
- **Pattern:** ALWAYS clear previous timeout before setting new one
- **Pattern:** ALWAYS add to cleanup effect
- **ESLint:** `react-hooks/exhaustive-deps` helps catch related issues

---

## Pattern 5: Tailwind JIT Dynamic Class (#626)

### Problem

```typescript
// WRONG: Template literal not detected by Tailwind JIT
className={cn(
  'transition-all',
  viewportMode === 'mobile'
    ? `max-w-[${BUILD_MODE_CONFIG.viewport.mobileWidth}px]`  // NOT COMPILED!
    : 'w-full'
)}
```

### Root Cause

Tailwind's JIT compiler scans source code for complete class names at build time. Template literals like `` `max-w-[${variable}px]` `` are not detected because the variable value isn't known until runtime.

### Solution

```typescript
// CORRECT: Use inline style for dynamic values
className={cn(
  'transition-all',
  viewportMode === 'desktop' && 'w-full'
)}
style={viewportMode === 'mobile'
  ? { maxWidth: BUILD_MODE_CONFIG.viewport.mobileWidth }
  : undefined
}
```

### Alternative: Static Classes

```typescript
// If value is constant, use static class
viewportMode === 'mobile' ? 'max-w-[375px]' : 'w-full';
```

### Prevention

- **Rule:** Never use template literals in Tailwind class names
- **Use:** Inline `style` prop for truly dynamic values
- **Use:** Static classes when value is constant
- **Tailwind Docs:** https://tailwindcss.com/docs/content-configuration#dynamic-class-names

---

## Pattern 6: Same Timeout Leak in Different Component (Issue C)

### Problem

Same pattern as #625, but in `BuildModePreview.tsx`:

```typescript
// WRONG: setTimeout in handleIframeLoad not tracked
const handleIframeLoad = useCallback(() => {
  setTimeout(() => {
    if (!isReady) setIsLoading(false);
  }, 3000); // Orphaned timeout!
}, [isReady]);
```

### Solution

Same pattern - add ref, track, cleanup:

```typescript
const iframeReadyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

useEffect(() => {
  return () => {
    if (iframeReadyTimeoutRef.current) clearTimeout(iframeReadyTimeoutRef.current);
  };
}, []);

const handleIframeLoad = useCallback(() => {
  if (iframeReadyTimeoutRef.current) clearTimeout(iframeReadyTimeoutRef.current);
  iframeReadyTimeoutRef.current = setTimeout(() => {
    if (!isReady) setIsLoading(false);
  }, 3000);
}, [isReady]);
```

---

## Quick Reference Checklist

### Before Shipping Any Feature

- [ ] All UI button handlers call real functions (not console.log)
- [ ] All optional props use correct names (check interface)
- [ ] All agent write tools in REQUIRED_EXECUTOR_TOOLS
- [ ] All setTimeout/setInterval tracked in refs
- [ ] All refs cleared in cleanup effects
- [ ] No template literals in Tailwind class names
- [ ] Integration test covers full user flow

### Code Review Red Flags

| Red Flag                       | What to Check                      |
| ------------------------------ | ---------------------------------- |
| `console.log` in event handler | Should be API call                 |
| Optional prop with default     | Verify prop name matches interface |
| New agent tool                 | Check REQUIRED_EXECUTOR_TOOLS      |
| `setTimeout` in component      | Check for ref tracking + cleanup   |
| `${variable}` in className     | Use inline style instead           |

---

## Related Documentation

- [Build Mode Storefront Editor Patterns](../patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md)
- [Circular Dependency Executor Registry](../patterns/circular-dependency-executor-registry-MAIS-20251229.md)
- [Phase 5 Testing and Caching Prevention](../patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)
- [React Hook Extraction Prevention](../react-performance/REACT-HOOK-EXTRACTION-PREVENTION.md)

---

## Commit Reference

```
fix(web): resolve 6 Tier 1 code review issues in Build Mode

Commit: 3157c26c
Branch: feat/build-mode-storefront-editor
```
