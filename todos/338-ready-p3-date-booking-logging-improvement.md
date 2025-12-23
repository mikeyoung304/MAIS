# P3: Missing Logging Context for DATE Booking

## Priority: P3 Nice-to-have
## Status: ready
## Feature: DATE Booking Flow
## Category: Data Integrity / Observability

## Issue

Logging happens after successful checkout creation but doesn't include important context.

**File:** `server/src/routes/public-date-booking.routes.ts:107-116`

## Current State

```typescript
logger.info(
  {
    tenantId,
    packageId: pkg.id,
    packageSlug: pkg.slug,
    date: input.date,
    customerEmail: input.customerEmail,
  },
  'Date booking checkout session created'
);
```

## Missing Context

- User IP address
- User agent (for fraud detection)
- Request ID (for correlation)
- Add-on details (for analytics)

## Recommendation

```typescript
logger.info(
  {
    tenantId,
    packageId: pkg.id,
    packageSlug: pkg.slug,
    date: input.date,
    customerEmail: input.customerEmail,
    addOnIds: input.addOnIds,
    addOnCount: input.addOnIds?.length || 0,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id, // If using request ID middleware
  },
  'Date booking checkout session created'
);
```

## Note

Be careful not to log PII beyond what's necessary for debugging.



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Data Integrity Review Finding P3-001 (Missing logging)
