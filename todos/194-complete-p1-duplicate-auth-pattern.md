---
status: complete
priority: p1
issue_id: "194"
tags: [code-review, dry, refactoring]
dependencies: []
---

# Duplicate Auth Check Pattern (Copy-Pasted 24 Times)

## Problem Statement

The tenant authentication check is copy-pasted ~24 times in tenant-admin.routes.ts instead of using middleware. This violates DRY principles and increases maintenance burden.

### Why It Matters
- ~144 lines of duplicated boilerplate (6 lines × 24 endpoints)
- Changes to error messages require updates in multiple places
- Inconsistency risk as patterns drift over time
- Impossible to forget auth check on new endpoints if using middleware

## Findings

**Source:** DHH Review, Code Quality Review

**Evidence:**
```typescript
// Lines 1021-1028 (GET /addons) - Repeated 24+ times
const tenantAuth = res.locals.tenantAuth;
if (!tenantAuth) {
  res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
  return;
}
const tenantId = tenantAuth.tenantId;
```

**Location:** `server/src/routes/tenant-admin.routes.ts` - throughout entire file

## Proposed Solutions

### Option A: Extract to Middleware (Recommended)
**Pros:** Clean, follows Express patterns, single source of truth
**Cons:** Requires refactoring all routes
**Effort:** Medium (30 minutes)
**Risk:** Low

Create middleware:
```typescript
// middleware/require-tenant-auth.ts
export function requireTenantAuth(req: Request, res: Response, next: NextFunction) {
  if (!res.locals.tenantAuth) {
    res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
    return;
  }
  next();
}
```

Apply to router:
```typescript
router.use(requireTenantAuth);  // All routes now have tenantAuth
```

Routes become:
```typescript
router.get('/addons', async (req, res, next) => {
  const tenantId = res.locals.tenantAuth.tenantId;  // Guaranteed to exist
  // ...
});
```

### Option B: Higher-Order Function
**Pros:** Less global, explicit per-route
**Cons:** More boilerplate than middleware
**Effort:** Medium (30 minutes)
**Risk:** Low

```typescript
const withTenantAuth = (handler: (tenantId: string, req, res, next) => Promise<void>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
      return;
    }
    await handler(tenantAuth.tenantId, req, res, next);
  };

router.get('/addons', withTenantAuth(async (tenantId, req, res, next) => { ... }));
```

## Recommended Action

Option A - Middleware is cleaner and follows established patterns.

## Technical Details

**Affected Files:**
- `server/src/routes/tenant-admin.routes.ts`
- New: `server/src/middleware/require-tenant-auth.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] Auth check middleware created
- [ ] All tenant-admin routes use middleware
- [ ] Duplicate auth checks removed from route handlers
- [ ] 401 response still works correctly
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-03 | Created from code review | Use middleware for cross-cutting concerns |

## Resources

- Rails equivalent: `before_action :require_tenant_auth`
- Express middleware docs: https://expressjs.com/en/guide/using-middleware.html
