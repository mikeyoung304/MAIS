# Vertex AI Agent System - Master Execution Plan

**Project:** HANDLED Agent Rebuild
**Duration:** 12 weeks
**Status:** Ready for Execution
**Last Updated:** January 2026

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

## Phase 3: Specialist Agents

**Objective:** Deploy the 5 specialist agents that the Concierge will delegate to.

**Duration:** Weeks 3-4 (10-12 hours total)

**Prerequisites:** Gate 2 passed

**Order matters:** Deploy in this sequence because later agents may reference earlier ones.

### Week 3: Marketing + Storefront (5-6 hours)

#### Marketing Specialist

- [ ] Create Agent Card
  - → Reference: `vertex-ai-implementation-playbook.md` Section 2.2

- [ ] Implement tools: `generate_headline`, `generate_service_description`, `refine_copy`
  - → Reference: `vertex-ai-agent-rebuild.md` Section "2. Marketing Agent"

- [ ] Deploy

  ```bash
  adk deploy agent_engine \
    --project=handled-ai-agents \
    --region=us-central1 \
    --staging_bucket=gs://handled-ai-agents-agent-staging \
    --display_name="Marketing Specialist" \
    server/src/agent-v2/agents/marketing
  ```

- [ ] Test: "Write me 3 headline options for a photography studio"

#### Storefront Specialist

- [ ] Create Agent Card
  - → Reference: `vertex-ai-implementation-playbook.md` Section 2.6

- [ ] Implement tools: `get_page_structure`, `update_section`, `preview_draft`
  - → Reference: `vertex-ai-agent-rebuild.md` Section "6. Storefront Agent"

- [ ] Deploy

- [ ] Test: "Show me the current page structure"

### Week 4: Research Agent (4-6 hours)

**Note:** Research Agent is more complex due to web scraping. Budget extra time.

- [ ] Create Agent Card
  - → Reference: `vertex-ai-implementation-playbook.md` Section 2.3

- [ ] Implement web search grounding
  - Enable Google Search extension in Agent Builder

- [ ] Implement competitor scraping tools
  - → Reference: `vertex-ai-agent-rebuild.md` Appendix C "Competitor Research"
  - **CRITICAL:** Apply prompt injection filtering to scraped content

- [ ] Deploy

- [ ] Test: "Research photographers in Austin, TX and their pricing"
  - Expected: Real competitor data returned
  - Verify: No prompt injection in results

### GATE 3: Specialists Ready

**All must be true before Phase 4:**

| Criteria                                          | Check |
| ------------------------------------------------- | ----- |
| Marketing Specialist deployed and responding      | ☐     |
| Storefront Specialist deployed and responding     | ☐     |
| Research Specialist deployed and responding       | ☐     |
| All specialists return valid JSON (not just text) | ☐     |
| Prompt injection filtering active on Research     | ☐     |

**Note:** Image and Video Specialists are Phase 6 (after core flow works).

### ABORT CONDITIONS

- **Research Agent returns injected content** → Security issue. Fix before continuing.
- **Specialists return unstructured text** → Will break Concierge. Fix response schemas.

---

## Phase 4: Concierge Orchestrator + Integration

**Objective:** Deploy the hub agent and integrate with MAIS dashboard.

**Duration:** Weeks 5-6 (12-15 hours total)

**Prerequisites:** Gate 3 passed

### Week 5: Concierge Deployment (6-8 hours)

- [ ] Create Concierge Agent Card
  - → Reference: `vertex-ai-implementation-playbook.md` Section 2.1

- [ ] Copy system prompt
  - → Reference: `vertex-ai-implementation-playbook.md` Section 3.1
  - This is the "cheeky, confident" personality with decision tree

- [ ] Implement orchestrator
  - → Reference: `vertex-ai-implementation-playbook.md` Section 4.1
  - **CRITICAL:** Use `thinking_level: "high"` for routing quality

- [ ] Add ReflectAndRetry plugin
  - → Reference: `vertex-ai-implementation-playbook.md` Section 4.2

- [ ] Configure A2A connections to specialists
  - Concierge needs endpoints for: Marketing, Storefront, Research

- [ ] Deploy
  ```bash
  adk deploy agent_engine \
    --project=handled-ai-agents \
    --region=us-central1 \
    --staging_bucket=gs://handled-ai-agents-agent-staging \
    --display_name="Concierge Orchestrator" \
    server/src/agent-v2/agents/concierge
  ```

### Week 6: MAIS Integration (6-7 hours)

- [ ] Create agent service in MAIS backend
  - New file: `server/src/services/vertex-agent.service.ts`
  - Handles: session creation, message sending, response streaming

- [ ] Update tenant dashboard API
  - Add endpoint: `POST /api/agent/chat`
  - Add endpoint: `GET /api/agent/session/:id`

- [ ] Build preview panel WebSocket
  - Concierge pushes updates → Dashboard shows preview

- [ ] Frontend: Add chat interface to dashboard
  - Connect to new API endpoints
  - Display real-time preview panel

- [ ] End-to-end test
  - User: "Write me better headlines"
  - Expected flow: Concierge → Marketing → Preview panel updates

### GATE 4: Orchestration Working

**All must be true before Phase 5:**

| Criteria                                    | Check |
| ------------------------------------------- | ----- |
| Concierge deployed and routing correctly    | ☐     |
| "Write headlines" routes to Marketing       | ☐     |
| "Research competitors" routes to Research   | ☐     |
| "Change layout" routes to Storefront        | ☐     |
| Preview panel updates in real-time          | ☐     |
| ReflectAndRetry catches specialist failures | ☐     |
| Tenant dashboard chat functional            | ☐     |

### DECISION POINT: Architecture Validation

This is the critical checkpoint. The core pattern is now testable.

| If...                                  | Then...                                  |
| -------------------------------------- | ---------------------------------------- |
| Routing works well, latency acceptable | Continue to Phase 5                      |
| Routing often wrong                    | Tune Concierge prompt, add examples      |
| Latency > 5s for delegated tasks       | Add intent classification cache          |
| Specialists fail frequently            | Improve error handling before continuing |

---

## Phase 5: Project Hub

**Objective:** Build dual-faced customer-tenant communication system.

**Duration:** Weeks 7-8 (15-18 hours total)

**Prerequisites:** Gate 4 passed

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

### GATE 5: Project Hub Complete

| Criteria                                    | Check |
| ------------------------------------------- | ----- |
| Project Hub Agent deployed                  | ☐     |
| Customer can view project and ask questions | ☐     |
| Routine requests auto-handled correctly     | ☐     |
| Complex requests escalate to tenant         | ☐     |
| Tenant can approve/deny from dashboard      | ☐     |
| 72-hour expiry working                      | ☐     |
| Both views share single source of truth     | ☐     |

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

### GATE 6: Media Generation Complete

| Criteria                               | Check |
| -------------------------------------- | ----- |
| Image Agent generating images          | ☐     |
| Video Agent generating videos          | ☐     |
| Cost estimates shown before generation | ☐     |
| Usage tracking accurate                | ☐     |
| Tier limits enforced                   | ☐     |
| Async video status works               | ☐     |

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

### LAUNCH GATE

**All must be true before production:**

| Criteria                                          | Check |
| ------------------------------------------------- | ----- |
| All 8 agents deployed and functional              | ☐     |
| Tenant isolation verified (security audit passed) | ☐     |
| Cost tracking accurate to ±5%                     | ☐     |
| p95 latency < 5s                                  | ☐     |
| Error rate < 1%                                   | ☐     |
| Rollback procedure documented and tested          | ☐     |
| On-call runbook created                           | ☐     |

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

| File                                   | Purpose                     | When to Reference               |
| -------------------------------------- | --------------------------- | ------------------------------- |
| `UNDERSTANDING-THE-AGENT-SYSTEM.md`    | Learn concepts (READ FIRST) | Before starting, when confused  |
| `VERTEX-AI-EXECUTION-PLAN.md`          | This file - what to do      | Always (single source of truth) |
| `vertex-ai-implementation-playbook.md` | Copy/paste code & commands  | During implementation           |
| `vertex-ai-agent-rebuild.md`           | Architecture details        | Deep technical questions        |
| `vertex-ai-master-guide.md`            | Vertex AI reference         | When debugging Vertex AI issues |

### Key IDs (Fill in as you go)

| Resource           | ID                                                       |
| ------------------ | -------------------------------------------------------- |
| GCP Project ID     | `handled-484216`                                         |
| Booking Agent URL  | `https://booking-agent-506923455711.us-central1.run.app` |
| Staging Bucket     | `gs://handled-484216-agent-staging`                      |
| Media Bucket       | `gs://handled-484216-media`                              |
| Concierge Endpoint | `___________________`                                    |
| MAIS Internal API  | `https://api.gethandled.ai/v1/internal/agent`            |

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
| January 2026     | Initial plan created                                                                               |
|                  | Integrated Gemini A2A guidance                                                                     |
|                  | Added phased structure with gates                                                                  |
| January 18, 2026 | ✅ Phase 1 completed - GCP foundation setup                                                        |
| January 18, 2026 | ✅ Phase 2 completed - Booking agent deployed to Cloud Run                                         |
|                  | Created ADK standalone deployment pattern (bundler issue solved)                                   |
|                  | Created 7 internal agent endpoints with tenant isolation                                           |
|                  | Documented patterns: `adk-agent-deployment-pattern.md`, `adk-agent-backend-integration-pattern.md` |

---

_This plan follows the compound engineering principle: each phase builds on the last, with clear gates to ensure quality before complexity._
