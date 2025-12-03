# TODO: Add safe branding type handling in public-tenant route

**Priority:** P2 (Medium)
**Category:** Data Integrity
**Source:** Code Review - Data Integrity Guardian Agent
**Created:** 2025-11-29

## Problem

The `public-tenant.routes.ts` casts the Prisma `JsonValue` branding field without validation:

```typescript
const branding = tenant.branding as {
  primaryColor?: string;
  // ...
} | null;
```

If the database contains malformed branding data (e.g., from a migration error or direct DB edit), this could cause runtime errors or return invalid data to clients.

## Location

- `server/src/routes/public-tenant.routes.ts:41-48`

## Risk

- Runtime errors if branding structure differs from expected
- Invalid data sent to clients
- No validation of string values within branding
- Potential for XSS if logoUrl contains malicious content

## Solution

Use Zod to validate branding data at runtime:

```typescript
import { z } from 'zod';

const BrandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontFamily: z.string().max(50).regex(/^[a-zA-Z\s-]+$/).optional(),
  logo: z.string().url().optional(),
}).nullable();

// In route handler:
const brandingResult = BrandingSchema.safeParse(tenant.branding);
const branding = brandingResult.success ? brandingResult.data : null;

// Return safe branding or null if invalid
return res.status(200).json({
  id: tenant.id,
  slug: tenant.slug,
  name: tenant.name,
  apiKeyPublic: tenant.apiKeyPublic,
  branding: branding ? {
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    backgroundColor: branding.backgroundColor,
    fontFamily: branding.fontFamily,
    logoUrl: branding.logo,
  } : undefined,
});
```

## Acceptance Criteria

- [ ] Branding validated with Zod schema at runtime
- [ ] Invalid branding returns null/undefined (not error)
- [ ] Color values validated as hex format
- [ ] fontFamily validated against safe pattern
- [ ] logoUrl validated as URL
- [ ] Log warning when branding validation fails

## Related Files

- `server/src/routes/public-tenant.routes.ts`
- `packages/contracts/src/dto.ts` (TenantPublicDtoSchema)
