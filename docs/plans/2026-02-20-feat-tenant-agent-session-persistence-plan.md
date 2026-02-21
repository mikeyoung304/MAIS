---
title: 'feat: Tenant Agent Session Persistence & Cold Start Recovery'
type: feat
status: completed
date: 2026-02-20
todos: [11025]
brainstorm: docs/brainstorms/2026-02-20-session-persistence-availability-brainstorm.md
---

# feat: Tenant Agent Session Persistence & Cold Start Recovery

## Overview

Route tenant agent chat through the Express API server with PostgreSQL persistence, mirroring the proven `CustomerAgentService` pattern. This eliminates conversation loss on Cloud Run cold starts and establishes a consistent architecture across both chat flows.

**Why this matters:** The tenant agent is the most session-sensitive agent — tenants spend 30+ minutes in storefront editing conversations that exist only in Cloud Run memory and browser localStorage. A 15-minute idle timeout wipes everything.

**Approach:** API-mediated topology (not custom ADK SessionService). Agents stay stateless; the Express API handles all persistence, recovery, and context injection.

## Problem Statement

All three Cloud Run agents use ADK's `InMemorySessionService` (the only TypeScript ADK v0.2.4 implementation). Cloud Run scales to zero after 15 minutes idle. On restart:

- All conversation history is lost
- Guided refinement state is lost
- Rate limiter counters reset
- Tenant agent is **worst-hit**: messages are NOT persisted to PostgreSQL (unlike customer agent)

The customer agent already solved this with `CustomerAgentService` (584 lines, battle-tested). The tenant agent has no service layer — its 936-line route handler does everything inline.

## Proposed Solution

### Two-phase delivery

| Phase | Effort    | What                                                    | Impact                             |
| ----- | --------- | ------------------------------------------------------- | ---------------------------------- |
| **A** | 1 line    | `min-instances=1` on tenant-agent Cloud Run             | Eliminates cold starts (~$5-10/mo) |
| **B** | Multi-day | `TenantAgentService` + route refactor + context summary | Makes cold starts survivable       |

Phase A ships immediately as operational hardening. Phase B is the architectural fix.

## Technical Approach

### Phase A: Operational Hardening (Ship Immediately)

**One-line change** in `.github/workflows/deploy-agents.yml`:

Add `--min-instances=1` to the `gcloud run services update` command for `tenant-agent` only.

```yaml
# In deploy-agents.yml, tenant-agent deploy step
gcloud run services update tenant-agent \
--region=us-central1 \
--min-instances=1
```

Customer and research agents stay at scale-to-zero (their sessions are more ephemeral).

**Cost:** ~$5-10/month. Eliminates cold starts while Phase B is built.

**Files changed:**

- [x] `.github/workflows/deploy-agents.yml` — add `--min-instances=1` for tenant-agent

---

### Phase B: Architectural (Multi-Day)

#### Step 1: Schema Reconciliation (Pre-Step)

Move route-local schemas into shared location so both the route handler and the new service can use them.

**What moves:**

- `AdkResponseSchema` (with `errorCode`/`errorMessage` fields) → `server/src/lib/adk-client.ts`
- `AdkSessionDataSchema` → `server/src/lib/adk-client.ts`

**Why first:** The service extraction depends on these schemas being importable. Moving them after creates a messy intermediate state.

**Merge strategy:** `adk-client.ts` already has `AdkRunResponseSchema`. The route-local `AdkResponseSchema` is a superset (adds `errorCode`/`errorMessage`). Merge into the existing schema, ensuring backward compatibility.

**Files changed:**

- [x] `server/src/lib/adk-client.ts` — add/merge `AdkResponseSchema`, add `AdkSessionDataSchema`, export both
- [x] `server/src/routes/tenant-admin-tenant-agent.routes.ts` — remove local schema definitions, import from `adk-client.ts`

**Validation:** Existing imports in `customer-agent.service.ts` must continue working. Run `npm run --workspace=server typecheck`.

---

#### Step 2: TenantAgentService (~200-300 lines)

New service file mirroring `CustomerAgentService` structure but focused on tenant chat lifecycle.

**File:** `server/src/services/tenant-agent.service.ts`

**Constructor dependencies:**

```typescript
constructor(
  prisma: PrismaClient,
  contextBuilder: ContextBuilderService
)
```

Internally creates `SessionService` via `createSessionService(prisma)` (same as CustomerAgentService).

**Public methods:**

| Method                                                | Purpose                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `createSession(tenantId, slug)`                       | Create ADK session + persist to PostgreSQL (`sessionType='ADMIN'`)      |
| `chat(tenantId, slug, message, sessionId?, version?)` | Send message, persist both sides, return response with dashboardActions |
| `getSessionHistory(tenantId, sessionId)`              | Load from PostgreSQL (primary), ADK fallback                            |
| `recoverSession(tenantId, sessionId, userMessage)`    | Cold start recovery with context summary injection                      |

**Private helpers (extracted from route handler):**

| Helper                                     | Source Location                         | Purpose                                                     |
| ------------------------------------------ | --------------------------------------- | ----------------------------------------------------------- |
| `buildContextPrefix(bootstrap)`            | Route lines ~527-540                    | `[SESSION CONTEXT]...[END CONTEXT]` prefix                  |
| `extractDashboardActions(data)`            | Route lines ~778-804                    | Extract `dashboardAction` from functionResponse parts       |
| `stripSessionContext(content)`             | Route lines ~860-880                    | Remove `[SESSION CONTEXT]` prefix for display               |
| `extractMessagesFromEvents(events)`        | Route lines ~830-859                    | Convert ADK events to `{role, content, timestamp}`          |
| `retryWithNewADKSession(...)`              | New (pattern from CustomerAgentService) | Create new ADK session on 404, retry message                |
| `buildContextSummary(tenantId, sessionId)` | New                                     | Load last ~10 messages + storefront state → concise summary |

**Session creation flow:**

1. Load bootstrap data via `contextBuilder.getBootstrapData(tenantId)`
2. Build session state: `{ tenantId, slug, businessName, knownFacts, forbiddenSlots, storefrontState, onboardingPhase }`
3. Create ADK session: `POST /apps/agent/users/{tenantId}:{slug}/sessions` with state
4. Create PostgreSQL session: `sessionService.getOrCreateSession(tenantId, null, 'ADMIN')`
5. Store `adkSessionId` on the AgentSession row
6. Return local session ID (CUID)

**Chat flow:**

1. Load session from PostgreSQL (get `adkSessionId`, `version`)
2. If first message and bootstrap available → inject context prefix
3. Persist user message with optimistic locking (`appendMessage` with `expectedVersion`)
4. Call ADK: `POST /run` with `{ appName, userId, sessionId: adkSessionId, newMessage }`
5. On 404 → call `recoverSession()` (cold start recovery)
6. Parse response, extract text + dashboard actions
7. Persist assistant message
8. Return `{ message, dashboardActions, sessionId, version }`

**Cold start recovery flow (`recoverSession`):**

1. Load last ~10 messages from PostgreSQL
2. Load current storefront state (sections, onboarding phase, known facts) via `contextBuilder`
3. Build compressed context summary: business facts + recent conversation topics + current state
4. Create new ADK session with summary injected as initial state
5. Update `adkSessionId` on PostgreSQL session row
6. Retry the user's message on the new session
7. Fall back to bootstrap-only injection if summary generation fails

**Files changed:**

- [x] `server/src/services/tenant-agent.service.ts` — **NEW FILE** (~580 lines incl. helpers)

**Reference:** `server/src/services/customer-agent.service.ts` (mirror structure)

---

#### Step 3: Route Handler Refactor (~936 → ~250 lines)

Shrink `tenant-admin-tenant-agent.routes.ts` by delegating chat operations to `TenantAgentService`.

**Endpoints that delegate to TenantAgentService:**

| Endpoint              | Before                     | After                                                       |
| --------------------- | -------------------------- | ----------------------------------------------------------- |
| `POST /session`       | ~80 lines inline ADK calls | `service.createSession(tenantId, slug)`                     |
| `POST /chat`          | ~200 lines inline logic    | `service.chat(tenantId, slug, message, sessionId, version)` |
| `GET /session/:id`    | ~60 lines inline ADK calls | `service.getSessionHistory(tenantId, sessionId)`            |
| `DELETE /session/:id` | ~15 lines                  | Thin handler (stays, trivial)                               |

**Endpoints that stay as thin one-liners (NOT chat operations):**

| Endpoint                      | Delegates To                                       |
| ----------------------------- | -------------------------------------------------- |
| `GET /onboarding-state`       | `contextBuilder.getBootstrapData()` (already thin) |
| `POST /skip-onboarding`       | `tenantOnboarding.skipOnboarding()` (already thin) |
| `POST /mark-reveal-completed` | `tenantOnboarding.completeReveal()` (already thin) |

**API contract preserved exactly — zero frontend changes.** Request/response shapes are identical. The refactor is purely internal.

**Route factory DI update:**

```typescript
interface TenantAdminTenantAgentDeps {
  prisma: PrismaClient;
  contextBuilder: ContextBuilderService;
  tenantOnboarding: TenantOnboardingService;
  tenantAgent: TenantAgentService; // ← NEW
}
```

**Files changed:**

- [x] `server/src/routes/tenant-admin-tenant-agent.routes.ts` — refactor to delegate to service (837→310 lines)
- [x] `server/src/routes/index.ts` — create `TenantAgentService` and pass to route factory
- [x] `server/src/di.ts` — wired in routes/index.ts (like CustomerAgentService)

---

#### Step 4: Context Summary Generator

New method on `TenantAgentService` for cold start recovery context.

**Method:** `private async buildContextSummary(tenantId: string, sessionId: string): Promise<string>`

**Inputs:**

- Last ~10 messages from PostgreSQL (via `sessionService.getSessionHistory`)
- Current storefront state (via `contextBuilder.getBootstrapData`)

**Output:** Concise summary string, example:

```
Previous conversation summary:
- Business: Jane Photography (Portland, OR)
- Onboarding: COMPLETED
- Storefront: 7/10 sections drafted (85% complete)
- Recent topics: Updated hero section copy, discussed pricing tiers, added FAQ about turnaround time
- Last action: Agent was editing the Services section with 3 package tiers
```

**Fallback:** If summary generation fails, fall back to bootstrap-only injection (agent still functional, just no conversation memory).

**Cost:** ~$0.01 per recovery (negligible, only on cold start).

**No separate file needed** — this is a private method on `TenantAgentService`.

---

## Migration: Existing localStorage Sessions

When Phase B deploys, existing tenants will have stale localStorage keys pointing to ADK-only sessions:

1. Frontend calls `POST /chat` with a localStorage `sessionId`
2. API looks up `sessionId` in PostgreSQL → not found
3. API creates new PostgreSQL session + new ADK session
4. Returns new `sessionId` to frontend
5. Frontend updates localStorage

**No migration script needed.** Graceful degradation on first post-deploy interaction. The tenant loses their current conversation context (one-time cost) but all future conversations are persistent.

---

## Acceptance Criteria

### Functional Requirements

- [x] Tenant chat messages are persisted to PostgreSQL (encrypted at rest)
- [x] Cold start recovery restores conversation context via summary injection
- [x] Session history is loadable from PostgreSQL (primary) with ADK fallback
- [x] Dashboard actions are correctly extracted and returned
- [x] Context prefix (`[SESSION CONTEXT]`) is injected on first message
- [x] Context prefix is stripped when displaying message history
- [x] Existing localStorage sessions degrade gracefully (new session created)
- [x] Onboarding endpoints (`skip-onboarding`, `mark-reveal-completed`, `onboarding-state`) continue working unchanged

### Non-Functional Requirements

- [x] API contract (request/response shapes) is preserved exactly — zero frontend changes
- [x] All tenant data queries are scoped by `tenantId`
- [x] Messages encrypted via `SessionService` (AES-256-GCM)
- [x] Optimistic locking prevents concurrent message corruption
- [x] Recovery latency < 3s (summary generation + ADK session creation + retry)
- [x] No new Prisma schema changes needed (`AgentSession` + `AgentSessionMessage` already exist)

### Quality Gates

- [x] `npm run --workspace=server typecheck` passes
- [x] `npm run --workspace=apps/web typecheck` passes
- [x] Existing tests pass (no regressions) — 101 files, 2026 tests, 0 failures
- [x] Route handler reduced from ~837 to ~310 lines (-63%)
- [ ] `TenantAgentService` has unit tests for: createSession, chat, recoverSession, buildContextSummary

---

## No Changes Required

- Cloud Run agent code (all three agents stay unchanged)
- Frontend hooks (`useTenantAgentChat.ts` — API contract preserved)
- ADK SessionService (stays `InMemorySessionService`)
- Customer agent flow (already correct)
- Prisma schema (`AgentSession` + `AgentSessionMessage` already exist)

---

## Dependencies & Prerequisites

| Dependency                                            | Status        | Notes                                                          |
| ----------------------------------------------------- | ------------- | -------------------------------------------------------------- |
| `AgentSession` + `AgentSessionMessage` models         | Already exist | No schema migration needed                                     |
| `SessionService` with encryption + optimistic locking | Already built | Used by CustomerAgentService                                   |
| `ContextBuilderService` with `getBootstrapData()`     | Already built | Used by route handler                                          |
| `adk-client.ts` shared utilities                      | Already built | `fetchWithTimeout`, `extractAgentResponse`, `extractToolCalls` |
| `TenantOnboardingService`                             | Already built | Onboarding endpoints delegate to this                          |

**No external dependencies.** Everything needed is already in the codebase.

---

## Risk Analysis & Mitigation

| Risk                                              | Likelihood | Impact | Mitigation                                                                           |
| ------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------ |
| Schema divergence causes parsing failures         | Medium     | High   | Step 1 (schema reconciliation) runs FIRST, with typecheck validation                 |
| Existing localStorage sessions break on deploy    | Low        | Medium | Graceful degradation: API creates new session if not found in PostgreSQL             |
| Context summary quality is poor                   | Low        | Low    | Falls back to bootstrap-only injection. Agent still functional.                      |
| Route refactor introduces regressions             | Medium     | High   | API contract unchanged; integration tests cover endpoints; incremental extraction    |
| min-instances=1 doesn't eliminate ALL cold starts | Low        | Low    | Cloud Run can still cold-start on redeploy; persistence handles this                 |
| Concurrent chat messages during recovery          | Low        | Medium | Optimistic locking on `appendMessage` prevents corruption; retry on version mismatch |

---

## Implementation Order

```
Phase A (ship immediately, no code review needed):
  └── .github/workflows/deploy-agents.yml (min-instances=1)

Phase B (multi-day, needs code review):
  Step 1: Schema reconciliation
    ├── server/src/lib/adk-client.ts (merge schemas)
    └── server/src/routes/tenant-admin-tenant-agent.routes.ts (remove local schemas)
    └── typecheck validation

  Step 2: TenantAgentService
    └── server/src/services/tenant-agent.service.ts (NEW)
    └── unit tests

  Step 3: Route handler refactor
    ├── server/src/routes/tenant-admin-tenant-agent.routes.ts (delegate to service)
    ├── server/src/routes/index.ts (wire service)
    └── integration test validation

  Step 4: Context summary generator
    └── Private method on TenantAgentService
    └── Unit test for summary format
```

Steps 1-4 are sequential — each depends on the previous. However, Step 2 tests can be written in parallel with Step 1.

---

## Deferred (Roadmap)

- Redis provisioning + `REDIS_URL` (todo 11054 — when booking volume grows)
- Booking event cache invalidation hooks (pairs with Redis)
- AI quota tracking for tenant chat (currently uncapped)
- min-instances for customer-agent and research-agent
- `guidedRefinementHint` wiring in `BootstrapData` (persist `completedSections` across recovery)

---

## Cost Summary

| Item                           | Monthly Cost    | When                 |
| ------------------------------ | --------------- | -------------------- |
| min-instances=1 (tenant-agent) | ~$5-10          | Phase A (immediate)  |
| Context summary LLM calls      | ~$0.01/recovery | Phase B (negligible) |

---

## References & Research

### Internal References

- **Reference implementation:** `server/src/services/customer-agent.service.ts` (584 lines, battle-tested)
- **Route to refactor:** `server/src/routes/tenant-admin-tenant-agent.routes.ts` (936 lines)
- **Shared ADK utilities:** `server/src/lib/adk-client.ts`
- **Session persistence:** `server/src/services/session/` (encryption, optimistic locking, caching)
- **Context injection:** `server/src/services/context-builder.service.ts`
- **DI wiring:** `server/src/di.ts`, `server/src/routes/index.ts`
- **Deploy workflow:** `.github/workflows/deploy-agents.yml`

### Documented Patterns

- Service extraction framework: `docs/solutions/architecture/SERVICE_EXTRACTION_DECISION_FRAMEWORK.md`
- Slot-policy context injection: `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`
- ADK development quick reference: `docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md`
- Shared service extraction: `docs/solutions/patterns/SHARED_SERVICE_EXTRACTION_PATTERN.md`

### Pitfalls to Watch

- **#76:** Orphan service pattern (create service but never import/call)
- **#77:** Fake session ID pattern (generate local IDs instead of calling ADK)
- **#83:** Agent asking known questions (missing context injection at session creation)
- **#35:** ADK response array format (not `{ messages: [...] }`)
- **#28:** A2A camelCase required (`appName`, `userId`, `sessionId`)

### Brainstorm

- `docs/brainstorms/2026-02-20-session-persistence-availability-brainstorm.md` — all decisions locked
