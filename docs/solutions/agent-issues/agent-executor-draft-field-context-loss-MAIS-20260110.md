# Agent Executor Draft Field and Context Loss Bug Fix

**Date:** 2026-01-10
**Priority:** P0 (executor) + P1 (frontend)
**Status:** RESOLVED

## Summary

Two bugs made the AI agent appear broken during onboarding:

1. **P0 Backend:** `update_storefront` executor wrote to `landingPageConfig` (published) instead of `landingPageConfigDraft` - preview reads from draft so changes appeared to fail silently
2. **P1 Frontend:** `useAgentChat.ts` discarded session history on mount, showing only greeting even though backend had full conversation

## Root Cause Analysis

### P0: Wrong Field Name in Executor

**File:** `server/src/agent/executors/onboarding-executors.ts`

```typescript
// WRONG (line 192-228)
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { landingPageConfig: true },  // Wrong field
});
// ...
tenantUpdates.landingPageConfig = { ... } // Writes to live, not draft
```

**User Impact:**

- User says "Update my headline to X"
- Agent responds "Done! I've updated your headline"
- User checks preview - nothing changed
- User thinks feature is broken

### P1: Frontend Discards History

**File:** `apps/web/src/hooks/useAgentChat.ts`

```typescript
// OLD (line 224-231)
const greeting = initialGreeting || data.greeting || fallbackGreeting;
setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
// Discards any existing history!
```

**User Impact:**

- User has conversation with agent
- User switches tabs or navigates away
- User returns - only sees greeting
- User thinks agent lost context

## Fix Applied

### P0 Fix: Use DraftUpdateService

Created `server/src/agent/services/draft-update.service.ts` that:

- Uses `getDraftConfigWithSlug()` to read from draft
- Writes to `landingPageConfigDraft`
- Uses advisory lock for TOCTOU prevention
- Returns `hasDraft: true` for cache invalidation

### P1 Fix: Load History on Mount

Updated `initializeChat` in `useAgentChat.ts` to:

- Check `messageCount` from session response
- If > 0, fetch history from `/session/:id/history`
- Load historical messages instead of just greeting

## Files Changed

| File                                                 | Change                  |
| ---------------------------------------------------- | ----------------------- |
| `server/src/agent/services/draft-update.service.ts`  | NEW - shared service    |
| `server/src/agent/executors/onboarding-executors.ts` | MODIFIED - use service  |
| `server/src/agent/proposals/executor-schemas.ts`     | MODIFIED - add schema   |
| `apps/web/src/hooks/useAgentChat.ts`                 | MODIFIED - load history |
| `apps/web/src/stores/agent-session-store.ts`         | NEW - session store     |
| Tests and docs                                       | Multiple files updated  |

## Prevention

See `docs/solutions/patterns/STOREFRONT_DRAFT_SYSTEM_CHECKLIST.md` for checklist.

## Key Insight

Backend sessions ARE unified correctly. The bugs were field name and UI loading issues.
