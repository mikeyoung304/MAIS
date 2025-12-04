---
status: complete
priority: p1
issue_id: '086'
tags: [todo]
dependencies: []
---

# TODO: Add fontFamily validation to prevent CSS injection

**Priority:** P1 (High)
**Category:** Security
**Source:** Code Review - Security Sentinel Agent
**Created:** 2025-11-29

## Problem

The `fontFamily` field in `TenantPublicDtoSchema` is `z.string().optional()` without any validation. This value is directly applied to `document.documentElement.style.setProperty('--font-family', fontFamily)` in `TenantStorefrontLayout.tsx`.

A malicious tenant admin could set fontFamily to something like:

```
"Arial; } body { display: none; } .malicious {"
```

This could break the layout or enable CSS injection attacks.

## Location

- `packages/contracts/src/dto.ts` - TenantPublicDtoSchema branding.fontFamily
- `client/src/app/TenantStorefrontLayout.tsx:108` - Direct CSS variable assignment

## Risk

- CSS injection attacks
- Layout breaking
- Potential clickjacking via CSS manipulation
- Brand reputation damage

## Solution

1. Add allowlist validation for fontFamily in the contract:

```typescript
const ALLOWED_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Poppins', 'Source Sans Pro', 'Nunito', 'Raleway', 'Work Sans',
  'system-ui', 'sans-serif', 'serif', 'monospace'
] as const;

branding: z.object({
  // ... other fields
  fontFamily: z.enum(ALLOWED_FONTS).optional(),
}).optional(),
```

2. Or use a strict regex if custom fonts needed:

```typescript
fontFamily: z.string()
  .regex(/^[a-zA-Z\s-]+$/)
  .max(50)
  .optional(),
```

## Acceptance Criteria

- [ ] fontFamily field has validation (allowlist or regex)
- [ ] Invalid fontFamily values are rejected at API level
- [ ] Client-side also validates before applying CSS
- [ ] Existing tenant branding continues to work

## Related Files

- `packages/contracts/src/dto.ts`
- `client/src/app/TenantStorefrontLayout.tsx`
- `server/src/routes/public-tenant.routes.ts`
