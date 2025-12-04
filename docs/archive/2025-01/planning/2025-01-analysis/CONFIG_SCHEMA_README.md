# Configuration Schema & API Layer - Complete Documentation

This directory contains comprehensive documentation about the Elope platform's configuration (branding) schema and API layer.

## Document Overview

### 1. CONFIG_SCHEMA_API_ANALYSIS.md (23KB, 854 lines)

**Comprehensive deep-dive analysis** of the entire configuration system.

Contents:

- Executive summary
- Schema definitions (Zod, TypeScript, Prisma)
- API contract definitions (ts-rest)
- Server-side implementation (routes, controllers, validation)
- Client-side implementation (API client, React components)
- Extensibility analysis (adding new fields)
- Draft vs. published support (recommended implementations)
- Versioning & audit capabilities
- API endpoint summary
- Validation constraints
- Security considerations
- Type definition hierarchy
- Integration examples
- Production recommendations

**Best for**: Understanding the full system architecture, making design decisions, planning extensions.

---

### 2. CONFIG_SCHEMA_QUICK_REFERENCE.md (3.6KB, 127 lines)

**Quick lookup guide** for developers working with the config system.

Contents:

- Current branding fields
- API endpoints table
- Validation rules
- Key design decisions
- Example: Adding new fields
- Current limitations
- Extension ideas
- File locations
- Security features
- Performance notes

**Best for**: Quick lookups, understanding capabilities, reference during development.

---

### 3. CONFIG_SCHEMA_IMPLEMENTATION_EXAMPLES.md (17KB, 687 lines)

**Practical code examples** showing how to implement features.

Contents:

- Complete type definitions
- API contract definitions
- Server implementation (route handlers, controllers)
- Client implementation (API wrapper, React components)
- Error handling examples
- Testing examples (unit & integration)
- Migration path for extensions

**Best for**: Copy-paste examples, understanding patterns, implementing features, writing tests.

---

## Quick Start

### For Understanding the System

1. Start with **QUICK_REFERENCE.md** for 5-minute overview
2. Read **API_ANALYSIS.md** sections 1-3 for detailed understanding
3. Check **IMPLEMENTATION_EXAMPLES.md** for specific code patterns

### For Adding a New Field

1. Read section 4.1 in **API_ANALYSIS.md** (Adding New Branding Fields)
2. Follow the migration path in **IMPLEMENTATION_EXAMPLES.md** section 7
3. Reference existing examples in **IMPLEMENTATION_EXAMPLES.md** section 3

### For Implementing Draft/Publish

1. Read section 5 in **API_ANALYSIS.md**
2. Review section 5.2 for implementation options
3. See section 6 for audit trail approaches

### For Security Review

1. Read section 9 in **API_ANALYSIS.md**
2. Review authentication flow in **IMPLEMENTATION_EXAMPLES.md** section 3
3. Check error handling patterns in **IMPLEMENTATION_EXAMPLES.md** section 5

---

## Current System Status

### What Works Today

✓ Multi-tenant branding configuration (primaryColor, secondaryColor, fontFamily, logo)
✓ Type-safe API with Zod validation
✓ JWT-authenticated endpoints
✓ Tenant isolation (cross-tenant access prevented)
✓ Partial updates (update only changed fields)
✓ JSON column storage (flexible schema, no migrations needed)
✓ Client-side color picker with validation
✓ Wedding-themed color presets
✓ Font family selector

### What's Missing

✗ Draft/published versioning (changes are live immediately)
✗ Change history or audit trail
✗ Rollback capability
✗ Logo file upload (only URL field)
✗ Preview mode before publishing
✗ Rate limiting on updates

---

## Key Design Principles

### 1. JSON Column Storage

- Branding stored in `Tenant.branding` as JSONB in PostgreSQL
- No schema migrations needed for new fields
- Flexible evolution of config structure
- Efficient querying via JSONB operators

### 2. Type Safety

- End-to-end TypeScript type safety
- Zod schemas for runtime validation
- Contract-driven API (ts-rest)
- Client code generation from server schemas

### 3. Tenant Isolation

- TenantId extracted from JWT token (not request body)
- Prevents accidental or malicious cross-tenant access
- Each update bound to authenticated tenant

### 4. Partial Updates

- All fields optional in update requests
- Updates merged with existing config (non-destructive)
- Can update individual colors without touching fonts

### 5. Extensibility

- Adding fields requires only schema changes
- Backward compatible (old clients still work)
- No database downtime for new fields
- Production-safe deployment process

---

## Architecture Overview

```
Client Layer
├── BrandingEditor.tsx (React component)
├── api.ts (Type-safe API wrapper)
└── package-photo-api.ts (Photo upload pattern)

API Contract Layer
├── api.v1.ts (Endpoint definitions)
└── dto.ts (Data transfer objects & schemas)

Server Implementation
├── routes/tenant-admin.routes.ts (HTTP handlers)
├── controllers/tenant-admin.controller.ts (Business logic)
├── validation/tenant-admin.schemas.ts (Server-side validation)
└── lib/ports.ts (Service interfaces)

Data Layer
├── prisma/schema.prisma (Database schema)
└── adapters/prisma/tenant.repository.ts (Data access)

Database
└── Tenant.branding (JSONB column)
```

---

## API Summary

### Public Endpoints

- `GET /v1/tenant/branding` - Fetch branding for widget (no auth)

### Admin Endpoints (JWT Required)

- `GET /v1/tenant/admin/branding` - Get current config
- `PUT /v1/tenant/admin/branding` - Update config

### Related Endpoints (Multi-file Pattern)

- `POST /v1/tenant/admin/packages/:id/photos` - Upload package photo
- `DELETE /v1/tenant/admin/packages/:id/photos/:filename` - Delete photo

---

## Validation Reference

### Hex Color Format

- Pattern: `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`
- Accepts: `#RRGGBB` (6-digit) or `#RGB` (3-digit)
- Examples: `#FF5733`, `#F57`, `#ffffff`
- Case-insensitive: `#FF5733` and `#ff5733` both valid

### Font Family

- Type: String
- Minimum length: 1 character
- No whitelist (any CSS font name accepted)
- Examples: `Inter`, `Playfair Display`, `Arial`

### Logo URL

- Type: Valid URL format
- Uses standard URL validation
- Examples: `https://cdn.example.com/logo.png`

---

## Common Tasks

### View Current Branding

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/v1/tenant/admin/branding
```

### Update Colors

```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor": "#FF5733",
    "secondaryColor": "#3498DB"
  }' \
  http://localhost:3001/v1/tenant/admin/branding
```

### Add a New Field (e.g., accentColor)

1. Update `packages/contracts/src/dto.ts`
2. Update `packages/contracts/src/api.v1.ts`
3. Update client component
4. Deploy (no database migration needed)

### Implement Draft Support

See section 5.2 in API_ANALYSIS.md for two recommended approaches:

- Option A: Dual JSON columns (simpler)
- Option B: History table (more advanced)

---

## Files in Codebase

| Path                                                  | Purpose              | Key Classes/Functions                                      |
| ----------------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| `packages/contracts/src/dto.ts`                       | Type definitions     | TenantBrandingDtoSchema, UpdateBrandingDtoSchema           |
| `packages/contracts/src/api.v1.ts`                    | API contract         | getTenantBranding, tenantGetBranding, tenantUpdateBranding |
| `server/prisma/schema.prisma`                         | Database schema      | Tenant.branding (Json column)                              |
| `server/src/validation/tenant-admin.schemas.ts`       | Validation rules     | updateBrandingSchema                                       |
| `server/src/routes/tenant-admin.routes.ts`            | HTTP handlers        | GET/PUT /branding endpoints                                |
| `server/src/controllers/tenant-admin.controller.ts`   | Business logic       | getBranding(), updateBranding()                            |
| `client/src/lib/api.ts`                               | API client           | tenantGetBranding(), tenantUpdateBranding()                |
| `client/src/features/tenant-admin/BrandingEditor.tsx` | UI component         | Color picker, font selector, presets                       |
| `client/src/lib/package-photo-api.ts`                 | Photo upload pattern | uploadPhoto(), deletePhoto()                               |

---

## Next Steps

### If You're...

**Adding a new color field (e.g., linkColor)**
→ Follow "Adding New Fields" in section 4.1 of API_ANALYSIS.md

**Implementing draft/publish workflow**
→ Review section 5 of API_ANALYSIS.md and choose Option A or B

**Adding audit logging**
→ Review section 6 of API_ANALYSIS.md for table structure

**Writing tests**
→ See section 6 of IMPLEMENTATION_EXAMPLES.md for test patterns

**Troubleshooting validation errors**
→ Check section 8 of API_ANALYSIS.md for constraint details

**Reviewing security**
→ See section 9 of API_ANALYSIS.md for current measures and improvements

---

## Related Systems

The branding configuration system shares similar patterns with:

1. **Package Photo Management** (`client/src/lib/package-photo-api.ts`)
   - Multi-file array storage (up to 5 photos per package)
   - Stored in `Package.photos` JSON column
   - Upload/delete endpoints with same multipart pattern

2. **Tenant Secrets Storage** (`Tenant.secrets` JSON column)
   - Encrypted Stripe credentials
   - Similar merge-on-update pattern

---

## Support & Questions

For questions about specific aspects:

- **Schemas & Types**: See CONFIG_SCHEMA_API_ANALYSIS.md sections 1-2
- **API Endpoints**: See CONFIG_SCHEMA_API_ANALYSIS.md section 7
- **Implementation**: See CONFIG_SCHEMA_IMPLEMENTATION_EXAMPLES.md
- **Quick Lookup**: See CONFIG_SCHEMA_QUICK_REFERENCE.md
- **Security**: See CONFIG_SCHEMA_API_ANALYSIS.md section 9
- **Production Ready**: See CONFIG_SCHEMA_API_ANALYSIS.md section 12
