# Dead PostMessage Type Detection Pattern

**Date:** 2026-02-04
**Session:** Code Review Todo Resolution (#821)
**Status:** Extraction Complete
**Pattern Value:** HIGH - Detects dead code that handlers mask

## Problem Statement

Build Mode's `protocol.ts` defined message types with corresponding handler functions in `useBuildModeSync.ts`, but **some types were received (had handlers) but never sent**. This is a dangerous code smell because:

1. **Handlers mask deadness** - A handler function exists, making the type appear "used"
2. **Maintenance burden** - Dead types accumulate, increasing cognitive load
3. **False sense of completeness** - Type definitions exist for all scenarios, but some scenarios never actually happen
4. **Two-sided protocol verification needed** - You must verify BOTH sides (send + receive) to find dead types

## Investigation Pattern

### Step 1: Identify Protocol Types

List all message types defined in the schema:

```bash
grep -n "readonly type:" server/src/lib/build-mode/protocol.ts | head -20
```

Output:

```
13:    readonly type: "BUILD_MODE_INITIALIZE"
17:    readonly type: "BUILD_MODE_TOOL_USE"
21:    readonly type: "BUILD_MODE_CANCEL"
25:    readonly type: "BUILD_MODE_RESPONSE_OK"
29:    readonly type: "BUILD_MODE_RESPONSE_ERROR"
33:    readonly type: "BUILD_MODE_HIGHLIGHT_SECTION"        # SUSPICIOUS
37:    readonly type: "BUILD_MODE_SECTION_UPDATE"           # SUSPICIOUS
41:    readonly type: "BUILD_MODE_PUBLISH_NOTIFICATION"     # SUSPICIOUS
45:    readonly type: "BUILD_MODE_SECTION_EDIT"             # SUSPICIOUS
49:    readonly type: "BUILD_MODE_SECTION_RENDERED"         # SUSPICIOUS
```

### Step 2: Verify Type is SENT Anywhere

For each type, confirm it's actually sent (not just received):

```bash
# Search for literal type string being sent
grep -r "BUILD_MODE_HIGHLIGHT_SECTION" server/src/ --include="*.ts"

# Result: Only found in protocol.ts definition and handler
# Not found in any postMessage() calls
```

**Key search patterns:**

- `postMessage({ type: "TYPE_NAME"` - Common send pattern
- `.type: "TYPE_NAME"` - Object literal with type field
- `.type = "TYPE_NAME"` - Assignment pattern
- `"TYPE_NAME"` in string context (verify it's actual send, not just mention)

### Step 3: Verify Type Handler Exists

Confirm the type has a handler (to distinguish from completely unused types):

```bash
grep -n "BUILD_MODE_HIGHLIGHT_SECTION" apps/web/src/hooks/useBuildModeSync.ts
```

Output:

```
45:      case "BUILD_MODE_HIGHLIGHT_SECTION": {
46:        const { sectionId } = message.data as BuildModeMessage;
47:        // ... handler code
48:      }
```

### Step 4: Cross-Reference Both Directions

For a message type to be "alive," it must appear in BOTH:

1. **Send side** - `window.parent.postMessage({ type: "..." }, ...)` or `window.postMessage(...)`
2. **Receive side** - `case "..."` handler in message listener

Create a matrix:

| Type Name                       | Defined in protocol.ts | Sent Anywhere? | Handler Exists? | Status   |
| ------------------------------- | ---------------------- | -------------- | --------------- | -------- |
| BUILD_MODE_INITIALIZE           | ✓                      | ✓              | ✓               | ALIVE    |
| BUILD_MODE_TOOL_USE             | ✓                      | ✓              | ✓               | ALIVE    |
| BUILD_MODE_HIGHLIGHT_SECTION    | ✓                      | ✗              | ✓               | **DEAD** |
| BUILD_MODE_SECTION_UPDATE       | ✓                      | ✗              | ✓               | **DEAD** |
| BUILD_MODE_PUBLISH_NOTIFICATION | ✓                      | ✗              | ✓               | **DEAD** |

## Dead Types Found

### BUILD_MODE_HIGHLIGHT_SECTION

```typescript
// protocol.ts - DEFINED
export const buildModeHighlightSectionSchema = z.object({
  type: 'BUILD_MODE_HIGHLIGHT_SECTION',
  data: z.object({
    sectionId: z.string(),
  }),
});
```

```typescript
// useBuildModeSync.ts - HANDLER EXISTS but never receives this
case "BUILD_MODE_HIGHLIGHT_SECTION": {
  const { sectionId } = message.data as BuildModeMessage;
  setHighlightedSection(sectionId);
  break;
}
```

```bash
# RESULT: grep finds NO postMessage() calls with this type
grep -r "postMessage.*BUILD_MODE_HIGHLIGHT_SECTION" server/ apps/web/
# (empty result)
```

### Similar Analysis for:

- `BUILD_MODE_SECTION_UPDATE` - Handler exists, no sends
- `BUILD_MODE_PUBLISH_NOTIFICATION` - Handler exists, no sends
- `BUILD_MODE_SECTION_EDIT` - Handler exists, no sends
- `BUILD_MODE_SECTION_RENDERED` - Handler exists, no sends

## Remediation Steps

### Step 1: Remove from Type Union

In `protocol.ts`:

```typescript
// BEFORE: Union includes dead types
export type BuildModeMessage =
  | z.infer<typeof buildModeInitializeSchema>
  | z.infer<typeof buildModeHighlightSectionSchema> // DELETE
  | z.infer<typeof buildModeSectionUpdateSchema> // DELETE
  | z.infer<typeof buildModePublishNotificationSchema>; // DELETE
// ... etc

// AFTER: Only include types that are actually sent/received
export type BuildModeMessage =
  | z.infer<typeof buildModeInitializeSchema>
  | z.infer<typeof buildModeToolUseSchema>
  | z.infer<typeof buildModeCancelSchema>;
// ... (only alive types)
```

### Step 2: Remove Type Schema Definition

Delete the entire schema definition:

```typescript
// DELETE THIS ENTIRE BLOCK
export const buildModeHighlightSectionSchema = z.object({
  type: 'BUILD_MODE_HIGHLIGHT_SECTION',
  data: z.object({
    sectionId: z.string(),
  }),
});
```

### Step 3: Remove Handler Case

In `useBuildModeSync.ts`:

```typescript
// BEFORE
case "BUILD_MODE_HIGHLIGHT_SECTION": {
  const { sectionId } = message.data as BuildModeMessage;
  setHighlightedSection(sectionId);
  break;
}

// AFTER: Delete entire case block
```

### Step 4: Verify TypeScript Catches Exhaustion

TypeScript will error if any send-side code tries to send a deleted type. Test by temporarily commenting out a live type's handler - you'll see:

```
error TS2339: Property 'type' does not exist on type 'never'.
```

This is your verification that the case statement is exhaustive.

## File Metrics Before/After

### protocol.ts

```
BEFORE: 260 lines (9 message type schemas, 9 in union)
AFTER:  177 lines (4 message type schemas, 4 in union)
Reduction: -83 lines (-32%)
```

### useBuildModeSync.ts

```
BEFORE: 489 lines (handler cases for all 9 types)
AFTER:  270 lines (handler cases for 4 types)
Reduction: -219 lines (-45%)
```

**Total reduction:** 302 lines of dead code removed

## Key Insights

### Why This Pattern Works

1. **Two-sided verification** - Confirms both sender AND receiver exist
2. **Matrix prevents false positives** - A type might be "used" in one direction but dead in practice
3. **Handler masking detection** - By checking both columns, you catch types that appear alive but only go one way
4. **Systematic approach** - Use grep to be exhaustive (manual review misses things)

### When to Apply

- After refactoring large protocols
- When cleaning up old agents or deprecated features
- In code review of message-passing systems
- Before shipping any `postMessage` or event system

### Warning Signs

- Handler exists but no `postMessage` calls with that type
- Type appears in union but only one direction uses it
- Comments like "for future use" on message types
- Zero references to a type name in send-side code

## Automated Detection Script

To make this repeatable, create a script that validates bidirectional coverage:

```bash
#!/bin/bash
# check-dead-messages.sh - Verify all message types have send AND receive

PROTOCOL_FILE="server/src/lib/build-mode/protocol.ts"
SYNC_FILE="apps/web/src/hooks/useBuildModeSync.ts"

# Extract all type literals from protocol.ts
grep -o '"BUILD_MODE_[A-Z_]*"' "$PROTOCOL_FILE" | sort -u > /tmp/types.txt

while read TYPE; do
  TYPE_CLEAN=$(echo $TYPE | tr -d '"')
  SEND_COUNT=$(grep -r "postMessage.*$TYPE_CLEAN" server/ apps/web/ --include="*.ts" 2>/dev/null | wc -l)
  RECV_COUNT=$(grep -c "case $TYPE:" "$SYNC_FILE" 2>/dev/null || echo 0)

  if [ $SEND_COUNT -eq 0 ] || [ $RECV_COUNT -eq 0 ]; then
    echo "⚠️  DEAD: $TYPE_CLEAN (sends: $SEND_COUNT, handlers: $RECV_COUNT)"
  else
    echo "✓ ALIVE: $TYPE_CLEAN"
  fi
done < /tmp/types.txt
```

## References

- **PR/Commit:** Code review resolution session, 2026-02-04
- **Related Pitfall:** #92 (Code path drift in duplicate implementations) - Similar pattern of detection
- **Pattern Name:** Bidirectional Protocol Verification
- **Complexity:** Medium (requires two-sided thinking)
- **Prevention:** Add this check to PR template for postMessage/event system changes
