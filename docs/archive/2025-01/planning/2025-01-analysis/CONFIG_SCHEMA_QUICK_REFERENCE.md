# Configuration Schema - Quick Reference

## Branding Fields (Current)

```typescript
{
  primaryColor?: string    // Hex: #RRGGBB or #RGB
  secondaryColor?: string  // Hex: #RRGGBB or #RGB
  fontFamily?: string      // CSS font name (Inter, Playfair Display, etc)
  logo?: string            // Full URL
}
```

## API Endpoints

| Endpoint                    | Method | Auth | Purpose                       |
| --------------------------- | ------ | ---- | ----------------------------- |
| `/v1/tenant/branding`       | GET    | None | Public widget branding fetch  |
| `/v1/tenant/admin/branding` | GET    | JWT  | Get tenant's current branding |
| `/v1/tenant/admin/branding` | PUT    | JWT  | Update tenant's branding      |

## Validation Rules

```javascript
primaryColor:    /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
secondaryColor:  /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
fontFamily:      min 1 char, no whitelist
logo:            must be valid URL
```

## Key Design Decisions

1. **JSON Column Storage** - Branding stored in `Tenant.branding` as JSONB
2. **No Database Migrations** - New fields can be added without schema changes
3. **Partial Updates** - All fields optional, merge with existing config
4. **Tenant Isolation** - JWT token determines which tenant is updated
5. **Single-Document Model** - No versioning, no draft/publish workflow

## Adding New Fields (Example)

```typescript
// 1. Update Zod schema in packages/contracts/src/dto.ts
export const TenantBrandingDtoSchema = z.object({
  // ... existing fields
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  darkMode: z.boolean().optional(),
});

// 2. Update API contract in packages/contracts/src/api.v1.ts
tenantUpdateBranding: {
  body: z.object({
    // ... existing fields
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    darkMode: z.boolean().optional(),
  }),
  // ...
}

// 3. Update client call
await api.tenantUpdateBranding({
  body: {
    accentColor: '#FFD700',
    darkMode: true,
    // ... existing fields
  },
});

// That's it! Database column handles new fields automatically.
```

## Current Limitations

- No draft/published versioning
- No change history or audit trail
- No rollback capability
- Logo upload not implemented (URL field only)
- Changes apply immediately (no preview mode)

## Extension Ideas

### Color Expansion

- `linkColor`, `errorColor`, `successColor`, `warningColor`
- `backgroundColor`, `textColor` presets

### Typography

- `headingFont`, `bodyFont` (separate from generic `fontFamily`)
- `fontSize`, `lineHeight` scales
- `letterSpacing` presets

### Layout

- `widgetLayout` (grid vs list vs carousel)
- `showLogo`, `showPrices`, `showDescription` toggles
- `borderRadius`, `spacing` scales

### Advanced

- Custom CSS rules (with sanitization)
- Multiple color schemes (light/dark mode)
- Template selection
- Asset CDN configuration

## File Locations

```
packages/contracts/src/dto.ts              # Schema definitions
packages/contracts/src/api.v1.ts          # API contract
server/prisma/schema.prisma                # Database schema
server/src/validation/tenant-admin.schemas.ts  # Server validation
server/src/routes/tenant-admin.routes.ts  # Route handlers
client/src/lib/api.ts                      # Client API wrapper
client/src/features/tenant-admin/BrandingEditor.tsx  # UI Component
```

## Security Features

✓ JWT authentication on all protected endpoints
✓ TenantId from token (prevents cross-tenant access)
✓ Zod validation on server
✓ Hex color regex validation
✓ URL format validation for logos

## Performance Notes

- JSONB column supports efficient querying
- No N+1 problems (single record load)
- JSON field changes don't trigger schema migrations
- Suitable for 1000s of tenants
