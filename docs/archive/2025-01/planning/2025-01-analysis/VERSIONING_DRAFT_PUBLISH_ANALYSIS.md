# Configuration Versioning & Draft/Publish Workflows Analysis

## Executive Summary

The Elope codebase currently **lacks** comprehensive versioning, draft/publish workflows, and rollback capabilities for configurations. While the application tracks `createdAt` and `updatedAt` timestamps across entities, there are no mechanisms for:

- Draft vs. published configuration states
- Version history tracking
- Rollback/revert to previous versions
- Configuration snapshots
- Staging/production environment separation at the configuration level

However, there is a **soft-delete pattern** already in use for tenant deactivation that could be extended.

---

## Current State Analysis

### 1. Database Schema (Prisma)

**Location**: `/Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma`

#### Existing Timestamp Fields

```prisma
model Tenant {
  id           String   @id @default(cuid())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  isActive     Boolean  @default(true)  // Soft-delete pattern exists!
  branding     Json     @default("{}")  // Configuration stored as JSON blob
  // ... other fields
}

model Package {
  id          String    @id @default(cuid())
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  photos      Json      @default("[]")  // Photo array storage
  // ... other fields
}

model AddOn {
  id          String    @id @default(cuid())
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  // ... other fields
}
```

#### What's Missing

- `publishedAt` timestamp (when configuration went live)
- `draftAt` timestamp (when draft was created)
- `isDraft` / `isPublished` boolean flags
- `versionNumber` or `versionId` fields
- Foreign key to history/version tables
- `archivedAt` timestamp (alternative to soft-delete)
- `currentVersionId` reference

#### Soft-Delete Pattern (Exists)

The `isActive` field on `Tenant` model provides soft-delete capability:

```prisma
async deactivate(id: string): Promise<Tenant> {
  return await this.prisma.tenant.update({
    where: { id },
    data: { isActive: false },
  });
}
```

### 2. Configuration Management

#### Branding Configuration

**Location**:

- Server: `/Users/mikeyoung/CODING/Elope/server/src/controllers/tenant-admin.controller.ts`
- Client: `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/BrandingEditor.tsx`
- Hook: `/Users/mikeyoung/CODING/Elope/client/src/hooks/useBranding.ts`

**Current Implementation**:

- Branding stored as **JSON blob** in `Tenant.branding` field
- Direct update with no version history
- No draft/publish workflow
- Single active version per tenant

```typescript
// BrandingEditor.tsx - Direct save, no versioning
const result = await api.tenantUpdateBranding({
  body: {
    primaryColor,
    secondaryColor,
    fontFamily,
    logoUrl: logoUrl || undefined,
  },
});

// TenantAdminController - Simple merge and update
async updateBranding(tenantId: string, data: UpdateBrandingInput): Promise<BrandingDto> {
  const currentBranding = (tenant.branding as any) || {};
  const updatedBranding = {
    ...currentBranding,
    ...data,
  };

  await this.tenantRepo.update(tenantId, {
    branding: updatedBranding,
  });

  return { ... };
}
```

**Issues**:

- ❌ No way to revert branding changes
- ❌ No audit trail of who changed what and when
- ❌ No ability to preview changes before publishing
- ❌ No scheduled publishing capability

#### Package/AddOn Management

**Location**: `/Users/mikeyoung/CODING/Elope/server/src/services/catalog.service.ts`

**Current Implementation**:

- Direct CRUD operations
- Only `active` boolean flag (not draft/published)
- No version history
- Deletes are hard deletes (cascade delete)

```typescript
async updatePackage(tenantId: string, id: string, data: UpdatePackageInput): Promise<Package> {
  // Check if package exists
  const existing = await this.repository.getPackageById(tenantId, id);
  if (!existing) {
    throw new NotFoundError(`Package with id "${id}" not found`);
  }

  // Direct update - no versioning
  const result = await this.repository.updatePackage(tenantId, id, data);

  // Cache invalidation only
  this.invalidateCatalogCache(tenantId);

  return result;
}
```

**Issues**:

- ❌ Changes take effect immediately
- ❌ No rollback capability
- ❌ Hard deletes mean permanent data loss
- ❌ No configuration snapshots at booking time

### 3. Migrations & Schema Evolution

**Location**: `/Users/mikeyoung/CODING/Elope/server/prisma/migrations/`

**Current State**:

- Only basic database schema migrations
- No application-level versioning migrations
- No audit log table creation
- No history table creation

**Migrations Found**:

```
00_supabase_reset.sql
01_add_webhook_events.sql
02_add_performance_indexes.sql
03_add_multi_tenancy.sql
20251016140827_initial_schema/migration.sql
20251023152454_add_password_hash/migration.sql
```

### 4. API Contracts

**Location**: `/Users/mikeyoung/CODING/Elope/packages/contracts/src/dto.ts`

**Current DTOs**:

```typescript
export const UpdateBrandingDtoSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  fontFamily: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

export const UpdatePackageDtoSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priceCents: z.number().int().min(0).optional(),
  photoUrl: z.string().url().optional(),
});
```

**Missing**:

- `isDraft` field in update/create DTOs
- `publishedAt` in response DTOs
- `version` / `versionId` in DTOs
- Publish/draft action endpoints
- Rollback endpoints

### 5. Caching Strategy

**Location**: `/Users/mikeyoung/CODING/Elope/server/src/lib/cache.ts`

The caching layer **complicates** version management:

- Cache invalidation on every update
- No cache versioning
- Only one active version cached
- Makes preview capabilities harder to implement

```typescript
// Cache invalidation pattern
this.cache?.del(`catalog:${tenantId}:all-packages`);
this.cache?.del(`catalog:${tenantId}:package:${slug}`);
```

---

## What Already Works (Partial Solutions)

### Soft Delete Pattern

- `Tenant.isActive` field enables soft deletion
- Could be extended to Package/AddOn models
- Existing repository method: `tenant.deactivate(id)`

### Audit Trail (Partial)

- All models have `createdAt` and `updatedAt` timestamps
- Can track when last change occurred
- **BUT**: No tracking of WHO changed it or WHAT changed

### JSON Blob Storage

- Branding stored as JSON in database
- Allows flexible schema evolution
- Could support versioning within JSON structure
- **BUT**: No automatic migration on schema changes

---

## Gap Analysis: What's Missing

| Feature                          | Status          | Priority |
| -------------------------------- | --------------- | -------- |
| Draft/Published state            | ❌ Missing      | HIGH     |
| Version history tracking         | ❌ Missing      | HIGH     |
| Configuration rollback           | ❌ Missing      | HIGH     |
| Preview before publish           | ❌ Missing      | HIGH     |
| Audit logging (WHO/WHAT)         | ❌ Missing      | MEDIUM   |
| Scheduled publishing             | ❌ Missing      | MEDIUM   |
| Staging/production separation    | ❌ Missing      | MEDIUM   |
| Atomic snapshots at booking time | ❌ Missing      | MEDIUM   |
| Hard delete vs soft delete       | ⚠️ Inconsistent | MEDIUM   |
| API versioning                   | ⚠️ Partial      | LOW      |

---

## Recommended Implementation Strategy

### Phase 1: Core Versioning (High Priority)

#### 1.1 Database Schema Updates

Create migration: `add_versioning_support.sql`

```sql
-- Add to Tenant model
ALTER TABLE "Tenant" ADD COLUMN "draftBranding" JSONB DEFAULT '{}';
ALTER TABLE "Tenant" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "currentBrandingVersion" INTEGER DEFAULT 0;

-- Add to Package model
ALTER TABLE "Package" ADD COLUMN "isDraft" BOOLEAN DEFAULT false;
ALTER TABLE "Package" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Package" ADD COLUMN "currentVersion" INTEGER DEFAULT 1;
ALTER TABLE "Package" ADD COLUMN "draftPhotos" JSONB DEFAULT '[]';

-- Add to AddOn model
ALTER TABLE "AddOn" ADD COLUMN "isDraft" BOOLEAN DEFAULT false;
ALTER TABLE "AddOn" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "AddOn" ADD COLUMN "currentVersion" INTEGER DEFAULT 1;

-- Create version history tables
CREATE TABLE "BrandingVersion" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "versionNumber" INTEGER NOT NULL,
  "branding" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "changeDescription" TEXT,

  UNIQUE("tenantId", "versionNumber")
);

CREATE TABLE "PackageVersion" (
  "id" TEXT PRIMARY KEY,
  "packageId" TEXT NOT NULL REFERENCES "Package"("id") ON DELETE CASCADE,
  "versionNumber" INTEGER NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "basePrice" INTEGER NOT NULL,
  "photos" JSONB DEFAULT '[]',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "changeDescription" TEXT,

  UNIQUE("packageId", "versionNumber")
);

-- Create audit log table
CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "entityType" TEXT NOT NULL, -- "BRANDING", "PACKAGE", "ADDON"
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL, -- "CREATE", "UPDATE", "PUBLISH", "ROLLBACK"
  "changes" JSONB NOT NULL, -- {before: {}, after: {}}
  "userId" TEXT,
  "userEmail" TEXT,
  "ipAddress" TEXT,
  "timestamp" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

  INDEX("tenantId", "timestamp"),
  INDEX("entityType", "entityId")
);
```

#### 1.2 Update Prisma Schema

```prisma
model Tenant {
  id                      String           @id @default(cuid())
  // ... existing fields ...

  // Branding versioning
  branding                Json             @default("{}")  // Current published version
  draftBranding           Json             @default("{}")  // Draft for preview
  currentBrandingVersion  Int              @default(0)
  brandingVersions        BrandingVersion[]
  brandingPublishedAt     DateTime?

  // Relations
  auditLogs               AuditLog[]
}

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

model Package {
  id              String   @id @default(cuid())
  tenantId        String
  slug            String
  name            String
  description     String?
  basePrice       Int
  active          Boolean  @default(true)

  // Versioning
  isDraft         Boolean  @default(false)
  currentVersion  Int      @default(1)
  photos          Json     @default("[]")    // Published photos
  draftPhotos     Json     @default("[]")    // Draft photos for preview
  publishedAt     DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  versions        PackageVersion[]
  addOns          PackageAddOn[]
  bookings        Booking[]

  @@unique([tenantId, slug])
  @@index([tenantId, isDraft, active])
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

### Phase 2: Service Layer Updates

#### 2.1 Branding Service with Versioning

```typescript
// server/src/services/branding.service.ts
export class BrandingService {
  constructor(
    private tenantRepo: PrismaTenantRepository,
    private auditLog: AuditLogService
  ) {}

  // Save draft without publishing
  async saveDraft(tenantId: string, branding: BrandingDto, userId: string): Promise<void> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found');

    const changes = {
      before: tenant.branding,
      after: branding,
    };

    await this.tenantRepo.update(tenantId, {
      draftBranding: branding as any,
    });

    await this.auditLog.log({
      tenantId,
      entityType: 'BRANDING',
      entityId: tenantId,
      action: 'UPDATE_DRAFT',
      changes,
      userId,
    });
  }

  // Publish draft to live
  async publishBranding(tenantId: string, userId: string): Promise<BrandingDto> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found');

    const draftBranding = (tenant.draftBranding as any) || {};
    const nextVersion = (tenant.currentBrandingVersion || 0) + 1;

    // Create version record
    await this.prisma.brandingVersion.create({
      data: {
        tenantId,
        versionNumber: nextVersion,
        branding: draftBranding,
        publishedAt: new Date(),
        createdBy: userId,
        changeDescription: `Published version ${nextVersion}`,
      },
    });

    // Update published branding
    await this.tenantRepo.update(tenantId, {
      branding: draftBranding as any,
      currentBrandingVersion: nextVersion,
      draftBranding: {},
      brandingPublishedAt: new Date(),
    });

    await this.auditLog.log({
      tenantId,
      entityType: 'BRANDING',
      entityId: tenantId,
      action: 'PUBLISH',
      changes: { before: tenant.branding, after: draftBranding },
      userId,
    });

    return draftBranding as BrandingDto;
  }

  // Revert to previous version
  async rollbackToBrandingVersion(
    tenantId: string,
    versionNumber: int,
    userId: string
  ): Promise<BrandingDto> {
    const version = await this.prisma.brandingVersion.findUnique({
      where: {
        tenantId_versionNumber: { tenantId, versionNumber },
      },
    });

    if (!version) throw new NotFoundError('Version not found');

    const branding = version.branding as BrandingDto;

    // Create new version pointing to old content
    const nextVersion = (await this.getMaxBrandingVersion(tenantId)) + 1;
    await this.prisma.brandingVersion.create({
      data: {
        tenantId,
        versionNumber: nextVersion,
        branding: branding as any,
        publishedAt: new Date(),
        createdBy: userId,
        changeDescription: `Rolled back from v${versionNumber}`,
      },
    });

    // Update published branding
    await this.tenantRepo.update(tenantId, {
      branding: branding as any,
      currentBrandingVersion: nextVersion,
      brandingPublishedAt: new Date(),
    });

    await this.auditLog.log({
      tenantId,
      entityType: 'BRANDING',
      entityId: tenantId,
      action: 'ROLLBACK',
      changes: { rollbackFrom: versionNumber, rollbackTo: nextVersion },
      userId,
    });

    return branding;
  }

  // Get draft preview
  async getDraftPreview(tenantId: string): Promise<BrandingDto> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant not found');

    return (tenant.draftBranding as BrandingDto) || {};
  }

  // Get version history
  async getBrandingVersionHistory(
    tenantId: string,
    limit: number = 50
  ): Promise<BrandingVersionDto[]> {
    const versions = await this.prisma.brandingVersion.findMany({
      where: { tenantId },
      orderBy: { versionNumber: 'desc' },
      take: limit,
    });

    return versions.map((v) => ({
      versionNumber: v.versionNumber,
      branding: v.branding as BrandingDto,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      description: v.changeDescription,
    }));
  }
}
```

#### 2.2 Package Service with Versioning

Similar pattern as Branding, with methods:

- `saveDraft(packageId, changes, userId)`
- `publishPackage(packageId, userId)`
- `rollbackPackageVersion(packageId, versionNumber, userId)`
- `getPackageVersionHistory(packageId, limit)`
- `getPackageDraftPreview(packageId)`

### Phase 3: API Endpoints

#### 3.1 New Branding Endpoints

```typescript
// Branding versioning endpoints
tenantSaveBrandingDraft: {
  method: 'POST',
  path: '/v1/tenant/branding/draft',
  body: UpdateBrandingDtoSchema,
  responses: { 200: z.object({ ok: z.boolean() }) }
},

tenantPublishBranding: {
  method: 'POST',
  path: '/v1/tenant/branding/publish',
  responses: { 200: TenantBrandingDtoSchema }
},

tenantGetBrandingDraftPreview: {
  method: 'GET',
  path: '/v1/tenant/branding/draft',
  responses: { 200: TenantBrandingDtoSchema }
},

tenantGetBrandingVersionHistory: {
  method: 'GET',
  path: '/v1/tenant/branding/versions',
  query: z.object({ limit: z.number().optional() }),
  responses: { 200: z.array(BrandingVersionDtoSchema) }
},

tenantRollbackBrandingVersion: {
  method: 'POST',
  path: '/v1/tenant/branding/versions/:versionNumber/rollback',
  pathParams: z.object({ versionNumber: z.number() }),
  responses: { 200: TenantBrandingDtoSchema }
}
```

#### 3.2 Package Versioning Endpoints

Similar pattern:

- `POST /v1/tenant/packages/:id/draft` - save draft
- `POST /v1/tenant/packages/:id/publish` - publish
- `GET /v1/tenant/packages/:id/draft` - preview draft
- `GET /v1/tenant/packages/:id/versions` - version history
- `POST /v1/tenant/packages/:id/versions/:versionNumber/rollback` - rollback

#### 3.3 Audit Log Endpoint

```typescript
tenantGetAuditLog: {
  method: 'GET',
  path: '/v1/tenant/audit-log',
  query: z.object({
    entityType: z.enum(['BRANDING', 'PACKAGE', 'ADDON']).optional(),
    entityId: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional()
  }),
  responses: { 200: z.array(AuditLogDtoSchema) }
}
```

### Phase 4: Frontend Updates

#### 4.1 Branding Editor with Draft/Publish

```typescript
// BrandingEditor should:
// 1. Have separate "Save Draft" and "Publish" buttons
// 2. Show "Draft Changes" indicator
// 3. Allow preview of draft vs. live
// 4. Show version history
// 5. Allow rollback with confirmation
```

#### 4.2 Package Manager with Versioning

```typescript
// PackageForm should:
// 1. Support draft packages
// 2. Show publish/discard options
// 3. Display version history
// 4. Allow scheduled publishing (future enhancement)
// 5. Show "Last published" timestamp
```

---

## Configuration Snapshot for Bookings

### Current Issue

When a booking is created, it doesn't snapshot the current package/pricing configuration. If prices change later, old bookings may reference stale data.

### Solution

Store configuration snapshots in Booking:

```prisma
model Booking {
  // ... existing fields ...

  // Configuration snapshots at booking time
  packageSnapshot    Json      // Full package state at booking time
  addOnSnapshots     Json      // Full add-on states at booking time
  brandingSnapshot   Json      // Branding state at booking time
  priceSnapshot      Int       // Price at booking time
  commissionSnapshot Decimal   // Commission rate at booking time

  createdAt          DateTime  @default(now())
}
```

This ensures historical bookings retain accurate pricing and configuration.

---

## Staging/Production Separation

### Option 1: Tenant-based (Simpler)

```
Same tenant, different subdomains/URLs:
- staging.tenant.example.com (draft branding)
- www.tenant.example.com (published branding)
```

### Option 2: Environment-based (More Complex)

```
Separate environments per tenant:
- Default: PRODUCTION
- New environment type: STAGING
- Endpoints like /v1/tenant/branding?env=STAGING
```

**Recommendation**: Use Option 1 initially - leverage draft/published workflow.

---

## Implementation Roadmap

| Phase   | Timeline | Features                                  |
| ------- | -------- | ----------------------------------------- |
| Phase 1 | Week 1-2 | Schema changes, version tables, audit log |
| Phase 2 | Week 2-3 | Service layer, versioning logic           |
| Phase 3 | Week 3-4 | API endpoints                             |
| Phase 4 | Week 4-5 | Frontend UI updates                       |
| Phase 5 | Week 5-6 | Testing, documentation                    |

---

## Data Migration Strategy

For existing tenants moving to versioning:

```sql
-- Migrate existing branding to version 1
INSERT INTO "BrandingVersion" (id, "tenantId", "versionNumber", "branding", "publishedAt", "createdAt")
SELECT
  gen_random_uuid()::text,
  id,
  1,
  branding,
  "updatedAt",
  "createdAt"
FROM "Tenant"
WHERE branding IS NOT NULL AND branding != '{}';

-- Set current version to 1
UPDATE "Tenant"
SET "currentBrandingVersion" = 1,
    "brandingPublishedAt" = "updatedAt"
WHERE branding IS NOT NULL AND branding != '{}';
```

---

## Testing Strategy

```typescript
// Version history tests
describe('BrandingService', () => {
  describe('versioning', () => {
    it('should create new version on publish');
    it('should restore draft on discard');
    it('should rollback to previous version');
    it('should maintain version history');
    it('should prevent publishing invalid drafts');
  });

  describe('audit log', () => {
    it('should log all changes');
    it('should track who made changes');
    it('should record timestamps');
  });
});
```

---

## Security Considerations

1. **Access Control**: Only tenant admins can publish/rollback
2. **Audit Trail**: All changes must be logged with user ID
3. **Rollback Limits**: Consider time limits on rollback capability
4. **Approval Workflow**: For future: require approval for publishing
5. **Rate Limiting**: Prevent rapid publish/rollback cycles

---

## Performance Implications

### Concerns

- More database queries for version lookups
- Larger JSON blobs in history tables
- Audit log growth over time

### Mitigations

- Index on (tenantId, timestamp) for audit logs
- Archive old versions after 1 year
- Cache current version aggressively
- Cleanup task for orphaned versions

---

## Summary of Findings

### What Exists

✅ Soft-delete pattern (Tenant.isActive)
✅ Timestamps (createdAt, updatedAt)
✅ JSON blob storage for flexible config
✅ Basic cache invalidation

### What's Missing

❌ Draft/published state separation
❌ Version history tracking
❌ Rollback capability
❌ Preview functionality
❌ Audit logging (WHO/WHAT)
❌ Configuration snapshots
❌ Staging/production separation

### Critical Next Steps

1. Add schema for versioning and audit logs
2. Implement service layer for draft/publish workflows
3. Add API endpoints for version management
4. Update frontend for draft/publish UX
5. Add migration for existing data
6. Comprehensive testing and documentation

---

## Files to Create/Modify

### New Files

- `server/prisma/migrations/XX_add_versioning_support.sql`
- `server/src/services/branding.service.ts`
- `server/src/services/package.service.ts`
- `server/src/services/audit-log.service.ts`
- `server/src/routes/tenant-versioning.routes.ts`
- `client/src/features/tenant-admin/BrandingVersionHistory.tsx`
- `client/src/features/tenant-admin/PackageVersionHistory.tsx`

### Modified Files

- `server/prisma/schema.prisma`
- `packages/contracts/src/dto.ts`
- `packages/contracts/src/api.v1.ts`
- `client/src/features/tenant-admin/BrandingEditor.tsx`
- `client/src/features/tenant-admin/TenantPackagesManager.tsx`
