---
status: complete
priority: p1
issue_id: '5216'
tags: [security, agent-v2, project-hub, code-review, context-isolation]
dependencies: []
---

# Project Hub: No Tool-Level Context Enforcement

## Problem Statement

The Project Hub agent exposes ALL 11 tools (5 customer + 6 tenant) to ALL sessions regardless of context type. Tool access control is delegated entirely to the LLM via the system prompt. This creates a critical security vulnerability where a prompt injection attack could trick the LLM into using tenant-only tools from a customer context.

**Impact:** A malicious customer could potentially approve/deny their own requests, send messages as the tenant, or update project status through prompt manipulation.

## Findings

### Security Sentinel

- All tools loaded regardless of context (lines 693-707)
- No programmatic enforcement - purely prompt-based security
- Customer session has access to `approveRequest`, `denyRequest`, `sendMessageToCustomer`, `updateProjectStatus`

### Architecture Strategist

- Dual-faced design conflates two fundamentally different security boundaries
- Tool isolation missing - compare to Concierge which uses separate specialists

### Agent-Native Reviewer

- `getContextFromSession()` function is defined but never called in any tool
- No tool-level validation of `contextType`

## Proposed Solutions

### Option A: Programmatic Tool Gating (Recommended)

Add context validation at the start of each tool's execute function.

```typescript
execute: async (params, ctx) => {
  const { contextType } = getContextFromSession(ctx);
  if (contextType !== 'tenant') {
    return { success: false, error: 'This action requires tenant context' };
  }
  // ... rest of implementation
};
```

**Pros:** Simple, works with current architecture, no deployment changes
**Cons:** Must update all 11 tools, relies on session state being set correctly
**Effort:** Medium (2-3 hours)
**Risk:** Low

### Option B: Split into Two Agents

Create separate CustomerHubAgent and TenantHubAgent, each with only their relevant tools.

**Pros:** Strong security boundary, easier testing, follows Concierge pattern
**Cons:** More deployment complexity (2 Cloud Run services), routing logic needed
**Effort:** Large (1-2 days)
**Risk:** Medium (new deployment architecture)

### Option C: Dynamic Tool Filtering

Use ADK capabilities to filter tools based on session metadata at agent instantiation.

**Pros:** Clean separation, single deployment
**Cons:** May not be supported by ADK, needs investigation
**Effort:** Medium (depends on ADK capabilities)
**Risk:** High (unproven pattern)

## Recommended Action

Start with **Option A** for immediate security fix, then evaluate **Option B** for Phase 2.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`

**Components:**

- All tenant tools: `getPendingRequests`, `getCustomerActivity`, `approveRequest`, `denyRequest`, `sendMessageToCustomer`, `updateProjectStatus`
- All customer tools: `getProjectStatus`, `getPrepChecklist`, `answerPrepQuestion`, `submitRequest`, `getTimeline`

## Acceptance Criteria

- [ ] Each tenant tool validates `contextType === 'tenant'` before executing
- [ ] Each customer tool validates `contextType === 'customer'` before executing
- [ ] Invalid context returns descriptive error message
- [ ] Unit tests verify context enforcement
- [ ] Manual test: customer context cannot call tenant tools

## Work Log

| Date       | Action                                          | Result                                         |
| ---------- | ----------------------------------------------- | ---------------------------------------------- |
| 2026-01-20 | Created from multi-agent code review            | Identified by 3 reviewers                      |
| 2026-01-20 | Implemented Option A - programmatic tool gating | Added `requireContext()` guard to all 11 tools |

## Resources

- [Project Hub Agent](server/src/agent-v2/deploy/project-hub/src/agent.ts)
- [Concierge Agent (reference)](server/src/agent-v2/deploy/concierge/src/agent.ts)
- [ADK Tool Documentation](https://adk.dev/docs/tools)
