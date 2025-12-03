---
title: Tenant-Admin Add-On CRUD Routes Code Review Resolution
category: code-quality
problem_type: code_review_resolution
component: tenant-admin-routes
severity: p1
symptoms:
  - Missing API contract for GET /addons/:id endpoint
  - Inconsistent rate limiting across add-on routes
  - Duplicate tenant ID extraction and DTO mapping logic
  - Missing NotFoundError handling in retrieval endpoints
  - Unvalidated price upper bound allowing excessive values
tags:
  - api-contracts
  - rate-limiting
  - error-handling
  - validation
  - dry-refactoring
  - type-safety
date_resolved: 2025-12-03
related_todos: [192, 193, 194, 195, 196, 197, 198]
---

# Preventing CRUD Route Vulnerabilities

This document codifies prevention strategies for common CRUD route vulnerabilities discovered during code review of tenant-admin add-on routes. It covers security (rate limiting, input validation), type safety (API contracts), and code quality (DRY patterns, error handling).

## Problem Summary

A multi-agent code review of newly implemented add-on CRUD routes identified 7 issues across 3 priority levels:

| ID | Priority | Issue | Impact |
|----|----------|-------|--------|
| 192 | P1 | Missing API contract for GET /addons/:id | Type-unsafe clients, no OpenAPI docs |
| 193 | P1 | No rate limiting on CRUD endpoints | DoS vulnerability, resource exhaustion |
| 194 | P1 | Auth check duplicated 24 times | Maintenance nightmare, inconsistency risk |
| 195 | P1 | DTO mapping duplicated 4+ times | Schema sync issues, bugs on changes |
| 196 | P2 | Missing NotFoundError handling | 500 responses instead of 404 |
| 197 | P2 | Missing audit logging | DEFERRED (YAGNI) |
| 198 | P2 | Missing priceCents upper bound | Integer overflow, Stripe limit exceeded |

## Root Cause Analysis

These issues existed because:

1. **New routes added without following established patterns** - Package routes had proper contracts, rate limiting, and audit logging, but add-on routes were implemented without referencing these patterns
2. **No CRUD route checklist** - Developers had no systematic checklist to verify completeness
3. **Copy-paste without extraction** - Auth checks and DTO mappings were copied rather than extracted to helpers

## Solutions Applied

### 1. API Contract (TODO-192)

Added `tenantAdminGetAddOnById` contract in `packages/contracts/src/api.v1.ts`:

```typescript
tenantAdminGetAddOnById: {
  method: 'GET',
  path: '/v1/tenant-admin/addons/:id',
  pathParams: z.object({
    id: z.string(),
  }),
  responses: {
    200: AddOnDtoSchema,
    401: UnauthorizedErrorSchema,
    403: ForbiddenErrorSchema,
    404: NotFoundErrorSchema,
    500: InternalServerErrorSchema,
  },
  summary: 'Get single add-on by ID (requires tenant admin authentication)',
},
```

### 2. Rate Limiting (TODO-193)

Added rate limiters in `server/src/middleware/rateLimiter.ts`:

```typescript
// Read operations: 100/minute per tenant
export const addonReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTestEnvironment ? 500 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth,
  validate: false,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'too_many_addon_read_requests',
      message: 'Too many add-on requests. Please try again later.',
    }),
});

// Write operations: 20/minute per tenant
export const addonWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTestEnvironment ? 500 : 20,
  // ... same pattern
});
```

Applied to routes:
```typescript
router.get('/addons', addonReadLimiter, async (req, res, next) => { ... });
router.get('/addons/:id', addonReadLimiter, async (req, res, next) => { ... });
router.post('/addons', addonWriteLimiter, async (req, res, next) => { ... });
router.put('/addons/:id', addonWriteLimiter, async (req, res, next) => { ... });
router.delete('/addons/:id', addonWriteLimiter, async (req, res, next) => { ... });
```

### 3. DRY Helper Functions (TODO-194, TODO-195)

Extracted helpers at top of route section in `tenant-admin.routes.ts`:

```typescript
/**
 * TODO-194 FIX: Helper to extract tenantId from authenticated request
 * Returns null if not authenticated, allowing route to handle 401
 */
const getTenantId = (res: Response): string | null => {
  const tenantAuth = res.locals.tenantAuth;
  return tenantAuth?.tenantId ?? null;
};

/**
 * TODO-195 FIX: DTO mapper function to avoid code duplication
 * Maps AddOn entity to API response format
 */
const mapAddOnToDto = (addOn: {
  id: string;
  packageId: string;
  title: string;
  description: string | null;
  priceCents: number;
  photoUrl: string | null
}) => ({
  id: addOn.id,
  packageId: addOn.packageId,
  title: addOn.title,
  description: addOn.description,
  priceCents: addOn.priceCents,
  photoUrl: addOn.photoUrl,
});
```

Usage becomes cleaner:
```typescript
// Before: 6 lines repeated 5 times
const tenantAuth = res.locals.tenantAuth;
if (!tenantAuth) {
  res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
  return;
}
const tenantId = tenantAuth.tenantId;

// After: 4 lines
const tenantId = getTenantId(res);
if (!tenantId) {
  res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
  return;
}
```

### 4. Error Handling (TODO-196)

Added explicit NotFoundError catch blocks in PUT/DELETE routes:

```typescript
} catch (error) {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: error.issues });
    return;
  }
  // TODO-196 FIX: Explicit NotFoundError handling
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  next(error);
}
```

### 5. Price Upper Bound (TODO-198)

Added validation in `server/src/lib/validation.ts`:

```typescript
/**
 * Maximum price in cents: $999,999.99
 * Aligned with Stripe's maximum charge amount
 * @see https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts
 */
export const MAX_PRICE_CENTS = 99999999;

export function validatePrice(priceCents: number, fieldName: string = 'price'): void {
  if (priceCents < 0) {
    throw new ValidationError(`${fieldName} must be non-negative`);
  }
  if (priceCents > MAX_PRICE_CENTS) {
    throw new ValidationError(`${fieldName} exceeds maximum allowed value ($999,999.99)`);
  }
}
```

Added to Zod schemas in `packages/contracts/src/dto.ts`:

```typescript
const MAX_PRICE_CENTS = 99999999;

export const CreateAddOnDtoSchema = z.object({
  // ...
  priceCents: z.number().int().min(0).max(MAX_PRICE_CENTS, {
    message: 'Price exceeds maximum allowed value ($999,999.99)'
  }),
});
```

### 6. Audit Logging (TODO-197) - DEFERRED

Per YAGNI principle and DHH review guidance, audit logging for add-ons was deferred until there's a production need. The pattern exists in package CRUD if needed later.

## Verification

All 944 tests pass after applying these fixes:
- TypeScript compiles cleanly (`npm run typecheck`)
- 52 test files, 944 tests passing, 22 skipped
- 1 pre-existing failure (Stripe keys missing in test env, unrelated)

## Prevention Strategies

### Checklist for New CRUD Routes

Before implementing a new CRUD endpoint, verify:

- [ ] **API Contract exists** in `packages/contracts/src/api.v1.ts`
- [ ] **Rate limiter defined** in `server/src/middleware/rateLimiter.ts`
- [ ] **Rate limiter applied** to all routes (read: 100/min, write: 20/min)
- [ ] **Helper functions** extracted for auth check and DTO mapping
- [ ] **NotFoundError handling** in PUT/DELETE catch blocks
- [ ] **Input validation** with upper bounds on numeric fields
- [ ] **Package ownership verification** for tenant-scoped resources

### Code Review Checklist

When reviewing CRUD route PRs, check for:

| Area | Check |
|------|-------|
| Contracts | Does every route have a matching contract? |
| Rate Limiting | Is rate limiter applied to every route? |
| Auth | Is tenant auth checked before any business logic? |
| DRY | Are DTO mappings extracted to a function? |
| Errors | Are domain errors (NotFoundError, etc.) explicitly caught? |
| Validation | Do numeric fields have min/max bounds? |
| Security | Is cross-tenant access prevented? |

### Pattern Templates

**Rate Limiter Template:**
```typescript
export const entityReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTestEnvironment ? 500 : 100,
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth,
  validate: false,
  handler: (_req, res) => res.status(429).json({ error: 'too_many_requests' }),
});
```

**DTO Mapper Template:**
```typescript
const mapEntityToDto = (entity: EntityType) => ({
  id: entity.id,
  // ... map other fields
});
```

**Error Handler Template:**
```typescript
} catch (error) {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: error.issues });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  next(error);
}
```

## Related Documentation

- [PREVENTION-TODO-182-191-COMPREHENSIVE.md](../PREVENTION-TODO-182-191-COMPREHENSIVE.md) - Type DRY, exhaustiveness checking
- [missing-input-validation-cross-tenant-exposure.md](./missing-input-validation-cross-tenant-exposure.md) - Multi-tenant validation patterns
- [CLAUDE.md](../../../CLAUDE.md) - Error handling pattern, repository pattern

## Files Modified

| File | Changes |
|------|---------|
| `packages/contracts/src/api.v1.ts` | Added `tenantAdminGetAddOnById` contract |
| `packages/contracts/src/dto.ts` | Added MAX_PRICE_CENTS validation |
| `server/src/middleware/rateLimiter.ts` | Added `addonReadLimiter`, `addonWriteLimiter` |
| `server/src/lib/validation.ts` | Added price upper bound check |
| `server/src/routes/tenant-admin.routes.ts` | DRY helpers, error handling |

## TODO Files

- `todos/192-resolved-p1-missing-addon-getbyid-contract.md`
- `todos/193-resolved-p1-missing-rate-limiting-addon-routes.md`
- `todos/194-resolved-p1-duplicate-auth-pattern.md`
- `todos/195-resolved-p1-duplicate-dto-mapping.md`
- `todos/196-resolved-p2-missing-notfounderror-handling.md`
- `todos/197-deferred-p2-missing-audit-logging-addons.md`
- `todos/198-resolved-p2-pricecents-upper-bound.md`
