# Database Layer and Model Separation Analysis

## Executive Summary

Elope demonstrates **strong architectural separation** between business logic and persistence layers through:

- **Port-based architecture** (interfaces define contracts before Prisma)
- **Domain entities** separate from persistence models
- **Comprehensive tenant isolation** via composite unique constraints and middleware
- **Explicit tenantId scoping** in all repository queries
- **Branding as structured JSON** in Tenant model, separate from business data
- **Strategic use of JSONB** for flexible presentation config without schema migrations

---

## 1. Business Logic vs. Presentation Config Separation

### 1.1 Clear Separation Pattern

**Business Logic Models** (in `lib/entities.ts`):

```typescript
export interface Package {
  id: string;
  tenantId: string; // Multi-tenant isolation
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  photoUrl?: string;
  photos?: any; // Photo gallery
}

export interface Booking {
  id: string;
  packageId: string;
  coupleName: string;
  email: string;
  phone?: string;
  eventDate: string;
  addOnIds: string[];
  totalCents: number;
  commissionAmount?: number;
  commissionPercent?: number;
  status: 'PAID' | 'REFUNDED' | 'CANCELED';
  createdAt: string;
}
```

**Presentation Config** (in Tenant model):

```prisma
model Tenant {
  // ... auth and business fields ...

  // Branding Configuration for embeddable widget
  // Structure: {primaryColor, secondaryColor, fontFamily, logo}
  // Example: {"primaryColor": "#8B7355", "secondaryColor": "#D4A574",
  //          "fontFamily": "Inter", "logo": "https://..."}
  branding Json @default("{}")  // Widget branding settings

  // ... stripe and commission ...
}
```

### 1.2 Presentation Config Storage Strategy

**Location**: `Tenant.branding` (JSONB field)

**Structure**:

```json
{
  "primaryColor": "#8B7355",
  "secondaryColor": "#D4A574",
  "fontFamily": "Playfair Display",
  "logo": "https://cdn.example.com/logo.png"
}
```

**Why JSONB?**

- Schema-flexible: No migration needed when adding new branding properties
- Tenant-specific: Each tenant has independent branding without separate tables
- Query-optimized: JSONB indexes enable efficient filtering
- Version-compatible: Old tenants with partial config work alongside new ones

**Integration Point**: Client retrieves via `useBranding()` hook which:

1. Calls `api.getTenantBranding()` (scoped by API key)
2. Applies colors as CSS variables: `--color-primary`, `--color-secondary`
3. Dynamically loads Google Fonts based on fontFamily
4. Caches for 5 minutes with React Query

### 1.3 Booking Price Logic Separation

**Domain entities separate pricing concerns**:

```typescript
// Domain entity - contains business values
export interface Booking {
  totalCents: number; // Total amount (package + add-ons)
  commissionAmount?: number; // Platform's cut (calculated server-side)
  commissionPercent?: number; // Tenant's commission rate (snapshot)
}
```

**Stored in Prisma model**:

```prisma
model Booking {
  // Core business
  totalPrice Int

  // Multi-tenant commission tracking
  commissionAmount  Int     @default(0)  // In cents
  commissionPercent Decimal @default(0) @db.Decimal(5, 2)
}
```

**Commission Calculation** (server-side only, not exposed to frontend):

- Uses `TenantRepository.getStats()` to fetch tenant commission rate
- Calculated in `CommissionService` during booking creation
- Snapshot stored with booking for audit trail
- Never calculated client-side (prevents fraud)

---

## 2. Prisma Schema Structure

### 2.1 Core Schema Overview

**Location**: `/Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma`

```prisma
// Multi-tenant root model
model Tenant {
  id String @id @default(cuid())
  slug String @unique                    // URL-safe identifier
  name String                           // Display name

  // Tenant Admin Authentication
  email String? @unique
  passwordHash String?

  // API Authentication (public key format)
  apiKeyPublic String @unique           // pk_live_tenant_xyz
  apiKeySecret String                   // Hashed

  // Commission Settings
  commissionPercent Decimal @default(10.0) @db.Decimal(5, 2)

  // Presentation Configuration
  branding Json @default("{}")

  // Stripe Connect Integration
  stripeAccountId String? @unique
  stripeOnboarded Boolean @default(false)

  // Encrypted Secrets
  secrets Json @default("{}")

  // Status
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations - all cascade delete
  users User[]
  packages Package[]
  addOns AddOn[]
  bookings Booking[]
  blackoutDates BlackoutDate[]
  webhookEvents WebhookEvent[]

  @@index([slug])
  @@index([apiKeyPublic])
  @@index([isActive])
}
```

### 2.2 Business Models with Tenant Isolation

**Package Model** - Catalog Item:

```prisma
model Package {
  id String @id @default(cuid())
  tenantId String                       // REQUIRED - tenant isolation
  slug String
  name String
  description String?
  basePrice Int                         // In cents
  active Boolean @default(true)

  // Photo Gallery - Array of photo objects
  // Structure: [{url, filename, size, order}]
  // Max 5 photos per package
  photos Json @default("[]")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  addOns PackageAddOn[]
  bookings Booking[]

  @@unique([tenantId, slug])            // Tenant + slug unique
  @@index([tenantId, active])           // Optimize tenant queries
  @@index([tenantId])
}
```

**AddOn Model** - Optional Service:

```prisma
model AddOn {
  id String @id @default(cuid())
  tenantId String                       // REQUIRED - tenant isolation
  slug String
  name String
  description String?
  price Int                             // In cents
  active Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  packages PackageAddOn[]
  bookingRefs BookingAddOn[]

  @@unique([tenantId, slug])            // Tenant + slug unique
  @@index([tenantId, active])
  @@index([tenantId])
}
```

**Booking Model** - Order Record:

```prisma
model Booking {
  id String @id @default(cuid())
  tenantId String                       // REQUIRED - tenant isolation
  customerId String
  packageId String
  venueId String?
  date DateTime @db.Date
  startTime DateTime?
  endTime DateTime?
  status BookingStatus @default(PENDING)
  totalPrice Int
  notes String?

  // Platform Commission (Multi-tenant)
  commissionAmount Int @default(0)
  commissionPercent Decimal @default(0) @db.Decimal(5, 2)

  // Stripe Payment
  stripePaymentIntentId String? @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  confirmedAt DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id])
  package Package @relation(fields: [packageId], references: [id])
  venue Venue? @relation(fields: [venueId], references: [id])
  addOns BookingAddOn[]
  payments Payment[]

  @@unique([tenantId, date])            // One booking per date per tenant
  @@index([tenantId, status])
  @@index([tenantId, date])
  @@index([tenantId, status, date])
  @@index([tenantId])
  @@index([customerId])
  @@index([stripePaymentIntentId])
  @@index([createdAt])
}
```

**BlackoutDate Model** - Unavailable Dates:

```prisma
model BlackoutDate {
  id String @id @default(cuid())
  tenantId String                       // REQUIRED - tenant isolation
  date DateTime @db.Date
  reason String?
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, date])            // One blackout per date per tenant
  @@index([tenantId, date])
  @@index([tenantId])
}
```

**WebhookEvent Model** - Event Tracking:

```prisma
model WebhookEvent {
  id String @id @default(uuid())
  tenantId String                       // REQUIRED - tenant isolation
  eventId String @unique                // Stripe event ID
  eventType String
  rawPayload String @db.Text
  status WebhookStatus @default(PENDING)
  attempts Int @default(1)
  lastError String? @db.Text
  processedAt DateTime?
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, status])
  @@index([tenantId, createdAt])
  @@index([tenantId])
  @@index([eventId])
  @@index([status])
  @@index([status, createdAt])
}
```

### 2.3 Composite Unique Constraints Pattern

**Critical Uniqueness Rules**:

1. **Package**: `(tenantId, slug)` unique → Each tenant has unique package names
2. **AddOn**: `(tenantId, slug)` unique → Each tenant has unique add-on names
3. **Booking**: `(tenantId, date)` unique → **One booking per date per tenant** (mission-critical)
4. **BlackoutDate**: `(tenantId, date)` unique → Prevents duplicate blackout dates

These composite constraints **prevent cross-tenant data collisions** at the database level.

---

## 3. Repository Pattern & Ports Architecture

### 3.1 Separation: Ports (Interfaces) → Adapters (Implementation)

**Port Definition** (`lib/ports.ts`):

```typescript
export interface CatalogRepository {
  getAllPackages(tenantId: string): Promise<Package[]>;
  getPackageBySlug(tenantId: string, slug: string): Promise<Package | null>;
  getPackageById(tenantId: string, id: string): Promise<Package | null>;
  getAddOnsByPackageId(tenantId: string, packageId: string): Promise<AddOn[]>;
  createPackage(tenantId: string, data: CreatePackageInput): Promise<Package>;
  updatePackage(tenantId: string, id: string, data: UpdatePackageInput): Promise<Package>;
  deletePackage(tenantId: string, id: string): Promise<void>;
  createAddOn(tenantId: string, data: CreateAddOnInput): Promise<AddOn>;
  updateAddOn(tenantId: string, id: string, data: UpdateAddOnInput): Promise<AddOn>;
  deleteAddOn(tenantId: string, id: string): Promise<void>;
}
```

**Key Design**:

- **All methods include `tenantId` parameter** (enforces scoping)
- Methods return **domain entities** (not Prisma models)
- **No business logic** in interface definition

### 3.2 Adapter Implementation Pattern

**File**: `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/catalog.repository.ts`

```typescript
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPackageBySlug(tenantId: string, slug: string): Promise<Package | null> {
    const pkg = await this.prisma.package.findUnique({
      where: { tenantId_slug: { tenantId, slug } }, // Composite unique constraint
    });
    return pkg ? this.toDomainPackage(pkg) : null;
  }

  async createPackage(tenantId: string, data: CreatePackageInput): Promise<Package> {
    // Check for slug uniqueness within tenant
    const existing = await this.prisma.package.findUnique({
      where: { tenantId_slug: { tenantId, slug: data.slug } },
    });

    if (existing) {
      throw new DomainError('DUPLICATE_SLUG', `Package with slug '${data.slug}' already exists`);
    }

    const pkg = await this.prisma.package.create({
      data: {
        tenantId, // Required for isolation
        slug: data.slug,
        name: data.title,
        description: data.description,
        basePrice: data.priceCents,
      },
    });

    return this.toDomainPackage(pkg);
  }

  // Mapper: Prisma model → Domain entity
  private toDomainPackage(pkg: {
    id: string;
    tenantId: string;
    slug: string;
    name: string;
    description: string | null;
    basePrice: number;
    active: boolean;
    photos?: any;
  }): Package {
    return {
      id: pkg.id,
      tenantId: pkg.tenantId,
      slug: pkg.slug,
      title: pkg.name,
      description: pkg.description || '',
      priceCents: pkg.basePrice,
      photos: pkg.photos || [],
    };
  }
}
```

**Key Patterns**:

1. **tenantId parameter** enforced on all queries
2. **Composite unique key queries**: `{ tenantId, slug }`
3. **Tenant isolation checks** before updates
4. **Mappers**: Prisma models → Domain entities
5. **Domain error throwing**: `DomainError` instead of Prisma errors

### 3.3 Booking Repository - Advanced Concurrency Control

**File**: `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/booking.repository.ts`

```typescript
async create(tenantId: string, booking: Booking): Promise<Booking> {
  try {
    return await this.prisma.$transaction(async (tx) => {
      // Layer 1: Pessimistic lock to prevent race conditions
      const lockQuery = `
        SELECT 1 FROM "Booking"
        WHERE "tenantId" = $1 AND date = $2
        FOR UPDATE NOWAIT
      `;

      try {
        await tx.$queryRawUnsafe(lockQuery, tenantId, new Date(booking.eventDate));
      } catch (lockError) {
        // P2034 = Transaction lock timeout
        if (lockError.code === 'P2034') {
          throw new BookingLockTimeoutError(booking.eventDate);
        }
        throw lockError;
      }

      // Layer 2: Check if date is already booked
      const existing = await tx.booking.findFirst({
        where: { tenantId, date: new Date(booking.eventDate) }
      });

      if (existing) {
        throw new BookingConflictError(booking.eventDate);
      }

      // Layer 3: Create/upsert customer
      const customer = await tx.customer.upsert({
        where: { email: booking.email },
        update: { name: booking.coupleName, phone: booking.phone },
        create: { email: booking.email, name: booking.coupleName, phone: booking.phone },
      });

      // Layer 4: Create booking with add-ons
      const created = await tx.booking.create({
        data: {
          id: booking.id,
          tenantId,                      // Required isolation
          customerId: customer.id,
          packageId: booking.packageId,
          date: new Date(booking.eventDate),
          totalPrice: booking.totalCents,
          addOns: {
            create: booking.addOnIds.map((addOnId) => ({
              addOnId,
              quantity: 1,
              unitPrice: addOnPrices.get(addOnId) || 0,
            })),
          },
        },
      });

      return this.toDomainBooking(created);
    }, {
      timeout: 5000,                     // 5 second transaction timeout
      isolationLevel: 'Serializable',    // Strongest isolation
    });
  } catch (error) {
    // Layer 5: Catch unique constraint violations
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BookingConflictError(booking.eventDate);
    }
    throw error;
  }
}

async getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<Date[]> {
  const bookings = await this.prisma.booking.findMany({
    where: {
      tenantId,                          // Scoped to tenant
      date: { gte: startDate, lte: endDate },
      status: { in: ['CONFIRMED', 'PENDING'] },
    },
    select: { date: true },
    orderBy: { date: 'asc' },
  });

  return bookings.map(b => b.date);
}
```

**Three-Layer Defense Against Double-Booking**:

1. **Database Level**: `@@unique([tenantId, date])` constraint
2. **Transaction Level**: `FOR UPDATE NOWAIT` pessimistic lock with SERIALIZABLE isolation
3. **Application Level**: Check existing booking after lock acquired

---

## 4. Tenant Isolation Enforcement

### 4.1 Middleware-Based Tenant Resolution

**File**: `/Users/mikeyoung/CODING/Elope/server/src/middleware/tenant.ts`

```typescript
export function resolveTenant(prisma: PrismaClient) {
  return async (req: TenantRequest, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-tenant-key'] as string;

    // 1. Validate format before database lookup
    if (!apiKeyService.isValidPublicKeyFormat(apiKey)) {
      return res.status(401).json({ error: 'Invalid API key format' });
    }

    // 2. Lookup tenant by public API key
    const tenant = await prisma.tenant.findUnique({
      where: { apiKeyPublic: apiKey },
      select: {
        id: true,
        slug: true,
        name: true,
        commissionPercent: true,
        branding: true,
        stripeAccountId: true,
        stripeOnboarded: true,
        isActive: true,
      },
    });

    // 3. Verify tenant exists and is active
    if (!tenant || !tenant.isActive) {
      return res.status(403).json({ error: 'Tenant inactive' });
    }

    // 4. Attach to request for downstream handlers
    req.tenant = { ...tenant };
    req.tenantId = tenant.id;

    next();
  };
}
```

**Key Security Features**:

- **API key format validation** (before DB query)
- **Tenant lookup by public key** (not ID - prevents enumeration)
- **Active status check** (prevents access to disabled tenants)
- **Request attachment** (makes tenantId available to all route handlers)

### 4.2 Tenant Isolation Patterns in Repositories

**Scoped Queries** - All repository methods receive `tenantId`:

```typescript
// ✓ CORRECT - tenantId scoped
async findAll(tenantId: string): Promise<Booking[]> {
  return await this.prisma.booking.findMany({
    where: { tenantId },  // Required filter
    orderBy: { createdAt: 'desc' },
  });
}

// ✓ CORRECT - composite key with tenantId
async getPackageBySlug(tenantId: string, slug: string) {
  return await this.prisma.package.findUnique({
    where: { tenantId_slug: { tenantId, slug } },
  });
}
```

**Foreign Key Cascade** - Prevents orphaned data:

```prisma
model Package {
  tenantId String
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

When tenant is deleted, all packages, add-ons, bookings cascade delete automatically.

### 4.3 Tenant Context Types

```typescript
// Extended Express Request with tenant context
export interface TenantRequest extends Request {
  tenant?: {
    id: string;
    slug: string;
    name: string;
    commissionPercent: number;
    branding: any; // Presentation config
    stripeAccountId: string | null;
    stripeOnboarded: boolean;
  };
  tenantId?: string; // Shortcut for common case
}

// Helpers for type-safe extraction
export function getTenantId(req: TenantRequest): string {
  if (!req.tenantId) throw new Error('Tenant ID not found');
  return req.tenantId;
}

export function getTenant(req: TenantRequest): NonNullable<TenantRequest['tenant']> {
  if (!req.tenant) throw new Error('Tenant not found');
  return req.tenant;
}
```

---

## 5. Migration History & Patterns

### 5.1 Migration Timeline

**Location**: `/Users/mikeyoung/CODING/Elope/server/prisma/migrations/`

1. **`00_supabase_reset.sql`** - Initial database setup
2. **`01_add_webhook_events.sql`** - Webhook tracking for idempotency
3. **`02_add_performance_indexes.sql`** - Query optimization
4. **`03_add_multi_tenancy.sql`** - **Major migration** to multi-tenant
5. **`20251016140827_initial_schema/migration.sql`** - Prisma-managed initial schema
6. **`20251023152454_add_password_hash/migration.sql`** - Add tenant admin auth

### 5.2 Multi-Tenancy Migration Strategy

**File**: `03_add_multi_tenancy.sql` (280 lines)

**10-Step Process**:

```sql
-- Step 1: Create Tenant table with authentication & Stripe fields
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "email" TEXT UNIQUE,                      -- Tenant admin login
  "passwordHash" TEXT,
  "apiKeyPublic" TEXT NOT NULL UNIQUE,      -- Widget authentication
  "apiKeySecret" TEXT NOT NULL,             -- Server-side only
  "commissionPercent" DECIMAL(5,2) DEFAULT 10.0,
  "branding" JSONB DEFAULT '{}',            -- Presentation config
  "stripeAccountId" TEXT UNIQUE,            -- Stripe Connect
  "stripeOnboarded" BOOLEAN DEFAULT false,
  "secrets" JSONB DEFAULT '{}',             -- Encrypted storage
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) DEFAULT NOW()
);

-- Step 2: Create legacy default tenant
-- Ensures existing data migration doesn't break

-- Step 3: Add tenantId columns (nullable initially)
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "AddOn" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
-- ... etc for other tables

-- Step 4: Backfill existing records with default tenant
UPDATE "Package" SET "tenantId" = 'tenant_default_legacy' WHERE "tenantId" IS NULL;
UPDATE "Booking" SET "tenantId" = 'tenant_default_legacy' WHERE "tenantId" IS NULL;
-- ... etc

-- Step 5: Make tenantId NOT NULL
ALTER TABLE "Package" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "tenantId" SET NOT NULL;
-- ... etc

-- Step 6: Drop old unique constraints (before composite ones)
ALTER TABLE "Package" DROP CONSTRAINT "Package_slug_key";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_date_key";
-- ... etc

-- Step 7: Add composite unique constraints
ALTER TABLE "Package"
  ADD CONSTRAINT "Package_tenantId_slug_key" UNIQUE ("tenantId", "slug");
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_tenantId_date_key" UNIQUE ("tenantId", "date");
-- ... etc

-- Step 8: Add foreign key constraints with CASCADE delete
ALTER TABLE "Package"
  ADD CONSTRAINT "Package_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
-- ... etc

-- Step 9: Add performance indexes for tenant-scoped queries
CREATE INDEX "Package_tenantId_active_idx" ON "Package"("tenantId", "active");
CREATE INDEX "Booking_tenantId_status_idx" ON "Booking"("tenantId", "status");
-- ... etc

-- Step 10: Verification queries (informational)
-- Count tenants created, check for orphaned records
```

**Why This Pattern?**

1. **Backward Compatibility**: Legacy tenant allows data to work immediately
2. **Safe Rollout**: Nullable columns added first, made required after backfill
3. **Data Integrity**: Foreign keys added after all data migrated
4. **Performance**: Indexes created after constraints (cheaper)
5. **Verification**: Final checks ensure no orphaned data

---

## 6. Branding & Theme Configuration Storage

### 6.1 Storage Architecture

**Database Storage**:

```prisma
model Tenant {
  branding Json @default("{}")  // JSONB field in PostgreSQL
}
```

**Config Structure**:

```json
{
  "primaryColor": "#8B7355", // Brand primary color
  "secondaryColor": "#D4A574", // Brand secondary color
  "fontFamily": "Playfair Display", // Google Font name
  "logo": "https://cdn.example.com/logo.png" // Logo URL
}
```

### 6.2 Branding Flow

**Server-Side** (Tenant Admin Dashboard):

```typescript
// Update branding (in tenant-admin.controller.ts)
async updateBranding(req: TenantRequest, data: UpdateBrandingInput) {
  return await tenantRepo.update(req.tenantId!, {
    branding: {
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      fontFamily: data.fontFamily,
      logo: data.logoUrl,
    }
  });
}
```

**Client-Side** (Widget/Embeddable):

```typescript
// 1. Fetch branding from server
const { data: branding } = await useQuery({
  queryKey: ['tenant', 'branding'],
  queryFn: () => api.getTenantBranding(),
  staleTime: 5 * 60 * 1000, // Cache 5 minutes
});

// 2. Apply CSS variables
if (branding) {
  document.documentElement.style.setProperty('--color-primary', branding.primaryColor);
  document.documentElement.style.setProperty('--color-secondary', branding.secondaryColor);
}

// 3. Load Google Font dynamically
loadGoogleFont(branding.fontFamily);
```

### 6.3 Why JSONB vs. Separate Tables?

**JSONB Approach** (Current):

- ✓ No schema migration for new properties
- ✓ Tenant-scoped (one config per tenant)
- ✓ Query-efficient (JSONB indexes available)
- ✓ Handles versioning naturally (old config coexists)

**Alternative Approaches NOT Used**:

1. **Separate BrandingConfig Table** → Requires migration per new property
2. **NoSQL Store** → Abandons ACID guarantees
3. **Configuration Service** → Extra operational complexity

**Trade-off**: JSONB loses some schema validation but gains flexibility for presentation concerns.

---

## 7. Coupling Analysis

### 7.1 Clean Separation Points

**STRONG SEPARATION**:

1. **Entities (lib/entities.ts)** ← Domain models (no Prisma references)
2. **Ports (lib/ports.ts)** ← Interface contracts (no implementation)
3. **Adapters (adapters/prisma/)** ← Prisma implementations (no business logic)
4. **Services (services/)** ← Orchestration (uses ports, not adapters directly)

**Example Flow**:

```
API Request
  ↓
Route Handler (uses TenantRequest middleware)
  ↓
Service (CatalogService, BookingService, etc.)
  ↓
Repository Port (CatalogRepository interface)
  ↓
Prisma Adapter (implements CatalogRepository)
  ↓
Database Query (scoped by tenantId)
```

### 7.2 Potential Coupling Issues

**Minor - Booking Add-Ons**:

```typescript
// Domain entity doesn't include full AddOn details
export interface Booking {
  addOnIds: string[];  // Only IDs stored
}

// Repository must join to get details
async getUnavailableDates(tenantId, startDate, endDate) {
  // Only fetches date, not add-on details
  return bookings.map(b => b.date);
}
```

This is intentional - keeps Booking model lightweight.

**Minor - Customer Model Not in Domain**:

```typescript
// Booking stores customerEmail/coupleName, not Customer relation
export interface Booking {
  coupleName: string;
  email: string;
  phone?: string;
}

// Repository maps from Prisma Customer model
private toDomainBooking(booking: {
  customer: { name: string; email: string; phone: string | null };
}): Booking {
  return {
    coupleName: booking.customer.name,
    email: booking.customer.email,
  };
}
```

This keeps domain model simple (email + name vs. separate entity).

### 7.3 Strong Coupling Avoidance

**Middleware ↔ Domain Entities**:

- ✓ TenantRequest is Express-specific (only in middleware layer)
- ✓ Services don't import from Express
- ✓ Tenant data passed as plain `tenantId` parameter

**Prisma ↔ Domain Logic**:

- ✓ Services never import from Prisma directly
- ✓ Mappers translate Prisma models to domain entities
- ✓ Database errors caught and converted to domain errors

**Presentation ↔ Business Logic**:

- ✓ Branding stored separately in Tenant model
- ✓ Business calculations (pricing, commission) never depend on branding
- ✓ Client fetches branding independently via API

---

## 8. Key Design Patterns

### 8.1 Composite Unique Constraints for Multi-Tenancy

```prisma
// Pattern: (tenantId, businessKey) unique
@@unique([tenantId, slug])      // Package, AddOn
@@unique([tenantId, date])      // Booking, BlackoutDate
@@index([tenantId, status])     // Optimized queries
```

**Why This Works**:

- Prevents cross-tenant ID collisions naturally
- Database-enforced (no application logic needed)
- Enables efficient queries with tenant scoping

### 8.2 Port-Based Architecture for Testability

```typescript
// ports.ts defines interface
export interface CatalogRepository {
  getAllPackages(tenantId: string): Promise<Package[]>;
}

// Prisma adapter implements for production
export class PrismaCatalogRepository implements CatalogRepository { ... }

// Mock adapter exists for testing
export class MockCatalogRepository implements CatalogRepository { ... }
```

**Benefit**: Services don't care if they use Prisma or in-memory mock.

### 8.3 Tenant Scoping at Every Layer

```
Request → Middleware extracts tenantId from API key
  ↓
Route Handler receives req.tenantId
  ↓
Service receives tenantId as parameter
  ↓
Repository receives tenantId, filters ALL queries
  ↓
Database: Composite constraints prevent cross-tenant reads
```

No single point of failure for tenant isolation.

### 8.4 Transaction-Based Race Condition Prevention

```typescript
// SERIALIZABLE isolation + pessimistic lock
await prisma.$transaction(
  async (tx) => {
    // Lock row before checking existence
    await tx.$queryRawUnsafe(
      'SELECT 1 FROM "Booking" WHERE "tenantId" = $1 AND date = $2 FOR UPDATE NOWAIT'
    );

    // Check after lock acquired
    const existing = await tx.booking.findFirst({ ... });

    // Create in same transaction
    await tx.booking.create({ ... });
  },
  { timeout: 5000, isolationLevel: 'Serializable' }
);
```

Three-layer defense:

1. Lock prevents concurrent access
2. Check before creation
3. Unique constraint as ultimate safeguard

---

## 9. Configuration & Environment

### 9.1 Database Connection

**Prisma Configuration**:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // For migrations
}
```

**Why Two URLs?**

- `DATABASE_URL`: Used by application (can be connection pool)
- `DIRECT_URL`: Used by migrations (direct connection needed)

### 9.2 Generated Client

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}
```

Type-safe client generated to `/Users/mikeyoung/CODING/Elope/server/src/generated/prisma/`

---

## 10. Recommendations & Summary

### 10.1 Strengths

✓ **Clear separation**: Ports → Adapters → Repositories  
✓ **Tenant isolation**: Middleware + composite constraints + scoped queries  
✓ **Multi-layer race condition prevention**: Lock + check + constraint  
✓ **Presentation separation**: JSONB branding decoupled from business logic  
✓ **Type safety**: Prisma generates types, domain entities separate  
✓ **Audit trail**: Commission snapshot stored with booking

### 10.2 Areas for Enhancement

1. **Photo Management** - Currently stored as JSON array; consider separate table if versioning needed
2. **Webhook Event Deduplication** - Consider TTL index to clean old processed events
3. **Commission History** - Audit log of commission rate changes per tenant
4. **Branding Versioning** - Track branding config changes over time

### 10.3 Multi-Tenant Isolation Checklist

- ✓ API key validation (tenant identification)
- ✓ tenantId parameter on all repository methods
- ✓ Composite unique constraints (database-level enforcement)
- ✓ Foreign key cascade delete (data cleanup)
- ✓ Middleware extraction of tenantId
- ✓ Type-safe tenant context (TenantRequest interface)
- ✓ Performance indexes on tenant-scoped queries
- ✓ Commission tracking (platform accounting)

---

## Conclusion

Elope demonstrates **production-grade database architecture** with:

- Clear business logic separation via ports and domain entities
- Robust multi-tenant isolation at database, middleware, and service layers
- Flexible presentation configuration (JSONB branding) independent of core models
- Strategic use of composite constraints and indexes for data integrity and performance
- Comprehensive migration strategy enabling safe multi-tenant transformation

The separation of concerns is intentional and enforced at each layer, making the codebase maintainable and scalable for multi-tenant operations.
