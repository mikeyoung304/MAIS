---
module: MAIS
date: 2026-01-09
type: quick_reference
severity: P1-P2
tags: [code-review, cheat-sheet, prevention]
---

# Phase 5 Code Review Quick Reference (Print & Pin)

**5 Critical Patterns - 2 Minute Read**

---

## 1. Unbounded Arrays (Memory Leak)

```typescript
// ❌ BAD
state.actionLog.push(action); // Grows forever

// ✅ GOOD
const MAX_ACTION_LOG_SIZE = 100;
state.actionLog.push(action);
if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
  state.actionLog.shift();
}
```

**Question:** Does this array grow based on user actions? If yes → add MAX\_\* limit

---

## 2. Debounce Race Conditions

```typescript
// ❌ BAD
const handlePublish = () => {
  api.publishDraft(); // Autosave might fire AFTER publish
};

// ✅ GOOD
const { cancelPendingSave } = useDraftAutosave();
const handlePublish = async () => {
  cancelPendingSave(); // Cancel pending autosave FIRST
  await api.publishDraft();
};
```

**Question:** Does hook A have debounced ops AND hook B has destructive ops? If yes → call cancel

---

## 3. Capability/Tool Mismatch

```typescript
// ❌ BAD
// In capabilities
{ id: 'add_section', name: 'Add Section' }

// In tools
{ name: 'update_page_section', ... } // Different name!

// ✅ GOOD
// In capabilities
{ id: 'update_page_section', name: 'Add/Edit Section' }

// In tools (same name)
{ name: 'update_page_section', ... }
```

**Question:** Capability ID = actual tool name? If no → rename capability or create tool

---

## 4. Dialog Async Timing

```typescript
// ❌ BAD
const handleConfirm = () => {
  onConfirm(); // May be async
  onOpenChange(false); // Close immediately
};

// ✅ GOOD
const handleConfirm = async () => {
  try {
    await onConfirm(); // Wait for completion
    onOpenChange(false); // Close AFTER success
  } catch (err) {
    // Dialog stays open, error visible
  }
};
```

**Question:** Is onConfirm async? If yes → await before closing

---

## 5. Undocumented Singletons

```typescript
// ❌ BAD - No docs
export function searchCapabilities(query: string) {}
// Used nowhere! Is this scaffolding or dead code?

// ✅ GOOD - Clear docs
/**
 * Search capabilities by keyword.
 * @internal - Prepared for Phase 6 command palette (not yet used)
 */
export function searchCapabilities(query: string) {}
```

**Question:** Is this function used in production? If no → mark as @internal/@deprecated or document as scaffolding

---

## Code Review Checklist (30 seconds)

Before approving:

- [ ] Arrays have MAX\_\*\_SIZE limits?
- [ ] Pending debounced ops cancelled before publish/delete?
- [ ] Capability IDs match tool names?
- [ ] Dialogs await async before closing?
- [ ] Unused functions marked as scaffolding?

---

## Bash Audit Scripts

```bash
# 1. Find unbounded array pushes
grep -r "\.push(" apps/web/src --include="*.tsx" | grep -v MAX_ | wc -l

# 2. Check capability/tool matching
grep "id: '" apps/web/src/lib/agent-capabilities.ts | cut -d"'" -f2 > /tmp/caps
grep "name: '" server/src/agent/tools/ -r | cut -d"'" -f2 > /tmp/tools
comm -23 /tmp/caps /tmp/tools  # Orphaned capabilities

# 3. Find unused exports
grep "export function" apps/web/src/lib/ -r | while read line; do
  func=$(echo "$line" | sed "s/.*function //; s/(.*//")
  grep -r "$func" apps/web/src --include="*.tsx" | grep -v "^$line" >/dev/null || echo "UNUSED: $func"
done
```

---

## Prevention Flow (When You Code)

```
Writing new code?
├─ New array? → Add MAX_SIZE
├─ New debounce hook? → Export cancel
├─ New capability? → Verify tool exists
├─ New dialog? → Await async before close
└─ New utility? → Add JSDoc + mark scaffolding

Reviewing code?
├─ Is array bounded? ✓
├─ Are ops coordinated? ✓
├─ Do IDs match? ✓
├─ Does dialog wait? ✓
└─ Is purpose documented? ✓
```

---

## Full Docs

See `PHASE_5_CODE_REVIEW_PREVENTION_STRATEGIES.md` for:

- Complete patterns
- Decision trees
- Implementation examples
- Code review questions
- Detailed checklists
