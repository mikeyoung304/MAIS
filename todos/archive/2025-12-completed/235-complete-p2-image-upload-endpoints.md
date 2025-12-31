---
status: complete
priority: p2
issue_id: '235'
tags: [security, api, code-review, landing-page, images]
dependencies: ['227']
source: 'code-review-landing-page-visual-editor'
---

# TODO-235: Define Image Upload Endpoints with Tenant Isolation

## Priority: P2 (Important - Should Fix)

## Status: Pending

## Source: Security Review - Landing Page Visual Editor Plan

## Problem Statement

The plan references image uploads for Hero, About, and Gallery sections but doesn't define backend endpoints. Without explicit endpoint definitions, implementation could miss tenant isolation checks.

**Why It Matters:**

- Unclear tenant isolation for image storage
- Potential cross-tenant image access
- No defined schema for upload responses

## Findings

**Evidence:**

- Plan (lines 142, 219): References `EditableImage` and photo upload
- Plan (line 589): "Photo upload API (existing - reuse from package photos)"
- No draft contract defined for image endpoints (lines 506-545)
- `upload.adapter.ts` uses packageId context, not tenantId

## Proposed Solutions

### Option A: Add Dedicated Endpoints (Recommended)

Create landing-page-specific image upload endpoints with tenant scoping.

**Pros:** Clear tenant isolation, type-safe contracts
**Cons:** More endpoints
**Effort:** Medium (2 hours)
**Risk:** Low

```typescript
uploadHeroImage: {
  method: 'POST',
  path: '/v1/tenant-admin/landing-page/images/hero',
  contentType: 'multipart/form-data',
  responses: {
    200: z.object({
      url: z.string().url(),
      filename: z.string(),
    }),
    400: BadRequestErrorSchema,
    401: UnauthorizedErrorSchema,
    413: z.object({ error: z.string() }), // Payload too large
  },
}
```

### Option B: Reuse Package Upload with Different Path

Extend existing upload adapter for landing page context.

**Pros:** Code reuse
**Cons:** Less explicit tenant verification
**Effort:** Small (1 hour)
**Risk:** Medium

## Recommended Action

**Option A** - Explicit endpoints are clearer and safer.

## Acceptance Criteria

- [ ] Image upload endpoints defined in contract
- [ ] All endpoints verify tenant ownership
- [ ] Response includes URL and filename
- [ ] Delete endpoint verifies ownership before removal

## Work Log

| Date       | Action  | Notes                                              |
| ---------- | ------- | -------------------------------------------------- |
| 2025-12-04 | Created | Security review of landing page visual editor plan |

## Tags

security, api, code-review, landing-page, images
