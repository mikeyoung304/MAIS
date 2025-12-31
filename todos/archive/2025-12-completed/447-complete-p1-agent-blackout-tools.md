---
status: complete
priority: p1
issue_id: '447'
tags: [agent, tools, scheduling, action-parity]
dependencies: []
---

# Add Blackout Date Tools for Agent (Action Parity)

## Problem Statement

Scheduling is core to booking flow. Users will say "block off next Tuesday" or "I'm on vacation Dec 20-25" - agent can't help.

## Severity: P1 - CRITICAL

Core scheduling functionality with no agent capability. High-frequency user request.

## Findings

- Location: `server/src/agent/tools/` (new tools needed)
- Blackout dates exist in database: `BlackoutDate` model
- UI manages at /tenant/scheduling
- No agent tools for blackout CRUD

## Problem Scenario

1. User: "Block off December 24-26, I'm visiting family"
2. Agent: "I can't manage your calendar availability"
3. User has to manually go to scheduling page

## Proposed Solution

Add three tools:

### 1. get_blackout_dates (Read)

```typescript
export const getBlackoutDatesTool: AgentTool = {
  name: 'get_blackout_dates',
  description: 'Get list of blocked dates when you are unavailable for bookings',
  // Returns list of blackout dates with reasons
};
```

### 2. add_blackout_date (Write - T1)

```typescript
export const addBlackoutDateTool: AgentTool = {
  name: 'add_blackout_date',
  description: 'Block off a date or date range when you are unavailable',
  inputSchema: {
    properties: {
      startDate: { type: 'string', description: 'Start date (ISO format)' },
      endDate: { type: 'string', description: 'End date (ISO format, optional for single day)' },
      reason: { type: 'string', description: 'Reason for blocking (e.g., "vacation", "personal")' },
    },
  },
  // T1 trust tier - auto-confirm (low risk)
};
```

### 3. remove_blackout_date (Write - T2)

```typescript
export const removeBlackoutDateTool: AgentTool = {
  name: 'remove_blackout_date',
  description: 'Remove a blocked date to make it available again',
  inputSchema: {
    properties: {
      blackoutId: { type: 'string', description: 'ID of the blackout to remove' },
    },
  },
  // T2 trust tier - soft confirm (opens up availability)
};
```

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/read-tools.ts` - Add get_blackout_dates
  - `server/src/agent/tools/write-tools.ts` - Add add/remove_blackout_date
  - `server/src/agent/tools/all-tools.ts` - Export all
  - `server/src/agent/executors/index.ts` - Add executors for write tools
- **Related Components**: BlackoutDate model, scheduling service
- **Database Changes**: No (uses existing model)

## Acceptance Criteria

- [ ] `get_blackout_dates` returns list with dates and reasons
- [ ] `add_blackout_date` creates blackout (T1 - auto-confirm)
- [ ] `remove_blackout_date` removes blackout (T2 - soft-confirm)
- [ ] Handles date ranges (multi-day blocks)
- [ ] System prompt documents capabilities
- [ ] Tests pass

## Notes

Source: Agent-Native Architecture Analysis on 2025-12-28
Estimated Effort: Medium (2-3 hours)
