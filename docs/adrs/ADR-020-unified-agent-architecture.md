# ADR-020: Unified Agent Architecture (3-Agent Consolidation)

**Status:** Accepted
**Date:** 2026-01-31
**Supersedes:** ADR-018 (Hub-and-Spoke), ADR-019 (Dual-Context)
**Decision Makers:** Engineering Team

## Context

The Phase 4 agent architecture evolved through two prior designs:

- **ADR-018** (Hub-and-Spoke) established a Concierge orchestrator routing to 5 specialist agents (booking, storefront, marketing, project-hub, research) via A2A protocol. It solved the "single monolithic agent" problem but introduced inter-agent communication overhead and 6 Cloud Run services.
- **ADR-019** (Dual-Context) proposed collapsing agents by user type and using `requireContext()` runtime guards to share tools between customer and tenant flows. It reduced service count but created security risks — a prompt injection could bypass runtime guards to access cross-context tools (see Pitfall #60).

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

## Alternatives Considered

### Keep 6 Separate Agents (ADR-018 Status Quo)

Retain the Concierge orchestrator with 5 specialists. Rejected because A2A delegation added 200-500ms per tool call, session state was fragmented across agents, and 6 Cloud Run services were expensive to maintain and deploy.

### Dual-Context Shared Agents (ADR-019)

Collapse by capability (e.g., one "project-hub-agent" serving both customers and tenants) with `requireContext()` runtime guards. Rejected because runtime guards are bypassable via prompt injection, shared tool registries made auditing difficult, and testing required full matrix of context x tool combinations.

### Microservice per Capability

One Cloud Run service per tool category (booking-service, storefront-service, etc.) called via HTTP from a thin agent layer. Rejected as over-engineering — added network hops without meaningful isolation benefit, and ADK's native tool execution is simpler.

### Two Agents (No Research Agent)

Merge research into tenant-agent. Rejected because research involves long-running web scraping (up to 90s) that would block tenant-agent's responsiveness, and research has no tenant data access requirements.

## References

- `server/src/agent-v2/deploy/SERVICE_REGISTRY.md` — Live service registry
- `server/src/agent-v2/deploy/customer/` — Customer agent implementation
- `server/src/agent-v2/deploy/tenant/` — Tenant agent implementation
- `docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md` — Migration plan
- Archived agents: `booking-agent`, `project-hub-agent`, `storefront-agent`, `marketing-agent`, `concierge-agent` (available in git history)
