# MAIS Agent Ecosystem Master Report

> **Generated:** 2026-02-01
> **Purpose:** Context handoff document for AI-assisted decision making
> **Status:** Awaiting strategic decisions on consolidation path

---

## Executive Summary

MAIS (gethandled.ai) is a multi-tenant platform for service professionals (photographers, coaches, therapists). The platform includes an AI agent system that has undergone **4 major architectural phases in 38 days**, resulting in a fragmented ecosystem with overlapping storage systems, lost enterprise patterns, and a critical P0 bug where the agent repeatedly asks questions it already knows the answers to.

**7 expert reviews** have been conducted, all converging on the same conclusion: the proposed "dual-schema architecture" is over-engineered, and the actual fix is ~50 lines of context injection code.

**Key Decision Required:** How to consolidate the agent ecosystem into an enterprise-grade system without adding more technical debt.

---

## Table of Contents

1. [The P0 Bug: Agent Asks Repeated Questions](#the-p0-bug)
2. [Agent Architecture Evolution Timeline](#architecture-evolution)
3. [Current State: 5+ Overlapping Storage Systems](#current-state)
4. [The Proposed Solution (Dual-Schema) and Why It's Over-Engineered](#proposed-solution)
5. [Expert Review Findings](#expert-reviews)
   - [DHH Review](#dhh-review)
   - [Kieran Review (TypeScript)](#kieran-review)
   - [Simplicity Review](#simplicity-review)
   - [Git History Archaeological Report](#git-history)
   - [Enterprise Architecture Principles](#architecture-principles)
   - [Agent-Native Architecture Review](#agent-native-review)
   - [Prompt Engineering Review](#prompt-engineering-review)
6. [The 50-Line Fix vs. Full Consolidation](#the-fix)
7. [Lost Enterprise Patterns to Recover](#lost-patterns)
8. [Open Questions Requiring Decision](#open-questions)
9. [Recommended Path Forward](#recommendations)
10. [Code Examples and Implementation Details](#code-examples)

---

## The P0 Bug: Agent Asks Repeated Questions {#the-p0-bug}

### Symptoms

Users report that the tenant agent repeatedly asks "What do you do?" or "Tell me about your business" even after they've already provided this information in previous sessions.

### Root Cause (Confirmed by All 7 Reviews)

The agent relies on a tool call (`get_known_facts`) to retrieve stored information, but **LLMs don't reliably call tools on every turn**. The discovery facts exist in the database but are never injected into the agent's context at session start.

**Exact location of bug:** `/server/src/services/vertex-agent.service.ts:265`

```typescript
// CURRENT (BROKEN) - Session created with ONLY tenantId
body: JSON.stringify({ state: { tenantId } }),
// discoveryFacts are NOT included - agent doesn't know what it knows
```

### Why This Matters

- Users feel unheard and frustrated
- Onboarding takes longer than necessary
- Agent appears "dumb" despite having sophisticated capabilities
- Trust in the platform erodes

---

## Agent Architecture Evolution Timeline {#architecture-evolution}

### Phase A: Claude API Direct Integration (Dec 26, 2025 - Jan 13, 2026)

**Stack:** Anthropic SDK (Claude Sonnet 4) + Express backend orchestrator

**Components Built:**

- `server/src/agent/orchestrator/orchestrator.ts` - Central orchestrator
- `server/src/agent/tools/` - Read/Write tools with trust tier system (T1/T2/T3)
- `server/src/agent/proposals/` - Proposal service for confirmations
- `server/src/agent/context/` - Context builder with session caching
- `server/src/agent/audit/` - Audit service for all tool calls
- `server/src/agent/evals/` - LLM-as-Judge evaluation pipeline
- `server/src/agent/feedback/review-queue.ts` - Human review queue
- `server/src/agent/orchestrator/circuit-breaker.ts` - Session limits
- `server/src/agent/orchestrator/metrics.ts` - Prometheus metrics

**Enterprise Patterns Established:**

- Trust tier system (T1: auto-execute, T2: soft-confirm, T3: explicit-confirm)
- Sliding window conversation history (max 20 messages)
- Circuit breaker for runaway sessions
- Prometheus metrics for observability
- LLM-as-Judge quality evaluation
- Human review queue for flagged conversations

### Phase B: Vertex AI Migration (Jan 13, 2026)

**Reason:** Cost optimization and Google Cloud alignment

**Changes:**

- Replaced Anthropic SDK with Google Gen AI SDK
- Created `server/src/llm/` abstraction layer
- Model changed to `gemini-3-flash-preview`

### Phase C: Agent-v2 ADK Architecture (Jan 18-26, 2026)

**Major Shift:** From monolithic orchestrator to distributed Cloud Run agents using Google ADK

**5 Separate Agents Deployed:**

1. `booking-agent` - Customer booking flow
2. `storefront-agent` - Storefront editing
3. `marketing-agent` - Copy generation
4. `concierge-agent` - Orchestration/routing
5. `project-hub-agent` - Project management

**Key Architectural Decision:** Each agent is a standalone npm package deployed independently to Cloud Run.

### Phase D: Consolidation + Legacy Deletion (Jan 26-31, 2026)

**Consolidation:** 5 agents → 3 agents

| Original Agent                    | Migrated To    |
| --------------------------------- | -------------- |
| booking-agent                     | customer-agent |
| project-hub-agent (customer view) | customer-agent |
| storefront-agent                  | tenant-agent   |
| marketing-agent                   | tenant-agent   |
| concierge-agent                   | tenant-agent   |
| project-hub-agent (tenant view)   | tenant-agent   |
| research-agent                    | unchanged      |

**Deletion:** ~50,500 lines of legacy orchestration code deleted in commit `ce120592`

**Critical Loss:** In the rush to migrate, enterprise patterns were deleted rather than migrated:

- Evaluation pipeline (LLM-as-Judge)
- Human review queue
- Circuit breaker
- Prometheus metrics

### Current State (Feb 1, 2026)

**3 Active Cloud Run Agents:**

| Agent            | Tools   | Purpose                                       |
| ---------------- | ------- | --------------------------------------------- |
| `customer-agent` | 13      | Booking, project hub (customer view)          |
| `tenant-agent`   | 26      | Storefront, marketing, projects (tenant view) |
| `research-agent` | Minimal | Web research                                  |

**Legacy System Still Running:**

- XState v5 onboarding state machine (`server/src/agent/onboarding/`)
- AdvisorMemoryService
- OnboardingEvent table (event sourcing)

---

## Current State: 5+ Overlapping Storage Systems {#current-state}

The codebase has accumulated multiple storage locations for the same types of data:

### Storefront Content Storage

| Location                         | What It Stores                                     | Used By                         |
| -------------------------------- | -------------------------------------------------- | ------------------------------- |
| `tenant.landingPageConfig`       | Published storefront content                       | Visual Editor, public rendering |
| `tenant.landingPageConfig.draft` | Visual Editor draft (JSON wrapper)                 | Visual Editor                   |
| `tenant.landingPageConfigDraft`  | Agent/Build Mode draft (separate column)           | AI agent tools                  |
| `SectionContent` model           | Unified section storage with `isDraft`, `versions` | Some tools                      |

### Discovery/Personality Data Storage

| Location                         | What It Stores                | Used By              |
| -------------------------------- | ----------------------------- | -------------------- |
| `tenant.branding.discoveryFacts` | Personality insights (JSON)   | Agent tools          |
| `OnboardingEvent` table          | Event-sourced onboarding data | AdvisorMemoryService |
| ADK Session State                | Runtime context               | ADK (ephemeral)      |

### The Problem

> "The problem is NOT missing storage. The problem is the agent doesn't READ what's already stored."
> — Simplicity Reviewer

Each time a problem arose, a new storage system was added instead of fixing the read path. This created a "patchwork" architecture where data exists in multiple places but isn't unified at the point of consumption (the agent's context).

---

## The Proposed Solution (Dual-Schema) and Why It's Over-Engineered {#proposed-solution}

### Original Brainstorm (2026-01-31)

The brainstorm document (`docs/brainstorms/2026-01-31-dual-schema-agent-architecture-brainstorm.md`) proposed:

1. **Website Schema** - Rigid, completion-driven tracker
   - 5 sections: Hero, About, Services, FAQ, Reviews
   - States: empty → draft → accepted → skipped
   - Weighted completion score (Services=40%, Hero=25%, etc.)

2. **Tenant Profile** - Flexible, insight-driven personality bank
   - Voice (tone, avoids, preferences)
   - Story (origin, why, journey)
   - Style (approach, signature, dislikes)
   - Clients (ideal, demographics, red flags)
   - Business (location, travel radius, pricing)
   - Quirks (array of personality notes)
   - Raw insights (timestamped quotes)

### The Plan's Scope

The implementation plan (`docs/plans/2026-01-31-feat-dual-schema-agent-architecture-plan.md`) proposed:

- 2 new database columns (`websiteSchema`, `tenantProfile`)
- 2 new version columns for optimistic locking
- 5 new API endpoints
- 4 new agent tools
- Migration scripts
- Frontend confirmation components
- State machine for section transitions

### Why All 7 Reviews Said It's Over-Engineered

| What Plan Proposes   | What's Actually Needed            |
| -------------------- | --------------------------------- |
| 2 new DB columns     | 0 - use existing storage          |
| 5 new endpoints      | 0 - add to existing endpoint      |
| 4 new tools          | 0 - `store_discovery_fact` exists |
| Migration scripts    | Not needed                        |
| ~1000+ lines of code | ~50 lines                         |

**Core Insight:** The plan solves a READ problem by adding more WRITE infrastructure. The data already exists - it just needs to flow to the agent's context.

---

## Expert Review Findings {#expert-reviews}

### DHH Review (Simplicity & Conventions) {#dhh-review}

**Verdict:** 🔴 Over-engineered

**Key Quote:**

> "You're building a multi-layered architecture to solve a problem that needs a five-line fix."

**Critical Issues:**

1. Four different places storing overlapping tenant information
2. The root cause is a READ problem, not storage
3. The plan bundles 3 separate features into one massive PR
4. Optimistic locking on AI tool calls creates race conditions

**DHH's Counter-Proposal:**

```typescript
// This week: Add discovery facts to context builder
const [
  tenantResult,
  segmentsResult,
  sectionsResult,
  projectsResult,
  factsResult, // ADD THIS
] = await Promise.all([
  callMaisApi('/tenant-context', tenantId),
  callMaisApi('/tenant-segments', tenantId),
  callMaisApi('/tenant-sections', tenantId),
  callMaisApi('/tenant-projects', tenantId, { activeOnly: true, limit: 10 }),
  callMaisApi('/get-discovery-facts', tenantId), // ADD THIS
]);
```

**Recommendations:**

1. Fix the actual bug first (5 lines)
2. Add section state to existing `landingPageConfig` structure
3. Make Tenant Profile a separate feature for next sprint
4. Replace weighted completion score with simple checklist
5. Reduce to one smart tool instead of four

---

### Kieran Review (TypeScript/Type Safety) {#kieran-review}

**Verdict:** 🟡 Good architecture, buggy implementation

**Critical Type Safety Issues:**

1. **Wrong SDK Import**

   ```typescript
   // Plan shows (WRONG):
   import { FunctionTool } from '@anthropic-ai/sdk';

   // Codebase uses (CORRECT):
   import { FunctionTool, type ToolContext } from '@google/adk';
   ```

2. **Unsupported Zod Type (ADK Pitfall #34)**

   ```typescript
   // WRONG - z.record() not supported by ADK
   insight: z.union([z.string(), z.record(z.string())]);

   // CORRECT
   insight: z.any().describe('String or object with insight data');
   ```

3. **No Transaction Boundary on Multi-Tool Calls**
   - Agent can call `add_insight()` and `update_section()` in same turn
   - Each is separate HTTP request/transaction
   - If second fails, first is already committed - no rollback

4. **Missing Version in Tool Response**
   - `update_section` doesn't return version for optimistic locking
   - Agent can't retry gracefully on 409 conflict

**Kieran's TypeScript Recommendations:**

```typescript
// 1. Branded types for section keys
type SectionName = 'hero' | 'about' | 'services' | 'faq' | 'reviews';

// 2. Discriminated unions for insight types
const AddInsightParams = z.discriminatedUnion('category', [
  z.object({ category: z.literal('quirks'), insight: z.string() }),
  z.object({
    category: z.literal('voice'),
    insight: z.object({
      tone: z.string().optional(),
      avoids: z.array(z.string()).optional(),
    }),
  }),
]);

// 3. Type-safe API client
export const agentApi = {
  updateSection: (tenantId: string, params: UpdateSectionParams) =>
    callMaisApi<UpdateSectionResponse>('/update-section', tenantId, params),
} as const;

// 4. Result pattern instead of throwing
import { ok, err, Result } from 'neverthrow';
```

**What Kieran Liked:**

- Context injection at session start (correct pattern)
- Weighted completion scoring (makes business sense)
- Optimistic locking concept (right pattern, wrong implementation)
- Two-schema separation (clean, follows single-responsibility)

---

### Simplicity Review {#simplicity-review}

**Verdict:** 🔴 50x complexity for the problem

**Key Quote:**

> "The plan is solving the right problem with 50x the necessary complexity."

**Comparison Table:**

| Aspect            | Plan Proposes     | Actually Needed |
| ----------------- | ----------------- | --------------- |
| New DB columns    | 4 (with versions) | **0**           |
| New endpoints     | 5                 | **0**           |
| New tools         | 4                 | **0**           |
| Lines of code     | ~1000+            | **~20**         |
| Migrations        | Yes               | **No**          |
| Time to implement | Days              | **Hours**       |

**The 20-Line Fix:**

```typescript
// context-builder.ts - Add ONE line to existing parallel fetch
const [tenantResult, segmentsResult, sectionsResult, projectsResult, factsResult] =
  await Promise.all([
    callMaisApi('/tenant-context', tenantId),
    callMaisApi('/tenant-segments', tenantId),
    callMaisApi('/tenant-sections', tenantId),
    callMaisApi('/tenant-projects', tenantId, { activeOnly: true, limit: 10 }),
    callMaisApi('/get-discovery-facts', tenantId), // THIS IS THE FIX
  ]);

// Add to context prompt
function buildContextPromptSection(context): string {
  const factsLines = Object.entries(context.facts)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return `
## Known Facts (DO NOT ask about these)
${factsLines || 'None yet - start the interview pattern.'}

## Current Sections
${context.sections.map((s) => `- ${s.blockType}: ${s.isDraft ? 'DRAFT' : 'published'}`).join('\n')}
`;
}
```

**What Should Be Cut (80% of plan):**

| Cut This                      | Keep Instead                          |
| ----------------------------- | ------------------------------------- |
| `websiteSchema` column        | Use existing `SectionContent.isDraft` |
| `tenantProfile` column        | Use existing `discoveryFacts`         |
| Optimistic locking (versions) | Delete entirely                       |
| Weighted completion score     | Simple "X sections empty" list        |
| Section state machine         | `isDraft` boolean suffices            |
| 4 new API endpoints           | Add to 1 existing endpoint            |
| `add_insight` tool            | Keep existing `store_discovery_fact`  |
| `mark_section_accepted` tool  | Reuse `update_section`                |
| `skip_section` tool           | Reuse `update_section`                |
| Migration script              | No new storage needed                 |

**The 6-Month Test:**

> "With the current plan, future developers will see 6+ different places storing section content and ask 'Why?' With the simple fix, the context builder fetches all relevant data. Clear, obvious, one place to look."

---

### Git History Archaeological Report {#git-history}

**Analysis Period:** December 26, 2025 - February 1, 2026 (38 days)
**Total Agent-Related Commits:** ~250+
**Lines of Code Deleted in Migration:** ~50,500

#### Valuable Patterns LOST in Migration

| Pattern                     | What It Did                                             | Status Now |
| --------------------------- | ------------------------------------------------------- | ---------- |
| **LLM-as-Judge Evaluation** | Auto-scored agent conversations, flagged low quality    | ❌ DELETED |
| **Human Review Queue**      | Tenant-scoped queue for flagged conversations           | ❌ DELETED |
| **Circuit Breaker**         | Max 20 turns, 100k tokens, 30 min per session           | ❌ DELETED |
| **Prometheus Metrics**      | `agent_tool_calls_total`, `agent_turn_duration_seconds` | ❌ DELETED |

**Original Circuit Breaker (Deleted):**

```typescript
// Was in server/src/agent/orchestrator/circuit-breaker.ts
const LIMITS = {
  maxTurnsPerSession: 20,
  maxTokensPerSession: 100_000,
  maxTimePerSession: 30 * 60 * 1000, // 30 minutes
  consecutiveErrorThreshold: 3,
  idleTimeoutMs: 30 * 60 * 1000,
};
```

**Original Prometheus Metrics (Deleted):**

```typescript
// Was in server/src/agent/orchestrator/metrics.ts
const metrics = {
  agent_tool_calls_total: new Counter({
    name,
    help,
    labelNames: ['name', 'tier', 'status', 'agent_type'],
  }),
  agent_rate_limit_hits_total: new Counter({ name, help }),
  agent_circuit_breaker_trips_total: new Counter({ name, help }),
  agent_turn_duration_seconds: new Histogram({ name, help, buckets }),
  agent_active_sessions: new Gauge({ name, help }),
  agent_proposals_total: new Counter({ name, help, labelNames: ['status', 'tier'] }),
};
```

#### Recurring Problems (Failed Multiple Times)

| Problem                         | Times Recurred | Root Cause                                   |
| ------------------------------- | -------------- | -------------------------------------------- |
| **Trust Tier Enforcement**      | 5+             | Prompt-only security, no programmatic checks |
| **Session State Format**        | 3+             | A2A passes JSON, ADK expects Map-like API    |
| **Fact-to-Storefront Bridge**   | 2+             | Agent stores facts but forgets to apply them |
| **Dashboard Action Extraction** | 2+             | Frontend only checks tool names, not results |

#### Hidden Gems (Still Exist But Underused)

| Gem                       | Location                                             | Opportunity                          |
| ------------------------- | ---------------------------------------------------- | ------------------------------------ |
| **LLM Abstraction Layer** | `server/src/llm/`                                    | Retry logic, pricing, error handling |
| **Industry Benchmarks**   | `server/src/agent/onboarding/industry-benchmarks.ts` | 18 business types with pricing data  |
| **Event Sourcing**        | `server/src/agent/onboarding/event-sourcing.ts`      | Optimistic locking, version tracking |
| **Shared Voice Module**   | `server/src/agent-v2/shared/voice.ts`                | Brand voice rules                    |

#### Retrospective Quotes (from docs)

> "The plan optimized for _deployment velocity_ over _code quality_. Gates verified 'is it running?' but not 'is it correct?'"

> "Phase 3 was the biggest source of issues (10 of 19). 3 agents deployed in 3 days, no code review between agents."

> "No time for code review between phases. Gates became rubber stamps. Technical debt accumulated silently."

---

### Enterprise Architecture Principles {#architecture-principles}

From the compound engineering plugin system, these principles apply:

#### The 5 Core Principles

| Principle                 | Definition                                 | MAIS Status         |
| ------------------------- | ------------------------------------------ | ------------------- |
| **Parity**                | Every UI action = agent capability         | ⚠️ Gaps exist       |
| **Granularity**           | Tools are primitives, features are prompts | ⚠️ Mixed            |
| **Composability**         | New features via prompts, not code         | ⚠️ Scattered        |
| **Emergent Capability**   | Agent handles unanticipated requests       | ❓ Untested         |
| **Improvement Over Time** | Better without shipping code               | ❌ Requires deploys |

#### The "Patchwork" Problem

**Symptoms (all present in MAIS):**

- Agent A publishes to feed, Agent B can't read it
- Tool exists in Agent X but not Agent Y
- Context injection differs across agents
- Multiple ways to do the same thing
- Sync layer between agents

**Prevention requires:**

1. Unified Orchestrator - Single execution engine
2. Shared Tool Definitions - One set of primitives
3. Shared Workspace - Single data space
4. Unified Context Injection - Consistent system prompt structure
5. Capability Map - Single source of truth

#### Tool Design Golden Rules

```typescript
// ❌ WRONG: Logic lives in tool
tool('process_feedback', { feedback, category, priority });

// ✅ RIGHT: Logic lives in prompt
tool('store_item', { key, value });
```

#### The Completion Signal Pattern

```typescript
// ❌ WRONG: Heuristic detection
'Agent finished when no tool calls for 2 iterations';

// ✅ RIGHT: Explicit completion
tool('complete_task', { summary, status, shouldContinue });
```

---

### Agent-Native Architecture Review {#agent-native-review}

**Verdict:** The fix is 20 lines of context injection, not a new architecture.

#### What MAIS Is Doing Wrong

```typescript
// vertex-agent.service.ts:265 - Session creation ONLY passes tenantId
body: JSON.stringify({ state: { tenantId } }),
// discoveryFacts are NOT injected at session start
```

#### What Should Happen

```typescript
// Pseudo-fix (approximately 20 lines):
const bootstrap = await this.fetchBootstrapData(tenantId);
const sessionState = {
  tenantId,
  discoveryFacts: bootstrap.discoveryData,  // The missing piece
  onboardingDone: bootstrap.onboardingDone,
  businessName: bootstrap.businessName,
};
body: JSON.stringify({ state: sessionState }),
```

#### Architecture Checklist

| Criterion                                   | MAIS Status                |
| ------------------------------------------- | -------------------------- |
| **Parity:** UI action = agent capability    | ✅ PASS                    |
| **Granularity:** Tools are primitives       | ✅ PASS                    |
| **CRUD Completeness:** Full CRUD per entity | ✅ PASS                    |
| **Shared Workspace:** Same tenant data      | ✅ PASS                    |
| **Completion Signals:** Dashboard actions   | ✅ PASS                    |
| **Dynamic Context at Start**                | ❌ **FAIL - THE BUG**      |
| **Context Freshness**                       | ❌ **FAIL - Not injected** |

#### On the 3-Agent Architecture

> "Keep the current 3 agents. The consolidation is already done correctly. The tenant vs customer split is a **security boundary**, not architectural complexity."

Combining tenant-agent and customer-agent would create CLAUDE.md pitfall #60 (dual-context prompt-only security).

#### What NOT to Add

- ❌ New database columns for "agentContext"
- ❌ New endpoints for "context refresh"
- ❌ New tools for "sync context"
- ❌ Event-sourcing for context changes

---

### Prompt Engineering Review {#prompt-engineering-review}

**Key Insight:**

> "LLMs are statistically biased toward generating text, not tool calls, especially on the first turn."

#### The Problem with Current Approach

```markdown
# Current system prompt instruction (BROKEN)

**EVERY TURN:**

1. Call get_known_facts FIRST to see what you already know
2. Skip questions for facts you already have
```

The agent often skips step 1 and goes straight to asking questions.

#### The Solution: Pre-Injected Context

Make the system prompt a function, not a constant:

```typescript
// Current (problematic)
export const TENANT_AGENT_SYSTEM_PROMPT = `...`;

// Proposed (context-aware)
export function buildTenantAgentSystemPrompt(bootstrapData: BootstrapResponse): string {
  return `# HANDLED Tenant Agent

## Identity
You are a business concierge for photographers, coaches, therapists...

## What You Already Know About This Tenant
${buildKnownFactsSection(bootstrapData.discoveryData)}

## What You Still Need To Learn
${buildUnknownsSection(bootstrapData)}

## Core Behavior
...`;
}
```

#### The "Active Memory Block" Pattern

```markdown
## What You Already Know About This Tenant

**Business Profile:**

- Name: Sunrise Photography
- Type: Wedding photographer
- Location: Seattle, WA

**What you still need to learn:**

- [ ] Testimonials (none collected yet)
- [ ] FAQ topics
- [ ] Pricing structure

→ Focus your questions on the unchecked items above.
**Rule:** Never ask about topics with values. Only ask about unchecked items.
```

#### Recommended Prompt Structure

```markdown
## Discovery Progress

✓ Business type (wedding photographer) - DONE, never ask
✓ Location (Seattle, WA) - DONE, never ask
→ Dream client - ASK THIS NEXT
○ Testimonials - ask after dream client
○ FAQs - ask if they mention common questions

**Legend:** → = Ask now | ○ = Ask later | ✓ = Done (never ask)
```

#### Anti-Repetition Rule

```markdown
## Anti-Repetition Rule

If you're about to ask "What do you do?" or "Tell me about your business":

1. STOP
2. Check the "What You Already Know" section above
3. If businessType exists, skip this question entirely
4. If it doesn't exist, proceed with the question

**You already asked questions if you see answers in Known Facts. Never ask again.**
```

---

## The 50-Line Fix vs. Full Consolidation {#the-fix}

### The Immediate Fix (P0 Bug)

All 7 reviews agree on this approach:

**File 1: `vertex-agent.service.ts`**

```typescript
// In createSession(), around line 250:

// 1. Call bootstrap to get discovery facts
const bootstrap = await this.fetchBootstrapData(tenantId);

// 2. Include in ADK session state
body: JSON.stringify({
  state: {
    tenantId,
    discoveryFacts: bootstrap.discoveryData || {},
    businessName: bootstrap.businessName,
    onboardingDone: bootstrap.onboardingDone,
  }
}),
```

**File 2: `tenant/src/prompts/system.ts`**

```typescript
// Change from constant to function
export function buildTenantAgentSystemPrompt(bootstrapData: BootstrapResponse): string {
  const knownFactsBlock = bootstrapData.discoveryData
    ? formatKnownFacts(bootstrapData.discoveryData)
    : `## Known Facts\n*Nothing stored yet. Start with discovery questions.*`;

  return `# HANDLED Tenant Agent

## Identity
...

${knownFactsBlock}

## Core Behavior
...`;
}

function formatKnownFacts(facts: Record<string, unknown>): string {
  const lines: string[] = ['## What You Already Know'];
  if (facts.businessType) lines.push(`- Business type: ${facts.businessType}`);
  if (facts.location) lines.push(`- Location: ${facts.location}`);
  if (facts.dreamClient) lines.push(`- Dream client: ${facts.dreamClient}`);
  if (facts.targetMarket) lines.push(`- Target market: ${facts.targetMarket}`);
  // ... other fact types

  lines.push('\n**Rule:** Never ask about topics listed above.');
  return lines.join('\n');
}
```

### Full Consolidation Roadmap

Based on all reviews, the right-sized consolidation is:

| Phase       | Scope                            | Effort  | Priority |
| ----------- | -------------------------------- | ------- | -------- |
| **Phase 1** | Context injection fix (50 lines) | 1 day   | P0       |
| **Phase 2** | Recover circuit breaker          | 1 week  | P1       |
| **Phase 3** | Recover evaluation pipeline      | 1 week  | P2       |
| **Phase 4** | Add observability metrics        | 1 week  | P2       |
| **Phase 5** | Consolidate draft systems        | 2 weeks | P3       |
| **Phase 6** | Deprecate XState onboarding      | 2 weeks | P3       |

### What NOT to Build

| Original Plan Item          | Why Cutting                           |
| --------------------------- | ------------------------------------- |
| `websiteSchema` column      | Use existing `SectionContent.isDraft` |
| `tenantProfile` column      | Use existing `discoveryFacts`         |
| 4 new API endpoints         | Not needed                            |
| 4 new agent tools           | `store_discovery_fact` already exists |
| Weighted completion score   | Simple checklist is clearer           |
| Migration scripts           | No new storage needed                 |
| Optimistic locking versions | No evidence of write conflicts        |

---

## Lost Enterprise Patterns to Recover {#lost-patterns}

### 1. Circuit Breaker (P1 Priority)

**What It Did:**

- Max 20 turns per session
- Max 100k tokens per session
- Max 30 minutes per session
- Consecutive error tracking
- Idle timeout

**Why It Matters:** Prevents runaway sessions that consume resources and frustrate users.

**Implementation Approach:** Add to Cloud Run agent request handlers.

### 2. Evaluation Pipeline (P2 Priority)

**What It Did:**

- LLM-as-Judge scoring (effectiveness, experience, safety)
- Auto-flagged low-quality conversations
- Calibration system for consistent scoring

**Why It Matters:** Automated quality control without human review of every conversation.

**Implementation Approach:** Add as async post-processing after session ends.

### 3. Prometheus Metrics (P2 Priority)

**What It Did:**

- `agent_tool_calls_total` by name, tier, status
- `agent_turn_duration_seconds` histogram
- `agent_active_sessions` gauge
- `agent_circuit_breaker_trips_total`

**Why It Matters:** Operational visibility for debugging and capacity planning.

**Implementation Approach:** Add OpenTelemetry metrics to Cloud Run agents.

### 4. Human Review Queue (P3 Priority)

**What It Did:**

- Tenant-scoped queue of flagged conversations
- PII redaction for reviewer privacy
- Actions: approve, reject, escalate

**Why It Matters:** Human oversight for edge cases and compliance.

**Implementation Approach:** Add to tenant dashboard as new feature.

---

## Open Questions Requiring Decision {#open-questions}

### Question 1: Core Agent Identity

**Which model should drive the agent's behavior?**

| Option                             | Description                                   |
| ---------------------------------- | --------------------------------------------- |
| **A: Conversational Interface**    | Chat → tool calls, minimal memory, stateless  |
| **B: Persistent Business Partner** | Deep context, accumulated insights, proactive |

**Reviewer Consensus:** Option B aligns with the brainstorm vision and requires pre-injected context.

### Question 2: Onboarding System

**Should the legacy XState onboarding state machine be deprecated?**

| Current State                                     | Implications                     |
| ------------------------------------------------- | -------------------------------- |
| XState + AdvisorMemoryService running in parallel | Dual systems, maintenance burden |
| Agent handles onboarding conversationally         | Single system, simpler           |

**Reviewer Consensus:** The XState system adds complexity. If the agent can handle onboarding with injected context, deprecate XState.

### Question 3: Memory Architecture

**What's the right memory model?**

| Option               | Description                     | Tradeoffs                                |
| -------------------- | ------------------------------- | ---------------------------------------- |
| **A: Event-sourced** | Append-only log, state computed | Complex, good for audit                  |
| **B: State-based**   | Current state stored directly   | Simple, what `discoveryFacts` already is |
| **C: Hybrid**        | State + significant events      | Middle ground                            |

**Reviewer Consensus:** State-based (Option B) is sufficient unless compliance requires audit trails.

### Question 4: Agent Count

**How many agents should exist?**

| Option               | Description                    | Security                |
| -------------------- | ------------------------------ | ----------------------- |
| **A: 1 unified**     | Single agent, all capabilities | ❌ Dual-context risk    |
| **B: 2 role-based**  | Customer + tenant              | ✅ Security boundary    |
| **C: 3 specialized** | Current architecture           | ✅ Already consolidated |

**Reviewer Consensus:** Keep current 3 agents. The tenant/customer split is a security boundary.

### Question 5: Draft System Consolidation

**Which draft system should be the single source of truth?**

| Option                           | Description            | Migration                 |
| -------------------------------- | ---------------------- | ------------------------- |
| **A: `landingPageConfig.draft`** | Visual Editor's system | Agent writes here         |
| **B: `landingPageConfigDraft`**  | Agent's system         | Visual Editor writes here |
| **C: New unified system**        | Neither current system | Both migrate              |

**Reviewer Consensus:** Consolidate to one system (Option A or B), don't create a third.

### Question 6: Pattern Recovery Priority

**Which lost patterns should be recovered first?**

| Pattern             | Effort | Impact                    |
| ------------------- | ------ | ------------------------- |
| Circuit Breaker     | Medium | Prevents runaway sessions |
| Evaluation Pipeline | High   | Automated quality control |
| Prometheus Metrics  | Medium | Operational visibility    |
| Human Review Queue  | High   | Compliance, edge cases    |

**No clear consensus.** Depends on business priorities.

---

## Recommended Path Forward {#recommendations}

Based on synthesis of all 7 expert reviews:

### Immediate Actions (This Week)

1. **Fix context injection (P0)**
   - Add discoveryFacts to ADK session state
   - Make system prompt a function with injected context
   - ~50 lines of code, testable in hours

2. **Do NOT build the dual-schema architecture**
   - The plan is over-engineered
   - Existing storage is sufficient
   - Focus on unified reads, not more writes

### Short-Term (Next 2 Sprints)

3. **Recover circuit breaker (P1)**
   - Prevent runaway sessions
   - Add to Cloud Run agent handlers

4. **Consolidate draft systems (P2)**
   - Pick one: `landingPageConfig.draft` OR `landingPageConfigDraft`
   - Migrate the other
   - Delete the deprecated path

### Medium-Term (Next Quarter)

5. **Recover evaluation pipeline (P2)**
   - LLM-as-Judge for quality scoring
   - Async post-processing

6. **Deprecate XState onboarding (P3)**
   - If agent handles onboarding well, remove parallel system
   - Reduces maintenance burden

7. **Add observability metrics (P2)**
   - OpenTelemetry integration
   - Custom dashboards for agent health

### Architecture Principles to Follow

1. **Unified reads, not more writes** - Don't add storage, fix context injection
2. **Tools are primitives** - Logic in prompts, not tool code
3. **Inject, don't expect tool calls** - LLMs skip tools; pre-inject context
4. **Security boundaries** - Keep tenant/customer agent split
5. **Recover lost patterns** - Circuit breaker, evals, metrics were valuable

---

## Code Examples and Implementation Details {#code-examples}

### Current System Prompt Location

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

### Current Session Creation

**File:** `server/src/services/vertex-agent.service.ts:250-270`

### Bootstrap Endpoint

**File:** `server/src/routes/internal-agent.routes.ts`
**Endpoint:** `POST /v1/internal/agent/bootstrap`
**Returns:** `{ tenantId, businessName, onboardingDone, discoveryData }`

### Discovery Facts Storage

**File:** `server/src/routes/internal-agent.routes.ts`
**Endpoint:** `POST /v1/internal/agent/store-discovery-fact`
**Storage:** `tenant.branding.discoveryFacts` (JSON field)

### Context Builder (Needs Modification)

**File:** `server/src/agent-v2/deploy/tenant/src/context-builder.ts`

### Existing Tools

| Tool                   | File                                   | Purpose                       |
| ---------------------- | -------------------------------------- | ----------------------------- |
| `store_discovery_fact` | `tenant/src/tools/discovery.ts`        | Stores personality facts      |
| `get_known_facts`      | `tenant/src/tools/discovery.ts`        | Retrieves stored facts        |
| `get_page_structure`   | `tenant/src/tools/storefront-read.ts`  | Gets current storefront state |
| `update_section`       | `tenant/src/tools/storefront-write.ts` | Updates section content       |

---

## Appendix: Full Review Documents

The complete output from each review agent is available at:

- `/private/tmp/claude/-Users-mikeyoung-CODING-MAIS/tasks/a97ecb7.output` (DHH)
- `/private/tmp/claude/-Users-mikeyoung-CODING-MAIS/tasks/a9a039d.output` (Kieran)
- `/private/tmp/claude/-Users-mikeyoung-CODING-MAIS/tasks/a2204b3.output` (Simplicity)
- `/private/tmp/claude/-Users-mikeyoung-CODING-MAIS/tasks/ac753e3.output` (Git History)
- `/private/tmp/claude/-Users-mikeyoung-CODING-MAIS/tasks/a008e7c.output` (Architecture Principles)
- `/private/tmp/claude/-Users-mikeyoung-CODING-MAIS/tasks/a7f562b.output` (Agent-Native)
- `/private/tmp/claude/-Users-mikeyoung-CODING-MAIS/tasks/ab00681.output` (Prompt Engineering)

---

## Document Metadata

**Created:** 2026-02-01
**Author:** Claude Code (synthesis of 7 parallel review agents)
**Purpose:** Context handoff for strategic decision making
**Next Step:** Input to another AI agent for consolidated recommendation

**Key Files Referenced:**

- `docs/brainstorms/2026-01-31-dual-schema-agent-architecture-brainstorm.md`
- `docs/plans/2026-01-31-feat-dual-schema-agent-architecture-plan.md`
- `server/src/services/vertex-agent.service.ts`
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
- `server/src/agent-v2/deploy/tenant/src/context-builder.ts`
- `server/src/routes/internal-agent.routes.ts`
- `CLAUDE.md` (90 pitfalls documented)
