# Build Mode: 6 Tier 1 Fixes Summary

**Status:** COMPLETE - All 6 fixes implemented
**Related:** Issues #622, #623, #624, #625, #626, #627
**Commits:** `21fa55eb` (feature), `bb26d800` (fix: useDraftAutosave wiring)
**Document Scope:** Extraction of root causes and working solutions

---

## Fix 1: Wire Publish/Discard to Real API (#623)

### Root Cause

Dialog confirm handlers were stubbed with `console.log()` instead of calling actual API methods.

```typescript
// ❌ Before: Stubs only
const handlePublishConfirm = async () => {
  console.log('Publishing...');
  setShowPublishDialog(false);
};
```

### Solution

Import `useDraftAutosave` hook and wire dialog handlers to real API calls:

```typescript
// ✅ After: Real API integration
import { useDraftAutosave } from '@/hooks/useDraftAutosave';

const { publishDraft, discardDraft, setDirty } = useDraftAutosave({
  initialConfig: draftConfig,
  onError: (err) => logger.error('Draft operation failed', { error: err.message }),
});

const handlePublishConfirm = async () => {
  setIsPublishing(true);
  setShowPublishDialog(false);
  try {
    const success = await publishDraft(); // ← Real API call
    if (success) {
      setIsDirty(false);
      setDirty(false);
      await fetchDraftConfig();
      // Show success toast
      setShowSuccessToast(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setShowSuccessToast(false), 3000);
    }
  } catch (err) {
    setShowErrorToast('Failed to publish changes. Please try again.');
  } finally {
    setIsPublishing(false);
  }
};
```

### File Changed

- `/apps/web/src/app/(protected)/tenant/build/page.tsx` (lines 54-169)

---

## Fix 2: Prop Name Mismatch (#624)

### Root Cause

Three `ConfirmDialog` usages passed `confirmText` but component expects `confirmLabel`. TypeScript didn't catch this because the prop is optional with a default value.

```typescript
// ❌ Before: Wrong prop name used
<ConfirmDialog
  confirmText="Publish"  // Component expects 'confirmLabel'
  onConfirm={handlePublishConfirm}
/>
```

### Why TypeScript Didn't Catch It

Optional props with default values silently use the default when the wrong prop name is passed:

```typescript
// In ConfirmDialog.tsx
interface ConfirmDialogProps {
  confirmLabel?: string;  // Optional - no error if missing
}

export function ConfirmDialog({
  confirmLabel = 'Confirm',  // Default value masks the typo
  // ...
}: ConfirmDialogProps) {
```

### Solution

Change all 3 usages to use correct prop name:

```typescript
// ✅ After: Correct prop name
<ConfirmDialog
  open={showPublishDialog}
  onOpenChange={setShowPublishDialog}
  title="Publish Changes"
  description="This will make your draft changes live on your storefront. Are you sure?"
  confirmLabel="Publish"  // ✅ Correct
  onConfirm={handlePublishConfirm}
/>

<ConfirmDialog
  open={showDiscardDialog}
  onOpenChange={setShowDiscardDialog}
  title="Discard Changes"
  description="This will permanently delete all your draft changes. This cannot be undone."
  confirmLabel="Discard"  // ✅ Correct
  variant="destructive"
  onConfirm={handleDiscardConfirm}
/>

<ConfirmDialog
  open={showExitDialog}
  onOpenChange={setShowExitDialog}
  title="Exit Build Mode"
  description={isDirty ? "You have unsaved changes. Are you sure you want to exit?" : "Are you sure you want to exit Build Mode?"}
  confirmLabel="Exit"  // ✅ Correct
  onConfirm={() => router.push('/tenant/dashboard')}
/>
```

### File Changed

- `/apps/web/src/app/(protected)/tenant/build/page.tsx` (lines 214-242)

### Prevention Pattern

Optional props with defaults won't catch typos. Test that the actual label appears in the UI, not the default.

---

## Fix 3: Missing Executor Tools from Registry (#622)

### Root Cause

`publish_draft` and `discard_draft` tools had executors registered but were missing from the `REQUIRED_EXECUTOR_TOOLS` validation list. Server startup validation failed even though executors existed.

```typescript
// ❌ Before: Missing from validation list
const REQUIRED_EXECUTOR_TOOLS = [
  // ... other tools ...
  'update_storefront_branding',
  // Missing: 'publish_draft'
  // Missing: 'discard_draft'
] as const;
```

### Solution

Add both tools to the validation list:

```typescript
// ✅ After: Tools added to validation list
const REQUIRED_EXECUTOR_TOOLS = [
  // Storefront Build Mode
  'update_page_section',
  'remove_page_section',
  'reorder_page_sections',
  'toggle_page_enabled',
  'update_storefront_branding',
  'publish_draft', // ✅ Added
  'discard_draft', // ✅ Added
] as const;
```

### File Changed

- `/server/src/agent/proposals/executor-registry.ts` (lines 90-91)

### Prevention Pattern

Every write tool needs TWO things:

1. **Executor registration** (in `executors/index.ts`):

   ```typescript
   registerProposalExecutor('tool_name', async (tenantId, payload) => {
     // implementation
   });
   ```

2. **Entry in REQUIRED_EXECUTOR_TOOLS** (in `executor-registry.ts`):
   ```typescript
   const REQUIRED_EXECUTOR_TOOLS = [
     // ...
     'tool_name', // ← Must add here too
   ] as const;
   ```

The validation list acts as a startup safety check to catch missing registrations.

---

## Fix 4: Memory Leak Timeout in useDraftAutosave (#625)

### Root Cause

Multiple `setTimeout` calls weren't tracked or cleaned up. If user triggered multiple saves or component unmounted while timeout pending, `setState` on unmounted component would warn.

```typescript
// ❌ Before: No tracking, no cleanup
const saveDraft = useCallback(
  async (config: PagesConfig) => {
    // ...
    setTimeout(() => {
      setSaveStatus('idle');  // ← Could fire on unmounted component
    }, delay);

    // No cleanup effect for unmount
  },
  [...]
);
```

### Solution

Track timeout with `useRef` and clean up on unmount:

```typescript
// ✅ After: Proper cleanup
const debounceRef = useRef<ReturnType<typeof setTimeout>>();
const statusResetRef = useRef<ReturnType<typeof setTimeout>>();

const saveDraft = useCallback(
  async (config: PagesConfig) => {
    // Clear previous timeout before setting new one
    if (statusResetRef.current) clearTimeout(statusResetRef.current);

    statusResetRef.current = setTimeout(() => {
      setSaveStatus('idle');
    }, BUILD_MODE_CONFIG.timing.saveStatusResetDelay);
  },
  [...]
);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (statusResetRef.current) clearTimeout(statusResetRef.current);
  };
}, []);
```

### File Changed

- `/apps/web/src/hooks/useDraftAutosave.ts` (lines 74-127, 224-233)

### Prevention Pattern

For ANY setTimeout in React:

```typescript
const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

// When setting timeout:
// 1. Clear previous
if (timeoutRef.current) clearTimeout(timeoutRef.current);

// 2. Set new
timeoutRef.current = setTimeout(() => {
  /* ... */
}, delay);

// 3. Cleanup on unmount
useEffect(() => {
  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };
}, []);
```

---

## Fix 5: Tailwind Dynamic Class JIT Limitation (#626)

### Root Cause

Tailwind CSS JIT compiler scans for complete class names at build time. It can't evaluate JavaScript expressions or template literals, so dynamic classes like ``className={`max-w-[${width}px]`}`` don't work.

```typescript
// ❌ Before: Tried to use template literal in className
className={`max-w-[${mobileWidth}px]`}
// Result: max-w-[375px] not recognized by Tailwind, width doesn't apply
```

### Why It Fails

Tailwind uses static analysis (regex scanning) on source code. It can't execute JS at build time:

```
Source: className={`max-w-[${mobileWidth}px]`}
         ↓
Regex doesn't find complete class name
         ↓
max-w-[375px] not generated in CSS
         ↓
No width applied at runtime
```

### Solution

Use inline `style` prop for dynamic values:

```typescript
// ✅ After: Inline style for dynamic value
<div
  className={cn(
    'h-full mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300',
    viewportMode === 'desktop' && 'w-full'  // Static classes work fine
  )}
  style={
    viewportMode === 'mobile'
      ? { maxWidth: BUILD_MODE_CONFIG.viewport.mobileWidth }  // ← Dynamic via style
      : undefined
  }
>
```

This works because:

- Static Tailwind classes (`h-full`, `w-full`) are scanned at build time ✓
- Dynamic values (`maxWidth: 375`) applied via inline style at runtime ✓
- No Tailwind limitations—inline styles accept any JS value ✓

### File Already Correct

- `/apps/web/src/components/build-mode/BuildModePreview.tsx` (already uses inline style)

### Prevention Pattern

Decision tree for dynamic dimensions:

```
Is the value dynamic (from API, user input, runtime)?
  → YES: Use inline style prop

Is it a fixed set of options (small/medium/large)?
  → YES: Use static Tailwind classes with mapping

Is it a build-time constant?
  → YES: Use static Tailwind class
```

**Never use template literals in className:**

```typescript
// ❌ DON'T
className={`p-[${amount}]`}
className={`max-w-[${value}px]`}

// ✅ DO
style={{ padding: amount, maxWidth: value }}
```

---

## Fix 6: BuildModePreview Timeout Leak (#627)

### Root Cause

Same pattern as Fix #4. The `handleIframeLoad` callback set a timeout that wasn't tracked or cleaned up.

```typescript
// ❌ Before: No tracking, no cleanup
const handleIframeLoad = useCallback(() => {
  setTimeout(() => {
    if (!isReady) {
      setIsLoading(false); // ← Could fire on unmounted component
    }
  }, BUILD_MODE_CONFIG.timing.iframeReadyTimeout);
}, [isReady]);
```

### Solution

Same as Fix #4 - track with `useRef` and clean up on unmount:

```typescript
// ✅ After: Proper cleanup
const iframeReadyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (iframeReadyTimeoutRef.current) {
      clearTimeout(iframeReadyTimeoutRef.current);
    }
  };
}, []);

const handleIframeLoad = useCallback(() => {
  // Clear previous timeout
  if (iframeReadyTimeoutRef.current) {
    clearTimeout(iframeReadyTimeoutRef.current);
  }
  // Set new timeout
  iframeReadyTimeoutRef.current = setTimeout(() => {
    if (!isReady) {
      setIsLoading(false);
    }
  }, BUILD_MODE_CONFIG.timing.iframeReadyTimeout);
}, [isReady]);
```

### File Changed

- `/apps/web/src/components/build-mode/BuildModePreview.tsx` (lines 40-54, 133-145)

---

## Summary Table

| Fix | Issue | Root Cause                                    | Solution                                                | File                                   |
| --- | ----- | --------------------------------------------- | ------------------------------------------------------- | -------------------------------------- |
| 1   | #623  | Stub APIs instead of real                     | Import hook, wire handlers to publishDraft/discardDraft | page.tsx:54-169                        |
| 2   | #624  | Wrong prop name (confirmText vs confirmLabel) | Change to correct prop name on 3 dialogs                | page.tsx:214-242                       |
| 3   | #622  | Missing from validation list                  | Add tools to REQUIRED_EXECUTOR_TOOLS array              | executor-registry.ts:90-91             |
| 4   | #625  | Timeout memory leak in hook                   | Track with useRef, clear before new, cleanup effect     | useDraftAutosave.ts                    |
| 5   | #626  | Dynamic classes in Tailwind                   | Use inline style instead of className                   | BuildModePreview.tsx (already correct) |
| 6   | #627  | Timeout memory leak in component              | Track with useRef, clear before new, cleanup effect     | BuildModePreview.tsx:40-54             |

---

## Patterns Extracted

### 1. API Wiring Checklist

- [ ] Import API hook/client
- [ ] Call hook at top level
- [ ] Wire ALL UI handlers to real API (not stubs)
- [ ] Add loading states (useState + overlay)
- [ ] Add error handling (try/catch + toast)
- [ ] Add success feedback
- [ ] Test end-to-end

### 2. Optional Props with Defaults

- Optional props don't trigger TypeScript errors when wrong prop name used
- Default value silently masks the typo
- Mitigation: Test that actual value appears in UI

### 3. Write Tool Registry Pattern

Every write tool needs BOTH:

1. Executor registered with `registerProposalExecutor()`
2. Tool name in `REQUIRED_EXECUTOR_TOOLS` list

The validation list acts as a startup check.

### 4. setTimeout Cleanup Pattern

```typescript
const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

// Clear old, set new
if (timeoutRef.current) clearTimeout(timeoutRef.current);
timeoutRef.current = setTimeout(() => {...}, delay);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };
}, []);
```

### 5. Dynamic Values in Tailwind

- **Static classes:** Scanned at build time (work fine)
- **Dynamic values:** Use inline style prop (not className)
- Never use template literals in className

---

## Related Documentation

- `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md` - Comprehensive patterns
- `docs/solutions/patterns/mais-critical-patterns.md` - Agent tool critical patterns
- `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md` - Executor registry pattern

---

**Document Version:** 1.0
**Last Updated:** 2026-01-05
**Status:** COMPLETE - All 6 fixes validated
