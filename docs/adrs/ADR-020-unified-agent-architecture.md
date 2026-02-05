# ADR-020: Unified Agent Architecture (3-Agent Consolidation)

**Status:** Accepted
**Date:** 2026-01-31
**Supersedes:** ADR-018 (Hub-and-Spoke), ADR-019 (Dual-Context)
**Decision Makers:** Engineering Team

## Context

The Phase 4 agent architecture evolved through two prior designs:

- **ADR-018** established a hub-and-spoke model with a Concierge orchestrator routing to 5 specialist agents via A2A protocol
- **ADR-019** proposed a dual-context pattern with `requireContext()` guards to share agents between user types

Both approaches introduced unnecessary complexity:

- Hub-and-spoke added latency from A2A delegation and session management overhead
- Dual-context required complex runtime guards and created security risks from shared tool access
- 6 Cloud Run services were expensive and complex to deploy

## Decision

Consolidate from 6 specialized agents into 3 direct-execution agents:

| Agent          | Cloud Run Service | Purpose                                                         |
| -------------- | ----------------- | --------------------------------------------------------------- |
| customer-agent | `customer-agent`  | Service discovery, booking, project hub (customer view)         |
| tenant-agent   | `tenant-agent`    | Storefront editing, marketing, project management (tenant view) |
| research-agent | `research-agent`  | Web research (unchanged)                                        |

Key changes:

1. **Eliminate A2A delegation** — All tools execute directly within each agent
2. **Physical separation by user type** — Customer tools in customer-agent, tenant tools in tenant-agent (instead of runtime guards)
3. **Direct tool execution** — No orchestrator routing, each agent has all tools it needs
4. **Reduce Cloud Run services** from 6 to 3

## Consequences

### Positive

- Reduced latency (no A2A delegation overhead)
- Simpler deployment (3 services instead of 6)
- Stronger security isolation (physical separation > runtime guards)
- Easier debugging (single agent handles entire user flow)

### Negative

- Some tool logic duplicated between customer-agent and tenant-agent (e.g., project hub tools)
- Larger individual agent deployments
- Research delegation from tenant-agent not yet implemented (tracked separately)

### Neutral

- Archived agents available in git history for reference
- Migration completed January 31, 2026
