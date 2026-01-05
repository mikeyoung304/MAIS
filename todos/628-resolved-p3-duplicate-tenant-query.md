---
status: resolved
priority: p3
issue_id: 628
tags: [code-review, booking-links, phase-1, performance, code-quality]
dependencies: []
created: 2026-01-05
---

# Duplicate Tenant Query in Create Service Executor

## Problem Statement

In the create service executor, there are two separate tenant queries that could be combined into one:
1. Line 261: Fetch timezone for service creation
2. Line 299: Fetch tenant info for URL building

## Findings

**Source:** code-simplicity-reviewer

**Evidence:**
```typescript
// Line 261-265 - Query 1
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { timezone: true },
});
const serviceTimezone = tenant?.timezone ?? 'America/New_York';

// ... later at line 299 - Query 2
const tenantInfo = await getTenantInfo(prisma, tenantId);
```

Both queries hit the Tenant table by primary key lookup for the same tenantId.

**Impact:**
- Minor (both are O(1) PK lookups, < 1ms each)
- Code duplication
- Slightly harder to maintain

## Proposed Solutions

### Option 1: Use getTenantInfo with includeTimezone at the start

**Pros:** Single query, cleaner code
**Cons:** Minor refactor
**Effort:** Small
**Risk:** Very low

```typescript
// At start of create operation
const tenantInfo = await getTenantInfo(prisma, tenantId, { includeTimezone: true });
if (!tenantInfo) {
  throw new ResourceNotFoundError('Tenant', tenantId);
}
const serviceTimezone = tenantInfo.timezone ?? 'America/New_York';

// ... later, reuse same tenantInfo for URL building
const bookingUrl = buildBookingUrl(tenantInfo.slug, slug, tenantInfo.customDomain);
```

### Option 2: Keep as-is (not worth the churn)

**Pros:** No code change
**Cons:** Duplicate query remains
**Effort:** None
**Risk:** None

## Recommended Action

**Option 1** - Small optimization that improves code clarity.

## Technical Details

**Affected Files:**
- `server/src/agent/executors/booking-link-executors.ts` (lines 261-265 and 299)

## Acceptance Criteria

- [ ] Single tenant query in create operation
- [ ] Tests still pass
- [ ] No behavioral change

## Work Log

| Date       | Action                           | Learnings                                    |
| ---------- | -------------------------------- | -------------------------------------------- |
| 2026-01-05 | Created during Phase 1 code review | code-simplicity-reviewer identified |

## Resources

- getTenantInfo utility: `server/src/agent/utils/tenant-info.ts`
