---
status: resolved
priority: p1
issue_id: '232'
tags: [api, code-review, landing-page, ts-rest]
dependencies: []
source: 'code-review-landing-page-visual-editor'
resolved_at: '2025-12-04'
resolved_by: 'feat/landing-page-editor-p1-security branch'
---

# TODO-232: Add Missing 404 Error Status Codes to Draft Contracts

## Priority: P1 (Critical - Blocks Merge)

## Status: Pending

## Source: API Contract Review - Landing Page Visual Editor Plan

## Problem Statement

The proposed draft API contracts don't include `404 NotFoundErrorSchema` for resource endpoints, violating the established ts-rest pattern in the codebase.

**Why It Matters:**

- Inconsistent error handling across endpoints
- Frontend can't properly type-check 404 responses
- Breaks client-side error handling expectations

## Findings

**Evidence:**

- Plan (lines 514-543): No 404 responses defined for draft endpoints
- Existing pattern (api.v1.ts lines 376-404): All resource endpoints include 404

**Current Safe Pattern:**

```typescript
tenantAdminUpdatePackage: {
  responses: {
    200: PackageResponseDtoSchema,
    400: BadRequestErrorSchema,
    401: UnauthorizedErrorSchema,
    403: ForbiddenErrorSchema,
    404: NotFoundErrorSchema,  // ← Mandatory
    422: UnprocessableEntityErrorSchema,
    500: InternalServerErrorSchema,
  },
}
```

## Proposed Solutions

### Option A: Add All Error Responses (Recommended)

Update contract to include complete error response set.

**Pros:** Consistent, type-safe, matches existing patterns
**Cons:** None
**Effort:** Small (15 min)
**Risk:** Low

```typescript
saveLandingPageDraft: {
  method: 'PUT',
  path: '/v1/tenant-admin/landing-page/draft',
  body: LandingPageConfigSchema,
  responses: {
    200: LandingPageConfigSchema,
    400: BadRequestErrorSchema,
    401: UnauthorizedErrorSchema,
    403: ForbiddenErrorSchema,
    404: NotFoundErrorSchema,
    422: UnprocessableEntityErrorSchema,
    500: InternalServerErrorSchema,
  },
},
```

## Recommended Action

**Option A** - Add complete error responses to all draft endpoints.

## Technical Details

**Affected Files:**

- `packages/contracts/src/tenant-admin/landing-page.contract.ts` - Add error responses

**Endpoints to Update:**

- `GET /v1/tenant-admin/landing-page/draft`
- `PUT /v1/tenant-admin/landing-page/draft`
- `POST /v1/tenant-admin/landing-page/publish`
- `DELETE /v1/tenant-admin/landing-page/draft`

## Acceptance Criteria

- [ ] All draft endpoints include 404 NotFoundErrorSchema
- [ ] All endpoints include 401, 403, 500 error schemas
- [ ] TypeScript compilation passes
- [ ] Frontend error handling uses typed responses

## Work Log

| Date       | Action  | Notes                                                  |
| ---------- | ------- | ------------------------------------------------------ |
| 2025-12-04 | Created | API contract review of landing page visual editor plan |

## Tags

api, code-review, landing-page, ts-rest
