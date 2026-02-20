---
status: pending
priority: p1
issue_id: '11023'
tags: [code-review, customer-agent, chatbot, adk, session]
dependencies: ['11022']
---

# 11023: Local Fallback Session ID Stored in DB Creates Permanent Retry Loop

## Problem Statement

When ADK is unreachable during `createSession()` (e.g., Cloud Run cold start on first
request), a non-null local fallback string is stored in `agentSession.adkSessionId`:

```
local:customer:{tenantId}:{timestamp}
```

This truthy-but-invalid value causes `chat()` to skip its inline session recovery
(`if (!adkSessionId)` is false), then send the local string to ADK → guaranteed 404
every message → `retryWithNewADKSession()` → creates new session → gets a response
→ BUT doesn't update DB (see P1-01/11022). The session is permanently stuck in this
loop for its entire lifetime.

## Findings

**File:** `server/src/services/customer-agent.service.ts:155-163`

```typescript
// createSession() fallback on ADK failure:
adkSessionId = `local:customer:${tenantId}:${Date.now()}`;
logger.warn(
  { tenantId, adkSessionId, error },
  '[CustomerAgent] Using local session (ADK unreachable)'
);
// ↑ This gets stored in DB via:
await this.prisma.agentSession.update({
  where: { id: dbSession.id },
  data: { adkSessionId },   ← stores the "local:..." string
});
```

**File:** `server/src/services/customer-agent.service.ts:259-289`

```typescript
// chat() recovery:
let adkSessionId = sessionWithAdk?.adkSessionId;  // Gets "local:customer:..."
// ...
if (!adkSessionId) {   ← FALSE because "local:..." is truthy
  // This recovery block is SKIPPED
}
```

## Proposed Solutions

### Option A — Store null instead of local fallback string (Recommended)

**Pros:** Minimal change. `chat()`'s existing `if (!adkSessionId)` recovery handles null correctly.
**Cons:** Loses the diagnostic info about when the session was created (minor).
**Effort:** Small
**Risk:** Low

```typescript
// In createSession() catch block:
adkSessionId = null; // was: `local:customer:${tenantId}:${Date.now()}`
logger.warn(
  { tenantId },
  '[CustomerAgent] ADK unreachable — storing null adkSessionId; chat() will recover'
);
```

### Option B — Detect `local:` prefix in `chat()` and treat as null

**Pros:** Defense-in-depth. Catches any already-stored local IDs in production DB.
**Cons:** Requires both changes.
**Effort:** Small
**Risk:** Low

```typescript
// In chat(), after the DB lookup:
let adkSessionId = sessionWithAdk?.adkSessionId;
if (adkSessionId?.startsWith('local:')) {
  adkSessionId = null; // treat local fallback as no session
}
```

## Recommended Action

Option A + Option B — both are small, and Option B handles the existing production
sessions that already have `local:...` values stored (from sessions created during
past cold starts before this fix).

## Technical Details

- **Affected file:** `server/src/services/customer-agent.service.ts`
- **Fallback assignment:** line ~158
- **Recovery guard:** line ~289
- **Related:** P1-01 (11022) should be fixed first or simultaneously

## Acceptance Criteria

- [ ] `createSession()` stores `null` (not a local string) when ADK is unreachable
- [ ] `chat()` detects `local:` prefix and treats it as null to handle existing sessions
- [ ] `chat()`'s `if (!adkSessionId)` recovery correctly creates a new ADK session
- [ ] Unit test covers the case: ADK unreachable during createSession → subsequent chat recovers cleanly
- [ ] Typecheck passes: `npm run --workspace=server typecheck`

## Work Log

- 2026-02-20: Found during customer chatbot end-to-end review. Compound failure with 11022.
