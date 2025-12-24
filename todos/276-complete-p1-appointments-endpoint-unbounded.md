---
status: ready
priority: p1
issue_id: '276'
tags: [code-review, security, api, dos-prevention, pagination]
dependencies: []
---

# Appointments Endpoint Missing Default Pagination Limit

## Problem Statement

The `/v1/tenant-admin/appointments` endpoint has no default limit, allowing queries that return ALL appointments. This creates a DoS vector and can crash the server with memory exhaustion.

**Why it matters:**

- If `limit` is not provided, query returns all appointments (could be 100k+ records)
- Memory exhaustion on large datasets
- API response timeout
- Database connection held during large result set transfer

## Findings

### Agent: api-design-reviewer

- **Location:** `server/src/routes/tenant-admin-scheduling.routes.ts:598`
- **Evidence:**

```typescript
router.get('/appointments', async (req, res) => {
  const appointments = await bookingRepo.findAppointments(tenantId, {
    status, serviceId, startDate, endDate,
    limit: parsedLimit,  // No default - could return ALL appointments
    offset: parsedOffset
  });
```

- **Severity:** HIGH - DoS risk, memory exhaustion

## Proposed Solutions

### Option A: Add Default Limit with Maximum Cap (Recommended)

**Description:** Enforce pagination defaults at route and contract level

```typescript
// In tenant-admin-scheduling.routes.ts
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

const limit = parsedLimit ? Math.min(parsedLimit, MAX_LIMIT) : DEFAULT_LIMIT;

// In contracts/dto.ts
query: z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  // ...existing params
});
```

**Pros:**

- Prevents unbounded queries
- Backwards compatible (adds defaults, doesn't break existing clients)
- MAX_LIMIT prevents abuse even with explicit limit

**Cons:**

- Clients expecting full results need to paginate

**Effort:** Small (30 minutes)
**Risk:** Low

### Option B: Cursor-Based Pagination

**Description:** Replace offset pagination with cursor-based for large datasets

**Effort:** Large (4-8 hours)
**Risk:** Medium (API breaking change)

## Recommended Action

Implement Option A immediately. Consider Option B for future scalability.

## Technical Details

**Affected Files:**

- `server/src/routes/tenant-admin-scheduling.routes.ts`
- `packages/contracts/src/dto.ts`
- `server/src/adapters/prisma/booking.repository.ts`

**Response Enhancement:**

```typescript
// Add pagination metadata to response
{
  data: [...appointments],
  pagination: {
    total: 1523,
    limit: 50,
    offset: 0,
    hasMore: true
  }
}
```

## Acceptance Criteria

- [ ] Default limit of 50 applied when not specified
- [ ] Maximum limit of 500 enforced even when higher value requested
- [ ] Contract schema updated with default values
- [ ] Response includes pagination metadata
- [ ] Unit test for pagination defaults
- [ ] Load test with large dataset doesn't crash

## Work Log

| Date       | Action                  | Learnings                     |
| ---------- | ----------------------- | ----------------------------- |
| 2025-12-05 | Created from API review | DoS vector in admin endpoints |

## Resources

- Related: `server/src/routes/tenant-admin-scheduling.routes.ts`
- Related: `packages/contracts/src/dto.ts`
