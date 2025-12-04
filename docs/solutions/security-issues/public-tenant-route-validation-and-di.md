---
title: Public Tenant Route Security Hardening
category: security-issues
severity: P1
date_solved: 2025-11-29
components: [public-tenant.routes.ts, tenant.repository.ts, contracts/dto.ts]
symptoms: [missing-input-validation, css-injection-risk, di-bypass]
root_cause: Route created without following established patterns
prevention: code-review-checklist
---

# Public Tenant Route Security Hardening

## Problem Summary

The public tenant lookup route (`/v1/public/tenants/:slug`) was created for storefront routing but had 4 P1 security/architecture issues:

1. **Missing slug validation** - No regex validation on path param
2. **CSS injection via fontFamily** - Branding field directly applied to DOM
3. **Not using ts-rest binding** - Bypassed contract enforcement
4. **Missing DI integration** - Used raw Prisma instead of repository

## Symptoms

- Contract defined `slug: z.string()` without constraints
- `fontFamily` field could contain CSS injection payloads
- Route used raw Express Router instead of ts-rest
- Route received `PrismaClient` directly instead of repository

## Root Cause

Route was created quickly to enable storefront routing feature without following the established patterns for:

- Contract-level input validation
- Repository-based data access (DI)
- Branding field sanitization

## Solution

### 1. Add Slug Validation to Contract

```typescript
// packages/contracts/src/api.v1.ts
getTenantPublic: {
  method: 'GET',
  path: '/v1/public/tenants/:slug',
  pathParams: z.object({
    slug: z.string()
      .min(1, 'Slug is required')
      .max(63, 'Slug must be 63 characters or less')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format'),
  }),
  // ...
}
```

### 2. Add Branding Validation with Allowlists

```typescript
// packages/contracts/src/dto.ts
const HexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color');

export const ALLOWED_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Source Sans Pro',
  'Nunito',
  'Raleway',
  'Work Sans',
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
] as const;

export const TenantPublicDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  apiKeyPublic: z.string(),
  branding: z
    .object({
      primaryColor: HexColorSchema.optional(),
      secondaryColor: HexColorSchema.optional(),
      accentColor: HexColorSchema.optional(),
      backgroundColor: HexColorSchema.optional(),
      fontFamily: z.enum(ALLOWED_FONT_FAMILIES).optional(),
      logoUrl: z.string().url().optional(),
    })
    .optional(),
});
```

### 3. Add Repository Method with Validation

```typescript
// server/src/adapters/prisma/tenant.repository.ts
async findBySlugPublic(slug: string): Promise<TenantPublicDto | null> {
  const tenant = await this.prisma.tenant.findUnique({
    where: { slug, isActive: true },
    select: { id: true, slug: true, name: true, apiKeyPublic: true, branding: true },
  });

  if (!tenant) return null;

  // Validate branding fields before returning
  const rawBranding = tenant.branding as Record<string, unknown> | null;
  const safeBranding = validateBrandingFields(rawBranding);

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    apiKeyPublic: tenant.apiKeyPublic,
    branding: safeBranding,
  };
}
```

### 4. Update Route to Use Repository

```typescript
// server/src/routes/public-tenant.routes.ts
export function createPublicTenantRoutes(tenantRepository: PrismaTenantRepository): Router {
  const router = Router();

  router.get('/:slug', async (req, res) => {
    const { slug } = req.params;

    // Validate slug format (matches contract)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slug || slug.length > 63 || !slugRegex.test(slug)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid slug' });
    }

    const tenant = await tenantRepository.findBySlugPublic(slug);
    if (!tenant) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tenant not found' });
    }

    return res.status(200).json(tenant);
  });

  return router;
}
```

### 5. Wire DI in index.ts

```typescript
// server/src/routes/index.ts
const publicTenantRoutes = createPublicTenantRoutes(tenantRepo); // Use existing repo
app.use('/v1/public/tenants', publicTenantLookupLimiter, publicTenantRoutes);
```

## Prevention Strategies

### Code Review Checklist for New Public Routes

- [ ] **Input validation**: All path/query params have Zod validation with constraints
- [ ] **Allowlists over blocklists**: Use enums/allowlists for user-controlled CSS values
- [ ] **DI pattern**: Route receives repository, not raw Prisma client
- [ ] **Defense in depth**: Validate at contract AND repository layer
- [ ] **Error responses**: Match standard error format from ErrorResponseSchema

### Security Considerations for Branding Fields

1. **Colors**: Always validate hex format `#XXXXXX`
2. **Font families**: Use strict allowlist of known-safe fonts
3. **URLs**: Validate with `z.string().url()` or URL constructor
4. **Never trust JSON fields**: Validate structure even from database

## Files Changed

| File                                              | Change                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| `packages/contracts/src/api.v1.ts`                | Added slug validation regex                       |
| `packages/contracts/src/dto.ts`                   | Added ALLOWED_FONT_FAMILIES, hex color validation |
| `server/src/adapters/prisma/tenant.repository.ts` | Added findBySlugPublic()                          |
| `server/src/routes/public-tenant.routes.ts`       | Refactored to use repository                      |
| `server/src/routes/index.ts`                      | Wired tenantRepo instead of prismaClient          |

## Related Documentation

- `docs/solutions/security-issues/missing-input-validation-cross-tenant-exposure.md`
- `docs/solutions/authentication-issues/invalid-credentials-case-sensitive-email-lookup.md`

## Commit Reference

```
e48f66c fix(security): add validation and DI to public tenant routes (P1 fixes)
```
