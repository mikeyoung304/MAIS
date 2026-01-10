# Quick Reference: Draft Field & Session History Bugs

**Print & Pin This (2 min read)**

---

## Bug 1: Draft Field Bug (Executor)

**File:** `server/src/agent/executors/onboarding-executors.ts`

**The Problem:**
Reads/writes `landingPageConfig` (published) instead of `landingPageConfigDraft` (draft)

**The Fix:**

```typescript
// Line 194: CHANGE THIS
select: { landingPageConfig: true },        // ❌ Wrong
// TO THIS
select: { landingPageConfigDraft: true },   // ✅ Correct

// Line 228: CHANGE THIS
tenantUpdates.landingPageConfig = {         // ❌ Wrong
// TO THIS
tenantUpdates.landingPageConfigDraft = {    // ✅ Correct
```

**Why:** Agent writes go to draft during onboarding, not published config.

---

## Bug 2: Session History Bug (Hook)

**File:** `apps/web/src/hooks/useAgentChat.ts`

**The Problem:**
Lines 224-231 unconditionally set messages to greeting only, discarding backend's session history.

**The Fix:**

```typescript
// CHANGE LINES 224-231 FROM:
const greeting = initialGreeting || data.greeting || fallbackGreeting;
setMessages([
  {
    role: 'assistant',
    content: greeting,
    timestamp: new Date(),
  },
]);

// TO:
const greeting = initialGreeting || data.greeting || fallbackGreeting;
if (data.messages && data.messages.length > 0) {
  setMessages(
    data.messages.map((msg: ChatMessage) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }))
  );
} else {
  setMessages([
    {
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    },
  ]);
}
```

**Why:** Backend returns previous messages for resumption. Use them if available.

---

## Decision Tree

| Symptom                                               | Bug   | Fix                                               |
| ----------------------------------------------------- | ----- | ------------------------------------------------- |
| Preview doesn't update after agent changes storefront | Bug 1 | Change line 194 & 228 to `*Draft` fields          |
| Conversation resets on tab switch / refresh           | Bug 2 | Add `if (data.messages)` check before setMessages |
| Agent says "change made" but nothing visible          | Bug 1 | See above                                         |
| Tab switching loses all previous messages             | Bug 2 | See above                                         |

---

## Testing Checklist

**Bug 1 (Draft):**

- [ ] Ask agent to "Update headline to ..."
- [ ] Check Prisma Studio: `landingPageConfigDraft.pages.home.sections[0].headline` shows new value
- [ ] Check: `landingPageConfig` field unchanged (still published version)

**Bug 2 (Session):**

- [ ] Have 4-message conversation with agent
- [ ] Refresh page (Cmd+R)
- [ ] Verify all 4 messages still visible
- [ ] Open new tab with same session
- [ ] Verify messages appear immediately (no reset)

---

## Prevention Rules

1. **Draft vs Published:** During onboarding (T2 tools), write to `*Draft` fields
2. **Session State:** Always check if backend response includes `messages` before resetting
3. **Testing:** Both scenarios fail silently without visual clue - test explicitly
