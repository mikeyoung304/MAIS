# Legacy Agent System Migration Plan

**Created:** 2026-01-26
**Last Updated:** 2026-01-26
**Goal:** Migrate all agent functionality to Vertex AI Cloud Run architecture, delete legacy code
**Preservation Strategy:** Archive legacy code on GitHub branches before deletion

---

## 📊 Progress Tracking

| Phase        | Status      | Notes                                                                                                       |
| ------------ | ----------- | ----------------------------------------------------------------------------------------------------------- |
| **Phase 0**  | ✅ Complete | Archived to `archive/legacy-agent-orchestrators`, `archive/legacy-evals-feedback`                           |
| **Phase 1**  | ✅ Complete | `CustomerAgentService` created, routes updated, `/confirm` deprecated                                       |
| **Phase 2**  | ✅ Complete | Already using VertexAgentService, no changes needed                                                         |
| **Phase 3a** | ✅ Complete | Deleted `PanelAgentChat.tsx`, `useAgentChat.ts`, API proxy route                                            |
| **Phase 3b** | ✅ Complete | Removed imports & executor registration from `routes/index.ts`, deleted `evals/`, `feedback/`               |
| **Phase 3c** | ✅ Complete | Deleted `agent.routes.ts`, `customer/`, `orchestrator/`, `proposals/`, `context/`, and orphaned directories |
| **Phase 4**  | ✅ Complete | Enabled Cloud Trace, verified monitoring alerts (2 policies), created evaluation docs                       |
| **Phase 5**  | ✅ Complete | Updated CLAUDE.md, archived 4 todos, added legacy notices to historical docs                                |

---

## 🚀 Quick Start (For Fresh Context Window)

**✅ MIGRATION COMPLETE (2026-01-26)**

All phases complete. Legacy agent orchestrators deleted, Vertex AI observability configured, documentation updated.

```
This plan is now an ARCHIVE. The migration was completed successfully:
- Phases 0-3: Legacy code deleted (committed ce120592)
- Phase 4: Vertex AI observability configured (Cloud Trace enabled, monitoring alerts verified)
- Phase 5: Documentation updated (CLAUDE.md, todos archived, legacy notices added)

New documentation created:
- docs/architecture/VERTEX_AI_NATIVE_EVALUATION.md - Evaluation & observability guide
```

**Key decisions already made:**

1. Customer chatbot → **Direct to Booking Agent** (not through Concierge)
2. Tenant dashboard → **Through Concierge** (already working)
3. Onboarding → **Through Concierge** (verify it works)
4. Evals/Feedback → **Delete entirely**, rebuild with Vertex AI native tools
5. All deletions → **Archive on GitHub branches first** (e.g., `archive/legacy-agent-orchestrators`)

**What to delete:**

- `server/src/agent/orchestrator/` - Old orchestrators
- `server/src/agent/customer/` - Old customer tools
- `server/src/agent/evals/` - Replace with Vertex AI
- `server/src/agent/feedback/` - Replace with Vertex AI
- `server/src/routes/agent.routes.ts` - Old admin routes

**What to keep:**

- `server/src/agent-v2/` - THE NEW SYSTEM
- `server/src/agent/onboarding/` - AdvisorMemoryService still used
- `server/src/routes/internal-agent.routes.ts` - Backend for Cloud Run agents
- `server/src/routes/tenant-admin-agent.routes.ts` - Dashboard chat

---

## Executive Summary

MAIS currently has TWO agent systems running in parallel:

- **NEW (Vertex AI):** Tenant dashboard → Concierge → Specialists (Cloud Run)
- **OLD (Local):** Customer chatbot, old admin routes, evals, onboarding machinery

This plan migrates everything to the new Vertex AI architecture and removes all legacy code.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CURRENT STATE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TENANT DASHBOARD (NEW - Vertex AI)                             │
│  ────────────────────────────────                               │
│  tenant-admin-agent.routes.ts                                   │
│       ↓                                                         │
│  VertexAgentService                                             │
│       ↓                                                         │
│  Cloud Run: Concierge → Marketing/Storefront/Research           │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  CUSTOMER CHATBOT (OLD - Local Orchestrator)                    │
│  ───────────────────────────────────────────                    │
│  public-customer-chat.routes.ts                                 │
│       ↓                                                         │
│  CustomerChatOrchestrator (server/src/agent/orchestrator/)      │
│       ↓                                                         │
│  Local Vertex AI calls via orchestrator                         │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ONBOARDING (OLD - Event Sourcing)                              │
│  ─────────────────────────────────                              │
│  AdvisorMemoryService, event-sourcing                           │
│  Used by internal-agent.routes.ts for /bootstrap                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      TARGET STATE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TENANT DASHBOARD                                                │
│  ────────────────                                                │
│  tenant-admin-agent.routes.ts                                   │
│       ↓                                                         │
│  VertexAgentService                                             │
│       ↓                                                         │
│  Cloud Run: Concierge                                           │
│       ├── → Marketing Agent                                     │
│       ├── → Storefront Agent                                    │
│       ├── → Research Agent                                      │
│       └── → Onboarding context (handled by Concierge)           │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  CUSTOMER CHATBOT                                                │
│  ────────────────                                                │
│  public-customer-chat.routes.ts (REWRITTEN)                     │
│       ↓                                                         │
│  CustomerAgentService (NEW)                                     │
│       ↓                                                         │
│  Cloud Run: Booking Agent (DIRECT - not through Concierge)      │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  EVALUATION & OBSERVABILITY                                      │
│  ──────────────────────────                                      │
│  Vertex AI Native:                                               │
│  - Cloud Trace (OpenTelemetry)                                  │
│  - Observability Dashboard (token usage, latency, errors)       │
│  - Trajectory Evaluation Metrics                                │
│  - LLM-based Regression Testing                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Phases

### Phase 0: Archive Legacy Code (1 hour)

**Goal:** Preserve all legacy code on branches before deletion

```bash
# Create archive branches
git checkout -b archive/legacy-agent-orchestrators
git push origin archive/legacy-agent-orchestrators

git checkout -b archive/legacy-evals-feedback
git push origin archive/legacy-evals-feedback

git checkout main
```

**Archive branches to create:**

- `archive/legacy-agent-orchestrators` - BaseOrchestrator, CustomerChatOrchestrator, AdminOrchestrator
- `archive/legacy-evals-feedback` - Evals, feedback, review queue systems
- `archive/legacy-onboarding-eventsourcing` - Old event sourcing if being replaced

---

### Phase 1: Customer Chatbot Migration (4-6 hours)

**Goal:** Route customer chatbot directly to Booking Agent on Cloud Run

#### 1.1 Create CustomerAgentService

New service similar to `VertexAgentService` but for customer-facing chat:

```typescript
// server/src/services/customer-agent.service.ts
export class CustomerAgentService {
  // Talks directly to Booking Agent, not Concierge
  private bookingAgentUrl = process.env.BOOKING_AGENT_URL;

  async sendMessage(sessionId, tenantId, customerId, message) {
    // Similar to VertexAgentService but:
    // - Uses customerId instead of tenantId:userId
    // - Calls Booking Agent directly
    // - Includes customer context (their booking, preferences)
  }
}
```

#### 1.2 Rewrite public-customer-chat.routes.ts

Replace `CustomerChatOrchestrator` with `CustomerAgentService`:

```typescript
// BEFORE (OLD)
import { CustomerChatOrchestrator } from '../agent/orchestrator/customer-chat.orchestrator';

// AFTER (NEW)
import { CustomerAgentService } from '../services/customer-agent.service';
```

#### 1.3 Update Booking Agent for Customer Context

Ensure Booking Agent can:

- Handle customer sessions (not tenant admin sessions)
- Access customer's booking history
- Call internal endpoints for availability, services, booking creation

#### 1.4 Test Customer Flow

- Customer visits storefront
- Opens chat
- Asks about services → Booking Agent responds
- Checks availability → Booking Agent calls `/v1/internal/agent/availability`
- Creates booking → Booking Agent calls `/v1/internal/agent/create-booking`

---

### Phase 2: Onboarding Through Concierge (2-3 hours)

**Goal:** Ensure onboarding flows through Concierge, remove legacy event sourcing

#### 2.1 Verify Concierge Handles Onboarding

The Concierge agent should:

- Detect new tenants via `/bootstrap` endpoint (`onboardingDone: false`)
- Guide through onboarding questions
- Store discovery facts via `/store-discovery-fact`
- Complete onboarding via `/complete-onboarding`

**This may already be working** - verify in Cloud Run logs.

#### 2.2 Simplify AdvisorMemoryService

Current `AdvisorMemoryService` uses event sourcing. Options:

1. **Keep as-is** - It works, internal-agent.routes.ts uses it
2. **Simplify** - Replace event sourcing with direct database reads

Recommendation: Keep for now, simplify in future iteration.

---

### Phase 3: Delete Legacy Agent Code (2 hours)

**Goal:** Remove all code that's no longer used

#### 3.1 Directories to Delete

```bash
# DEFINITELY DELETE (orchestrators replaced by Cloud Run agents)
rm -rf server/src/agent/orchestrator/

# DEFINITELY DELETE (old customer tools replaced by Booking Agent)
rm -rf server/src/agent/customer/

# DEFINITELY DELETE (evals replaced by Vertex AI native)
rm -rf server/src/agent/evals/

# DEFINITELY DELETE (feedback/review queue - rebuild Vertex AI native)
rm -rf server/src/agent/feedback/

# REVIEW BEFORE DELETE
# server/src/agent/tools/ - Check if internal-agent.routes.ts needs any
# server/src/agent/onboarding/ - AdvisorMemoryService still used by /bootstrap
# server/src/agent/proposals/ - May be used by customer booking flow
# server/src/agent/tracing/ - Check if needed for debugging
```

#### 3.2 Routes to Update

```bash
# DELETE (replaced by tenant-admin-agent.routes.ts)
# server/src/routes/agent.routes.ts - Old AdminOrchestrator routes

# REWRITE (Phase 1)
# server/src/routes/public-customer-chat.routes.ts - Use CustomerAgentService
```

#### 3.3 DI Container Cleanup

Update `server/src/di.ts`:

- Remove instantiation of `CustomerChatOrchestrator`
- Remove instantiation of `AdminOrchestrator`
- Remove evaluator/pipeline wiring
- Remove review queue wiring

#### 3.4 Fix Broken Imports

```bash
npm run typecheck
# Fix any remaining import errors
```

---

### Phase 4: Vertex AI Native Evaluation (Future)

**Goal:** Set up evaluation using Vertex AI's built-in tools

#### 4.1 Enable Observability Dashboard

In Google Cloud Console:

- Enable Agent Engine observability
- Configure Cloud Trace
- Set up Cloud Monitoring alerts

#### 4.2 Create Trajectory Evaluations

```python
# Example: Evaluate booking agent flow
evaluation_config = {
  "metrics": [
    "trajectory_exact_match",
    "trajectory_precision",
    "trajectory_recall"
  ],
  "reference_trajectories": [
    {
      "user_input": "I want to book a wedding photography session",
      "expected_tools": [
        "get_services",
        "check_availability",
        "create_booking"
      ]
    }
  ]
}
```

#### 4.3 Set Up Regression Testing

Use Vertex AI's LLM-based evaluation for:

- Response quality
- Tone consistency
- Factual accuracy

---

### Phase 5: Cleanup & Documentation (2-3 hours)

**Goal:** Update ALL documentation to reflect the new Vertex AI-only architecture

#### 5.1 Update CLAUDE.md

**Search and remove/update references to:**

```bash
grep -rn "BaseOrchestrator\|CustomerChatOrchestrator\|AdminOrchestrator" CLAUDE.md
grep -rn "ToolRateLimiter\|rate-limiter" CLAUDE.md
grep -rn "agent/orchestrator\|agent/customer\|agent/tools" CLAUDE.md
grep -rn "agent/evals\|agent/feedback" CLAUDE.md
```

**Sections to update:**

- [ ] "Architecture (On-Demand Reference)" table - Remove old agent references
- [ ] "Common Pitfalls" - Remove pitfalls #11, #12, #20, #21 and others referencing deleted code
- [ ] "ADK/A2A Pitfalls" section - Keep, but verify still accurate
- [ ] "Project Structure" diagram - Update `server/src/agent/` description
- [ ] Any "two systems" or "coexisting" language - Remove

**New content to add:**

- [ ] Document the Vertex AI Cloud Run architecture as THE agent system
- [ ] Add customer chatbot → Booking Agent flow
- [ ] Reference Vertex AI native evaluation

#### 5.2 Update ARCHITECTURE.md

- [ ] Remove old agent system architecture diagrams
- [ ] Add new diagram showing: Dashboard → Concierge, Customer → Booking Agent
- [ ] Update "Agent System" section to describe only Vertex AI
- [ ] Remove any "migration" or "legacy" language

#### 5.3 Update DEVELOPING.md

- [ ] Remove any commands related to old agent system
- [ ] Update agent-related development workflows
- [ ] Add Vertex AI agent testing/debugging instructions

#### 5.4 Update docs/solutions/ Prevention Docs

**Search for legacy references:**

```bash
grep -rn "BaseOrchestrator\|CustomerChatOrchestrator" docs/solutions/
grep -rn "agent/orchestrator\|agent/customer" docs/solutions/
grep -rn "ToolRateLimiter" docs/solutions/
```

**Files to update or archive:**

- [ ] `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md` - Update or archive
- [ ] `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md` - Keep, verify accuracy
- [ ] `docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md` - Keep, verify accuracy
- [ ] `docs/solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md` - Update for new system
- [ ] Any other docs referencing deleted code paths

#### 5.5 Update docs/adrs/

- [ ] `ADR-018-hub-and-spoke-agent-architecture.md` - Mark as IMPLEMENTED
- [ ] Create new ADR documenting the completed migration (ADR-019?)

#### 5.6 Update server/src/agent-v2/ Docs

- [ ] `server/src/agent-v2/deploy/SERVICE_REGISTRY.md` - Update deployment status
- [ ] `server/src/agent-v2/index.ts` - Update phase status comments
- [ ] Remove any "TODO" or "Phase X: NOT STARTED" that are now complete

#### 5.7 Archive Legacy Todos

**Find and close todos related to deleted code:**

```bash
grep -rn "orchestrator\|CustomerChat\|ToolRateLimiter" todos/
```

**Known todos to archive:**

- [ ] #525 - Rate limiter state (ToolRateLimiter deleted)
- [ ] #548 - Error message inconsistency (old agent tools deleted)
- [ ] #549 - CustomerToolContext type gap (deleted)
- [ ] #561 - base-orchestrator.ts too large (deleted)
- [ ] #567 - Customer self-service tools (deleted)
- [ ] Any other todos referencing deleted paths

**Process for each:**

1. Rename: `{id}-deferred-{p}-{desc}.md` → `{id}-complete-{p}-{desc}.md`
2. Add to file: `completed_at: 2026-01-XX`, `resolution: "Legacy system deleted"`
3. Move to archive: `mv todos/{file} todos/archive/`

#### 5.8 Update .env.example

- [ ] Remove any env vars only used by deleted code
- [ ] Ensure all Vertex AI env vars are documented:
  - `CONCIERGE_AGENT_URL`
  - `BOOKING_AGENT_URL` (new for customer chat)
  - `GOOGLE_CLOUD_PROJECT`
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `INTERNAL_API_SECRET`

#### 5.9 Final Documentation Checklist

Run these searches to find any remaining legacy references:

```bash
# Should return ZERO matches after cleanup:
grep -rn "BaseOrchestrator" docs/ CLAUDE.md ARCHITECTURE.md DEVELOPING.md
grep -rn "CustomerChatOrchestrator" docs/ CLAUDE.md ARCHITECTURE.md DEVELOPING.md
grep -rn "AdminOrchestrator" docs/ CLAUDE.md ARCHITECTURE.md DEVELOPING.md
grep -rn "ToolRateLimiter" docs/ CLAUDE.md ARCHITECTURE.md DEVELOPING.md
grep -rn "server/src/agent/orchestrator" docs/ CLAUDE.md ARCHITECTURE.md DEVELOPING.md
grep -rn "server/src/agent/customer" docs/ CLAUDE.md ARCHITECTURE.md DEVELOPING.md
grep -rn "server/src/agent/evals" docs/ CLAUDE.md ARCHITECTURE.md DEVELOPING.md
grep -rn "server/src/agent/feedback" docs/ CLAUDE.md ARCHITECTURE.md DEVELOPING.md
```

---

## Files to Delete (Summary)

### Definitely Delete

| Path                                | Reason                                   |
| ----------------------------------- | ---------------------------------------- |
| `server/src/agent/orchestrator/`    | Replaced by Cloud Run agents             |
| `server/src/agent/customer/`        | Replaced by Booking Agent                |
| `server/src/agent/evals/`           | Replaced by Vertex AI native             |
| `server/src/agent/feedback/`        | Rebuild Vertex AI native                 |
| `server/src/routes/agent.routes.ts` | Replaced by tenant-admin-agent.routes.ts |

### Keep (Still Used)

| Path                                             | Reason                                  |
| ------------------------------------------------ | --------------------------------------- |
| `server/src/agent/onboarding/`                   | AdvisorMemoryService used by /bootstrap |
| `server/src/agent-v2/`                           | The NEW system - DO NOT DELETE          |
| `server/src/routes/internal-agent.routes.ts`     | Backend for Cloud Run agents            |
| `server/src/routes/tenant-admin-agent.routes.ts` | Dashboard chat                          |

### Review Before Delete

| Path                          | Check                       |
| ----------------------------- | --------------------------- |
| `server/src/agent/tools/`     | Any types used elsewhere?   |
| `server/src/agent/proposals/` | Used by booking flow?       |
| `server/src/agent/tracing/`   | Needed for debugging?       |
| `server/src/agent/errors/`    | Error types used elsewhere? |

---

## Success Criteria

- [ ] Customer chatbot routes to Booking Agent (Cloud Run)
- [ ] Tenant dashboard routes to Concierge (already done)
- [ ] Onboarding flows through Concierge
- [ ] All legacy orchestrators deleted
- [ ] Evals/feedback directories deleted
- [ ] TypeScript compiles with no errors
- [ ] All tests pass
- [ ] CLAUDE.md updated (no legacy references)
- [ ] Legacy code preserved on archive branches

---

## Risk Mitigation

| Risk                 | Mitigation                                            |
| -------------------- | ----------------------------------------------------- |
| Customer chat breaks | Keep old code on branch, can revert                   |
| Booking flow breaks  | Test thoroughly before deleting old proposals/        |
| Onboarding breaks    | Keep AdvisorMemoryService, don't touch event sourcing |
| Tests fail           | Fix imports first, then run tests                     |

---

## Timeline Estimate

| Phase                     | Time      | Dependencies     |
| ------------------------- | --------- | ---------------- |
| Phase 0: Archive          | 1 hour    | None             |
| Phase 1: Customer Chatbot | 4-6 hours | Archive complete |
| Phase 2: Onboarding       | 2-3 hours | Phase 1 optional |
| Phase 3: Delete Legacy    | 2 hours   | Phase 1 complete |
| Phase 4: Vertex AI Evals  | Future    | Phase 3 complete |
| Phase 5: Documentation    | 2-3 hours | Phase 3 complete |

**Total: ~12-16 hours** (spread across multiple sessions)

### Recommended Order of Operations

1. **Phase 0** - Archive first (safety net)
2. **Phase 1** - Customer chatbot migration (biggest change)
3. **Phase 3** - Delete legacy code (clears the way)
4. **Phase 5** - Documentation (reflects new reality)
5. **Phase 2** - Onboarding verification (can be done anytime)
6. **Phase 4** - Vertex AI evals (future enhancement)

---

## References

- [Vertex AI Agent Engine Overview](https://cloud.google.com/agent-builder/agent-engine/overview)
- [Evaluate Gen AI Agents](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/evaluation-agents)
- [Agent Builder Observability](https://www.infoworld.com/article/4085736/google-boosts-vertex-ai-agent-builder-with-new-observability-and-deployment-tools.html)
- Internal: `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`
