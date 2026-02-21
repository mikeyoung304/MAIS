# Agent-Native & Learnings Review: PR #67

## "feat: tenant agent session persistence & cold start recovery"

**Review Date:** 2026-02-20
**Reviewer:** agent-native-reviewer + learnings-researcher
**Files Reviewed:**

- `server/src/lib/adk-client.ts`
- `server/src/routes/tenant-admin-tenant-agent.routes.ts`
- `server/src/services/tenant-agent.service.ts`
- `server/src/routes/index.ts`
- `.github/workflows/deploy-agents.yml`

---

## CRITICAL (P1)

### P1-1: Infinite Recovery Loop Risk

**File:** `server/src/services/tenant-agent.service.ts` — Lines 360–365 and 501–682

**Finding:** The `chat()` method calls `recoverSession()` on ADK 404. Inside `recoverSession()`, the retry call to `/run` on line 617–628 can itself return a non-200 response — but if that retry _also_ returns 404, the code returns a static error message rather than looping. However, the critical gap is that `recoverSession()` is called from `chat()`, and `recoverSession()` builds a new ADK session and calls `/run` again. If the newly created ADK session immediately 404s on the retry (e.g., if `newAdkSessionId` was accepted by the session endpoint but then not found by `/run` — a race condition possible during high cold-start churn), the code returns a polite error string. This is NOT an infinite loop — it terminates correctly.

**CORRECTION on loop risk:** After second review, there is **no infinite loop** — `recoverSession()` does not call `chat()`, and the retry inside `recoverSession()` does not call `recoverSession()`. Loop risk is NOT P1.

**ACTUAL P1-1: Double bootstrap data fetch on new session**
**File:** `server/src/services/tenant-agent.service.ts` — Lines 241–255 and 268–274

When `chat()` is called without a `sessionId`, it calls `createSession()` (line 242), which itself already calls `this.contextBuilder.getBootstrapData(tenantId)` (line 117). Then `chat()` immediately makes a _second_ call to `getBootstrapData(tenantId)` (line 248). This means every new session creates two redundant database queries for bootstrap data — one in `createSession()` and one immediately after in `chat()`. The same double-load also occurs at lines 265–274 for the session-not-found case.

**Impact:** `BootstrapData` likely involves multiple database reads (tenant facts, storefront state, onboarding phase). Two calls per new session doubles database load on session creation.

**Fix:** `createSession()` should return the bootstrap data alongside `sessionId`/`version` so `chat()` can reuse it, or `createSession()` should be refactored to not internally call `getBootstrapData()` (leaving that to `chat()`).

**Known Pattern:** Related to the "N+1 query pattern" documented in `docs/solutions/PREVENTION-QUICK-REFERENCE.md` (Database Patterns section).

---

### P1-2: Version Corruption on Concurrent Messages

**File:** `server/src/services/tenant-agent.service.ts` — Lines 288–317

`chat()` fetches `currentDbVersion` via a raw `prisma.agentSession.findUnique()` call (line 284–289), then immediately uses it in `appendMessage()` (line 313). However, the `_version` parameter accepted by `chat()` (line 231) is ignored — it's named `_version` with an underscore prefix, signalling intentional discard. This means:

1. The caller (frontend) may pass a version it knows about.
2. The server always reads its own version from DB.
3. The server's version may differ from the caller's version if another tab or session has modified the session concurrently.

This is only a mild issue because `appendMessage()` uses optimistic locking internally (the `expectedVersion` parameter is passed to the repository which enforces it). The version passed to `appendMessage()` is `currentDbVersion` fetched freshly, so the optimistic lock is correct. **However**, the returned `version: currentVersion + 1` (line 427) assumes `appendMessage()` succeeded and the assistant response also got written atomically. The assistant message append (line 412) uses `currentVersion` (the version after user message), but there's no check on that result's `success` field before returning `currentVersion + 1`.

**File:** `server/src/services/tenant-agent.service.ts` — Lines 412–430

```typescript
await this.sessionService.appendMessage(
  dbSessionId,
  tenantId,
  { role: 'assistant', content: agentResponse, toolCalls: schemaToolCalls },
  currentVersion
);
// ... returns currentVersion + 1 — but what if appendMessage failed?
return {
  message: agentResponse,
  sessionId: dbSessionId,
  version: currentVersion + 1,  // Optimistic — not verified
  ...
};
```

If `appendMessage` for the assistant message fails (e.g., concurrent write between the user append and assistant append), the version returned to the client will be wrong. The client will then use `currentVersion + 1` as its session state, but the DB only has `currentVersion` stored (from the user message). Next call will fail optimistic locking.

**Fix:** The assistant `appendMessage` result should be checked, and the actual returned `newVersion` should be used in the response.

---

### P1-3: ADK /run URL is Wrong — Missing /apps Path

**File:** `server/src/services/tenant-agent.service.ts` — Lines 334–354, 597–617

The `chat()` and `recoverSession()` methods call the ADK `/run` endpoint as:

```
`${getTenantAgentUrl()}/run`
```

But ADK session creation endpoints are called as:

```
`${getTenantAgentUrl()}/apps/agent/users/${userId}/sessions`
```

Based on ADK's A2A protocol, the `/run` endpoint path should include the app name: it should be `/apps/{appName}/run` or the root `/run` depending on ADK version. Looking at the existing `adk-client.ts` and how other services call it (e.g., `customer-agent.service.ts` reference in the file header), the `/run` endpoint for the current ADK version used in this project appears to be at the root level. **This is likely correct** if consistent with the customer-agent implementation.

**However**, the body sends:

```typescript
body: JSON.stringify({
  appName: 'agent',
  userId,
  sessionId: adkSessionId ?? dbSessionId,
  newMessage: { ... },
  state: { tenantId },
}),
```

The field `state: { tenantId }` in the `/run` request body is suspicious. ADK's `/run` endpoint does not accept a `state` field — state is injected at session creation time via the `/apps/{appName}/users/{userId}/sessions` POST. Passing `state` to `/run` may be silently ignored by ADK or may cause unexpected behavior. This is not documented in ADK's A2A protocol.

**Known Pattern:** See `docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md` — "State Format Assumptions" section. State should be set at session creation, not at run time.

---

### P1-4: `adkSessionId ?? dbSessionId` Fallback is Dangerous

**File:** `server/src/services/tenant-agent.service.ts` — Line 345

```typescript
sessionId: adkSessionId ?? dbSessionId,
```

When `adkSessionId` is null, this falls back to `dbSessionId` (a PostgreSQL CUID like `cma12345...`). This CUID is passed as `sessionId` to ADK's `/run` endpoint. ADK's InMemorySessionService will not have a session with this ID — it will return a 404, triggering recovery. This creates an unintended recovery loop on the very first message when ADK session creation failed during `createSession()`.

The flow is:

1. `createSession()` is called, ADK session creation fails → `adkSessionId = null`
2. DB session is created successfully → `dbSessionId = "clxxx..."`
3. `chat()` is called → `adkSessionId` is still null
4. `createAdkSession()` is called at line 322 — this is the correct recovery path
5. If `createAdkSession()` also fails → `adkSessionId` remains null
6. `/run` is called with `sessionId: dbSessionId` (a CUID) → ADK returns 404
7. `recoverSession()` is triggered — but the session has 0 messages → empty context summary
8. Recovery creates a new ADK session successfully
9. `/run` retried on fresh session → succeeds

This is actually **functional** but wasteful — there's an extra HTTP round-trip to ADK that will always 404 when ADK session creation fails. More importantly, the 404 "Session not found" recovery path is being used for a fundamentally different case (session never created vs. session expired).

**Risk:** If ADK responds to the CUID session lookup with something other than 404 "Session not found" (e.g., it creates a session with that ID, or returns a different error), the fallback behavior is undefined.

**Fix:** When `adkSessionId` is still null after `createAdkSession()`, return a user-facing error immediately rather than sending a known-bad session ID to ADK.

---

## IMPORTANT (P2)

### P2-1: DELETE /session Does Not Actually Delete the Session

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts` — Lines 117–134

```typescript
router.delete('/session/:id', async (req, res, next) => {
  // ...
  logger.info({ tenantId, sessionId }, '[TenantAgent] Session close requested');
  res.json({ success: true, message: 'Session closed' });
});
```

The DELETE handler logs the request and returns success but **never calls any service method** to actually close or soft-delete the session. The PostgreSQL session record remains active, and any associated ADK session remains open. The response claims success when nothing was done.

**Impact:** Sessions accumulate in PostgreSQL without cleanup. The `startCleanupScheduler` (referenced in `index.ts` line 723) may eventually clean them, but `DELETE /session` gives false confirmation to the frontend.

**Fix:** Call `this.tenantAgent.closeSession(tenantId, sessionId)` (or equivalent) which should call `sessionService.deleteSession()`.

---

### P2-2: Context Summary Injection Format May Confuse the LLM

**File:** `server/src/services/tenant-agent.service.ts` — Lines 583–592

The recovery message format uses custom tags:

```
[SESSION CONTEXT]
Previous conversation summary:
- Business: Acme Photography
- Onboarding: COMPLETED
- Recent topics: Update headline; Change pricing
- Last message (user): Update my about section
[END CONTEXT]

[User's actual message]
```

This format is injected as the `text` of a `user` role message sent to ADK. ADK will present this to Gemini as a user message with embedded system-style context. The LLM may:

1. Try to respond to `[SESSION CONTEXT]` as if it's a user request
2. Include `[SESSION CONTEXT]` in its response if it echoes back
3. Interpret the context tags as formatting instructions

The `stripSessionContext()` function in the service correctly strips these tags from stored messages, but there's no guarantee the LLM won't include the tag text in its response.

**Known Pattern:** CLAUDE.md Pitfall #9: "LLM example responses — Never include example patterns in prompts; LLMs copy verbatim." The context injection format creates a similar risk where the LLM echoes back the context structure in its response.

**Recommendation:** Use ADK's native session `state` object to pass context, not the user message body. The recovery path already creates a new ADK session and sets `state: sessionState` — the `recoveryContext` field in the state object should be the primary mechanism, with the message body containing only the user's actual message.

---

### P2-3: InMemorySessionService + min-instances=1 — Partial Solution

**File:** `.github/workflows/deploy-agents.yml` — Lines 245–258

The deployment correctly sets `min-instances=1` for the tenant agent to prevent cold starts. However, Cloud Run's `min-instances=1` only guarantees _a_ minimum of one instance is kept warm — it does NOT prevent Cloud Run from spinning up additional instances under load, and those additional instances will have their own separate `InMemorySessionService` with no shared state.

**Scenario:** If two requests arrive simultaneously to the tenant-agent, Cloud Run may route them to different instances. Session A created on Instance 1 will not be visible to Instance 2. The 404 recovery path will trigger correctly, but this means cold-start recovery fires even when no cold start has occurred — just traffic routing to a different warm instance.

**Known Pattern:** CLAUDE.md memory — "Per-replica Redis cache (todo 11054, P2)" is the documented solution. The comment in the deploy script is accurate that this helps, but the PR description may overstate the reliability guarantee.

**Impact:** Medium — recovery works correctly but may trigger more frequently than expected under load.

---

### P2-4: Bootstrap Data Loaded Three Times in Recovery

**File:** `server/src/services/tenant-agent.service.ts` — Lines 512–519, 700–706

`recoverSession()` calls `this.contextBuilder.getBootstrapData(tenantId)` (line 517). Inside `buildContextSummary()` (called on line 512), it also calls `this.contextBuilder.getBootstrapData(tenantId)` (line 703). Both calls are within the same recovery invocation, meaning bootstrap data is loaded twice in sequence during every recovery flow.

Additionally, if `chat()` originally called `createSession()` which already loaded bootstrap data, this is the third time bootstrap data is loaded within a single request lifecycle in the migration path.

**Fix:** Pass bootstrap data as a parameter to `buildContextSummary()` rather than loading it independently.

---

### P2-5: `_version` Parameter Accepted but Silently Discarded

**File:** `server/src/services/tenant-agent.service.ts` — Line 231

```typescript
async chat(
  tenantId: string,
  slug: string,
  userMessage: string,
  sessionId?: string,
  _version?: number  // ← prefixed with _ = intentionally unused
): Promise<TenantChatResponse>
```

The caller in `tenant-admin-tenant-agent.routes.ts` does not send `_version` (line 155), so this is currently a dead parameter. If version-based optimistic locking is needed at the route level in the future, this parameter needs to be hooked up — but right now it's silently discarded, which could confuse future developers into thinking version checks are happening.

**Fix:** Either remove the `_version` parameter entirely, or implement it properly.

---

### P2-6: Lack of Tests for Session Persistence and Recovery

**File:** `server/src/services/tenant-agent.service.ts` — entire file

There are no test files visible for `TenantAgentService`. The session persistence logic, cold start recovery, context summary building, and the `stripSessionContext` / `buildContextPrefix` utilities have no test coverage. These are non-trivial code paths with multiple error branches.

**Known Pattern:** `docs/solutions/integration-issues/project-hub-chat-adk-session-and-auth-integration.md` — "Fake sessions pass single-message tests — always test multi-message flows." The ADK session lifecycle (create → use → 404-recover → retry) is exactly the scenario that requires multi-step integration tests.

**Critical missing tests:**

- `stripSessionContext()` with malformed/missing tags
- `buildContextPrefix()` with empty bootstrap data
- `recoverSession()` when `buildContextSummary()` returns null
- Version increment correctness after assistant message append

---

### P2-7: Deployment: min-instances Applied After ADK Deploy (Race Condition Window)

**File:** `.github/workflows/deploy-agents.yml` — Lines 226–258

The workflow deploys via `npx adk deploy cloud_run` first (line 226), then separately calls `gcloud run services update` to set `--min-instances=1` (line 253). There is a brief window between the ADK deploy completing and the `gcloud run services update` completing where the new revision may have zero minimum instances. During this window, the previous instance may be draining while the new instance may scale to zero.

**Impact:** Low probability but possible — a deploy could result in a brief cold-start window even for the tenant agent.

**Fix:** Pass `--min-instances=1` directly to the `npx adk deploy` command if it supports gcloud flags, or restructure to merge the gcloud update with the initial deploy flags. Alternatively, add `--no-traffic` to the initial deploy and only switch traffic after `gcloud run services update` completes.

---

## NICE-TO-HAVE (P3)

### P3-1: `extractMessagesFromEvents` Missing Timestamps

**File:** `server/src/services/tenant-agent.service.ts` — Lines 936–960

```typescript
messages.push({ role, content, timestamp: new Date() });
```

The ADK legacy fallback path (`getSessionHistoryFromAdk`) sets all message timestamps to `new Date()` (the current time), losing the original message timestamp. The `AdkSessionDataSchema` schema (in `adk-client.ts`) parses event timestamps if they exist (`createdAt`, `updatedAt` on the session), but individual event timestamps are not extracted.

**Impact:** Legacy session history via the ADK fallback shows all messages as having the same timestamp (time of the GET request), not their original timestamps.

---

### P3-2: `onboarding-state` Response Shape Includes Hardcoded Nulls

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts` — Lines 196–215

Several fields in the `GET /onboarding-state` response are hardcoded to `null` or `false`:

```typescript
isReturning: false,
lastActiveAt: null,
resumeMessage: null,
summaries: {
  discovery: null,
  marketContext: null,
  ...
},
memory: {
  marketResearchData: null,
  servicesData: null,
  ...
}
```

These fields suggest a planned session persistence feature that is now partially implemented (PostgreSQL persistence exists), but the route has not been updated to read from it. The frontend may be relying on these fields to make decisions. This is a schema lie — the route claims these are dynamic when they're hardcoded.

**Fix:** Either populate these from `TenantAgentService` (now that persistence is in place), or remove the fields from the response contract.

---

### P3-3: Tool Call ID Generation Uses `Date.now()` — Not Monotonic

**File:** `server/src/services/tenant-agent.service.ts` — Lines 402–409

```typescript
toolResults.map((tc, idx) => ({
  id: `tc_${Date.now()}_${idx}`,
  ...
}))
```

`Date.now()` can return the same value for multiple tool calls processed within the same millisecond. The `_${idx}` suffix mitigates this within a single response, but across concurrent requests, IDs may collide. A UUID or CUID would be more robust.

---

### P3-4: Deploy Workflow `detect-changes` Uses `HEAD~1` — Fragile on Squash Merges

**File:** `.github/workflows/deploy-agents.yml` — Line 84

```bash
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)
```

When using squash merges (common for PRs), `HEAD~1` may represent a commit that occurred weeks ago if this is the first push in a while, or may not exist if the repo was freshly cloned with `fetch-depth: 2`. The `fetch-depth: 2` on line 64 ensures exactly 2 commits are available, but for fast-forward or squash-only workflows, `HEAD~1` may not represent the expected diff scope.

**Impact:** Low on main branch with regular pushes. High if the workflow runs after a long gap or a squash merge of many commits — all changed files from the entire PR will be in the diff, which may trigger all agents to deploy when only one changed.

**Note:** The current behavior (deploying all agents when shared deps change) is intentional and documented. This finding is only about the edge case where the diff includes unintended scope.

---

### P3-5: `agentChatLimiter` and `agentSessionLimiter` Both Applied to All Agent Routes

**File:** `server/src/routes/index.ts` — Lines 679–685

```typescript
app.use(
  '/v1/tenant-admin/agent/tenant',
  tenantAuthMiddleware,
  agentChatLimiter,
  agentSessionLimiter,
  tenantAdminTenantAgentRoutes
);
```

Both `agentChatLimiter` (30/min) and `agentSessionLimiter` (10/min) are applied to ALL routes under `/v1/tenant-admin/agent/tenant`, including `POST /session` (session creation) and `GET /session/:id` (history retrieval). Session creation and history retrieval are not chat messages and should not be subject to the same rate limits as `POST /chat`. A tenant creating a new session on page load will consume rate limit budget.

**Fix:** Apply `agentChatLimiter` and `agentSessionLimiter` only to the `POST /chat` route, not the session management routes.

---

### P3-6: ADK App Name Hardcoded as `'agent'` — No Validation

**File:** `server/src/services/tenant-agent.service.ts` — Lines 151, 345, 607

The app name `'agent'` is hardcoded in multiple places. Per the deployment pattern documented in `docs/solutions/patterns/ADK_CLOUD_RUN_SERVICE_NAME_QUICK_REFERENCE.md` and `docs/solutions/deployment-issues/google-adk-cloud-run-multi-agent-config.md`, the actual app name should be verified via `{URL}/list-apps` after deployment. If the app name registered in ADK differs from `'agent'`, all session creation and run calls will fail silently or return "App not found" errors.

**Fix:** Consider externalizing the app name to an environment variable `TENANT_AGENT_APP_NAME` with a default of `'agent'`.

---

## Learnings Research Summary

### Patterns Matched from `docs/solutions/`

| Finding                         | Related Solution Doc                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| P1-2 (Version corruption)       | `docs/solutions/logic-errors/auto-save-race-condition-MAIS-20251204.md`                                               |
| P1-3 (State in /run body)       | `docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md` (Issue 2)                                                   |
| P1-4 (Bad session ID fallback)  | `docs/solutions/integration-issues/project-hub-chat-adk-session-and-auth-integration.md` (Fix #2: "Fake Session IDs") |
| P2-1 (DELETE no-op)             | `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`                                               |
| P2-2 (Context injection format) | `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`                                                    |
| P2-3 (min-instances partial)    | CLAUDE.md memory: "todo 11054 — Per-replica Redis cache"                                                              |
| P2-6 (No tests)                 | `docs/solutions/integration-issues/project-hub-chat-adk-session-and-auth-integration.md`                              |
| P3-3 (Tool call ID)             | `docs/solutions/PREVENTION-QUICK-REFERENCE.md` (Database Patterns)                                                    |

### ADK-Specific Checklist Results

| Check                                                         | Result                                                                                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FunctionTool `parameters`/`execute` API                       | N/A — no FunctionTool definitions in reviewed files                                                                                                                                 |
| `ToolContext \| undefined`                                    | N/A — no FunctionTool definitions in reviewed files                                                                                                                                 |
| A2A camelCase: `appName`, `userId`, `sessionId`, `newMessage` | PASS — all camelCase in `/run` body                                                                                                                                                 |
| No `"You: 'On it!'"` style example responses in prompts       | PASS — no prompts in reviewed files                                                                                                                                                 |
| InMemorySessionService correctly used with persistence layer  | PARTIAL — ADK has no persistent backend; PostgreSQL is the canonical store, ADK is reconstructed on cold start. Architecture is sound but depends on 404 recovery firing correctly. |
| Session ID format ADK compatibility                           | CONCERN — ADK session IDs are UUIDs; PostgreSQL session IDs are CUIDs. The fallback `adkSessionId ?? dbSessionId` may pass a CUID to ADK (P1-4).                                    |
| Context summary injection format                              | CONCERN — injected via user message body, not session state (P2-2)                                                                                                                  |
| ADK 404 recovery loop safety                                  | PASS — no infinite loop; recovery does not re-enter `chat()`                                                                                                                        |
| Agent session state machine correctness                       | PASS — session lifecycle is coherent; PostgreSQL is authoritative                                                                                                                   |

### Deployment Checklist Results

| Check                                              | Result                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `min-instances=1` for tenant-agent only            | PASS — conditional on `matrix.agent == "tenant"` (line 248)                           |
| Customer/research agents remain scale-to-zero      | PASS                                                                                  |
| Cost implications understood                       | PASS — comment in deploy.yml explains intent                                          |
| Deployment safety                                  | CONCERN — race window between ADK deploy and min-instances update (P2-7)              |
| `--service_name` explicitly set                    | PASS — `${{ matrix.agent }}-agent` pattern used                                       |
| Shared dependency changes trigger all-agent deploy | PASS — correctly triggers on `server/src/services/**` and `server/src/lib/**` changes |

---

## Summary Table

| Priority | Count                                                        | Key Issues                                                                                                                                                                |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | 2 actual (P1-1 reclassified; P1-3 and P1-4 are highest risk) | Double bootstrap fetch, assistant append version not verified, `state` in `/run` body, CUID fallback as ADK session ID                                                    |
| P2       | 6                                                            | DELETE /session no-op, recovery context format, min-instances partial fix, triple bootstrap fetch, `_version` dead parameter, zero test coverage                          |
| P3       | 6                                                            | Missing timestamps in ADK fallback, hardcoded nulls in onboarding-state, Date.now() tool IDs, fetch-depth fragility, rate limiters on non-chat routes, hardcoded app name |

**Highest Priority Fix:** P1-4 (CUID as ADK session ID fallback) and P2-1 (DELETE /session is a no-op) — both are straightforward bugs with clear fixes.
