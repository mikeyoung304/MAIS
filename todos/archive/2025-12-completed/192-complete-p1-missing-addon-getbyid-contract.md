---
status: complete
priority: p1
issue_id: '192'
tags: [code-review, api-contract, type-safety]
dependencies: []
---

# Missing API Contract for GET /v1/tenant-admin/addons/:id

## Problem Statement

The route handler `GET /v1/tenant-admin/addons/:id` is implemented in tenant-admin.routes.ts (lines 1050-1078), but there is **no corresponding API contract definition** in the contracts package. This breaks the type-safe API contract pattern that is mandatory in this codebase.

### Why It Matters

- Type safety is bypassed - response structure not validated
- Frontend clients cannot generate type-safe API calls
- Documentation generation will be incomplete
- Breaks architectural pattern that prevents security regressions

## Findings

**Source:** Security Review, Architecture Review

**Evidence:**

- Routes file implements: `router.get('/addons/:id', ...)` (line 1050)
- Contracts file has: `tenantAdminGetAddOns` (all add-ons) but NOT `tenantAdminGetAddOnById`
- Other similar endpoints (packages, segments) all have individual GET by ID contracts

**Location:**

- `server/src/routes/tenant-admin.routes.ts:1050-1078` (route exists)
- `packages/contracts/src/api.v1.ts` (contract missing)

## Proposed Solutions

### Option A: Add Missing Contract (Recommended)

**Pros:** Maintains type-safe API pattern, quick fix
**Cons:** None
**Effort:** Small (5 minutes)
**Risk:** Low

Add to `packages/contracts/src/api.v1.ts` after line 982:

```typescript
/**
 * Get single add-on by ID
 * GET /v1/tenant-admin/addons/:id
 */
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

## Recommended Action

Option A - Add the missing contract to maintain consistency.

## Technical Details

**Affected Files:**

- `packages/contracts/src/api.v1.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] Contract `tenantAdminGetAddOnById` exists in api.v1.ts
- [ ] Contract matches existing route response structure
- [ ] TypeScript compiles without errors
- [ ] Route handler type-checks against contract

## Work Log

| Date       | Action                   | Learnings                             |
| ---------- | ------------------------ | ------------------------------------- |
| 2025-12-03 | Created from code review | Always create contracts before routes |

## Resources

- PR: Current uncommitted changes on main
- Similar Pattern: `tenantAdminGetPackageById` in same file
