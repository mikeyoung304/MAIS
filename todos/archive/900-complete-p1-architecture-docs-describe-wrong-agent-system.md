---
status: complete
priority: p1
issue_id: 900
tags: [docs-audit, architecture, agents, multi-agent-review]
dependencies: []
completed_date: 2026-02-05
---

# ARCHITECTURE.md and DEVELOPING.md Describe Wrong Agent Architecture

## Problem Statement

The two most critical architecture documents describe a **6-agent hub-and-spoke** system that was completely replaced by a **3-agent direct-execution** architecture on Jan 31, 2026. Any developer (human or AI) reading these docs will build on false assumptions.

**Why it matters:**

- ARCHITECTURE.md lines 318-363 describe 6 agents with hub-and-spoke ASCII diagram
- DEVELOPING.md lines 150-201 list 5 old Cloud Run URLs and deploy instructions for retired agents
- README.md lines 289-298 still lists "React 18 + Vite 6" and describes agents as "Future Roadmap"
- New AI agents will inherit these false assumptions and build on top of deleted systems

## Findings

**Cross-validated by 6/8 review agents:** Security Sentinel, Architecture Strategist, ADR Consistency, Conflicting Docs, Git History, Accretion Debt

### ARCHITECTURE.md (lines 318-363)

- Describes Concierge as "Hub orchestrator, routes to specialists" — RETIRED Jan 30
- Lists marketing-agent, storefront-agent, booking-agent, project-hub-agent — ALL RETIRED
- Shows A2A delegation pattern — ELIMINATED (tenant-agent line 12: "All tools execute directly")
- Deployed Agents table lists 6; only 3 exist: `customer-agent`, `tenant-agent`, `research-agent`

### DEVELOPING.md (lines 150-201)

- Lists 5 old Cloud Run URLs for concierge, marketing, storefront, booking, project-hub
- Deploy instructions reference `cd server/src/agent-v2/deploy/concierge` — directory doesn't exist
- Only customer/, research/, tenant/ exist in deploy/

### README.md

- Line 142: Agents described as "Future Roadmap" — they've been live since Jan 2026
- Lines 310-355: Project structure shows `server/src/agent/` (legacy) and `client/` (deleted)

### .github/workflows/deploy-agents.yml

- Line 172: Dead "concierge" conditional block (unreachable — matrix only has customer, tenant, research)
- Lines 174-175: Stale MARKETING_AGENT_URL and STOREFRONT_AGENT_URL environment variables

## Recommended Fix

1. Rewrite ARCHITECTURE.md agent section to describe 3-agent direct-execution model
2. Update DEVELOPING.md agent URLs and deploy instructions
3. Update README.md: agents are live, frontend is Next.js 14
4. Clean deploy-agents.yml dead blocks (lines 172-175)
5. Add CUSTOMER_AGENT_URL, TENANT_AGENT_URL, RESEARCH_AGENT_URL to .env.example

## Sources

- ADR Consistency Agent: Findings 1-2 (CRITICAL)
- Conflicting Docs Agent: Conflicts 1-4 (HIGH)
- Git History Agent: Section 2, Priority 1
- Architecture Strategist: 12 outdated/wrong items
- Security Sentinel: Finding about deprecated agents in ARCHITECTURE.md
