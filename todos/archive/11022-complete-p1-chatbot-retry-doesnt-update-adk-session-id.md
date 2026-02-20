---
status: pending
priority: p1
issue_id: '11022'
tags: [code-review, customer-agent, chatbot, adk, session]
dependencies: []
---

# 11022: `retryWithNewADKSession()` Never Persists New ADK Session ID to DB

## Problem Statement

When an ADK session expires (Cloud Run cold start, session timeout), the retry path
in `CustomerAgentService` creates a new ADK session but **never writes the new UUID
back to the database**. The next message reads the old, expired `adkSessionId` from
DB, hits 404 again, and the cycle repeats forever.

**Why it matters:** Every Cloud Run cold start (15-min idle timeout on starter plan)
corrupts all active sessions. Users get responses (from fresh sessions) but lose
ALL conversation history on every message after a cold start.

## Findings

**File:** `server/src/services/customer-agent.service.ts:488-494`

```typescript
if (response.ok) {
  const rawResponse = await response.json();
  const parseResult = AdkSessionResponseSchema.safeParse(rawResponse);
  if (parseResult.success) {
    newAdkSessionId = parseResult.data.id;
    // ❌ MISSING: save newAdkSessionId to DB here
  }
}
```

The new `adkSessionId` is computed but only lives in the local variable `newAdkSessionId`.
No `prisma.agentSession.update` call follows. Compare with the inline recovery in `chat()`
(lines 310-315) which DOES update the DB — the retry path simply forgot to do the same.

## Proposed Solutions

### Option A — Add DB update inside `retryWithNewADKSession` (Recommended)

**Pros:** Minimal change, targeted fix.
**Cons:** None.
**Effort:** Small
**Risk:** Low

```typescript
if (parseResult.success) {
  newAdkSessionId = parseResult.data.id;
  // Persist so the NEXT message uses the correct ADK session ID
  await this.prisma.agentSession.update({
    where: { id: dbSessionId },
    data: { adkSessionId: newAdkSessionId },
  });
}
```

### Option B — Refactor retry to call `chat()` recursively

**Pros:** Eliminates the retry duplication entirely.
**Cons:** Larger refactor, risk of recursion loop.
**Effort:** Medium
**Risk:** Medium

## Recommended Action

Option A — the missing DB update is a one-liner.

## Technical Details

- **Affected file:** `server/src/services/customer-agent.service.ts`
- **Line range:** 488-494 (inside `retryWithNewADKSession()`)
- **Related:** P1-02 (11023) — local fallback session ID compounds this bug

## Acceptance Criteria

- [ ] `retryWithNewADKSession()` persists new `adkSessionId` to DB after successful session creation
- [ ] Subsequent messages in the same session use the new UUID without re-triggering retry
- [ ] Unit test added/updated to verify DB is updated in the retry path
- [ ] Typecheck passes: `npm run --workspace=server typecheck`

## Work Log

- 2026-02-20: Found during customer chatbot end-to-end review. Confirmed by reading lines 457-568 of `customer-agent.service.ts`.
