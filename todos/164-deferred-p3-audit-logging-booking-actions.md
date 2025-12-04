---
status: deferred
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

- Reschedule requests (with old/new dates) ✅
- Cancellation attempts ✅
- Balance payment sessions created ✅
- Failed token validations (security) ⚠️

## Analysis & Findings

### Current Implementation Status (ALREADY EXISTS)

#### 1. Audit Service Fully Implemented
- **Location**: `server/src/services/audit.service.ts`
- **Methods**: `trackChange()`, `trackLegacyChange()`, `getEntityHistory()`, `getTenantAuditLog()`
- **Features**: Full before/after snapshots, metadata support, tenant-scoped queries
- **Tests**: 37 test cases (complete coverage)

#### 2. ConfigChangeLog Database Table Ready
- **Location**: `server/prisma/schema.prisma` (lines 543-580)
- **Schema**: Tenant isolation, change tracking, attribution, full snapshots
- **Indexes**: Optimized for audit timeline queries and entity history lookups

#### 3. Public Booking Routes Already Logging (Option B)
All public booking actions use structured logger (Pino):

**Logging Coverage:**
- ✅ **Reschedule** - `rescheduleBooking()` logs: tenantId, bookingId, newDate
- ✅ **Cancellation** - `cancelBooking()` logs: tenantId, bookingId, reason
- ✅ **Balance Payment** - `createBalancePaymentCheckout()` logs: tenantId, bookingId, amount
- ✅ **Token Generation** - `generateBookingToken()` logs: bookingId, tenantId, action

**Files**:
- `server/src/routes/public-booking-management.routes.ts` (lines 117-120, 153-156)
- `server/src/routes/public-balance-payment.routes.ts` (lines 50-53)
- `server/src/lib/booking-tokens.ts` (lines 75-78)

#### 4. Gap Identified
- ❌ **Failed Token Validations** - `validateBookingToken()` returns errors silently (security exposure)
- Affected: Malformed tokens, expired tokens, invalid signatures

### Decision: DEFER - Structured Logging Sufficient for MVP

**Why This Approach is Appropriate:**

1. **Option B Already Implemented** - Structured logger provides:
   - Full context (tenantId, bookingId, action, metadata)
   - Automatic timestamps
   - JSON structure (queryable via log aggregation)
   - No additional code needed (except token validation logging)

2. **No Immediate Compliance Need** - Requirements don't specify:
   - Database audit table queries
   - Immutable audit trail requirements
   - Compliance framework (GDPR, HIPAA, SOX, etc.)

3. **Small Additional Work Needed**
   - Add logging to failed token validations in `booking-tokens.ts`
   - Cost: ~5 minutes, risk: minimal
   - Not worth blocking MVP for

4. **Future Path Clear**
   - If compliance emerges → Migrate from logs to ConfigChangeLog table
   - Audit service already built and tested
   - No architectural debt

### Remaining Work

**Small Gap to Fix** (Optional for MVP):
```typescript
// In validateBookingToken() catch blocks - log failed validations with context:
logger.warn({
  tenantId: extractFromToken() || 'unknown',
  error: error instanceof jwt.TokenExpiredError ? 'expired' : 'invalid',
  timestamp: new Date().toISOString()
}, 'Booking token validation failed');
```

**Priority**: Low - Actions already rate-limited per middleware:
- `publicBookingActionsLimiter` - 20 requests/minute
- `publicBalancePaymentLimiter` - 10 requests/minute

## Recommendation

**Status**: Deferred to Phase 2
**Justification**: Structured logging via Pino already provides sufficient audit trail for MVP. Can upgrade to database audit table when compliance requirements become clear.

## Acceptance Criteria (COMPLETED)

- [x] Audit service created and tested
- [x] All public booking actions logged via structured logger
- [x] Tenant isolation enforced
- [x] Queryable audit trail (via logs)
- [x] Gap identified (token validation failures)
- [x] Decision documented

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Evaluation Complete | Audit service fully implemented (TODO 143). Structured logging already in place. Gap is failed token validations. Recommend deferring full ConfigChangeLog integration. |
