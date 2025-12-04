# Technical Reference: Configuration Versioning Implementation

## Code Locations Reference

### Current Branding Implementation

- **Schema**: `/Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma:37-68`
  - `Tenant.branding` (JSON)
  - `Tenant.updatedAt` (DateTime)
  - No versioning fields

- **Service**: `/Users/mikeyoung/CODING/Elope/server/src/controllers/tenant-admin.controller.ts:248-295`
  - `getBranding()` - fetches current branding
  - `updateBranding()` - direct merge and update, no versioning
  - No draft/publish workflow

- **Repository**: `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/tenant.repository.ts:110-115`
  - `update()` - generic update method
  - No version-specific methods

- **Frontend Hook**: `/Users/mikeyoung/CODING/Elope/client/src/hooks/useBranding.ts:51-106`
  - `useBranding()` - fetches from `/v1/tenant/branding`
  - Applies CSS variables dynamically
  - No draft/preview support

- **Frontend Editor**: `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/BrandingEditor.tsx`
  - Lines 210-263: `handleSave()` - direct API call
  - No draft/publish UI
  - No version history display

### Current Package Implementation

- **Schema**: `/Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma:106-129`
  - `Package.active` (Boolean, only status field)
  - `Package.photos` (JSON array)
  - No versioning or draft fields

- **Service**: `/Users/mikeyoung/CODING/Elope/server/src/services/catalog.service.ts`
  - Lines 135-152: `createPackage()` - direct creation
  - Lines 154-184: `updatePackage()` - direct update, cache invalidation only
  - Lines 186-198: `deletePackage()` - hard delete with cascade

- **Repository**: `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/catalog.repository.ts`
  - Lines 91-112: `createPackage()` - uses direct Prisma call
  - Lines 114-147: `updatePackage()` - conditional update of specific fields
  - Lines 149-163: `deletePackage()` - hard delete

- **Frontend Manager**: `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/TenantPackagesManager.tsx`
  - Direct API calls for CRUD
  - No versioning UI

### API Contracts

- **DTOs**: `/Users/mikeyoung/CODING/Elope/packages/contracts/src/dto.ts:133-150`
  - `TenantBrandingDtoSchema` - simple object with color/font/logo
  - Missing: isDraft, publishedAt, versionNumber
  - Missing: publish/rollback actions

- **API Routes**: `/Users/mikeyoung/CODING/Elope/packages/contracts/src/api.v1.ts:99-106`
  - `getTenantBranding: GET /v1/tenant/branding`
  - No versioning endpoints
  - No draft/publish endpoints

### Caching Layer

- **Cache Service**: `/Users/mikeyoung/CODING/Elope/server/src/lib/cache.ts`
  - Uses simple key-based caching
  - No version-aware caching
  - Catalog service invalidates on every change

## Schema Changes Required

### Add Tenant Versioning Fields

```prisma
model Tenant {
  // ... existing ...
  branding              Json       @default("{}")        // Current published
  draftBranding         Json       @default("{}")        // Draft for preview
  currentBrandingVersion Int       @default(0)          // Track version number
  brandingPublishedAt   DateTime?                        // When last published

  // Relations
  brandingVersions      BrandingVersion[]
  auditLogs             AuditLog[]
}
```

### Create Version History Tables

```prisma
model BrandingVersion {
  id              String   @id @default(cuid())
  tenantId        String
  versionNumber   Int
  branding        Json
  publishedAt     DateTime?
  createdAt       DateTime @default(now())
  createdBy       String?
  changeDescription String?

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, versionNumber])
  @@index([tenantId, publishedAt])
}

model PackageVersion {
  id              String   @id @default(cuid())
  packageId       String
  versionNumber   Int
  slug            String
  name            String
  description     String?
  basePrice       Int
  photos          Json     @default("[]")
  publishedAt     DateTime?
  createdAt       DateTime @default(now())
  createdBy       String?
  changeDescription String?

  package         Package  @relation(fields: [packageId], references: [id], onDelete: Cascade)

  @@unique([packageId, versionNumber])
  @@index([packageId, publishedAt])
}

model AuditLog {
  id              String   @id @default(cuid())
  tenantId        String
  entityType      String   // "BRANDING", "PACKAGE", "ADDON"
  entityId        String
  action          String   // "CREATE", "UPDATE", "PUBLISH", "ROLLBACK"
  changes         Json     // {before: {}, after: {}}
  userId          String?
  userEmail       String?
  ipAddress       String?
  timestamp       DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, timestamp])
  @@index([entityType, entityId])
}
```

### Update Package Model

```prisma
model Package {
  // ... existing ...
  isDraft         Boolean  @default(false)
  publishedAt     DateTime?
  currentVersion  Int      @default(1)
  photos          Json     @default("[]")      // Published photos
  draftPhotos     Json     @default("[]")      // Draft photos

  versions        PackageVersion[]

  @@index([tenantId, isDraft, active])
}
```

## New DTOs Required

### Versioning DTOs

```typescript
// Version history item
export const BrandingVersionDtoSchema = z.object({
  versionNumber: z.number(),
  branding: TenantBrandingDtoSchema,
  publishedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string().optional(),
  description: z.string().optional(),
});

export const PackageVersionDtoSchema = z.object({
  versionNumber: z.number(),
  slug: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priceCents: z.number().int(),
  photos: z.array(z.any()).optional(),
  publishedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string().optional(),
  description: z.string().optional(),
});

// Audit log entry
export const AuditLogDtoSchema = z.object({
  id: z.string(),
  entityType: z.enum(['BRANDING', 'PACKAGE', 'ADDON']),
  entityId: z.string(),
  action: z.enum(['CREATE', 'UPDATE', 'PUBLISH', 'ROLLBACK']),
  changes: z.object({
    before: z.any().optional(),
    after: z.any().optional(),
  }),
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  timestamp: z.string().datetime(),
});
```

## New Service Methods Required

### BrandingService

```typescript
// Draft management
saveDraft(tenantId: string, branding: BrandingDto, userId: string): Promise<void>
getDraftPreview(tenantId: string): Promise<BrandingDto | null>
discardDraft(tenantId: string, userId: string): Promise<void>

// Publishing
publishBranding(tenantId: string, userId: string): Promise<BrandingDto>

// Version management
rollbackToBrandingVersion(tenantId: string, versionNumber: number, userId: string): Promise<BrandingDto>
getBrandingVersionHistory(tenantId: string, limit?: number): Promise<BrandingVersionDto[]>
getBrandingVersion(tenantId: string, versionNumber: number): Promise<BrandingVersionDto | null>

// Comparison
compareBrandingVersions(tenantId: string, fromVersion: number, toVersion: number): Promise<DiffResult>
```

### PackageService (New)

```typescript
// Draft management
createPackageDraft(tenantId: string, data: CreatePackageInput, userId: string): Promise<PackageDto>
saveDraft(tenantId: string, packageId: string, changes: UpdatePackageInput, userId: string): Promise<void>
getDraftPreview(tenantId: string, packageId: string): Promise<PackageDto | null>
discardDraft(tenantId: string, packageId: string, userId: string): Promise<void>

// Publishing
publishPackage(tenantId: string, packageId: string, userId: string): Promise<PackageDto>

// Version management
rollbackPackageVersion(tenantId: string, packageId: string, versionNumber: number, userId: string): Promise<PackageDto>
getPackageVersionHistory(tenantId: string, packageId: string, limit?: number): Promise<PackageVersionDto[]>
```

### AuditLogService (New)

```typescript
log(entry: {
  tenantId: string;
  entityType: 'BRANDING' | 'PACKAGE' | 'ADDON';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'ROLLBACK';
  changes: any;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
}): Promise<void>

getAuditLog(tenantId: string, filters?: {
  entityType?: string;
  entityId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogDto[]>

getEntityHistory(tenantId: string, entityType: string, entityId: string): Promise<AuditLogDto[]>
```

## New API Endpoints Required

### Branding Versioning

```
POST   /v1/tenant/branding/draft         - Save draft
POST   /v1/tenant/branding/publish       - Publish draft
GET    /v1/tenant/branding/draft         - Get draft preview
POST   /v1/tenant/branding/draft/discard - Discard draft
GET    /v1/tenant/branding/versions      - Version history
POST   /v1/tenant/branding/versions/:versionNumber/rollback - Rollback
GET    /v1/tenant/branding/versions/:versionNumber - Get specific version
POST   /v1/tenant/branding/versions/:from/:to/compare - Compare versions
```

### Package Versioning

```
POST   /v1/tenant/packages/draft                      - Create draft package
POST   /v1/tenant/packages/:id/draft                  - Save package draft
POST   /v1/tenant/packages/:id/publish                - Publish package
GET    /v1/tenant/packages/:id/draft                  - Get package draft preview
POST   /v1/tenant/packages/:id/draft/discard          - Discard package draft
GET    /v1/tenant/packages/:id/versions               - Package version history
POST   /v1/tenant/packages/:id/versions/:versionNumber/rollback - Rollback
```

### Audit Log

```
GET    /v1/tenant/audit-log                           - Get audit log
GET    /v1/tenant/audit-log/:entityType/:entityId     - Get entity history
```

## Data Migration Script Template

```sql
-- Migrate existing branding to version 1
INSERT INTO "BrandingVersion" (id, "tenantId", "versionNumber", "branding", "publishedAt", "createdAt", "createdBy")
SELECT
  lower(substr(md5(random()::text), 1, 8)) || lower(substr(md5(random()::text), 1, 8)) || lower(substr(md5(random()::text), 1, 8)),
  id,
  1,
  branding,
  "updatedAt",
  "createdAt",
  NULL
FROM "Tenant"
WHERE branding IS NOT NULL AND branding != '{}';

-- Update tenants with current branding version
UPDATE "Tenant"
SET "currentBrandingVersion" = 1,
    "brandingPublishedAt" = "updatedAt"
WHERE branding IS NOT NULL AND branding != '{}';

-- Similar for packages
INSERT INTO "PackageVersion" (id, "packageId", "versionNumber", "slug", "name", "description", "basePrice", "photos", "publishedAt", "createdAt")
SELECT
  lower(substr(md5(random()::text), 1, 8)) || lower(substr(md5(random()::text), 1, 8)) || lower(substr(md5(random()::text), 1, 8)),
  id,
  1,
  slug,
  name,
  description,
  "basePrice",
  photos,
  "updatedAt",
  "createdAt"
FROM "Package";

-- Update packages with current version
UPDATE "Package"
SET "currentVersion" = 1,
    "publishedAt" = "updatedAt";
```

## Testing Locations to Add

### Service Tests

- `/Users/mikeyoung/CODING/Elope/server/test/services/branding.service.spec.ts` (new)
- `/Users/mikeyoung/CODING/Elope/server/test/services/package.service.spec.ts` (new)
- `/Users/mikeyoung/CODING/Elope/server/test/services/audit-log.service.spec.ts` (new)

### Integration Tests

- `/Users/mikeyoung/CODING/Elope/server/test/integration/versioning.spec.ts` (new)
- `/Users/mikeyoung/CODING/Elope/server/test/integration/audit-log.spec.ts` (new)

### E2E Tests

- `/Users/mikeyoung/CODING/Elope/e2e/tests/branding-versioning.spec.ts` (new)
- `/Users/mikeyoung/CODING/Elope/e2e/tests/package-versioning.spec.ts` (new)

## Key Implementation Details

### Draft Workflow

1. User makes changes → API saves to `draftBranding` or `draftPhotos`
2. User previews → API serves `draftBranding` with flag `isDraft: true`
3. User publishes → Creates version record, copies to published field
4. User can discard → Clears draft fields

### Rollback Workflow

1. User selects version from history
2. Service fetches that version
3. Creates NEW version entry with old content
4. Updates current published version
5. Logs rollback action

### Audit Trail

- Every change logged with: WHO (userId/email), WHAT (before/after), WHEN (timestamp)
- Changes stored as JSON diffs
- Queryable by entity type and ID

### Cache Invalidation

- Update: Invalidate cache + create version record + log
- Publish: Invalidate cache + create version record + update current + log
- Rollback: Invalidate cache + create version record + update current + log

## Performance Considerations

### Indexing Strategy

```sql
-- For BrandingVersion lookups
CREATE INDEX idx_branding_version_tenant_published
  ON "BrandingVersion"("tenantId", "publishedAt" DESC);

-- For PackageVersion lookups
CREATE INDEX idx_package_version_published
  ON "PackageVersion"("packageId", "publishedAt" DESC);

-- For AuditLog searches
CREATE INDEX idx_audit_log_tenant_timestamp
  ON "AuditLog"("tenantId", "timestamp" DESC);

CREATE INDEX idx_audit_log_entity
  ON "AuditLog"("entityType", "entityId", "timestamp" DESC);
```

### Caching Strategy

- Cache version history separately from current version
- Invalidate history cache on new version
- Cache current version aggressively (5-15 min TTL)
- Never cache draft (real-time)

### Query Optimization

- Use LIMIT on history queries (default 50, max 500)
- Paginate audit logs
- Use indexes for common queries
- Archive old versions after 1 year

## Backwards Compatibility

### For Existing Clients

- `/v1/tenant/branding` continues to work (returns published version)
- Existing update endpoints deprecated but functional
- New clients use draft/publish workflow
- Version migration happens transparently

### Migration Path

1. Create version 1 for all existing data
2. Set `currentVersion = 1`
3. Deprecate old endpoints (add warnings)
4. Eventually retire old endpoints (v2 API)
