# Database Layer Architecture - Quick Reference

## Model Separation Overview

```
BUSINESS LOGIC LAYER (Domain Entities)
├── lib/entities.ts
│   ├── Package { id, tenantId, slug, title, priceCents, photos }
│   ├── AddOn { id, packageId, title, priceCents }
│   ├── Booking { id, packageId, coupleName, email, eventDate, totalCents }
│   └── Blackout { date, reason }
│
PERSISTENCE LAYER (Prisma Adapters)
├── adapters/prisma/catalog.repository.ts
│   └── implements CatalogRepository (from ports.ts)
├── adapters/prisma/booking.repository.ts
│   └── implements BookingRepository (with 3-layer concurrency control)
└── adapters/prisma/tenant.repository.ts
    └── handles multi-tenant configuration

PRESENTATION LAYER (Tenant Model)
└── Tenant.branding (JSONB)
    ├── primaryColor: "#8B7355"
    ├── secondaryColor: "#D4A574"
    ├── fontFamily: "Playfair Display"
    └── logo: "https://..."
```

## Tenant Isolation Pattern

```
Request with X-Tenant-Key Header
│
├─ resolveTenant() Middleware
│  ├─ Validate API key format
│  ├─ Lookup Tenant by apiKeyPublic
│  └─ Attach tenant to req.tenant
│
├─ Route Handler
│  └─ Access req.tenantId
│
└─ Repository Methods (ALL receive tenantId parameter)
   ├─ getAllPackages(tenantId)
   ├─ getPackageBySlug(tenantId, slug)
   └─ getUnavailableDates(tenantId, startDate, endDate)
      │
      └─ Database WHERE clause: { tenantId }
         │
         └─ Composite Unique Constraints
            ├─ Package: (tenantId, slug)
            ├─ Booking: (tenantId, date)
            └─ BlackoutDate: (tenantId, date)
```

## Critical Constraints

| Model            | Constraint                | Purpose                             |
| ---------------- | ------------------------- | ----------------------------------- |
| **Tenant**       | `slug` unique             | URL identifier                      |
| **Tenant**       | `apiKeyPublic` unique     | Widget authentication               |
| **Package**      | `(tenantId, slug)` unique | Prevent cross-tenant slug collision |
| **AddOn**        | `(tenantId, slug)` unique | Prevent cross-tenant slug collision |
| **Booking**      | `(tenantId, date)` unique | **One booking per date per tenant** |
| **BlackoutDate** | `(tenantId, date)` unique | No duplicate blackout dates         |

## Performance Indexes

| Model            | Indexes                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Tenant**       | slug, apiKeyPublic, isActive                                                                                           |
| **Package**      | (tenantId, active), tenantId                                                                                           |
| **Booking**      | (tenantId, status), (tenantId, date), (tenantId, status, date), tenantId, customerId, stripePaymentIntentId, createdAt |
| **WebhookEvent** | (tenantId, status), (tenantId, createdAt), tenantId, eventId, status, (status, createdAt)                              |

## Double-Booking Prevention (3 Layers)

```
Layer 1: DATABASE CONSTRAINT
  @@unique([tenantId, date])
  └─ PostgreSQL enforces at insert time

Layer 2: PESSIMISTIC LOCK (Transaction Level)
  SELECT 1 FROM "Booking"
  WHERE "tenantId" = $1 AND date = $2
  FOR UPDATE NOWAIT
  └─ SERIALIZABLE isolation prevents phantom reads
  └─ NOWAIT fails fast on contention

Layer 3: APPLICATION CHECK (Pre-Creation)
  const existing = await tx.booking.findFirst({
    where: { tenantId, date }
  })
  if (existing) throw BookingConflictError
  └─ Catches edge cases before insert

Result: Race condition impossible
```

## Commission Model (Multi-Tenant)

```
Booking Record Stores:
├─ totalPrice: 15000 (cents)        ← Package + add-ons (customer pays)
├─ commissionAmount: 1500           ← Platform cut (10% of 15000)
└─ commissionPercent: 10.0          ← Snapshot of rate at booking time

Calculation Flow:
1. CommissionService reads Tenant.commissionPercent
2. Calculates: totalPrice * (rate / 100)
3. Rounds UP to protect platform revenue
4. Stores both amount and rate (for audit trail)
5. Snapshot prevents retroactive changes
```

## Branding Storage Strategy

```
JSONB Field Benefits:
✓ Schema-flexible (add properties without migration)
✓ Tenant-scoped (each tenant independent config)
✓ Query-optimized (JSONB operators available)
✓ Version-compatible (partial config works)

Example Branding Object:
{
  "primaryColor": "#8B7355",
  "secondaryColor": "#D4A574",
  "fontFamily": "Playfair Display",
  "logo": "https://cdn.example.com/logo.png"
}

Client Integration:
1. useBranding() hook fetches from API
2. React Query caches for 5 minutes
3. CSS variables applied to document root
4. Google Font loaded dynamically
5. Independent from business logic
```

## Migration Pattern (Multi-Tenancy Example)

```
Step 1: Create Tenant table (with auth, stripe, branding)
Step 2: Create default legacy tenant (for data migration)
Step 3: Add tenantId columns (nullable to existing tables)
Step 4: Backfill existing records with default tenant
Step 5: Make tenantId NOT NULL
Step 6: Drop old unique constraints
Step 7: Add composite unique constraints (tenantId + key)
Step 8: Add foreign key constraints with CASCADE delete
Step 9: Add performance indexes
Step 10: Verify (check for orphaned records)

Result: Zero downtime transformation from single → multi-tenant
```

## Repository Interface Pattern

```
Port (Contract) - lib/ports.ts
├─ CatalogRepository
│  └─ getAllPackages(tenantId): Promise<Package[]>
│
├─ BookingRepository
│  ├─ create(tenantId, booking)
│  ├─ findById(tenantId, id)
│  ├─ getUnavailableDates(tenantId, startDate, endDate)
│  └─ isDateBooked(tenantId, date)
│
└─ BlackoutRepository
   ├─ isBlackoutDate(tenantId, date)
   ├─ getAllBlackouts(tenantId)
   └─ addBlackout(tenantId, date, reason)

Adapters (Implementation)
├─ PrismaCatalogRepository implements CatalogRepository
├─ PrismaBookingRepository implements BookingRepository
│  └─ Uses Serializable transactions + FOR UPDATE locks
└─ PrismaBlackoutRepository implements BlackoutRepository

Mappers (Prisma Model → Domain Entity)
├─ toDomainPackage(prismaModel): Package
├─ toDomainBooking(prismaModel): Booking
└─ Converts Prisma types to domain entity interface
```

## Tenant Isolation Verification Checklist

- [x] API key validation before database lookup
- [x] tenantId extracted from API key in middleware
- [x] All repository methods receive tenantId parameter
- [x] All database queries include tenantId filter
- [x] Composite unique constraints enforce isolation
- [x] Foreign key cascade delete prevents orphans
- [x] TenantRequest interface for type-safe context
- [x] Helper functions (getTenantId, getTenant) for extraction
- [x] Middleware applies to protected routes
- [x] Performance indexes on tenant-scoped queries

## Cross-Tenant Data Access: IMPOSSIBLE

```
Request to GET /api/v1/packages with wrong API key
│
├─ resolveTenant() middleware
│  └─ Tenant A's API key → resolves to Tenant A only
│
├─ Route handler
│  └─ calls catalogService.getAllPackages(tenantIdA)
│
├─ Repository
│  └─ await prisma.package.findMany({
│       where: { tenantId: tenantIdA }  ← Only Tenant A's packages
│     })
│
└─ Result: Can only access Tenant A's data
           Cannot see Tenant B's packages (no tenantId filter for B)
           Cannot enumerate other tenants (API key lookup is unique)
```

## Configuration Files

| File                                                | Purpose                         |
| --------------------------------------------------- | ------------------------------- |
| `server/prisma/schema.prisma`                       | Prisma schema with all models   |
| `server/src/lib/entities.ts`                        | Domain entity interfaces        |
| `server/src/lib/ports.ts`                           | Repository & provider contracts |
| `server/src/adapters/prisma/*.ts`                   | Repository implementations      |
| `server/src/middleware/tenant.ts`                   | Tenant resolution & extraction  |
| `server/prisma/migrations/03_add_multi_tenancy.sql` | Migration to multi-tenant       |

## Key Takeaways

1. **Separation of Concerns**: Domain entities (lib/) separate from persistence (adapters/)
2. **Port-Based Architecture**: Services depend on interfaces, not implementations
3. **Tenant Isolation**: Middleware → Repository → Database (3-layer enforcement)
4. **Composite Keys**: `(tenantId, businessKey)` prevents cross-tenant collisions
5. **Presentation Config**: JSONB branding independent from business logic
6. **Concurrency Safety**: 3-layer defense (lock + check + constraint) for bookings
7. **Migration Pattern**: Safe, reversible transformation documented in SQL
8. **Type Safety**: Prisma generates types, domain interfaces are separate
9. **Performance**: Strategic indexes on frequently queried (tenantId, status/date) pairs
10. **Audit Trail**: Commission snapshot stored with each booking
