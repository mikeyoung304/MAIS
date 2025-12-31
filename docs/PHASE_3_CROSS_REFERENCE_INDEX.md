---
title: Phase 3 Agent-Powered Tenant Onboarding - Cross-Reference Index
category: documentation
date: 2025-12-31
status: Complete Research & Cross-Reference Map
---

# Phase 3 Agent-Powered Tenant Onboarding - Cross-Reference Index

**Purpose:** Map all related documentation for Phase 3 implementation, spanning agent architecture, onboarding strategy, market research, state management, and security patterns.

**Updated:** 2025-12-31

---

## Implementation Plan Reference

### Primary Plan Document

**Location:** `/Users/mikeyoung/CODING/MAIS/plans/agent-powered-tenant-onboarding.md` (1,436 lines)

**Status:** Ready for Implementation (Post-Review: Quality-First Revision)

**Contents:**

- Executive summary with Phase 1, Phase 2, Phase 3 consolidation
- Architecture overview (Quality-First with XState, event sourcing, OpenTelemetry)
- 4 simplified user phases (discovery → market research → service design + pricing → marketing)
- Database schema with OnboardingEvent model for event sourcing
- Type system with Zod schemas and discriminated unions
- XState formal state machine with guards and actions
- 3 consolidated core tools + 2 external tools
- Industry benchmarks data (5 business types: wedding photographer, portrait, therapist, coach, planner)
- Market search with graceful fallback architecture
- Advisor memory service for cross-session context
- Live preview panel component
- Unified system prompt with phase injection
- 4 build phases (Foundation → Tools → Conversation → Frontend + Polish)
- Acceptance criteria, success metrics, risk analysis
- Incorporated feedback from DHH, Kieran (Technical), Simplicity reviewer

**Key Insights:**

- Event sourcing provides complete audit trail
- Fallback-first architecture (benchmarks always available, web search is enhancement)
- Market research response < 5 seconds with fallback < 100ms
- Onboarding completion target: 80% (current ~40%)

---

## Agent Architecture Documentation

### Core Agent Design System

**Location:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/agent-design/`

#### 1. INDEX.md (8 KB)

**Document Type:** Navigation Hub
**Audience:** All engineers
**Purpose:** Central reference point for agent design system

**Key Sections:**

- Quick start (4 linked guides for different use cases)
- Complete overview of 4 documents in the agent design system
- Pattern quick reference (4 layers, 5 steps, 3 trust tiers)
- When to use/not use patterns
- Implementation roadmap (4 phases: Design → Core Infrastructure → Tools → Validation)
- Code examples by use case (read-only agent, admin booking, payment/refund)
- Key insights (trust tiers reduce fatigue, single context layer simplicity, tools must be primitives)
- Architecture diagram with 4-layer user interaction flow

**Cross-Reference Value:**

- Trust tier system applicable to onboarding tools (T1: reads, T2: writes, T3: high-risk)
- Single context layer pattern for session context loading
- Server-side approval mechanism for tool execution

#### 2. AGENT_DESIGN_SYSTEM_PATTERNS.md (27 KB)

**Document Type:** Complete Design Guide
**Audience:** Architects, lead engineers
**Length:** 8,500+ words

**Key Sections:**

- 5-step design process (capability mapping → system prompt → context injection → approval workflow → simplification)
- Part 1: Capability Maps (defining agent actions)
- Part 2: System Prompts (identity, behaviors, examples)
- Part 3: Context Injection (session-scoped data)
- Part 4: Trust Tier Approval Mechanism (T1/T2/T3 routing)
- Part 5: Simplification (single context layer vs multi-layer)
- Design Patterns A-E with full code examples
- Design Review Validation (3 case studies)
- Implementation Checklist (30 items)
- Anti-patterns & pitfalls

**Cross-Reference Value:**

- Pattern A: "Layered Agent" - applicable to onboarding orchestrator
- Pattern B: "Data-First Tool Design" - service creation tools
- Pattern C: "Trust Tier Gating" - approval workflow for market research, service creation
- Pattern D: "Context Injection at Auth Time" - advisor memory loading
- Pattern E: "Single Context Layer" - immutable session context

#### 3. AGENT_DESIGN_QUICK_REFERENCE.md (7.8 KB)

**Document Type:** Cheat Sheet
**Audience:** All engineers
**Use:** Print and pin above desk

**Key Sections:**

- 30-second design framework
- Trust tiers cheat sheet (T1, T2, T3 with examples)
- Templates: Capability map, system prompt, context shape
- Implementation checklist (design, code, testing)
- Code templates for approval endpoint and tool implementation
- Common errors & fixes

**Cross-Reference Value:**

- Trust tier examples directly applicable to onboarding tools
- Tool implementation template matches onboarding tool patterns
- Error checklist includes multi-tenant isolation (critical for onboarding)

#### 4. AGENT_DESIGN_REVIEW_METHODOLOGY.md (14 KB)

**Document Type:** Validation Process Guide
**Audience:** Architects, reviewers

**Key Sections:**

- 6 parallel specialist reviews:
  1. Architecture (system design, layering)
  2. Security (injection, isolation, authentication)
  3. UX (confirmation fatigue, clarity)
  4. Agent-Native (primitives, reasoning, composability)
  5. Implementation (feasibility, code patterns)
  6. Simplicity (over-engineering)
- Design review validation results
- Key findings from multi-agent review
- Implementation roadmap based on findings

**Cross-Reference Value:**

- Security specialist review applicable to tenant isolation in onboarding
- Agent-Native specialist guidance for tool design (primitives vs workflows)
- Implementation feasibility checklist

---

### Growth Assistant & Coaching Agent Patterns

#### 5. AGENT-NATIVE-COACHING-PREVENTION-STRATEGIES-MAIS-20251228.md (24 KB)

**Document Type:** Prevention Strategies Guide
**Audience:** Developers implementing agent features
**Date:** Dec 28, 2025

**Key Sections:**

- Prevention Strategy #1: Context Injection Sanitization (prompt injection prevention)
- Prevention Strategy #2: Token Budget Awareness (consolidate redundant prompts)
- Prevention Strategy #3: Deprecated Code Cleanup Policy (2-week removal window)
- Prevention Strategy #4: Agent-Native Patterns Checklist (guide vs micromanage)
- Test cases for sanitization, ordering, token budget
- Quick checklist (print & pin)

**Cross-Reference Value:**

- Context injection sanitization essential for advisor memory (user-controlled discovery data)
- Token budget awareness for onboarding system prompt (discovery + market + service data)
- Agent-native patterns guidance for pricing/service design advice (guide not micromanage)
- Example: Pricing coaching prevents over-recommending

**Related:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/agent-design/AGENT-NATIVE-COACHING-QUICK-CHECKLIST-MAIS-20251228.md` (9.2 KB)

#### 6. AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md (6.0 KB)

**Document Type:** Architecture Decision Record
**Date:** Dec 28, 2025

**Key Sections:**

- Decision: Consolidate multiple coaching tools into 3 primitives
- Problem: Too many tools (8+), overlap, complexity
- Solution: 3 core tools + helper functions
- Trade-offs: Less flexibility vs reduced complexity
- Implementation patterns

**Cross-Reference Value:**

- Directly parallels Phase 3 tool consolidation (8+ tools → 3 core tools)
- Validates decision to combine service design + pricing phase
- Guidance on tool granularity

---

### Architecture Evaluation & Analysis

#### 7. AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md (27 KB)

**Document Type:** Architecture Evaluation & Prevention
**Date:** Dec 28, 2025

**Key Sections:**

- 8 critical architecture prevention strategies
- Circular dependency prevention (executor registry pattern)
- Session isolation patterns
- Tool execution error handling
- Trust tier edge cases
- Performance considerations for agent systems
- Security evaluation checklist

**Cross-Reference Value:**

- Circular dependency prevention critical for onboarding orchestrator
- Session isolation prevents cross-tenant onboarding state leakage
- Tool execution patterns for market search fallback handling
- Trust tier edge cases for T1/T2/T3 onboarding tools

#### 8. AGENT-ARCHITECTURE-INDEX-MAIS-20251228.md (13 KB)

**Document Type:** Navigation & Index
**Date:** Dec 28, 2025

**Key Sections:**

- Complete index of agent architecture documentation
- Navigation guide by use case
- Decision tree for agent feature implementation
- Related prevention strategies
- Quick reference tables

---

## Onboarding & Phase Journey Documentation

### Tenant Journey Documentation

**Location:** `/Users/mikeyoung/CODING/MAIS/docs/user-flows/TENANT_JOURNEY.md`

**Key Sections:**

- Complete tenant lifecycle (6 phases including future analytics)
- Phase 1-5 detailed walkthrough
- Feature-by-feature breakdown
- Current capabilities snapshot
- Future enhancement roadmap

**Cross-Reference Value:**

- Phase 1 of tenant journey is "Onboarding" (platform admin creates account)
- Phase 2 is "Initial Setup" (first login, branding config)
- Phase 3 is "Service Configuration" (packages, add-ons, availability)
- Phase 3 onboarding replaces manual Phase 2-3 with conversational AI guidance

---

### Agent-Powered Tenant Onboarding Plan

**Location:** `/Users/mikeyoung/CODING/MAIS/plans/agent-powered-tenant-onboarding.md`

**Related Implementation Commits:**

- `903da20` feat(onboarding): implement Phase 1 agent-powered tenant onboarding
- `c11cda2` feat(onboarding): implement Phase 2 tools and market research
- `2598ba8` docs: add import name mismatch prevention solution

---

## Security & Multi-Tenant Patterns

### Multi-Tenant Implementation Guide

**Location:** `/Users/mikeyoung/CODING/MAIS/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`

**Key Patterns:**

- Tenant ID scoping (all queries filter by tenantId)
- Ownership verification (tenant owns resource)
- JWT authentication (tenantAuth from middleware)
- Cache key isolation (include tenantId in keys)

**Cross-Reference Value:**

- All onboarding tools MUST scope operations by tenantId
- Onboarding events must be tenant-scoped (no data leakage)
- Market research results cached per-tenant
- Service creation atomic within tenant context

### Circular Dependency Prevention

**Location:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md`

**Key Pattern:**

- Extract shared state (executor registry) to dedicated module
- Routes and orchestrators both import from central module
- Prevents circular imports between routes and tool orchestrators

**Cross-Reference Value:**

- Onboarding orchestrator must register executors in central registry
- Market search executor, service creation executor, storefront update executor
- Pattern prevents circular imports between `/v1/agent/onboarding` routes and tools

---

## Proposal & Execution Patterns

### Chatbot Proposal Execution Flow

**Location:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md`

**Key Sections:**

- Proposal state machine (PENDING → CONFIRMED → EXECUTED)
- T2 vs T3 execution flows
- Field normalization for backward compatibility
- Tenant validation in executor

**Cross-Reference Value:**

- Onboarding tools use proposal pattern for T2/T3 operations (service creation)
- State transitions must trigger executor invocation (verified pattern)
- Proposal object must propagate to API response (for client preview updates)

---

## Import & Naming Conventions

### Import Name Mismatch Prevention

**Location:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/build-errors/import-name-mismatch-onboarding-tools-MAIS-20251231.md`

**Context:** Recent issue with onboarding tools imports

**Key Learning:**

- Consistent naming between contracts and implementation
- Type imports vs value imports
- Re-export patterns for tool registry

**Cross-Reference Value:**

- Onboarding tool schemas exported from `@macon/contracts/schemas/onboarding.schema`
- Tool implementations imported consistently across files
- Tool registry imports from central location (not routes)

---

## Prevention Strategy Indexes & Checklists

### PREVENTION-STRATEGIES-INDEX.md

**Location:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/PREVENTION-STRATEGIES-INDEX.md`

**Purpose:** Navigation hub for all prevention documentation

**Key Indexes:**

- Overview documents (comprehensive, quick reference, roadmap)
- Parallel resolution guides
- Multi-agent code review patterns
- Quality gates and validation

**Cross-Reference Value:**

- Links to all security and architectural prevention strategies
- Navigation by role (engineers, tech leads, project managers)
- Quick start paths (new to project, before PR submission, production issues)

---

## Design & UX Patterns

### Brand Voice Guide

**Location:** `/Users/mikeyoung/CODING/MAIS/docs/design/BRAND_VOICE_GUIDE.md`

**Key Sections:**

- Voice principles (transformation not features, identity, specificity)
- Design principles (whitespace, 80/20 colors, typography, elevation)
- Component patterns (buttons, cards, sections)

**Cross-Reference Value:**

- System prompt for agent should reflect HANDLED brand voice
- "You're a business consultant" (identity-focused, not feature-focused)
- UI components use consistent design system

---

## Database & Schema Patterns

### Schema Drift Prevention

**Location:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/database-issues/schema-drift-prevention-MAIS-20251231.md`

**Key Pattern:**

- Prisma migrations for tables/columns (Pattern A)
- Manual SQL for enums, indexes, extensions, RLS (Pattern B)
- OnboardingEvent model uses Pattern A (new table)

**Cross-Reference Value:**

- Onboarding implementation requires migration for OnboardingEvent model
- Decision guide for migration pattern selection
- Idempotent SQL patterns for manual migrations

---

## Testing & Quality Patterns

### Event Sourcing Patterns

**Key Files to Review:**

- `/Users/mikeyoung/CODING/MAIS/server/test/integration/PHASE3_INTEGRATION_TESTS.md`
- Event replay testing strategies
- State projection testing (events → onboardingState)
- Audit trail validation

### Property-Based Testing

**Pattern:** Generate random inputs, verify invariants

- Service creation atomicity (segment + packages)
- Market research fallback logic (always returns data)
- Advisor memory reconstruction from events

---

## State Machine & Orchestration Patterns

### Key Implementation References

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/`

**Existing Patterns:**

- Orchestrator in `orchestrator.ts` (session management, tool dispatch)
- Executor registry in `executor-registry.ts` (central registration)
- Tool patterns in `tools/` directory

**For Phase 3:**

- Onboarding state machine builds on orchestrator patterns
- Event sourcing layer separate from service layer
- Advisor memory service loads from events

---

## Navigation Quick Start

### By Role

**Platform Engineer (implementing Phase 3):**

1. Start: `/plans/agent-powered-tenant-onboarding.md` (complete plan)
2. Deep Dive: `/docs/solutions/agent-design/AGENT_DESIGN_SYSTEM_PATTERNS.md` (architecture)
3. Reference: `/docs/solutions/agent-design/AGENT_DESIGN_QUICK_REFERENCE.md` (cheat sheet)
4. Security: `/docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md`
5. Multi-Tenant: `/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`

**Code Reviewer:**

1. Quick Ref: `/docs/solutions/agent-design/AGENT_DESIGN_QUICK_REFERENCE.md`
2. Methodology: `/docs/solutions/agent-design/AGENT_DESIGN_REVIEW_METHODOLOGY.md`
3. Checklist: `/docs/solutions/agent-design/AGENT-NATIVE-COACHING-QUICK-CHECKLIST-MAIS-20251228.md`

**Security Auditor:**

1. Multi-Tenant Patterns: `/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md`
2. Architecture Evaluation: `/docs/solutions/agent-design/AGENT-ARCHITECTURE-EVALUATION-PREVENTION-STRATEGIES-MAIS-20251228.md`
3. Circular Dependencies: `/docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md`

---

## Key Decisions & Rationale

### Why Event Sourcing?

- Complete audit trail of every onboarding decision
- Replay for debugging production issues
- Analytics: "What questions take longest?"
- State can be projected from events (eventual consistency)

**Reference:** `/plans/agent-powered-tenant-onboarding.md` Section "1. Database Schema (Event Sourcing)"

### Why Fallback-First Market Research?

- Industry benchmarks ALWAYS available (reliability)
- Web search as enhancement, not dependency
- Graceful degradation: "I couldn't find local data, here's industry average"
- Response < 5 seconds guaranteed

**Reference:** `/plans/agent-powered-tenant-onboarding.md` Section "Fallback-First Architecture"

### Why Consolidate to 3 Tools?

- Fewer tools = easier reasoning for agent
- Consolidated service creation (segment + packages atomic)
- Combined service design + pricing (user thinks of them together)
- Still fine-grained enough for tool flexibility

**Reference:** Commits `c11cda2` and AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md

### Why XState State Machine?

- Provable correctness (can't enter invalid states)
- Guards validate transitions
- Actions have side effects (persist state, emit events)
- Developers familiar with (used elsewhere in codebase)

**Reference:** `/plans/agent-powered-tenant-onboarding.md` Section "3. State Machine (XState)"

---

## Success Metrics from Plan

| Metric                     | Current | Target        | Measurement                 |
| -------------------------- | ------- | ------------- | --------------------------- |
| Onboarding completion rate | ~40%    | 80%           | Completed / Started         |
| Time to first package      | Unknown | < 10 min      | Event timestamps            |
| Time to storefront live    | Unknown | < 20 min      | Event timestamps            |
| User satisfaction          | Unknown | 4.5/5         | Post-onboarding survey      |
| Resume success rate        | N/A     | 95%           | Users who return & complete |
| Market search latency      | Unknown | < 5 sec       | Performance traces          |
| Onboarding completion      | N/A     | 100% E2E test | E2E test pass               |

---

## Related Technical Specifications

### API Contract References

- System prompt uses `/v1/agent/chat` (existing)
- New endpoints: `/v1/agent/onboarding-state`, `/v1/agent/skip-onboarding`
- Tools return discriminated unions (not plain objects)
- All requests include X-Tenant-Key header

### Database References

- Onboarding state stored in `Tenant.onboardingPhase`, `Tenant.onboardingVersion`
- Events stored in new `OnboardingEvent` model
- Atomic operations use transactions with optimistic locking (onboardingVersion)

### Performance Requirements

- Market search response < 5 seconds (< 100ms with fallback)
- State transitions < 100ms (no noticeable delay)
- Live preview updates < 3 seconds (polling interval)

---

## Version & Status

- **Created:** 2025-12-31
- **Status:** Research Complete - Cross-Reference Map Ready for Implementation
- **Related Documents:** 20+ core documents identified
- **Total Documentation Coverage:** ~400 KB of reference material
- **Implementation Ready:** ✓ Yes (plan reviewed by DHH, Kieran, Simplicity reviewer)

---

**Next Steps:**

1. Use this index to navigate related documentation during implementation
2. Start with `/plans/agent-powered-tenant-onboarding.md` for complete plan
3. Reference specific architecture docs as needed during coding
4. Run design review with 6 specialists before major implementation
5. Use quick-reference docs during code review phase
