---
status: complete
priority: p1
issue_id: '451'
tags: [performance, agent, code-review, database]
dependencies: []
---

# Agent Tools Have Unbounded Queries

## Problem Statement

Several agent read tools fetch data without pagination limits. A tenant with large datasets could cause:

- Slow response times
- Excessive memory usage
- Token bloat when returned to LLM context
- Potential timeouts

## Severity: P1 - CRITICAL

Unbounded queries can cause performance degradation and potential service disruption.

## Findings

- **Location**: `server/src/agent/tools/read-tools.ts`

Unbounded tools identified:

1. **`get_blackouts`** (line 515-528) - No `take` limit
2. **`get_blackout_dates`** (line 1313-1326) - No `take` limit
3. **`get_packages`** (line 233-239) - No `take` limit
4. **`get_addons`** (line 684-691) - No `take` limit
5. **`get_segments`** (line 981-985) - No `take` limit

Comparison with properly bounded tools:

- `get_bookings` - Has `take: Math.min(limit, 50)`
- `get_customers` - Has `take: limit` with default 20

## Problem Scenario

1. Tenant blocks weekends for 5 years (~520 blackout dates)
2. User asks "when am I available?"
3. Agent calls `get_blackouts`
4. All 520+ records fetched into memory
5. Response slow, Claude context bloated with unnecessary data

## Proposed Solutions

### Option 1: Add Pagination to All Tools (Recommended)

- **Pros**: Consistent pattern, prevents all unbounded queries
- **Cons**: May need to add `offset` parameter for some use cases
- **Effort**: Small (1-2 hours)
- **Risk**: Low

```typescript
// Add to each unbounded tool
const blackouts = await prisma.blackoutDate.findMany({
  where: { tenantId },
  orderBy: { date: 'asc' },
  take: Math.min(limit, 100), // Add this
});
```

### Option 2: Streaming/Chunked Response

- **Pros**: Can handle very large datasets
- **Cons**: Complex, overkill for agent use case
- **Effort**: Large
- **Risk**: Medium

## Recommended Action

[To be filled during triage]

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/read-tools.ts` - Add `take` limits to 5 tools
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] `get_blackouts` has `take: 100` limit
- [ ] `get_blackout_dates` has `take: 100` limit
- [ ] `get_packages` has `take: 50` limit
- [ ] `get_addons` has `take: 50` limit
- [ ] `get_segments` has `take: 25` limit
- [ ] All limits documented in tool descriptions

## Work Log

### 2025-12-28 - Identified during Code Review

**By:** Performance Review Agent
**Actions:** Identified 5 unbounded queries through code analysis

## Resources

- Source: Code Review - Performance Review Agent (2025-12-28)
- Pattern: `get_bookings` tool for proper pagination

## Notes

Source: Code Review on 2025-12-28
Estimated Effort: Small (1-2 hours)
