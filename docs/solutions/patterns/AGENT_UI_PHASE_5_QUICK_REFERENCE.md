# Agent UI Phase 5 Patterns - Quick Reference

**Print & Pin This** (1 min read)

---

## Pattern 1: FIFO Buffer for Long Sessions

```typescript
const MAX_ACTION_LOG_SIZE = 100;

// After push
state.actionLog.push(action);
if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
  state.actionLog.shift(); // Remove oldest
}
```

**When:** Unbounded arrays that accumulate (logs, history)

---

## Pattern 2: Cancel Debounced Saves Before Critical Ops

```typescript
const debounceRef = useRef<ReturnType<typeof setTimeout>>();

const cancelPendingSave = useCallback(() => {
  if (debounceRef.current) {
    clearTimeout(debounceRef.current);
    debounceRef.current = undefined;
  }
}, []);

// In component:
await useDraftAutosave.cancelPendingSave();
await draftAutosave.publishDraft();
```

**When:** Debounced operations that can race with other actions

---

## Pattern 3: Async Dialogs Show Loading, Close on Success

```typescript
const [isLoading, setIsLoading] = useState(false);

const handleConfirm = async () => {
  setIsLoading(true);
  try {
    await onConfirm(); // Wait for it
    onOpenChange(false); // Only close on success
  } finally {
    setIsLoading(false);
  }
};

// In JSX:
<Button disabled={isLoading}>
  {isLoading ? <Spinner /> : 'Confirm'}
</Button>
```

**When:** Dialog has async operation (publish, delete, confirm)

---

## Pattern 4: Capability → Backend Tool Alignment

```typescript
// capabilities.ts - What UI can ask agent to do
export const capabilities = {
  highlight_section: {
    /* ... */
  }, // ✅ Has backend
  // update_business_info: REMOVED // ❌ No backend
};

// server/src/agent/tools/ - Backend implementations
export const REQUIRED_EXECUTOR_TOOLS = [
  'highlight_section', // ← Matches registry
];
```

**When:** Adding/removing agent tools

**Code review:** Do ALL capabilities have backends? Do ALL backend tools have capabilities?

---

## Pattern 5: Document Module-Level Singletons

```typescript
/**
 * Agent UI actions accessible outside React components
 *
 * WHY SINGLETONS?
 * - Called outside React context (can't use hooks)
 * - Zustand store accessed via getState()
 * - Only way to sync agent state → UI from non-React code
 */
export const agentUIActions = {
  showPreview: (page?: PageName) => useAgentUIStore.getState().showPreview(page),
};
```

**When:** Module-level state accessed from non-React code

---

## Code Review Checklist

- [ ] MAX_SIZE constant + shift() for growing arrays?
- [ ] Debounce cancel function exported?
- [ ] Dialogs show loading + only close on success?
- [ ] All capabilities have backend tools?
- [ ] Singletons documented (why needed)?
- [ ] Tests cover memory leaks, race conditions, async flow?

---

## Related Files

- Full guide: `docs/solutions/patterns/AGENT_UI_PHASE_5_CODE_REVIEW_PATTERNS.md`
- Agent tools index: `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md`
