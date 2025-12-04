# Database Layer - Code References & Locations

## File Structure

```
server/
├── prisma/
│   ├── schema.prisma                           (Prisma schema definition)
│   └── migrations/
│       ├── 00_supabase_reset.sql              (Initial setup)
│       ├── 01_add_webhook_events.sql          (Webhook support)
│       ├── 02_add_performance_indexes.sql     (Query optimization)
│       ├── 03_add_multi_tenancy.sql           (Multi-tenant transformation)
│       ├── 20251016140827_initial_schema/     (Prisma-managed initial)
│       └── 20251023152454_add_password_hash/  (Tenant admin auth)
│
├── src/
│   ├── lib/
│   │   ├── entities.ts                        (Domain entity interfaces)
│   │   ├── ports.ts                           (Repository port interfaces)
│   │   └── errors.ts                          (Domain-specific errors)
│   │
│   ├── adapters/
│   │   ├── prisma/
│   │   │   ├── index.ts                       (Adapter exports)
│   │   │   ├── catalog.repository.ts          (Package & AddOn CRUD)
│   │   │   ├── booking.repository.ts          (Booking with 3-layer race control)
│   │   │   ├── tenant.repository.ts           (Tenant management)
│   │   │   ├── user.repository.ts             (User authentication)
│   │   │   ├── blackout.repository.ts         (Blackout date management)
│   │   │   └── webhook.repository.ts          (Webhook event tracking)
│   │   │
│   │   └── lib/
│   │       └── entities.ts                    (Adapter-specific types)
│   │
│   ├── middleware/
│   │   └── tenant.ts                          (Tenant resolution & extraction)
│   │
│   └── generated/
│       └── prisma/                            (Generated Prisma types)
```

---

## Critical Files - Line References

### 1. Prisma Schema

**File**: `/Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma`

**Key Sections**:

| Lines   | Content                                                        |
| ------- | -------------------------------------------------------------- |
| 9-12    | Database configuration (PostgreSQL, pooling)                   |
| 15-27   | User model (authentication)                                    |
| 29-34   | UserRole enum                                                  |
| 36-81   | **Tenant model** (root multi-tenant entity)                    |
| 106-129 | **Package model** with composite constraints                   |
| 131-148 | **AddOn model** with composite constraints                     |
| 159-198 | **Booking model** - CRITICAL for race condition prevention     |
| 190     | `@@unique([tenantId, date])` - One booking per date per tenant |
| 240-251 | **BlackoutDate model** with tenant isolation                   |
| 253-272 | **WebhookEvent model** with deduplication                      |

### 2. Domain Entities

**File**: `/Users/mikeyoung/CODING/Elope/server/src/lib/entities.ts`

**Key Sections**:

| Lines | Content                                  |
| ----- | ---------------------------------------- |
| 9-18  | Package interface (domain model)         |
| 20-26 | AddOn interface (domain model)           |
| 32-45 | Booking interface with commission fields |
| 50-56 | CreateBookingInput DTO                   |
| 62-65 | Blackout entity                          |

### 3. Repository Ports (Contracts)

**File**: `/Users/mikeyoung/CODING/Elope/server/src/lib/ports.ts`

**Key Interfaces**:

| Lines  | Content                                               |
| ------ | ----------------------------------------------------- |
| 15-27  | **CatalogRepository** - Package & AddOn CRUD contract |
| 32-38  | **BookingRepository** - Booking operations contract   |
| 43-49  | **BlackoutRepository** - Blackout date contract       |
| 61-71  | **WebhookRepository** - Webhook event tracking        |
| 80-82  | **CalendarProvider** - External calendar integration  |
| 88-105 | **PaymentProvider** - Stripe integration contract     |

**Key Pattern**: All methods include `tenantId` parameter for scoping.

### 4. Catalog Repository Adapter

**File**: `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/catalog.repository.ts`

**Key Methods**:

| Lines   | Method                              | Purpose                               |
| ------- | ----------------------------------- | ------------------------------------- |
| 19-26   | `getAllPackages(tenantId)`          | Fetch all packages for tenant         |
| 52-58   | `getPackageBySlug(tenantId, slug)`  | Use composite key: `tenantId_slug`    |
| 60-66   | `getPackageById(tenantId, id)`      | Scoped findFirst with tenantId filter |
| 91-112  | `createPackage(tenantId, data)`     | Validate uniqueness within tenant     |
| 114-147 | `updatePackage(tenantId, id, data)` | Verify ownership before update        |
| 268-289 | `toDomainPackage()`                 | Mapper: Prisma model → Domain entity  |

**Isolation Pattern**:

- Line 54: `where: { tenantId_slug: { tenantId, slug } }`
- Line 94: Composite key check before creation
- Line 116: `findFirst` with tenantId filter

### 5. Booking Repository - Advanced Concurrency

**File**: `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/booking.repository.ts`

**3-Layer Race Condition Prevention**:

| Lines   | Layer                         | Mechanism                           |
| ------- | ----------------------------- | ----------------------------------- |
| 14-15   | Config                        | Timeout & isolation level constants |
| 68-180  | **Layer 1: Pessimistic Lock** | FOR UPDATE NOWAIT                   |
| 72-76   | Lock query                    | Raw SQL with tenantId scoping       |
| 84      | Lock error                    | P2034 timeout detection             |
| 102-109 | **Layer 2: Check**            | findFirst before creation           |
| 138-163 | **Layer 3: Create**           | Insert with all relationships       |
| 166-169 | Transaction config            | 5s timeout, SERIALIZABLE isolation  |
| 171-180 | **Fallback**                  | P2002 unique constraint catch       |

**Critical Queries**:

```typescript
// Line 72-76: Pessimistic lock
const lockQuery = `
  SELECT 1 FROM "Booking"
  WHERE "tenantId" = $1 AND date = $2
  FOR UPDATE NOWAIT
`;

// Line 102-109: Pre-creation check
const existing = await tx.booking.findFirst({
  where: { tenantId, date: new Date(booking.eventDate) }
});

// Line 289-310: Availability check (tenant-scoped)
async getUnavailableDates(tenantId, startDate, endDate) {
  where: {
    tenantId,
    date: { gte: startDate, lte: endDate },
    status: { in: ['CONFIRMED', 'PENDING'] }
  }
}
```

### 6. Tenant Repository

**File**: `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/tenant.repository.ts`

**Key Methods**:

| Lines   | Method                 | Purpose                           |
| ------- | ---------------------- | --------------------------------- |
| 41-45   | `findByApiKey(apiKey)` | Look up tenant by public API key  |
| 53-57   | `findById(id)`         | Direct lookup by tenant ID        |
| 65-69   | `findBySlug(slug)`     | Look up by URL-safe identifier    |
| 78-82   | `findByEmail(email)`   | Tenant admin authentication       |
| 110-115 | `update(id, data)`     | Update tenant configuration       |
| 149-176 | `getStats(id)`         | Booking/package counts for tenant |

**Branding Update Pattern** (Line 110-115):

```typescript
async update(id: string, data: UpdateTenantInput): Promise<Tenant> {
  return await this.prisma.tenant.update({
    where: { id },
    data: {
      branding: data.branding,  // JSONB update
      // ... other fields
    }
  });
}
```

### 7. Blackout Repository

**File**: `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/blackout.repository.ts`

**Key Methods**:

| Lines | Method                                | Tenant Scoping                  |
| ----- | ------------------------------------- | ------------------------------- |
| 12-18 | `isBlackoutDate(tenantId, date)`      | Composite key: `tenantId_date`  |
| 20-30 | `getAllBlackouts(tenantId)`           | Where filter by tenantId        |
| 32-40 | `addBlackout(tenantId, date, reason)` | Create with tenantId            |
| 42-56 | `findBlackoutById(tenantId, id)`      | Composite filter: id + tenantId |
| 58-62 | `deleteBlackout(tenantId, id)`        | deleteMany with both filters    |

**Line 60**: Using `deleteMany` instead of `delete` ensures tenant isolation.

### 8. Webhook Repository

**File**: `/Users/mikeyoung/CODING/Elope/server/src/adapters/prisma/webhook.repository.ts`

**Idempotency Pattern**:

| Lines   | Method                                 | Purpose                                  |
| ------- | -------------------------------------- | ---------------------------------------- |
| 34-60   | `isDuplicate(tenantId, eventId)`       | Check if already processed               |
| 40-44   | Tenant verification                    | Ensure webhook belongs to correct tenant |
| 84-121  | `recordWebhook(input)`                 | Insert with deduplication handling       |
| 104-108 | Duplicate handling                     | Graceful P2002 error handling            |
| 139-149 | `markProcessed(tenantId, eventId)`     | Update status to PROCESSED               |
| 172-183 | `markFailed(tenantId, eventId, error)` | Update with error message                |

**Key Pattern** (Line 41-44):

```typescript
// Verify webhook belongs to tenant
if (existing.tenantId !== tenantId) {
  logger.warn(
    { eventId, expectedTenant: tenantId, actualTenant: existing.tenantId },
    'Webhook tenant mismatch'
  );
  return false; // Not a duplicate for this tenant
}
```

### 9. Tenant Middleware

**File**: `/Users/mikeyoung/CODING/Elope/server/src/middleware/tenant.ts`

**Tenant Resolution Pipeline**:

| Lines   | Step                       | Purpose                                      |
| ------- | -------------------------- | -------------------------------------------- |
| 10-23   | TenantRequest interface    | Extended Express Request with tenant context |
| 55-155  | `resolveTenant(prisma)`    | Middleware factory function                  |
| 61-72   | Header extraction          | Get X-Tenant-Key header                      |
| 74-83   | Format validation          | Validate before DB lookup                    |
| 86-110  | Tenant lookup              | Query by apiKeyPublic unique constraint      |
| 112-124 | Active check               | Verify isActive flag                         |
| 126-136 | Request attachment         | Attach tenant to req.tenant & req.tenantId   |
| 172-187 | `requireTenant()`          | Ensure tenant was resolved                   |
| 200-227 | `requireStripeOnboarded()` | Verify payment readiness                     |
| 236-241 | `getTenantId(req)`         | Type-safe extraction helper                  |
| 250-255 | `getTenant(req)`           | Full tenant object extraction helper         |

**Critical Lines**:

- Line 87: `findUnique` by apiKeyPublic (unique lookup)
- Line 94: Select branding field for presentation config
- Line 131: Convert decimal to number: `Number(tenant.commissionPercent)`

### 10. Multi-Tenancy Migration

**File**: `/Users/mikeyoung/CODING/Elope/server/prisma/migrations/03_add_multi_tenancy.sql`

**10-Step Migration Pattern**:

| Lines   | Step                      | Purpose                                     |
| ------- | ------------------------- | ------------------------------------------- |
| 10-24   | Create Tenant table       | Root multi-tenant entity with auth & Stripe |
| 34-63   | Create default tenant     | Data backward compatibility                 |
| 68-100  | Add tenantId columns      | Nullable to existing tables                 |
| 105-125 | Backfill with default     | Populate existing records                   |
| 130-145 | Make NOT NULL             | Lock down requirement                       |
| 150-165 | Drop old constraints      | Remove single-tenant constraints            |
| 170-189 | Add composite constraints | (tenantId, businessKey) unique              |
| 194-218 | Add foreign keys          | CASCADE delete for cleanup                  |
| 222-246 | Add indexes               | Performance optimization                    |
| 252-275 | Verification              | Ensure data integrity                       |

**Key Migration Concepts**:

- **Idempotent**: Uses IF NOT EXISTS, IF statement checks
- **Reversible**: Drop constraints before adding new ones
- **Safe**: Nullable columns added before making required
- **Verified**: Final queries check for orphaned records

---

## Cross-References: How Features Use Database Layer

### Catalog Feature

1. **Request**: GET `/api/v1/catalog/{slug}`
2. **Middleware**: `resolveTenant()` extracts tenantId from X-Tenant-Key
3. **Service**: `CatalogService.getPackageBySlug(tenantId, slug)`
4. **Repository**: `CatalogRepository.getPackageBySlug(tenantId, slug)`
   - File: `catalog.repository.ts` Line 52-58
   - Query: Composite key `{ tenantId_slug: { tenantId, slug } }`
5. **Database**: Lookup uses composite unique constraint
6. **Return**: Domain entity (Package)

### Booking Feature (Critical Path)

1. **Request**: POST `/api/v1/bookings`
2. **Middleware**: Tenant resolution + Stripe onboarding check
3. **Service**: `BookingService.createBooking(tenantId, ...)`
4. **Repository**: `BookingRepository.create(tenantId, booking)`
   - File: `booking.repository.ts` Line 68-180
   - **Layer 1 (Line 72-76)**: Pessimistic lock
   - **Layer 2 (Line 102-109)**: Check existing
   - **Layer 3 (Line 138-163)**: Create in transaction
5. **Database**:
   - Unique constraint: `(tenantId, date)`
   - Isolation: SERIALIZABLE
   - Timeout: 5 seconds
6. **Return**: Domain entity (Booking) with timestamps

### Branding Feature

1. **Request**: GET `/api/v1/branding` (client-side)
2. **Middleware**: Tenant resolution (extracts from API key)
3. **Service**: `BrandingService.getBranding(tenantId)`
4. **Repository**: `TenantRepository.findById(tenantId)`
   - File: `tenant.repository.ts` Line 53-57
   - Selects: branding field (JSONB)
5. **Database**: Single query, returns Tenant with branding
6. **Client**: `useBranding()` hook applies CSS variables

---

## Environment Configuration

**Location**: `.env` (not in repo, requires setup)

```bash
# Database
DATABASE_URL="postgresql://..."          # Connection pool URL
DIRECT_URL="postgresql://..."            # Direct connection for migrations

# Stripe
STRIPE_SECRET_KEY="sk_..."               # Live or test
STRIPE_WEBHOOK_SECRET="whsec_..."
```

**Prisma Usage**:

- Development: `npx prisma studio` opens DB UI
- Migrations: `npx prisma migrate deploy`
- Codegen: `npx prisma generate`

---

## Testing & Mocks

**Mock Adapter Location**: `server/src/adapters/mock/`

**Pattern**:

- Real adapters (Prisma) implement `RepositoryPort`
- Mock adapters (in-memory) also implement same port
- DI (dependency injection) switches based on environment
- Services don't depend on specific implementation

**Example**:

```typescript
// di.ts
const catalogRepository = env.USE_MOCK_ADAPTERS
  ? new MockCatalogRepository()
  : new PrismaCatalogRepository(prisma);
```

---

## Performance Considerations

### Index Strategy

**Composite Indexes** (tenant-scoped queries):

- `Package(tenantId, active)` - Most frequently queried
- `Booking(tenantId, status)` - Filter by confirmation status
- `Booking(tenantId, date)` - Availability checks
- `Booking(tenantId, status, date)` - Combined filtering

**Single Indexes** (lookups):

- `Tenant(apiKeyPublic)` - API key resolution
- `Tenant(slug)` - URL lookups
- `Booking(stripePaymentIntentId)` - Payment reconciliation

### N+1 Query Prevention

**Repository Patterns**:

- `getAllPackagesWithAddOns()` - Includes add-ons in single query
- `findById(tenantId, id)` - Includes customer, add-ons
- Explicit `include` in findMany calls

---

## Security Checkpoints

1. **API Key Validation**
   - File: `middleware/tenant.ts` Line 74-83
   - Format validation before database lookup

2. **Tenant Isolation**
   - File: All repositories
   - tenantId parameter on every method
   - WHERE clause filters on all queries

3. **Unique Constraints**
   - File: `prisma/schema.prisma`
   - Database-level enforcement
   - Example: `@@unique([tenantId, date])`

4. **Commission Calculation**
   - File: `tenant.repository.ts` Line 149-176
   - Server-side only, never client-exposed
   - Snapshot stored for audit trail

5. **Webhook Verification**
   - File: `webhook.repository.ts` Line 34-60
   - Tenant ownership check (Line 40-44)
   - Idempotency via eventId uniqueness

---

## Summary

Key files for understanding database layer:

1. `server/prisma/schema.prisma` - Schema definition
2. `server/src/lib/entities.ts` - Domain contracts
3. `server/src/lib/ports.ts` - Repository contracts
4. `server/src/adapters/prisma/*.ts` - Implementations
5. `server/src/middleware/tenant.ts` - Tenant isolation enforcement
6. `server/prisma/migrations/03_add_multi_tenancy.sql` - Migration pattern

Total lines of analysis: See DATABASE_LAYER_ANALYSIS.md & DATABASE_LAYER_SUMMARY.md
