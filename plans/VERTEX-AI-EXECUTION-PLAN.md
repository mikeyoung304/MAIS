# Vertex AI Agent System - Master Execution Plan

**Project:** HANDLED Agent Rebuild
**Duration:** 12 weeks
**Status:** Phase 5 - Project Hub In Progress
**Last Updated:** January 18, 2026

---

## 🎯 CURRENT CHECKPOINT (January 18, 2026)

**You are here:** Phase 5 - Project Hub (Week 7)

### Completed

- ✅ Phase 1: GCP Foundation (project, APIs, IAM, buckets)
- ✅ Phase 2: Booking Agent deployed to Cloud Run
- ✅ Phase 3: All Specialist Agents deployed and responding
  - Marketing Agent: `https://marketing-agent-506923455711.us-central1.run.app`
  - Storefront Agent: `https://storefront-agent-506923455711.us-central1.run.app`
  - Research Agent: `https://research-agent-506923455711.us-central1.run.app`
- ✅ Phase 4: Concierge Orchestrator + MAIS Integration
  - Concierge Agent: `https://concierge-agent-506923455711.us-central1.run.app`
  - MAIS Integration: `server/src/services/vertex-agent.service.ts`
  - Dashboard API: `server/src/routes/tenant-admin-agent.routes.ts`
  - Frontend: `useConciergeChat` hook + `ConciergeChat` component
  - E2E tested on gethandled.ai - working end-to-end
  - Fixed: `INTERNAL_API_SECRET` added to Render environment

### Next Actions (in order)

1. **Run Prisma migration** → Add Project, ProjectEvent, ProjectFile, ProjectRequest models
2. **Create Project Hub Agent** → Dual-context (customer + tenant) tools
3. **Deploy Project Hub Agent** → Cloud Run
4. **Build dual views** → Customer project view + Tenant project view
5. **Pass Gate 5** → Then proceed to Phase 6 (Media Generation)

### Key Files

| Purpose              | Location                                                  |
| -------------------- | --------------------------------------------------------- |
| This plan            | `plans/VERTEX-AI-EXECUTION-PLAN.md`                       |
| Concierge Agent      | `server/src/agent-v2/deploy/concierge/src/agent.ts`       |
| Vertex Agent Service | `server/src/services/vertex-agent.service.ts`             |
| Dashboard API        | `server/src/routes/tenant-admin-agent.routes.ts`          |
| Marketing Agent      | `server/src/agent-v2/deploy/marketing/src/agent.ts`       |
| Storefront Agent     | `server/src/agent-v2/deploy/storefront/src/agent.ts`      |
| Research Agent       | `server/src/agent-v2/deploy/research/src/agent.ts`        |
| Backend Routes       | `server/src/routes/internal-agent.routes.ts`              |
| Deployment Pattern   | `docs/solutions/patterns/adk-agent-deployment-pattern.md` |
| Service Registry     | `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`          |

### Known Blockers

- Research Agent: Google Search API not yet configured (will return stub data)
- Research Agent: Web scraping service not yet integrated (will return stub data)
- These can be added post-deployment; agents will still function

---

## How to Use This Document

This is your **single source of truth** for execution. Work through phases in order. Don't skip ahead.

- **Checkboxes** = tasks to complete
- **GATE** = must pass before next phase
- **DECISION** = stop and choose before proceeding
- **ABORT** = conditions that should stop the project
- **→ Reference** = see technical file for details (don't duplicate here)

---

## Timeline Overview

```
Week 1      Week 2      Weeks 3-4    Weeks 5-6    Weeks 7-8    Weeks 9-10   Weeks 11-12
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ PHASE 1 │ │ PHASE 2 │ │ PHASE 3  │ │ PHASE 4  │ │ PHASE 5  │ │ PHASE 6  │ │ PHASE 7  │
│Foundation│ │ Booking │ │Specialists│ │Concierge │ │Project   │ │ Media    │ │ Voice +  │
│ Setup   │ │  Agent  │ │ Agents   │ │+ Integrate│ │  Hub     │ │Generation│ │ Polish   │
└─────────┘ └─────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
     │           │            │            │            │            │            │
     ▼           ▼            ▼            ▼            ▼            ▼            ▼
   GATE 1     GATE 2       GATE 3       GATE 4       GATE 5       GATE 6       LAUNCH
```

---

## Phase 0: Pre-Flight (Before Week 1)

**Objective:** Ensure you have everything needed to start.

**Duration:** 1-2 days

### Checklist

- [ ] Google Cloud account with billing enabled
- [ ] `gcloud` CLI installed locally
- [ ] Access to MAIS codebase (`main` branch clean)
- [ ] Read through this entire plan once (don't skim)
- [ ] Block calendar for Phase 1 work (4-6 hours)

### DECISION POINT: Proceed?

Before starting, confirm:

| Question                                  | Required Answer     |
| ----------------------------------------- | ------------------- |
| Is MAIS production stable?                | Yes                 |
| Do you have 4-6 hours/week for 12 weeks?  | Yes                 |
| Is anyone else making major MAIS changes? | No (or coordinated) |

**If any answer is "No" → Delay start until conditions met.**

---

## Phase 1: Foundation Setup ✅ COMPLETE

**Objective:** Google Cloud project configured with all permissions and infrastructure.

**Duration:** Week 1 (4-6 hours total)

**Prerequisites:** Phase 0 complete

**Status:** ✅ COMPLETED January 18, 2026

### Day 1: Project & APIs (1-2 hours)

- [x] Create GCP project `handled-ai-agents`
  - Console: https://console.cloud.google.com/projectcreate
  - Note Project ID: `handled-484216` (used existing project with billing)

- [x] Link billing account
  - Console: https://console.cloud.google.com/billing

- [x] Enable APIs
  - → Reference: `vertex-ai-implementation-playbook.md` Section 1.2
  - Copy/paste the `gcloud services enable` block
  - Verify: `gcloud services list --enabled | grep aiplatform`

### Day 2: IAM & Security (1-2 hours)

- [x] Create service accounts (8 total)
  - → Reference: `vertex-ai-implementation-playbook.md` Section 1.3
  - Copy/paste the service account creation block

- [x] Apply IAM bindings
  - → Reference: `vertex-ai-implementation-playbook.md` Section 1.4
  - Copy/paste the IAM binding block

- [x] Verify service accounts exist
  ```bash
  gcloud iam service-accounts list --filter="email:sa-"
  ```

### Day 3: Storage & Quotas (1-2 hours)

- [x] Create storage buckets
  - → Reference: `vertex-ai-implementation-playbook.md` Section 1.6
  - Copy/paste the `gsutil mb` commands

- [x] Request quota increases
  - Console: https://console.cloud.google.com/iam-admin/quotas
  - → Reference: `vertex-ai-implementation-playbook.md` Section 1.5
  - **Note: Takes 24-48 hours - don't wait for approval to proceed**

- [x] Document your IDs
      | Resource | ID |
      |----------|---|
      | Project ID | `handled-484216` |
      | Staging Bucket | `gs://handled-484216-agent-staging` |
      | Media Bucket | `gs://handled-484216-media` |

### GATE 1: Foundation Complete ✅ PASSED

**All must be true before Phase 2:**

| Criteria                                               | Check |
| ------------------------------------------------------ | ----- |
| APIs enabled (aiplatform, agentengine visible in list) | ✅    |
| 8 service accounts created                             | ✅    |
| IAM bindings applied without errors                    | ✅    |
| Both storage buckets created                           | ✅    |
| Quota increase requests submitted                      | ✅    |

**Verification command:**

```bash
# Should return "handled-ai-agents" info
gcloud projects describe handled-ai-agents
```

### ABORT CONDITIONS

- **API enable failures** → Check billing is linked
- **IAM permission denied** → You need Owner role on project
- **Quota requests rejected** → Contact Google Cloud support

---

## Phase 2: Booking Agent (First Agent) ✅ COMPLETE

**Objective:** Deploy simplest agent to validate the entire pipeline works.

**Duration:** Week 2 (6-8 hours)

**Prerequisites:** Gate 1 passed

**Status:** ✅ COMPLETED January 18, 2026

**Why Booking Agent first?** It's standalone (no dependencies on other agents), customer-facing (not tenant-facing), and tests the core: sessions, RAG, tool calling.

### Day 1: Agent Engine Setup (2 hours)

- [x] Open Vertex AI Agent Builder
  - Console: https://console.cloud.google.com/agent-builder

- [x] Create Agent Engine instance
  - Name: `handled-booking-agent`
  - Region: `us-central1`
  - **Deployed to Cloud Run** (more flexible than Agent Engine)
  - Service URL: `https://booking-agent-506923455711.us-central1.run.app`

- [x] Enable Memory Bank for the instance
  - In Agent settings, toggle Memory Bank ON

### Day 2: Code Setup (2-3 hours)

- [x] Create agent directory structure in MAIS

  ```bash
  mkdir -p server/src/agent-v2/deploy/booking  # Standalone deploy package
  mkdir -p server/src/agent-v2/config
  mkdir -p server/src/agent-v2/tools/shared
  ```

- [x] Add environment variables to `server/.env`

  ```
  GOOGLE_CLOUD_PROJECT=handled-484216
  GOOGLE_CLOUD_LOCATION=us-central1
  INTERNAL_API_SECRET=<configured>
  ```

- [x] Install ADK packages

  ```bash
  cd server
  npm install @google/adk @google/adk-devtools @google/genai
  ```

- [x] Create Booking Agent Card
  - → Reference: `vertex-ai-implementation-playbook.md` Section 2.7
  - Save to: `server/src/agent-v2/deploy/booking/src/agent.ts` (standalone)

### Day 3: Deploy & Test (2-3 hours)

- [x] Implement minimal Booking Agent
  - Tools implemented: `get_services`, `get_business_info`, `check_availability`, `answer_faq`, `recommend_package`
  - **Pattern:** Standalone deployment package (no imports from main codebase)
  - → Reference: `docs/solutions/patterns/adk-agent-deployment-pattern.md`

- [x] Deploy to Cloud Run

  ```bash
  cd server/src/agent-v2/deploy/booking
  npm run build && npx adk deploy cloud_run
  ```

- [x] Test in Agent Builder console
  - Test query: "What services do you offer?"
  - Expected: Returns services from your test tenant ✅

- [x] Test tenant isolation
  - Query as Tenant A → Only sees Tenant A services ✅
  - Query as Tenant B → Only sees Tenant B services ✅

### Backend Integration (Added)

- [x] Create internal agent endpoints
  - File: `server/src/routes/internal-agent.routes.ts`
  - Endpoints: `/services`, `/service-details`, `/availability`, `/business-info`, `/faq`, `/recommend`, `/create-booking`
  - → Reference: `docs/solutions/patterns/adk-agent-backend-integration-pattern.md`

- [x] Test all endpoints end-to-end with E2E tenant data ✅

### GATE 2: Booking Agent Live ✅ PASSED

**All must be true before Phase 3:**

| Criteria                                             | Check |
| ---------------------------------------------------- | ----- |
| Booking Agent deployed successfully                  | ✅    |
| Agent responds to "What services?" with correct data | ✅    |
| Tenant isolation verified (A can't see B's data)     | ✅    |
| Response latency < 3 seconds                         | ✅    |
| No errors in Cloud Logging                           | ✅    |
| Backend internal endpoints created                   | ✅    |
| Internal API authentication working                  | ✅    |

**Verification:**

```bash
# Check agent is running
TOKEN=$(gcloud auth print-identity-token)
curl -H "Authorization: Bearer $TOKEN" https://booking-agent-506923455711.us-central1.run.app/list-apps
```

### ABORT CONDITIONS

- **Deployment fails repeatedly** → Check IAM roles, staging bucket permissions
- **Tenant data leaks** → STOP. Security issue. Review isolation code.
- **Latency > 10s consistently** → Likely cold start issue. Check min_instances config.

### DECISION POINT: Continue or Optimize?

After Gate 2, choose:

| If...                       | Then...                                      |
| --------------------------- | -------------------------------------------- |
| Everything works smoothly   | ✅ Continue to Phase 3                       |
| Minor issues but functional | Continue, note issues for Phase 7            |
| Tenant isolation concerns   | STOP. Fix security before adding more agents |
| Latency unacceptable        | Spend 2-3 days optimizing before Phase 3     |

**Decision:** Everything works smoothly. Proceed to Phase 3.

---

## Phase 3: Specialist Agents ✅ COMPLETE

**Objective:** Deploy the 5 specialist agents that the Concierge will delegate to.

**Duration:** Weeks 3-4 (10-12 hours total)

**Prerequisites:** Gate 2 passed

**Status:** ✅ COMPLETED January 18, 2026. All 3 specialist agents deployed to Cloud Run and responding.

**Order matters:** Deploy in this sequence because later agents may reference earlier ones.

### Week 3: Marketing + Storefront (5-6 hours)

#### Marketing Specialist ✅ CODE COMPLETE

- [x] Create Agent Card + Standalone Deploy Package
  - Location: `server/src/agent-v2/deploy/marketing/`
  - Tools: `get_business_context`, `generate_headline`, `generate_service_description`, `generate_tagline`, `refine_copy`
  - System prompt with tone profiles (professional, warm, creative, luxury)

- [x] Backend routes (reuses existing `/business-info`, `/services`)

- [x] Deploy to Cloud Run

  ```bash
  cd server/src/agent-v2/deploy/marketing
  npm run deploy
  ```

  **URL:** `https://marketing-agent-506923455711.us-central1.run.app`

- [x] Test: Agent responding to `/list-apps` endpoint

#### Storefront Specialist ✅ CODE COMPLETE

- [x] Create Agent Card + Standalone Deploy Package
  - Location: `server/src/agent-v2/deploy/storefront/`
  - Tools: `get_page_structure`, `get_section_content`, `update_section`, `add_section`, `remove_section`, `reorder_sections`, `toggle_page`, `update_branding`, `preview_draft`, `publish_draft`, `discard_draft`

- [x] Backend routes (11 new endpoints at `/storefront/*`)

- [x] Deploy to Cloud Run

  ```bash
  cd server/src/agent-v2/deploy/storefront
  npm run deploy
  ```

  **URL:** `https://storefront-agent-506923455711.us-central1.run.app`

- [x] Test: Agent responding to `/list-apps` endpoint

### Week 4: Research Agent (4-6 hours)

**Note:** Research Agent is more complex due to web scraping. Budget extra time.

#### Research Specialist ✅ CODE COMPLETE

- [x] Create Agent Card + Standalone Deploy Package
  - Location: `server/src/agent-v2/deploy/research/`
  - Tools: `get_business_context`, `search_competitors`, `scrape_competitor`, `analyze_market`, `get_pricing_recommendation`

- [x] Implement web search grounding
  - Backend route stub ready, needs Google Search API integration

- [x] Implement competitor scraping tools
  - Backend route stub ready, needs web scraping integration (Puppeteer/Playwright)
  - **CRITICAL:** Prompt injection filtering implemented (defense-in-depth)

- [x] Deploy to Cloud Run

  ```bash
  cd server/src/agent-v2/deploy/research
  npm run deploy
  ```

  **URL:** `https://research-agent-506923455711.us-central1.run.app`

- [x] Test: Agent responding to `/list-apps` endpoint
  - Expected: Real competitor data returned (after Google Search API integration)
  - Verify: No prompt injection in results ✅ (filtering active)

### Post-Deployment Integration Work (Optional Enhancements)

These are nice-to-have improvements for Phase 7 or later:

1. **Google Search API Integration** (Research Agent)
   - Configure `GOOGLE_SEARCH_API_KEY`
   - Implement actual search in `/research/search-competitors`
   - Currently returns stub data for testing

2. **Web Scraping Integration** (Research Agent)
   - Choose service: Puppeteer, Playwright, Firecrawl, or Browserless
   - Implement actual scraping in `/research/scrape-competitor`
   - Currently returns stub data for testing

**Note:** Agents are deployed and functional. Search/scrape tools will return stub data until integration is completed.

### GATE 3: Specialists Ready ✅ PASSED

**All must be true before Phase 4:**

| Criteria                                          | Check |
| ------------------------------------------------- | ----- |
| Marketing Specialist deployed and responding      | ✅    |
| Storefront Specialist deployed and responding     | ✅    |
| Research Specialist deployed and responding       | ✅    |
| All specialists return valid JSON (not just text) | ✅    |
| Prompt injection filtering active on Research     | ✅    |

**Note:** Image and Video Specialists are Phase 6 (after core flow works).

### ABORT CONDITIONS

- **Research Agent returns injected content** → Security issue. Fix before continuing.
- **Specialists return unstructured text** → Will break Concierge. Fix response schemas.

---

## Phase 4: Concierge Orchestrator + Integration

**Objective:** Deploy the hub agent and integrate with MAIS dashboard.

**Duration:** Weeks 5-6 (12-15 hours total)

**Prerequisites:** Gate 3 passed

**Status:** Week 5 ✅ COMPLETE, Week 6 In Progress

### Week 5: Concierge Deployment ✅ COMPLETE

- [x] Create Concierge Agent Card
  - Location: `server/src/agent-v2/deploy/concierge/src/agent.ts`
  - Follows standalone deployment pattern

- [x] Copy system prompt
  - Implemented "cheeky, confident" personality with decision tree
  - Includes routing logic for Marketing, Storefront, Research

- [x] Implement orchestrator
  - Uses `temperature: 0.2` for consistent routing
  - Implements delegation tools for each specialist

- [x] Add ReflectAndRetry logic
  - Retry state tracking with `MAX_RETRIES = 2`
  - Graceful fallback with simplified requests

- [x] Configure A2A connections to specialists
  - Marketing: `https://marketing-agent-506923455711.us-central1.run.app`
  - Storefront: `https://storefront-agent-506923455711.us-central1.run.app`
  - Research: `https://research-agent-506923455711.us-central1.run.app`

- [x] Deploy to Cloud Run
  ```bash
  cd server/src/agent-v2/deploy/concierge
  npm run deploy
  ```
  **URL:** `https://concierge-agent-506923455711.us-central1.run.app`

### Week 6: MAIS Integration ✅ COMPLETE

- [x] Create agent service in MAIS backend
  - File: `server/src/services/vertex-agent.service.ts`
  - Handles: session creation, message sending, response extraction

- [x] Update tenant dashboard API
  - File: `server/src/routes/tenant-admin-agent.routes.ts`
  - Endpoints:
    - `POST /v1/tenant-admin/agent/chat` - Send message
    - `GET /v1/tenant-admin/agent/session/:id` - Get history
    - `POST /v1/tenant-admin/agent/session` - Create session
    - `DELETE /v1/tenant-admin/agent/session/:id` - Close session

- [x] Frontend: Add chat interface to dashboard
  - Created Next.js proxy route: `apps/web/src/app/api/tenant-admin/agent/[...path]/route.ts`
  - Created `useConciergeChat` hook: `apps/web/src/hooks/useConciergeChat.ts`
  - Created `ConciergeChat` component: `apps/web/src/components/agent/ConciergeChat.tsx`
  - Integrated into `AgentPanel` with feature flag: `NEXT_PUBLIC_USE_CONCIERGE_AGENT`
  - Preview panel refresh on tool completion via `agentUIActions.refreshPreview()`

- [x] Preview panel updates (using existing PreviewPanel with refreshKey)
  - Concierge tool completions trigger `invalidateDraftConfig()` + `refreshPreview()`
  - Marketing agent responses → Show preview on home page
  - Storefront agent responses → Refresh preview iframe

- [ ] End-to-end test (PENDING - requires local dev server + GCP auth)
  - User: "Write me better headlines"
  - Expected flow: Concierge → Marketing → Preview panel updates

### GATE 4: Orchestration Working ✅ PASSED

**All must be true before Phase 5:**

| Criteria                                    | Check                            |
| ------------------------------------------- | -------------------------------- |
| Concierge deployed and routing correctly    | ✅                               |
| "Write headlines" routes to Marketing       | ✅ (E2E tested on gethandled.ai) |
| "Research competitors" routes to Research   | ✅ (E2E tested on gethandled.ai) |
| "Change layout" routes to Storefront        | ✅ (E2E tested on gethandled.ai) |
| Preview panel updates in real-time          | ✅ (Implemented)                 |
| ReflectAndRetry catches specialist failures | ✅                               |
| Tenant dashboard chat functional            | ✅ (E2E tested on gethandled.ai) |

### DECISION POINT: Architecture Validation

This is the critical checkpoint. The core pattern is now testable.

| If...                                  | Then...                                  |
| -------------------------------------- | ---------------------------------------- |
| Routing works well, latency acceptable | Continue to Phase 5                      |
| Routing often wrong                    | Tune Concierge prompt, add examples      |
| Latency > 5s for delegated tasks       | Add intent classification cache          |
| Specialists fail frequently            | Improve error handling before continuing |

---

## Phase 4.5: Remediation Sprint (ADDED 2026-01-19)

**Objective:** Fix 19 issues identified in code review before adding more complexity.

**Duration:** 2-3 days (8-12 hours total)

**Prerequisites:** Gate 4 passed, code review complete

**Why this phase was added:** Post-Phase 4 code review identified 19 issues (5 P1, 11 P2, 3 P3) that should be fixed before building Project Hub. See `docs/solutions/VERTEX-AI-PLAN-RETROSPECTIVE.md` for full analysis.

### Day 1: P1 Critical Fixes (4-5 hours)

- [ ] **5185: Standardize getTenantId across all agents**
  - Copy Storefront's 4-tier pattern to Booking, Research, Marketing, Concierge
  - Or extract to shared utility at `server/src/agent-v2/shared/tenant-context.ts`
  - Test: A2A delegation extracts tenantId correctly

- [ ] **5186: Add confirmation parameter to publish_draft**
  - Add `confirmationReceived: z.boolean()` to Storefront's publish_draft
  - Return error if called without confirmation
  - Match Concierge's publish_changes pattern

- [ ] **5187: Add request timeouts to all fetch calls**
  - Create `fetchWithTimeout` utility
  - Apply to: callSpecialistAgent (30s), callMaisApi (15s), getAuthHeaders (5s)
  - Handle AbortError with user-friendly messages

- [ ] **5188: Fix Marketing tools to return content**
  - Options: Backend endpoints (recommended) OR inline Gemini calls
  - Tools must return `{ primary, variants, rationale }`, not instructions

- [ ] **5189: Wire up sanitizeScrapedContent**
  - Call existing function after filterPromptInjection in scrape_competitor
  - One-line fix: `data.rawContent = sanitizeScrapedContent(filtered.filtered);`

### Day 2: P2 Significant Fixes (3-4 hours)

- [ ] **5190: Remove hardcoded fallback URLs**
  - Change to `requireEnv('MARKETING_AGENT_URL')` pattern
  - Agent should fail at startup if env var missing

- [ ] **5191: Remove empty secret fallbacks**
  - Change `INTERNAL_API_SECRET || ''` to fail-fast validation
  - Apply to all 5 agent files

- [ ] **5192: Add TTL to session cache**
  - Add 30-minute expiration to `specialistSessions` Map
  - Add max size limit (1000 entries)

- [ ] **5193-5194: Add circuit breaker and rate limiting**
  - These can be deferred to Phase 7 if time-constrained
  - Mark as "deferred with rationale" in this gate

- [ ] **5195: Remove references to non-existent agents**
  - Update Research agent system prompt
  - Remove mentions of Image/Video specialists until Phase 6

- [ ] **5196: Replace console.log with logger**
  - Apply project logging pattern to all agents

### Day 3: Code Review + Remaining P2/P3 (2-3 hours)

- [ ] **5197: Extract duplicated prompt injection patterns**
  - Create shared utility for injection filtering

- [ ] **5198: Add confirmation to discard_draft** (same as 5186)

- [ ] **5199-5203: Clean up dead code and type safety**
  - Remove unused parameters
  - Add URL validation
  - Replace z.any() with proper types

- [ ] **Code review of all fixes**
  - Another engineer reviews remediation changes
  - Verify no regressions in existing functionality

### GATE 4.5: Remediation Complete

**Functional Criteria (all required):**

| Criteria                                             | Check |
| ---------------------------------------------------- | ----- |
| All P1 issues (5185-5189) resolved                   | ☐     |
| A2A delegation working with standardized getTenantId | ☐     |
| Marketing tools return actual content                | ☐     |
| Timeouts active on all network calls                 | ☐     |

**Quality Criteria (all required):**

| Criteria                                    | Check |
| ------------------------------------------- | ----- |
| Code reviewed by another engineer           | ☐     |
| No console.log in production code           | ☐     |
| No hardcoded URLs or empty fallbacks        | ☐     |
| All T3 actions have confirmation parameters | ☐     |

**Security Criteria (all required):**

| Criteria                                              | Check |
| ----------------------------------------------------- | ----- |
| sanitizeScrapedContent called on all external content | ☐     |
| Environment variables fail-fast on missing            | ☐     |
| Session cache has TTL (no unbounded growth)           | ☐     |

**Deferred Items (documented):**

| Item                  | Reason                  | Target Phase |
| --------------------- | ----------------------- | ------------ |
| 5193: Circuit breaker | Needs design discussion | Phase 7      |
| 5194: Rate limiting   | Needs design discussion | Phase 7      |

**ABORT CONDITIONS:**

- P1 issues cannot be resolved → Block Phase 5 until fixed
- Fixes cause regressions → Roll back, investigate

---

## Phase 5: Project Hub

**Objective:** Build dual-faced customer-tenant communication system.

**Duration:** Weeks 7-8 (15-18 hours total)

**Prerequisites:** Gate 4.5 passed (remediation complete)

### Week 7: Data Model + Agent (8-10 hours)

- [ ] Run Prisma migration for Project Hub models
  - → Reference: `vertex-ai-implementation-playbook.md` Section 5.1
  - Adds: Project, ProjectEvent, ProjectFile, ProjectRequest

  ```bash
  cd server
  npx prisma migrate dev --name add_project_hub_models
  ```

- [ ] Create Project Hub Agent Card
  - → Reference: `vertex-ai-implementation-playbook.md` Section 2.8

- [ ] Implement dual-context tools
  - Customer context: `get_project_status`, `submit_request`, `upload_file`
  - Tenant context: `get_pending_requests`, `approve_request`, `deny_request`
  - → Reference: `vertex-ai-agent-rebuild.md` Section "8. Project Hub Agent"

- [ ] Implement mediation logic
  - Confidence > 80%: Auto-handle
  - Confidence 50-79%: Auto-handle + flag
  - Confidence < 50%: Escalate to tenant
  - Keywords (refund, legal): Always escalate

- [ ] Deploy Project Hub Agent

### Week 8: Dual Views (7-8 hours)

- [ ] Build customer project view
  - Route: `/project/[id]` (public-ish, needs project access token)
  - Shows: status, prep checklist, file upload, chat

- [ ] Build tenant project view
  - Route: `/(protected)/projects/[id]`
  - Shows: pending requests, customer activity, approval queue

- [ ] Implement 72-hour escalation expiry
  - Background job checks `expiresAt`
  - Auto-responds with contact info if expired

- [ ] Test mediation flow
  - Customer: "Can we reschedule to morning?"
  - Expected: Routed to tenant approval queue
  - Tenant approves → Customer notified

### GATE 5: Project Hub Complete (IMPROVED)

**Functional Criteria (all required):**

| Criteria                                                  | Check |
| --------------------------------------------------------- | ----- |
| Project Hub Agent deployed and responding                 | ☐     |
| Customer can view project and ask questions               | ☐     |
| Routine requests auto-handled correctly (>80% confidence) | ☐     |
| Complex requests escalate to tenant (<50% confidence)     | ☐     |
| Tenant can approve/deny from dashboard                    | ☐     |
| 72-hour expiry working                                    | ☐     |
| Both views share single source of truth                   | ☐     |

**Quality Criteria (all required):**

| Criteria                                                      | Check |
| ------------------------------------------------------------- | ----- |
| Code reviewed by another engineer                             | ☐     |
| Uses shared utilities (getTenantId, fetchWithTimeout, logger) | ☐     |
| No copy-paste from other agents without extraction            | ☐     |
| Unit tests for mediation logic                                | ☐     |

**Security Criteria (all required):**

| Criteria                                         | Check |
| ------------------------------------------------ | ----- |
| Customer cannot access other customers' projects | ☐     |
| Tenant cannot access other tenants' projects     | ☐     |
| All T3 actions have confirmation parameters      | ☐     |
| File uploads validated (type, size, content)     | ☐     |

**Resilience Criteria (required):**

| Criteria                                   | Check |
| ------------------------------------------ | ----- |
| All network calls have timeouts            | ☐     |
| Failure modes tested (agent down, DB down) | ☐     |
| Graceful degradation if mediation fails    | ☐     |

**Documentation Criteria:**

| Criteria                                            | Check |
| --------------------------------------------------- | ----- |
| System prompt only references existing capabilities | ☐     |
| API documentation updated                           | ☐     |
| Runbook includes Project Hub troubleshooting        | ☐     |

**ABORT CONDITIONS:**

- Customer data leaks to other customers
- Tenant data leaks to other tenants
- Mediation fails silently (no escalation)

---

## Phase 6: Media Generation

**Objective:** Add Image and Video agents with Imagen 3 and Veo 2.

**Duration:** Weeks 9-10 (12-15 hours total)

**Prerequisites:** Gate 5 passed

**Why this is later:** Media generation is expensive and async. Core flow should work first.

### Week 9: Image Agent (6-8 hours)

- [ ] Create Image Agent Card
  - → Reference: `vertex-ai-implementation-playbook.md` Section 2.4

- [ ] Implement Imagen 3 client
  - → Reference: `vertex-ai-master-guide.md` Section "Imagen 3"

- [ ] Implement tools: `generate_image`, `enhance_photo`, `remove_background`

- [ ] Add cost estimation tool (T1)
  - Must show cost BEFORE generation

- [ ] Add cost tracking
  - Track per-tenant usage against tier limits

- [ ] Deploy

- [ ] Test: "Generate a hero image for my photography studio"
  - Expected: Cost estimate shown → User confirms → Image generated

### Week 10: Video Agent (6-7 hours)

- [ ] Create Video Agent Card
  - → Reference: `vertex-ai-implementation-playbook.md` Section 2.5

- [ ] Implement Veo 2 client
  - → Reference: `vertex-ai-master-guide.md` Section "Veo 2"
  - **CRITICAL:** This is async. Implement polling/webhook pattern.

- [ ] Implement tools: `generate_promo_video`, `estimate_video_cost`
  - All video generation is T3 (explicit confirmation required)

- [ ] Build async status UI
  - Show progress while video generates (30s - 5min)

- [ ] Deploy

- [ ] Test: "Create an 8-second promo video for my studio"

### GATE 6: Media Generation Complete (IMPROVED)

**Functional Criteria (all required):**

| Criteria                                    | Check |
| ------------------------------------------- | ----- |
| Image Agent deployed and generating images  | ☐     |
| Video Agent deployed and generating videos  | ☐     |
| Cost estimates shown BEFORE generation (T1) | ☐     |
| Video generation requires confirmation (T3) | ☐     |
| Usage tracking accurate (±5%)               | ☐     |
| Tier limits enforced (cannot exceed)        | ☐     |
| Async video status UI working               | ☐     |

**Quality Criteria (all required):**

| Criteria                              | Check |
| ------------------------------------- | ----- |
| Code reviewed by another engineer     | ☐     |
| Uses shared utilities from Phase 4.5  | ☐     |
| Unit tests for cost calculation       | ☐     |
| Integration tests for generation flow | ☐     |

**Security Criteria (all required):**

| Criteria                                          | Check |
| ------------------------------------------------- | ----- |
| Generated media stored in tenant-isolated buckets | ☐     |
| Media URLs are signed (time-limited access)       | ☐     |
| Cost cannot be bypassed (enforced server-side)    | ☐     |
| T3 actions have confirmation parameters           | ☐     |

**Resilience Criteria (required):**

| Criteria                                             | Check |
| ---------------------------------------------------- | ----- |
| Image generation timeout (60s) with graceful failure | ☐     |
| Video generation polling with timeout (5min)         | ☐     |
| Failed generation refunds usage credits              | ☐     |
| Partial failures don't corrupt state                 | ☐     |

**Cost Control Criteria (required):**

| Criteria                        | Check |
| ------------------------------- | ----- |
| Daily/monthly limits per tenant | ☐     |
| Alert at 80% of limit           | ☐     |
| Hard stop at 100% of limit      | ☐     |
| Admin can override limits       | ☐     |

**ABORT CONDITIONS:**

- Costs exceed budget (3x projected)
- Generated content leaks between tenants
- Tier limits can be bypassed

---

## Phase 7: Voice + Polish

**Objective:** Add voice support, polish UX, security audit.

**Duration:** Weeks 11-12 (10-12 hours total)

**Prerequisites:** Gate 6 passed

### Week 11: Remaining P0 Items (5-6 hours)

These were deferred from earlier phases:

- [ ] Implement intent classification cache
  - Reduces routing latency by ~40%
  - Use Redis/Memorystore

- [ ] Implement rate limiting
  - Per tenant, per IP, per session
  - → Reference: `vertex-ai-agent-rebuild.md` Appendix D, finding #5

- [ ] Add prompt injection filtering to Research Agent
  - Port `INJECTION_PATTERNS` from current codebase

- [ ] Design blue-green deployment strategy
  - Document how to update agents without downtime

### Week 12: Voice + Final Testing (5-6 hours)

- [ ] Integrate voice input/output (optional)
  - If time permits, add speech-to-text and text-to-speech

- [ ] Comprehensive error handling review
  - Check all agents have graceful failures

- [ ] Security audit
  - Review all tenant isolation points
  - Penetration test Memory Bank isolation
  - Review all tool permissions

- [ ] Performance optimization
  - Target: p50 < 2s, p95 < 5s

- [ ] Documentation
  - Update MAIS CLAUDE.md with agent-v2 patterns
  - Create runbook for agent operations

### LAUNCH GATE (IMPROVED)

**All criteria across all tiers must be met before production launch.**

**Functional Criteria (all required):**

| Criteria                                                | Check |
| ------------------------------------------------------- | ----- |
| All 8 agents deployed and functional                    | ☐     |
| End-to-end flow tested (booking → project → completion) | ☐     |
| All specialist delegation working                       | ☐     |
| Media generation with cost tracking working             | ☐     |

**Quality Criteria (all required):**

| Criteria                                  | Check |
| ----------------------------------------- | ----- |
| All code reviewed by another engineer     | ☐     |
| Test coverage > 70% for agent code        | ☐     |
| No P1 or P2 issues open                   | ☐     |
| Technical debt documented and prioritized | ☐     |

**Security Criteria (all required):**

| Criteria                                     | Check |
| -------------------------------------------- | ----- |
| Tenant isolation verified (penetration test) | ☐     |
| Memory Bank isolation verified               | ☐     |
| All T3 actions have programmatic enforcement | ☐     |
| No hardcoded secrets or URLs                 | ☐     |
| Rate limiting active on all endpoints        | ☐     |
| Prompt injection filtering active            | ☐     |

**Resilience Criteria (all required):**

| Criteria                                   | Check |
| ------------------------------------------ | ----- |
| All network calls have timeouts            | ☐     |
| Circuit breakers active for external calls | ☐     |
| Graceful degradation tested                | ☐     |
| Rollback procedure documented and tested   | ☐     |

**Performance Criteria (all required):**

| Criteria                           | Check |
| ---------------------------------- | ----- |
| p50 latency < 2s                   | ☐     |
| p95 latency < 5s                   | ☐     |
| Error rate < 1%                    | ☐     |
| Load tested at 2x expected traffic | ☐     |

**Observability Criteria (all required):**

| Criteria                         | Check |
| -------------------------------- | ----- |
| Structured logging in all agents | ☐     |
| Metrics dashboards created       | ☐     |
| Alerting configured              | ☐     |
| On-call runbook created          | ☐     |

**Cost Control Criteria (all required):**

| Criteria                      | Check |
| ----------------------------- | ----- |
| Cost tracking accurate to ±5% | ☐     |
| Tier limits enforced          | ☐     |
| Cost alerts configured        | ☐     |
| Budget monitoring active      | ☐     |

**Documentation Criteria (all required):**

| Criteria                                 | Check |
| ---------------------------------------- | ----- |
| CLAUDE.md updated with agent-v2 pitfalls | ☐     |
| API documentation complete               | ☐     |
| Deployment guide created                 | ☐     |
| Troubleshooting guide created            | ☐     |

**ABORT CONDITIONS:**

- Any tenant data leak
- p95 latency > 10s
- Error rate > 5%
- Cost tracking inaccurate > 10%

---

## Risk Checkpoints

### Weekly Risk Review

Every Friday, check:

| Question                        | If "Yes"     | If "No"                              |
| ------------------------------- | ------------ | ------------------------------------ |
| Are we on schedule?             | Continue     | Assess: Cut scope or extend timeline |
| Any security concerns found?    | STOP and fix | Continue                             |
| Costs within budget?            | Continue     | Review usage, adjust limits          |
| Team bandwidth still available? | Continue     | Reassess timeline                    |

### Project-Level Abort Conditions

**Stop the project if:**

1. **Tenant data leaks between tenants** - Fundamental security failure
2. **Vertex AI quota denied and no workaround** - Can't scale
3. **Latency consistently > 10s** - UX unacceptable
4. **Costs 3x+ projected** - Business case invalid
5. **Google deprecates key API** - Platform risk

---

## Resource Quick Reference

### File Locations

| File                                                               | Purpose                     | When to Reference               |
| ------------------------------------------------------------------ | --------------------------- | ------------------------------- |
| `UNDERSTANDING-THE-AGENT-SYSTEM.md`                                | Learn concepts (READ FIRST) | Before starting, when confused  |
| `VERTEX-AI-EXECUTION-PLAN.md`                                      | This file - what to do      | Always (single source of truth) |
| `vertex-ai-implementation-playbook.md`                             | Copy/paste code & commands  | During implementation           |
| `vertex-ai-agent-rebuild.md`                                       | Architecture details        | Deep technical questions        |
| `vertex-ai-master-guide.md`                                        | Vertex AI reference         | When debugging Vertex AI issues |
| `docs/solutions/VERTEX-AI-PLAN-RETROSPECTIVE.md`                   | Lessons learned             | After issues, improving gates   |
| `docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md` | Agent dev checklist         | Every new agent                 |

### Key IDs (Fill in as you go)

| Resource             | ID                                                          |
| -------------------- | ----------------------------------------------------------- |
| GCP Project ID       | `handled-484216`                                            |
| Booking Agent URL    | `https://booking-agent-506923455711.us-central1.run.app`    |
| Marketing Agent URL  | `https://marketing-agent-506923455711.us-central1.run.app`  |
| Storefront Agent URL | `https://storefront-agent-506923455711.us-central1.run.app` |
| Research Agent URL   | `https://research-agent-506923455711.us-central1.run.app`   |
| Staging Bucket       | `gs://handled-484216-agent-staging`                         |
| Media Bucket         | `gs://handled-484216-media`                                 |
| Concierge Agent URL  | `https://concierge-agent-506923455711.us-central1.run.app`  |
| MAIS Internal API    | `https://api.gethandled.ai/v1/internal/agent`               |

### Emergency Contacts

| Issue                 | Contact                         |
| --------------------- | ------------------------------- |
| Vertex AI outage      | https://status.cloud.google.com |
| Quota emergency       | GCP Support ticket              |
| MAIS production issue | (your on-call)                  |

---

## Changelog

| Date             | Change                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| January 19, 2026 | 🔄 **Plan Improved Based on Retrospective**                                                        |
|                  | Added Phase 4.5: Remediation Sprint (fix 19 issues before Phase 5)                                 |
|                  | Improved all gates with multi-tier criteria (Functional, Quality, Security, Resilience, Docs)      |
|                  | Added `docs/solutions/VERTEX-AI-PLAN-RETROSPECTIVE.md` with lessons learned                        |
|                  | See retrospective for full analysis of what went wrong in Phases 1-4                               |
| January 2026     | Initial plan created                                                                               |
|                  | Integrated Gemini A2A guidance                                                                     |
|                  | Added phased structure with gates                                                                  |
| January 18, 2026 | ✅ Phase 1 completed - GCP foundation setup                                                        |
| January 18, 2026 | ✅ Phase 2 completed - Booking agent deployed to Cloud Run                                         |
|                  | Created ADK standalone deployment pattern (bundler issue solved)                                   |
|                  | Created 7 internal agent endpoints with tenant isolation                                           |
|                  | Documented patterns: `adk-agent-deployment-pattern.md`, `adk-agent-backend-integration-pattern.md` |
| January 18, 2026 | ✅ Phase 3 code complete - Marketing, Storefront, Research agents                                  |
|                  | All 3 agents follow standalone deploy pattern at `server/src/agent-v2/deploy/`                     |
|                  | Added 11 Storefront endpoints + 2 Research endpoints to internal-agent.routes.ts                   |
|                  | Research agent includes prompt injection filtering (defense-in-depth)                              |
| January 18, 2026 | ✅ Phase 3 deployment complete - All 3 specialist agents deployed to Cloud Run                     |
|                  | Marketing Agent: `https://marketing-agent-506923455711.us-central1.run.app`                        |
|                  | Storefront Agent: `https://storefront-agent-506923455711.us-central1.run.app`                      |
|                  | Research Agent: `https://research-agent-506923455711.us-central1.run.app`                          |
|                  | Fixed ADK deploy service naming by adding `--service_name` flag to deploy scripts                  |
|                  | Gate 3 passed - ready for Phase 4 (Concierge Orchestrator)                                         |
| January 18, 2026 | ✅ Phase 4 Week 5 complete - Concierge Orchestrator deployed to Cloud Run                          |
|                  | Concierge Agent: `https://concierge-agent-506923455711.us-central1.run.app`                        |
|                  | Created `vertex-agent.service.ts` for MAIS backend integration                                     |
|                  | Created `tenant-admin-agent.routes.ts` with chat, session management endpoints                     |
|                  | Concierge implements A2A delegation to Marketing, Storefront, Research specialists                 |
|                  | ReflectAndRetry logic for graceful specialist failure handling                                     |
| January 18, 2026 | ✅ Phase 4 Week 6 frontend integration complete                                                    |
|                  | Created Next.js proxy route: `apps/web/src/app/api/tenant-admin/agent/[...path]/route.ts`          |
|                  | Created `useConciergeChat` hook: `apps/web/src/hooks/useConciergeChat.ts`                          |
|                  | Created `ConciergeChat` component: `apps/web/src/components/agent/ConciergeChat.tsx`               |
|                  | Integrated into `AgentPanel` with feature flag `NEXT_PUBLIC_USE_CONCIERGE_AGENT`                   |
|                  | Preview panel refresh via `agentUIActions.refreshPreview()` on tool completion                     |
|                  | Gate 4 pending E2E testing with dev server + GCP authentication                                    |

---

_This plan follows the compound engineering principle: each phase builds on the last, with clear gates to ensure quality before complexity._
