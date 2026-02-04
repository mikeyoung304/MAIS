# Dead Code Detection Quick Reference

## Code Review - February 4, 2026

### Situation: Message Types with Handlers but No Sends

You're reviewing code with PostMessage/event systems and see handler functions, but you suspect some types are dead.

### 5-Minute Investigation

```bash
# 1. List all type names
grep -o '"BUILD_MODE_[A-Z_]*"' protocol.ts | sort -u > /tmp/types.txt

# 2. For each type, run both checks
while read TYPE; do
  TYPE_CLEAN=$(echo $TYPE | tr -d '"')

  # Check if SENT
  echo -n "$TYPE_CLEAN: send="
  grep -r "postMessage.*$TYPE_CLEAN" . --include="*.ts" | wc -l

  # Check if RECEIVED (has handler)
  echo -n "         recv="
  grep -c "case \"$TYPE_CLEAN\"" handler.ts || echo 0
done < /tmp/types.txt

# 3. Any type with send=0 is DEAD (even if recv>0)
```

### The Key Insight

**Handlers mask dead code.** A type with a case statement LOOKS used, but if nothing sends it, it's dead.

```
Type Defined?     Handler?      Sent?         Status
    ✓               ✓             ✓           ALIVE ✓
    ✓               ✓             ✗           DEAD ← DETECTED BY THIS PATTERN
    ✓               ✗             ✗           DEAD (easy to spot)
    ✓               ✓             ✗           DEAD
```

### Remediation (3 Steps)

1. **Remove from union** - Delete type from `BuildModeMessage` union
2. **Delete schema** - Remove the Zod schema definition
3. **Delete handler** - Remove the case statement

TypeScript will error if you missed any (exhaustiveness check on discriminated union).

### Code Locations (MAIS)

| File                                     | Contains                        |
| ---------------------------------------- | ------------------------------- |
| `server/src/lib/build-mode/protocol.ts`  | Type definitions                |
| `apps/web/src/hooks/useBuildModeSync.ts` | Handler receivers               |
| Search for                               | `postMessage()` calls (senders) |

### Example: BUILD_MODE_HIGHLIGHT_SECTION

```bash
# 1. Find definition
grep "BUILD_MODE_HIGHLIGHT_SECTION" protocol.ts
# Found: Schema definition

# 2. Find handler
grep "BUILD_MODE_HIGHLIGHT_SECTION" useBuildModeSync.ts
# Found: case statement at line 45

# 3. Find senders
grep -r "postMessage.*BUILD_MODE_HIGHLIGHT_SECTION" server/ apps/web/
# Found: NOTHING (no results)

# VERDICT: DEAD (defined + handler, but never sent)
```

### Results from February 4 Session

| Type                            | Defined | Sent | Handler | Status |
| ------------------------------- | ------- | ---- | ------- | ------ |
| BUILD_MODE_INITIALIZE           | ✓       | ✓    | ✓       | ALIVE  |
| BUILD_MODE_TOOL_USE             | ✓       | ✓    | ✓       | ALIVE  |
| BUILD_MODE_HIGHLIGHT_SECTION    | ✓       | ✗    | ✓       | DEAD   |
| BUILD_MODE_SECTION_UPDATE       | ✓       | ✗    | ✓       | DEAD   |
| BUILD_MODE_PUBLISH_NOTIFICATION | ✓       | ✗    | ✓       | DEAD   |
| BUILD_MODE_SECTION_EDIT         | ✓       | ✗    | ✓       | DEAD   |
| BUILD_MODE_SECTION_RENDERED     | ✓       | ✗    | ✓       | DEAD   |

**Cleanup:** Removed 5 dead types, -302 lines of dead code

### When to Use This Pattern

- Code review of any PostMessage system
- After refactoring message protocols
- Cleaning up deprecated features
- Before shipping new PostMessage-based code

### Full Documentation

See: `/docs/solutions/code-review-patterns/DEAD_POSTMESSAGE_DETECTION_PATTERN.md`
