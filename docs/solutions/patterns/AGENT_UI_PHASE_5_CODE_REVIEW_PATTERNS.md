# Agent UI Phase 5 Code Review Patterns

**Date:** 2026-01-09
**Related Issues:** #678, #680, #682, #683, #684, #686
**Status:** ACTIVE (use for future agent-ui features)

This document captures the key solution patterns from Phase 5 code review fixes. Each pattern prevents a specific class of bugs and should be applied whenever adding similar functionality.

---

## Pattern 1: FIFO Buffer for Unbounded Arrays

**Issue:** #678
**File:** `apps/web/src/stores/agent-ui-store.ts`

### Problem

Action log array grows indefinitely during long sessions, causing memory leak. No limit on `state.actionLog`, so old actions accumulate forever.

### Solution

Implement FIFO (First-In-First-Out) buffer with configurable max size:

```typescript
// 1. Define maximum size as constant
const MAX_ACTION_LOG_SIZE = 100;

// 2. After each push, check and remove oldest if over limit
state.actionLog.push(action);
if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
  state.actionLog.shift(); // Remove oldest (index 0)
}
```

### When to Apply

- Any unbounded array that accumulates over time (action logs, message history, cache entries)
- Long-running sessions where memory leaks compound
- Real-time dashboards / chat applications

### Related Code

- Lines 27, 278-281 in agent-ui-store.ts (FIFO applied to every action)
- Lines 302-306, 324-328, 378-382, 408-412 (consistent pattern across all push operations)

### Prevention Strategy

- Never append to an array without considering lifecycle
- Use max size constants at module level (not magic numbers)
- Apply truncation IMMEDIATELY after push, not later
- Add test: verify actionLog never exceeds MAX_ACTION_LOG_SIZE

---

## Pattern 2: Cancel Pending Debounced Operations

**Issue:** #680
**File:** `apps/web/src/hooks/useDraftAutosave.ts`

### Problem

Race condition when critical operations (publish, discard) fire while debounced save is pending:

1. User clicks "Publish Draft"
2. `publishDraft()` executes and completes
3. Debounced save timeout fires 1s later
4. Stale save overwrites the published version

### Solution

Export function to cancel pending debounced operations before critical actions:

```typescript
// 1. Store timeout ID in ref
const debounceRef = useRef<ReturnType<typeof setTimeout>>();

// 2. Implement cancelPendingSave function
const cancelPendingSave = useCallback(() => {
  if (debounceRef.current) {
    clearTimeout(debounceRef.current);
    debounceRef.current = undefined;
    logger.debug('[useDraftAutosave] Cancelled pending save');
  }
}, []);

// 3. Export it so callers can use
return {
  // ... other returns
  cancelPendingSave,
};

// 4. In component: call BEFORE publish/discard
await useDraftAutosave.cancelPendingSave();
await draftAutosave.publishDraft();
```

### When to Apply

- Any hook with debounced/queued operations that can conflict with other actions
- State mutations that race with async operations
- Before executing critical operations (publish, delete, confirm)

### Related Code

- Lines 61-62, 228-234 in useDraftAutosave.ts (definition and export)
- Lines 201-217 in queueSave function (where debounce is set)
- Callers must invoke before `publishDraft()` or `discardDraft()`

### Prevention Strategy

- Document that debounced hooks MUST have cancel mechanism
- Export cancel function as public API
- Add comment explaining race condition window
- Test: verify cancellation prevents stale updates
- Test: verify cancel + action doesn't skip the action

---

## Pattern 3: Async Dialog Handling

**Issue:** #686
**File:** `apps/web/src/components/build-mode/ConfirmDialog.tsx`

### Problem

Dialog closes immediately before async operation completes, giving false sense of success:

```typescript
// ❌ WRONG - Dialog closes before operation finishes
const handleConfirm = () => {
  onConfirm(); // Fire and forget
  onOpenChange(false); // Closes immediately
};
```

### Solution

Wrap async operation and only close on success:

```typescript
// ✅ CORRECT - Async wrapper with loading state
const [isLoading, setIsLoading] = useState(false);

const handleConfirm = async () => {
  setIsLoading(true);
  try {
    await onConfirm(); // Wait for operation
    onOpenChange(false); // Only close on success
  } finally {
    setIsLoading(false);
  }
};

// Also disable interactions while loading
<AlertDialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
  <AlertDialogCancel disabled={isLoading}>
  <AlertDialogAction disabled={isLoading}>
    {isLoading ? <Loader2 className="animate-spin" /> : confirmLabel}
  </AlertDialogAction>
```

### When to Apply

- Any dialog with async operations (confirm, delete, publish)
- Forms that make API calls
- Multi-step wizards with async validation
- Anywhere `onConfirm` is a Promise (not synchronous)

### Related Code

- Lines 54, 62-71 in ConfirmDialog.tsx (loading state + async wrapper)
- Lines 74, 81-86 in dialog configuration (disabled state + UI feedback)
- Lines 88-96 (loading spinner in button)

### Prevention Strategy

- Always check if callback is async (returns Promise)
- Never call `onOpenChange()` without awaiting callback first
- Show loading state in button/spinner while operation pending
- Add test: verify dialog stays open until operation completes
- Add test: verify failed operation keeps dialog open for retry

---

## Pattern 4: Capability Registry Hygiene

**Issue:** #682, #683

### Problem

Two types of mismatch that break agent capabilities:

**Missing Backend Tool:**

- UI declares capability (`highlight_section`)
- Tool handler tries to call tool
- Backend never implemented the tool → 404 or undefined behavior

**Dead Code in Registry:**

- Tool declared but no backend implementation
- UI shows capability user can't use
- Agent wastes tokens trying to call missing feature

### Solution

Maintain bidirectional alignment between capabilities and tools:

```typescript
// In capabilities registry (what agent CAN do)
export const capabilities = {
  // ✅ HAS backend implementation
  get_services: {
    /* ... */
  },
  check_availability: {
    /* ... */
  },
  highlight_section: {
    /* ... */
  }, // Matches server tool

  // ❌ REMOVE if no backend tool
  // update_business_info: { /* ... */ }, // Dead code
};

// In backend (server/src/agent/tools/)
export const REQUIRED_EXECUTOR_TOOLS = [
  'get_services',
  'check_availability',
  'book_service',
  'highlight_section', // ← Matches registry
];
```

### When to Apply

- Adding any new agent tool (capability → backend → frontend)
- Removing tools (clean up registry to match)
- Auditing agent features (verify all capabilities have backends)
- Code review (check bidirectional alignment)

### Related Code

- Capability registry: `apps/web/src/lib/build-mode/capabilities.ts`
- Backend tools: `server/src/agent/tools/`
- Startup validation: `server/src/agent/` (verifies REQUIRED_EXECUTOR_TOOLS)

### Prevention Strategy

- During tool implementation: simultaneously add capability AND backend handler
- Code review checklist: "Does capability have matching backend tool?"
- Code review checklist: "Are all backend tools declared in capabilities?"
- Use shared constants (copy capability names exactly from registry)
- Startup validation: log warning if capability missing backend handler
- Test: Call each capability from agent and verify backend processes it

---

## Pattern 5: Singleton Pattern Documentation

**Issue:** #684

### Problem

Module-level refs/singletons are necessary for store access outside React, but lack explanation. Future maintainers might:

- Try to convert to hooks (violates Rules of Hooks)
- Move to class constructor (can't be called outside React)
- Not understand WHY the pattern exists

### Solution

Document module-level singletons with clear explanation:

```typescript
// ============================================
// EXPOSED ACTIONS - For agent tool handlers (outside React)
// ============================================

/**
 * Agent UI actions accessible outside React components
 *
 * These allow agent tool handlers in the chat response processing
 * to control the UI without needing React hooks.
 *
 * WHY SINGLETONS?
 * - Zustand store is a closure - we access via getState()
 * - Agent tools are called outside React context (callbacks, event handlers)
 * - Can't use hooks outside React - must use module-level reference
 * - This is the only way to sync agent state → UI from non-React code
 *
 * @example
 * // In agent response handler:
 * if (response.uiAction?.type === 'SHOW_PREVIEW') {
 *   agentUIActions.showPreview(response.uiAction.page, sessionId);
 * }
 */
export const agentUIActions = {
  showPreview: (page?: PageName, agentSessionId?: string | null) =>
    useAgentUIStore.getState().showPreview(page, agentSessionId),

  // ... rest of actions
};
```

### When to Apply

- Any module-level singleton (not constructor-based)
- Service locators / dependency injection antipatterns
- Global state accessed from non-React code
- Non-obvious design decisions that might be questioned in review

### Related Code

- Lines 461-501 in agent-ui-store.ts (exposed actions with explanation)
- agent-ui-store.ts lines 1-19 (module header with context)

### Prevention Strategy

- Always explain WHY singleton is necessary
- Document constraints (non-React context, outside hooks)
- Provide example of how it's used
- Note maintenance considerations (can't easily test, global state)
- Link to related patterns (`useAgentUIStore`, `selectViewStatus`)
- Add to code review checklist: "Are singletons well-documented?"

---

## Quick Checklist for Code Review

When reviewing agent-ui or build-mode features, check:

- [ ] **FIFO Buffers:** Unbounded arrays have MAX_SIZE constant and shift() logic
- [ ] **Debounce Cancellation:** Hooks exporting cancellation function for critical ops
- [ ] **Async Dialogs:** Dialogs showing loading state and only closing on success
- [ ] **Capability Alignment:** UI capabilities match backend tools bidirectionally
- [ ] **Singleton Documentation:** Module-level state has clear explanation
- [ ] **Tests:** Each pattern has test coverage (memory leaks, race conditions, async flow)
- [ ] **Type Safety:** Discriminated unions prevent impossible states

---

## Related Patterns

- **[build-mode-storefront-editor-patterns.md](build-mode-storefront-editor-patterns-MAIS-20260105.md)** - Agent parity, DRY schemas, PostMessage validation
- **[DUAL_MODE_ORCHESTRATOR_QUICK_REFERENCE.md](DUAL_MODE_ORCHESTRATOR_QUICK_REFERENCE.md)** - Consistent mode checking across methods
- **[AGENT_TOOLS_PREVENTION_INDEX.md](AGENT_TOOLS_PREVENTION_INDEX.md)** - Master index for agent tool patterns

---

## Prevention Strategy Tags

- **P1 (Critical):** FIFO buffer + async dialog (can cause data corruption or memory leak)
- **P2 (High):** Debounce cancellation (race conditions)
- **P3 (Medium):** Capability alignment + singletons (broken features, confusion)

---

## Commits Using These Patterns

Commits that applied these patterns:

- TBD (Phase 5 fixes #678-686)

Reference these commits when implementing similar features.
