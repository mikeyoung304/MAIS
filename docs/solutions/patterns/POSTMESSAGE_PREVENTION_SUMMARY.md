# Dead PostMessage Handler Prevention - Summary & Implementation Guide

**For:** MAIS Engineering Team
**Created:** 2026-02-04
**Issue:** #821 (Dead PostMessage Types in Build Mode Protocol)

---

## The Problem (30 seconds)

PostMessage-based communication creates "zombie code" - message handlers exist without senders, or vice versa. This bloats the codebase and confuses future developers.

**Real example from MAIS:**

- `BUILD_MODE_SECTION_EDIT` defined in protocol.ts
- Handler exists in useBuildModeSync.ts
- **No code anywhere calls `postMessage()` to send it** ← DEAD CODE

**Impact:** ~40% of Build Mode PostMessage code was unused before cleanup.

---

## Solution: 3-Part Strategy

### 1. Prevention Rules (For New Code)

When adding PostMessage communication:

```typescript
// ALWAYS implement these 3 parts together in ONE commit:

// 1. Schema definition (protocol.ts)
export const MyMessageSchema = z.object({
  type: z.literal('MY_MESSAGE'),
  data: z.object({ value: z.string() }),
});

// 2. Sender (component.tsx)
iframe.postMessage(
  { type: 'MY_MESSAGE', data: { value: 'hello' } },
  window.location.origin
);

// 3. Handler (hook.ts or listener)
case 'MY_MESSAGE':
  handleMyMessage(message.data);
  break;
```

**Rule:** Never merge code missing any of these 3 parts.

### 2. Verification Patterns (3-Minute Audit)

Before committing, run these 3 commands:

```bash
# 1. List all defined types
grep "z\.literal(" apps/web/src/lib/build-mode/protocol.ts

# 2. For each type, verify sender exists (should return ≥1 result)
git grep "MESSAGE_TYPE" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -v "protocol.ts" | grep -v "case '"

# 3. Verify all listeners validate origin first
grep -A3 "addEventListener.*message" apps/web/src/hooks/useBuildModeSync.ts | \
  grep "isSameOrigin"
```

If any command returns nothing → **DEAD CODE FOUND** → investigate or delete.

### 3. Central Registry (Single Source of Truth)

Keep all message types in one place:

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
git grep "BUILD_MODE.INIT" apps/web/src  # Find all usages
```

---

## Implementation Plan

### Immediate (This Sprint)

1. **Add to CLAUDE.md** (Pitfall #97)
   - [ ] Location: `/CLAUDE.md`, Pitfall section
   - [ ] Copy text from `POSTMESSAGE_PREVENTION_SUMMARY.md` (end of doc)

2. **Create Documentation** (DONE ✓)
   - [x] Prevention strategy: `/docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md`
   - [x] Quick reference: `/docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md`
   - [x] Message registry: `/docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md`
   - [x] Audit checklist: `/docs/solutions/patterns/POSTMESSAGE_AUDIT_CHECKLIST.md`

3. **Update Tooling** (Optional for Next Sprint)
   - [ ] Add ESLint rule: `require-handler-for-message-type`
   - [ ] Add quarterly audit script: `scripts/audit-postmessage.sh`

### Short-term (Next 2 Weeks)

1. **During Code Review**
   - [ ] For any PostMessage PR, use the 3-command audit
   - [ ] Ask: "Do I see definition, sender, AND handler?"
   - [ ] Reject if any are missing

2. **Update Protocol Files**
   - [ ] Create `message-types.ts` registry file (optional but recommended)
   - [ ] Add comments to each message type explaining its purpose
   - [ ] Link each message to GitHub issue describing why it exists

3. **Communicate to Team**
   - [ ] Slack announcement: Link to quick reference
   - [ ] Code review template comment: "Running PostMessage audit..."
   - [ ] Post quick reference guide in #engineering

### Long-term (Monthly)

1. **Quarterly Audits**
   - [ ] First Monday of each quarter
   - [ ] Run automated script
   - [ ] Review registry for new dead code
   - [ ] Commit audit results

2. **Metric Tracking**
   - [ ] Track dead code found per audit
   - [ ] Monitor trend over time
   - [ ] Adjust prevention rules if trend increasing

---

## Documentation Files Created

Print these and keep handy:

| File                                     | Purpose                                    | Format   | Read Time |
| ---------------------------------------- | ------------------------------------------ | -------- | --------- |
| `POSTMESSAGE_PREVENTION_SUMMARY.md`      | This file - overview & implementation plan | Markdown | 5 min     |
| `POSTMESSAGE_QUICK_REFERENCE.md`         | 3-minute audit + 3 commands to memorize    | Markdown | 3 min     |
| `DEAD_POSTMESSAGE_HANDLER_PREVENTION.md` | Full prevention strategy with examples     | Markdown | 20 min    |
| `POSTMESSAGE_MESSAGE_REGISTRY.md`        | Central registry of all message types      | Markdown | 10 min    |
| `POSTMESSAGE_AUDIT_CHECKLIST.md`         | Step-by-step checklist for adding new code | Markdown | 15 min    |

**Recommendation:** Read in this order:

1. Quick reference (3 min) - Get the essentials
2. Prevention strategy (20 min) - Understand the "why"
3. Registry (10 min) - See current state
4. Checklist (bookmark it) - Reference during code reviews

---

## The 3 Critical Commands (Tattoo These)

Keep these in your shell history:

### Command 1: Find all message types defined

```bash
grep "z\.literal(" apps/web/src/lib/build-mode/protocol.ts | grep -o "'[^']*'"
```

### Command 2: Verify sender exists for a type

```bash
MSG_TYPE="BUILD_MODE_INIT"
git grep "$MSG_TYPE" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -v "protocol.ts" | grep -v "case '"
# Should return ≥1 result (the postMessage call)
```

### Command 3: Verify handler exists for a type

```bash
MSG_TYPE="BUILD_MODE_INIT"
grep -r "case '$MSG_TYPE'" apps/web/src --include="*.ts" --include="*.tsx"
# Should return ≥1 result (the handler case statement)
```

---

## What Happens If You Skip Prevention?

**Without prevention, you get:**

1. **Confusing Code**
   - Developer reads handler code
   - Searches for callers
   - Finds nothing
   - Thinks it's dead code
   - Deletes it (breaks something)

2. **Technical Debt**
   - 40% of code unused (real number from issue #821)
   - Bundle size larger than needed
   - Harder to understand API surface
   - More to test and maintain

3. **Bugs**
   - Handler exists but never triggered
   - Sender code added but forgotten
   - Breaking changes in protocol not caught

**With prevention:**

- Mistakes caught at review time
- "Is this code actually used?" is answerable in 30 seconds
- Dead code cleaned up quarterly
- New message types always have tests

---

## Adding to CLAUDE.md (Pitfall #97)

Copy this text into `/CLAUDE.md`, Pitfalls section, as #97:

```markdown
### PostMessage Handler Sync Pitfalls (97)

97. Dead PostMessage handlers without senders - Message type defined in protocol and handler implemented but sender never calls postMessage(); symptom: looking at handler code that appears used but grep finds only handler case statement and no postMessage() call; prevention: for every message type added, immediately implement sender in same commit, run the 3-command verification checklist (defined types → verify senders exist → verify handlers exist), use central MESSAGE_TYPES registry to keep API surface visible, add round-trip tests. See `docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md` and `docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md`
```

---

## Testing Strategy

### Unit Tests (For Each Message Type)

```typescript
describe('BUILD_MODE_INIT message round trip', () => {
  // 1. Test sender sends correct format
  it('should send BUILD_MODE_INIT with draftConfig', () => {
    const config = { pages: {...} };
    sendInitMessage(config);
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'BUILD_MODE_INIT', data: { draftConfig: config } },
      window.location.origin
    );
  });

  // 2. Test handler processes message
  it('should handle BUILD_MODE_INIT message', async () => {
    const { result } = renderHook(() => useBuildModeSync());

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'BUILD_MODE_INIT', data: { draftConfig } },
          origin: window.location.origin,
        })
      );
    });

    expect(result.current.draftConfig).toEqual(draftConfig);
  });

  // 3. Test rejects wrong origin
  it('should reject message from wrong origin', () => {
    const { result } = renderHook(() => useBuildModeSync());

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'BUILD_MODE_INIT', data: { draftConfig } },
          origin: 'https://evil.com', // Wrong origin
        })
      );
    });

    expect(result.current.draftConfig).toBeNull(); // Not processed
  });

  // 4. Test schema validation
  it('should reject invalid message schema', () => {
    const { result } = renderHook(() => useBuildModeSync());

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'BUILD_MODE_INIT', data: {} }, // Missing draftConfig
          origin: window.location.origin,
        })
      );
    });

    expect(result.current.draftConfig).toBeNull(); // Not processed
  });
});
```

---

## FAQ

**Q: What if I have a message that's "not implemented yet"?**
A: Prefix it with `_PLANNED_` and add a comment linking to the issue. Remove it when implementing or delete if scope changes.

**Q: Can I have multiple senders for one message?**
A: Yes, that's fine (e.g., multiple components might send `BUILD_MODE_CONFIG_UPDATE`). But there should only be ONE handler.

**Q: Can I have multiple handlers for one message?**
A: No, only one case statement per message type. If you need multiple handlers, they should call a shared function.

**Q: What if a message is sent but never from the current code?**
A: Audit found dead code. Either:

1. Delete sender (it's not needed)
2. Document why it exists (link to feature issue)
3. Implement what should call it

**Q: How often should I audit?**
A: Quarterly (every 3 months). Takes ~30 minutes, catches all new dead code.

**Q: What's a good naming convention?**
A: `PROTOCOL_FEATURE_ACTION`

- `BUILD_MODE_SECTION_HIGHLIGHT` ✅
- `TOGGLE_SECTION` ❌ (too vague, unclear direction)

**Q: Should origin always be `window.location.origin`?**
A: Yes, always. PostMessage only works with same-origin. Different origins would fail anyway.

---

## Metrics & Success Criteria

### Measure Success By:

1. **Code Review Time** - Finding dead PostMessage code should take <1 minute (not 30 min debugging)
2. **Dead Code Found** - Quarterly audits should find 0-2 dead types (not 5+)
3. **Test Coverage** - All new message types should have round-trip tests (90%+ coverage)
4. **Team Knowledge** - Engineers can name the 3 parts of PostMessage protocol (definition, sender, handler) in <30 sec

### Target Metrics (3 Months from Now):

| Metric                                  | Target | Current   |
| --------------------------------------- | ------ | --------- |
| Dead code found per audit               | 0-2    | N/A (new) |
| Code review time for PostMessage PR     | <5 min | N/A (new) |
| Test coverage for messages              | 90%+   | ~60%      |
| Engineers who can cite prevention rules | 80%+   | ~20%      |

---

## References

**Full documentation:**

- `/docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md` - Complete strategy
- `/docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md` - 3-minute guide
- `/docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md` - Central registry
- `/docs/solutions/patterns/POSTMESSAGE_AUDIT_CHECKLIST.md` - Step-by-step checklist

**Issue/PR:**

- Completed: `/todos/archive/821-complete-p2-dead-postmessage-types.md`

**Code files:**

- Protocol definitions: `apps/web/src/lib/build-mode/protocol.ts`
- Handlers: `apps/web/src/hooks/useBuildModeSync.ts`
- Senders: `apps/web/src/components/preview/PreviewPanel.tsx`

---

## Getting Started This Week

### For Engineers:

1. **Read:** `POSTMESSAGE_QUICK_REFERENCE.md` (3 min)
2. **Memorize:** The 3 commands from above
3. **Bookmark:** `POSTMESSAGE_AUDIT_CHECKLIST.md`
4. **Next PR:** Use the checklist for any PostMessage code

### For Tech Lead:

1. **Read:** This summary (10 min)
2. **Update:** CLAUDE.md with Pitfall #97
3. **Share:** Quick reference in team Slack
4. **Enable:** Code review checklist for PostMessage PRs
5. **Schedule:** Quarterly audit (set calendar reminder)

### For Code Reviewers:

1. **Watch for:** PostMessage code in PRs
2. **Use checklist:** Copy from `POSTMESSAGE_AUDIT_CHECKLIST.md`
3. **Run 3 commands:** Before approving
4. **Comment:** "PostMessage audit: definition ✓, sender ✓, handler ✓"

---

## Questions?

Check the relevant doc:

- "How do I add a new message?" → `POSTMESSAGE_AUDIT_CHECKLIST.md`
- "What message types exist?" → `POSTMESSAGE_MESSAGE_REGISTRY.md`
- "How do I find dead code?" → `POSTMESSAGE_QUICK_REFERENCE.md`
- "Why is this important?" → `DEAD_POSTMESSAGE_HANDLER_PREVENTION.md`

---

**Version:** 1.0 | **Status:** Ready for Implementation | **Last Updated:** 2026-02-04
