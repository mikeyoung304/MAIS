---
status: pending
priority: p1
issue_id: "172"
tags: [code-review, security, information-disclosure, public-routes]
dependencies: []
---

# Tenant ID Disclosure in Public Route Error Messages

## Problem Statement

Internal tenant IDs are exposed in public route error responses when a tenant is not found. This enables enumeration attacks and violates information disclosure best practices.

**Why it matters:**
- Attackers can probe for valid tenant IDs
- Internal identifiers should never be exposed publicly
- OWASP A01:2021 - Broken Access Control

## Findings

**Source:** Security Sentinel agent code review

**Files Affected:**
- `server/src/services/booking.service.ts` (lines ~116, ~241)
- `server/src/lib/public-route-error-handler.ts` (lines 129-135)

**Current code (booking.service.ts):**
```typescript
throw new NotFoundError(`Tenant ${tenantId} not found`);
```

**Error handler passes message unfiltered:**
```typescript
if (error instanceof NotFoundError) {
  return res.status(404).json({
    error: 'NOT_FOUND',
    message: error.message,  // EXPOSES TENANT ID
  });
}
```

**Attack scenario:**
1. Attacker sends request to public balance payment route
2. Token validates but references non-existent tenant
3. Error response: `{"error": "NOT_FOUND", "message": "Tenant cus_abc123xyz not found"}`
4. Attacker learns internal tenant ID format

## Proposed Solutions

### Option A: Generic Message in Error Handler (Recommended)
**Pros:** Quick fix, single location
**Cons:** Less specific for debugging
**Effort:** Small (15 minutes)
**Risk:** Low

```typescript
// In public-route-error-handler.ts
if (error instanceof NotFoundError) {
  return res.status(404).json({
    status: 'error',
    statusCode: 404,
    error: 'NOT_FOUND',
    message: 'The requested resource was not found',
  });
}
```

### Option B: Sanitize at Service Layer
**Pros:** Comprehensive fix
**Cons:** More changes required
**Effort:** Medium (30 minutes)
**Risk:** Low

```typescript
// In booking.service.ts
if (!tenant) {
  logger.warn({ tenantId }, 'Tenant not found in checkout flow');
  throw new NotFoundError('The requested resource was not found');
}
```

### Option C: Context-Aware Error Handler
**Pros:** Best practice, detailed for authenticated routes
**Cons:** More complex
**Effort:** Large (1 hour)
**Risk:** Low

## Recommended Action

Implement Option A immediately as hotfix, then Option C for comprehensive solution.

## Technical Details

**Affected Routes:**
- `public-balance-payment.routes.ts` (line 88)
- `public-booking-management.routes.ts` (lines 196, 241, 277)

## Acceptance Criteria

- [ ] NotFoundError in public routes returns generic message
- [ ] No tenant IDs exposed in any public error response
- [ ] Add test to verify generic error messages
- [ ] TypeScript passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From security review of commit d9ceb40 |

## Resources

- OWASP A01:2021: https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- Commit: d9ceb40
