# Simplicity & Integrity Review: PR #67

**PR:** feat: tenant agent session persistence & cold start recovery
**Reviewer:** code-simplicity-reviewer + data-integrity-guardian
**Date:** 2026-02-20
**Files reviewed:**

- `server/src/lib/adk-client.ts`
- `server/src/routes/tenant-admin-tenant-agent.routes.ts`
- `server/src/services/tenant-agent.service.ts`
- `server/src/routes/index.ts`
- `server/src/services/session/session.service.ts` (dependency, read for context)
- `server/src/services/session/session.repository.ts` (dependency, read for context)
- `server/src/services/session/session.schemas.ts` (dependency, read for context)

---

## CRITICAL (P1)

### P1-1: Non-atomic session creation — ADK session ID gap

**File:** `server/src/services/tenant-agent.service.ts` lines 193–204
**Category:** Data Integrity

`createSession()` runs `getOrCreateSession()` to write the PostgreSQL row (line 194) and then separately runs `prisma.agentSession.update()` to set `adkSessionId` (line 201). These are two separate writes with no transaction wrapping them. If the process crashes, is killed, or the update fails between the two calls, a PostgreSQL session row will exist with `adkSessionId = null`.

When `chat()` later encounters a null `adkSessionId` it creates a new ADK session (lines 321–329) — which is the recovery path. That recovery path is itself two separate writes (ADK create, then `prisma.agentSession.update`). So the race window is survivable, but the result is a session that silently starts with no ADK correlation. This is only acceptable if `chat()` reliably handles `adkSessionId = null` — which it does today, but the invariant is fragile.

**Risk:** Low in practice (crash between two fast DB calls), but it means the session table cannot be used as a reliable audit of ADK session IDs without understanding this window.

**Recommendation:** Move the `agentSession.update` into a Prisma transaction that wraps both the `createSession` call and the ADK session ID linkage, or refactor to set `adkSessionId` in a single upsert that atomically creates the row.

---

### P1-2: User message is persisted before ADK call — no rollback on total failure

**File:** `server/src/services/tenant-agent.service.ts` lines 308–317, 370–377, 431–451
**Category:** Data Integrity

In `chat()`, the user message is saved to PostgreSQL (step 3, line 309) before the ADK `/run` call (step 5, line 334). If the ADK call fails due to a non-recoverable error (network down, Cloud Run gone, parse failure), the service returns an error response to the user — but the user message is still persisted in PostgreSQL. The version counter has already incremented.

On a retry, the user will send the same text again. This inserts a second user message row. The conversation history in PostgreSQL will contain two identical user messages with no assistant response between them, breaking the alternating `user/assistant` invariance.

There is no idempotency key passed into `appendMessage` for the user message in `chat()` (line 309–313), so the duplicate-message detection via `idempotencyKey` unique constraint (`session.repository.ts` line 337) will not fire — a new `auto-{timestamp}` key is generated each time by `generateIdempotencyKey()`.

**Risk:** Every failed request produces a phantom user message. After 5 retries on a flaky connection the conversation has 5 orphaned user messages. The context summary in `buildContextSummary` will surface these as noise and the ADK session will receive garbled history on cold-start recovery.

**Recommendation:** Either (a) generate a stable, request-scoped idempotency key for the user message (e.g., `req.id` or a UUID generated at the route layer and passed through), or (b) wrap user message persistence + ADK call in a saga with compensating delete on total failure. Option (a) is simpler and matches the idempotency infrastructure already in place.

---

### P1-3: Cold start recovery persists assistant message with stale `currentVersion`

**File:** `server/src/services/tenant-agent.service.ts` lines 655–660
**Category:** Data Integrity

`recoverSession()` is called with `currentVersion` from the `chat()` caller (line 365). At that point, the user message has already been appended (lines 309–317), so the DB version is `currentVersion + 1`. But `recoverSession()` calls `appendMessage(..., currentVersion)` (line 659), not `currentVersion + 1`.

This means the assistant message append in `recoverSession` will fail the optimistic locking check in `session.repository.ts` line 254 (`session.version !== expectedVersion`). The result: `appendMessage` returns `{ success: false, error: 'Concurrent modification detected' }`, but `recoverSession` does NOT check this return value. It returns `version: currentVersion + 1` to the caller even though the assistant message was silently dropped.

**Concrete trace:**

1. User sends message → user msg appended (version 2 → 3)
2. ADK returns 404 → `recoverSession(tenantId, slug, dbSessionId, userMessage, currentVersion=2)` called
3. Recovery creates new ADK session, gets response
4. `appendMessage(..., expectedVersion=2)` → fails because DB is at version 3
5. Return value `{ success: false }` ignored
6. `recoverSession` returns `{ version: 3, message: agentResponse }` — correct message but assistant msg not saved

**Risk:** After any cold start recovery, the assistant response is returned to the user's screen but not persisted. On the next page load or history fetch, the assistant's message is missing. The session history is permanently incomplete.

**Recommendation:** Pass `currentVersion` as returned by `appendMessage` (line 318: `userMsgResult.newVersion!`) into `recoverSession`, not the pre-append version. The signature of `recoverSession` accepts `currentVersion` — the call at line 365 should pass `currentVersion` (which is `userMsgResult.newVersion!`) rather than the value captured before the user message append.

---

### P1-4: `DELETE /session/:id` is a stub — does nothing

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts` lines 117–134
**Category:** Data Integrity / Simplicity

The DELETE handler logs the request and returns `{ success: true, message: 'Session closed' }` but never calls `tenantAgent` or `sessionService`. The session is never soft-deleted in PostgreSQL. Any frontend that calls this endpoint believing the session is closed will be wrong — the session will survive the cleanup scheduler's 30-day TTL and continue to accumulate storage.

This is a shipped stub masquerading as a working endpoint. It should either be removed (returning 501 Not Implemented) or wired to `sessionService.deleteSession()`.

**Risk:** Sessions pile up without deletion. Frontend state diverges from backend state. No data is immediately leaked, but the contract is violated.

---

## IMPORTANT (P2)

### P2-1: `chat()` fetches `agentSession` directly after `sessionService` already has it

**File:** `server/src/services/tenant-agent.service.ts` lines 283–289
**Category:** Simplicity

After calling `this.sessionService.getSession(dbSessionId, tenantId)` (line 258) to verify the session exists, `chat()` issues a second `prisma.agentSession.findUnique` (line 284) to get `adkSessionId` and `version`. The `SessionService.getSession` call already returns a `SessionWithMessages` which contains `version`. The `adkSessionId` is not in that schema (it's an extra column), but the two-query pattern means an extra round-trip on every chat call.

If `adkSessionId` were included in the `SessionRepository.getSession()` select (or exposed via a lightweight separate query that also returns it), this extra `findUnique` could be eliminated.

**Additionally**, the `version` returned from `sessionService.getSession()` is available but discarded. The code then reads `sessionRow?.version ?? 0` from the separate query. These could be unified.

---

### P2-2: Bootstrap data loaded twice for new sessions in `chat()`

**File:** `server/src/services/tenant-agent.service.ts` lines 241–254
**Category:** Simplicity

When `chat()` is called without a `sessionId`, it calls `this.createSession()` (line 242), which internally calls `this.contextBuilder.getBootstrapData(tenantId)` (line 117). Then `chat()` immediately calls `this.contextBuilder.getBootstrapData(tenantId)` again (lines 247–254) to use the result for context prefix injection.

Two identical network/database calls for the same data within a single request. `createSession` does not return the bootstrap data it fetched.

**Recommendation:** Either have `createSession` return bootstrap data alongside the session, or make the caller responsible for loading bootstrap and passing it in. The double call is pure waste.

---

### P2-3: `recoverSession` duplicates the entire ADK HTTP call pattern from `chat()`

**File:** `server/src/services/tenant-agent.service.ts` lines 537–617 vs lines 333–394
**Category:** Simplicity

`recoverSession()` contains a full copy of the ADK HTTP call logic: token fetch, `fetchWithTimeout`, error handling, `AdkRunResponseSchema.safeParse`, `extractAgentResponse`, `extractDashboardActions`, `extractToolCalls`, tool call schema mapping, and `appendMessage`. This is ~60 lines duplicated almost verbatim from `chat()` (differences: URL for session creation is separate; retry uses the new ADK session ID).

The only meaningful difference between the `chat()` ADK call and the `recoverSession` retry is the session ID used and the message content. Both could share a private `callAdkRun(userId, adkSessionId, message, dbSessionId, tenantId, version)` method.

---

### P2-4: `onboarding-state` response contains hardcoded null/false sentinel values

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts` lines 192–212
**Category:** Simplicity

The `GET /onboarding-state` handler returns a large object with `isReturning: false`, `lastActiveAt: null`, `resumeMessage: null`, `summaries: { discovery: null, ... }`, and `memory.lastEventVersion: 0` — all hardcoded. These fields appear to be stubs for a planned feature (session persistence on the onboarding state) that was never implemented. The frontend is receiving a schema that implies data it will never see.

This violates the project's "no debt" principle (CLAUDE.md). Either implement the fields or remove them from the response contract. Returning fields that are always null/false is misleading to any consumer and makes the contract a lie.

---

### P2-5: `getTenantAgentUrl()` called on every HTTP request (multiple times per chat turn)

**File:** `server/src/services/tenant-agent.service.ts` lines 45–51, called at lines 149, 150, 151, 333, 334, 539, 540, 769–772, 804–806
**Category:** Simplicity / Minor Perf

`getTenantAgentUrl()` calls `getConfig()` and throws if `TENANT_AGENT_URL` is not set — on every single invocation. `getConfig()` is a singleton so the cost is minimal, but the URL is immutable for the process lifetime. Calling `getTenantAgentUrl()` at lines 150 and 151 in the same code block (session creation) calls it twice. Same in `recoverSession` lines 539 and 540.

More importantly, the error surface is deferred: if `TENANT_AGENT_URL` is not set, this blows up mid-request rather than at startup. A simple cached private getter (`private readonly tenantAgentUrl: string` set in constructor) would eliminate all these calls and shift the failure to startup time, consistent with the `getConfig()` fail-fast pattern used elsewhere.

---

### P2-6: Version arithmetic is off-by-one in `chat()` return value

**File:** `server/src/services/tenant-agent.service.ts` line 427
**Category:** Data Integrity

`chat()` returns `version: currentVersion + 1` (line 427). But `currentVersion` is `userMsgResult.newVersion!` (line 318), which is already the post-user-message version (i.e., `expectedVersion + 1`). Then the assistant message append at line 412 uses `currentVersion` as the expected version and internally produces `newVersion = currentVersion + 1`. So after both messages are appended, the actual DB version is `currentVersion + 1`, and the return value of `currentVersion + 1` is correct — but only because the assistant message append happens to succeed and increment again.

If the assistant message append fails (e.g., version mismatch, limit exceeded), `chat()` still returns `version: currentVersion + 1` even though the DB is still at `currentVersion`. The caller will have a stale version cached in frontend state, causing all subsequent calls to fail the version check until the session is re-fetched.

The result of the assistant `appendMessage` call (line 412) should be checked and its `newVersion` (or `currentVersion` if it failed) used as the return value. Currently the return value ignores whether the assistant message append succeeded.

---

### P2-7: `slug` parameter unused in `getSessionHistoryFromAdk` but required in signature

**File:** `server/src/services/tenant-agent.service.ts` line 796, 801
**Category:** Simplicity

`getSessionHistoryFromAdk(tenantId, slug, sessionId)` requires `slug` only to construct `userId = \`${tenantId}:${slug}\``. This is the same `userId`pattern used everywhere. If the ADK GET uses`sessionId`directly (not looking up by userId),`slug`is passed to derive`userId`— which is then included in the URL path. This is consistent behavior, not a bug, but`slug`could be derived from the session record rather than requiring the caller to supply it — especially since`getSessionHistory` already has the DB session and could pull slug from it.

Minor, but the inconsistency between `getSessionHistory(tenantId, slug, sessionId)` (public) and `getSession(sessionId, tenantId)` (private, no slug) adds cognitive overhead.

---

### P2-8: `extractMessagesFromEvents` loses timestamps — all messages get `new Date()`

**File:** `server/src/services/tenant-agent.service.ts` lines 955
**Category:** Data Integrity (ADK fallback path)

The ADK fallback path `getSessionHistoryFromAdk` → `extractMessagesFromEvents` assigns `timestamp: new Date()` (current time) to every message retrieved from ADK. Since ADK `AdkSessionDataSchema` events do not include a timestamp field (the schema at `adk-client.ts` lines 100–115 has no `timestamp`), all historical messages in the legacy ADK fallback will appear to have been sent at the exact moment of the history fetch.

This is the legacy fallback path (for sessions not yet migrated to PostgreSQL), so the blast radius is limited — it will become dead code once all sessions are in PostgreSQL. But any display that sorts or renders by timestamp will show all legacy messages with identical timestamps.

---

## NICE-TO-HAVE (P3)

### P3-1: `DomainVerificationService` instantiated directly in `index.ts` bypassing DI

**File:** `server/src/routes/index.ts` line 658
**Category:** Simplicity

`new DomainVerificationService(prismaClient)` is constructed inline rather than being injected. Consistent with 2–3 other spots in this file but inconsistent with the project's DI pattern. Not introduced by this PR but worth flagging.

---

### P3-2: `contextBuilder` is passed twice to the route factory — once as `tenantAgent` dep and once as direct dep

**File:** `server/src/routes/index.ts` lines 669–679
**Category:** Simplicity

`tenantAgentContextBuilder` is created at line 669. It is passed into `createTenantAgentService(prismaClient, tenantAgentContextBuilder)` (line 673), which stores it as `this.contextBuilder` in `TenantAgentService`. It is also passed directly into `createTenantAdminTenantAgentRoutes({ ..., contextBuilder: tenantAgentContextBuilder })` (line 676).

The route handler uses `contextBuilder.getOnboardingState()` directly in the `GET /onboarding-state` handler (line 183). This is fine — the route correctly delegates non-agent calls directly to the context builder. But it means `contextBuilder` is effectively a shared dep held by two objects. Worth noting that if this ever mutated state, sharing the instance could cause issues.

---

### P3-3: Magic string `'agent'` for `appName` in ADK calls

**File:** `server/src/services/tenant-agent.service.ts` lines 343, 607
**Category:** Simplicity

The string `'agent'` is used twice as the ADK `appName` without a named constant. If this changes (e.g., the agent is renamed or a staging variant is introduced), there are two places to update. A `const ADK_APP_NAME = 'agent'` at the top of the file would be consistent with the project's pitfall-avoidance patterns.

---

### P3-4: Tool call ID uses `Date.now()` — not stable across test/replay

**File:** `server/src/services/tenant-agent.service.ts` lines 404, 648
**Category:** Simplicity

Tool call IDs are generated as `` `tc_${Date.now()}_${idx}` `` at two separate places (in `chat()` and in `recoverSession()`). `Date.now()` produces non-deterministic IDs that make replay testing and deduplication harder. A stable ID derived from the tool name + args hash or a UUID would be more reproducible. This is duplicated logic — the two identical `schemaToolCalls` mapping blocks (lines 402–410 and 644–653) are copy-pasted. Extracting to a private `buildSchemaToolCalls(toolResults)` helper would eliminate both issues.

---

### P3-5: `_version` parameter accepted but not used in `chat()`

**File:** `server/src/services/tenant-agent.service.ts` line 232
**Category:** Simplicity

The `chat()` method signature includes `_version?: number` (the underscore prefix indicates it is intentionally unused). The version is read from the database via the separate `agentSession.findUnique` at line 287 rather than trusted from the caller. This is the correct behavior (don't trust client-supplied versions) but the parameter should be removed from the signature entirely to avoid confusing callers who might think they need to supply it.

---

### P3-6: `hasMore: false` is hardcoded in the PostgreSQL history path

**File:** `server/src/services/tenant-agent.service.ts` line 482
**Category:** Simplicity

`getSessionHistory()` returns `hasMore: false` unconditionally in the primary (PostgreSQL) path. The underlying `SessionService.getSessionHistory()` supports pagination via `limit/offset` and correctly computes `hasMore`, but `TenantAgentService.getSessionHistory` calls `getSession()` (which loads up to 500 messages) rather than `getSessionHistory()` with pagination. If a session exceeds the 500-message limit in `getSession()`, the oldest messages are silently truncated and `hasMore` will never indicate this.

For long-running tenant conversations (common in the onboarding flow), this means history is silently capped at 500 without any indication to the caller.

---

### P3-7: `buildContextSummary` calls `getBootstrapData` inside a method that is called from `recoverSession`, which already called `getBootstrapData` just before

**File:** `server/src/services/tenant-agent.service.ts` lines 512–519, 700–706
**Category:** Simplicity

`recoverSession` calls `this.contextBuilder.getBootstrapData(tenantId)` (lines 516–519) to build `sessionState`. It then calls `this.buildContextSummary(tenantId, dbSessionId)` (line 512), which also calls `this.contextBuilder.getBootstrapData(tenantId)` internally (lines 700–706). That is three calls to `getBootstrapData` for a single cold-start recovery: one in `buildContextSummary` and one in `recoverSession`. (Plus a fourth if the session was freshly created in `chat()` before the ADK call.)

---

### P3-8: `extractMessagesFromEvents` casts `p.text` without non-null assertion but `join('')` receives `(string | undefined)[]`

**File:** `server/src/services/tenant-agent.service.ts` lines 945–948
**Category:** Simplicity

```typescript
let content = event.content.parts
  .filter((p) => p.text)
  .map((p) => p.text) // ← p.text is string | undefined here; filter() doesn't narrow type
  .join('');
```

After `.filter((p) => p.text)`, TypeScript still infers `p.text` as `string | undefined` in the `.map()` because the filter predicate does not narrow to `p is { text: string }`. The `.join('')` will silently convert `undefined` to the string `"undefined"` if any slip through. This mirrors the same pattern in `adk-client.ts` (which uses `p.text!` non-null assertion). The `extractMessagesFromEvents` version does not use `!` — it would produce the literal string `"undefined"` in the output. A type guard filter `(p): p is { text: string } => Boolean(p.text)` or `.map((p) => p.text!)` would fix this.

---

## Summary

| Severity          | Count | Description                                                                  |
| ----------------- | ----- | ---------------------------------------------------------------------------- |
| P1 — Critical     | 4     | Data integrity issues that can cause silent data loss or contract violations |
| P2 — Important    | 8     | Performance waste, version tracking bugs, and misleading API contracts       |
| P3 — Nice-to-have | 8     | Duplication, naming, and minor type safety issues                            |

**Most urgent:** P1-3 (cold start recovery silently drops assistant messages), P1-2 (duplicate user messages on retry with no idempotency key), P1-4 (DELETE endpoint is a silent stub).
