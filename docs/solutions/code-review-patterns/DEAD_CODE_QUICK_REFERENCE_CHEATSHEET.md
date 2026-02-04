---
title: Dead Code Detection Quick Reference
date: 2026-02-04
status: complete
priority: p2
tags: [cheat-sheet, code-review, dead-code]
---

# Dead Code Detection: Quick Reference

## The Core Insight

**Dead code isn't just "unused functions."** It's code with:

- **No sender** (nothing calls/triggers it)
- **No receiver** (nobody listens for it)
- **No importer** (not used anywhere)

All three must exist for code to be alive.

## 30-Second Check

```bash
# For message types / handlers:
git grep "FEATURE_NAME" .  # Check for message type
git grep "featureName" .   # Check for function name

# Results:
# 0 results = DEAD (delete it)
# 1 result only = Defined but not used (likely dead)
# 2+ results = Possibly alive (check manually)

# For React hooks:
git grep "useMyHook" .     # Check imports
# 0 results = DEAD (delete it)
```

## The Bidirectional Check

| You Find...             | Do This                                              | Result                       |
| ----------------------- | ---------------------------------------------------- | ---------------------------- |
| Handler but no sender   | Search for `window.postMessage`, `emit()`, HTTP POST | If nothing found = DEAD      |
| Function but no imports | Search for function name in `_all_ files`            | If only in definition = DEAD |
| Export but no usage     | Check exports from hook/module                       | If re-export only = DEAD     |

## Decision Tree

```
Code to evaluate:
├─ Can I find where it's CALLED/TRIGGERED?
│  ├─ YES → Continue below
│  └─ NO → DELETE (it's dead)
├─ Is the caller REACHABLE in actual code paths?
│  ├─ YES → Keep
│  └─ NO → DELETE (unreachable code)
└─ Is there a test that uses it?
   ├─ YES → Keep (at least for tests)
   └─ NO → Consider deleting if also unused in production
```

## Patterns to Check

### PostMessage Pattern (like #821)

```bash
# Handler defined
grep -n "case 'MESSAGE_TYPE'" file.ts

# Sender exists?
git grep "window.parent?.postMessage" app/  # Look for sender
git grep "messageSender\|sendMessage" hooks/  # Look for exported function

# Verdict: If handler exists but no sender = DELETE
```

### Event Emitters

```bash
# Handler defined
grep -n "\.on('event_name'" file.ts

# Emitter exists?
git grep "\.emit('event_name'" .

# Verdict: If on() exists but emit() doesn't = DELETE
```

### React Hooks

```bash
# Hook defined
grep -n "export const useMyHook" file.ts

# Used anywhere?
git grep "useMyHook" --include="*.tsx"

# Verdict: If exported but zero imports = DELETE
```

### Database Tables

```bash
# Table defined in schema
grep -n "model TableName" schema.prisma

# Used in code?
git grep "tableNameModel\|\.tableName" server/src/ --include="*.ts" | grep -v generated

# Has data?
SELECT COUNT(*) FROM table_name;  # Production DB

# Verdict: If never imported and 0 rows = DROP
```

## Red Flags

🚩 **Likely dead if any true:**

- [ ] Handler exists but searching for sender returns 0 results
- [ ] Function exported but imports it = just the definition
- [ ] Comments say "Phase 4/5" or "Future"
- [ ] Hasn't been committed to in 3+ months
- [ ] Complex logic but appears in no logs/traces
- [ ] Code path is conditional on flag that's always false
- [ ] Message type defined but no switch case for it
- [ ] No tests import or call this code

## Bash One-Liners

```bash
# Find all message handlers
grep -r "case '" src/  # PostMessage/event handlers

# Find all exported functions
grep "^export const\|^export function" src/lib/*.ts

# Find all imports of a specific function
git grep "useFeature" --include="*.tsx" | wc -l

# Likely dead exports (in a file)
# Loop through exports, count usages
grep "^export const" myfile.ts | awk '{print $3}' | cut -d'=' -f1 | while read fn; do
  count=$(git grep "$fn" --include="*.tsx" --include="*.ts" | grep -v myfile.ts | wc -l)
  if [ "$count" -eq 0 ]; then echo "DEAD: $fn"; fi
done
```

## From Recent #821

**The trap:** Build Mode had beautiful, complete PostMessage handlers...

```typescript
// Handler code looks legitimate:
case 'BUILD_MODE_SECTION_EDIT': {
  const { sectionId, content } = message;
  updateSection(sectionId, content);  // ← Looks active!
  break;
}
```

**But:** No code anywhere calls `window.parent.postMessage({ type: 'BUILD_MODE_SECTION_EDIT', ... })`

**Result:** Handler is unreachable dead code.

**Key insight:** Legitimate-looking code + zero senders = DEAD

## Cleanup Checklist

When deleting dead code:

- [ ] Verify zero senders/callers (grep -r)
- [ ] Remove schema/definition
- [ ] Remove handler/implementation
- [ ] Remove exports/bindings
- [ ] Remove any tests (they won't pass without the feature)
- [ ] Update barrel exports (index.ts)
- [ ] TypeScript compiles? Run `npm run typecheck`
- [ ] Tests pass? Run `npm test`
- [ ] Explain in commit message: What was dead, why it was deleted

## When to Keep "Dead" Code

**Exceptions:** Keep unused code if:

1. **Backward compatibility** - Client apps rely on it (document as @deprecated)
2. **Framework-required** - Next.js/Express needs the file to exist
3. **Plugin system** - Plugin interface that users implement
4. **Test doubles** - Mock implementations used by other tests
5. **Clearly documented** - Comments explain it's intentional fallback

Otherwise: **If it's not called, delete it.**

## Links to Detailed Patterns

- **Full methodology:** `DEAD_CODE_DETECTION_SENDER_RECEIVER_PATTERN.md`
- **Real example:** That file's "#821 Execution" section
- **Database cleanup:** `EVENT_SOURCING_TO_STATE_MIGRATION_PATTERN.md`
- **Batch cleanup:** `BATCH-CLEANUP-DEAD-CODE-UNUSED-TABLES-2026-02-04.md`

## TL;DR

Dead code = no sender, no receiver, or not called. Check all three directions. When in doubt, git grep for it. If you only find the definition, **it's dead—delete it.**
