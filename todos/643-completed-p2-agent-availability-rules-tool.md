---
status: complete
priority: p2
issue_id: '643'
tags: [code-review, agent-native, action-parity, tools]
dependencies: []
---

# Missing get_availability_rules Agent Tool

## Problem Statement

The UI can list and manage individual availability rules via `/api/tenant-admin/availability-rules`, but there's no corresponding agent tool to read current availability rules. This creates an action parity gap.

## Findings

**Source:** Agent-Native Reviewer analysis of Legacy-to-Next.js Migration

**UI Capability:**

- List all availability rules
- Create individual rules
- Update individual rules by ID
- Delete individual rules by ID

**Agent Capability:**

- `manage_working_hours` only operates in bulk-replace mode for DEFAULT rules (serviceId = null)
- No `get_availability_rules` read tool exists
- Cannot create rules for a specific service via agent
- Cannot update a single rule by ID via agent

## Proposed Solutions

### Option A: Add get_availability_rules read tool (Recommended)

**Pros:** Full action parity with UI
**Cons:** New tool to maintain
**Effort:** Low
**Risk:** Low

```typescript
// In server/src/agent/tools/read-tools.ts
{
  name: 'get_availability_rules',
  description: 'Get all availability rules for the tenant',
  inputSchema: z.object({
    serviceId: z.string().optional(),
    dayOfWeek: z.number().min(0).max(6).optional(),
  }),
  execute: async (input, context) => {
    const rules = await availabilityService.getRules(context.tenantId, input);
    return { rules };
  },
}
```

### Option B: Enhance manage_working_hours

**Pros:** Single tool for all operations
**Cons:** More complex tool schema
**Effort:** Medium
**Risk:** Medium - breaking change to existing tool

## Recommended Action

Option A - Add a dedicated read tool for availability rules.

## Technical Details

### Files to Modify

- `server/src/agent/tools/read-tools.ts` - Add new tool
- `server/src/agent/tools/all-tools.ts` - Register tool

### Reference Pattern

See `get_blackout_dates` in `read-tools.ts` for similar pattern.

## Acceptance Criteria

- [x] `get_availability_rules` tool exists in read-tools.ts
- [x] Tool supports optional filters (serviceId, dayOfWeek)
- [x] Tool is registered in all-tools.ts (via readTools array export)
- [x] Agent can read current availability rules

## Work Log

| Date       | Action                   | Learnings                                               |
| ---------- | ------------------------ | ------------------------------------------------------- |
| 2026-01-05 | Created from code review | Follow get_blackout_dates pattern                       |
| 2026-01-05 | Completed implementation | Added T1 tool with optional serviceId/dayOfWeek filters |

## Resources

- Pattern: `server/src/agent/tools/read-tools.ts` - `get_blackout_dates`
- UI endpoint: `server/src/routes/tenant-admin-scheduling.routes.ts`
