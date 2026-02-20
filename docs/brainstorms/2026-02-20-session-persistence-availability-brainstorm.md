# Session Persistence & Availability Consistency Brainstorm

**Date:** 2026-02-20
**Status:** Reviewed & refined — ready for `/workflows:plan`
**Todos:** 11025 (P2, session persistence), 11054 (P2, availability cache — deferred)

---

## What We're Building

### Problem 1: ADK Session Loss on Cloud Run Cold Start (11025)

All three Cloud Run agents use ADK's `InMemorySessionService` (the only implementation in TypeScript ADK v0.2.4). Cloud Run scales to zero after 15 minutes idle. On restart, all conversation history, guided refinement state, and rate limiter counters are lost.

**Tenant agent is worst-hit:** Messages are NOT persisted to PostgreSQL (unlike customer agent). The entire conversation exists only in Cloud Run memory and browser localStorage.

### Problem 2: Availability Cache Per-Replica Inconsistency (11054 — DEFERRED)

The primary availability cache (`gcal.adapter.ts`) is a per-replica in-memory `Map` with 5-minute TTL and no invalidation on booking events. With multiple replicas, one replica can serve stale "available" for up to 5 minutes after another replica processes a booking.

**Decision: Defer until booking volume warrants it.** Redis infrastructure code is production-ready (`RedisCacheAdapter`), dormant because `REDIS_URL` isn't provisioned. When booking clients onboard, add Render Key Value ($10/mo) + booking event invalidation hooks. Half-day of work.

---

## Why This Approach

### 11025: API-Mediated Tenant Chat (like Customer Agent)

**Decision: Route tenant chat through the Express API server.** Build a `TenantAgentService` following the proven `CustomerAgentService` pattern.

**Why not custom ADK SessionService on Cloud Run?**

- Cloud Run agents are standalone deployments with their own `package.json`
- They have no Prisma client, no database connection
- Adding persistent storage requires either: (a) bundling Prisma + direct DB access, (b) building HTTP-based SessionService that calls back to MAIS API, or (c) adding Firestore SDK
- All three add significant surface area to what should be thin, stateless agent deployments

**Why API-mediated is better:**

- Customer agent already proves the pattern (584 lines, battle-tested)
- PostgreSQL persistence is already built: `AgentSession` + `AgentSessionMessage` models, `SessionService`, encryption, optimistic locking
- Agents stay unchanged — InMemorySessionService is fine when the API handles recovery
- Consistent architecture across both chat flows
- Audit trail, encrypted-at-rest, quota tracking come for free

### Cold Start Mitigation: min-instances=1 (tenant-agent only)

**Decision: Set min-instances=1 on tenant-agent Cloud Run service only.**

- Cost: ~$5-10/month
- Eliminates the 15-minute idle scale-to-zero for the most session-sensitive agent
- Customer and research agents stay scale-to-zero (their sessions are more ephemeral)
- Complementary to persistence — makes cold starts rare, persistence makes them survivable

### Session Recovery: Context Summary Injection

**Decision: On cold start 404, create new ADK session with compressed context summary.**

When the API detects an ADK 404 (session not found after cold start):

1. Load recent messages from PostgreSQL (last ~10)
2. Generate a compressed summary (business facts + recent conversation topics + current storefront state)
3. Create new ADK session with summary injected as initial state
4. Update `adkSessionId` on the PostgreSQL session row
5. Retry the user's message

**Why not full message replay?** Each replayed message triggers a model call (~$0.02 each, slow, rate-limit risk). Summary injection is one-shot, ~$0.01, and provides good-enough fidelity.

**Why not start fresh?** Losing 30 minutes of storefront editing conversation is a bad UX. A summary preserves the essential context (what was discussed, what was decided, what the agent was working on).

---

## Key Decisions

| #   | Decision                                                      | Rationale                                                    |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | **PostgreSQL** is the single source of truth for chat history | Already built, encrypted, tenant-scoped, optimistic locking  |
| 2   | **API-mediated topology** for tenant chat                     | Consistent with customer agent, agents stay stateless        |
| 3   | **min-instances=1** on tenant-agent only                      | $5-10/mo, eliminates cold starts for the most critical agent |
| 4   | **Context summary injection** on recovery                     | Good-enough fidelity at ~$0.01 per recovery                  |
| 5   | **Defer Redis (11054)** until booking volume warrants         | Code is ready, infra is $10/mo when needed                   |
| 6   | **No custom ADK SessionService**                              | Agents stay standalone; API handles all persistence          |

---

## Implementation Scope (for /workflows:plan)

### Phased Delivery

**Phase A — Operational hardening (ship immediately, zero code changes):**

- Add `--min-instances=1` to `gcloud run services update` for tenant-agent in CI workflow
- One line change in `.github/workflows/deploy-agents.yml`
- Eliminates cold starts while Phase B is built

**Phase B — Architectural (multi-day effort):**

### Phase B: Must Build

1. **Schema reconciliation (pre-step):**
   - Merge route-local `AdkResponseSchema` (with `errorCode`/`errorMessage`) into `adk-client.ts`
   - Move `AdkSessionDataSchema` to `adk-client.ts`
   - Both schemas are currently defined only in `tenant-admin-tenant-agent.routes.ts`

2. **`TenantAgentService`** (~200-300 lines) — focused on chat lifecycle only:
   - `createSession(tenantId, slug)` → creates ADK session + persists to PostgreSQL (`sessionType='ADMIN'`)
   - `chat(tenantId, slug, message, sessionId?, version?)` → sends message, persists user + assistant messages, returns response with dashboardActions
   - `getSessionHistory(tenantId, sessionId)` → loads from PostgreSQL (primary), ADK fallback
   - `recoverSession(tenantId, sessionId, userMessage)` → cold start recovery with context summary injection
   - Context builder integration (bootstrap data, `[SESSION CONTEXT]` prefix)
   - Dashboard action extraction (tenant-agent specific)
   - Helper functions: `buildContextPrefix()`, `extractDashboardActions()`, `stripSessionContext()`, `extractMessagesFromEvents()`

3. **Route handler refactor** — shrink `tenant-admin-tenant-agent.routes.ts` from ~936 lines to ~250 lines:
   - Chat endpoints (`POST /chat`, `GET /session/:id`, `POST /session`, `DELETE /session/:id`) delegate to `TenantAgentService`
   - Onboarding endpoints (`GET /onboarding-state`, `POST /skip-onboarding`, `POST /mark-reveal-completed`) stay as thin one-liners delegating to `TenantOnboardingService` — these are NOT chat operations
   - API contract (request/response shapes) is preserved exactly — zero frontend changes

4. **Context summary generator** — new function in `TenantAgentService`:
   - Loads last ~10 messages from PostgreSQL
   - Loads current storefront state (sections, onboarding phase, known facts)
   - Produces a concise summary string for ADK session initial state
   - Falls back to bootstrap-only if summary generation fails

### No Changes Required

- Cloud Run agent code (all three agents stay unchanged)
- Frontend hooks (`useTenantAgentChat.ts` — API contract stays the same)
- ADK SessionService (stays InMemorySessionService)
- Customer agent flow (already correct)
- Prisma schema (`AgentSession` + `AgentSessionMessage` already exist)

### Migration: Existing localStorage Sessions

When Phase B deploys, existing tenants will have stale localStorage keys pointing to ADK sessions:

- On first API call with a localStorage `sessionId`, the API tries to find it in PostgreSQL
- Not found → creates a new PostgreSQL session, creates a new ADK session, returns the new sessionId
- Frontend receives new sessionId, updates localStorage
- **No migration script needed** — graceful degradation on first post-deploy interaction

### Deferred (Roadmap)

- Redis provisioning + `REDIS_URL` (when booking volume grows)
- Booking event cache invalidation hooks (pairs with Redis)
- AI quota tracking for tenant chat
- min-instances for customer-agent and research-agent
- `guidedRefinementHint` wiring in `BootstrapData` (type stub exists, never populated — would persist `completedSections` across session recovery for smoother re-entry)

---

## Guided Refinement State: Recovery Analysis

The tenant agent stores `guidedRefinementState` in ADK `context.state`. This is lost on session recovery. Analysis of each component:

| State Component     | Reconstructable?            | Loss Impact | Recovery Path                                                  |
| ------------------- | --------------------------- | ----------- | -------------------------------------------------------------- |
| `mode`              | YES (from storefront state) | None        | Inferred from `hasDraft` + `onboardingPhase`                   |
| `currentSectionId`  | PARTIAL (first incomplete)  | Minor       | Agent calls `get_next_incomplete_section`                      |
| `completedSections` | NO                          | Moderate    | Agent re-walks sections; user can fast-track with "looks good" |
| `sectionVariants`   | NO (regeneratable)          | Minor       | Costs 1 LLM call per section (~2-3s each)                      |
| `preferenceMemory`  | PARTIAL                     | Minor       | Re-learns in 2-3 variant selections                            |

**Conclusion:** Context summary injection is sufficient. The agent gracefully degrades — it re-walks sections and regenerates variants rather than failing. No data corruption risk. The `guidedRefinementHint` stub in `BootstrapData` can be wired later to persist `completedSections` if session loss is frequent.

---

## Audit Findings That Informed This Design

Full audit report: generated in session 2026-02-20 (8-section fact-finding mission).

Key facts that drove decisions:

- ADK TypeScript v0.2.4 has **only** `InMemorySessionService` (no Firestore/DB built-in)
- Custom `BaseSessionService` requires 4 methods: `createSession`, `getSession`, `listSessions`, `deleteSession` + optional `appendEvent` override
- `appendEvent` is called on **every** non-partial event during `/run` (user message, model response, tool calls) — high write frequency
- Tenant agent route handler is 936 lines with no service layer; frontend only calls 2 of 7 endpoints
- Customer agent service is 584 lines with full persistence, retry, and encryption
- Cloud Run agents have no database connection (standalone deployments)
- Render Key Value Starter: $10/mo, 256MB, same-region private network

---

## Resolved Questions

| Question                                            | Answer                      | Rationale                                                                                                       |
| --------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| PostgreSQL vs Firestore vs Redis for session truth? | **PostgreSQL**              | Already built, encrypted, tenant-scoped. Firestore adds infra surface. Redis not durable.                       |
| Persist messages only vs messages + state?          | **Messages only (for now)** | Guided refinement state degrades gracefully on loss. `guidedRefinementHint` stub exists for future enhancement. |
| Custom ADK SessionService needed?                   | **No**                      | Agents stay standalone. API handles all persistence.                                                            |
| Redis for availability cache?                       | **Deferred**                | Code ready, infra $10/mo when needed. Low booking volume = no urgency.                                          |
| Concurrency settings?                               | **Keep defaults**           | Concurrency=80 is fine for LLM workloads where bottleneck is Vertex AI API, not CPU.                            |

---

## Open Questions

_None — all decisions locked._

---

## Cost Summary

| Item                           | Monthly Cost    | When                                    |
| ------------------------------ | --------------- | --------------------------------------- |
| min-instances=1 (tenant-agent) | ~$5-10          | Phase A (immediate)                     |
| Render Key Value (Redis)       | ~$10            | Deferred (when booking clients onboard) |
| Context summary LLM calls      | ~$0.01/recovery | Negligible, only on cold start          |

---

## Risk Register

| Risk                                              | Likelihood | Impact | Mitigation                                                                |
| ------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| Schema divergence causes parsing failures         | Medium     | High   | Phase B pre-step: reconcile `AdkResponseSchema` before service extraction |
| Existing localStorage sessions break on deploy    | Low        | Medium | Graceful degradation: API creates new session if not found in PostgreSQL  |
| Context summary quality is poor                   | Low        | Low    | Falls back to bootstrap-only injection. Agent still functional.           |
| Phase B route refactor introduces regressions     | Medium     | High   | API contract is unchanged; existing E2E tests cover the endpoints         |
| min-instances=1 doesn't eliminate ALL cold starts | Low        | Low    | Cloud Run can still cold-start on redeploy; persistence handles this      |
