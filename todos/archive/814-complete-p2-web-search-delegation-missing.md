---
status: pending
priority: p2
issue_id: 814
tags: [code-review, agent, architecture, feature-gap, a2a]
dependencies: []
---

# Web Search Delegation Missing from Tenant-Agent

## Problem Statement

The tenant-agent cannot perform web searches or market research. When a photographer asks "Search the web for wedding photography pricing in San Diego," the agent must decline - even though the research-agent has these capabilities.

**Why it matters:**

- Competitive research is a natural part of setting up packages
- User expects AI assistant to help with market positioning
- Research-agent has the tools but tenant-agent can't delegate to it
- Creates disjointed experience (user must use separate interface)

## Findings

**From Architecture Agent:**

> The Phase 4 consolidation assumed research was a specialized, infrequent task. In practice, tenants want pricing research integrated into their workflow (e.g., "Help me price my packages - what do competitors charge?").

**Research-agent tools (already exist):**

- `search_competitors` - Google Search grounding
- `scrape_competitor` - Web scraping with prompt injection filtering
- `analyze_market` - Market data synthesis
- `get_pricing_recommendation` - Statistical pricing advice

**From Security Agent:**

> **Session isolation is critical.** Each specialist agent needs its OWN session; orchestrator session cannot be passed to specialists. Research-agent results must be cached with tenant-scoped keys: `tenant:${tenantId}:search:${query}`.

**Current agent response:**

> "I am sorry, I cannot directly access the internet to search for pricing information. However, I can suggest you check out competitor websites in San Diego..."

## Proposed Solutions

### Option A: Agent-to-Agent Delegation Tool (Recommended)

**Pros:**

- Preserves security isolation (research has prompt injection filtering)
- No tool duplication
- Research-agent continues to handle specialized tasks

**Cons:**

- Adds latency (30-60s for research tasks)
- Requires A2A protocol implementation

**Effort:** Medium-Large (4-6 hours)
**Risk:** Medium (A2A complexity)

**Implementation:**

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/research-delegation.ts
export const delegateToResearchTool = new FunctionTool({
  name: 'delegate_to_research',
  description:
    'Delegate market research tasks to the research specialist. Use for competitor analysis, pricing research, and market positioning.',
  parameters: z.object({
    task: z.enum(['competitor_search', 'pricing_analysis', 'market_overview']),
    location: z.string().describe('Geographic area (e.g., "San Diego, CA")'),
    industry: z.string().describe('Business type (e.g., "wedding photography")'),
    specificQuery: z.string().optional().describe('Specific research question'),
  }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) return { success: false, error: 'No tenant context' };

    // CRITICAL: Create fresh session - don't pass tenant-agent's sessionId (pitfall #40)
    const researchAgentUrl = process.env.RESEARCH_AGENT_URL;
    const response = await fetch(`${researchAgentUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // NO sessionId - let ADK create fresh session
        state: { tenantId, contextType: 'web_search' },
        message: `Research ${params.task}: ${params.specificQuery || params.industry} in ${params.location}`,
      }),
    });

    return await response.json();
  },
});
```

### Option B: Copy Research Tools to Tenant-Agent

**Pros:**

- Simpler implementation
- No A2A complexity
- Lower latency

**Cons:**

- Tool duplication
- Duplicates prompt injection defense code
- Harder to maintain

**Effort:** Medium (3-4 hours)
**Risk:** Medium (maintenance burden)

### Option C: Shared Research Module (Future)

**Pros:**

- Clean architecture
- Single source of truth

**Cons:**

- Requires refactoring
- Higher upfront effort

**Effort:** Large (8+ hours)
**Risk:** Low

## Recommended Action

Implement Option A (delegation) because:

1. Research-agent already has battle-tested web scraping with prompt injection filtering
2. Preserves security isolation (scraped content can contain malicious prompts)
3. Follows pitfall #40: Session ID reuse across agents
4. Can add rate limiting per tenant for research requests

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/tools/research-delegation.ts` (NEW)
- `server/src/agent-v2/deploy/tenant/src/tools/index.ts` (ADD EXPORT)
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (ADD capability)

**Security requirements (from Security Agent):**

1. **Fresh session for each research request** - Don't pass tenant-agent's sessionId
2. **Tenant-scoped cache keys** - `tenant:${tenantId}:search:${query}:${timestamp}`
3. **TTL on cached results** - 1 hour max
4. **Audit logging** - Log when tenant-agent delegates to research-agent
5. **Error handling** - If research-agent returns results for wrong tenantId, reject

**Environment variables needed:**

```bash
RESEARCH_AGENT_URL=https://research-agent-506923455711.us-central1.run.app
```

## Acceptance Criteria

- [ ] `delegate_to_research` tool exists in tenant-agent
- [ ] Tool creates fresh ADK session for research (no session reuse)
- [ ] TenantId is passed via state, extracted by research-agent
- [ ] Results are cached with tenant-scoped keys
- [ ] System prompt mentions research capability
- [ ] E2E: "Search for wedding photographers in San Diego" → returns market data

## Work Log

| Date       | Action                              | Learnings                                         |
| ---------- | ----------------------------------- | ------------------------------------------------- |
| 2026-02-01 | E2E testing revealed capability gap | Research features isolated in research-agent      |
| 2026-02-01 | Security agent analysis             | A2A delegation requires careful session isolation |

## Resources

- [Failure Report](docs/reports/2026-02-01-agent-testing-failure-report.md) - Failure #2
- [CLAUDE.md Pitfall #40](CLAUDE.md) - Session ID reuse across agents
- [A2A_SESSION_STATE_PREVENTION.md](docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md)
- [Research Agent](server/src/agent-v2/deploy/research/src/agent.ts)
