---
title: Express Route Ordering and Auth Fallback Security Issues
slug: express-route-ordering-auth-fallback-security-MAIS-20260102
category: code-review-patterns
tags: [express, routing, security, multi-tenant, authentication, audit-trail]
severity: P1
resolved: true
date_discovered: 2026-01-02
project: MAIS
component: server/routes
symptoms:
  - Stats endpoint returns 404 "Trace not found" instead of serving data
  - Admin actions attributed to "system" user instead of actual requester
  - Audit trail corruption from missing user attribution
root_cause: Express route ordering (specific routes must precede param routes) and dangerous auth fallback pattern using optional chaining with string default
prevention_tags: [route-ordering, auth-guards, tenant-isolation, audit-trail-integrity]
---

# Express Route Ordering and Auth Fallback Security Issues

This document captures three critical patterns discovered during code review of commit b2cab182 (agent-eval Phase 4-5 remediation).

## Issue 1: Express Route Order Bug

### Problem Description

In Express.js routing, static routes (fixed paths) must be defined **before** parameterized routes (routes with variables like `:traceId`). Express matches routes in registration order.

**File:** `server/src/routes/platform-admin-traces.routes.ts`
**Lines:** 193 (`:traceId`), 360 (`/stats`)

The `/stats` endpoint was defined AFTER `/:traceId`, causing Express to match `/stats` against the pattern `/:traceId`, treating `'stats'` as a trace ID value.

### Why It Matters

- **Silent Failure:** API returns 404 for `/v1/platform/admin/traces/stats`
- **Debugging Difficulty:** Appears to be a missing route rather than matching issue
- **API Contract Violation:** Platform admin dashboards fail silently

### Code Examples

**Before (Broken):**

```typescript
router.get('/:traceId', ...)      // Line 193 - Catches /stats ❌
router.patch('/:traceId/review', ...)
router.post('/:traceId/actions', ...)
router.get('/stats', ...)         // Line 360 - UNREACHABLE
```

**After (Fixed):**

```typescript
router.get('/stats', ...)         // Static route FIRST ✅
router.get('/:traceId', ...)      // Parameterized routes AFTER
router.patch('/:traceId/review', ...)
router.post('/:traceId/actions', ...)
```

### Express Route Matching Algorithm

Express evaluates routes in registration order:

1. Exact string match → `/stats` matches only if path is exactly `/stats`
2. Pattern match → `/:traceId` matches `/anything` because `:traceId` accepts any value

Correct order: Static routes → Parameterized routes → Catch-alls

---

## Issue 2: Auth Fallback to "system" User

### Problem Description

**File:** `server/src/routes/platform-admin-traces.routes.ts`
**Lines:** 238, 287

The code uses an unsafe fallback:

```typescript
const userId = res.locals.user?.id || 'system';
```

If `res.locals.user` is undefined, admin actions get attributed to "system" rather than failing.

### Security Risks

1. **Audit Trail Corruption:** Actions credited to 'system' are indistinguishable from system operations
2. **Authentication Bypass:** Missing middleware silently degrades instead of failing
3. **Compliance Violation:** Review actions with `performedBy: 'system'` indicate no human accountability

### Code Examples

**Before (Unsafe):**

```typescript
const userId = res.locals.user?.id || 'system';
// ❌ Proceeds even if auth failed
```

**After (Secure):**

```typescript
const userId = res.locals.user?.id;
if (!userId) {
  res.status(401).json({ error: 'Authentication required' });
  return;
}
// ✅ Requires valid authenticated user
```

---

## Issue 3: Missing tenantId in Defense Query

### Problem Description

**File:** `server/scripts/run-eval-batch.ts`
**Lines:** 200-205

The query counting flagged traces omits `tenantId`:

```typescript
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    id: { in: traceIds },
    flagged: true,
  },
});
```

Even though `traceIds` are pre-filtered, queries must **always** include explicit `tenantId`.

### Why It Matters

1. **Defense in Depth:** Every query must filter by tenant, regardless of upstream logic
2. **Cascade Prevention:** If upstream filtering changes, this becomes a data leak
3. **Pattern Consistency:** Matches `mais-critical-patterns.md` requirements

### Code Examples

**Before (Missing tenantId):**

```typescript
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    id: { in: traceIds },
    flagged: true,
  },
});
```

**After (With explicit tenantId):**

```typescript
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    tenantId: tenant.id, // ✅ Explicit multi-tenant defense
    id: { in: traceIds },
    flagged: true,
  },
});
```

---

## Prevention Strategies

### 1. Express Route Ordering

**Detection (ESLint Rule Concept):**

```javascript
// Lint: Warn if router.get('/:param') appears before router.get('/static')
```

**Test Case:**

```typescript
it('should reach /stats endpoint', async () => {
  const res = await request(app)
    .get('/v1/platform/admin/traces/stats')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('totalTraces');
});
```

**Code Review Checklist:**

- [ ] Static routes defined before parameterized routes
- [ ] No route shadows another with broader pattern

### 2. Auth Fallback Guards

**Detection (grep pattern):**

```bash
grep -rn "user?.id || " server/src/routes/
grep -rn "userId || 'system'" server/src/
```

**Test Case:**

```typescript
it('should return 401 when auth middleware fails', async () => {
  const res = await request(app)
    .patch('/v1/platform/admin/traces/123/review')
    // No Authorization header
    .send({ reviewStatus: 'reviewed' });

  expect(res.status).toBe(401);
});
```

**Code Review Checklist:**

- [ ] No `|| 'system'` or `|| 'unknown'` fallbacks for user IDs
- [ ] Routes explicitly check `res.locals.user` before proceeding

### 3. Tenant Isolation Defense

**Detection (grep pattern):**

```bash
# Find queries missing tenantId
grep -rn "prisma\.\w*\.(findMany|findFirst|count|update)" server/src/ |
  grep -v "tenantId"
```

**Test Case:**

```typescript
it('should include tenantId in flagged count query', async () => {
  // Create trace for different tenant
  const otherTenantTrace = await createTrace({ tenantId: otherTenant.id });

  // Run batch for our tenant
  const result = await runEvaluationBatch({ tenantId: ourTenant.id });

  // Should not count other tenant's traces
  expect(result.flaggedCount).not.toInclude(otherTenantTrace);
});
```

**Code Review Checklist:**

- [ ] All Prisma queries include `tenantId` in WHERE clause
- [ ] Even with pre-filtered IDs, explicit `tenantId` is present

---

## Quick Reference Checklist

- [ ] Static routes (`/stats`, `/health`) defined before parameterized routes (`/:id`)
- [ ] No auth fallbacks like `userId || 'system'` - require authenticated user
- [ ] All queries include explicit `tenantId` filter (defense in depth)
- [ ] Test coverage for auth failure scenarios (401 responses)
- [ ] Test coverage for route accessibility (static routes reachable)

---

## Related Documentation

- `docs/solutions/patterns/mais-critical-patterns.md` - Multi-tenant query isolation patterns
- `docs/solutions/code-review-patterns/EXPRESS-MIDDLEWARE-TYPES.md` - Type-safe middleware patterns
- `docs/solutions/code-review-patterns/MULTI-STEP-OWNERSHIP-VERIFICATION.md` - Ownership verification
- `docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` - Tenant middleware pipeline
- `docs/solutions/security-issues/PREVENT-CRUD-ROUTE-VULNERABILITIES.md` - Route security patterns

---

## Summary

| Issue            | Severity | Fix                                     |
| ---------------- | -------- | --------------------------------------- |
| Route Order      | P1       | Move `/stats` before `/:traceId`        |
| Auth Fallback    | P1       | Require authenticated user, return 401  |
| Missing tenantId | P2       | Add explicit `tenantId` to where clause |

**Key Insight:** Express matches routes in order. Static paths must precede parameterized paths. Auth must never silently degrade. Tenant isolation must be explicit at every query.
