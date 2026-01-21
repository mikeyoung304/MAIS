---
status: ready
priority: p2
issue_id: '5221'
tags: [observability, agent-v2, project-hub, code-review, logging]
dependencies: []
---

# Project Hub: Missing Structured Logger

## Problem Statement

All other deployed agents (booking, concierge, storefront, research, marketing) have a standardized structured logger that outputs JSON for Cloud Logging. Project Hub lacks this logger entirely, making production debugging inconsistent with other agents.

**Impact:** Difficult to trace issues in production, inconsistent log format across agent fleet.

## Findings

### Agent-Native Reviewer

- Concierge has logger (lines 29-42)
- Project Hub has no logging infrastructure

### Simplicity Reviewer

- This is explicitly documented as intentional duplication
- All agents should have the same logger pattern

## Proposed Solutions

### Option A: Add Standard Logger (Recommended)

Copy the logger from other agents:

```typescript
const logger = {
  info: (data: Record<string, unknown>, msg: string) =>
    console.log(
      JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })
    ),
  warn: (data: Record<string, unknown>, msg: string) =>
    console.warn(
      JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() })
    ),
  error: (data: Record<string, unknown>, msg: string) =>
    console.error(
      JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() })
    ),
};
```

Then add logging to:

- Tool execution entry/exit
- Tenant ID extraction attempts
- API call failures
- Context switching

**Pros:** Consistent with other agents, better debugging
**Cons:** Intentional code duplication
**Effort:** Small (1 hour)
**Risk:** Very low

## Recommended Action

**Option A** - Add the standard logger.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`

**Logging Points to Add:**

- `getContextFromSession()` - log extracted context
- Each tool's execute function - log entry with params
- API calls - log failures with details
- Error handlers - structured error logging

## Acceptance Criteria

- [ ] Logger added matching other agent patterns
- [ ] Key operations logged (tool calls, API calls, errors)
- [ ] Logs include tenantId/projectId for correlation
- [ ] JSON format for Cloud Logging compatibility

## Work Log

| Date       | Action                               | Result                    |
| ---------- | ------------------------------------ | ------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by 2 reviewers |

## Resources

- [Concierge Logger Reference](server/src/agent-v2/deploy/concierge/src/agent.ts:29-42)
