# PR #67 Review Summary — feat: tenant agent session persistence & cold start recovery

**Branch:** `feat/tenant-agent-persistence`
**Date:** 2026-02-20
**Reviewers:** kieran-typescript-reviewer, security-sentinel, architecture-strategist, performance-oracle, code-simplicity-reviewer, data-integrity-guardian, agent-native-reviewer, learnings-researcher, git-history-analyzer

---

## Executive Summary

PR #67 introduces `TenantAgentService` — a PostgreSQL-backed session persistence layer for the tenant-facing AI agent, with cold-start recovery for ADK's `InMemorySessionService`. The route refactor is clean (837 → 310 lines, -63%), the commit history is atomic and well-ordered, and the API contract is fully preserved with zero frontend changes required. The overall architecture mirrors `CustomerAgentService` faithfully and the recovery design is sound.

However, five reviewers independently flagged an overlapping set of issues that cannot be deferred. The most critical are: three raw `prisma.agentSession` operations without `tenantId` scoping (security violation), a silent assistant-message drop on every cold-start recovery due to an off-by-one in version accounting, duplicate user messages on retry due to missing idempotency keys, a no-op `DELETE /session` endpoint that claims success without doing anything, and zero test coverage for a service with complex stateful error paths. Eight of the fifteen unique P1/P2 findings were independently flagged by two or more reviewers, lending high confidence to their severity.

The P1 findings must be resolved before merge. The P2 findings are strongly recommended before merge given the data-integrity implications.

---

## Finding Counts

- P1 Critical (blocks merge): 8
- P2 Important (should fix): 13
- P3 Nice-to-have: 15
- Total unique findings: 36

---

## P1 — CRITICAL (Blocks Merge)

---

### 1. `agentSession.update` / `findUnique` bypass tenant isolation

- **Category:** Security
- **Effort:** Small
- **Flagged by:** kieran-typescript-reviewer, security-sentinel
- **Files:**
  - `server/src/services/tenant-agent.service.ts:200–204` (createSession)
  - `server/src/services/tenant-agent.service.ts:322–328` (chat)
  - `server/src/services/tenant-agent.service.ts:556–559` (recoverSession)
  - `server/src/services/tenant-agent.service.ts:284–288` (findUnique in chat)

Three raw `prisma.agentSession.update` calls and one `prisma.agentSession.findUnique` call filter only by `{ id: dbSessionId }` with no `tenantId` constraint. `SessionRepository.getSession()` correctly scopes by `tenantId`, but after that check the code drops back to raw Prisma calls without tenant guards.

The `findUnique` at line 284 reads `adkSessionId` and `version` for any session by CUID with no ownership verification. An attacker who knows or guesses a valid CUID can read another tenant's `adkSessionId`. The three `update` calls allow overwriting the `adkSessionId` field of any session across tenants, which could redirect another tenant's agent to a hijacked ADK session.

**Fix:** Change `findUnique` to `findFirst` with `{ where: { id: dbSessionId, tenantId } }`. Add `tenantId` to all three `agentSession.update` `where` clauses: `{ where: { id: sessionId, tenantId } }`.

---

### 2. Cold-start recovery silently drops the assistant message (off-by-one version)

- **Category:** Data Integrity
- **Effort:** Small
- **Flagged by:** code-simplicity-reviewer, data-integrity-guardian, architecture-strategist (partial), agent-native-reviewer (partial)
- **File:** `server/src/services/tenant-agent.service.ts:655–660`

`recoverSession()` is called from `chat()` with `currentVersion` equal to `userMsgResult.newVersion!` — the post-user-message version (DB is now at version N). Inside `recoverSession`, the assistant `appendMessage` call passes `currentVersion` (N) as `expectedVersion`. The repository enforces `session.version !== expectedVersion` and rejects a mismatch. If the value passed at the call site is the pre-append version (N-1), the check fails and the assistant message is silently dropped.

Concrete trace:

1. User message appended → DB at version 3 (`userMsgResult.newVersion = 3`)
2. `recoverSession(tenantId, slug, dbSessionId, userMessage, currentVersion=2)` called (pre-append value)
3. Recovery creates ADK session, gets agent response
4. `appendMessage(..., expectedVersion=2)` → fails because DB is at version 3
5. `{ success: false }` return value not checked; silently ignored
6. `recoverSession` returns `{ version: 3, message: agentResponse }` — message shown to user but not saved

Result: after any cold-start recovery, the assistant response appears on the user's screen but is absent from session history on next load.

**Fix:** Verify `recoverSession` is called with `userMsgResult.newVersion` (post-append, N), not the pre-append version. Add a check on the assistant `appendMessage` result inside `recoverSession` and throw or log an error if `success === false`.

---

### 3. User message persisted before ADK call with no idempotency key — duplicate messages on retry

- **Category:** Data Integrity
- **Effort:** Small–Medium
- **Flagged by:** code-simplicity-reviewer, data-integrity-guardian
- **File:** `server/src/services/tenant-agent.service.ts:308–317`

In `chat()`, the user message is saved to PostgreSQL (line 309) before the ADK `/run` call (line 334). If the ADK call fails with a non-recoverable error, the service returns an error to the user but the message is already persisted. On retry the user resends the same text — `appendMessage` generates a new `auto-{timestamp}` idempotency key each time, so the existing unique-constraint deduplication does not fire. The conversation accumulates multiple orphaned user messages with no assistant response between them, breaking the `user/assistant` alternation invariant and polluting the context summary used for recovery.

**Fix:** Generate a stable, request-scoped idempotency key at the route layer (e.g., a UUID passed as `X-Idempotency-Key` header or embedded in the request body) and thread it through to `appendMessage`. This matches the idempotency infrastructure already in the session repository (`idempotencyKey` unique constraint).

---

### 4. DELETE /session/:id is a no-op stub returning `{ success: true }`

- **Category:** Data Integrity / Security
- **Effort:** Small
- **Flagged by:** kieran-typescript-reviewer, security-sentinel, architecture-strategist, code-simplicity-reviewer, data-integrity-guardian, agent-native-reviewer (6 of 5 reviewers — highest consensus finding in this PR)
- **File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts:117–134`

The `DELETE /session/:id` handler logs the request and returns `{ success: true, message: 'Session closed' }` without calling any service method. No soft delete, no cache invalidation, no ADK session closure. The session remains fully active in PostgreSQL and in ADK's InMemorySessionService.

This is a security concern: users who log out expecting their session to be invalidated receive false confirmation while the session persists indefinitely (until the 30-day TTL cleanup job runs). It also breaks the session lifecycle contract stated in the route's JSDoc.

**Fix:** Call `tenantAgent.closeSession(tenantId, sessionId)` (or `sessionService.deleteSession(sessionId, tenantId)`) before returning success. If the feature is not yet implemented, return HTTP 501 Not Implemented rather than false success.

---

### 5. `recoverSession` is public — should be private (parity violation with CustomerAgentService)

- **Category:** Architecture / Data Integrity
- **Effort:** Small
- **Flagged by:** git-history-analyzer
- **File:** `server/src/services/tenant-agent.service.ts:501`

`recoverSession` is an implicit public method. Its equivalent in `CustomerAgentService` — `retryWithNewADKSession` — is `private`. The recovery method has a tight undocumented contract: it assumes `currentVersion` is the already-incremented version (post user-message persist). Any external caller invoking it directly without first calling `chat()` will pass a stale version, causing the assistant `appendMessage` to silently fail via the swallowed catch at line 674.

**Fix:** Add `private` modifier to `recoverSession`.

---

### 6. Missing `local:` ADK session ID sanitization (present in CustomerAgentService, absent here)

- **Category:** Data Integrity / Architecture
- **Effort:** Small
- **Flagged by:** git-history-analyzer
- **File:** `server/src/services/tenant-agent.service.ts:283–289`

`CustomerAgentService` sanitizes legacy `local:` prefixed ADK session IDs at lines 260–265, treating them as null and triggering proper recovery. `TenantAgentService` has no equivalent guard. If any tenant session row has a `local:` prefixed `adkSessionId` (from earlier development iterations), every chat call on that session will fire the recovery path unnecessarily — creating a new ADK session on every message, leaking ADK sessions, and generating spurious WARN logs with no self-healing.

**Fix:** After line 288 in `tenant-agent.service.ts`, add:

```typescript
if (adkSessionId?.startsWith('local:')) {
  logger.warn(
    { adkSessionId },
    '[TenantAgent] Found local: fallback in DB — treating as null for recovery'
  );
  adkSessionId = null;
}
```

---

### 7. No test coverage for TenantAgentService

- **Category:** Quality / Reliability
- **Effort:** Medium
- **Flagged by:** git-history-analyzer, agent-native-reviewer
- **Files:** `server/test/services/tenant-agent.service.test.ts` — does not exist

`CustomerAgentService` has `server/test/services/customer-agent.service.test.ts` and `server/src/routes/public-customer-chat.routes.test.ts`. `TenantAgentService` has no tests. The service contains the most complex stateful logic in this PR: cold-start recovery, optimistic locking, context injection, bootstrap loading, graceful migration of sessions without `adkSessionId`, and multiple error branches. Several of the P1 bugs above (off-by-one version, silent assistant drop, visibility bug) would have been caught by tests.

Known Pattern: `docs/solutions/integration-issues/project-hub-chat-adk-session-and-auth-integration.md` — "Fake sessions pass single-message tests — always test multi-message flows."

**Fix:** Create `server/test/services/tenant-agent.service.test.ts` with minimum coverage for: session creation happy path; chat with existing session; chat with null `adkSessionId` (ADK-recreate path); cold-start recovery (404 → recover → retry); session-not-found migration path; version increment correctness after assistant append; `stripSessionContext` with malformed/missing tags; `buildContextPrefix` with empty bootstrap.

---

### 8. `reason` field in `/skip-onboarding` is an unvalidated raw `req.body` cast

- **Category:** Security
- **Effort:** Small
- **Flagged by:** kieran-typescript-reviewer, security-sentinel
- **File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts:231`

```typescript
const { reason } = req.body as { reason?: string };
```

This bypasses Zod validation entirely. It is a Pitfall #5 violation (type assertion without validation) and Pitfall #12 (route bodies must use `safeParse`). The `reason` value is only used in a log statement currently, but the unvalidated cast means there is no TypeScript protection if it is ever passed deeper.

**Fix:** Define `const SkipOnboardingSchema = z.object({ reason: z.string().max(500).optional() })` and use `safeParse` on `req.body`.

---

## P2 — IMPORTANT (Should Fix)

---

### 9. Double bootstrap data fetch on every new session (N+1 query pattern)

- **Category:** Performance
- **Effort:** Small
- **Flagged by:** architecture-strategist, code-simplicity-reviewer, agent-native-reviewer
- **File:** `server/src/services/tenant-agent.service.ts:241–255, 265–274`
- **Known Pattern:** `docs/solutions/PREVENTION-QUICK-REFERENCE.md` — Database Patterns section (N+1 query pattern)

When `chat()` is called without a `sessionId`, it calls `createSession()` (line 242), which internally calls `this.contextBuilder.getBootstrapData(tenantId)` (line 117). Then `chat()` calls `getBootstrapData` again immediately at line 248. Two full bootstrap queries (each involving multiple Prisma reads: tenant facts, storefront state, onboarding phase, forbidden slots) for every new session. The same double-load occurs in the session-not-found recovery branch at lines 265–274.

**Fix:** Have `createSession()` return the bootstrap data alongside `sessionId`/`version`, or make the caller load bootstrap once and pass it into `createSession()`.

---

### 10. Bootstrap data loaded two to three additional times during recovery

- **Category:** Performance
- **Effort:** Small
- **Flagged by:** architecture-strategist, code-simplicity-reviewer, agent-native-reviewer, git-history-analyzer
- **File:** `server/src/services/tenant-agent.service.ts:512–519, 700–706`

`recoverSession()` calls `buildContextSummary(tenantId, dbSessionId)` (line 512), which internally calls `this.contextBuilder.getBootstrapData(tenantId)` (line 702). Then `recoverSession` calls `getBootstrapData` again directly at line 517. Combined with finding #9 (double fetch in `chat()`) and the `createSession()` internal fetch, a cold-start recovery path for a new session can trigger 3–4 bootstrap fetches within a single request.

**Fix:** Refactor `buildContextSummary` to accept an optional pre-loaded `BootstrapData` parameter. Long term: add a per-request TTL cache (5-second) in `ContextBuilderService.getBootstrapData` keyed by `tenantId`.

---

### 11. `getSessionHistory` loads all 500 messages without pagination

- **Category:** Performance
- **Effort:** Small
- **Flagged by:** architecture-strategist
- **File:** `server/src/services/tenant-agent.service.ts:463–488`

`getSessionHistory` calls `this.sessionService.getSession(sessionId, tenantId)` (not `getSessionHistory`), which fetches up to `MAX_MESSAGES_PER_SESSION = 500` rows in a single query, decrypts them all, and sends the full payload over HTTP. The service wraps the result with `hasMore: false` hardcoded (line 482), disabling pagination entirely. `SessionService.getSessionHistory()` supports pagination via `limit`/`offset` and correctly computes `hasMore`, but it is never called.

**Fix:** Call `sessionService.getSessionHistory(sessionId, tenantId, limit, offset)` with a default of 50–100 messages, and surface `hasMore` and pagination cursor.

---

### 12. `createAdkSession` private helper sends minimal state — no bootstrap context

- **Category:** Architecture / Correctness
- **Effort:** Small
- **Flagged by:** architecture-strategist
- **File:** `server/src/services/tenant-agent.service.ts:763–791`

The private `createAdkSession()` helper called from `chat()` when `adkSessionId` is null (line 322) sends only `{ tenantId, slug }` as session state (line 778). The full bootstrap state injected during `createSession()` (discovery facts, forbidden slots, onboarding phase, storefront state — lines 135–144) is absent. Since the context prefix is only injected for `isNewSession = true` (line 293), a session recreated via `createAdkSession()` in `chat()` will proceed with no initial context — the agent won't know onboarding status, forbidden slots, or discovery facts until explicitly told.

**Fix:** Load bootstrap data in `createAdkSession()` (or accept it as a parameter) and include the full `sessionState` object matching what `createSession()` sends.

---

### 13. Version mismatch on assistant append causes silent message loss and stale client version

- **Category:** Data Integrity
- **Effort:** Small
- **Flagged by:** architecture-strategist, agent-native-reviewer, code-simplicity-reviewer
- **File:** `server/src/services/tenant-agent.service.ts:412–430`

The assistant `appendMessage` call at line 412 is `await`-ed but its return value is not checked. If this append fails (e.g., concurrent write between user append and assistant append bumped the version), `chat()` still returns `version: currentVersion + 1` to the client even though the DB is still at `currentVersion`. The client caches this wrong version, causing all subsequent calls to fail the optimistic lock check until the session is re-fetched.

Additionally, `appendMessage` returning `!success` for the user message at line 315–317 (VERSION_MISMATCH from concurrent modification) throws an error that propagates to Express `next(error)` → 500, with the user message neither in PostgreSQL nor ADK. For tenants with multiple browser tabs, this is a legitimate lost-message scenario.

**Fix:** Check the result of the assistant `appendMessage` call and use `result.newVersion` (not `currentVersion + 1`) as the returned version. For version mismatch on the user message, consider a retry with a freshly read version before returning 500.

---

### 14. Context prefix injection format risks LLM echoing / prompt injection

- **Category:** Architecture / Agent-Native Quality
- **Effort:** Medium
- **Flagged by:** agent-native-reviewer, kieran-typescript-reviewer
- **File:** `server/src/services/tenant-agent.service.ts:877–930 (buildContextPrefix), 583–592 (recovery injection)`
- **Known Pattern:** CLAUDE.md Pitfall #9 — "LLMs copy verbatim." See also `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md` and `docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md`

The `[SESSION CONTEXT]...[END CONTEXT]` block is injected as the `text` of a `user` role message sent to ADK. The LLM may respond to the context block as if it is a user request, echo the sentinel strings back in its response, or interpret the tags as formatting instructions.

Additionally, `key` values in `buildContextPrefix` come from `bootstrap.discoveryFacts` (tenant-supplied strings at line 921). A tenant could store a key containing `[END CONTEXT]` to prematurely close the context block, enabling arbitrary content injection into the structured block parsed by the LLM (prompt injection via tenant-controlled data).

**Recommendation:** Use ADK's native session `state` object as the primary context mechanism (the recovery path already sends `state: sessionState`). Sanitize or reject fact keys containing the sentinel strings. Consider replacing the sentinel format with a JSON block less likely to be echoed verbatim.

---

### 15. Recovery context includes decrypted message content sent over the wire to Cloud Run

- **Category:** Security / Privacy
- **Effort:** Medium
- **Flagged by:** kieran-typescript-reviewer, security-sentinel
- **File:** `server/src/services/tenant-agent.service.ts:731–748 (buildContextSummary)`

Messages are encrypted at rest in PostgreSQL via AES-256-GCM. During recovery, `buildContextSummary` decrypts messages and inserts them into the `recoveryContext` field of `sessionState`, which is sent as a JSON body to Cloud Run (`body: JSON.stringify({ state: sessionState })`). If Cloud Run or ADK logs request bodies (a common GCP default configuration), decrypted message content — potentially PII — appears in plaintext logs.

**Recommendation:** Verify Cloud Run + ADK logging configuration does not capture request bodies. Consider limiting recovery context to structural metadata (onboarding phase, section completion status) rather than actual message content snippets.

---

### 16. Min-instances=1 applied after ADK deploy — brief scale-to-zero window

- **Category:** Deployment / Resilience
- **Effort:** Small
- **Flagged by:** architecture-strategist, agent-native-reviewer
- **File:** `.github/workflows/deploy-agents.yml:246–257`
- **Known Pattern:** CLAUDE.md MEMORY.md — "todo 11054: Per-replica Redis cache" is the documented long-term solution

`npx adk deploy cloud_run` runs first (line 226), then a separate `gcloud run services update` applies `--min-instances=1` (line 253). If ADK deploy resets `minInstanceCount` to 0, there is a 10–30 second window between ADK deploy completion and the `gcloud` update completing where the tenant agent can scale to zero and lose all in-flight InMemory sessions.

Additionally, `min-instances=1` only guarantees one warm instance — under concurrent load, Cloud Run may route requests to additional instances, each with their own `InMemorySessionService`. The 404 recovery path handles this correctly, but recovery fires even without a true cold start.

**Recommendation:** Verify ADK deploy does not reset min-instances. Consider committing a Cloud Run service YAML with `minInstances: 1` to the repo so it is part of the deploy spec rather than a post-deploy patch.

---

### 17. `.env` file with `INTERNAL_API_SECRET` written to disk on CI runner without cleanup

- **Category:** Security
- **Effort:** Small
- **Flagged by:** kieran-typescript-reviewer, security-sentinel
- **File:** `.github/workflows/deploy-agents.yml:200–204`

The workflow writes a `.env` file containing `INTERNAL_API_SECRET` to disk on the CI runner. GitHub Actions masks secrets in logs, so there is no direct log leak — but the file persists on the runner filesystem. Additionally, `MAIS_API_URL` is hardcoded as `https://mais-5bwx.onrender.com` in the workflow file rather than coming from a secret or environment variable.

**Fix:** Add `rm -f .env` in a `if: always()` cleanup step immediately after the deploy step. Move `MAIS_API_URL` to a GitHub environment variable.

---

### 18. `currentVersion` non-null assertion without exhaustive check

- **Category:** Quality / Type Safety
- **Effort:** Small
- **Flagged by:** kieran-typescript-reviewer, security-sentinel
- **File:** `server/src/services/tenant-agent.service.ts:318`

```typescript
const currentVersion = userMsgResult.newVersion!;
```

`newVersion` is `number | undefined` per the return type of `appendMessage`. The check on lines 315–317 verifies `userMsgResult.success` and throws if false, but does not guarantee `newVersion` is defined. If `appendMessage` returns `{ success: true }` without a `newVersion`, the non-null assertion produces `undefined` cast to `number`, leading to silent arithmetic errors (`undefined + 1 = NaN` in version arithmetic). Pitfall #12 violation.

**Fix:** Replace with an explicit guard:

```typescript
if (userMsgResult.newVersion === undefined) {
  throw new Error('appendMessage returned success without newVersion');
}
const currentVersion = userMsgResult.newVersion;
```

---

### 19. `adkSessionId ?? dbSessionId` fallback sends CUID to ADK — unnecessary recovery loop

- **Category:** Architecture / Correctness
- **Effort:** Small
- **Flagged by:** agent-native-reviewer
- **File:** `server/src/services/tenant-agent.service.ts:345`
- **Known Pattern:** `docs/solutions/integration-issues/project-hub-chat-adk-session-and-auth-integration.md` — Fix #2 "Fake Session IDs"

When `adkSessionId` is null after `createAdkSession()` also fails, the fallback `adkSessionId ?? dbSessionId` passes a PostgreSQL CUID (e.g., `clxxx...`) as the ADK session ID. ADK's InMemorySessionService will always 404 on a CUID, triggering the recovery path. This creates a wasted round-trip where a known-bad session ID is sent just to confirm it doesn't exist. If ADK ever responds to the CUID lookup with something other than "Session not found" 404, the fallback behavior is undefined.

**Fix:** When `adkSessionId` is still null after `createAdkSession()`, return a user-facing error immediately rather than sending a known-invalid session ID to ADK.

---

### 20. `_version` parameter accepted and silently discarded — dead code in public API

- **Category:** Quality / API Design
- **Effort:** Small
- **Flagged by:** agent-native-reviewer, git-history-analyzer, code-simplicity-reviewer
- **File:** `server/src/services/tenant-agent.service.ts:231`

The `chat()` signature accepts `_version?: number` (underscore prefix signals intentional discard). `SendMessageSchema` in the route does not include a `version` field, so this parameter is always `undefined`. The service correctly reads version from the DB. The dead parameter is confusing and could mislead future developers. `CustomerAgentService.chat()` has no version parameter at all.

**Fix:** Remove `_version?: number` from the `chat()` signature entirely.

---

### 21. `onboarding-state` response contains hardcoded null/false stubs for unimplemented fields

- **Category:** Architecture / API Design
- **Effort:** Small–Medium
- **Flagged by:** code-simplicity-reviewer, agent-native-reviewer
- **File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts:192–212`

`GET /onboarding-state` returns `isReturning: false`, `lastActiveAt: null`, `resumeMessage: null`, `summaries: { discovery: null, ... }`, and `memory.lastEventVersion: 0` — all hardcoded. Now that PostgreSQL persistence exists in this PR, these fields could be populated from `TenantAgentService`. Returning always-null fields that have documented semantics is a schema lie and violates the project's "no debt" principle (CLAUDE.md).

**Fix:** Either populate these fields from `TenantAgentService`, or remove them from the response contract until implemented.

---

## P3 — NICE-TO-HAVE

---

### 22. `extractMessagesFromEvents` sets all timestamps to `new Date()` — ADK fallback path

- **Category:** Quality / Correctness
- **Effort:** Small
- **Flagged by:** architecture-strategist, code-simplicity-reviewer, agent-native-reviewer, git-history-analyzer
- **File:** `server/src/services/tenant-agent.service.ts:954–955`

The ADK legacy fallback `getSessionHistoryFromAdk` → `extractMessagesFromEvents` assigns `timestamp: new Date()` to every message. All historical messages from legacy sessions appear with identical timestamps (time of the GET request), making chronological ordering impossible. Limited blast radius — becomes dead code once all sessions are migrated to PostgreSQL.

---

### 23. Tool call ID generation uses `Date.now()` — collision risk and copy-pasted logic

- **Category:** Quality
- **Effort:** Small
- **Flagged by:** kieran-typescript-reviewer, architecture-strategist, agent-native-reviewer, code-simplicity-reviewer
- **File:** `server/src/services/tenant-agent.service.ts:404–409, 646–651`

```typescript
id: `tc_${Date.now()}_${idx}`,
```

`Date.now()` has millisecond resolution — concurrent requests at the same millisecond with `idx=0` generate identical IDs. The two identical `schemaToolCalls` mapping blocks (in `chat()` and `recoverSession()`) are copy-pasted logic that should be extracted to a shared private helper. IDs are stored in a JSON column not a primary key, so no DB constraint violation, but deduplication and test replay are harder.

**Fix:** Use `crypto.randomUUID()`. Extract to a private `buildSchemaToolCalls(toolResults)` helper to eliminate duplication.

---

### 24. `DashboardAction` type uses `unknown` payload without runtime validation

- **Category:** Quality / Type Safety
- **Effort:** Small
- **Flagged by:** kieran-typescript-reviewer
- **File:** `server/src/lib/adk-client.ts:130`

`DashboardAction.payload` is `unknown` and flows from ADK responses directly into `res.json({ dashboardActions })` without validation. A Zod schema for `DashboardAction` would provide defense-in-depth if ADK returns unexpected shapes.

---

### 25. `getTenantAgentUrl()` called multiple times per request instead of cached in constructor

- **Category:** Quality / Minor Performance
- **Effort:** Small
- **Flagged by:** code-simplicity-reviewer
- **File:** `server/src/services/tenant-agent.service.ts:45–51, 149–151, 333–334, 539–540, 769–772, 804–806`

`getTenantAgentUrl()` calls `getConfig()` and throws if `TENANT_AGENT_URL` is not set — on every single invocation, including twice in the same code block (lines 150–151, 539–540). If `TENANT_AGENT_URL` is missing, the error surfaces mid-request rather than at startup. A cached `private readonly tenantAgentUrl: string` set in the constructor would shift the failure to startup (consistent with the fail-fast pattern) and eliminate all redundant calls.

---

### 26. `TenantAgentService` not wired through the `Services` DI interface

- **Category:** Architecture
- **Effort:** Small
- **Flagged by:** architecture-strategist
- **File:** `server/src/routes/index.ts:669–678`

`createTenantAgentService` is instantiated inline inside `createV1Router()` rather than being added to the `Services` interface (lines 116–136). This means the service cannot be injected or mocked in tests, diverges from every other service's DI wiring pattern, and `ContextBuilderService` is instantiated twice (line 669 for tenant-agent, line 748 for internal agent routes) creating two independent instances with no shared cache.

---

### 27. `buildContextPrefix` and `stripSessionContext` exported unnecessarily

- **Category:** Quality
- **Effort:** Small
- **Flagged by:** git-history-analyzer
- **File:** `server/src/services/tenant-agent.service.ts:863, 877`

These functions are `export`ed but not imported anywhere outside the file. Exporting them signals to future callers that they can be used independently, bypassing the service contract. `CustomerAgentService` has no equivalent exports — all helpers are module-private.

**Fix:** Remove `export` keywords if not consumed by tests or other modules.

---

### 28. Inconsistent error message tone — Voice Guide violations

- **Category:** Quality / Brand Voice
- **Effort:** Small
- **Flagged by:** git-history-analyzer
- **File:** `server/src/services/tenant-agent.service.ts:375, 389, 436, 444, 451, 575, 621, 677`

Several synthesized fallback error messages (generated by Express when ADK is unreachable) use `'Please try again.'` and `'I had a brief interruption. Please try again.'` — both violate `docs/design/VOICE_QUICK_REFERENCE.md` (no "Please" as filler; no first-person "I" in system messages).

**Fix:** `'Please try again.'` → `'Try again in a moment.'`; `'I had a brief interruption. Please try again.'` → `'Brief interruption. Try again?'`

---

### 29. Rate limiters applied to all agent routes including non-chat endpoints

- **Category:** Architecture / UX
- **Effort:** Small
- **Flagged by:** agent-native-reviewer
- **File:** `server/src/routes/index.ts:679–685`

Both `agentChatLimiter` (30/min) and `agentSessionLimiter` (10/min) are applied to ALL routes under `/v1/tenant-admin/agent/tenant`, including `POST /session` (session creation) and `GET /session/:id` (history retrieval). A tenant creating a session on page load or loading chat history will consume rate limit budget intended for chat messages.

**Fix:** Apply `agentChatLimiter` and `agentSessionLimiter` only to `POST /chat`.

---

### 30. `buildContextSummary` truncation limits are magic numbers with no size cap on ADK state

- **Category:** Quality
- **Effort:** Small
- **Flagged by:** architecture-strategist, git-history-analyzer
- **File:** `server/src/services/tenant-agent.service.ts:735–738, 747`

`80` (topic preview length) and `120` (last message preview length) are hardcoded with no named constants or comments explaining their derivation. No total size cap is enforced on `sessionState` before sending to ADK — for tenants with large `knownFacts` objects, ADK state size limits are undocumented and could cause silent truncation.

**Fix:** Extract to named constants (`RECOVERY_TOPIC_PREVIEW_LENGTH = 80`, etc.) and document why these values were chosen.

---

### 31. `git diff HEAD~1 HEAD` in deploy workflow fragile on squash merges

- **Category:** Deployment / Ops
- **Effort:** Small
- **Flagged by:** agent-native-reviewer
- **File:** `.github/workflows/deploy-agents.yml:84`

`CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)` with `fetch-depth: 2` is fragile on squash merges — when a PR squashes many commits, `HEAD~1` may include changes from many logical changes, triggering all agents to redeploy when only one needed redeployment. Current behavior (deploying all on shared-dep change) is intentional, but the edge case scope is wider than intended.

---

### 32. `$MIN_INSTANCES_FLAG` unquoted in gcloud command — shell portability

- **Category:** Quality / DevOps
- **Effort:** Small
- **Flagged by:** git-history-analyzer
- **File:** `.github/workflows/deploy-agents.yml:251–258`

`$MIN_INSTANCES_FLAG` is unquoted in the `gcloud run services update` call. Safe for current values but a shell portability concern.

**Fix:** Use `${MIN_INSTANCES_FLAG:+$MIN_INSTANCES_FLAG}` for safe empty-string expansion.

---

### 33. ADK app name `'agent'` hardcoded — should be an environment variable

- **Category:** Quality / Ops
- **Effort:** Small
- **Flagged by:** agent-native-reviewer
- **File:** `server/src/services/tenant-agent.service.ts:151, 345, 607`
- **Known Pattern:** `docs/solutions/deployment-issues/google-adk-cloud-run-multi-agent-config.md`

The string `'agent'` appears as a magic constant at three call sites with no named constant. If the registered ADK app name differs from `'agent'`, all session creation and run calls fail silently. Consider externalizing to `TENANT_AGENT_APP_NAME` environment variable with `'agent'` as default.

---

### 34. Route `contextBuilder` dependency creates a leaky abstraction

- **Category:** Architecture
- **Effort:** Small
- **Flagged by:** git-history-analyzer
- **File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts:45–49`

`contextBuilder` remains in `TenantAgentRoutesDeps` because `/onboarding-state` calls it directly, bypassing the stated goal of thin route handlers (routes file comment line 4). Adding a `TenantAgentService.getOnboardingState(tenantId)` proxy method would allow dropping `contextBuilder` from route deps entirely.

---

### 35. `interface` preferred over `type` for object shapes per project convention

- **Category:** Style
- **Effort:** Small
- **Flagged by:** kieran-typescript-reviewer
- **File:** `server/src/lib/adk-client.ts:130`

`AdkToolCall` and `DashboardAction` are declared as `type` but are object shapes that conventionally use `interface`. Minor style finding, no functional impact.

---

### 36. Inline dynamic `import()` type for optional dep in route interface

- **Category:** Style
- **Effort:** Small
- **Flagged by:** kieran-typescript-reviewer
- **File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts:48`

```typescript
tenantOnboarding?: import('../services/tenant-onboarding.service').TenantOnboardingService;
```

Should be a top-level `import type` declaration at the file header for consistency with the rest of the codebase.

---

### 37. Cleanup job treats ADMIN and CUSTOMER sessions identically (30-day TTL)

- **Category:** UX / Data Retention
- **Effort:** Small
- **Flagged by:** architecture-strategist
- **File:** `server/src/jobs/cleanup.ts:62–103`

ADMIN sessions represent the tenant's ongoing AI chat history. A 30-day TTL (same as CUSTOMER sessions) may surprise tenants who return after a month. Consider differentiating: CUSTOMER sessions at 30 days, ADMIN/tenant sessions at 90 days or tied to explicit user-initiated close.

---

## Finding Counts

| Severity                     | Total Unique | Security | Performance | Data Integrity | Architecture | Quality/Style |
| ---------------------------- | ------------ | -------- | ----------- | -------------- | ------------ | ------------- |
| P1 — Critical (blocks merge) | 8            | 2        | 0           | 4              | 1            | 1             |
| P2 — Important (should fix)  | 13           | 2        | 3           | 3              | 3            | 2             |
| P3 — Nice-to-have            | 16           | 0        | 1           | 1              | 3            | 11            |
| **Total**                    | **37**       | **4**    | **4**       | **8**          | **7**        | **14**        |

### Findings by Reviewer Consensus (deduplicated, 2+ independent reviewers)

| Finding # | Title                                                         | Reviewers   |
| --------- | ------------------------------------------------------------- | ----------- |
| 1         | `agentSession.update`/`findUnique` bypass tenant isolation    | 2           |
| 2         | Cold-start recovery silently drops assistant message          | 4 (partial) |
| 4         | DELETE /session is no-op                                      | 6           |
| 9         | Double bootstrap fetch on new session                         | 3           |
| 10        | Bootstrap loaded 2–3x during recovery                         | 4           |
| 13        | Version mismatch → silent message loss / stale client version | 3           |
| 14        | Context prefix injection risks LLM echoing / prompt injection | 2           |
| 16        | Min-instances applied after ADK deploy (race window)          | 2           |
| 20        | `_version` dead parameter                                     | 3           |
| 21        | onboarding-state hardcoded nulls                              | 2           |
| 22        | `extractMessagesFromEvents` loses timestamps                  | 4           |
| 23        | `Date.now()` tool call IDs + copy-paste logic                 | 4           |

### Known Pattern References (from learnings-researcher)

| Finding                               | Solution Doc                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| #9 (double bootstrap / N+1)           | `docs/solutions/PREVENTION-QUICK-REFERENCE.md` — Database Patterns                                                                   |
| #13 (version corruption)              | `docs/solutions/logic-errors/auto-save-race-condition-MAIS-20251204.md`                                                              |
| #14 (state in /run body)              | `docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md` — "State Format Assumptions"                                               |
| #14 (context injection format)        | `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`                                                                   |
| #19 (CUID as ADK session ID fallback) | `docs/solutions/integration-issues/project-hub-chat-adk-session-and-auth-integration.md` — Fix #2 "Fake Session IDs"                 |
| #4 (DELETE no-op)                     | `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`                                                              |
| #7 (no tests for multi-step flows)    | `docs/solutions/integration-issues/project-hub-chat-adk-session-and-auth-integration.md` — "Fake sessions pass single-message tests" |
| #33 (hardcoded ADK app name)          | `docs/solutions/deployment-issues/google-adk-cloud-run-multi-agent-config.md`                                                        |
| #16 (per-replica session isolation)   | CLAUDE.md MEMORY.md — "todo 11054: Per-replica Redis cache"                                                                          |

---

## Architecture Assessment

**Positive findings (no action required):**

- The 4-commit history is atomic, well-ordered, and clearly narrated. No force-pushes, no accidental deletions.
- The route refactor is verified complete: no logic lost, API contract fully preserved, zero frontend changes required. Route handler shrunk from 837 to 310 lines (-63%).
- Zod validation at all ADK response boundaries (`AdkRunResponseSchema.safeParse`, `AdkSessionResponseSchema.safeParse`) follows Pitfall #56.
- A2A camelCase naming (`appName`, `userId`, `sessionId`, `newMessage`) is correct throughout — passes ADK-specific checklist.
- Optimistic locking + advisory locks in the session repository provide correct concurrent write protection at the row level.
- The `stripSessionContext` export from the service for the display layer is a clean separation of concerns.
- Error boundaries are comprehensive — every ADK call has timeout handling, parse failure handling, and user-facing fallback messages.
- The `adkSessionId` field correctly distinguishes the PostgreSQL CUID from the ADK UUID, preventing the `local:` fallback corruption seen in `CustomerAgentService` history (partially — the sanitization guard from customer-agent was not copied; see finding #6).
- The min-instances=1 conditional (tenant-agent only, not customer/research) is correctly implemented with the matrix pattern.
- `CustomerAgentService` AI quota enforcement is correctly absent here — tenants own their agent and are not billed per message.
- `extractDashboardActions` is correctly added to tenant-agent only (a tenant-specific feature).
- Recovery does NOT create an infinite loop — `recoverSession` does not re-enter `chat()`, confirmed by all reviewers.

**Architecture concern (tracking, not blocking):** At ~580 lines, `TenantAgentService` holds three distinct responsibilities: ADK session lifecycle, PostgreSQL persistence delegation, and context/bootstrap management. A future `AdkSessionManager` extraction would leave `TenantAgentService` as a thin orchestrator. Not urgent for this PR.

---

_Report supersedes the prior `REVIEW-SUMMARY.md` (Google Calendar integration review, 2026-02-20). That content is preserved in individual agent findings files in `docs/reviews/`._
