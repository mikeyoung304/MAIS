---
status: complete
priority: p3
issue_id: 627
tags: [code-review, booking-links, phase-1, incomplete-feature]
dependencies: []
created: 2026-01-05
---

# Working Hours Executor Accepts But Ignores Timezone Parameter

## Problem Statement

The `manage_working_hours` executor accepts a `timezone` parameter in its payload but never actually updates the Tenant.timezone field. This creates a confusing API where tenants may think they're updating their timezone when calling manage_working_hours, but nothing happens.

## Findings

**Source:** security-sentinel

**Evidence:**

- `server/src/agent/executors/booking-link-executors.ts:351-352` - Comment says "Update tenant timezone if provided" but no actual update code exists
- The payload accepts `timezone?: string` (from ManageWorkingHoursInputSchema)
- The timezone value is included in the return result but never persisted

```typescript
// Line 351-352 in executor
// Update tenant timezone if provided
// Note: Tenant model may need a timezone field (Phase 1 migration)
```

The comment is now outdated - Tenant.timezone field EXISTS (added in Phase 1) but the update code was never added.

## Proposed Solutions

### Option 1: Implement the timezone update

**Pros:** Feature works as expected, schema is ready
**Cons:** Adds transaction complexity
**Effort:** Small
**Risk:** Very low

```typescript
// Inside the transaction
if (timezone) {
  await tx.tenant.update({
    where: { id: tenantId },
    data: { timezone },
  });
}
```

### Option 2: Remove timezone from input schema

**Pros:** YAGNI, no confusion
**Cons:** Loses the capability
**Effort:** Small
**Risk:** Low

## Recommended Action

**Option 1** - Implement the update. The schema is ready, it's just a small code addition.

## Technical Details

**Affected Files:**

- `server/src/agent/executors/booking-link-executors.ts` (line 351)

## Acceptance Criteria

- [ ] Tenant.timezone updated when timezone provided in manage_working_hours
- [ ] Returns updated timezone in response
- [ ] Unit test for timezone update

## Work Log

| Date       | Action                             | Learnings                   |
| ---------- | ---------------------------------- | --------------------------- |
| 2026-01-05 | Created during Phase 1 code review | Outdated TODO comment found |

## Resources

- manage_working_hours executor: `server/src/agent/executors/booking-link-executors.ts:293-339`
