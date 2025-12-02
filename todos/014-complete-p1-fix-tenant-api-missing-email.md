---
status: complete
priority: p1
issue_id: "014"
tags: [code-review, api, bug, tenant-admin]
dependencies: []
---

# Fix Tenant API Missing Email Field

## Problem Statement

The server endpoints for tenant management don't return the `email` field that both the contracts and client expect. This causes the tenant detail page to show empty email fields and potentially fail when saving.

**Why this matters:** Platform admins clicking on tenants see a broken/incomplete form because the API response doesn't include the email field that the form expects.

## Findings

### Root Cause
The server endpoints explicitly select/return specific fields but omit `email`:

**GET /admin/tenants (list)** - `server/src/routes/admin/tenants.routes.ts:29-40`:
```typescript
const tenants = await prisma.tenant.findMany({
  select: {
    id: true,
    slug: true,
    name: true,
    // email: true, // MISSING!
    apiKeyPublic: true,
    commissionPercent: true,
    // ...
  }
});
```

**GET /admin/tenants/:id (detail)** - `server/src/routes/admin/tenants.routes.ts:146-158`:
```typescript
const tenant = await prisma.tenant.findUnique({
  where: { id },
  include: { _count: { ... } },
  // Using include, so all fields returned BUT...
});

res.json({
  tenant: {
    // email is NOT mapped in response!
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    // ...
  }
});
```

### Contract Expectation
`packages/contracts/src/dto.ts:304-320`:
```typescript
export const TenantDtoSchema = z.object({
  email: z.string().email().nullable(), // REQUIRED by contract
  // ...
});
```

### Client Expectation
`client/src/features/admin/tenants/TenantForm/tenantApi.ts:18-28`:
```typescript
return {
  name: tenant.name,
  slug: tenant.slug,
  email: tenant.email || "",  // Expects email field
  phone: tenant.phone || "",  // Also expects phone (not in schema)
  // ...
};
```

## Proposed Solutions

### Option A: Add Email to Server Responses (Recommended)
**Effort:** Small | **Risk:** Low

Update both tenant endpoints to include the email field:

1. In GET /admin/tenants (list), add `email: true` to select
2. In GET /admin/tenants/:id (detail), add `email: tenant.email` to response mapping

**Pros:**
- Simple fix, minimal code change
- Aligns server with contracts
- Fixes the broken form immediately

**Cons:**
- None significant

### Option B: Remove Email from Client Form
**Effort:** Small | **Risk:** Medium

Remove email field from tenant form since it's nullable in the database.

**Pros:**
- Quick fix on client side

**Cons:**
- Reduces functionality
- Email is useful for tenant admin login
- Contracts would need updating

## Recommended Action

Implement **Option A** - Add email to server responses.

## Technical Details

**Affected Files:**
- `server/src/routes/admin/tenants.routes.ts` (lines 29-40, 164-184)

**Database Schema:**
- `email` field exists in Tenant model (nullable): `server/prisma/schema.prisma:43`

**No migration needed** - field already exists in database.

## Acceptance Criteria

- [ ] GET /admin/tenants returns email field for each tenant
- [ ] GET /admin/tenants/:id returns email field in tenant object
- [ ] Tenant detail form shows email when viewing existing tenant
- [ ] Saving tenant with email works correctly
- [ ] Tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-24 | Created | Found during code review of broken tenant pages |

## Resources

- Server routes: `server/src/routes/admin/tenants.routes.ts`
- DTO contracts: `packages/contracts/src/dto.ts:304-320`
- Client form: `client/src/features/admin/tenants/TenantForm/`
- Prisma schema: `server/prisma/schema.prisma:37-77`
