---
status: deferred
priority: p1
issue_id: 800
tags: [code-review, agent, tools, pitfall-88, memory-bank]
dependencies: []
deferred_to: 'Phase 4: Memory Bank Integration - see 2026-01-31-feat-enterprise-tenant-agent-architecture-plan.md'
---

# Missing store_discovery_fact Tool - Fact-to-Storefront Bridge Broken

## Problem Statement

The tenant-agent system prompt explicitly references `store_discovery_fact` tool (lines 449-454) for the fact-to-storefront bridge pattern (Pitfall #88), but **this tool does not exist** in the tenant-agent's tool registry.

**Why it matters:**

- The agent cannot follow its own prompt instructions
- Discovery facts from onboarding are not persisted
- Users' business information may be lost between sessions
- The documented prevention strategy for pitfall #88 is broken

## Findings

**From Architecture-Strategist agent:**

> The system prompt explicitly references pitfall #88 and instructs the agent to call `store_discovery_fact` when users provide section-specific content... However, the `store_discovery_fact` tool does not exist in the tenant-agent's tool registry.

**From ADK-Compliance agent:**

> The system prompt mentions `store_discovery_fact` (lines 449-453) but there's no corresponding tool in the tool files.

**Location in prompt (lines 449-454):**

```
├─ Does user say "my [X] should mention/say/include [content]"?
│  → This is BOTH a fact AND an update request (Pitfall #88)
│  → Call store_discovery_fact to save it
│  → IMMEDIATELY call update_section to apply it
```

## Proposed Solutions

### Option A: Implement store_discovery_fact Tool (Recommended)

**Pros:** Completes the fact-to-storefront bridge, enables persistent discovery facts
**Cons:** Additional development, needs backend endpoint
**Effort:** Medium (4-8 hours)
**Risk:** Low

Create a new tool that stores facts to the tenant's branding.discoveryFacts JSON field.

### Option B: Remove References from System Prompt

**Pros:** Quick fix, eliminates broken instructions
**Cons:** Loses onboarding memory capability, facts not persisted
**Effort:** Small (15 minutes)
**Risk:** Low

Simply remove lines 449-454 from system.ts and document that the unified agent doesn't persist facts.

### Option C: Defer to Vertex AI Agent Engine Memory

**Pros:** Proper persistent memory solution, semantic recall
**Cons:** Larger effort, requires Agent Engine integration
**Effort:** Large (1-2 weeks)
**Risk:** Medium

Implement IsolatedMemoryBank integration for persistent fact storage.

## Recommended Action

**Triage Decision (2026-01-31):** Option C - Defer to Vertex AI Agent Engine Memory

**Rationale:** The user prioritized enterprise-grade quality with persistent memory across sessions. Rather than implementing a temporary solution with `store_discovery_fact`, we'll implement proper Memory Bank integration that provides:

- Semantic fact extraction (automatic)
- Cross-session persistence
- Scoped by tenant for multi-tenant isolation
- Consolidation to prevent memory bloat

**Temporary Mitigation:** Remove references to `store_discovery_fact` from system prompt until Phase 4 is complete.

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (references tool)
- `server/src/agent-v2/deploy/tenant/src/tools/` (tool missing)
- `docs/solutions/agent-issues/FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md` (documents pattern)

**Related pitfalls:** #88 (Fact-to-Storefront bridge missing)

## Acceptance Criteria

- [ ] Either store_discovery_fact tool exists and is exported in tools/index.ts
- [ ] OR references to store_discovery_fact are removed from system prompt
- [ ] Agent can handle "my about section should mention X" requests correctly
- [ ] User-provided content is both stored (if Option A) AND applied to storefront

## Work Log

| Date       | Action                                    | Learnings                                     |
| ---------- | ----------------------------------------- | --------------------------------------------- |
| 2026-01-31 | Identified during multi-agent code review | Tool referenced in prompt but not implemented |

## Resources

- [FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md](docs/solutions/agent-issues/FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md)
- [Tenant agent system prompt](server/src/agent-v2/deploy/tenant/src/prompts/system.ts)
- Review handoff: docs/issues/2026-01-31-tenant-agent-review-handoff.md
