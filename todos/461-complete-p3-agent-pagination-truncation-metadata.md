---
status: complete
priority: p3
issue_id: '461'
tags: [code-review, ux, agent, api-design]
dependencies: []
completed_at: '2025-12-29'
---

# Agent List Tools Should Return Truncation Metadata

## Problem Statement

The pagination limits (take: 25-100) are appropriate, but the agent has no way to know if results were truncated. Adding a `hasMore` flag would help the agent request more data if needed.

## Severity: P3 - NICE-TO-HAVE

Enhancement for agent UX. Current limits work for most tenants.

## Solution Implemented

Added `meta` object to all list tool responses with truncation metadata.

### Tools Updated (7 total)

1. **get_packages** - limit: 50
2. **get_bookings** - limit: 50 (dynamic, user-configurable up to 50)
3. **get_blackouts** - limit: 100
4. **get_addons** - limit: 50
5. **get_customers** - limit: 50 (dynamic, user-configurable up to 50)
6. **get_segments** - limit: 25
7. **get_blackout_dates** - limit: 100

### Response Shape

All list tools now return:

```typescript
return {
  success: true,
  data: items.map(formatItem),
  meta: {
    returned: items.length,
    limit: 50,
    hasMore: items.length === limit,
  },
};
```

### Single-Item Lookups

Tools that return single items (when `id` parameter is provided) do NOT include meta object - only list responses have pagination metadata.

## Technical Details

- **Affected Files**: `server/src/agent/tools/read-tools.ts`
- **Database Changes**: No
- **Breaking Changes**: None (additive change - `meta` field is optional)

## Acceptance Criteria

- [x] List tools return `meta.hasMore` flag
- [ ] Agent system prompt updated to understand pagination (optional, agent can infer from meta)
- [x] TypeScript types compatible (AgentToolResult allows additional fields)

## Resources

- Source: Performance Oracle Code Review (2025-12-28)
- Resolution: 2025-12-29
