# Dead PostMessage Handler Prevention Strategy

**Status:** Prevention strategy for resolved issue #821
**Last Updated:** 2026-02-04
**Categories:** Code Maintenance, Type Safety, Dead Code Detection

## Problem Summary

PostMessage-based communication creates "zombie code" where message handlers exist without senders, or senders exist without handlers. This bloats the codebase and confuses future developers about what actually runs.

**Symptoms:**

- Message type defined in protocol but never called
- Handler in listener but corresponding sender doesn't exist
- Duplicate implementations of the same feature (e.g., index-based and ID-based highlighting)
- ~40% of PostMessage code may be unused

**Example from MAIS Build Mode (Issue #821):**

```typescript
// protocol.ts - DEFINED but never called
export const BUILD_MODE_SECTION_EDIT = z.object({
  type: z.literal('BUILD_MODE_SECTION_EDIT'),
  // ...
});

// useBuildModeSync.ts - HANDLER exists
case 'BUILD_MODE_SECTION_EDIT':
  // Handle edit message
  break;

// PreviewPanel.tsx - SENDER doesn't call this
// No place in the codebase calls: iframe.postMessage({ type: 'BUILD_MODE_SECTION_EDIT' })
```

## Root Causes

1. **Speculative Development:** Features built "for Phase 4/5" without product confirmation
2. **Incomplete Refactoring:** Old implementation kept for backward compat, new implementation added, neither removed
3. **Missing Verification:** No tooling to cross-verify senders and handlers
4. **Lazy Cleanup:** Dead code feels safer to leave than delete

## Prevention Checklist

Use this checklist when adding PostMessage-based communication to any feature.

### Before Coding

- [ ] Document message types in a shared constants file (e.g., `protocol.ts`)
- [ ] Write down in comments why EACH message type is needed
- [ ] Link comments to issue/story describing the feature
- [ ] If a message is "for future use," prefix name with `_PLANNED_` (e.g., `_PLANNED_INLINE_EDIT`)
- [ ] Get product sign-off on timeline before implementing

### While Coding

- [ ] Create message schema in protocol file first
- [ ] Immediately implement BOTH sender and handler in the same commit
- [ ] Never merge code with unimplemented message types
- [ ] Add TypeScript types to ensure sender/handler signatures match
- [ ] Add tests for message round-trip (send → handle → verify)

### During Review

- [ ] Run the **Dead Message Grep** (see below) and verify all types have senders
- [ ] Check for deprecated message types (index-based vs ID-based)
- [ ] Verify origin validation is present in all listeners
- [ ] Verify Zod validation is present in all message parsing

### After Merge

- [ ] Add message type to `docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md`
- [ ] Mark as "active" (has sender + handler) or "deprecated"
- [ ] Set audit reminder (quarterly check for dead code)

## Grep Patterns for Auditing PostMessage Code

### Pattern 1: Find all message types defined in protocol

```bash
# List all defined message types
grep -n "z\.literal(" apps/web/src/lib/build-mode/protocol.ts | grep "BUILD_MODE"
```

**Expected output:**

```
24:  type: z.literal('BUILD_MODE_INIT'),
34:  type: z.literal('BUILD_MODE_CONFIG_UPDATE'),
49:  type: z.literal('BUILD_MODE_HIGHLIGHT_SECTION_BY_ID'),
59:  type: z.literal('BUILD_MODE_CLEAR_HIGHLIGHT'),
```

### Pattern 2: Verify senders exist for each type

For each message type, verify it's called somewhere:

```bash
# Template: Check if BUILD_MODE_HIGHLIGHT_SECTION_BY_ID is sent anywhere
git grep "BUILD_MODE_HIGHLIGHT_SECTION_BY_ID" apps/web/src --include="*.ts" --include="*.tsx" | grep -v protocol.ts | grep -v "case '"

# Should return at least one result like:
# apps/web/src/components/preview/PreviewPanel.tsx:269:highlightMessage = { type: 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID', ...}
```

**For each message type:**

1. Extract type name from protocol
2. Run: `git grep "MESSAGE_TYPE_NAME" apps/web/src --include="*.ts" --include="*.tsx"`
3. Exclude `protocol.ts` and handler case statements
4. If only handler exists → **DEAD CODE** ✓

### Pattern 3: Verify handlers exist for each sender

```bash
# Find all message type case statements in handler
grep -n "case '" apps/web/src/hooks/useBuildModeSync.ts

# Find all message type case statements in PreviewPanel listener
grep -n "case '" apps/web/src/components/preview/PreviewPanel.tsx
```

### Pattern 4: Detect duplicate implementations

```bash
# Look for similar message type names (index-based and ID-based)
grep "z\.literal(" apps/web/src/lib/build-mode/protocol.ts | \
  awk '{print $2}' | \
  sort | \
  uniq -d
```

**If duplicates found:** Identify which is deprecated and create migration plan.

### Pattern 5: Check for `_PLANNED_` or `_FUTURE_` prefixes (should be few)

```bash
git grep "_PLANNED_\|_FUTURE_\|_DEPRECATED_" apps/web/src/lib/build-mode/ --include="*.ts"
```

Should return few results (< 3). If more than that, audit why they're not removed.

## Automated Detection Rules (ESLint)

Add these rules to catch dead PostMessage handlers at lint time.

### Rule 1: Require Message Handler for Each Type

Create `eslint-plugin-postmessage-handler`:

```javascript
// eslint-plugin-postmessage-handler.js
module.exports = {
  rules: {
    'require-handler-for-message-type': {
      create(context) {
        const definedTypes = new Set();
        const handledTypes = new Set();

        return {
          // Collect all defined message types from protocol.ts
          'CallExpression[callee.property.name="literal"]'(node) {
            if (node.arguments[0]?.value) {
              definedTypes.add(node.arguments[0].value);
            }
          },

          // Collect all case statements that handle messages
          SwitchCase(node) {
            if (node.test?.value) {
              handledTypes.add(node.test.value);
            }
          },

          // At EOF, report defined types with no handler
          'Program:exit'() {
            for (const type of definedTypes) {
              if (!handledTypes.has(type)) {
                context.report({
                  message: `Message type "${type}" is defined but has no handler case statement`,
                });
              }
            }
          },
        };
      },
    },
  },
};
```

**Enable in .eslintrc:**

```json
{
  "plugins": ["postmessage-handler"],
  "rules": {
    "postmessage-handler/require-handler-for-message-type": "warn"
  }
}
```

### Rule 2: Require Origin Validation in Listeners

```javascript
module.exports = {
  rules: {
    'require-origin-check-in-listener': {
      create(context) {
        return {
          'CallExpression[callee.property.name="addEventListener"][arguments.0.value="message"]'(
            node
          ) {
            const handler = node.arguments[1];
            const hasOriginCheck = handler.body.body.some(
              (stmt) => stmt.expression?.callee?.property?.name === 'isSameOrigin'
            );

            if (!hasOriginCheck) {
              context.report({
                node,
                message: 'Message listener must call isSameOrigin(event.origin) for security',
              });
            }
          },
        };
      },
    },
  },
};
```

## Best Practices for PostMessage Protocols

### 1. Central Registry Pattern

Keep a single source of truth for message types:

```typescript
// lib/build-mode/message-types.ts
export const MESSAGE_TYPES = {
  // Parent → Iframe
  INIT: 'BUILD_MODE_INIT',
  CONFIG_UPDATE: 'BUILD_MODE_CONFIG_UPDATE',
  HIGHLIGHT_BY_ID: 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID',
  CLEAR_HIGHLIGHT: 'BUILD_MODE_CLEAR_HIGHLIGHT',

  // Iframe → Parent
  READY: 'BUILD_MODE_READY',
  SECTION_SELECTED: 'BUILD_MODE_SECTION_SELECTED',
  PAGE_CHANGED: 'BUILD_MODE_PAGE_CHANGE',
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];
```

**Benefits:**

- Single place to add new message types
- Easy to see full API surface
- Easier to grep (search `MESSAGE_TYPES`)
- Easier to add validation rules

### 2. Sender/Handler Pair Pattern

Always implement sender and handler in the same file section:

```typescript
// PreviewPanel.tsx

// ============================================================================
// Message: HIGHLIGHT_SECTION_BY_ID (Parent → Iframe)
// ============================================================================

// SENDER
const sendHighlightMessage = (sectionId: string) => {
  if (!iframeRef.current?.contentWindow) return;
  iframeRef.current.contentWindow.postMessage(
    { type: MESSAGE_TYPES.HIGHLIGHT_BY_ID, data: { sectionId } },
    window.location.origin
  );
};

// HANDLER
const handleHighlightMessage = (sectionId: string) => {
  setHighlightedSectionId(sectionId);
  const element = document.querySelector(`[data-section-id="${sectionId}"]`);
  element?.scrollIntoView({ behavior: 'smooth' });
};

// TRIGGER (usage)
useEffect(() => {
  if (highlightedSectionId) {
    sendHighlightMessage(highlightedSectionId);
  }
}, [highlightedSectionId]);
```

### 3. Message Round-Trip Testing

Test that messages survive the round trip:

```typescript
// useBuildModeSync.test.ts
describe('BUILD_MODE_HIGHLIGHT_BY_ID message round trip', () => {
  it('should send and handle highlight message', async () => {
    const { result } = renderHook(() => useBuildModeSync({ enabled: true }));

    // Simulate receiving highlight message from parent
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID',
            data: { sectionId: 'home-hero-main' },
          },
          origin: window.location.origin,
        })
      );
    });

    // Verify state updated
    expect(result.current.highlightedSectionId).toBe('home-hero-main');
  });
});
```

### 4. Deprecation Process

When removing a message type, don't just delete it:

```typescript
// protocol.ts

/**
 * DEPRECATED: BUILD_MODE_HIGHLIGHT_SECTION (index-based)
 *
 * Replaced by: BUILD_MODE_HIGHLIGHT_SECTION_BY_ID (ID-based)
 * Reason: IDs are stable across section reordering
 * Migration: Remove all callers of this message type
 * Removal date: 2026-03-01 (if no usage found)
 *
 * Still handled for backward compat with old clients
 * but should not be used in new code.
 */
export const BuildModeHighlightSectionSchema = z.object({
  type: z.literal('BUILD_MODE_HIGHLIGHT_SECTION'),
  data: z.object({
    sectionIndex: z.number().int().min(0),
  }),
});
```

Then at deprecation deadline:

1. Search codebase for usages
2. If none found, remove schema
3. If found, update migration plan
4. Update todo tracking

## Message Registry Template

Create `/docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md`:

```markdown
# PostMessage Message Registry

## Build Mode Protocol (`apps/web/src/lib/build-mode/protocol.ts`)

| Message Type                       | Direction       | Status | Handler | Sender           | Notes                             |
| ---------------------------------- | --------------- | ------ | ------- | ---------------- | --------------------------------- |
| BUILD_MODE_INIT                    | Parent → Iframe | Active | ✓       | PreviewPanel     | Configuration sync on startup     |
| BUILD_MODE_CONFIG_UPDATE           | Parent → Iframe | Active | ✓       | PreviewPanel     | Configuration updates during edit |
| BUILD_MODE_HIGHLIGHT_SECTION_BY_ID | Parent → Iframe | Active | ✓       | PreviewPanel     | ID-based section highlighting     |
| BUILD_MODE_CLEAR_HIGHLIGHT         | Parent → Iframe | Active | ✓       | PreviewPanel     | Remove section highlight          |
| BUILD_MODE_READY                   | Iframe → Parent | Active | ✓       | useBuildModeSync | Iframe readiness handshake        |
| BUILD_MODE_SECTION_SELECTED        | Iframe → Parent | Active | ✓       | useBuildModeSync | User clicked section              |
| BUILD_MODE_PAGE_CHANGE             | Iframe → Parent | Active | ✓       | useBuildModeSync | User navigated page               |

**Deprecated:**
| BUILD_MODE_HIGHLIGHT_SECTION | Parent → Iframe | Deprecated | ✓ | None | Use HIGHLIGHT_SECTION_BY_ID instead |

## Service Worker Protocol (`apps/web/src/components/pwa/ServiceWorkerRegistration.tsx`)

| Message Type | Direction     | Status | Handler | Sender                    |
| ------------ | ------------- | ------ | ------- | ------------------------- |
| SKIP_WAITING | Main → Worker | Active | ✓       | ServiceWorkerRegistration |
```

## Quarterly Audit Checklist

Run this every 3 months to catch new dead code:

```bash
#!/bin/bash
# scripts/audit-postmessage.sh

echo "=== Auditing PostMessage handlers ==="

# Find all message type definitions
echo "Defined message types:"
grep -r "z\.literal(" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -i "message\|type" | wc -l

# Find all case statements handling messages
echo "Handler case statements:"
grep -r "case '" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -i "message\|type" | wc -l

# Find all postMessage calls (senders)
echo "PostMessage calls (senders):"
grep -r "postMessage(" apps/web/src --include="*.ts" --include="*.tsx" | wc -l

# Find potentially unused message types
echo "Potentially dead message types:"
for type in $(grep -r "z\.literal(" apps/web/src/lib/build-mode/protocol.ts | \
  sed "s/.*z\.literal('//" | sed "s/'.*//"); do
  if ! grep -r "$type" apps/web/src --include="*.ts" --include="*.tsx" | \
    grep -qv "protocol.ts"; then
    echo "  - $type"
  fi
done
```

## Adding to CLAUDE.md Pitfalls

Propose as Pitfall #97:

```markdown
### PostMessage Handler Sync Pitfalls (97)

97. Dead PostMessage handlers without senders - Message type defined in protocol and handler implemented but sender never calls postMessage(); symptom: looking at handler code that appears used but grep finds only handler case statement; prevention: for every message type added, immediately implement sender in same commit, run grep pattern to verify both sender and handler exist, use central MESSAGE_TYPES registry to keep API surface visible. See `docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md`
```

## Quick Reference Commands

Print this and pin to your desk:

```bash
# Check if a message type has both sender and handler
MESSAGE_TYPE="BUILD_MODE_CONFIG_UPDATE"
echo "Checking: $MESSAGE_TYPE"
echo "Protocol definition:"
grep "$MESSAGE_TYPE" apps/web/src/lib/build-mode/protocol.ts | head -1

echo "Handler case statement:"
grep -r "case '$MESSAGE_TYPE'" apps/web/src --include="*.ts" --include="*.tsx"

echo "Senders (postMessage calls):"
git grep "$MESSAGE_TYPE" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -v "protocol.ts" | grep -v "case '"
```

## Example: Fixing the Build Mode Dead Code (Issue #821)

**Before (Dead Code):**

```typescript
// protocol.ts - 5 message types defined
export const BuildModeHighlightSectionSchema = z.object({...}); // DEPRECATED
export const BuildModeSectionEditSchema = z.object({...}); // DEAD
export const BuildModeSectionRenderedSchema = z.object({...}); // DEAD
// etc.

// useBuildModeSync.ts - handlers for ALL types
case 'BUILD_MODE_HIGHLIGHT_SECTION': { ... } // Handler but no sender
case 'BUILD_MODE_SECTION_EDIT': { ... } // Handler but no sender
case 'BUILD_MODE_SECTION_RENDERED': { ... } // Handler but no sender
```

**After (Prevention Applied):**

```typescript
// protocol.ts - Only ACTIVE message types
export const BuildModeInitSchema = z.object({...});
export const BuildModeConfigUpdateSchema = z.object({...});
export const BuildModeHighlightSectionByIdSchema = z.object({...});
export const BuildModeClearHighlightSchema = z.object({...});

// useBuildModeSync.ts - Handlers match senders exactly
case 'BUILD_MODE_INIT': { ... } // ✓ Sender: PreviewPanel
case 'BUILD_MODE_CONFIG_UPDATE': { ... } // ✓ Sender: PreviewPanel
case 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID': { ... } // ✓ Sender: PreviewPanel
case 'BUILD_MODE_CLEAR_HIGHLIGHT': { ... } // ✓ Sender: PreviewPanel

// PreviewPanel.tsx - All senders are explicit
iframe.postMessage({ type: 'BUILD_MODE_INIT', ... });
iframe.postMessage({ type: 'BUILD_MODE_CONFIG_UPDATE', ... });
iframe.postMessage({ type: 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID', ... });
iframe.postMessage({ type: 'BUILD_MODE_CLEAR_HIGHLIGHT' });
```

## Related Resources

- **Completed Issue:** `/todos/archive/821-complete-p2-dead-postmessage-types.md`
- **Protocol Files:**
  - `apps/web/src/lib/build-mode/protocol.ts`
  - `apps/web/src/hooks/useBuildModeSync.ts`
  - `apps/web/src/components/preview/PreviewPanel.tsx`
- **Message Registry Template:** `docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md`
