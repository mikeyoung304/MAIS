---
status: complete
priority: p2
issue_id: '093'
tags: [todo]
dependencies: []
---

# TODO: Standardize error response format in public-tenant route

**Priority:** P2 (Medium)
**Category:** Pattern Consistency
**Source:** Code Review - Pattern Recognition Specialist Agent
**Created:** 2025-11-29

## Problem

The `public-tenant.routes.ts` uses a different error response format than other routes in the codebase:

**Current (public-tenant):**

```typescript
res.status(404).json({
  status: 'error',
  statusCode: 404,
  error: 'NOT_FOUND',
  message: 'Tenant not found',
});
```

**Standard pattern (other routes):**

```typescript
res.status(404).json({
  error: 'Tenant not found',
});
```

Also, the rate limiter response format differs from loginLimiter:

```typescript
// publicTenantLookupLimiter
{ status: 'error', statusCode: 429, error: 'RATE_LIMIT_EXCEEDED', message: '...' }

// loginLimiter
{ error: 'too_many_login_attempts', message: '...' }
```

## Location

- `server/src/routes/public-tenant.routes.ts:60-66, 75-81`
- `server/src/middleware/rateLimiter.ts:81-87`

## Impact

- Frontend needs to handle multiple error formats
- Inconsistent API experience for consumers
- Harder to build generic error handling
- Documentation complexity

## Solution

Use the standard error format that matches other routes:

```typescript
// 404 response
return res.status(404).json({
  error: 'Tenant not found',
});

// Or if you want more detail, use the contract-defined format:
return res.status(404).json({
  error: 'NOT_FOUND',
  message: 'Tenant not found',
});
```

For rate limiter, match the existing loginLimiter pattern:

```typescript
handler: (_req: Request, res: Response) =>
  res.status(429).json({
    error: 'too_many_requests',
    message: 'Rate limit exceeded. Please try again later.',
  }),
```

## Acceptance Criteria

- [ ] Error responses match standard format used by other routes
- [ ] Rate limiter response matches loginLimiter format
- [ ] Contract error schemas are consistent
- [ ] Frontend error handling works with standardized format

## Related Files

- `server/src/routes/public-tenant.routes.ts`
- `server/src/middleware/rateLimiter.ts`
- `packages/contracts/src/api.v1.ts` (error schemas)
