# Solution: Dual-Draft Field & Session History Recovery

**Issue:** AI agent appears broken after onboarding because:

1. Backend reads/writes wrong field (published config instead of draft)
2. Frontend discards session history on mount

**Result:** Preview never shows changes, switching tabs appears to "reset" conversation.

**Fix Time:** 5 minutes total
**Affected Files:** 2
**Severity:** P1 (agent appears non-functional)

---

## Bug 1: Executor Reading/Writing Published Config Instead of Draft

**Location:** `server/src/agent/executors/onboarding-executors.ts`

**Root Cause:**
The `update_storefront` executor reads from and writes to `landingPageConfig` (the published version). But the preview panel in the build editor reads from `landingPageConfigDraft`. This creates a disconnect:

- Agent tool: "I updated the storefront"
- Backend: Writes to `landingPageConfig` ✓
- Preview panel: Reads from `landingPageConfigDraft` ✗
- User sees: No changes

**BEFORE (Wrong):**

```typescript
// Line 194: Read from published config
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { landingPageConfig: true }, // ❌ Wrong field
});

const currentConfig = (tenant?.landingPageConfig as LandingPageConfig | null) || {
  pages: {} as Partial<PagesConfig>,
};

// ... build updated sections ...

// Line 228: Write to published config
tenantUpdates.landingPageConfig = {
  ...currentConfig,
  pages: {
    ...pages,
    home: {
      ...homePage,
      sections,
    },
  },
} as Prisma.JsonObject; // ❌ Wrong field
```

**AFTER (Correct):**

```typescript
// Line 194: Read from DRAFT config
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { landingPageConfigDraft: true }, // ✅ Read draft
});

const currentConfig = (tenant?.landingPageConfigDraft as LandingPageConfig | null) || {
  pages: {} as Partial<PagesConfig>,
};

// ... build updated sections (same logic) ...

// Line 228: Write to DRAFT config
tenantUpdates.landingPageConfigDraft = {
  ...currentConfig,
  pages: {
    ...pages,
    home: {
      ...homePage,
      sections,
    },
  },
} as Prisma.JsonObject; // ✅ Write draft
```

**Key Pattern:**
All agent writes go to `*Draft` fields during onboarding. This allows preview while changes accumulate. When user clicks "Publish" (admin action), draft merges to published.

---

## Bug 2: Frontend Discards Session History on Mount

**Location:** `apps/web/src/hooks/useAgentChat.ts`

**Root Cause:**
The `initializeChat` function (lines 224-231) fetches session context from backend (includes previous messages), but always overwrites with ONLY the greeting message:

```typescript
// Backend returns:
{
  sessionId: "...",
  greeting: "Welcome back!",
  messages: [
    { role: 'assistant', content: 'How can I help?', timestamp: ... },
    { role: 'user', content: 'Create a segment', timestamp: ... },
    { role: 'assistant', content: 'I created...', timestamp: ... },
  ]
}

// Frontend:
setMessages([
  { role: 'assistant', content: greeting, timestamp: new Date() }  // ❌ Discards entire history!
]);
```

This causes the conversation to "reset" when switching tabs or page refresh.

**BEFORE (Wrong):**

```typescript
// Lines 224-231: Unconditional greeting-only
const greeting = initialGreeting || data.greeting || fallbackGreeting;
setMessages([
  {
    role: 'assistant',
    content: greeting,
    timestamp: new Date(),
  },
]); // ❌ Ignores data.messages
```

**AFTER (Correct):**

```typescript
// Lines 224-231: Use session history if available
const greeting = initialGreeting || data.greeting || fallbackGreeting;

// Restore session history if present, otherwise start with greeting
if (data.messages && data.messages.length > 0) {
  // Session has history - restore all messages with correct timestamps
  setMessages(
    data.messages.map((msg: ChatMessage) => ({
      ...msg,
      timestamp: new Date(msg.timestamp), // Ensure Date object, not string
    }))
  );
} else {
  // New session - start with greeting only
  setMessages([
    {
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    },
  ]);
}
```

**Key Pattern:**
Always check if session data includes previous context before resetting state. Backend returns previous messages → use them. New session → start fresh.

---

## Testing Both Fixes

### Test 1: Draft Field Usage

```bash
# 1. Start API and web app
npm run dev:api
cd apps/web && npm run dev

# 2. Start onboarding conversation
# 3. Ask agent to "Update the headline to 'Fresh Perspective'"
# 4. Check draft config in database:
cd server && npm exec prisma studio

# Navigate to Tenant → find test tenant
# Inspect landingPageConfigDraft.pages.home.sections[0].headline
# Should show: "Fresh Perspective"

# Verify published config unchanged:
# Inspect landingPageConfig.pages.home.sections[0].headline
# Should show: original value (or null)
```

### Test 2: Session History Restore

```bash
# 1. Start conversation with agent
# - User: "Create a photography segment"
# - Agent: "I've created..."
# - User: "Update the tagline to 'Premium Photos'"
# - Agent: "Updated tagline..."

# 2. Refresh the page (Cmd+R)

# Expected behavior:
# - All 4 previous messages appear
# - No "Welcome back!" message replaces them
# - Conversation history intact

# 3. Open new tab (to same chat session)
# Expected behavior:
# - Same 4 messages appear
# - Tab switching does NOT reset
```

---

## Implementation Checklist

- [ ] Update line 194 in `onboarding-executors.ts`: `select: { landingPageConfigDraft: true }`
- [ ] Update line 228 in `onboarding-executors.ts`: `tenantUpdates.landingPageConfigDraft = ...`
- [ ] Update lines 224-231 in `useAgentChat.ts`: Check for `data.messages` before overwriting
- [ ] Run `npm test` to verify no regressions
- [ ] Test both scenarios above
- [ ] Verify agent preview updates now visible in build editor

---

## Why This Matters

**Before:** Agent appears broken

- User asks to "Update headline"
- Agent confirms change made
- User doesn't see change in preview
- User thinks agent is malfunctioning

**After:** Agent works reliably

- User asks to "Update headline"
- Agent confirms change made
- User sees draft update in preview immediately
- Conversation history persists across tabs/refreshes

---

## Root Cause Analysis

### Bug 1 (Draft Field)

Two config fields exist for architectural reasons:

- `landingPageConfig` - Published version (live on storefront)
- `landingPageConfigDraft` - Draft version (editing in progress)

The separation allows:

- Building changes incrementally
- Preview before publish
- Rollback if needed

The executor needs to write to draft because it's part of the onboarding workflow (not yet published). The bug happened because `update_storefront` logic was copied from admin routes that write to published config.

**Prevention:** Add comment explaining which field to use:

```typescript
// Always write to draft during onboarding (not published config)
// Draft only becomes live when user clicks "Publish"
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { landingPageConfigDraft: true }, // CRITICAL: draft, not published
});
```

### Bug 2 (Session History)

The hook fetches session context from backend (including previous messages) but never used it. The code was written for a new-chat-only scenario and wasn't updated when session resumption was added.

**Prevention:** Always ask: "Does the backend response include resumable state?" If yes, use it before resetting.

---

## Related Patterns

- **Dual-Draft System**: See `docs/solutions/patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md`
- **Session Resumption**: Sessions include full message history for resumption
- **T2 vs T3 Proposals**: Draft writes (T2) vs live writes (T3)
