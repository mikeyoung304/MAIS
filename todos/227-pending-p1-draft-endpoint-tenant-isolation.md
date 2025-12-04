---
status: resolved
priority: p1
issue_id: '227'
tags: [security, code-review, landing-page, tenant-isolation]
dependencies: []
source: 'code-review-landing-page-visual-editor'
resolved_at: '2025-12-04'
resolved_by: 'feat/landing-page-editor-p1-security branch'
---

# TODO-227: Draft Endpoints Must Verify Tenant Isolation

## Priority: P1 (Critical - Blocks Merge)

## Status: Pending

## Source: Security Review - Landing Page Visual Editor Plan

## Problem Statement

The landing page visual editor plan defines four new draft endpoints but does not explicitly verify that draft operations are scoped to the authenticated tenant. Without tenant verification, draft configs could leak across tenants.

**Why It Matters:**

- Data leakage between tenants (critical security vulnerability)
- Violates CLAUDE.md rule: "All database queries MUST be scoped by `tenantId`"
- OWASP Top 10: Broken Access Control

## Findings

**Evidence:**

- Plan (lines 244-249): Draft endpoints defined but no security validation mentioned
- Plan (lines 269-271): API implementation in routes file not specified
- Existing pattern in `tenant-admin-landing-page.routes.ts` shows correct pattern at lines 34-41

**Current Safe Pattern:**

```typescript
// tenant-admin-landing-page.routes.ts line 36-41
const tenantAuth = res.locals.tenantAuth;
if (!tenantAuth) {
  res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
  return;
}
const { tenantId } = tenantAuth;
```

## Proposed Solutions

### Option A: Apply Existing Pattern (Recommended)

Copy the existing tenant validation pattern to all draft endpoints.

**Pros:** Consistent, proven, minimal code
**Cons:** None
**Effort:** Small (30 min)
**Risk:** Low

```typescript
router.put('/draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
      return;
    }
    const { tenantId } = tenantAuth;

    const data = LandingPageConfigSchema.parse(req.body);
    const result = await tenantRepo.saveLandingPageDraft(tenantId, data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

### Option B: Create Middleware Wrapper

Create reusable middleware that extracts and validates tenant context.

**Pros:** DRY, centralized validation
**Cons:** More abstraction
**Effort:** Medium (1 hour)
**Risk:** Low

## Recommended Action

**Option A** - Apply the existing pattern from the GET endpoint to all draft endpoints.

## Technical Details

**Affected Files:**

- `server/src/routes/tenant-admin-landing-page.routes.ts` - Add draft route handlers
- `server/src/adapters/prisma/tenant.repository.ts` - Draft methods must require tenantId

**New Endpoints Requiring Validation:**

- `GET /v1/tenant-admin/landing-page/draft`
- `PUT /v1/tenant-admin/landing-page/draft`
- `POST /v1/tenant-admin/landing-page/publish`
- `DELETE /v1/tenant-admin/landing-page/draft`

## Acceptance Criteria

- [ ] All draft endpoints verify `res.locals.tenantAuth` exists
- [ ] All repository methods receive and use `tenantId` parameter
- [ ] Unit tests verify tenant isolation (attempt cross-tenant access fails)
- [ ] No endpoint allows access without valid tenant JWT

## Work Log

| Date       | Action  | Notes                                              |
| ---------- | ------- | -------------------------------------------------- |
| 2025-12-04 | Created | Security review of landing page visual editor plan |

## Tags

security, code-review, landing-page, tenant-isolation
