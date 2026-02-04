# PostMessage Audit Checklist

**Use this checklist when adding, modifying, or auditing PostMessage code.**

Printable one-pager: See bottom for printable version.

---

## Adding a New PostMessage Protocol

Complete this checklist BEFORE committing:

### Phase 1: Planning (Before Code)

- [ ] **Got product sign-off?** If message is "for future use," document timeline or delete
- [ ] **Wrote it in the ticket?** "This feature needs messages X, Y, Z for communication"
- [ ] **Created protocol doc?** Added section to `docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md`
- [ ] **Chose naming?** `PROTOCOL_FEATURE_ACTION` (e.g., `BUILD_MODE_CONFIG_UPDATE`)
- [ ] **Chose direction?** Parent → Child or Child → Parent?

### Phase 2: Implementation (During Code)

- [ ] **Define schema first** - Create Zod schema in `protocol.ts`
- [ ] **Implement sender** - Add `postMessage()` call with correct origin
- [ ] **Implement handler** - Add case statement with Zod validation
- [ ] **Same commit?** Sender and handler in ONE commit
- [ ] **Tests?** Round-trip test: send → handle → verify state change
- [ ] **Error handling?** Sender checks if window/iframe exists before calling postMessage
- [ ] **Logging?** Added `logger.warn()` for failures

### Phase 3: Validation (Before Merge)

Run these commands and paste results:

```bash
# 1. Find message type definition
grep "z\.literal.*NEW_TYPE" apps/web/src/lib/build-mode/protocol.ts
# Copy here: ___________________________________________

# 2. Verify sender exists (should return postMessage call)
git grep "NEW_TYPE" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -v protocol.ts | grep -v "case '"
# Copy here: ___________________________________________

# 3. Verify handler exists (should return case statement)
git grep "case 'NEW_TYPE'" apps/web/src --include="*.ts" --include="*.tsx"
# Copy here: ___________________________________________
```

- [ ] **Sender found?** Result from command #2 not empty
- [ ] **Handler found?** Result from command #3 not empty
- [ ] **No duplicates?** Only one sender, one handler (unless intentional)

### Phase 4: Security (Code Review)

- [ ] **Origin checked?** Listener has `if (!isSameOrigin(...)) return;` as FIRST line
- [ ] **Validated?** Listener uses `schema.safeParse()` before using data
- [ ] **No sensitive data?** Message doesn't contain passwords/tokens/PII
- [ ] **Tested origin?** Unit test verifies message rejected from wrong origin
- [ ] **Error caught?** Handler wrapped in try/catch or uses safeParse

**Code review template:**

```typescript
// BEFORE MERGE - Verify all checks pass:
// ✓ isSameOrigin() check (line ___)
// ✓ safeParse() validation (line ___)
// ✓ Error handling try/catch (line ___)
// ✓ Sender: postMessage() found in: ___
// ✓ Handler: case statement found in: ___
```

### Phase 5: Documentation (After Merge)

- [ ] **Updated registry?** Added row to `POSTMESSAGE_MESSAGE_REGISTRY.md`
- [ ] **Updated PR description?** Listed which messages added
- [ ] **Commit message?** "docs: add NEW_MESSAGE_TYPE to PostMessage registry"

---

## Auditing Existing Code

Use this to find dead code in existing implementations.

### Quick Scan (5 minutes)

```bash
# 1. Count defined types vs handlers
DEFINED=$(grep "z\.literal(" apps/web/src/lib/build-mode/protocol.ts | wc -l)
HANDLERS=$(grep -r "case '" apps/web/src --include="*.ts" | wc -l)

echo "Defined: $DEFINED, Handlers: $HANDLERS"
# Should be roughly equal (handlers may be slightly more due to other code)
```

- [ ] **Counts roughly equal?** If DEFINED >> HANDLERS, investigate dead types

### Deep Audit (15 minutes)

For each message type in protocol, verify both sender and handler:

```bash
# Template for each message type
TYPE="BUILD_MODE_INIT"

echo "=== Checking: $TYPE ==="

# 1. Definition
echo "Definition:"
grep "$TYPE" apps/web/src/lib/build-mode/protocol.ts | head -1

# 2. Handler
echo "Handler:"
grep -r "case '$TYPE'" apps/web/src --include="*.ts" --include="*.tsx" || echo "NOT FOUND"

# 3. Sender
echo "Sender:"
git grep "$TYPE" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -v "protocol.ts" | grep -v "case '" || echo "NOT FOUND"

echo ""
```

- [ ] **Each type has sender?** Every defined type should have at least one postMessage() call
- [ ] **Each type has handler?** Every postMessage() should have corresponding case statement
- [ ] **No "NOT FOUND"?** Missing sender or handler means dead code

### Recording Findings

Create entry for each issue found:

| Type              | Status  | Sender | Handler | Action                       |
| ----------------- | ------- | ------ | ------- | ---------------------------- |
| `BUILD_MODE_EDIT` | Dead    | ❌     | ✅      | Delete handler case          |
| `MY_FUTURE_TYPE`  | Planned | ❌     | ❌      | Rename to `_PLANNED_MY_TYPE` |

---

## Fixing Dead Code

### Option A: Delete (Recommended for Confirmed Dead Code)

1. **Verify no senders exist:**

   ```bash
   git grep "BUILD_MODE_EDIT" apps/web/src --include="*.ts" --include="*.tsx" | \
     grep -v protocol.ts | grep -v "case '" | wc -l
   # Should be: 0
   ```

2. **Delete schema:**

   ```bash
   # Remove from protocol.ts
   - export const BuildModeEditSchema = z.object({...});
   ```

3. **Delete handler:**

   ```bash
   # Remove from useBuildModeSync.ts
   - case 'BUILD_MODE_EDIT':
   -   // handler code
   -   break;
   ```

4. **Delete from union:**

   ```bash
   # Remove from BuildModeParentMessageSchema
   - BuildModeEditSchema,
   ```

5. **Verify TypeScript:**

   ```bash
   npm run typecheck
   ```

6. **Run tests:**
   ```bash
   npm test
   ```

- [ ] **Deletion complete?** No TypeScript errors
- [ ] **Tests pass?** All tests still passing

### Option B: Mark as Planned (For Speculative Features)

1. **Rename with prefix:**

   ```typescript
   // protocol.ts
   - export const BuildModeEditSchema = z.object({
   + export const _PLANNED_BuildModeEditSchema = z.object({
     type: z.literal('_PLANNED_BUILD_MODE_EDIT'),
   ```

2. **Add comment:**

   ```typescript
   /**
    * PLANNED: BUILD_MODE_EDIT (Inline editing)
    *
    * Intended for: Phase 5 inline section editing
    * Status: Blocked on product decision
    * Handler exists: NO - awaiting implementation
    *
    * When implementing:
    * 1. Remove _PLANNED_ prefix
    * 2. Implement sender in PreviewPanel
    * 3. Add tests for round-trip
    *
    * Issue: #XXX
    */
   ```

3. **Update registry:**
   ```markdown
   | \_PLANNED_BUILD_MODE_EDIT | ❌ Planned | ? | ❌ | None | Inline editing (Phase 5) | Blocked on product |
   ```

- [ ] **Comment added?** Explains why it's planned
- [ ] **Registry updated?** Marked as planned, not active

### Option C: Implement Missing Sender

1. **Find the handler:**

   ```bash
   grep -B2 -A5 "case 'BUILD_MODE_EDIT'" apps/web/src/hooks/useBuildModeSync.ts
   ```

2. **Determine purpose:** What should trigger this message?

3. **Add sender:**

   ```typescript
   // In component that should send it
   const handleEdit = () => {
     if (!iframeRef.current?.contentWindow) return;
     iframeRef.current.contentWindow.postMessage(
       { type: 'BUILD_MODE_EDIT', data: {...} },
       window.location.origin
     );
   };
   ```

4. **Add test:**
   ```typescript
   it('should send BUILD_MODE_EDIT message', () => {
     act(() => {
       handleEdit();
     });
     // Verify postMessage called
   });
   ```

- [ ] **Sender implemented?** postMessage call exists
- [ ] **Tests pass?** New test verifies sender works

---

## Quarterly Audit Runbook

Run every 3 months (e.g., first Monday of quarter).

**Time:** ~30 minutes
**Owner:** Any engineer
**Trigger:** Calendar reminder

### Steps

1. **Run automated check:**

   ```bash
   bash docs/solutions/patterns/audit-postmessage.sh
   ```

   Should produce:

   ```
   Defined message types: X
   Handler case statements: ~X
   PostMessage calls (senders): Y

   Potentially dead message types:
   (empty if all types have senders)
   ```

2. **Record results:**
   - [ ] Run timestamp: ****\_\_\_****
   - [ ] Found dead types? (Y/N): \_\_\_
   - [ ] Types to investigate: ****\_\_\_****

3. **If dead types found:**
   - [ ] Determine if speculative or accidental
   - [ ] Apply Option A (delete) or Option B (mark planned)
   - [ ] Create follow-up issue if needed

4. **Update registry:**

   ```bash
   git log --oneline -- 'docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md' | head -5
   ```

   - [ ] Note: Last audit was **\_**
   - [ ] Changes made: ****\_\_\_****

5. **Commit if changes:**
   ```bash
   git add docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md
   git commit -m "docs: Q1 2026 PostMessage audit - no dead code found"
   ```

---

## Printable One-Pager

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PostMessage Implementation Checklist (Print & Taped to Monitor)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before Committing PostMessage Code, Run These 3 Commands:

1. List all message types
   grep "z\.literal(" apps/web/src/lib/build-mode/protocol.ts | \
     grep -o "'[^']*'" | sort -u

2. For EACH message type, verify sender exists
   git grep "MESSAGE_TYPE" apps/web/src --include="*.ts" --include="*.tsx" | \
     grep -v "protocol.ts" | grep -v "case '"
   (Should return ≥1 result)

3. Verify origin validation in listener
   grep -A3 "addEventListener.*message" apps/web/src/hooks/useBuildModeSync.ts | \
     grep "isSameOrigin"
   (Should find origin check as FIRST line)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Pattern You Need:

  PROTOCOL (protocol.ts)  ←  SENDER (component.tsx)
         ↓
      HANDLER (hook.ts)

  All three must exist together!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Common Mistakes to Avoid:

  ❌ Handler exists but sender doesn't → DELETE handler
  ❌ Sender exists but handler doesn't → DELETE sender
  ❌ Message defined but never called → Mark _PLANNED_ or DELETE
  ❌ Forgot origin check → Add: if (!isSameOrigin(...)) return;
  ❌ String literal instead of type → Use MESSAGE_TYPES.CONSTANT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If You Find Dead Code:

  A. DELETE: git grep "TYPE" | confirm no callers | remove all 3 parts
  B. MARK PLANNED: Rename to _PLANNED_TYPE, add comment with issue link
  C. IMPLEMENT: Add missing sender or handler (whichever is missing)

  See: docs/solutions/patterns/POSTMESSAGE_AUDIT_CHECKLIST.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Security Must-Haves:

  ✓ Origin validation FIRST: if (!isSameOrigin(...)) return;
  ✓ Zod validation SECOND: schema.safeParse(data)
  ✓ Error handling: Try/catch around handler code
  ✓ No secrets in messages: No passwords, tokens, API keys
  ✓ Tests for: Valid message, wrong origin, invalid schema

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reference Docs:

  PREVENTION_STRATEGY: docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md
  QUICK_REFERENCE:    docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md
  MESSAGE_REGISTRY:   docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md
  THIS_CHECKLIST:     docs/solutions/patterns/POSTMESSAGE_AUDIT_CHECKLIST.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Troubleshooting

### Message not being received?

```bash
# 1. Check origin
window.location.origin  # Should match postMessage origin arg

# 2. Verify listener attached
grep -n "addEventListener.*message" apps/web/src/hooks/useBuildModeSync.ts

# 3. Check for typos in message type
grep "type:" apps/web/src/lib/build-mode/protocol.ts
git grep "BUILD_MODE_INIT" apps/web/src/components/preview/PreviewPanel.tsx

# 4. Verify iframe loaded
# Add: console.log('iframe ready') in iframe code
# Add: console.log('sending message') before postMessage()
```

### Handler crashes on message?

```bash
# 1. Add logging
case 'MY_MESSAGE':
  logger.debug('[MyMessage] Received:', message);
  // handler code
  break;

# 2. Add safeParse validation
const result = MyMessageSchema.safeParse(event.data);
if (!result.success) {
  logger.error('[MyMessage] Validation failed:', result.error);
  return;
}

# 3. Add try/catch
try {
  // handler code
} catch (err) {
  logger.error('[MyMessage] Handler error:', err);
}
```

### Dead code not showing up in grep?

```bash
# Might be minified or behind condition
# Try with less specific patterns:

git grep "BUILD_MODE" apps/web/src --include="*.ts" --include="*.tsx"

# Also check build output:
grep -r "BUILD_MODE" .next/server apps/web/dist 2>/dev/null
```

---

## Related Resources

- **Full prevention guide:** `docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md`
- **Quick 3-min reference:** `docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md`
- **Central registry:** `docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md`
- **Completed issue #821:** `/todos/archive/821-complete-p2-dead-postmessage-types.md`
- **Code files:**
  - Protocol: `apps/web/src/lib/build-mode/protocol.ts`
  - Handler: `apps/web/src/hooks/useBuildModeSync.ts`
  - Sender: `apps/web/src/components/preview/PreviewPanel.tsx`
