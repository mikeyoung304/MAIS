# MULTI-TENANT ISOLATION AUDIT REPORT

## Elope Codebase Security Analysis

**Date**: 2025-11-14  
**Branch**: mvpstable  
**Severity Levels**: CRITICAL | HIGH | MEDIUM | LOW

---

## EXECUTIVE SUMMARY

The Elope codebase demonstrates **strong multi-tenant architecture foundations** with JWT token scoping and database-level tenant isolation. However, several **CRITICAL data isolation vulnerabilities** exist that could cause cross-tenant data collisions and customer privacy breaches.

### Risk Summary

- **CRITICAL**: 3 issues (Customer/Venue cross-tenant data leakage, Payment routing)
- **HIGH**: 2 issues (Admin auth validation gaps, Booking unique constraint)
- **MEDIUM**: 4 issues (Feature gaps and inconsistencies)
- **LOW**: 2 issues (Future-proofing recommendations)

---

## 1. CRITICAL VULNERABILITIES

### CRITICAL-001: Customer Model Missing Tenant Isolation

**Severity**: CRITICAL - IMMEDIATE DATA CORRUPTION RISK

**Location**: `/server/prisma/schema.prisma:84-92`

**Issue**:

```prisma
model Customer {
  id        String    @id @default(cuid())
  email     String?   @unique        // ⚠️ GLOBAL UNIQUE - Cross-tenant collision risk
  phone     String?
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  bookings  Booking[]
}
```

The Customer model has NO `tenantId` field and uses a GLOBAL unique constraint on `email`. This creates a cross-tenant data leakage:

1. **Tenant A** creates a booking for couple@example.com
2. **Tenant B** attempts to create a booking for the SAME email
3. The `customer.upsert()` finds Tenant A's customer and **reuses it**
4. Tenant B's booking is now linked to Tenant A's customer record

**Current Usage** (vulnerable):

- File: `/server/src/adapters/prisma/booking.repository.ts:112-123`

```typescript
const customer = await tx.customer.upsert({
  where: { email: booking.email }, // ⚠️ Looks up customer WITHOUT tenant scope
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

**Attack Scenario**:

1. Tenant A (vendor) claims email "alice@gmail.com"
2. Tenant B (competitor) books same customer email
3. Tenant A sees Tenant B's customer data (name, phone, bookings count)
4. Cross-tenant customer records are merged
5. Booking history becomes corrupted

**Fix Required**:

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

  // Change GLOBAL unique to TENANT-SCOPED unique
  @@unique([tenantId, email])  // Each tenant has unique customer emails
  @@index([tenantId])
}
```

**Code Changes Required**:

```typescript
// In booking.repository.ts line 112
const customer = await tx.customer.upsert({
  where: { tenantId_email: { tenantId, email: booking.email } }, // NEW: Tenant-scoped lookup
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

**Business Impact**:

- Customer privacy breach (emails, phone numbers shared across tenants)
- Booking history corruption
- Potential compliance violations (GDPR Article 32)

---

### CRITICAL-002: Venue Model Missing Tenant Isolation

**Severity**: CRITICAL - SAME RISK AS CUSTOMER

**Location**: `/server/prisma/schema.prisma:94-105`

**Issue**:

```prisma
model Venue {
  id        String    @id @default(cuid())
  name      String     // ⚠️ NO UNIQUE CONSTRAINT - But allows cross-tenant reuse
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

While Venue lacks a global unique constraint (unlike Customer), it has NO tenant isolation field. Bookings can reference ANY venue from ANY tenant.

**Current Usage** (vulnerable):

- File: `/server/src/adapters/prisma/booking.repository.ts:145`

```typescript
// Booking references venueId WITHOUT verifying it belongs to the tenant
const created = await tx.booking.create({
  data: {
    // ...
    venueId: booking.venueId, // ⚠️ No tenant validation
    // ...
  },
});
```

**Attack Scenario**:

1. Tenant A creates "Grand Ballroom" venue (id: venue_123)
2. Tenant B creates booking with `venueId: venue_123`
3. Tenant B's booking references Tenant A's venue
4. Tenant A can see Tenant B's bookings for their venue
5. Venue data is effectively shared across tenants

**Fix Required**:

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

  @@unique([tenantId, name])  // Each tenant has unique venue names
  @@index([tenantId])
}
```

**Booking Validation Required**:

```typescript
// Before creating booking, verify venue belongs to tenant
if (booking.venueId) {
  const venue = await tx.venue.findFirst({
    where: { id: booking.venueId, tenantId }, // Verify ownership
  });
  if (!venue) {
    throw new NotFoundError(`Venue not found for this tenant`);
  }
}
```

---

### CRITICAL-003: Payment Stripe Webhook Tenant Routing

**Severity**: CRITICAL - PAYMENT MISROUTING RISK

**Location**: `/server/src/routes/webhooks.routes.ts:113-272`

**Issue**:
The webhook handler relies entirely on `tenantId` from the Stripe session metadata. If Stripe event is spoofed or metadata is corrupted, payments could be routed to the wrong tenant.

**Current Flow**:

```typescript
// Line 128-134: Extract tenantId from webhook payload
let tenantId = 'unknown';
try {
  const tempSession = event.data.object as any;
  tenantId = tempSession?.metadata?.tenantId || 'unknown';  // ⚠️ Trusts metadata
} catch (err) {
  logger.warn({ eventId: event.id }, 'Could not extract tenantId from webhook metadata');
}

// Line 181: Uses extracted tenantId for booking creation
const { tenantId: validatedTenantId, packageId, eventDate, email, coupleName... } = metadataResult.data;

// Line 232: Creates booking under that tenantId
await this.bookingService.onPaymentCompleted(validatedTenantId, { ... });
```

**Current Protections** (Good):

- Stripe signature verification: ✅
- Zod metadata validation: ✅
- Duplicate event ID check: ✅

**Current Gaps** (Bad):

- NO verification that `packageId` belongs to the extracted `tenantId`
- NO verification that `stripePaymentIntentId` hasn't been used by another tenant
- NO validation of `tenantId` against Stripe account ownership

**Attack Scenario**:

1. Attacker intercepts Stripe session metadata
2. Changes `tenantId` from tenant_A to tenant_B
3. Signs webhook with valid key (requires Stripe compromise, but possible)
4. Payment for Tenant A's package is recorded under Tenant B
5. Tenant B's Stripe account receives payment for Tenant A's service

**Fix Required**:

```typescript
// Add POST-VALIDATION checks
// 1. Verify packageId belongs to extracted tenantId
const pkg = await this.catalogRepo.getPackageById(validatedTenantId, packageId);
if (!pkg) {
  throw new WebhookValidationError(
    `Package ${packageId} not found for tenant ${validatedTenantId}`
  );
}

// 2. Verify stripePaymentIntentId hasn't been used by a DIFFERENT tenant
const existingPayment = await this.webhookRepo.findPaymentByStripeId(session.payment_intent);
if (existingPayment && existingPayment.tenantId !== validatedTenantId) {
  throw new WebhookValidationError(`Payment Intent already used by different tenant`);
}

// 3. Verify Stripe session's connected account matches tenant's account
const tenant = await this.tenantRepo.findById(validatedTenantId);
if (tenant.stripeAccountId !== event.account) {
  // Compare accounts
  throw new WebhookValidationError(
    `Webhook account mismatch: expected ${tenant.stripeAccountId}, got ${event.account}`
  );
}
```

---

## 2. HIGH SEVERITY ISSUES

### HIGH-001: Booking Unique Constraint Too Broad

**Severity**: HIGH - DATA INTEGRITY ISSUE

**Location**: `/server/prisma/schema.prisma:191`

**Issue**:

```prisma
@@unique([tenantId, date]) // Each tenant can only have one booking per date
```

This constraint enforces ONE booking per date per tenant, but allows multiple bookings on the same date if:

- They have different times (startTime/endTime)
- They're for different events

A typical wedding venue might have:

- 11:00 AM ceremony
- 7:00 PM reception
- Both same date, different times

**Current Situation**:

```typescript
// In booking.repository.ts line 103-104
const existing = await tx.booking.findFirst({
  where: { tenantId, date: new Date(booking.eventDate) }, // Only checks DATE
});
```

This would prevent double-booking of the same date even if times don't overlap.

**Fix Required**:

```prisma
// Add time-based uniqueness
@@unique([tenantId, date, startTime])  // Allow multiple bookings same date, different times
```

Or implement application-level validation:

```typescript
// Check for time overlap, not just date match
const conflicting = await tx.booking.findFirst({
  where: {
    tenantId,
    date: new Date(booking.eventDate),
    AND: [{ startTime: { lte: booking.endTime } }, { endTime: { gte: booking.startTime } }],
  },
});
```

**Business Impact**:

- Venues can only book ONE event per day
- Lost revenue from multiple events
- Incorrect availability checks

---

### HIGH-002: Admin Token Validation Incomplete

**Severity**: HIGH - PRIVILEGE ESCALATION RISK

**Location**: `/server/src/middleware/auth.ts:40-53`

**Issue**:
The admin auth middleware validates token type but doesn't prevent a TENANT_ADMIN from using tenant tokens on admin routes:

```typescript
// Line 39-46
if ('type' in payload && (payload as any).type === 'tenant') {
  throw new UnauthorizedError('Invalid token type: tenant tokens are not allowed for admin routes');
}

// Line 48-52
if (!payload.role || payload.role !== 'admin') {
  throw new UnauthorizedError('Invalid token: admin role required for admin routes');
}
```

**Current Gap**:
A user with `role: 'TENANT_ADMIN'` would pass both checks:

- `type` field is not present (no 'type' in payload)
- `role` is 'TENANT_ADMIN', not 'admin'

Second check should explicitly reject tenant admins:

```typescript
// VULNERABLE CODE PATH
const payload: TokenPayload = {
  userId: user.id,
  email: user.email,
  role: 'TENANT_ADMIN', // ⚠️ Would pass the check above
};

// Even though role != 'admin', tenant tokens DON'T have 'type' field
// So the type check doesn't catch them
```

**Fix Required**:

```typescript
// Line 49: Add explicit check for admin role ONLY
if (!payload.role || (payload.role !== 'admin' && payload.role !== 'PLATFORM_ADMIN')) {
  throw new UnauthorizedError('Admin or Platform Admin role required for admin routes');
}

// Better: Explicitly list allowed roles
const allowedRoles = ['ADMIN', 'PLATFORM_ADMIN'];
if (!allowedRoles.includes(payload.role)) {
  throw new UnauthorizedError('Insufficient permissions for admin routes');
}
```

---

## 3. MEDIUM SEVERITY ISSUES

### MEDIUM-001: User Email Global Unique Constraint

**Severity**: MEDIUM - ACCOUNT CREATION BOTTLENECK

**Location**: `/server/prisma/schema.prisma:15-27`

**Issue**:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique  // ⚠️ GLOBAL unique
  name         String?
  passwordHash String
  role         UserRole @default(USER)
  tenantId     String?  // Optional: only for TENANT_ADMIN
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  tenant       Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}
```

While User has `tenantId` field, email is GLOBALLY unique. This means:

1. A platform admin user@example.com occupies the email globally
2. A tenant admin for different tenants cannot share the same email
3. Email is meant for auth, but this creates artificial constraints

**Design Question**: Should different tenants' admin users be allowed the same email?

**Current Behavior**: NO - only one user@example.com can exist across entire platform

**Risk**:

- Email address collisions across tenants
- If supporting multiple tenant admins per email, schema needs refactoring

---

### MEDIUM-002: Cache Keys Properly Include TenantId

**Severity**: MEDIUM - CACHE POISONING PREVENTION (Already Implemented ✅)

**Location**: `/server/src/services/catalog.service.ts:57-74`

**Good Implementation** (No issue, noting for completeness):

```typescript
async getAllPackages(tenantId: string): Promise<PackageWithAddOns[]> {
  // ✅ CORRECT: Cache key includes tenantId
  const cacheKey = `catalog:${tenantId}:all-packages`;

  const cached = this.cache?.get<PackageWithAddOns[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const packages = await this.repository.getAllPackagesWithAddOns(tenantId);
  this.cache?.set(cacheKey, packages, 900);
  return packages;
}
```

All cache keys properly scope to tenantId. ✅ **No issue here**

---

### MEDIUM-003: File Upload Tenant Isolation

**Severity**: MEDIUM - INCOMPLETE TENANT CONTEXT IN DELETIONS

**Location**: `/server/src/services/upload.service.ts:149-183`

**Issue**:

```typescript
async uploadPackagePhoto(file: UploadedFile, packageId: string): Promise<UploadResult> {
  // ... validation ...

  const filename = this.generateFilename(file.originalname, 'package');
  const filepath = path.join(this.packagePhotoUploadDir, filename);

  await fs.promises.writeFile(filepath, file.buffer);

  // ⚠️ NO TENANT VERIFICATION
  // If packageId is forged, file is uploaded to shared directory
}
```

When deleting photos:

```typescript
async deletePackagePhoto(filename: string): Promise<void> {
  // ⚠️ CRITICAL: Only takes filename, no packageId or tenantId
  // Cannot verify file belongs to tenant before deletion
  // DOS: Delete other tenants' photos by guessing filenames

  const filepath = path.join(this.packagePhotoUploadDir, filename);
  if (fs.existsSync(filepath)) {
    await fs.promises.unlink(filepath);
  }
}
```

**Attack Scenario**:

1. Tenant A uploads photo: "package-1731529800-a1b2c3d4.jpg"
2. Tenant B guesses filename format
3. Tenant B calls DELETE with "package-1731529800-a1b2c3d4.jpg"
4. Deletes Tenant A's photo

**Fix Required**:

```typescript
async deletePackagePhoto(tenantId: string, packageId: string, filename: string): Promise<void> {
  // 1. Verify package belongs to tenant
  const pkg = await catalogService.getPackageById(tenantId, packageId);
  if (!pkg) {
    throw new ForbiddenError('Package not found');
  }

  // 2. Verify filename is in package's photos array
  const photos = pkg.photos || [];
  if (!photos.some(p => p.filename === filename)) {
    throw new NotFoundError('Photo not found in package');
  }

  // 3. Now safe to delete
  const filepath = path.join(this.packagePhotoUploadDir, filename);
  if (fs.existsSync(filepath)) {
    await fs.promises.unlink(filepath);
  }
}
```

---

### MEDIUM-004: Tenant Admin Routes Missing Role Check

**Severity**: MEDIUM - AUTHORIZATION BYPASS POTENTIAL

**Location**: `/server/src/routes/tenant-admin.routes.ts:75-225`

**Issue**:
Tenant admin routes extract `tenantAuth` from middleware but don't verify the user's role within that tenant:

```typescript
async uploadLogo(req: Request, res: Response): Promise<void> {
  const tenantAuth = res.locals.tenantAuth;
  if (!tenantAuth) {
    res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
    return;
  }
  const tenantId = tenantAuth.tenantId;  // ⚠️ No role verification

  // If tenantAuth is from a non-admin user of the tenant, still allows upload
}
```

If a regular tenant user (role != TENANT_ADMIN) gets a token, they could access tenant admin endpoints.

**Fix Required**:

```typescript
const tenantAuth = res.locals.tenantAuth;
if (!tenantAuth) {
  res.status(401).json({ error: 'Unauthorized' });
  return;
}

// ⚠️ ADD THIS CHECK
if (tenantAuth.role !== 'TENANT_ADMIN') {
  res.status(403).json({ error: 'Forbidden: Admin access required' });
  return;
}

const tenantId = tenantAuth.tenantId;
```

---

## 4. LOW SEVERITY ISSUES

### LOW-001: Blackout Date Query Directly Accesses Prisma

**Severity**: LOW - CODE SMELL, NOT A SECURITY ISSUE

**Location**: `/server/src/routes/tenant-admin.routes.ts:562`

**Issue**:

```typescript
// Accessing prisma directly from repository
const prisma = (blackoutRepo as any).prisma; // ⚠️ Type bypass
const fullBlackouts = await prisma.blackoutDate.findMany({
  where: { tenantId },
  orderBy: { date: 'asc' },
  // ...
});
```

This breaks encapsulation of the repository pattern. The route shouldn't access prisma directly.

**Fix**: Add method to BlackoutRepository:

```typescript
async findAllForTenant(tenantId: string): Promise<BlackoutDate[]> {
  return this.prisma.blackoutDate.findMany({
    where: { tenantId },
    orderBy: { date: 'asc' },
  });
}
```

---

### LOW-002: Device/IP Logging for Security Events

**Severity**: LOW - AUDIT TRAIL IMPROVEMENT

**Location**: `/server/src/routes/index.ts:120-137`

**Issue**:
Login attempts log IP address but no user agent or device info:

```typescript
adminLogin: async ({ req, body }) => {
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
  try {
    const data = await controllers.admin.login(body);
    return { status: 200, body: data };
  } catch (error) {
    logger.warn({
      event: 'admin_login_failed',
      endpoint: '/v1/admin/login',
      email: body.email,
      ipAddress, // ⚠️ Only IP, no User-Agent
      // ...
    });
  }
};
```

**Enhancement** (Not required):

```typescript
logger.warn({
  event: 'admin_login_failed',
  endpoint: '/v1/admin/login',
  email: body.email,
  ipAddress,
  userAgent: req.get('User-Agent'),
  timestamp: new Date().toISOString(),
});
```

---

## 5. PASSING SECURITY CHECKS

The following areas were reviewed and found to be **PROPERLY IMPLEMENTED**:

### ✅ Webhook Signature Verification

- Stripe webhook signature validated before processing
- Raw body required for signature verification
- Zod payload validation instead of unsafe JSON.parse

### ✅ JWT Token Isolation

- Tenant tokens include `type: 'tenant'` field
- Admin tokens have `role: 'admin'` field
- Tokens cannot be interchanged between systems
- Explicit algorithm validation (HS256 only)

### ✅ TenantId Propagation in Services

- All service methods accept and enforce tenantId
- Database queries consistently filter by tenantId
- Repository pattern properly encapsulates tenant isolation

### ✅ Booking Race Condition Protection

- SERIALIZABLE transaction isolation level
- Pessimistic locking with FOR UPDATE NOWAIT
- Timeout handling for lock contention
- Unique constraint enforcement at database level

### ✅ API Key Validation

- Public key format validation before database lookup
- Tenant active status verification
- Proper error codes for different failure modes

---

## 6. SUMMARY OF REQUIRED FIXES

| Priority | Issue                             | Effort | Impact               |
| -------- | --------------------------------- | ------ | -------------------- |
| CRITICAL | Customer model missing tenantId   | Medium | Data corruption      |
| CRITICAL | Venue model missing tenantId      | Medium | Cross-tenant access  |
| CRITICAL | Payment webhook tenant routing    | Medium | Payment misrouting   |
| HIGH     | Booking date uniqueness too broad | Low    | Feature limitation   |
| HIGH     | Admin auth role validation        | Low    | Privilege escalation |
| MEDIUM   | User email global unique          | Low    | Design decision      |
| MEDIUM   | Upload file deletion tenant check | Low    | DOS vulnerability    |
| MEDIUM   | Tenant admin role verification    | Low    | Authorization gap    |
| LOW      | Blackout query encapsulation      | Low    | Code quality         |

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1 (BLOCKING - Do First)

1. **Customer Model Migration**
   - Add tenantId field
   - Create composite unique index (tenantId, email)
   - Update booking.repository.ts to use tenantId in upsert
   - Migration: Cluster existing customers by email → assign to bookings' tenants

2. **Venue Model Migration**
   - Add tenantId field
   - Add validation in booking creation
   - Migration: Assign venues to first tenant that uses them

3. **Webhook Payment Validation**
   - Add packageId verification
   - Add stripePaymentIntentId deduplication check
   - Add Stripe account ownership verification

### Phase 2 (HIGH - Before Production)

1. Update admin auth middleware role check
2. Verify booking time-based uniqueness strategy
3. Add tenant verification to file deletion
4. Add role check to tenant admin routes

### Phase 3 (MEDIUM - Hardening)

1. Evaluate User email global unique constraint
2. Improve repository encapsulation (Blackout query)
3. Enhanced audit logging with user agent

---

## TESTING RECOMMENDATIONS

### Penetration Test Scenarios

```
TEST-001: Cross-Tenant Customer Access
- Create booking in Tenant A with email: test@example.com
- Create booking in Tenant B with SAME email
- Verify: Each tenant has separate customer records
- Expect: 2 distinct customer records, one per tenant

TEST-002: Venue Cross-Tenant Assignment
- Create venue in Tenant A
- Attempt to book same venue from Tenant B
- Verify: Request fails or uses Tenant B's venue only
- Expect: 403 Forbidden or 404 Not Found

TEST-003: Payment Webhook Spoofing
- Create legitimate Stripe session for Tenant A
- Intercept webhook, modify tenantId to Tenant B
- Re-send webhook
- Verify: Payment routed to Tenant A (correct), not Tenant B
- Expect: Webhook rejected or booking created under Tenant A

TEST-004: File Deletion DOS
- Upload photo to Tenant A package
- Extract filename
- Try to delete from Tenant B using same filename
- Verify: Deletion blocked
- Expect: 403 Forbidden
```

---

## COMPLIANCE NOTES

- GDPR Article 32: Encryption and access controls for personal data (**Partly compliant** - Customer email not tenant-isolated)
- SOC 2 Type II: Logical and physical access controls (**Gap in Customer/Venue isolation**)
- PCI DSS: Payment isolation and audit trails (**Webhook validation needed**)

---

**Report Generated**: 2025-11-14  
**Auditor**: Claude Code Security Analysis  
**Status**: Requires Immediate Action on CRITICAL items
