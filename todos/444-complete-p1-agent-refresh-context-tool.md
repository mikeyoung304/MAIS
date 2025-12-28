---
status: complete
priority: p1
issue_id: '444'
tags: [agent, tools, context, architecture]
dependencies: []
completed_at: '2025-12-28'
---

# Add refresh_context Tool for Long Sessions

## Problem Statement

Context only injected once at session start. Long sessions (24-hour window) operate on stale data. When users make changes via UI mid-session, the agent doesn't see them.

## Severity: P1 - CRITICAL

Users will experience stale data in conversations, leading to confusion and incorrect agent responses.

## Solution Implemented

Added `refresh_context` tool to `server/src/agent/tools/read-tools.ts`:

```typescript
export const refreshContextTool: AgentTool = {
  name: 'refresh_context',
  description: 'Refresh business context data that may have become stale during a long session...',
  inputSchema: { type: 'object', properties: {}, required: [] },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    // Fetches fresh data directly from Prisma
    // Returns: stripeConnected, packageCount, upcomingBookings, revenueThisMonth
  },
};
```

Updated system prompt in `server/src/agent/orchestrator/orchestrator.ts`:

```
### Refreshing Context in Long Sessions

Your initial business context is loaded once at session start.
For long-running sessions, data may become stale. Use **refresh_context** when:
- The user mentions recent changes
- You're about to give advice based on package count or revenue
- The session has been active for several exchanges without fresh data
```

## Files Changed

- `server/src/agent/tools/read-tools.ts` - Added refreshContextTool
- `server/src/agent/orchestrator/orchestrator.ts` - Added system prompt guidance

## Acceptance Criteria

- [x] `refresh_context` tool created and exported
- [x] Tool returns current stripeConnected, packageCount, upcomingBookings, revenueThisMonth
- [x] System prompt updated to mention when to use it
- [x] TypeScript compiles without errors

## Notes

Source: Agent-Native Architecture Analysis on 2025-12-28
Completed: 2025-12-28
