# ADR-018: Hub-and-Spoke Agent Architecture for Project Hub

**Status:** Accepted
**Date:** 2026-01-21
**Deciders:** Mike Young, Claude (Architecture Agent)
**Technical Story:** Project Hub Feature Implementation

---

## Context

**What is the issue or situation that motivated this decision?**

The Project Hub feature requires AI agent support for both customers (project tracking, requests) and tenants (request management, customer communication). We needed to decide how to integrate this new agent into the existing system.

**Existing Architecture:**

- **Concierge Agent** (hub): Orchestrator that routes to specialists via A2A protocol
- **Marketing Agent** (specialist): Brand strategy and content
- **Storefront Agent** (specialist): Landing page editing
- **Research Agent** (specialist): Industry research and best practices
- **Booking Agent**: Customer-facing booking flow (standalone)

**Constraints:**

1. Tenants interact with Concierge for all dashboard operations
2. Customers need direct, simple access without Concierge overhead
3. Must maintain session isolation per tenant (A2A requirement)
4. Security: Context guards must prevent cross-context tool access

**Business Goals:**

- Unified tenant experience (one conversational interface)
- Fast customer experience (minimal latency)
- Consistent patterns for future agent additions

## Decision

**What is the change that we're proposing and/or doing?**

Implement a **dual-entry architecture** for Project Hub:

1. **Tenant Access:** Via Concierge orchestrator (hub-and-spoke pattern)
   - Concierge receives `delegate_to_project_hub` tool
   - Routes project/request queries to Project Hub specialist
   - Maintains existing hub-and-spoke pattern

2. **Customer Access:** Direct to Project Hub agent
   - Simpler routing (customer always talks about THEIR project)
   - Lower latency (one less hop)
   - Different authentication context (project token vs tenant JWT)

```
┌─────────────────────────────────────────────────────────────────┐
│                   PROJECT HUB ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TENANT SIDE (Dashboard)           CUSTOMER SIDE (Portal)       │
│  ─────────────────────             ──────────────────────       │
│                                                                 │
│  ┌─────────┐    ┌───────────┐     ┌─────────┐                  │
│  │ Tenant  │───►│ Concierge │     │Customer │                  │
│  │Dashboard│    │   (Hub)   │     │ Portal  │                  │
│  └─────────┘    └─────┬─────┘     └────┬────┘                  │
│                       │                 │                       │
│          ┌────────────┼────────────┐   │                       │
│          │            │            │   │                       │
│          ▼            ▼            ▼   ▼                       │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐                      │
│    │Marketing │ │Storefront│ │Project   │◄─────────────────────│
│    │Specialist│ │Specialist│ │Hub Agent │                      │
│    └──────────┘ └──────────┘ └──────────┘                      │
│                                    │                            │
│                                    ▼                            │
│                         ┌────────────────────┐                 │
│                         │  Backend (9 APIs)  │                 │
│                         │  - Bootstrap       │                 │
│                         │  - Projects        │                 │
│                         │  - Requests        │                 │
│                         └────────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Implementation Aspects:**

1. **Concierge Updates:**
   - Add `PROJECT_HUB_AGENT_URL` environment variable
   - Add `delegate_to_project_hub` FunctionTool
   - Update system prompt decision tree

2. **Project Hub Agent:**
   - Uses `contextType` parameter ('customer' | 'tenant')
   - `requireContext()` guards on all tools
   - Single codebase serves both contexts

3. **Session Isolation:**
   - Cache key: `{agentUrl}:{tenantId}` per A2A pattern
   - 30-minute TTL for specialist sessions
   - Each entry point gets own session

## Alternatives Considered

### Option 1: Separate Agents (Customer Agent + Tenant Agent)

**Description:** Create two distinct agents with separate codebases

**Pros:**

- Complete separation of concerns
- Simpler individual agents

**Cons:**

- Code duplication (shared business logic)
- Two agents to maintain, test, deploy
- Inconsistent behavior risk

**Why rejected:** Violates DRY principle. The business logic is identical; only access patterns differ.

### Option 2: Single Agent (Direct Entry Only)

**Description:** Both customers and tenants access Project Hub directly, bypassing Concierge

**Pros:**

- Simpler architecture (no orchestration)
- Consistent access pattern

**Cons:**

- Breaks tenant dashboard UX (they expect Concierge)
- Inconsistent with Marketing/Storefront/Research pattern
- Context switching overhead for tenants

**Why rejected:** "The concierge remains the middleman across all of the tenant dashboard" - user requirement.

### Option 3: Single Agent via Concierge Only

**Description:** Both customers and tenants access via Concierge

**Pros:**

- Single entry point
- Consistent orchestration

**Cons:**

- Customers don't have Concierge context
- Extra latency for simple customer queries
- Different authentication mechanisms

**Why rejected:** Customers have project tokens, not tenant JWTs. Forcing through Concierge adds complexity.

### Option 4: Status Quo (No Integration)

**Description:** Project Hub remains standalone, not integrated with Concierge

**Pros:**

- No Concierge changes needed
- Simpler initial deployment

**Cons:**

- Tenants must manually switch contexts
- Breaks "one conversational interface" promise
- Future agents would have same issue

**Why rejected:** User explicitly wanted single Concierge for all tenant operations.

## Consequences

### Positive Consequences

- **Consistent Pattern:** Follows existing Marketing/Storefront/Research specialist pattern
- **Single Source of Truth:** One Project Hub agent codebase for both contexts
- **Optimal UX:** Tenants get unified Concierge experience, customers get fast direct access
- **Scalable:** Easy to add more specialists following this pattern
- **Testable:** Each entry point can be tested independently

### Negative Consequences

- **Concierge Complexity:** Adding another delegation tool increases routing logic
- **Dual Entry Testing:** Must test both customer and tenant entry paths
- **Environment Variable Creep:** One more URL to configure in Concierge

### Neutral Consequences

- **Dual Context Agent:** Same as existing pattern (already have dual-context tools in Project Hub)
- **CI/CD Update:** Need to add project-hub to workflow (one-time change)

## Implementation

**How will this decision be implemented?**

### Phase 1: Project Hub Deployment (Day 5)

1. Add `project-hub` to `deploy-agents.yml` workflow options
2. Update `SERVICE_REGISTRY.md` with project-hub entry
3. Deploy Project Hub agent to Cloud Run
4. Verify health endpoint responds

### Phase 2: Concierge Integration (Day 4-5)

1. Add `PROJECT_HUB_AGENT_URL` to Concierge environment
2. Add `delegate_to_project_hub` tool to Concierge agent
3. Update Concierge system prompt decision tree
4. Redeploy Concierge agent
5. Test routing: "check my pending requests" → Project Hub

### Success Criteria

- [ ] Tenant says "check pending requests" → Concierge → Project Hub → correct response
- [ ] Customer at /project/[id] → Direct → Project Hub → correct response
- [ ] Session isolation verified (different tenant = different session)
- [ ] Context guards prevent cross-context tool access

**Timeline:** Integrated into 5-day Project Hub implementation plan (see `plans/feat-project-hub-backend-frontend-completion.md`)

**Responsible:** Mike Young + Claude Code

## Risks and Mitigation

| Risk                          | Impact | Likelihood | Mitigation Strategy                  |
| ----------------------------- | ------ | ---------- | ------------------------------------ |
| Concierge fails to route      | High   | Low        | Retry logic + fallback to dashboard  |
| Session cache grows unbounded | Medium | Low        | 30-min TTL + max 1000 entries        |
| Context guard bypass          | High   | Very Low   | Guards are FIRST LINE in execute()   |
| A2A protocol error            | Medium | Low        | Existing patterns proven in 4 agents |

## Compliance and Standards

**Does this decision affect:**

- [x] Security requirements - Context guards enforce tenant isolation
- [ ] Privacy/compliance (GDPR, etc.) - No change
- [ ] Performance SLAs - Minimal (one additional routing hop for tenants)
- [x] Architectural principles - Extends hub-and-spoke pattern
- [x] Documentation standards - ADR + plan + ARCHITECTURE.md update
- [x] Testing requirements - Both entry points need E2E tests

**How are these addressed?**

- Security: `requireContext()` as FIRST LINE of every tool execute function
- Architecture: Follows established hub-and-spoke pattern
- Documentation: This ADR + updated plan + ARCHITECTURE.md update
- Testing: E2E checklist in plan includes both customer and tenant flows

## References

- [Project Hub Implementation Plan](../../plans/feat-project-hub-backend-frontend-completion.md)
- [A2A Prevention Index](../solutions/patterns/ADK_A2A_PREVENTION_INDEX.md)
- [Dual Context Tool Isolation](../solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md)
- [Session State Prevention](../solutions/patterns/A2A_SESSION_STATE_PREVENTION.md)
- [Google ADK Multi-Agent Best Practices](https://cloud.google.com/vertex-ai/generative-ai/docs/agent-builder/agent-development-kit)
- [Concierge Agent Source](../../server/src/agent-v2/deploy/concierge/src/agent.ts)
- [Project Hub Agent Source](../../server/src/agent-v2/deploy/project-hub/src/agent.ts)

---

## Follow-up

**Open questions:**

- None (architecture confirmed)

**Next actions:**

- [x] Update implementation plan with Concierge integration details
- [ ] Implement Day 1-5 of plan
- [ ] Add project-hub to CI/CD workflow
- [ ] Update ARCHITECTURE.md with AI Agent System section

---

## Notes

**Research Summary (2026-01-21):**

Four parallel research agents confirmed this approach:

1. **Compound Docs Agent:** Found 10+ prevention patterns in `docs/solutions/` supporting A2A protocol, dual-context isolation, session handling
2. **Architecture Analyzer:** Confirmed 6 agents exist (5 active + project-hub), hub-and-spoke already working
3. **Google ADK Researcher:** Best practices recommend orchestrator + specialists for complex routing
4. **Deployment Researcher:** Found CI/CD workflow and SERVICE_REGISTRY patterns to follow

**User Quote:**

> "The concierge remains the middleman across all of the tenant dashboard, and he calls different agents depending on what he needs. Isn't this less complex?"

Answer: Yes, it is less complex. This architecture follows existing patterns rather than creating new ones.

---

## Version History

| Date       | Author              | Changes         |
| ---------- | ------------------- | --------------- |
| 2026-01-21 | Mike Young + Claude | Initial version |
