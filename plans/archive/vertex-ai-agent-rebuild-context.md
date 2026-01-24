# Vertex AI Agent Rebuild - Research Context

**Purpose:** Reference document for continuing the agent rebuild plan in a fresh session.
**Date:** January 2026

---

## Table of Contents

1. [Current MAIS Agent Architecture](#1-current-mais-agent-architecture)
2. [Google Vertex AI Agent Builder](#2-google-vertex-ai-agent-builder)
3. [Imagen 3 & Veo 2 APIs](#3-imagen-3--veo-2-apis)
4. [Key Decisions Made](#4-key-decisions-made)
5. [Prompt for Fresh Session](#5-prompt-for-fresh-session)

---

## 1. Current MAIS Agent Architecture

### Overview

The current system implements **3 specialized orchestrators** inheriting from a common `BaseOrchestrator` (~1500 lines):

| Agent                    | Target                  | Model          | Session TTL | Max History |
| ------------------------ | ----------------------- | -------------- | ----------- | ----------- |
| AdminOrchestrator        | Internal business admin | Gemini 3 Flash | 24 hours    | 20 messages |
| OnboardingOrchestrator   | New tenant onboarding   | Gemini 3 Flash | 24 hours    | 20 messages |
| CustomerChatOrchestrator | Public booking chatbot  | Gemini 3 Flash | 1 hour      | 10 messages |

### Key Files

| File                            | Purpose                                       | Location                         |
| ------------------------------- | --------------------------------------------- | -------------------------------- |
| `base-orchestrator.ts`          | Core orchestration logic (1506 lines)         | `server/src/agent/orchestrator/` |
| `admin-orchestrator.ts`         | Admin assistant (400+ lines)                  | `server/src/agent/orchestrator/` |
| `onboarding-orchestrator.ts`    | Onboarding flow (186 lines)                   | `server/src/agent/orchestrator/` |
| `customer-chat-orchestrator.ts` | Public chatbot (120+ lines)                   | `server/src/agent/orchestrator/` |
| `state-machine.ts`              | XState v5 onboarding FSM (452 lines)          | `server/src/agent/onboarding/`   |
| `event-sourcing.ts`             | Event log with optimistic locking (368 lines) | `server/src/agent/onboarding/`   |
| `proposal.service.ts`           | Trust tier approval system (200+ lines)       | `server/src/agent/proposals/`    |

### Tool Categories (~40+ tools)

| Category         | File                  | Examples                                                 |
| ---------------- | --------------------- | -------------------------------------------------------- |
| Read Tools       | `read-tools.ts`       | `get_tenant`, `get_packages`, `check_availability`       |
| Write Tools      | `write-tools.ts`      | `upsert_services`, `upsert_package`, `update_storefront` |
| Storefront Tools | `storefront-tools.ts` | `update_page_section`, `publish_draft`, `discard_draft`  |
| UI Tools         | `ui-tools.ts`         | `update_form`, `confirm_proposal`                        |
| Onboarding Tools | `onboarding-tools.ts` | `complete_discovery_phase`, `get_market_research`        |
| Customer Tools   | `customer-tools.ts`   | `get_services`, `book_service`                           |

### Trust Tier System

```typescript
T1 = "No confirmation needed" (auto-confirm)
   - Examples: reads, blackouts, branding, visibility toggles
   - Budget: 10 per turn

T2 = "Soft confirm" (auto-confirm after next message unless "wait")
   - Examples: package changes, landing page updates, pricing
   - Window: 2-10 min depending on agent type
   - Budget: 3-5 per turn

T3 = "Hard confirm" (requires explicit "yes"/"confirm")
   - Examples: cancellations, refunds, deletes, bookings
   - Budget: 1 per turn
```

### Guardrails

| Guardrail         | Implementation                                                |
| ----------------- | ------------------------------------------------------------- |
| Rate Limiting     | Per-tool limits (maxPerTurn, maxPerSession)                   |
| Circuit Breaker   | Per-session: >20 turns OR >300K tokens OR >30min OR >5 errors |
| Tier Budgets      | Per-turn limits per trust tier                                |
| Recursion Depth   | Default: 19 (admin), 13 (customer)                            |
| Execution Timeout | 5 seconds per tool                                            |
| Prompt Injection  | NFKC normalization detection                                  |

### XState v5 Onboarding Flow

```
notStarted → discovery → marketResearch → services → marketing → completed
                ↘ (SKIP at any point) → skipped (final)
                ↗ (GO_BACK) available between phases
```

Features:

- Entry actions for logging
- Async benchmark loading via `fromPromise`
- Optimistic locking with version field
- Event sourcing for audit trail

### Multi-Tenant Isolation Pattern

```typescript
// CRITICAL: ALL queries filter by tenantId
await prisma.package.findMany({
  where: { tenantId, active: true }, // ← REQUIRED
});

// Cache keys include tenantId
const key = `tenant:${tenantId}:resource:${id}`;

// JWT provides tenantId (never from user input)
res.locals.tenantAuth.tenantId;
```

### Routes

| Endpoint                               | Agent                    | Auth         |
| -------------------------------------- | ------------------------ | ------------ |
| `POST /v1/agent/chat`                  | AdminOrchestrator        | JWT          |
| `POST /v1/agent/proposal/{id}/confirm` | Proposal confirmation    | JWT          |
| `POST /v1/public/chat/message`         | CustomerChatOrchestrator | X-Tenant-Key |
| `POST /v1/public/chat/confirm`         | Booking confirmation     | X-Tenant-Key |

---

## 2. Google Vertex AI Agent Builder

### Core Components

| Component                       | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| **Agent Development Kit (ADK)** | Open-source Python/Java framework for multi-agent systems |
| **Agent Designer**              | Low-code visual designer in Google Cloud Console          |
| **Agent Engine**                | Fully-managed runtime for deploying agents                |
| **Agent Garden**                | Library of pre-built sample agents and tools              |
| **Agent Starter Pack**          | Production-ready templates (ReAct, RAG, multi-agent)      |

### Multi-Agent Orchestration Patterns

| Pattern                    | Use Case                                 |
| -------------------------- | ---------------------------------------- |
| Sequential Workflow        | Step-by-step pipelines                   |
| Parallel Workflow          | Independent tasks simultaneously         |
| Loop Workflow              | Iterative processes                      |
| LLM-driven Dynamic Routing | Adaptive behavior based on LLM decisions |
| Agent Hierarchy            | Parent-child specialized agents          |

### Tool Integration Methods

| Method                       | Description                                 |
| ---------------------------- | ------------------------------------------- |
| Custom Functions             | Python/Java functions as tools with schemas |
| OpenAPI Tools                | YAML configuration for API endpoints        |
| Pre-built Extensions         | Code Interpreter, Vertex AI Search          |
| MCP (Model Context Protocol) | Growing ecosystem of MCP tools              |
| Apigee Integration           | Existing enterprise APIs                    |
| 100+ Pre-built Connectors    | ERP, CRM, HR platforms                      |

### Grounding Options

| Solution             | Best For                         | Effort  |
| -------------------- | -------------------------------- | ------- |
| Vertex AI Search     | Complex enterprise, high quality | Lowest  |
| Vertex AI RAG Engine | Balance ease + customization     | Medium  |
| Custom RAG Pipelines | Maximum flexibility              | Highest |

**Data Sources:** Local files, Cloud Storage, Google Drive, Slack, Jira, 100+ connectors

### Sessions & Memory Bank (GA)

**Sessions:**

- `CreateSession` - Start conversation with user ID
- `SessionEvents` - Chronological message sequence
- `AppendEvent` - Add messages/actions
- Automatic scoping per session

**Memory Bank Topics:**
| Topic | Content |
|-------|---------|
| USER_PERSONAL_INFO | Names, relationships, hobbies |
| USER_PREFERENCES | Likes, dislikes, patterns |
| KEY_CONVERSATION_DETAILS | Milestones, conclusions |

**Retrieval:** Simple (all memories) or Similarity Search (relevant to conversation)

### Security Features

| Feature              | Description                         |
| -------------------- | ----------------------------------- |
| VPC Service Controls | Block public internet, confine data |
| IAM Integration      | Fine-grained access control         |
| Audit Logs           | Track all interactions              |
| Encryption           | At rest and in transit              |
| Regional Processing  | Data residency compliance           |
| Content Filters      | Deterministic guardrails            |
| Compliance           | SOC 2, ISO 27001, HIPAA-eligible    |

### Pricing (January 2026)

| Resource         | Price                               |
| ---------------- | ----------------------------------- |
| Sessions         | $0.25 per 1,000 events              |
| Memory Bank      | $0.25 per 1,000 memories            |
| Code Execution   | $0.0864/vCPU-hour + $0.0090/GB-hour |
| Vertex AI Search | Free: 10,000 queries/month          |

**Free Tier:**

- Express Mode: Up to 10 agent engines, 90 days
- New customers: $300 credits for 90 days

### Key Documentation Links

- [Vertex AI Agent Builder Overview](https://docs.cloud.google.com/agent-builder/overview)
- [Agent Development Kit](https://google.github.io/adk-docs/)
- [ADK GitHub](https://github.com/google/adk-python)
- [Memory Bank](https://docs.cloud.google.com/agent-builder/agent-engine/memory-bank/overview)
- [Sessions](https://docs.cloud.google.com/agent-builder/agent-engine/manage-sessions)

---

## 3. Imagen 3 & Veo 2 APIs

### Imagen 3 Capabilities

**Generation:**

- Photorealistic and artistic output
- Text rendering in images
- Complex prompt understanding
- SynthID watermarking (invisible, default)

**Editing (model: `imagen-3.0-capability-001`):**

- Inpainting (insert/remove objects)
- Outpainting (extend canvas)
- Mask-free editing
- Semantic mask mode

**Output Specifications:**

| Aspect Ratio | Resolution  | Use Case                   |
| ------------ | ----------- | -------------------------- |
| 1:1          | 1024 x 1024 | Profile images, thumbnails |
| 16:9         | 1408 x 768  | Landscapes, presentations  |
| 9:16         | 768 x 1408  | Mobile, social stories     |
| 4:3          | 1280 x 896  | Traditional photos         |

**Upscaling:** Optional 2x, 4x, or 8x after generation

**Models:**

- `imagen-3.0-generate-002` - Latest generation
- `imagen-3.0-capability-001` - Editing capabilities

### Veo 2 Capabilities

**Generation:**

- Text-to-video
- Image-to-video
- First/last frame control
- Video extension
- Inpaint/outpaint (Preview)

**Output Specifications:**

| Parameter      | Value                       |
| -------------- | --------------------------- |
| Duration       | 5-8 seconds (default: 8s)   |
| Resolutions    | 720p (default), 1080p, 4K   |
| Aspect Ratios  | 16:9, 9:16                  |
| Max Capability | 4K, 2+ minutes (enterprise) |

**Models:**

- `veo-2.0-generate-exp` - Veo 2 experimental
- Newer: Veo 3, Veo 3.1 (with audio support)

### Pricing

**Imagen 3:**

| Resolution     | Price per Image |
| -------------- | --------------- |
| 1K-2K          | ~$0.134         |
| 4K             | ~$0.24          |
| Via Gemini API | $0.03           |

**Veo 2:**

| Platform   | Price per Second |
| ---------- | ---------------- |
| Vertex AI  | $0.50            |
| Gemini API | $0.35            |

**Examples:**

- 8-second video: $4.00 on Vertex AI
- 1-minute video: $30.00

### API Integration

**Python SDK - Imagen 3:**

```python
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel

vertexai.init(project="your-project-id", location="us-central1")
model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-002")

images = model.generate_images(
    prompt="A serene mountain landscape at sunset",
    number_of_images=4,
    aspect_ratio="16:9",
)
```

**Python SDK - Veo 2:**

```python
# Uses predictLongRunning for async video generation
# Returns operation ID to poll for completion
# Output stored in Cloud Storage
```

### Safety & Limits

**Content Filters:**
| Setting | Behavior |
|---------|----------|
| `block_low_and_above` | Most restrictive |
| `block_medium_and_above` | Default |
| `block_only_high` | Most permissive |

**Rate Limits:**

- System limit: 30,000 RPM per model per region
- Trial accounts: More restrictive (e.g., 10 concurrent, 100/day for Veo)

### Prompt Engineering Tips

**Imagen 3:**

1. Use descriptive language (adjectives, adverbs)
2. Provide context and background
3. Reference specific styles ("watercolor", "photorealistic")
4. Include quality modifiers ("high-quality", "beautiful")
5. Specify format ("A painting of...", "A photograph of...")
6. For portraits, use word "portrait"
7. Iterate and regenerate

**Aspect Ratio Selection:**

- 16:9: Landscapes, backgrounds
- 9:16: Mobile content, tall structures
- 1:1: Social media, profiles
- 4:3: Traditional photography

### Agent Integration

Imagen/Veo are **not pre-built tools** in Agent Builder. Implement as custom functions:

```python
def generate_image_tool(prompt: str, aspect_ratio: str = "1:1") -> dict:
    """Generate an image using Imagen 3."""
    model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-002")
    images = model.generate_images(prompt=prompt, aspect_ratio=aspect_ratio)
    return {"image_data": images[0].to_base64()}
```

### Key Documentation Links

- [Imagen 3 Docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/3-0-generate)
- [Imagen Editing](https://cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/3-0-capability-001)
- [Veo 2 Docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/2-0-generate)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)

---

## 4. Key Decisions Made

| Decision            | Choice                                      | Rationale                                 |
| ------------------- | ------------------------------------------- | ----------------------------------------- |
| Platform            | Vertex AI Agent Builder + ADK               | Consolidate on Google, reduce maintenance |
| Orchestration       | Hub-and-spoke (Concierge → Specialists)     | Clean separation, testable specialists    |
| UX Pattern          | Real-time preview + explicit Submit         | User confidence, no modal interruptions   |
| Multi-tenant        | Logical isolation (tenantId in all queries) | Cost-effective, matches current MAIS      |
| Trust Tiers         | T1 auto, T2 preview+auto-confirm, T3 submit | Carry forward proven pattern              |
| Voice               | Supported as option                         | Service pros on-the-go                    |
| Image/Video Pricing | Pass-through + margin                       | Freemium sustainable                      |
| Research Data       | Web search + scraping                       | Real-time local market data               |
| Project Hub         | AI-mediated communication                   | Filter noise, escalate signal             |

---

## 5. Prompt for Fresh Session

```
I'm rebuilding HANDLED's agent system on Google Vertex AI Agent Builder. I have a comprehensive plan at `plans/vertex-ai-agent-rebuild.md` and research context at `plans/vertex-ai-agent-rebuild-context.md`.

## Context

HANDLED is a multi-tenant SaaS for service professionals (photographers, coaches, therapists). We're doing a ground-up rebuild of our agent system.

## Our Agent Team (8 agents)

1. **Concierge Orchestrator** - Hub for tenant dashboard, delegates to specialists
2. **Marketing Agent** - Copy, headlines, brand voice, SEO
3. **Research Agent** - Local market data, competitor pricing, benchmarks (web search)
4. **Image Agent** - Imagen 3 for generation, enhancement, editing
5. **Video Agent** - Veo 2 for promo videos ($0.50/sec, pass-through pricing)
6. **Storefront Agent** - Site sections, layout, branding, draft/publish
7. **Booking Agent** - Customer-facing, service discovery, booking creation
8. **Project Hub Agent** - Dual-faced (customer + tenant views), AI-mediated communication post-booking

## Key Decisions Already Made

- **Platform:** Vertex AI Agent Builder + ADK
- **Orchestration:** Hub-and-spoke (Concierge routes to specialists)
- **UX Pattern:** Real-time preview panel + explicit "Submit" to publish (no modal confirmations)
- **Multi-tenant:** Logical isolation (tenantId in sessions/memory/queries)
- **Cost Model:** Freemium base + pass-through for Imagen/Veo usage
- **Voice:** Supported as option, not primary
- **Trust Tiers:** T1 auto, T2 preview+auto-confirm, T3 explicit submit

## Reference Files

1. `plans/vertex-ai-agent-rebuild.md` - Main plan document
2. `plans/vertex-ai-agent-rebuild-context.md` - Research findings (current architecture, Vertex AI, Imagen/Veo)

## What I Want to Deepen

1. **Agent personality/prompts** - More specific guidance on each agent's voice
2. **Tool definitions** - Detailed schemas for each tool
3. **Research Agent specifics** - How exactly to do web search for competitor pricing
4. **Project Hub mediation logic** - Rules for what gets escalated vs auto-handled
5. **Memory Bank usage** - What exactly to store for each agent
6. **Cost controls** - Detailed limits per subscription tier
7. **Error handling** - What happens when Imagen/Veo fails

## Questions to Ask Me

Before deepening, please ask me 5-7 clarifying questions about:
- Agent personalities and brand voice details
- Specific use cases for Research Agent (what data matters most)
- Project Hub escalation thresholds
- Subscription tier definitions
- Any integrations I haven't mentioned

Then run `/deepen-plan plans/vertex-ai-agent-rebuild.md` to enhance the plan with parallel research.
```

---

## Appendix: Quick Reference

### Freemium Tier Estimates

| Tier  | Sessions     | Images | Videos | Est. Monthly Cost |
| ----- | ------------ | ------ | ------ | ----------------- |
| Free  | 500 events   | 10     | 2      | $5-10             |
| Basic | 2000 events  | 50     | 10     | $25-40            |
| Pro   | 10000 events | 200    | 50     | $100-150          |

### Platform Monthly (100 tenants)

| Component        | Est. Cost      |
| ---------------- | -------------- |
| Agent Engine     | $200-500       |
| Vertex AI Search | $100-200       |
| Imagen API       | $500-1000      |
| Veo API          | $1000-2000     |
| Cloud Storage    | $50-100        |
| **Total**        | **$1850-3800** |

### Implementation Timeline

| Phase                      | Duration        | Focus                                         |
| -------------------------- | --------------- | --------------------------------------------- |
| 1. Foundation              | 2-3 weeks       | Vertex AI setup, Booking Agent                |
| 2. Concierge + Specialists | 3-4 weeks       | Orchestrator, Marketing, Research, Storefront |
| 3. Media Generation        | 2-3 weeks       | Image Agent, Video Agent                      |
| 4. Project Hub             | 3-4 weeks       | Dual-faced agent, mediation logic             |
| 5. Voice + Polish          | 2 weeks         | Voice support, evaluation, hardening          |
| **Total**                  | **12-16 weeks** |                                               |

---

_Generated with Claude Code - January 2026_
