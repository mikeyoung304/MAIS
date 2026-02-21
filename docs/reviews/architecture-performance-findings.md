# Architecture & Performance Review: PR #67

## feat: tenant agent session persistence & cold start recovery

**Reviewers:** architecture-strategist + performance-oracle
**Date:** 2026-02-20
**Branch:** feat/tenant-agent-persistence
**Files reviewed:**

- `server/src/lib/adk-client.ts`
- `server/src/routes/tenant-admin-tenant-agent.routes.ts`
- `server/src/services/tenant-agent.service.ts`
- `server/src/routes/index.ts`
- `.github/workflows/deploy-agents.yml`
- `server/src/services/customer-agent.service.ts` (reference)
- `server/src/services/session/session.service.ts` + `session.repository.ts`
- `server/prisma/schema.prisma` (AgentSession + indexes)

---

## CRITICAL (P1)

### P1-001: Optimistic Locking Version Incorrect After Assistant Message Persist

**File:** `server/src/services/tenant-agent.service.ts`, lines 401–430

The `appendMessage` call for the assistant message at line 412 passes `currentVersion` as the `expectedVersion`, but `currentVersion` was returned as the version **after** the user message was appended (i.e., `userMsgResult.newVersion`, which equals `expectedVersion + 1` from the repository). The repository's `appendMessage` checks `session.version !== expectedVersion`, so when the user message bumped version to N+1, passing N+1 as expected for the assistant message is correct — however, there is an off-by-one in the return value at line 428:

```typescript
return {
  ...
  version: currentVersion + 1,   // line 428: claims version is currentVersion+1
```

But the assistant append also increments the DB version, making the true DB version `currentVersion + 1`. The returned version is correct. **However**, the same pattern in `recoverSession()` at line 658:

```typescript
await this.sessionService.appendMessage(
  dbSessionId,
  tenantId,
  { role: 'assistant', content: agentResponse, toolCalls: schemaToolCalls },
  currentVersion // line 658: currentVersion is the version AFTER user message
);
```

After the user message in `chat()` was persisted (bumping DB version to `currentVersion`), `recoverSession` uses `currentVersion` for the assistant append — which is correct since recovery is a separate call path. But the user message has **already been persisted** in `chat()` before `recoverSession` is called (line 309–317), meaning the DB version is already `currentVersion`. Passing `currentVersion` as expected version for the assistant message in recovery is correct.

**True P1 issue:** The `currentVersion` value passed into `recoverSession` (line 365) is the version returned from `userMsgResult.newVersion!` (line 318) — this is the post-user-message version. The assistant `appendMessage` in `recoverSession` at line 655 passes this same value. This is correct. However, the returned `version` in `recoverSession` at line 670:

```typescript
version: currentVersion + 1,
```

...would be `(userMsgResult.newVersion + 1)`, but the actual DB version after appending the assistant message is `userMsgResult.newVersion + 1` — so the return is correct.

**Revised P1 finding:** There is a genuine race condition when `chat()` is called concurrently for the same session. The service has no per-session mutex or distributed lock at the **service level**. The repository uses advisory locks inside the transaction, but `chat()` reads `adkSessionId` at line 284–288 via a **separate `prisma.agentSession.findUnique`** call (outside any transaction), creates an ADK session, updates the DB (line 324), then calls the ADK (line 334), then persists again (line 412). A concurrent request for the same session can read `adkSessionId = null` simultaneously and create **two** ADK sessions for the same `dbSessionId`. The second update wins (last-write wins on `adkSessionId`), leaking an orphaned ADK session on Cloud Run with no cleanup mechanism.

**Impact:** Low probability but non-zero. Two simultaneous browser tabs or rapid retries could trigger it. The orphaned ADK session consumes Cloud Run InMemorySessionService memory with no GC path.

---

### P1-002: Double Bootstrap Load on Cold-Path Chat

**File:** `server/src/services/tenant-agent.service.ts`, lines 240–278

When `sessionId` is not provided (line 240), `chat()` calls `this.createSession()` which already calls `this.contextBuilder.getBootstrapData(tenantId)` internally (line 117). Then `chat()` calls `getBootstrapData` **again** at line 248. This causes two redundant database reads for bootstrap context (discovery facts, storefront state, forbidden slots) on every new session creation path.

```typescript
// line 241-255: createSession already fetches bootstrap
const session = await this.createSession(tenantId, slug);
// ...
// line 246-254: redundant second fetch
try {
  bootstrap = await this.contextBuilder.getBootstrapData(tenantId);
```

The same double-load occurs in the session-not-found branch at lines 266–274.

**Impact:** Every new tenant agent session triggers at least 2 full bootstrap queries. The `ContextBuilderService.getBootstrapData` likely does multiple Prisma queries (discovery facts, sections, forbidden slots). Under load this doubles the DB read cost for session initialization.

---

### P1-003: Silent Session State Leak on ADK Creation Failure

**File:** `server/src/services/tenant-agent.service.ts`, lines 182–211

When ADK session creation fails (line 183–191), `adkSessionId` is set to `null` and a PostgreSQL session is created with `adkSessionId = null` (line 201). The `chat()` method at line 320–329 then attempts to create an ADK session inline. If this second creation also fails, the `chat()` call proceeds to call `/run` with `sessionId: adkSessionId ?? dbSessionId` (line 345), using the **PostgreSQL CUID** as the ADK session ID. ADK will always return 404 for a CUID (it only recognizes its own UUID-format session IDs), triggering `recoverSession`, which will try to create yet another ADK session. This creates an infinite recovery loop on a degraded Cloud Run instance.

The termination condition is that `recoverSession` returns a user-facing error if `newAdkSessionId` is null (line 570–581), so it does not loop infinitely. But the cascade is: 3 failed network calls to Cloud Run before returning a degraded response, each with a 30-second timeout from `fetchWithTimeout`. Total worst-case latency: **90 seconds** before the user sees an error message.

**Impact:** During Cloud Run cold starts or deployments, users can experience up to 90-second hangs before receiving a degraded response. This is above the 30-second ADK fetch timeout stacking.

---

## IMPORTANT (P2)

### P2-001: Missing Index on `adkSessionId` Field

**File:** `server/prisma/schema.prisma`, lines 919–953

The `AgentSession.adkSessionId` field (line 924) has no index. The service performs `prisma.agentSession.findUnique({ where: { id: dbSessionId }, select: { adkSessionId: true } })` (lines 284–288) which uses the primary key — this is fine. However, if any future diagnostic/admin query needs to look up by `adkSessionId` (e.g., "which DB session is associated with ADK session X?"), it would be a full table scan. More importantly, `adkSessionId` is nullable and updated after creation — it should have at least a sparse index for debugging without table scans.

**Recommendation:** Add `@@index([adkSessionId])` with a `where: { adkSessionId: { not: null } }` partial index when possible, or at minimum a standard index.

---

### P2-002: `getSessionHistory` Loads ALL Messages (No Pagination in Service)

**File:** `server/src/services/tenant-agent.service.ts`, lines 463–488

The `getSessionHistory` method calls `this.sessionService.getSession(sessionId, tenantId)` (line 464), which internally calls `repository.getSession()` — which fetches up to `MAX_MESSAGES_PER_SESSION = 500` messages in one query. For a tenant with an active long-running session, this returns up to 500 encrypted message rows in a single query, decrypts them all, and sends the full payload over HTTP.

The service wraps result with `hasMore: false` and `total: messages.length` (lines 481–483), disabling pagination entirely at the API layer. Clients receiving 500 messages in one response is a correctness and performance issue.

The `getSessionHistory` on `SessionService` supports pagination via `limit` and `offset` parameters (line 206–218) but this method is **not called** — `getSession` is called instead.

**Recommendation:** Use `sessionService.getSessionHistory(sessionId, tenantId, limit, offset)` with a sensible default of 50–100 messages, and surface `hasMore` and pagination cursor to the client.

---

### P2-003: `buildContextSummary` Fetches Bootstrap Twice During Recovery

**File:** `server/src/services/tenant-agent.service.ts`, lines 512–534

`recoverSession` calls `buildContextSummary(tenantId, dbSessionId)` (line 512), which internally calls `this.contextBuilder.getBootstrapData(tenantId)` (line 702). Then `recoverSession` **also** calls `this.contextBuilder.getBootstrapData(tenantId)` directly at line 517. This is two bootstrap fetches inside a single recovery invocation.

Combined with P1-002 (double fetch in `chat()`), a cold-start recovery path can trigger **3–4 bootstrap fetches** for a single user message.

---

### P2-004: DELETE /session/:id Route is a No-Op

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`, lines 117–134

The DELETE `/session/:id` handler logs the request and returns `{ success: true, message: 'Session closed' }` but **never calls any service method**. No soft delete, no cache invalidation, no ADK session deletion. The session remains active in PostgreSQL and the ADK. This breaks the session lifecycle contract stated in the route file's JSDoc.

```typescript
// line 129: logs the intent...
logger.info({ tenantId, sessionId }, '[TenantAgent] Session close requested');
// line 131: ...but returns success without doing anything
res.json({ success: true, message: 'Session closed' });
```

**Impact:** Tenants who close their browser session and expect session cleanup get none. Over time, ADMIN-type sessions accumulate without any close-triggered cleanup path, only relying on the 30-day TTL cleanup job.

---

### P2-005: Context Prefix Injected Into User Message Sent to ADK But Stored Clean

**File:** `server/src/services/tenant-agent.service.ts`, lines 291–307 and 308–317

The `messageWithContext` variable (with injected `[SESSION CONTEXT]` block) is sent to ADK (line 348), but the `appendMessage` call at line 309–313 stores the **original** `userMessage` without the context prefix. This is intentional ("Store without context prefix (display-clean)"), but the ADK session now has a different message history than the PostgreSQL session. On cold start recovery, `buildContextSummary` reads from PostgreSQL and constructs a summary — but the ADK's version of the first message included the full bootstrap context block, while the PostgreSQL version does not.

This means during recovery, the `recoverSession` reinjects context via `[SESSION CONTEXT]...[END CONTEXT]` block on the retry message (lines 584–592), which is the correct approach. However, because the original bootstrap context was not in PostgreSQL, the recovery context is **approximate**, not a replay of the original conversation. The ADK agent had different initial context than what recovery provides.

**Impact:** After cold start recovery, the agent's effective context is slightly different from the original session's context. Discovery facts and forbidden slots are re-injected (via bootstrap), but any mid-conversation context updates made by the agent (e.g., facts the agent discovered during the session) are not captured in the summary — only the last 10 messages' text. This is a known architectural limitation but not documented at the recovery path.

---

### P2-006: `.github/workflows/deploy-agents.yml` — Min-Instances Applied on Every Shared-Dep Trigger

**File:** `.github/workflows/deploy-agents.yml`, lines 246–257

When shared dependencies change (line 90–98), all three agents redeploy. The `gcloud run services update` step sets `--min-instances=1` only for the tenant agent. However, the step runs **after** `npx adk deploy cloud_run`, which may reset min-instances to 0 (ADK's default). There is a 5-second `sleep` at line 262 after deploy, but the `gcloud run services update` at line 253 correctly re-applies `--min-instances=1` after ADK deploy.

The actual gap: if `npx adk deploy cloud_run` itself resets Cloud Run's `minInstanceCount` to 0 as part of its deployment spec, then there is a brief window (between ADK deploy completing and `gcloud run services update` completing) where the tenant agent can scale to zero, losing all in-flight sessions. This window is typically 10–30 seconds during the update.

**Recommendation:** Verify that ADK deploy does not reset min-instances. Consider setting `--min-instances=1` via Cloud Run YAML config committed to the repo rather than relying on post-deploy CLI commands.

---

### P2-007: `createAdkSession` Private Method Sends Minimal State (Missing Bootstrap)

**File:** `server/src/services/tenant-agent.service.ts`, lines 763–791

The private `createAdkSession()` helper at line 763 only sends `{ tenantId, slug }` as session state (line 778). This method is called in `chat()` at line 322 when `adkSessionId` is null but a PostgreSQL session already exists. The full bootstrap state (discovery facts, forbidden slots, onboarding phase, storefront state) is NOT injected, unlike `createSession()` which sends the full `sessionState` object (lines 135–144).

A tenant chat session created without the bootstrap state will have a degraded agent experience — the agent won't know the forbidden slots, discovery facts, or onboarding status until the context prefix is injected with the first message. But since the context prefix is only injected for `isNewSession = true` (line 293), a session recovered via `createAdkSession` in `chat()` will get **no context injection** in the current message.

---

### P2-008: Version Mismatch Not Retried — Silent Message Loss

**File:** `server/src/services/tenant-agent.service.ts`, lines 315–317

When `appendMessage` returns `!userMsgResult.success`, `chat()` throws: `throw new Error(userMsgResult.error || 'Failed to save user message')`. However, the error propagates to the outer `try/catch` at line 431 only if it is not caught — the throw at line 316 is **outside** the inner try/catch block (which starts at line 331). So it will propagate to Express's `next(error)` and return a 500 to the client.

A VERSION_MISMATCH error (from concurrent modification) results in a 500, with the user message stored in neither PostgreSQL nor the ADK. The user sees a 500 error, their message is lost, and no retry is attempted. This is particularly problematic because the optimistic lock is per-message — concurrent tabs could cause legitimate version mismatches that silently lose messages.

**Impact:** Non-retrying version mismatches cause message loss for tenants with multiple browser tabs open simultaneously.

---

## NICE-TO-HAVE (P3)

### P3-001: `stripSessionContext` Used Inconsistently — Only in `getSessionHistory`, Not `chat()` Response

**File:** `server/src/services/tenant-agent.service.ts`, lines 468–470

`getSessionHistory()` applies `stripSessionContext()` to message content (line 469). However, `chat()` returns `result.message` (line 162 in routes file) which is the raw `agentResponse` from ADK — never stripped. If the agent's response begins with a context echo (unlikely but possible), it would be returned to the client verbatim. This is a low-risk inconsistency.

---

### P3-002: Tool Call ID Generation Uses `Date.now()` — Collision Risk in Same Millisecond

**File:** `server/src/services/tenant-agent.service.ts`, lines 402–410 and 645–653

Tool call IDs are generated as `tc_${Date.now()}_${idx}`. If multiple tool calls complete within the same millisecond (common for parallel tool executions in ADK), `Date.now()` is identical and `idx` is the differentiator. This is generally safe but is not semantically unique across sessions — the same pattern exists in `customer-agent.service.ts`. A UUID would be more appropriate.

---

### P3-003: `extractMessagesFromEvents` Assigns `new Date()` as Timestamp

**File:** `server/src/services/tenant-agent.service.ts`, lines 954–955

The ADK fallback `getSessionHistoryFromAdk()` uses `extractMessagesFromEvents()` which sets `timestamp: new Date()` for all messages (line 955). This loses the actual message ordering information from ADK events. Messages will all have the same timestamp (time of the GET request), making chronological ordering impossible.

---

### P3-004: `min-instances=1` Costs ~$22/month Continuously

**File:** `.github/workflows/deploy-agents.yml`, lines 248–250

Setting `--min-instances=1` on the tenant-agent Cloud Run service prevents scale-to-zero. At the us-central1 region rates for Cloud Run, 1 always-on instance of the default configuration (1 CPU, 512MB RAM) costs approximately $22/month. For a pre-revenue SaaS, this is a known trade-off (documented in ADR and MEMORY.md as intentional) but worth tracking. The cold-start recovery mechanism in `TenantAgentService` now provides a fallback, so a periodic re-evaluation of whether min-instances=1 is still necessary is recommended once the recovery path is proven in production.

---

### P3-005: `createTenantAgentService` Created Inline in `index.ts` — Not Wired as Proper DI Service

**File:** `server/src/routes/index.ts`, lines 669–678

`createTenantAgentService` is instantiated inline within `createV1Router()` (line 673) rather than being wired through the `Services` interface (lines 116–136). The `Services` interface at line 116 lists all services but `TenantAgentService` is absent. This means:

- The service cannot be mocked in tests
- The service is recreated on every `createV1Router()` call (normally only once, but notable for test isolation)
- The pattern diverges from every other service's DI wiring

`ContextBuilderService` is also instantiated twice: once at line 669 (for tenant-agent) and once at line 748 (for internal agent routes). Both share the same `prismaClient` but are separate instances with no shared cache.

---

### P3-006: Cleanup Job Does Not Distinguish Session Type — ADMIN Sessions Cleaned at 30 Days

**File:** `server/src/jobs/cleanup.ts`, lines 62–103

The `cleanupExpiredSessions` job soft-deletes all sessions with `lastActivityAt < 30 days ago` regardless of `sessionType`. ADMIN sessions (tenant-agent) represent the tenant's chat history and should arguably be retained longer than CUSTOMER sessions. The 30-day TTL may surprise tenants who expect to return to their agent chat after a month's absence.

**Recommendation:** Consider differentiating cleanup TTL by session type: CUSTOMER sessions at 30 days, ADMIN/tenant sessions at 90 days or with an explicit user-initiated close.

---

### P3-007: `recoverSession` Context Summary Truncates Messages to 80 Characters

**File:** `server/src/services/tenant-agent.service.ts`, lines 731–740

The recovery context summary truncates each message to 80 characters (line 736) and takes only the first 5 topics (line 740). For a complex onboarding conversation with multi-sentence messages, 80 characters captures approximately the first sentence. The last message gets 120 characters (line 747). This is a pragmatic choice to keep the recovery context small for the ADK session state, but it means the agent after recovery has very limited conversational context beyond the most recent message.

No token budget or size cap is enforced on the overall recovery context. For a session with many stored facts (discovery facts object + storefront state), the full `sessionState` injected into the recovery ADK session (lines 523–534) could be large. The ADK session state size limit is not documented, so large `knownFacts` objects could silently fail or be truncated by ADK.

---

## Summary Table

| ID     | Severity  | Category       | File                                          | Impact                                                      |
| ------ | --------- | -------------- | --------------------------------------------- | ----------------------------------------------------------- |
| P1-001 | CRITICAL  | Race Condition | `tenant-agent.service.ts:284-329`             | Orphaned ADK sessions on concurrent requests                |
| P1-002 | CRITICAL  | Performance    | `tenant-agent.service.ts:240-278`             | Double bootstrap DB query on every new session              |
| P1-003 | CRITICAL  | Resilience     | `tenant-agent.service.ts:182-211`             | 90-second worst-case hang during Cloud Run degradation      |
| P2-001 | IMPORTANT | Performance    | `schema.prisma:924`                           | Missing index on `adkSessionId`                             |
| P2-002 | IMPORTANT | Performance    | `tenant-agent.service.ts:463-488`             | Up to 500 messages loaded without pagination                |
| P2-003 | IMPORTANT | Performance    | `tenant-agent.service.ts:512-534`             | Double bootstrap fetch during recovery                      |
| P2-004 | IMPORTANT | Correctness    | `tenant-admin-tenant-agent.routes.ts:117-134` | DELETE /session is a no-op                                  |
| P2-005 | IMPORTANT | Architecture   | `tenant-agent.service.ts:291-317`             | ADK vs PostgreSQL message content mismatch                  |
| P2-006 | IMPORTANT | Deployment     | `deploy-agents.yml:246-257`                   | Min-instances may reset during ADK redeploy                 |
| P2-007 | IMPORTANT | Correctness    | `tenant-agent.service.ts:763-791`             | `createAdkSession` injects minimal state                    |
| P2-008 | IMPORTANT | Data Integrity | `tenant-agent.service.ts:315-317`             | Version mismatch causes silent message loss                 |
| P3-001 | P3        | Consistency    | `tenant-agent.service.ts:468-470`             | `stripSessionContext` not applied to chat responses         |
| P3-002 | P3        | Code Quality   | `tenant-agent.service.ts:402-410`             | `Date.now()` tool call IDs                                  |
| P3-003 | P3        | Correctness    | `tenant-agent.service.ts:954-955`             | All ADK fallback messages get `new Date()` timestamp        |
| P3-004 | P3        | Cost           | `deploy-agents.yml:248-250`                   | Min-instances=1 ~$22/month                                  |
| P3-005 | P3        | Architecture   | `index.ts:669-678`                            | TenantAgentService not in DI Services interface             |
| P3-006 | P3        | UX             | `cleanup.ts:70-78`                            | ADMIN sessions cleaned at same TTL as CUSTOMER              |
| P3-007 | P3        | Resilience     | `tenant-agent.service.ts:731-740`             | Context summary 80-char truncation, no ADK state size guard |

---

## Architecture Assessment

**Positive findings:**

- The mirroring of `CustomerAgentService` is faithful and correct. The API-mediated topology (Express owns session lifecycle, Cloud Run stays stateless) is properly implemented.
- Zod validation at all ADK response boundaries (`AdkRunResponseSchema.safeParse`, `AdkSessionResponseSchema.safeParse`) follows Pitfall #56.
- Tenant scoping is correct in all database queries — no cross-tenant leakage vectors found.
- Optimistic locking + advisory locks in the session repository provide correct concurrent write protection at the row level.
- The `stripSessionContext` export from the service for use in display layer is a clean separation.
- Error boundaries are comprehensive — every ADK call has explicit timeout handling, parse failure handling, and user-facing fallback messages.
- The `adkSessionId` field correctly distinguishes between the PostgreSQL CUID session identifier and the ADK UUID, preventing the `local:` fallback corruption seen in CustomerAgentService history.

**Architecture concern:** The 580-line `TenantAgentService` is approaching god-class territory. Three distinct responsibilities are present:

1. ADK session lifecycle management (create, recover, retry)
2. PostgreSQL session persistence (delegate to SessionService)
3. Context/bootstrap management (delegate to ContextBuilderService)

A future refactor could extract `AdkSessionManager` for the ADK lifecycle concerns, leaving `TenantAgentService` as a thin orchestrator. Not urgent, but worth tracking.
