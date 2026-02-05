---
status: complete
priority: p1
issue_id: 901
tags: [docs-audit, adrs, architecture, multi-agent-review]
dependencies: []
---

# ADR-018 and ADR-019 Both Superseded But Not Marked — No Replacement ADR Exists

## Problem Statement

Two ADRs (018: Hub-and-Spoke, 019: Dual-Context) are marked "Accepted" but describe architectures that were completely replaced. The most significant architectural decision in the project's recent history — consolidating 5 agents into 3 with direct tool execution — has **no ADR documenting it**.

**Why it matters:**

- Future agents/developers will read ADR-018 and attempt to implement A2A delegation patterns
- ADR-019 describes `requireContext()` guards that don't exist anywhere in the codebase
- The 5→3 consolidation eliminated both the hub-and-spoke AND dual-context patterns
- DECISIONS.md shows both as "Accepted" — actively misleading

## Findings

**From ADR Consistency Agent (CRITICAL):**

### ADR-018 (Hub-and-Spoke)

- Describes Concierge orchestrator routing to specialists via A2A — ALL deleted
- References `server/src/agent-v2/deploy/concierge/src/agent.ts` — file doesn't exist
- References `PROJECT_HUB_AGENT_URL` — env var no longer used
- `delegate_to_project_hub` tool doesn't exist anywhere in codebase

### ADR-019 (Dual-Context)

- Describes single Project Hub Agent with `requireContext()` guards
- `requireContext()` returns ZERO matches in deployed agent code
- `contextType` reference doesn't exist in customer-agent or tenant-agent
- Project actually chose Option 1 that ADR-019 explicitly REJECTED (physical separation)

### ADR-008 Cross-Reference Error

- Lines 144, 154: References "ADR-012" when it should say "ADR-013"
- ADR-012 is about webhook test coverage, not advisory locks
- Header metadata is correct ("Superseded By: ADR-013"), body text wrong

### DECISIONS.md Status Discrepancies

- ADR-010: Says "Pending" but file says "Accepted (Implementation Pending)"
- ADR-014: Says "Accepted" but file says "Implemented"
- ADR-015, 016: Inconsistent casing ("ACCEPTED" vs "Accepted")

## Recommended Fix

1. Create **ADR-020: Unified Agent Architecture (3-Agent Consolidation)**
2. Mark ADR-018 as "Superseded by ADR-020" in both file and DECISIONS.md
3. Mark ADR-019 as "Superseded by ADR-020" in both file and DECISIONS.md
4. Fix ADR-008 cross-references: "ADR-012" → "ADR-013" on lines 144, 154
5. Create **ADR-021: SectionContent Normalized Storage** for Phase 5
6. Synchronize DECISIONS.md statuses (010, 014, 015, 016)

## Sources

- ADR Consistency Agent: All 12 findings
- Architecture Strategist: Missing ADR for consolidation
- Git History Agent: Timeline showing Phase 4 complete Jan 31
