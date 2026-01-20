---
status: pending
priority: p2
issue_id: '5214'
tags: [code-review, session-bootstrap, agent-native, concierge, active-memory]
dependencies: ['5204']
---

# No Tool to Retrieve Current Known Facts Mid-Conversation

## Problem Statement

The agent can store facts with `store_discovery_fact` but cannot retrieve the current set of known facts without calling `bootstrap_session` again. This limits the agent's ability to reason about what it knows.

**Why it matters:** Agent-native principle: "Active memory requires read access, not just write access."

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

**Available Tools:**

- `bootstrap_session` - Returns facts but triggers full re-bootstrap
- `store_discovery_fact` - Write-only, no read capability

**Missing:** `get_known_facts` - Lightweight read-only tool

**Reviewer:** Agent-Native Architecture Review (P2-004)

## Proposed Solutions

### Option A: Add get_known_facts Tool (Recommended)

**Pros:** Enables mid-conversation fact checking, lightweight
**Cons:** Additional API endpoint needed
**Effort:** Small
**Risk:** Low

```typescript
const getKnownFactsTool = new FunctionTool({
  name: 'get_known_facts',
  description:
    'Get the current list of known facts about the business. Use this to check what you already know before asking questions.',
  parameters: z.object({}),
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    // Call backend to get current discoveryFacts
    const result = await callMaisApi('/get-discovery-facts', tenantId);
    return result.data;
  },
});
```

### Option B: Make bootstrap_session Cheaper

**Pros:** No new tool, reuses existing
**Cons:** Still heavier than a dedicated read tool
**Effort:** Medium
**Risk:** Low

Add `factsOnly: true` parameter to bootstrap_session.

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`
- `server/src/routes/internal-agent.routes.ts`

**New Endpoint Needed:**

- `POST /get-discovery-facts` - Returns only discoveryFacts for tenant

## Acceptance Criteria

- [ ] Agent can retrieve known facts without full re-bootstrap
- [ ] Tool returns list of stored fact keys and values
- [ ] Lightweight response (<100ms)

## Work Log

| Date       | Action                         | Learnings                            |
| ---------- | ------------------------------ | ------------------------------------ |
| 2026-01-20 | Created from /workflows:review | Agent-Native reviewer noted read gap |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Agent-Native Architecture Review
- Principle: "Active memory requires read access, not just write access"
