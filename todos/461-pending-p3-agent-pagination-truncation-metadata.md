---
status: pending
priority: p3
issue_id: '461'
tags: [code-review, ux, agent, api-design]
dependencies: []
---

# Agent List Tools Should Return Truncation Metadata

## Problem Statement

The pagination limits (take: 25-100) are appropriate, but the agent has no way to know if results were truncated. Adding a `hasMore` flag would help the agent request more data if needed.

## Severity: P3 - NICE-TO-HAVE

Enhancement for agent UX. Current limits work for most tenants.

## Findings

- **Source**: Performance Oracle
- **Locations**: All list tools in `server/src/agent/tools/read-tools.ts`

Current response shape:

```typescript
return {
  success: true,
  data: packages.map(formatPackage),
};
```

Suggested response shape:

```typescript
return {
  success: true,
  data: packages.map(formatPackage),
  meta: {
    returned: packages.length,
    limit: 50,
    hasMore: packages.length === 50,
  },
};
```

## Proposed Solutions

### Option 1: Add Meta Object to List Responses

- **Pros**: Agent knows when data is truncated, can request more
- **Cons**: Minor breaking change if any consumers rely on exact response shape
- **Effort**: Small (1 hour)
- **Risk**: Low

### Option 2: Cursor-Based Pagination

- **Pros**: Full pagination support
- **Cons**: More complex, may not be needed
- **Effort**: Medium
- **Risk**: Medium

## Technical Details

- **Affected Files**: `server/src/agent/tools/read-tools.ts` (6+ list tools)
- **Database Changes**: No

## Acceptance Criteria

- [ ] List tools return `meta.hasMore` flag
- [ ] Agent system prompt updated to understand pagination
- [ ] TypeScript types updated for new response shape

## Resources

- Source: Performance Oracle Code Review (2025-12-28)
