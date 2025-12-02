---
status: pending
priority: p3
issue_id: "164"
tags: [code-review, security, mvp-gaps, audit]
dependencies: []
---

# Audit Logging for Public Booking Actions

## Problem Statement

No audit trail for customer actions on public routes.

**Why This Matters:**
- Can't investigate disputes
- No visibility into customer behavior
- Compliance requirements

## Proposed Actions to Log

- Reschedule requests (with old/new dates)
- Cancellation attempts
- Balance payment sessions created
- Failed token validations (security)

## Proposed Solutions

```typescript
await auditService.log({
  tenantId,
  action: 'booking.reschedule',
  bookingId,
  metadata: { oldDate, newDate, ipAddress }
});
```

## Acceptance Criteria

- [ ] Audit service created or extended
- [ ] All public booking actions logged
- [ ] IP address captured
- [ ] Queryable audit trail
