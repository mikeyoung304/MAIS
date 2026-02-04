---
title: Dead Code Detection - Sender/Receiver Pattern
date: 2026-02-04
status: complete
priority: p2
tags: [code-review, dead-code, technical-debt, prevention]
issue_ids: [821]
---

# Dead Code Detection: Sender/Receiver Pattern

## Context

Resolved TODO #821: Removed ~302 lines of dead PostMessage types from Build Mode protocol. The critical insight: **dead code detection must verify BOTH sender AND receiver**, not just one direction.

## Problem: Incomplete Dead Code Detection

When auditing code for dead functionality, developers often check only one direction:

```typescript
// ❌ Incomplete check (only looks for callers)
git grep "\.editSection" apps/web/**/*.tsx  // Returns 0 results
// Conclusion: "This export isn't used, delete it"

// ✅ Complete check (also verifies nothing receives the signal)
git grep "BUILD_MODE_SECTION_EDIT" apps/web/  // Check for message TYPE
git grep "case 'BUILD_MODE_SECTION_EDIT'" apps/web/  // Check for handler
```

**The Pattern in MAIS:**

```typescript
// protocol.ts - SENDER SIDE (never called)
export const BUILD_MODE_SECTION_EDIT = z.object({
  type: z.literal('BUILD_MODE_SECTION_EDIT'),
  sectionId: z.string(),
  content: z.string(),
});

// useBuildModeSync.ts - RECEIVER SIDE (handler exists)
case 'BUILD_MODE_SECTION_EDIT': {
  // Handler code exists even though nothing ever sends this message
  updateSection(message.sectionId, message.content);
  break;
}
```

Both sides exist but the SENDER is missing. This fooled casual code review because the handler code looks legitimate.

## Why This Happens

1. **Speculative implementation** - Features planned for "Phase 4/5" but never started
2. **Incomplete refactoring** - Migrated from PostMessage to different protocol, forgot to delete old schemas
3. **Unused feature branches** - Code was written, tested locally, then project changed direction
4. **Handler-first development** - Developers add handlers in anticipation of messages that never arrive

## Detection Methodology

### Step 1: Identify Message Types

Find all message type definitions in the protocol:

```bash
# For PostMessage pattern
grep -n "type: z.literal" apps/web/src/lib/build-mode/protocol.ts

# For generic Zod schemas with type field
grep -n "BUILD_MODE_" apps/web/src/lib/build-mode/protocol.ts | grep -E "export const|z.literal"
```

### Step 2: Verify Senders Exist

For each message type, find places where it's SENT:

```bash
# Method A: Search for postMessage calls
git grep "window.parent?.postMessage" apps/web/src/ | grep -i "section_edit"

# Method B: Search for exported sender functions
git grep "editSection" apps/web/src/hooks/
git grep "notifySectionRendered" apps/web/src/hooks/

# Method C: Check imports of message schemas
git grep "BUILD_MODE_SECTION_EDIT" apps/web/src/
```

**Finding:** In #821, no code ever called `editSection()` or posted `BUILD_MODE_SECTION_EDIT` messages.

### Step 3: Verify Handlers Receive Messages

For each message type, find where it's HANDLED:

```bash
# Method A: Search for case statements in handlers
grep -n "case 'BUILD_MODE_SECTION_EDIT'" apps/web/src/hooks/useBuildModeSync.ts

# Method B: Type guard checks
grep -n "message.type ===" apps/web/src/hooks/useBuildModeSync.ts | grep -i "section"

# Method C: Event listener setup
git grep "addEventListener.*message" apps/web/src/ --include="*.tsx" --include="*.ts"
```

**Critical insight:** Handler code existing doesn't prove messages are being sent - it's just defensive code that's unreachable.

### Step 4: Verify Integration Points

Check if the exported functions are actually called or just exported for export's sake:

```bash
# Search for ALL usages (not just in same file)
git grep "useBuildModeSync" apps/web/src/ --include="*.tsx"

# Check what hook consumers actually USE
git grep "const { editSection" apps/web/src/  // Should be 0 results if dead
git grep "const { notifySectionRendered" apps/web/src/  // Should be 0 results if dead
```

## Decision Matrix

| Sender | Receiver | Imported | Status     | Action          |
| ------ | -------- | -------- | ---------- | --------------- |
| ✅     | ✅       | ✅       | Used       | Keep            |
| ✅     | ✅       | ❌       | Dead       | Remove export   |
| ✅     | ❌       | ✅       | Incomplete | Remove handler  |
| ❌     | ✅       | ✅       | Dead       | **Remove both** |
| ❌     | ✅       | ❌       | Dead       | Remove handler  |
| ❌     | ❌       | ❌       | Dead       | Delete schema   |

**#821 fell into the last row:** No sender, handler exists, not imported = DEAD. Delete schema + handler.

## Real Example: #821 Resolution

### Before (Dead Code)

```typescript
// protocol.ts - 5 unused message types + 2 unused sender functions
export const BUILD_MODE_SECTION_EDIT = z.object({ ... });
export const BUILD_MODE_SECTION_RENDERED = z.object({ ... });
export const BUILD_MODE_HIGHLIGHT_SECTION = z.object({ ... });
export const BUILD_MODE_SECTION_UPDATE = z.object({ ... });
export const BUILD_MODE_PUBLISH_NOTIFICATION = z.object({ ... });

// useBuildModeSync.ts - handlers for all 5 types
const editSection = (sectionId: string, content: string) => { ... }; // NEVER CALLED
const notifySectionRendered = (sectionId: string) => { ... }; // NEVER CALLED
```

### Detection

```bash
# Step 1: Found 5 message types in protocol.ts
# Step 2: Verified no senders exist
git grep "editSection(" apps/web/src/  # 0 results
git grep "notifySectionRendered(" apps/web/src/  # 0 results

# Step 3: Found handlers exist
grep "case 'BUILD_MODE_SECTION_EDIT'" apps/web/src/hooks/useBuildModeSync.ts  # Found

# Step 4: Verified not imported anywhere
git grep "editSection" apps/web/src/ --include="*.tsx"  # 0 results
```

### After (Clean)

- Deleted 5 message schemas from protocol.ts
- Deleted 5 handlers from useBuildModeSync.ts
- Deleted 2 sender functions from hook exports
- **Result:** 228 lines removed from useBuildModeSync.ts (489→261 lines), ~85 lines from protocol.ts

## Prevention Strategy

### For Code Review

When reviewing code that adds message types or handlers, ask:

1. **Can I find the sender?** (git grep for postMessage call)
2. **Can I find imports of the sender?** (Check any component using the hook)
3. **Can I find callers of the hook function?** (Will handler ever be invoked?)

If any answer is "no," mark as speculative/planned and add clear comments.

### For Architecture

When designing PostMessage protocols:

1. **Define messages in protocol.ts**
2. **Implement senders in hooks (exportable functions)**
3. **Implement receivers in handlers (inside message switch)**
4. **Require: At least one component imports and calls the sender**

Missing any step = incomplete feature.

### For Refactoring

When replacing messaging systems:

1. **Verify migration is complete:** Search for all old message types
2. **Check both directions:** Senders AND handlers in the old system
3. **Look for leaks:** grep for old message type names in new code
4. **Clean up exports:** Remove sender functions that aren't called

## Application to Other Patterns

This sender/receiver methodology applies beyond PostMessage:

| Pattern            | Sender                      | Receiver           | Dead If...               |
| ------------------ | --------------------------- | ------------------ | ------------------------ |
| PostMessage API    | `window.parent.postMessage` | `addEventListener` | Sender unreachable       |
| Event emitters     | `emit('eventName')`         | `on('eventName')`  | Listeners never added    |
| Webhook handlers   | Webhook HTTP POST           | Route handler      | Handler never registered |
| Tool definitions   | Tool.call()                 | Tool.execute()     | No tool.call() anywhere  |
| React custom hooks | Component imports & calls   | Hook exports       | Hook exports unused      |
| API endpoints      | HTTP client calls           | Route handler      | Client code omitted      |

## Tools for Automation

### ESLint Rule Template

```typescript
// Rule: no-unimplemented-message-types
// Check: For each message type in protocol, verify sender exists

const protocol = parseFile('protocol.ts');
const messages = findZodLiterals(protocol);

for (const msg of messages) {
  const senderName = camelCase(msg.name);
  const senderExists = fileContains('useBuildModeSync.ts', senderName);
  const senderCalled = codebase.grep(senderName).length > 1; // >1 = definition + usage

  if (!senderExists) warn(`No sender for ${msg.name}`);
  if (senderExists && !senderCalled) warn(`Sender defined but never called: ${senderName}`);
}
```

### Manual Audit Checklist

```bash
# Quick dead code check (run on any hook/protocol file)
PROTOCOL_FILE="apps/web/src/lib/build-mode/protocol.ts"
HOOK_FILE="apps/web/src/hooks/useBuildModeSync.ts"

# Find all exported functions in hook
grep "^export const\|^const .* = (.*) =>" "$HOOK_FILE" | awk '{print $3}' | cut -d'=' -f1 | while read func; do
  usage_count=$(git grep "$func" apps/web/src/ --include="*.tsx" | grep -v "$HOOK_FILE" | wc -l)
  if [ "$usage_count" -eq 0 ]; then
    echo "❌ DEAD: $func (defined in hook but never called)"
  fi
done
```

## Key Learnings from #821

1. **Handler existence is not evidence of use** - Defensive code that will never execute
2. **Speculative features are code smell** - Features planned for future phases but never started
3. **Phase naming doesn't imply completion** - "Phase 4/5 features" were never integrated
4. **Audit both directions** - Sender unreachable = code is dead, even if receiver is elegant
5. **Build mode accumulated cruft** - Over time added 5 unused message types as scope expanded

## Related Issues

- **#823** (Event-source migration) - Similar pattern where table existed but wasn't used
- **Pitfall #73** (Dead audit modules) - Dead code that exports functions with <20% usage
- **ESLINT_PREVENTION_INDEX.md** - Automated dead code detection strategies

## Checklist for Dead Code Removal

- [ ] Identify message type or export in question
- [ ] Search for SENDERS of the message/export (Step 2)
- [ ] Search for RECEIVERS/handlers (Step 3)
- [ ] Search for IMPORTS/callers (Step 4)
- [ ] Use decision matrix to classify status
- [ ] If dead: Remove schema, handler, and sender function in same commit
- [ ] Compile and run tests - verify nothing broke
- [ ] Update barrel exports (index.ts files)
- [ ] Add to commit message: What patterns were removed, why they were dead

## References

- **Commit:** `90f5b265` - Resolved #821, #823, #815
- **Before:** `apps/web/src/hooks/useBuildModeSync.ts` (489 lines)
- **After:** `apps/web/src/hooks/useBuildModeSync.ts` (261 lines)
- **Impact:** ~228 lines removed + ~85 lines from protocol.ts

---

## TL;DR

Dead code is code with **no sender, no receiver, or no caller** across the system. Don't just check if a function is imported—verify it's **called** in actual code. When removing dead code, remove BOTH sides (schema + handler + sender) to avoid partial removal that confuses future developers.
