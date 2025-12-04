---
status: complete
priority: p1
issue_id: "085"
tags: [todo]
dependencies: []
---

# TODO: Add slug validation regex to TenantPublicDto contract

**Priority:** P1 (High)
**Category:** Security
**Source:** Code Review - Security Sentinel Agent
**Created:** 2025-11-29

## Problem

The `getTenantPublic` endpoint in `packages/contracts/src/api.v1.ts` uses `z.string()` without any validation regex for the slug path parameter. This allows potentially malicious input to reach the database query.

## Location

- `packages/contracts/src/api.v1.ts:406` - `pathParams: z.object({ slug: z.string() })`

## Risk

- SQL injection vectors (though Prisma parameterizes queries)
- Path traversal attempts
- Excessive input length causing performance issues
- Inconsistent with other slug validations in the codebase

## Solution

Add a slug validation regex that matches the existing pattern used elsewhere:

```typescript
pathParams: z.object({
  slug: z.string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
}),
```

## Acceptance Criteria

- [ ] Slug path param has min/max length constraints
- [ ] Slug path param has regex validation matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- [ ] Invalid slugs return 400 Bad Request (not 404)
- [ ] Unit test covers invalid slug rejection

## Related Files

- `packages/contracts/src/api.v1.ts`
- `packages/contracts/src/dto.ts`
