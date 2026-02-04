# PostMessage Communication - Quick Reference

**Print and pin this guide. Use when adding PostMessage-based features.**

## The Problem in 10 Seconds

Handler code exists but sender code doesn't → "zombie code" that looks used but never runs.

**Symptom:** Debugging a feature and finding handler case statements with no corresponding `postMessage()` call.

## 3-Minute Verification Checklist

Before committing PostMessage code, run these 3 commands:

### 1. List all defined message types

```bash
grep "z\.literal(" apps/web/src/lib/build-mode/protocol.ts | grep -o "'[^']*'" | sort -u
```

### 2. For EACH message type, verify sender exists

```bash
# Template: Replace MESSAGE_TYPE
MESSAGE_TYPE="BUILD_MODE_INIT"
git grep "$MESSAGE_TYPE" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -v "protocol.ts" | grep -v "case '"

# Should return ≥1 result showing postMessage() call
# If only handler exists → DEAD CODE
```

### 3. Verify all listeners have origin checks

```bash
grep -A5 "addEventListener.*message" apps/web/src/hooks/useBuildModeSync.ts | \
  grep "isSameOrigin\|origin"

# Should find: if (!isSameOrigin(event.origin)) return;
```

## The Sender/Handler Pair Pattern

**Every message type needs BOTH:**

```typescript
// 1. DEFINE in protocol.ts
export const MyMessageSchema = z.object({
  type: z.literal('MY_MESSAGE'),
  data: z.object({ value: z.string() }),
});

// 2. SENDER somewhere (e.g., parent.tsx)
parent.postMessage({ type: 'MY_MESSAGE', data: { value: 'hello' } }, origin);

// 3. HANDLER somewhere (e.g., useBuildModeSync.ts)
case 'MY_MESSAGE':
  handleMyMessage(message.data);
  break;
```

❌ **BAD:** Only 1 and 3 (handler without sender)
❌ **BAD:** Only 1 and 2 (sender without handler)
✅ **GOOD:** All three in one commit

## If You Find Dead Code

```bash
# Find message types with handlers but no senders
for msg in $(grep "case '" apps/web/src/hooks/useBuildModeSync.ts | \
  sed "s/.*case '//" | sed "s/'.*//"); do
  if ! git grep "$msg" apps/web/src --include="*.ts" --include="*.tsx" | \
    grep -qv "useBuildModeSync.ts" | grep -qv "protocol.ts"; then
    echo "DEAD: $msg"
  fi
done
```

## Security Checklist

- [ ] All listeners call `isSameOrigin(event.origin)` FIRST
- [ ] All listeners call `parseMessage()` with Zod validation SECOND
- [ ] Origin passed to `postMessage()` is correct (`window.location.origin` or iframe's origin)
- [ ] No sensitive data in postMessage (it can be intercepted)
- [ ] Message types are in a central registry (not scattered strings)

## Common Pitfalls

| Pitfall                                 | Fix                                                 |
| --------------------------------------- | --------------------------------------------------- |
| `postMessage()` string instead of type  | Use `MESSAGE_TYPES.CONSTANT` or Zod type            |
| Handler exists, sender doesn't          | Delete handler or implement sender (same commit)    |
| Forgot origin validation                | Add `if (!isSameOrigin(...)) return;` as FIRST line |
| Message type defined but never used     | Prefix with `_PLANNED_` and document why, or delete |
| Duplicate implementations (index vs ID) | Mark old as `_DEPRECATED_`, create migration plan   |
| Test doesn't verify round trip          | Add MessageEvent dispatch in test                   |

## Registry Pattern

Keep a central file for all message type definitions:

```typescript
// lib/build-mode/message-types.ts
export const BUILD_MODE = {
  INIT: 'BUILD_MODE_INIT',
  CONFIG_UPDATE: 'BUILD_MODE_CONFIG_UPDATE',
  HIGHLIGHT_BY_ID: 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID',
  CLEAR_HIGHLIGHT: 'BUILD_MODE_CLEAR_HIGHLIGHT',
  READY: 'BUILD_MODE_READY',
  SECTION_SELECTED: 'BUILD_MODE_SECTION_SELECTED',
  PAGE_CHANGED: 'BUILD_MODE_PAGE_CHANGE',
} as const;
```

Then grep becomes easier:

```bash
git grep "BUILD_MODE\.INIT" apps/web/src  # Find all usages
```

## Testing Message Round Trip

```typescript
it('should handle HIGHLIGHT_BY_ID message', async () => {
  const { result } = renderHook(() => useBuildModeSync());

  // Simulate parent sending highlight message
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID', data: { sectionId: 'hero' } },
        origin: window.location.origin,
      })
    );
  });

  // Verify handler processed it
  expect(result.current.highlightedSectionId).toBe('hero');
});
```

## Yearly Audit (15 minutes)

```bash
# Run this quarterly to find dead code
cd /path/to/MAIS

echo "=== Dead PostMessage Detector ==="

DEFINED=$(grep "z\.literal(" apps/web/src/lib/build-mode/protocol.ts | \
  grep -o "'[^']*'" | tr -d "'" | sort -u)

for type in $DEFINED; do
  HANDLER_COUNT=$(grep -c "case '$type'" apps/web/src/hooks/useBuildModeSync.ts apps/web/src/components/preview/PreviewPanel.tsx 2>/dev/null || echo 0)
  SENDER_COUNT=$(git grep "$type" apps/web/src --include="*.ts" --include="*.tsx" | \
    grep -v "protocol.ts" | grep -v "case '" | wc -l)

  if [ "$SENDER_COUNT" -eq 0 ] && [ "$HANDLER_COUNT" -gt 0 ]; then
    echo "❌ DEAD: $type (handler exists, no sender)"
  elif [ "$SENDER_COUNT" -gt 0 ] && [ "$HANDLER_COUNT" -eq 0 ]; then
    echo "⚠️  ORPHAN: $type (sender exists, no handler)"
  elif [ "$SENDER_COUNT" -gt 0 ] && [ "$HANDLER_COUNT" -gt 0 ]; then
    echo "✓ ACTIVE: $type"
  fi
done
```

## Related Full Documentation

- `docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md` - Complete strategy
- `docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md` - Central registry
- Completed Issue: `todos/archive/821-complete-p2-dead-postmessage-types.md`

## In CLAUDE.md Pitfalls

**Pitfall #97 - Dead PostMessage Handlers:**

"Message type defined in protocol and handler implemented but sender never calls postMessage(); symptom: looking at handler code that appears used but grep finds only handler case statement and no postMessage() call; prevention: for every message type added, immediately implement sender in same commit, run the 3-command verification checklist, use MESSAGE_TYPES registry. See DEAD_POSTMESSAGE_HANDLER_PREVENTION.md"
