---
status: pending
priority: p1
issue_id: '757'
tags: [agent-v2, reliability, trust, enterprise-ai]
dependencies: ['756']
---

# Agent Claims Success Without Verifying Changes Were Applied

## Problem Statement

The Concierge agent responds "Done. Your changes are now live" without verifying that the Storefront specialist actually saved the changes. This creates a trust gap where users believe their content is saved when it isn't.

**Evidence:** During E2E testing on production (gethandled.ai):

- User: "mine is perfect, just ship it"
- Agent: "Done. Your changes are now live."
- Actual result: Preview still shows placeholder content
- User's About section text was NOT saved

## Findings

### Expected Behavior

1. Agent calls Storefront specialist
2. Storefront confirms write success with `{ success: true, savedContent: {...} }`
3. Agent verifies response before claiming success
4. Agent says "Done" only when verified

### Observed Behavior

1. Agent called Marketing instead of Storefront (see #756)
2. Agent said "Done" without tool call returning success confirmation
3. No verification of actual state change

### Root Cause

1. **Delegation Without Verification**: Agent assumes success after delegation
2. **Tool Response Not Checked**: Agent doesn't parse specialist response
3. **Missing Pitfall #52**: "Tool confirmation-only response" - tools must return updated state

### Location

- Concierge agent: `server/src/agent-v2/deploy/concierge/src/agent.ts`
- Storefront update_section tool: `server/src/agent-v2/deploy/storefront/src/agent.ts`

## Proposed Solutions

### Option 1: Enforce Response Verification (Recommended)

Add explicit response checking in Concierge after delegation:

```typescript
const result = await delegate();
if (!result.success || !result.savedContent) {
  return "That didn't work. Let me try again...";
}
return `Done. Updated: ${result.savedContent.headline}`;
```

- **Pros**: Guarantees accuracy, builds trust
- **Cons**: Requires specialist response format changes
- **Effort**: Medium (4 hours)
- **Risk**: Low

### Option 2: Post-Action Read Verification

After any write, call `get_section_content` to verify:

```
1. Call update_section
2. Call get_section_content
3. Compare expected vs actual
4. Report actual state to user
```

- **Pros**: Definitive verification
- **Cons**: Extra latency, redundant calls
- **Effort**: Small (2 hours)
- **Risk**: Low

### Option 3: Add System Prompt Guard

Add to system prompt: "NEVER say 'Done' until tool returns explicit success with saved content"

- **Pros**: Quick fix
- **Cons**: LLM may ignore, not deterministic
- **Effort**: Small (30 minutes)
- **Risk**: Medium (unreliable)

## Recommended Action

**Option 1 + Option 3** - Add response verification AND prompt guard for defense in depth.

## Technical Details

- **Affected Files**:
  - `server/src/agent-v2/deploy/concierge/src/agent.ts` (delegation handlers)
  - `server/src/agent-v2/deploy/storefront/src/agent.ts` (response format)
- **Related Components**: All specialist agents
- **Database Changes**: No

## Acceptance Criteria

- [ ] Agent only says "Done" when tool returns `{ success: true, savedContent }`
- [ ] Failed saves result in clear error message and retry offer
- [ ] E2E test validates agent response matches actual state
- [ ] No false positives (saying "failed" when it actually saved)

## Work Log

### 2026-01-27 - Issue Identified

**By:** Claude Code Review
**Actions:**

- Discovered during production E2E snap observation
- Agent claimed "Done. Your changes are now live" but preview showed placeholder
- Identified as trust/reliability P1 issue

**Learnings:**

- "Done" must mean actually done, not "I called a tool"
- Pitfall #52 applies: tools must return state, not just success boolean

## Resources

- Pitfall #52: `CLAUDE.md` - Tool confirmation-only response
- Agent tool patterns: `docs/solutions/patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md`
- E2E test screenshots: `.playwright-mcp/admin-dashboard.png`

## Notes

Source: `/workflows:review` session on 2026-01-27
Priority: P1 because destroys user trust - users believe content saved when it wasn't
