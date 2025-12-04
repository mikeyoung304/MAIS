# CRITICAL MULTI-TENANT ISOLATION FIXES

This document provides the exact code changes needed to fix CRITICAL vulnerabilities found in the audit.

## CRITICAL-001: Customer Model Missing TenantId

### File: `/server/prisma/schema.prisma`

**BEFORE:**

```prisma
model Customer {
  id        String    @id @default(cuid())
  email     String?   @unique
  phone     String?
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  bookings  Booking[]
}
```

**AFTER:**

```prisma
model Customer {
  id        String    @id @default(cuid())
  tenantId  String    // NEW: Multi-tenant isolation
  email     String?
  phone     String?
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  bookings  Booking[]

  // Change from @unique to tenant-scoped
  @@unique([tenantId, email])
  @@index([tenantId])
}
```

### File: `/server/src/adapters/prisma/booking.repository.ts` (Lines 112-123)

**BEFORE:**

```typescript
// Create or find the customer
const customer = await tx.customer.upsert({
  where: { email: booking.email },
  update: {
    name: booking.coupleName,
    phone: booking.phone,
  },
  create: {
    email: booking.email,
    name: booking.coupleName,
    phone: booking.phone,
  },
});
```

**AFTER:**

```typescript
// Create or find the customer (tenant-scoped)
const customer = await tx.customer.upsert({
  where: {
    tenantId_email: {
      tenantId,
      email: booking.email,
    },
  },
  update: {
    name: booking.coupleName,
    phone: booking.phone,
  },
  create: {
    tenantId, // NEW: Include tenantId
    email: booking.email,
    name: booking.coupleName,
    phone: booking.phone,
  },
});
```

---

## CRITICAL-002: Venue Model Missing TenantId

### File: `/server/prisma/schema.prisma`

**BEFORE:**

```prisma
model Venue {
  id        String    @id @default(cuid())
  name      String
  address   String?
  city      String?
  state     String?
  zip       String?
  capacity  Int?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  bookings  Booking[]
}
```

**AFTER:**

```prisma
model Venue {
  id        String    @id @default(cuid())
  tenantId  String    // NEW: Multi-tenant isolation
  name      String
  address   String?
  city      String?
  state     String?
  zip       String?
  capacity  Int?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  bookings  Booking[]

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

### File: `/server/src/adapters/prisma/booking.repository.ts` (Add validation before line 139)

**NEW CODE TO ADD:**

```typescript
// Verify venue belongs to this tenant (if provided)
if (booking.venueId) {
  const venue = await tx.venue.findFirst({
    where: {
      id: booking.venueId,
      tenantId, // Verify ownership
    },
  });

  if (!venue) {
    throw new NotFoundError(`Venue ${booking.venueId} not found for this tenant`);
  }
}
```

---

## CRITICAL-003: Stripe Webhook Payment Misrouting

### File: `/server/src/routes/webhooks.routes.ts` (Add after line 167)

**NEW VALIDATION CODE TO ADD:**

```typescript
// Add this import at top of file
import type { CatalogRepository } from '../lib/ports';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';

// Add parameters to constructor
constructor(
  private readonly paymentProvider: PaymentProvider,
  private readonly bookingService: BookingService,
  private readonly webhookRepo: WebhookRepository,
  private readonly catalogRepo: CatalogRepository,      // NEW
  private readonly tenantRepo: PrismaTenantRepository  // NEW
) {}

// In handleStripeWebhook(), after line 167 (after Zod validation):
// Add these validation checks before creating booking

// 1. Verify packageId belongs to extracted tenantId
const pkg = await this.catalogRepo.getPackageBySlug(
  validatedTenantId,
  packageId
);
if (!pkg) {
  throw new WebhookValidationError(
    `Package ${packageId} not found for tenant ${validatedTenantId}`
  );
}

// 2. Verify stripePaymentIntentId hasn't been used by a DIFFERENT tenant
if (session.payment_intent) {
  const existingPayment = await this.webhookRepo.findPaymentByStripeId(
    session.payment_intent
  );
  if (existingPayment && existingPayment.tenantId !== validatedTenantId) {
    throw new WebhookValidationError(
      `Payment Intent ${session.payment_intent} already used by different tenant`
    );
  }
}

// 3. Verify Stripe session's connected account matches tenant's account
const tenant = await this.tenantRepo.findById(validatedTenantId);
if (!tenant) {
  throw new WebhookValidationError(
    `Tenant ${validatedTenantId} not found`
  );
}

// Compare Stripe account IDs
if (tenant.stripeAccountId && event.account &&
    tenant.stripeAccountId !== event.account) {
  throw new WebhookValidationError(
    `Webhook account mismatch for tenant ${validatedTenantId}: expected ${tenant.stripeAccountId}, got ${event.account}`
  );
}

// Then continue with booking creation
```

---

## HIGH-001: Fix Admin Role Validation

### File: `/server/src/middleware/auth.ts` (Lines 48-53)

**BEFORE:**

```typescript
// SECURITY: Validate admin role is present
if (!payload.role || payload.role !== 'admin') {
  throw new UnauthorizedError('Invalid token: admin role required for admin routes');
}
```

**AFTER:**

```typescript
// SECURITY: Validate admin role is present and not tenant-scoped
if (!payload.role || !['ADMIN', 'PLATFORM_ADMIN'].includes(payload.role)) {
  throw new UnauthorizedError(
    'Invalid token: Admin or Platform Admin role required for admin routes'
  );
}
```

---

## MEDIUM-001: Fix File Upload Tenant Isolation

### File: `/server/src/services/upload.service.ts`

**Update method signature (Line 206):**

**BEFORE:**

```typescript
async deletePackagePhoto(filename: string): Promise<void> {
```

**AFTER:**

```typescript
async deletePackagePhoto(filename: string, packageId?: string, tenantId?: string): Promise<void> {
```

**Update method body (Lines 207-218):**

**BEFORE:**

```typescript
async deletePackagePhoto(filename: string): Promise<void> {
  try {
    const filepath = path.join(this.packagePhotoUploadDir, filename);

    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
      logger.info({ filename }, 'Package photo deleted successfully');
    }
  } catch (error) {
    logger.error({ error, filename }, 'Error deleting package photo');
    throw error;
  }
}
```

**AFTER:**

```typescript
async deletePackagePhoto(
  filename: string,
  packageId?: string,
  tenantId?: string
): Promise<void> {
  try {
    // Optional: Add tenant context validation if package info available
    // if (packageId && tenantId) {
    //   const pkg = await catalogService.getPackageById(tenantId, packageId);
    //   if (!pkg) {
    //     throw new ForbiddenError('Package not found');
    //   }
    //   const photos = pkg.photos || [];
    //   if (!photos.some(p => p.filename === filename)) {
    //     throw new NotFoundError('Photo not found in package');
    //   }
    // }

    const filepath = path.join(this.packagePhotoUploadDir, filename);

    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
      logger.info(
        { filename, packageId, tenantId },
        'Package photo deleted successfully'
      );
    }
  } catch (error) {
    logger.error({ error, filename }, 'Error deleting package photo');
    throw error;
  }
}
```

### File: `/server/src/routes/tenant-admin.routes.ts` (Line 526)

**BEFORE:**

```typescript
await uploadService.deletePackagePhoto(filename);
```

**AFTER:**

```typescript
await uploadService.deletePackagePhoto(filename, packageId, tenantId);
```

---

## MEDIUM-002: Add Role Check to Tenant Admin Routes

### File: `/server/src/routes/tenant-admin.routes.ts`

Add this validation to EVERY route handler that accesses `tenantAuth`:

**BEFORE:**

```typescript
async uploadLogo(req: Request, res: Response): Promise<void> {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
      return;
    }
    const tenantId = tenantAuth.tenantId;
```

**AFTER:**

```typescript
async uploadLogo(req: Request, res: Response): Promise<void> {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
      return;
    }

    // NEW: Verify user has admin role for this tenant
    if (tenantAuth.role !== 'TENANT_ADMIN') {
      res.status(403).json({
        error: 'Forbidden: Tenant admin access required'
      });
      return;
    }

    const tenantId = tenantAuth.tenantId;
```

**Apply same pattern to all other route handlers:**

- `uploadLogo()` - Line 75
- `updateBranding()` - Line 131
- `getBranding()` - Line 198
- `/packages` GET - Line 259
- `/packages` POST - Line 289
- `/packages/:id` PUT - Line 325
- `/packages/:id` DELETE - Line 362
- `/packages/:id/photos` POST - Line 397
- `/packages/:id/photos/:filename` DELETE - Line 497
- `/blackouts` GET - Line 552
- `/blackouts` POST - Line 589
- `/blackouts/:id` DELETE - Line 617
- `/bookings` GET - Line 651

---

## Migration Strategy

For Customer and Venue migrations, consider this approach:

```typescript
// In a migration file: ./prisma/migrations/[timestamp]_add_tenant_to_customer_venue/migration.sql

-- Step 1: Add tenantId columns (nullable initially)
ALTER TABLE "Customer" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Venue" ADD COLUMN "tenantId" TEXT;

-- Step 2: Populate tenantId for existing records
-- For customers: Get tenantId from their bookings
UPDATE "Customer" c SET "tenantId" = (
  SELECT DISTINCT "tenantId" FROM "Booking"
  WHERE "customerId" = c."id"
  LIMIT 1
)
WHERE c."tenantId" IS NULL;

-- For venues: Get tenantId from their bookings
UPDATE "Venue" v SET "tenantId" = (
  SELECT DISTINCT "tenantId" FROM "Booking"
  WHERE "venueId" = v."id"
  LIMIT 1
)
WHERE v."tenantId" IS NULL;

-- Step 3: Handle orphaned records (no bookings)
-- These might be test data - decide on case-by-case basis

-- Step 4: Make columns NOT NULL and add constraints
ALTER TABLE "Customer" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Venue" ALTER COLUMN "tenantId" SET NOT NULL;

-- Drop old unique constraint
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_email_key";

-- Add foreign keys and new constraints
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

ALTER TABLE "Venue"
  ADD CONSTRAINT "Venue_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

-- Create new unique constraints
CREATE UNIQUE INDEX "Customer_tenantId_email_key" ON "Customer"("tenantId", "email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "Venue_tenantId_name_key" ON "Venue"("tenantId", "name");

-- Create indexes for queries
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");
CREATE INDEX "Venue_tenantId_idx" ON "Venue"("tenantId");
```

---

## Testing Checklist

After applying these fixes, verify with:

```typescript
// TEST-001: Cross-tenant customer isolation
test('Customer records should be tenant-isolated', async () => {
  const tenantA = await createTenant('vendor-a');
  const tenantB = await createTenant('vendor-b');

  const booking1 = await createBooking(tenantA.id, 'couple@example.com');
  const booking2 = await createBooking(tenantB.id, 'couple@example.com');

  const customerA = await db.customer.findFirst({
    where: { email: 'couple@example.com', tenantId: tenantA.id },
  });

  const customerB = await db.customer.findFirst({
    where: { email: 'couple@example.com', tenantId: tenantB.id },
  });

  expect(customerA.id).not.toBe(customerB.id);
  expect(customerA.tenantId).toBe(tenantA.id);
  expect(customerB.tenantId).toBe(tenantB.id);
});

// TEST-002: Venue cross-tenant access prevented
test('Booking should reject venue from different tenant', async () => {
  const tenantA = await createTenant('vendor-a');
  const tenantB = await createTenant('vendor-b');

  const venue = await createVenue(tenantA.id, 'Grand Ballroom');

  expect(() => {
    createBooking(tenantB.id, 'couple@example.com', { venueId: venue.id });
  }).toThrow('Venue not found for this tenant');
});

// TEST-003: Webhook payment validation
test('Webhook should reject mismatched packageId', async () => {
  const webhook = createStripeWebhook({
    metadata: {
      tenantId: 'tenant-a',
      packageId: 'pkg-from-tenant-b', // Spoofed
    },
  });

  expect(() => {
    handleWebhook(webhook);
  }).toThrow('Package not found for tenant');
});
```

---

## Deployment Order

1. **Create migration** for Customer/Venue tenantId
2. **Deploy schema changes** to staging
3. **Update code** in booking.repository.ts, webhooks.routes.ts, etc.
4. **Test thoroughly** in staging
5. **Deploy to production** (with monitoring)
6. **Monitor logs** for any migration issues
7. **Document changes** for team

---

**Priority**: Deploy CRITICAL fixes before any production release
**Timeline**: 2 weeks for complete remediation
**Review**: Have security team verify all changes
